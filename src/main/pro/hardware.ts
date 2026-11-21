// Прошивка, отладка и SWO Pro-режима: общая служба main (ST-Link, J-Link, CMSIS-DAP через OpenOCD; GDB/MI) и её IPC.
// БЕЗОПАСНОСТЬ: запись во Flash происходит только по явным командам пользователя: pro:flash (кнопка «Прошить»), pro:erase (confirm=true),
// pro:debug-load (confirm=true) и запись в память/регистры (confirm=true). Просто запуск отладки устройство не меняет.
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { existsSync, readdirSync, statSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import { getChip, listChips } from '../../shared/pro/chipdb'
import { UserError, guard, needRoot } from '../files/ipc'
import type { CliResult } from '../cli/types'
import type { DebugEvent, DebugSession, Probe, ProjectContext } from './interfaces'
import { app } from 'electron'
import { GdbDebugProvider, NO_GDB } from './debug/provider'
import type { LaunchOptions } from './debug/provider'
import { GdbError } from './debug/session'
import { fieldValue, parseSvd } from './debug/svd'
import type { SvdDevice } from './debug/svd'
import { pickTarget, projectProgrammer, swoArgs } from './openocd/args'
import { FlashFailure, noProbeError } from './openocd/logParse'
import type { FlashError, FlashSummary } from './openocd/logParse'
import { OpenOcdProgrammer, freePort } from './openocd/programmer'
import { startSwo } from './openocd/swo'
import type { SwoHandle } from './openocd/swo'
import { installOpenocd, installPlan } from './tools/openocdInstall'
import type { InstallPlan } from './tools/openocdInstall'
import { locateTool, setToolPath, toolsDir } from './tools/config'
import type { ProProject } from './project/types'
import type { ProgrammerKind } from '../../shared/pro/programmers'
import { proRegistry } from './registry'
import { parseProjectText } from './project/serialize'
import { PROJECT_FILE } from './project/types'
import { formatIssues } from './project/validate'

async function readProjectFor(root: string): Promise<{ found: false } | { found: true; ok: true; project: ProProject } | { found: true; ok: false; error: string }> {
  const file = join(root, PROJECT_FILE)
  const s = existsSync(file) ? await readFile(file, 'utf8') : null
  if (s === null) return { found: false }
  const r = parseProjectText(s)
  return r.ok ? { found: true, ok: true, project: r.project } : { found: true, ok: false, error: `${PROJECT_FILE}: ${formatIssues(r.errors)}` }
}

const locateOpenocd = (): string | null => locateTool('openocd')?.path ?? null
const locateGdb = (): string | null => locateTool('arm-none-eabi-gdb')?.path ?? null

export const programmer = new OpenOcdProgrammer(locateOpenocd)
export const debugProvider = new GdbDebugProvider(programmer, locateGdb)

const ok = <T>(data: T): CliResult<T> => ({ ok: true, data })
const send = (channel: string, payload: unknown): void => { for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(channel, payload) }

/** Ошибки оборудования показываем как есть (UserError), прочие — стандартно. */
async function hw<T>(fn: () => Promise<T>): Promise<CliResult<T>> {
  return guard(async () => {
    try { return await fn() } catch (e) {
      if (e instanceof FlashFailure || e instanceof GdbError) throw new UserError(e.message)
      throw e
    }
  })
}

// ---------- файл прошивки ----------

/** ELF сборки выбранной конфигурации: build/<конфигурация>/<имя проекта>.elf, иначе единственный .elf в папке. */
export function findElf(root: string, project: ProProject, configuration: string): string | null {
  const dir = join(root, 'build', configuration)
  const exact = join(dir, project.name + '.elf')
  if (existsSync(exact)) return exact
  try {
    const all = readdirSync(dir).filter((f) => /\.elf$/i.test(f)).map((f) => join(dir, f))
    if (all.length) return all.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
  } catch { /* папки нет */ }
  return null
}

async function context(configuration: unknown): Promise<ProjectContext> {
  const root = needRoot()
  const r = await readProjectFor(root)
  if (!r.found) throw new UserError('В папке нет файла avride.project.json.')
  if (!r.ok) throw new UserError(r.error)
  if (typeof configuration !== 'string' || !r.project.configurations[configuration]) throw new UserError('Не выбрана конфигурация проекта.')
  return { root, project: r.project, configuration }
}

/** Выбранный программатор; без явного выбора — первый того типа, что записан в проекте (программатор другого типа сам не подставляется). */
async function pickProbe(id: unknown, kind?: ProgrammerKind): Promise<Probe | null> {
  const all = await programmer.listProbes()
  if (typeof id === 'string' && id) return all.find((p) => p.id === id) ?? null
  return kind ? (all.find((p) => p.kind === kind) ?? null) : (all[0] ?? null)
}

// ---------- прошивка ----------

export interface FlashRequest { config: string; probeId?: string; verify?: boolean; reset?: boolean; speedKhz?: number; resetMode?: 'normal' | 'under-reset' }
export type FlashOutcome = { ok: true; summary: FlashSummary; file: string } | { ok: false; error: FlashError }

let busy: AbortController | null = null
let session: DebugSession | null = null
let swo: SwoHandle | null = null
let swoStarting = false
let svd: { key: string; dev: SvdDevice } | null = null

const errOutcome = (e: unknown): { ok: false; error: FlashError } => {
  if (e instanceof FlashFailure) return { ok: false, error: e.detail }
  throw e
}

export async function flashProject(req: FlashRequest): Promise<FlashOutcome> {
  if (busy) throw new UserError('Уже выполняется другая операция с программатором.')
  if (session) throw new UserError('Идёт отладка: остановите её перед прошивкой.')
  if (swo) throw new UserError('Идёт приём SWO: остановите его перед прошивкой (программатор занят).')
  const ctx = await context(req.config)
  const file = findElf(ctx.root, ctx.project, ctx.configuration)
  if (!file) return { ok: false, error: { kind: 'unknown', title: 'Нет собранной программы', hint: 'Сначала соберите проект кнопкой «Собрать»: файл .elf ещё не создан.' } }
  const probe = await pickProbe(req.probeId, projectProgrammer(ctx.project))
  if (!probe) return { ok: false, error: noProbeError(projectProgrammer(ctx.project)) }
  busy = new AbortController()
  try {
    await programmer.flash(ctx, probe, {
      file, verify: req.verify !== false, reset: req.reset !== false, speedKhz: req.speedKhz, resetMode: req.resetMode, signal: busy.signal,
      onLog: (l) => send('pro:log', l), onPhase: (phase, label, fraction) => send('pro:flash-phase', { phase, label, fraction })
    })
    return { ok: true, summary: programmer.lastSummary ?? { verified: false }, file }
  } catch (e) { return errOutcome(e) } finally { busy = null }
}

export async function eraseChip(req: FlashRequest): Promise<FlashOutcome> {
  if (busy) throw new UserError('Уже выполняется другая операция с программатором.')
  if (session) throw new UserError('Идёт отладка: остановите её перед стиранием.')
  if (swo) throw new UserError('Идёт приём SWO: остановите его перед стиранием (программатор занят).')
  const ctx = await context(req.config)
  const probe = await pickProbe(req.probeId, projectProgrammer(ctx.project))
  if (!probe) return { ok: false, error: noProbeError(projectProgrammer(ctx.project)) }
  busy = new AbortController()
  try {
    await programmer.erase(ctx, probe, { mass: true, signal: busy.signal, onLog: (l) => send('pro:log', l) })
    return { ok: true, summary: { verified: false }, file: '' }
  } catch (e) { return errOutcome(e) } finally { busy = null }
}

// ---------- отладка ----------

async function debugStart(req: FlashRequest & { stopAtMain?: boolean }): Promise<{ ok: true; elf: string; id: string } | { ok: false; error: FlashError }> {
  if (busy || session) throw new UserError('Отладка уже запущена или идёт другая операция.')
  if (swo) throw new UserError('Идёт приём SWO: остановите его перед запуском отладки (программатор занят).')
  const ctx = await context(req.config)
  const elf = findElf(ctx.root, ctx.project, ctx.configuration)
  if (!elf) return { ok: false, error: { kind: 'unknown', title: 'Нет собранной программы', hint: 'Соберите проект в конфигурации Debug (кнопка «Собрать»): для отладки нужен .elf.' } }
  const probe = await pickProbe(req.probeId, projectProgrammer(ctx.project))
  if (!probe) return { ok: false, error: noProbeError(projectProgrammer(ctx.project)) }
  busy = new AbortController()
  try {
    const opts: LaunchOptions = { elf, speedKhz: req.speedKhz, resetMode: req.resetMode, stopAtMain: req.stopAtMain, onLog: (l) => send('pro:log', l), signal: busy.signal }
    const s = await debugProvider.launch(ctx, probe, opts)
    session = s
    s.onEvent((e: DebugEvent) => {
      send('pro:debug-event', e)
      if (e.state === 'exited' && session === s) { session = null; void s.stop().catch(() => undefined) }
    })
    s.onLog((l) => send('pro:log', l))
    return { ok: true, elf, id: s.id }
  } catch (e) { return errOutcome(e) } finally { busy = null }
}

const need = (): DebugSession => { if (!session) throw new UserError('Отладка не запущена.'); return session }
const int = (v: unknown, what: string, min = 0, max = 0xffffffff): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new UserError(`Неверное значение: ${what}.`)
  return v
}
const text = (v: unknown, what: string, max = 500): string => {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new UserError(`Неверное значение: ${what}.`)
  return v
}

export type DebugCmd =
  | 'resume' | 'pause' | 'stepOver' | 'stepInto' | 'stepOut' | 'state'
  | 'setBreakpoint' | 'setFunctionBreakpoint' | 'removeBreakpoint' | 'listBreakpoints'
  | 'stack' | 'selectFrame' | 'locals' | 'evaluate' | 'registers' | 'readMemory' | 'writeMemory' | 'disassemble' | 'loadProgram'

async function debugCmd(cmd: unknown, a: Record<string, unknown>): Promise<unknown> {
  const s = need()
  switch (cmd as DebugCmd) {
    case 'resume': await s.resume(); return null
    case 'pause': await s.pause(); return null
    case 'stepOver': await s.stepOver(); return null
    case 'stepInto': await s.stepInto(); return null
    case 'stepOut': await s.stepOut(); return null
    case 'state': return s.state()
    case 'setBreakpoint': return s.setBreakpoint(text(a['file'], 'файл', 1000), int(a['line'], 'строка', 1, 10_000_000), a['condition'] ? { condition: text(a['condition'], 'условие') } : undefined)
    case 'setFunctionBreakpoint': return s.setFunctionBreakpoint(text(a['name'], 'функция', 200), a['condition'] ? { condition: text(a['condition'], 'условие') } : undefined)
    case 'removeBreakpoint': await s.removeBreakpoint(int(a['id'], 'номер точки', 1, 1_000_000)); return null
    case 'listBreakpoints': return s.listBreakpoints()
    case 'stack': return s.stack()
    case 'selectFrame': await s.selectFrame(int(a['index'], 'кадр', 0, 1000)); return null
    case 'locals': return s.locals()
    case 'evaluate': return s.evaluate(text(a['expr'], 'выражение'))
    case 'registers': return s.readRegisters()
    case 'readMemory': return Array.from(await s.readMemory(int(a['address'], 'адрес'), int(a['length'], 'длина', 1, 65536)))
    case 'disassemble': return s.disassemble(a['address'] === null || a['address'] === undefined ? null : int(a['address'], 'адрес'), int(a['count'], 'число строк', 1, 200))
    case 'writeMemory': {
      if (a['confirm'] !== true) throw new UserError('Запись в память устройства нужно подтвердить.')
      const bytes = a['bytes']
      if (!Array.isArray(bytes) || !bytes.length || bytes.length > 1024 || bytes.some((b) => !Number.isInteger(b) || b < 0 || b > 255)) throw new UserError('Неверные данные для записи.')
      await s.writeMemory(int(a['address'], 'адрес'), Uint8Array.from(bytes as number[]))
      return null
    }
    case 'loadProgram':
      if (a['confirm'] !== true) throw new UserError('Загрузку программы в устройство нужно подтвердить.')
      await s.loadProgram()
      return null
    default: throw new UserError('Неизвестная команда отладчика.')
  }
}

export async function stopDebug(): Promise<void> {
  const s = session
  session = null
  if (s) await s.stop().catch(() => undefined)
  send('pro:debug-event', { state: 'exited', reason: 'stopped' } satisfies DebugEvent)
}

// ---------- SWO ----------

export interface SwoRequest { config: string; probeId?: string; traceClockHz: number; swoHz: number; speedKhz?: number }
export type SwoOutcome = { ok: true } | { ok: false; error: FlashError }

async function swoStart(req: SwoRequest): Promise<SwoOutcome> {
  if (swo || swoStarting) throw new UserError('Приём SWO уже запущен.')
  if (busy || session) throw new UserError('Программатор занят прошивкой или отладкой: дождитесь окончания и повторите.')
  const ctx = await context(req.config)
  const probe = await pickProbe(req.probeId, projectProgrammer(ctx.project))
  if (!probe) return { ok: false, error: noProbeError(projectProgrammer(ctx.project)) }
  swoStarting = true
  try {
    const { exe, base, kind, probe: pr } = await programmer.prepare(ctx, probe, { speedKhz: req.speedKhz })
    const port = await freePort()
    const args = swoArgs(base, { port, traceClockHz: req.traceClockHz, swoHz: req.swoHz })
    send('pro:log', `> openocd ${args.join(' ')}`)
    swo = await startSwo({
      exe, args, port,
      explain: (log) => programmer.explain(log, kind, pr),
      onLog: (l) => send('pro:log', l),
      onData: (c) => send('pro:swo-data', c),
      onEnd: (reason) => { swo = null; send('pro:swo-state', { running: false, reason }) }
    })
    send('pro:swo-state', { running: true })
    return { ok: true }
  } catch (e) { return errOutcome(e) } finally { swoStarting = false }
}

export async function swoStop(): Promise<void> {
  const s = swo
  swo = null
  if (s) await s.stop().catch(() => undefined)
  send('pro:swo-state', { running: false, reason: 'stopped' })
}

// ---------- SVD ----------

const svdDir = (): string => join(app.getPath('userData'), 'pro-svd')
const SVD_BASE = 'https://raw.githubusercontent.com/modm-io/cmsis-svd-stm32/main/'

export interface SvdInfo { file: string; url: string; cached: boolean }
function svdName(project: ProProject): string | null {
  if (project.svd) return project.svd
  const n = project.target.chip.toLowerCase()
  const c = listChips().filter((x) => n.startsWith(x.id)).sort((a, b) => b.id.length - a.id.length)[0] ?? getChip(n)
  return c?.files.svd ?? null
}

async function svdInfo(configuration: unknown): Promise<SvdInfo | null> {
  const ctx = await context(configuration)
  const name = svdName(ctx.project)
  if (!name) return null
  if (!/^[\w./-]+\.svd$/i.test(name) || name.includes('..')) throw new UserError('Недопустимое имя файла SVD.')
  const local = join(ctx.root, name)
  if (existsSync(local) && !/^stm32\w+\//i.test(name)) return { file: local, url: '', cached: true }
  const cached = join(svdDir(), basename(name))
  return { file: cached, url: SVD_BASE + name, cached: existsSync(cached) }
}

async function svdDownload(configuration: unknown): Promise<SvdInfo> {
  const info = await svdInfo(configuration)
  if (!info?.url) throw new UserError('Для этого чипа нет файла SVD.')
  let r: Response
  try { r = await fetch(info.url, { headers: { 'User-Agent': 'avr-ide' } }) } catch { throw new UserError('Не удалось скачать файл SVD: проверьте подключение к интернету.') }
  if (!r.ok) throw new UserError(`Сервер ответил ${r.status} на запрос файла SVD.`)
  const body = await r.text()
  parseSvd(body) // проверка, что это SVD
  await mkdir(svdDir(), { recursive: true })
  await writeFile(info.file, body, 'utf8')
  return { ...info, cached: true }
}

export interface SvdPeripheralBrief { name: string; base: number; description?: string; registers: number }

async function svdLoad(configuration: unknown): Promise<SvdPeripheralBrief[]> {
  const info = await svdInfo(configuration)
  if (!info || !info.cached) throw new UserError('Файл SVD не скачан.')
  const dev = parseSvd(await readFile(info.file, 'utf8'))
  svd = { key: info.file, dev }
  return dev.peripherals.map((p) => ({ name: p.name, base: p.base, description: p.description, registers: p.registers.length }))
}

function svdPeripheral(name: unknown): unknown {
  if (!svd) throw new UserError('SVD не загружен.')
  const p = svd.dev.peripherals.find((x) => x.name === name)
  if (!p) throw new UserError('Нет такой периферии в SVD.')
  return p
}

// ---------- инструменты ----------

export interface ToolsStatus {
  openocd: { path: string; source: string } | null
  gdb: { path: string; source: string } | null
  gdbHint: string
  /** Серьёзное предупреждение для UI: что не хватает */
  platform: string
}

function toolsStatus(): ToolsStatus {
  const o = locateTool('openocd'); const g = locateTool('arm-none-eabi-gdb')
  return { openocd: o, gdb: g, gdbHint: NO_GDB, platform: process.platform }
}

let installing = false

export function registerHardwareIpc(): void {
  proRegistry.register('programmer', programmer)
  proRegistry.register('debug', debugProvider)

  ipcMain.handle('pro:probes', () => hw(async () => (await programmer.listProbes()) as Probe[]))
  ipcMain.handle('pro:tools', () => hw(async () => toolsStatus()))
  ipcMain.handle('pro:tool-pick', (_e, tool: unknown) => hw(async () => {
    if (tool !== 'openocd' && tool !== 'arm-none-eabi-gdb') throw new UserError('Неизвестная программа.')
    const win = BrowserWindow.getFocusedWindow()
    const opts = { title: tool === 'openocd' ? 'Укажите openocd.exe' : 'Укажите arm-none-eabi-gdb.exe', properties: ['openFile' as const], filters: [{ name: 'Программа', extensions: ['exe'] }] }
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (r.canceled || !r.filePaths[0]) return toolsStatus()
    setToolPath(tool, r.filePaths[0])
    return toolsStatus()
  }))
  ipcMain.handle('pro:openocd-plan', () => hw(async () => installPlan()))
  ipcMain.handle('pro:openocd-install', (_e, confirmSha: unknown) => hw(async () => {
    if (installing) throw new UserError('Установка уже идёт.')
    const plan: InstallPlan = await installPlan()
    // Пользователь подтвердил именно этот архив: контрольная сумма из окна подтверждения должна совпасть
    if (confirmSha !== plan.sha256) throw new UserError('Сведения о релизе изменились: откройте окно установки заново.')
    installing = true
    try {
      const exe = await installOpenocd(plan, toolsDir(), (done, total) => send('pro:install-progress', { done, total }))
      return { path: exe }
    } finally { installing = false }
  }))

  ipcMain.handle('pro:flash', (_e, req: unknown) => hw(async () => flashProject(normReq(req))))
  ipcMain.handle('pro:cancel', () => ok(!!busy && (busy.abort(), true)))
  ipcMain.handle('pro:erase', (_e, req: unknown, confirm: unknown) => hw(async () => {
    if (confirm !== true) throw new UserError('Стирание всей памяти нужно подтвердить.')
    return eraseChip(normReq(req))
  }))

  ipcMain.handle('pro:debug-start', (_e, req: unknown) => hw(async () => debugStart(normReq(req))))
  ipcMain.handle('pro:swo-start', (_e, req: unknown) => hw(async () => swoStart(normSwo(req))))
  ipcMain.handle('pro:swo-stop', () => hw(async () => { await swoStop(); return true }))
  /** Сохранение текста консоли SWO в файл (диалог «Сохранить как»). В автотестах (AVRIDE_E2E=1) путь берётся из AVRIDE_PRO_SWO_SAVE_PATH. */
  ipcMain.handle('pro:swo-save', (_e, text: unknown) => hw(async () => {
    if (typeof text !== 'string' || text.length > 20_000_000) throw new UserError('Нечего сохранять.')
    let path: string | undefined
    if (process.env['AVRIDE_E2E'] === '1' && process.env['AVRIDE_PRO_SWO_SAVE_PATH']) path = process.env['AVRIDE_PRO_SWO_SAVE_PATH']
    else {
      const win = BrowserWindow.getFocusedWindow()
      const opts = { title: 'Сохранить вывод SWO', defaultPath: 'swo-log.txt', filters: [{ name: 'Текст', extensions: ['txt', 'log'] }] }
      const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
      path = r.canceled ? undefined : r.filePath
    }
    if (!path) return { path: null as string | null }
    await writeFile(path, text, 'utf8')
    return { path }
  }))
  ipcMain.handle('pro:swo-state', () => ok({ running: !!swo }))

  ipcMain.handle('pro:debug-stop', () => hw(async () => { await stopDebug(); return true }))
  ipcMain.handle('pro:debug-cmd', (_e, cmd: unknown, args: unknown) => hw(async () => debugCmd(cmd, (args && typeof args === 'object' ? args : {}) as Record<string, unknown>)))

  ipcMain.handle('pro:svd-info', (_e, config: unknown) => hw(async () => svdInfo(config)))
  ipcMain.handle('pro:svd-download', (_e, config: unknown, confirm: unknown) => hw(async () => {
    if (confirm !== true) throw new UserError('Скачивание нужно подтвердить.')
    return svdDownload(config)
  }))
  ipcMain.handle('pro:svd-load', (_e, config: unknown) => hw(async () => svdLoad(config)))
  ipcMain.handle('pro:svd-peripheral', (_e, name: unknown) => hw(async () => svdPeripheral(name)))
  ipcMain.handle('pro:svd-field', (_e, reg: unknown, off: unknown, width: unknown) => hw(async () => fieldValue(int(reg, 'значение'), { bitOffset: int(off, 'бит', 0, 31), bitWidth: int(width, 'ширина', 1, 32) })))
  ipcMain.handle('pro:target-info', (_e, config: unknown) => hw(async () => {
    const ctx = await context(config)
    return { openocdTarget: pickTarget(ctx.project), chip: ctx.project.target.chip, elf: findElf(ctx.root, ctx.project, ctx.configuration), programmer: projectProgrammer(ctx.project), sysclkHz: ctx.project.target.clock?.sysclkHz ?? null }
  }))
}

function normSwo(req: unknown): SwoRequest {
  const r = (req && typeof req === 'object' ? req : {}) as Record<string, unknown>
  if (typeof r['config'] !== 'string') throw new UserError('Не выбрана конфигурация.')
  const n = (v: unknown, what: string, min: number, max: number): number => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new UserError(`Неверное значение: ${what}.`)
    return v
  }
  const speed = r['speedKhz']
  return {
    config: r['config'], probeId: typeof r['probeId'] === 'string' ? r['probeId'] : undefined,
    traceClockHz: n(r['traceClockHz'], 'частота ядра, Гц (1 кГц … 1 ГГц)', 1000, 1_000_000_000),
    swoHz: n(r['swoHz'], 'скорость SWO, Гц (1 кГц … 100 МГц)', 1000, 100_000_000),
    speedKhz: typeof speed === 'number' && Number.isInteger(speed) && speed >= 1 && speed <= 24000 ? speed : undefined
  }
}

function normReq(req: unknown): FlashRequest {
  const r = (req && typeof req === 'object' ? req : {}) as Record<string, unknown>
  if (typeof r['config'] !== 'string') throw new UserError('Не выбрана конфигурация.')
  const speed = r['speedKhz']
  return {
    config: r['config'],
    probeId: typeof r['probeId'] === 'string' ? r['probeId'] : undefined,
    verify: r['verify'] === false ? false : true,
    reset: r['reset'] === false ? false : true,
    speedKhz: typeof speed === 'number' && Number.isInteger(speed) && speed >= 1 && speed <= 24000 ? speed : undefined,
    resetMode: r['resetMode'] === 'under-reset' ? 'under-reset' : 'normal'
  }
}

/** Для pro:action (кнопки «Прошить» / «Отладка» в старом виде и командная палитра): коротко, без подробностей. */
export async function flashAction(configuration: string): Promise<{ message: string }> {
  const r = await flashProject({ config: configuration })
  if (!r.ok) throw new UserError(`${r.error.title}. ${r.error.hint}`)
  return { message: 'Прошивка завершена.' }
}
export async function debugStartAction(configuration: string): Promise<{ message: string }> {
  const r = await debugStart({ config: configuration })
  if (!r.ok) throw new UserError(`${r.error.title}. ${r.error.hint}`)
  return { message: 'Отладка запущена.' }
}

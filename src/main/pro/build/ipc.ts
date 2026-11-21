// IPC сборки Pro-режима: компилятор (поиск, путь, установка), пакет поддержки чипа (CMSIS), сборка, очистка, отчёт о размере, экспорт Makefile/CMake,
// сохранение конфигураций. Долгие операции идут в тех же событиях cli:log / cli:done, что и операции Arduino-режима, поэтому панель «Вывод»,
// «Проблемы» и строка состояния работают без изменений; ход (подпись и процент) — событие pro:progress.
import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { WebContents } from 'electron'
import { mkdir, readFile, stat, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { UserError, guard, needRoot } from '../../files/ipc'
import type { CliResult } from '../../cli/types'
import type { ProjectContext } from '../interfaces'
import { generateLinkerScript } from './linkerGen'
import { EXPORT_FILES, exportFiles } from './exportBuild'
import { BuildBlocked, isBlocked } from './provider'
import type { ArmGccBuildProvider } from './provider'
import { InstallError, TOOLCHAIN_PKG, binFromUserPath, gccName, installToolchain, realDeps, uninstallToolchain } from './toolchain'
import { invalidateToolchain, resolveToolchain, setToolchainPath, toolchainStatus } from './toolchainStore'
import type { BuildReportDto, PreflightResult, ProProgressEvent } from './types'
import { chipRecordForProject, installSupport, supportStatus } from '../support/support'
import { serializeProject } from '../project/serialize'
import { validateProject, formatIssues } from '../project/validate'
import type { ProProject } from '../project/types'

type Op = CliResult<{ opId: number }>
interface OpCtx {
  opId: number
  signal: AbortSignal
  log: (text: string) => void
  progress: (label: string, pct: number | null) => void
}

let seq = 1_000_000
let current: { id: number; abort: AbortController; cancelled: boolean } | null = null

const send = (wc: WebContents, channel: string, payload: unknown): void => { if (!wc.isDestroyed()) wc.send(channel, payload) }

/** Одна долгая операция за раз; события — как у операций arduino-cli (cli:log, cli:done). */
function startOp(wc: WebContents, kind: 'compile' | 'core-install', work: (ctx: OpCtx) => Promise<number>): Op {
  if (current) return { ok: false, error: 'Уже выполняется другая операция. Дождитесь окончания или нажмите «Остановить».' }
  const opId = ++seq
  const op = { id: opId, abort: new AbortController(), cancelled: false }
  current = op
  const ctx: OpCtx = {
    opId, signal: op.abort.signal,
    log: (text) => send(wc, 'cli:log', { opId, stream: 'stdout', text }),
    progress: (label, pct) => send(wc, 'pro:progress', { opId, label, pct } satisfies ProProgressEvent)
  }
  void (async () => {
    let code = -1
    try { code = await work(ctx) } catch (e) {
      if (!op.cancelled) ctx.log(`error: ${e instanceof Error ? e.message : String(e)}\n`)
    }
    if (current === op) current = null
    send(wc, 'cli:done', { opId, kind, code: op.cancelled ? null : code, cancelled: op.cancelled })
  })()
  return { ok: true, data: { opId } }
}

export interface BuildIpcDeps {
  provider: ArmGccBuildProvider
  readProject: (root: string) => Promise<{ found: false } | { found: true; ok: true; project: ProProject } | { found: true; ok: false; error: string }>
}

async function loadProject(deps: BuildIpcDeps, configuration: unknown): Promise<ProjectContext> {
  if (typeof configuration !== 'string') throw new UserError('Не выбрана конфигурация.')
  const root = needRoot()
  const r = await deps.readProject(root)
  if (!r.found) throw new UserError('В папке нет файла avride.project.json.')
  if (!r.ok) throw new UserError(r.error)
  if (!r.project.configurations[configuration]) throw new UserError(`В проекте нет конфигурации «${configuration}».`)
  return { root, project: r.project, configuration }
}

const GENERATED = '# Создан AVR IDE'
const isOurs = async (p: string): Promise<boolean | null> => {
  const t = await readFile(p, 'utf8').catch(() => null)
  return t === null ? null : t.startsWith(GENERATED)
}

export function registerBuildIpc(deps: BuildIpcDeps): void {
  const { provider } = deps

  // ----- компилятор -----
  ipcMain.handle('pro:toolchain', () => guard(() => toolchainStatus()))

  ipcMain.handle('pro:toolchain-pick', (e) => guard(async () => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const r = await dialog.showOpenDialog(win!, { title: 'Папка bin компилятора (arm-none-eabi-gcc) или корень пакета', properties: ['openDirectory'] })
    if (r.canceled || !r.filePaths[0]) return await toolchainStatus()
    const bin = await binFromUserPath(r.filePaths[0], realDeps())
    if (!bin) throw new UserError('В этой папке нет arm-none-eabi-gcc. Выберите папку bin компилятора или корень его пакета.')
    const st = await setToolchainPath(join(bin, gccName(process.platform)))
    if (!st.found || st.source !== 'setting') {
      await setToolchainPath(null)
      throw new UserError('Компилятор в этой папке не запускается (arm-none-eabi-gcc --version завершился ошибкой).')
    }
    return st
  }))

  ipcMain.handle('pro:toolchain-clear', () => guard(() => setToolchainPath(null)))

  ipcMain.handle('pro:toolchain-install', (e) => startOp(e.sender, 'core-install', async (ctx) => {
    try {
      const test = process.env['AVRIDE_E2E'] === '1' ? process.env['AVRIDE_PRO_TOOLCHAIN_URL'] : undefined
      await installToolchain({ log: ctx.log, progress: ctx.progress, signal: ctx.signal }, test ? { ...TOOLCHAIN_PKG, url: test, size: 4096, unpacked: 1 } : TOOLCHAIN_PKG)
      invalidateToolchain()
      return 0
    } catch (err) {
      invalidateToolchain()
      if (current?.cancelled) return 1
      ctx.log(`error: ${err instanceof InstallError || err instanceof Error ? err.message : String(err)}\n`)
      return 1
    }
  }))

  ipcMain.handle('pro:toolchain-uninstall', () => guard(async () => { await uninstallToolchain(); invalidateToolchain(); return toolchainStatus() }))

  // ----- проверка перед сборкой -----
  ipcMain.handle('pro:preflight', (_e, configuration: unknown) => guard(async (): Promise<PreflightResult> => {
    const ctx = await loadProject(deps, configuration)
    try { await provider.preflight(ctx); return { ok: true } } catch (e) {
      if (isBlocked(e)) return { ok: false, code: e.code, message: e.message }
      throw e
    }
  }))

  // ----- пакет поддержки чипа -----
  ipcMain.handle('pro:support', () => guard(async () => {
    const root = needRoot()
    const r = await deps.readProject(root)
    if (!r.found || !r.ok) throw new UserError('Нет корректного avride.project.json.')
    return supportStatus(root, r.project)
  }))

  ipcMain.handle('pro:support-install', (e) => {
    return startOp(e.sender, 'core-install', async (ctx) => {
      const root = needRoot()
      const r = await deps.readProject(root)
      if (!r.found || !r.ok) throw new UserError('Нет корректного avride.project.json.')
      await installSupport(root, r.project, { log: ctx.log, progress: ctx.progress, signal: ctx.signal })
      return 0
    })
  })

  // ----- сборка -----
  ipcMain.handle('pro:build', (e, configuration: unknown) => {
    return startOp(e.sender, 'compile', async (ctx) => {
      const pc = await loadProject(deps, configuration)
      ctx.progress('Подготовка', null)
      try {
        const res = await provider.build(pc, {
          signal: ctx.signal,
          onLog: (l) => {
            ctx.log(l + '\n')
            const m = /^\[(\d+)\/(\d+)\]/.exec(l)
            if (m) ctx.progress(`Компиляция ${m[1]} из ${m[2]}`, Math.round((Number(m[1]) / Number(m[2])) * 90))
            else if (/^\[линковка\]/.test(l)) ctx.progress('Компоновка', 92)
          }
        })
        return res.ok ? 0 : res.cancelled ? 130 : 1
      } catch (err) {
        if (isBlocked(err)) { ctx.log(`error: ${err.message}\n`); return 1 }
        throw err
      }
    })
  })

  ipcMain.handle('pro:clean', (_e, configuration: unknown) => guard(async () => {
    const pc = await loadProject(deps, configuration)
    await provider.clean(pc)
    return { message: `Папка build/${pc.configuration} удалена.` }
  }))

  ipcMain.handle('pro:report', (_e, configuration: unknown) => guard(async (): Promise<BuildReportDto> => provider.report(await loadProject(deps, configuration))))

  ipcMain.handle('pro:build-cancel', () => {
    if (!current) return false
    current.cancelled = true
    current.abort.abort()
    return true
  })

  // ----- скрипт компоновки -----
  ipcMain.handle('pro:generate-linker', (_e, force: unknown) => guard(async () => {
    const root = needRoot()
    const r = await deps.readProject(root)
    if (!r.found || !r.ok) throw new UserError('Нет корректного avride.project.json.')
    const p = r.project
    const abs = join(root, ...p.linkerScript.split('/'))
    const had = !!(await stat(abs).catch(() => null))
    if (had && force !== true) throw new UserError(`Скрипт ${p.linkerScript} уже есть; чтобы заменить его, подтвердите.`)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, generateLinkerScript(p.target.memory, { chip: p.target.chip }), 'utf8')
    return { path: p.linkerScript, replaced: had }
  }))

  // ----- экспорт сборки -----
  ipcMain.handle('pro:export-build', (_e, overwrite: unknown) => guard(async () => {
    const root = needRoot()
    const r = await deps.readProject(root)
    if (!r.found || !r.ok) throw new UserError('Нет корректного avride.project.json.')
    const sources = await provider.walkSources(root, r.project)
    const files = exportFiles({ project: r.project, sources, deviceDefine: chipRecordForProject(r.project)?.files.define })
    const foreign: string[] = []
    for (const name of EXPORT_FILES) { const ours = await isOurs(join(root, name)); if (ours === false) foreign.push(name) }
    if (foreign.length && overwrite !== true) throw new UserError(`В папке проекта уже есть ${foreign.join(' и ')}, созданн${foreign.length > 1 ? 'ые' : 'ый'} не AVR IDE. Подтвердите замену.`)
    for (const name of EXPORT_FILES) await writeFile(join(root, name), files[name], 'utf8')
    return { files: [...EXPORT_FILES] }
  }))

  // ----- конфигурации и параметры проекта -----
  ipcMain.handle('pro:save-project', (_e, raw: unknown) => guard(async () => {
    const root = needRoot()
    const v = validateProject(raw)
    if (!v.ok) throw new UserError(formatIssues(v.errors))
    await writeFile(join(root, 'avride.project.json'), serializeProject(v.project), 'utf8')
    return { warnings: v.warnings.length }
  }))
}

export { BuildBlocked, resolveToolchain }

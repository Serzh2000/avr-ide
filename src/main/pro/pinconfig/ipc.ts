// IPC конфигуратора выводов и тактирования Pro-режима: чтение и запись avride.pins.json, план и запись сгенерированного кода.
// Логика — в src/shared/pro/pinconfig (чистые функции); здесь только диск и проверка путей.
import { ipcMain } from 'electron'
import { mkdir, readFile, readdir, stat, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { UserError, guard, needRoot } from '../../files/ipc'
import { chipForTarget } from '../../../shared/pro/pinconfig/model'
import { parsePinsText, serializePins, formatSchemaIssues, defaultPinsConfig } from '../../../shared/pro/pinconfig/schema'
import { planGeneration } from '../../../shared/pro/pinconfig/gen/index'
import type { GenNote, GenOptions } from '../../../shared/pro/pinconfig/gen/index'
import { PINS_FILE } from '../../../shared/pro/pinconfig/types'
import type { PinIssue, PinsConfig } from '../../../shared/pro/pinconfig/types'
import type { ProProject } from '../project/types'
import type { ProReadResult } from '../ipc'

export type PinsFileState =
  | { exists: false }
  | { exists: true; ok: true; config: PinsConfig; warnings: string[]; migrated: boolean }
  | { exists: true; ok: false; error: string }

export interface PinsState {
  /** Идентификатор чипа в базе; null — чип проекта в базе не найден */
  chipId: string | null
  chipName: string
  file: PinsFileState
  /** В проекте есть заголовки HAL (stm32…_hal.h) */
  halAvailable: boolean
  srcDir: string
  incDir: string
  /** Папки генерации не перечислены в sources/includes проекта — сборка их не увидит */
  dirWarnings: string[]
  /** Путь основного файла (src/main.c) и его текст на диске; null — файла нет */
  main: { path: string; content: string } | null
}

export interface PlanFileDto { path: string; content: string; old: string | null; status: 'new' | 'changed' | 'same'; foreign: boolean; keptBlocks: string[]; orphanBlocks: string[] }
export interface PinsPlanDto { ok: boolean; blocked: string | null; files: PlanFileDto[]; notes: GenNote[]; issues: PinIssue[]; dirWarnings: string[] }

const exists = async (p: string): Promise<boolean> => !!(await stat(p).catch(() => null))
const readOpt = async (p: string): Promise<string | undefined> => readFile(p, 'utf8').catch(() => undefined)

/** Папка исходников и заголовков для генерации: первая «обычная» папка из sources/includes (не drivers). */
export function dirsOf(project: ProProject): { src: string; inc: string; warnings: string[] } {
  const isDir = (s: string): boolean => !/\.[A-Za-z0-9]+$/.test(s) && !s.startsWith('drivers')
  const src = project.sources.find(isDir)?.replace(/\/+$/, '') ?? 'src'
  const inc = project.includes.find(isDir)?.replace(/\/+$/, '') ?? 'include'
  const warnings: string[] = []
  if (!project.sources.some((s) => s.replace(/\/+$/, '') === src)) warnings.push(`Папки «${src}» нет в sources проекта: добавьте её, иначе сгенерированные .c не соберутся.`)
  if (!project.includes.some((s) => s.replace(/\/+$/, '') === inc)) warnings.push(`Папки «${inc}» нет в includes проекта: добавьте её, иначе заголовки не найдутся.`)
  return { src, inc, warnings }
}

/** Есть ли в проекте заголовки HAL: stm32f1xx_hal.h и подобные (ищем в drivers/ и includes, глубина до 6). */
export async function detectHal(root: string, project: ProProject): Promise<boolean> {
  const re = /^stm32[a-z]\dxx_hal\.h$/i
  const seen = new Set<string>()
  const walk = async (rel: string, depth: number): Promise<boolean> => {
    if (depth > 6 || seen.has(rel)) return false
    seen.add(rel)
    const abs = join(root, ...rel.split('/'))
    let names: string[]
    try { names = await readdir(abs) } catch { return false }
    for (const n of names) {
      if (re.test(n)) return true
      const s = await stat(join(abs, n)).catch(() => null)
      if (s?.isDirectory() && !n.startsWith('.') && n !== 'build') { if (await walk(rel + '/' + n, depth + 1)) return true }
    }
    return false
  }
  for (const d of ['drivers', ...project.includes.map((i) => i.replace(/\/+$/, ''))]) if (await walk(d, 0)) return true
  return false
}

export interface PinsIpcDeps { readProject: (root: string) => Promise<ProReadResult> }

export function registerPinsIpc(deps: PinsIpcDeps): void {
  const loadProject = async (): Promise<{ root: string; project: ProProject }> => {
    const root = needRoot()
    const r = await deps.readProject(root)
    if (!r.found) throw new UserError('В папке нет файла avride.project.json: откройте проект профессионального режима.')
    if (!r.ok) throw new UserError(r.error)
    return { root, project: r.project }
  }

  const readState = async (root: string, project: ProProject): Promise<PinsState> => {
    const chip = chipForTarget(project.target.chip, project.startupFile)
    const dirs = dirsOf(project)
    let file: PinsFileState = { exists: false }
    const text = await readOpt(join(root, PINS_FILE))
    if (text !== undefined) {
      const r = parsePinsText(text)
      if (r.ok && chip && r.config.chip !== chip.id) file = { exists: true, ok: false, error: `${PINS_FILE}: файл создан для ${r.config.chip}, а проект — для ${chip.id}. Откройте файл и поправьте чип или создайте конфигурацию заново.` }
      else file = r.ok ? { exists: true, ok: true, config: r.config, warnings: r.warnings.map((w) => w.message), migrated: r.migratedFrom !== null } : { exists: true, ok: false, error: `${PINS_FILE}: ${formatSchemaIssues(r.errors)}` }
    }
    const mainRel = 'src/main.c'
    const mainText = await readOpt(join(root, ...mainRel.split('/')))
    return {
      chipId: chip?.id ?? null, chipName: chip?.name ?? project.target.chip, file,
      halAvailable: await detectHal(root, project), srcDir: dirs.src, incDir: dirs.inc, dirWarnings: dirs.warnings,
      main: mainText === undefined ? null : { path: mainRel, content: mainText }
    }
  }

  const checkCfg = (raw: unknown, project: ProProject): PinsConfig => {
    if (typeof raw !== 'object' || raw === null) throw new UserError('Конфигурация пуста.')
    const r = parsePinsText(JSON.stringify(raw))
    if (!r.ok) throw new UserError(`Конфигурация не принята: ${formatSchemaIssues(r.errors)}`)
    const chip = chipForTarget(project.target.chip, project.startupFile)
    if (chip && r.config.chip !== chip.id) throw new UserError(`Конфигурация создана для ${r.config.chip}, а проект — для ${chip.id}.`)
    return r.config
  }

  const planFor = async (root: string, project: ProProject, cfg: PinsConfig): Promise<PinsPlanDto> => {
    const dirs = dirsOf(project)
    const opts: GenOptions = { srcDir: dirs.src, incDir: dirs.inc }
    const hal = await detectHal(root, project)
    // прежние файлы по тем путям, которые вообще могут быть созданы
    const names = ['board', 'clock', 'gpio', 'uart']
    const existing: Record<string, string | undefined> = {}
    for (const n of names) for (const p of [`${dirs.inc}/${n}.h`, `${dirs.src}/${n}.c`]) existing[p] = await readOpt(join(root, ...p.split('/')))
    const plan = planGeneration(cfg, existing, opts, hal)
    return {
      ok: plan.ok, blocked: plan.blocked, notes: plan.notes, issues: plan.issues, dirWarnings: dirs.warnings,
      files: plan.files.map((f) => ({ path: f.path, content: f.content, old: existing[f.path] ?? null, status: f.status, foreign: f.foreign, keptBlocks: f.keptBlocks, orphanBlocks: f.orphanBlocks }))
    }
  }

  ipcMain.handle('pins:read', () => guard(async () => { const { root, project } = await loadProject(); return readState(root, project) }))

  /** Пустая конфигурация для чипа проекта (в файл не пишется). */
  ipcMain.handle('pins:default', (_e, pkg: unknown) => guard(async () => {
    const { project } = await loadProject()
    const chip = chipForTarget(project.target.chip, project.startupFile)
    if (!chip) throw new UserError(`Чипа ${project.target.chip} нет в базе чипов — конфигуратор недоступен.`)
    return defaultPinsConfig(chip.id, typeof pkg === 'string' ? pkg : undefined)
  }))

  ipcMain.handle('pins:save', (_e, raw: unknown) => guard(async () => {
    const { root, project } = await loadProject()
    const cfg = checkCfg(raw, project)
    await writeFile(join(root, PINS_FILE), serializePins(cfg), 'utf8')
    return { path: PINS_FILE }
  }))

  ipcMain.handle('pins:plan', (_e, raw: unknown) => guard(async () => {
    const { root, project } = await loadProject()
    return planFor(root, project, checkCfg(raw, project))
  }))

  /** Записывает avride.pins.json и сгенерированные файлы. main.c не трогает — его правит интерфейс по подтверждению. */
  ipcMain.handle('pins:generate', (_e, raw: unknown) => guard(async () => {
    const { root, project } = await loadProject()
    const cfg = checkCfg(raw, project)
    const plan = await planFor(root, project, cfg)
    if (!plan.ok) throw new UserError(plan.blocked ?? 'Генерация невозможна.')
    await writeFile(join(root, PINS_FILE), serializePins(cfg), 'utf8')
    const written: string[] = []
    for (const f of plan.files) {
      if (f.status === 'same') continue
      const abs = join(root, ...f.path.split('/'))
      await mkdir(dirname(abs), { recursive: true })
      await writeFile(abs, f.content, 'utf8')
      written.push(f.path)
    }
    return { written, unchanged: plan.files.filter((f) => f.status === 'same').map((f) => f.path), notes: plan.notes }
  }))
  void exists
}

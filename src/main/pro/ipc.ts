// IPC Pro-режима: чтение/создание проекта avride.project.json, сводка провайдеров, запуск действий (сборка, прошивка, отладка).
// Пока реальных провайдеров нет, действия возвращают понятную ошибку «ещё не реализовано» (см. stubs.ts).
import { app, ipcMain } from 'electron'
import { mkdir, readFile, stat, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { validateSketchName } from '../files/naming'
import { UserError, guard, needRoot, openRoot, parentAllowed } from '../files/ipc'
import type { CliResult } from '../cli/types'
import type { ProjectContext, ProviderStatus } from './interfaces'
import { presetByChip } from './project/presets'
import { MAIN_FILE, scaffoldFiles, templateSupported } from './project/scaffold'
import type { ProTemplate } from './project/scaffold'
import { parseProjectText } from './project/serialize'
import { PROJECT_FILE } from './project/types'
import type { Issue, ProProject } from './project/types'
import { formatIssues } from './project/validate'
import { proRegistry } from './registry'
import { isNotImplemented } from './stubs'
import { chipDatabase } from '../../shared/pro/chipdb'
import { registerBuildIpc } from './build/ipc'
import { ArmGccBuildProvider, isBlocked } from './build/provider'
import { resolveToolchain } from './build/toolchainStore'
import { setProDataDir } from './paths'
import { installSupport, supportStatus } from './support/support'
import { debugStartAction, flashAction, registerHardwareIpc } from './hardware'
import { registerPinsIpc } from './pinconfig/ipc'
import { registerSymbolsIpc } from './symbols/service'

export type ProReadResult =
  | { found: false }
  | { found: true; ok: true; project: ProProject; warnings: Issue[]; migratedFrom: number | null }
  | { found: true; ok: false; error: string; issues: Issue[] }

export type ProActionKind = 'build' | 'clean' | 'flash' | 'debug'
export interface ProActionResult { message: string }

const ok = <T>(data: T): CliResult<T> => ({ ok: true, data })
const exists = async (p: string): Promise<boolean> => !!(await stat(p).catch(() => null))

async function readProject(root: string): Promise<ProReadResult> {
  const file = join(root, PROJECT_FILE)
  const s = await stat(file).catch(() => null)
  if (!s?.isFile()) return { found: false }
  if (s.size > 1024 * 1024) return { found: true, ok: false, error: 'Файл проекта слишком большой.', issues: [] }
  const r = parseProjectText(await readFile(file, 'utf8'))
  return r.ok
    ? { found: true, ok: true, project: r.project, warnings: r.warnings, migratedFrom: r.migratedFrom }
    : { found: true, ok: false, error: `${PROJECT_FILE}: ${formatIssues(r.errors)}`, issues: r.errors }
}

async function runAction(kind: ProActionKind, configuration: string): Promise<ProActionResult> {
  const root = needRoot()
  const r = await readProject(root)
  if (!r.found) throw new UserError(`В папке нет файла ${PROJECT_FILE}.`)
  if (!r.ok) throw new UserError(r.error)
  if (!r.project.configurations[configuration]) throw new UserError(`В проекте нет конфигурации «${configuration}».`)
  const ctx: ProjectContext = { root, project: r.project, configuration }
  try {
    switch (kind) {
      case 'build': {
        const res = await proRegistry.get('build').build(ctx)
        return { message: res.ok ? 'Сборка завершена.' : 'Сборка завершилась с ошибками.' }
      }
      case 'clean':
        await proRegistry.get('build').clean(ctx)
        return { message: 'Результаты сборки удалены.' }
      case 'flash': return flashAction(configuration)
      case 'debug': return debugStartAction(configuration)
    }
  } catch (e) {
    if (isNotImplemented(e) || isBlocked(e)) throw new UserError(e.message)
    throw e
  }
}

export function registerProIpc(): void {
  // Этап D: база чипов; этап B: сборка arm-none-eabi-gcc встроенным планировщиком
  setProDataDir(app.getPath('userData'))
  proRegistry.register('chips', chipDatabase)
  const buildProvider = new ArmGccBuildProvider(() => resolveToolchain())
  proRegistry.register('build', buildProvider)
  registerBuildIpc({ provider: buildProvider, readProject })
  registerHardwareIpc()
  registerPinsIpc({ readProject })
  registerSymbolsIpc({ readProject })
  ipcMain.handle('pro:providers', (): CliResult<ProviderStatus> => ok(proRegistry.status()))

  /** Проект открытой папки: найден ли avride.project.json и корректен ли он. */
  ipcMain.handle('pro:read-project', () => guard(async () => readProject(needRoot())))

  /** Мастер создаёт проект и возвращает сведения об открытой папке. */
  ipcMain.handle('pro:create', (_e, name: unknown, parent: unknown, chip: unknown, template: unknown) =>
    guard(async () => {
      if (typeof name !== 'string') throw new UserError('Введите имя проекта.')
      const bad = validateSketchName(name)
      if (bad) throw new UserError(bad)
      const preset = typeof chip === 'string' ? presetByChip(chip) : undefined
      if (!preset) throw new UserError('Выберите кристалл или плату из списка.')
      if (template !== 'empty' && template !== 'blink' && template !== 'swo') throw new UserError('Недопустимый шаблон.')
      if (!templateSupported(template, preset)) throw new UserError('Шаблон «printf через SWO» не подходит для этого кристалла: у ядра Cortex-M0/M0+ нет блока ITM.')
      const base = parentAllowed(parent)
      const dir = join(base, name)
      await mkdir(base, { recursive: true })
      if (await exists(dir)) throw new UserError(`Папка «${name}» уже существует в «${base}». Выберите другое имя.`)
      await mkdir(dir)
      const files = scaffoldFiles(name, preset, template as ProTemplate)
      for (const [rel, text] of Object.entries(files)) {
        const abs = join(dir, ...rel.split('/'))
        await mkdir(dirname(abs), { recursive: true })
        await writeFile(abs, text, 'utf8')
      }
      // Файлы CMSIS: если пакет поддержки уже в кэше, кладём в проект сразу (без сети); иначе их скачает сборка после подтверждения
      let needsSupport = false
      try {
        const proj = await readProject(dir)
        if (proj.found && proj.ok) {
          const st = await supportStatus(dir, proj.project)
          if (st.known && st.cached) await installSupport(dir, proj.project, { log: () => undefined, progress: () => undefined, signal: new AbortController().signal })
          needsSupport = st.known && !st.installed && !st.cached
        }
      } catch { needsSupport = true }
      return { project: await openRoot(dir), mainFile: join(dir, ...MAIN_FILE.split('/')), needsSupport }
    })
  )

  ipcMain.handle('pro:action', (_e, kind: unknown, configuration: unknown) =>
    guard(async () => {
      if (kind !== 'build' && kind !== 'clean' && kind !== 'flash' && kind !== 'debug') throw new UserError('Неизвестное действие.')
      if (typeof configuration !== 'string') throw new UserError('Не выбрана конфигурация.')
      return runAction(kind, configuration)
    })
  )
}

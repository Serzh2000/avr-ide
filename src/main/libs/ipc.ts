import { app, ipcMain } from 'electron'
import { spawn } from 'child_process'
import { join } from 'path'
import { findCli } from '../cli/binary'
import type { CliResult } from '../cli/types'
import { describeLibrary, listInstalledLibraries, resetLibCaches, resolveLibraries } from './resolve'
import type { LibsForSketchOptions, ProjectLibrary } from './types'
import { guard, inside, needRoot, UserError } from '../files/ipc'
import { lstat } from 'node:fs/promises'
import { basename } from 'node:path'
import { isFqbn, isLibName } from '../cli/validate'
import { startAsyncOp } from '../cli/ipc'
import { dependencyArgument } from './dependencies'
import { planProjectDependencies } from './project-dependencies'
import { bundledArchive } from './bundled'

// Канал: libs:for-sketch (code, options) → ProjectLibrary[]
// Безопасность: из renderer приходят только текст скетча и FQBN; все пути определяются по тексту #include
// и по установленным библиотекам на диске. Размеры ограничены в resolve.ts (LIMITS).

const MAX_CODE = 2_000_000
const FQBN_RE = /^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.=,-]*)?$/

/** Каталоги, которые arduino-cli считает пользовательскими (быстрый `config get`, а не медленный `lib list`). */
let cliDirs: { user?: string; data?: string; at: number } | null = null
let cliDirsPending: Promise<void> | null = null

function cliGet(bin: string, key: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    let out = ''
    let done = false
    const finish = (v: string | undefined): void => {
      if (done) return
      done = true
      resolve(v)
    }
    try {
      const c = spawn(bin, ['config', 'get', key], { windowsHide: true, shell: false })
      const timer = setTimeout(() => {
        c.kill()
        finish(undefined)
      }, 8000)
      c.stdout.setEncoding('utf8').on('data', (d: string) => (out += d))
      c.on('error', () => finish(undefined))
      c.on('close', (code) => {
        clearTimeout(timer)
        const v = out.trim().split(/\r?\n/)[0]?.trim()
        finish(code === 0 && v ? v : undefined)
      })
    } catch {
      finish(undefined)
    }
  })
}

/** Запускается в фоне при первом запросе; результат учитывается в следующих. */
function refreshCliDirs(): void {
  if (cliDirsPending) return
  const cli = findCli()
  if (cli?.path === cliDirBin && cliDirs && Date.now() - cliDirs.at < 5 * 60_000) return
  cliDirBin = cli?.path
  if (!cli) {
    cliDirs = { at: Date.now() }
    return
  }
  cliDirsPending = (async () => {
    const [user, data] = await Promise.all([cliGet(cli.path, 'directories.user'), cliGet(cli.path, 'directories.data')])
    cliDirs = { user, data, at: Date.now() }
  })().finally(() => {
    cliDirsPending = null
  })
}

function documentsDir(): string | undefined {
  try {
    return app.getPath('documents')
  } catch {
    return undefined
  }
}

let cliDirBin: string | undefined

async function projectFor(root: unknown, fqbn: unknown): Promise<{ root: string; fqbn: string; user: string; data: string }> {
  if (root !== needRoot() || typeof root !== 'string' || !isFqbn(fqbn)) throw new UserError('Проект или плата изменились.')
  const file = await lstat(await inside(join(root, `${basename(root)}.ino`))).catch(() => null)
  if (!file?.isFile()) throw new UserError('У проекта нет основного файла Arduino .ino.')
  refreshCliDirs()
  await cliDirsPending
  if (!cliDirs?.user || !cliDirs.data) throw new UserError('Не удалось определить каталоги Arduino CLI.')
  if (root !== needRoot()) throw new UserError('Открыт другой проект.')
  return { root, fqbn, user: cliDirs.user, data: cliDirs.data }
}

export function registerLibsIpc(): void {
  ipcMain.handle('libs:dependency-plan', (_e, root: unknown, fqbn: unknown) => guard(async () => {
    const p = await projectFor(root, fqbn)
    return planProjectDependencies(p.root, p.fqbn, p.user, p.data)
  }))
  ipcMain.handle('libs:restore-dependencies', (e, root: unknown, fqbn: unknown, refresh: unknown, choice: unknown) => {
    if (typeof root !== 'string' || !isFqbn(fqbn) || typeof refresh !== 'boolean' ||
        (choice !== null && !isLibName(choice))) return { ok: false, error: 'Недопустимые параметры установки библиотек.' }
    return startAsyncOp(e.sender, 'lib-install', async ({ runCli, signal, log }) => {
      const p = await projectFor(root, fqbn)
      let plan = await planProjectDependencies(p.root, p.fqbn, p.user, p.data)
      if (signal.aborted || root !== needRoot()) return null
      if (plan.profile) return 0
      const wanted = [...plan.install]
      if (choice !== null) {
        if (!plan.choose.some((row) => row.libraries.some((dep) => dependencyArgument(dep) === choice))) {
          log('stderr', 'Предложение устарело. Перепроверьте зависимости проекта.\n')
          return 1
        }
        const [name, version] = choice.split('@')
        wanted.push({ name, version })
      }
      // Встроенные библиотеки ставятся из установщика без сети; остальное — из реестра Arduino.
      const remote: string[] = []
      for (const dep of wanted) {
        const zip = refresh ? null : await bundledArchive(dep.name, dep.version)
        if (!zip) { remote.push(dependencyArgument(dep)); continue }
        if (signal.aborted || root !== needRoot()) return null
        const code = await runCli(['lib', 'install', '--zip-path', zip, '--no-color'], { ARDUINO_LIBRARY_ENABLE_UNSAFE_INSTALL: 'true' })
        if (code !== 0) { resetLibCaches(); return code ?? 1 }
      }
      let rest = remote
      // Индекс обновляем только когда его нет или пользователь попросил: иначе установка из уже скачанного индекса не требует сети на этом шаге.
      if (refresh || plan.needsIndex) {
        const code = await runCli(['lib', 'update-index', '--no-color'])
        if (code !== 0 || refresh || signal.aborted || root !== needRoot()) { resetLibCaches(); return code }
        plan = await planProjectDependencies(p.root, p.fqbn, p.user, p.data)
        if (signal.aborted || root !== needRoot()) return null
        if (plan.needsIndex) { log('stderr', 'Не найден индекс библиотек Arduino.\n'); return 1 }
        rest = [...new Set([...plan.install.map(dependencyArgument), ...remote])]
      }
      if (rest.length) {
        const code = await runCli(['lib', 'install', '--no-overwrite', '--no-color', ...rest])
        resetLibCaches()
        return code
      }
      resetLibCaches()
      return 0
    })
  })
  const libOpts = (options?: LibsForSketchOptions): Parameters<typeof listInstalledLibraries>[0] => {
    const fqbn = options && typeof options.fqbn === 'string' && options.fqbn.length < 200 && FQBN_RE.test(options.fqbn) ? options.fqbn : null
    refreshCliDirs()
    return {
      fqbn,
      documentsDir: documentsDir(),
      extraUserDirs: cliDirs?.user ? [join(cliDirs.user, 'libraries')] : [],
      extraDataDirs: cliDirs?.data ? [cliDirs.data] : []
    }
  }
  /** Все установленные библиотеки — для справочника, без привязки к #include скетча. */
  ipcMain.handle('libs:installed', (_e, options?: LibsForSketchOptions) => guard(async () => listInstalledLibraries(libOpts(options))))
  /** Описание одной установленной библиотеки (путь берётся только из каталога установленных). */
  ipcMain.handle('libs:describe', (_e, dir: unknown, options?: LibsForSketchOptions) => guard(async () => {
    if (typeof dir !== 'string' || dir.length > 1000) return null
    return describeLibrary(dir, libOpts(options))
  }))
  ipcMain.handle('libs:for-sketch', async (_e, code: unknown, options?: LibsForSketchOptions): Promise<CliResult<ProjectLibrary[]>> => {
    try {
      if (typeof code !== 'string') return { ok: true, data: [] }
      const text = code.length > MAX_CODE ? code.slice(0, MAX_CODE) : code
      const fqbn = options && typeof options.fqbn === 'string' && options.fqbn.length < 200 && FQBN_RE.test(options.fqbn) ? options.fqbn : null
      refreshCliDirs()
      const data = await resolveLibraries(text, {
        fqbn,
        documentsDir: documentsDir(),
        extraUserDirs: cliDirs?.user ? [join(cliDirs.user, 'libraries')] : [],
        extraDataDirs: cliDirs?.data ? [cliDirs.data] : []
      })
      return { ok: true, data }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })
}

import { app, ipcMain } from 'electron'
import { spawn } from 'child_process'
import { join } from 'path'
import { findCli } from '../cli/binary'
import type { CliResult } from '../cli/types'
import { resolveLibraries } from './resolve'
import type { LibsForSketchOptions, ProjectLibrary } from './types'

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
  if (cliDirsPending || (cliDirs && Date.now() - cliDirs.at < 5 * 60_000)) return
  const cli = findCli()
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

export function registerLibsIpc(): void {
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

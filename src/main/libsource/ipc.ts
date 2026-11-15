// IPC источника библиотек «GitHub». Из renderer принимаются только owner / repo / тип и имя ref / имена библиотек —
// URL строятся здесь же из проверенных частей.
import { ipcMain, shell } from 'electron'
import { isLibName } from '../cli/validate'
import { capture, startAsyncOp } from '../cli/ipc'
import { findCli } from '../cli/binary'
import type { CliResult } from '../cli/types'
import { catalogInfo, initCatalog, refreshCatalog, search, setCustom } from './catalog'
import { clearRefsCache, downloadLibraryZip, listRefs } from './install'
import { dependStatus } from './props'
import { buildRepoPageUrl, isOwner, isRef, isRefKind, isRepoName, normalizeRepoUrl } from './repo'
import { addCustom, getConsent, getCustom, getToken, hasToken, libsourceDir, removeCustom, setConsent, setToken } from './settings'
import type { CatalogStatus, InstallResult, RefList, SearchResult } from './types'

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

let refreshingNow = false

function status(): CatalogStatus {
  const i = catalogInfo()
  return { ...i, refreshing: refreshingNow || i.refreshing, consent: getConsent(), hasToken: hasToken() }
}

/** Имена установленных библиотек (для проверки зависимостей). */
async function installedNames(): Promise<string[]> {
  const f = findCli()
  if (!f) return []
  const r = await capture(f.path, ['lib', 'list', '--format', 'json'])
  try {
    const j = JSON.parse(r.stdout) as { installed_libraries?: { library?: { name?: string } }[] }
    return (j.installed_libraries ?? []).map((e) => e.library?.name).filter((n): n is string => typeof n === 'string')
  } catch {
    return []
  }
}

export function registerLibsourceIpc(): void {
  initCatalog(libsourceDir())
  setCustom(getCustom())

  ipcMain.handle('libsource:status', (): CliResult<CatalogStatus> => ({ ok: true, data: status() }))

  ipcMain.handle('libsource:refresh', async (e): Promise<CliResult<{ status: CatalogStatus; errors: string[] }>> => {
    if (refreshingNow) return fail('Каталог уже обновляется.')
    refreshingNow = true
    try {
      const errors = await refreshCatalog({
        onProgress: (text) => { if (!e.sender.isDestroyed()) e.sender.send('libsource:progress', { text }) }
      })
      return { ok: true, data: { status: status(), errors } }
    } finally {
      refreshingNow = false
    }
  })

  ipcMain.handle('libsource:search', (_e, q: unknown, offset: unknown, limit: unknown): CliResult<SearchResult> => {
    const text = typeof q === 'string' ? q : ''
    // eslint-disable-next-line no-control-regex
    if (text.length > 100 || /[\u0000-\u001f]/.test(text)) return fail('Недопустимый поисковый запрос.')
    return {
      ok: true,
      data: search(text, typeof offset === 'number' ? offset : 0, typeof limit === 'number' ? limit : 100)
    }
  })

  ipcMain.handle('libsource:refs', async (_e, owner: unknown, repo: unknown, force: unknown): Promise<CliResult<RefList>> => {
    if (!isOwner(owner) || !isRepoName(repo)) return fail('Недопустимый репозиторий.')
    if (force === true) clearRefsCache()
    try {
      return { ok: true, data: await listRefs(owner, repo, getToken()) }
    } catch (err) {
      return fail((err as Error).message)
    }
  })

  ipcMain.handle('libsource:set-consent', (_e, v: unknown): boolean => {
    setConsent(v === true)
    return getConsent()
  })

  ipcMain.handle('libsource:set-token', (_e, t: unknown): CliResult<boolean> => {
    if (t === null || t === '') { setToken(null); return { ok: true, data: false } }
    // Токены GitHub: ghp_…, github_pat_…, gho_… и классические 40 hex
    if (typeof t !== 'string' || !/^[A-Za-z0-9_]{20,255}$/.test(t.trim())) return fail('Токен GitHub выглядит некорректно (латиница, цифры и «_», от 20 знаков).')
    setToken(t.trim())
    clearRefsCache()
    return { ok: true, data: true }
  })

  ipcMain.handle('libsource:custom-add', (_e, input: unknown): CliResult<{ id: string }> => {
    const id = normalizeRepoUrl(input)
    if (!id) return fail('Не удалось распознать адрес. Введите ссылку вида https://github.com/владелец/репозиторий или «владелец/репозиторий».')
    addCustom(id)
    setCustom(getCustom())
    return { ok: true, data: { id: `${id.owner}/${id.repo}` } }
  })

  ipcMain.handle('libsource:custom-remove', (_e, owner: unknown, repo: unknown): boolean => {
    if (!isOwner(owner) || !isRepoName(repo)) return false
    removeCustom({ owner, repo, key: `${owner}/${repo}`.toLowerCase() })
    setCustom(getCustom())
    return true
  })

  ipcMain.handle('libsource:open', async (_e, owner: unknown, repo: unknown): Promise<boolean> => {
    if (!isOwner(owner) || !isRepoName(repo)) return false
    await shell.openExternal(buildRepoPageUrl(owner, repo))
    return true
  })

  // Установка: скачивание архива → проверка → arduino-cli lib install --zip-path
  ipcMain.handle('libsource:install', (e, owner: unknown, repo: unknown, kind: unknown, ref: unknown) => {
    if (!isOwner(owner) || !isRepoName(repo)) return fail('Недопустимый репозиторий.')
    if (!isRefKind(kind)) return fail('Недопустимый тип версии.')
    if (kind !== 'default' && !isRef(ref)) return fail('Недопустимое имя тега или ветки.')
    if (!getConsent()) return fail('Нужно согласие на установку библиотек напрямую с GitHub.')
    const refName = kind === 'default' ? undefined : (ref as string)
    return startAsyncOp(e.sender, 'lib-install', async (ctx) => {
      const what = kind === 'default' ? 'ветка по умолчанию' : kind === 'tag' ? `тег ${refName}` : `ветка ${refName}`
      ctx.log('info', `Скачивание ${owner}/${repo} (${what}) с GitHub…\n`)
      let lastPct = -1
      const dl = await downloadLibraryZip(owner, repo, kind, refName, {
        signal: ctx.signal,
        onProgress: (got, total) => {
          if (!total) return
          const pct = Math.floor((got / total) * 100)
          if (pct !== lastPct && pct % 10 === 0) { lastPct = pct; ctx.log('stdout', `Скачано ${(got / 1048576).toFixed(1)} МБ ${pct}%\n`) }
        }
      })
      try {
        const ins = dl.inspection
        ctx.log('info', `Архив ${(dl.size / 1024).toFixed(0)} КБ, файлов: ${ins.entries}${ins.props?.name ? `, библиотека «${ins.props.name}» ${ins.props.version ?? ''}` : ''}\n`)
        for (const w of ins.warnings) ctx.log('info', `Предупреждение: ${w}\n`)
        // Согласие уже получено: включаем небезопасную установку ТОЛЬКО для этого процесса, конфиг пользователя не трогаем
        const code = await ctx.runCli(['lib', 'install', '--zip-path', dl.zipPath, '--no-deps', '--no-color'], { ARDUINO_LIBRARY_ENABLE_UNSAFE_INSTALL: 'true' })
        const result: InstallResult = {
          opId: ctx.opId, owner, repo, ok: code === 0,
          name: ins.props?.name, version: ins.props?.version,
          depends: code === 0 ? dependStatus(ins.props?.depends, await installedNames()) : [],
          warnings: ins.warnings
        }
        ctx.emit('libsource:result', result)
        return code
      } finally {
        dl.cleanup()
      }
    })
  })

  // Установка недостающих зависимостей из индекса Arduino (обычный lib install по именам)
  ipcMain.handle('libsource:install-deps', (e, names: unknown) => {
    if (!Array.isArray(names) || names.length === 0 || names.length > 20 || !names.every((n) => isLibName(n))) return fail('Недопустимый список библиотек.')
    return startAsyncOp(e.sender, 'lib-install', (ctx) => ctx.runCli(['lib', 'install', ...(names as string[]), '--no-color']))
  })
}

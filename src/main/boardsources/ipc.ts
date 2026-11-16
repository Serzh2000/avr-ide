// IPC «Источников плат»: каталог, проверка адреса, подключение/отключение (board_manager.additional_urls), поиск ядер.
// Из renderer принимаются только адрес, id ядра и флаги согласия; все аргументы arduino-cli строятся массивом (без shell).
// Конфиг меняется ТОЛЬКО по явному действию пользователя (подтверждённый диалог в интерфейсе).
import { ipcMain } from 'electron'
import { findCli, INSTALL_HELP } from '../cli/binary'
import { capture, startAsyncOp } from '../cli/ipc'
import type { CliResult } from '../cli/types'
import { isCoreId, isQuery } from '../cli/validate'
import { fetchBuffer, NetError } from '../libsource/net'
import { catalog, forgetCustom, getCustom, rememberCustom } from './catalog'
import { buildSourceViews, groupCores, parsePackageIndex, sameUrl, searchCatalog, urlKey, urlsFromConfigDump, validateSourceUrl } from './core'
import type { CoreSearchResult, CustomSource, SourcesState, UrlCheck } from './types'

const fail = (error: string, notFound = false): { ok: false; error: string; notFound?: boolean } => ({ ok: false, error, notFound })

const MAX_INDEX_BYTES = 60 * 1024 * 1024

/** Проверенные в этом сеансе адреса (проверка обязательна перед добавлением своего адреса). */
const checked = new Map<string, CustomSource>()

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string): string => s.replace(/\u001b\[[0-9;]*m/g, '')

let configPathCache: string | undefined

async function readConfig(): Promise<{ urls: string[]; configPath?: string } | null> {
  const f = findCli()
  if (!f) return null
  const r = await capture(f.path, ['config', 'dump', '--format', 'json'])
  if (r.code !== 0) return null
  if (!configPathCache) {
    const v = await capture(f.path, ['config', 'dump', '--verbose'])
    const m = /Using config file:\s*(.+?\.ya?ml)/i.exec(stripAnsi(v.stdout + '\n' + v.stderr))
    if (m) configPathCache = m[1].trim()
  }
  return { urls: urlsFromConfigDump(r.stdout), configPath: configPathCache }
}

interface RawPlatform { id: string; name: string; latest?: string; installed?: string }

function parseSearch(raw: string): RawPlatform[] {
  const j = JSON.parse(raw) as { platforms?: Record<string, unknown>[] } | Record<string, unknown>[]
  const arr = Array.isArray(j) ? j : (j.platforms ?? [])
  return arr.map((p) => {
    const latest = (p.latest_version ?? p.latest) as string | undefined
    const rels = p.releases as Record<string, { name?: string }> | undefined
    const rel = rels?.[latest ?? '']
    return {
      id: String(p.id),
      name: String(p.name ?? rel?.name ?? p.id),
      latest,
      installed: (p.installed_version ?? p.installed) as string | undefined
    }
  })
}

function explainNet(e: unknown): string {
  if (e instanceof NetError) {
    if (e.status === 404) return 'Файл не найден на сервере (ошибка 404): проверьте адрес.'
    return e.message
  }
  return e instanceof Error ? e.message : String(e)
}

export function registerBoardSourcesIpc(): void {
  ipcMain.handle('bsrc:list', async (): Promise<CliResult<SourcesState>> => {
    const cfg = await readConfig()
    if (!cfg) return fail(findCli() ? 'Не удалось прочитать настройки arduino-cli.' : INSTALL_HELP, !findCli())
    return { ok: true, data: { sources: buildSourceViews(catalog, getCustom(), cfg.urls), configured: cfg.urls, configPath: cfg.configPath } }
  })

  // Проверка адреса: скачиваем индекс, разбираем, ничего не добавляя
  ipcMain.handle('bsrc:check', async (_e, input: unknown): Promise<CliResult<UrlCheck>> => {
    const v = validateSourceUrl(input)
    if (!v.ok) return fail(v.error)
    const cfg = await readConfig()
    let buf: Buffer
    try {
      buf = await fetchBuffer(v.url, { maxBytes: MAX_INDEX_BYTES, timeoutMs: 30_000, headers: { Accept: 'application/json' } })
    } catch (e) {
      return fail(explainNet(e))
    }
    let summary
    try {
      summary = parsePackageIndex(JSON.parse(buf.toString('utf8').replace(/^﻿/, '')))
    } catch (e) {
      return fail(e instanceof SyntaxError ? 'По этому адресу лежит не JSON: возможно, это веб-страница, а не файл индекса.' : (e as Error).message)
    }
    const cat = catalog.find((s) => sameUrl(s.url, v.url))
    const name = cat?.name ?? summary.maintainers[0] ?? new URL(v.url).hostname
    checked.set(urlKey(v.url), {
      url: v.url, https: v.https, name, maintainers: summary.maintainers,
      platforms: summary.platforms.map((p) => ({ id: p.id, name: p.name, latest: p.latest })), addedAt: new Date().toISOString().slice(0, 10)
    })
    return {
      ok: true,
      data: { url: v.url, https: v.https, size: buf.length, summary, alreadyConnected: !!cfg?.urls.some((u) => sameUrl(u, v.url)), catalogId: cat?.id }
    }
  })

  /**
   * Подключение источника: config add → core update-index (→ core install, если указано ядро).
   * ack — согласие с предупреждением о стороннем источнике; для http нужно ещё и ackHttp.
   * Если обновление индекса не удалось, адрес убирается из конфига обратно.
   */
  ipcMain.handle('bsrc:connect', (e, input: unknown, ack: unknown, ackHttp: unknown, installCore: unknown) => {
    const v = validateSourceUrl(input)
    if (!v.ok) return fail(v.error)
    if (ack !== true) return fail('Нужно подтвердить подключение источника.')
    if (!v.https && ackHttp !== true) return fail('Адрес без шифрования (http): подтвердите это отдельно.')
    if (installCore != null && !isCoreId(installCore)) return fail('Недопустимый идентификатор ядра.')
    const cat = catalog.find((s) => sameUrl(s.url, v.url))
    const mine = checked.get(urlKey(v.url))
    if (!cat && !mine) return fail('Сначала проверьте адрес кнопкой «Проверить».')
    if (!findCli()) return fail(INSTALL_HELP, true)
    const url = v.url
    return startAsyncOp(e.sender, 'index-update', async (ctx) => {
      const cur = await readConfig()
      const had = !!cur?.urls.some((u) => sameUrl(u, url))
      ctx.log('info', `Подключение источника плат: ${url}\n`)
      if (!had) {
        const c1 = await ctx.runCli(['config', 'add', 'board_manager.additional_urls', url])
        if (c1 !== 0) return c1
      }
      const c2 = await ctx.runCli(['core', 'update-index', '--no-color'])
      if (c2 !== 0) {
        if (!had) {
          ctx.log('stderr', 'Не удалось обновить индекс — адрес убран из настроек, чтобы не мешать другим источникам.\n')
          await ctx.runCli(['config', 'remove', 'board_manager.additional_urls', url])
        }
        return c2
      }
      if (!cat && mine) rememberCustom(mine)
      if (typeof installCore === 'string') return ctx.runCli(['core', 'install', installCore, '--no-color'])
      return 0
    })
  })

  // Отключение: config remove. Уже установленные ядра остаются, но обновляться не смогут.
  ipcMain.handle('bsrc:disconnect', async (e, input: unknown) => {
    const v = validateSourceUrl(input)
    if (!v.ok) return fail(v.error)
    const cfg = await readConfig()
    if (!cfg) return fail(INSTALL_HELP, true)
    const exact = cfg.urls.find((u) => sameUrl(u, v.url))
    if (!exact) return fail('Этого адреса нет в настройках arduino-cli.')
    return startAsyncOp(e.sender, 'config', async (ctx) => {
      ctx.log('info', `Отключение источника плат: ${exact}\n`)
      const c = await ctx.runCli(['config', 'remove', 'board_manager.additional_urls', exact])
      if (c === 0) {
        forgetCustom(exact)
        ctx.log('stdout', 'Источник отключён. Установленные ядра остались на месте.\n')
      }
      return c
    })
  })

  // Поиск ядер по всем подключённым источникам (+ подсказки из каталога по ещё не подключённым)
  ipcMain.handle('bsrc:search', async (_e, q: unknown): Promise<CliResult<CoreSearchResult>> => {
    if (!isQuery(q)) return fail('Недопустимый поисковый запрос.')
    const f = findCli()
    if (!f) return fail(INSTALL_HELP, true)
    const text = q.trim()
    const r = await capture(f.path, ['core', 'search', ...(text ? [text] : []), '--format', 'json'])
    if (r.code !== 0) return fail((r.stderr || r.stdout).trim() || `arduino-cli завершился с кодом ${r.code}`)
    let found: RawPlatform[]
    try { found = parseSearch(r.stdout) } catch { return fail('Не удалось разобрать ответ arduino-cli.') }
    const cfg = await readConfig()
    const configured = cfg?.urls ?? []
    const groups = groupCores(found, catalog, getCustom())
    const have = new Set(found.map((x) => x.id))
    const hits = text
      ? searchCatalog(text, catalog, configured).filter((h) => !h.source.connected || h.source.cores.every((c) => !have.has(c.id)))
      : []
    return { ok: true, data: { groups, hits } }
  })

  // Для мастера: источники каталога, подходящие к тексту (названия плат, чипов, ядер) — в том числе уже подключённые
  ipcMain.handle('bsrc:catalog-search', async (_e, q: unknown) => {
    if (typeof q !== 'string' || q.length > 100) return fail('Недопустимый поисковый запрос.')
    const cfg = await readConfig()
    return { ok: true as const, data: searchCatalog(q, catalog, cfg?.urls ?? []).slice(0, 8) }
  })
}

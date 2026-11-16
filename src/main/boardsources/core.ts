// Чистая логика источников плат (без electron и сети): проверка адреса, разбор индекса, правка списка адресов,
// группировка поиска. Покрыта тестами в boardsources.test.ts.
import type { CatalogHit, CatalogSource, CoreGroup, CustomSource, FoundCore, IndexSummary, SourceView } from './types'

// ---------- Проверка адреса ----------

const MAX_URL = 300
// Допустимые символы URL: без пробелов, кавычек, скобок-обёрток и управляющих знаков
const URL_RE = /^https?:\/\/[A-Za-z0-9._~:/?#@!$&*+,;=%-]+$/

export type UrlVerdict = { ok: true; url: string; https: boolean } | { ok: false; error: string }

/** Проверяет адрес пакета плат. Принимает только http/https, без пробелов, кавычек и переводов строк. */
export function validateSourceUrl(input: unknown): UrlVerdict {
  if (typeof input !== 'string') return { ok: false, error: 'Введите адрес.' }
  const s = input.trim()
  if (!s) return { ok: false, error: 'Введите адрес.' }
  if (s.length > MAX_URL) return { ok: false, error: `Адрес слишком длинный (больше ${MAX_URL} знаков).` }
  if (/\s/.test(s)) return { ok: false, error: 'В адресе не должно быть пробелов и переводов строк.' }
  if (/["'`<>\\^{}|[\]()]/.test(s)) return { ok: false, error: 'В адресе не должно быть кавычек и скобок.' }
  if (!/^https?:\/\//i.test(s)) return { ok: false, error: 'Адрес должен начинаться с https:// (или http://).' }
  if (!URL_RE.test(s)) return { ok: false, error: 'В адресе есть недопустимые знаки.' }
  let u: URL
  try { u = new URL(s) } catch { return { ok: false, error: 'Адрес записан неверно.' } }
  if (u.username || u.password) return { ok: false, error: 'Адрес не должен содержать логин и пароль.' }
  if (!u.hostname || !u.hostname.includes('.') && u.hostname !== 'localhost') return { ok: false, error: 'В адресе нет имени сайта.' }
  if (!/\.json$/i.test(u.pathname)) return { ok: false, error: 'Ожидается ссылка на файл индекса, он обычно называется package_…_index.json.' }
  return { ok: true, url: s, https: u.protocol === 'https:' }
}

/** Ключ для сравнения адресов: регистр хоста и хвостовые «/» не важны, схема важна. */
export function urlKey(url: string): string {
  try {
    const u = new URL(url.trim())
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname}${u.search}`
  } catch {
    return url.trim()
  }
}

export const sameUrl = (a: string, b: string): boolean => urlKey(a) === urlKey(b)

// ---------- Разбор package_index.json ----------

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Сравнение версий вида 1.2.3 / 1.0.0-rc1 (числа по частям, без сложной семантики semver). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.\-+]/).map((x) => parseInt(x, 10) || 0)
  const pb = b.split(/[.\-+]/).map((x) => parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}

/** Разбирает package_index.json. Бросает Error с понятным текстом, если это не индекс плат. */
export function parsePackageIndex(json: unknown): IndexSummary {
  if (!isObj(json) || !Array.isArray(json.packages)) throw new Error('Это не индекс плат: в файле нет списка packages.')
  const byId = new Map<string, { name: string; versions: string[]; boards: Map<string, string[]> }>()
  const maint = new Set<string>()
  for (const p of json.packages) {
    if (!isObj(p) || typeof p.name !== 'string' || !Array.isArray(p.platforms)) continue
    if (typeof p.maintainer === 'string' && p.maintainer) maint.add(p.maintainer)
    for (const pl of p.platforms) {
      if (!isObj(pl) || typeof pl.architecture !== 'string' || typeof pl.version !== 'string') continue
      const id = `${p.name}:${pl.architecture}`
      const e = byId.get(id) ?? { name: typeof pl.name === 'string' ? pl.name : id, versions: [] as string[], boards: new Map<string, string[]>() }
      e.versions.push(pl.version)
      const boards = Array.isArray(pl.boards) ? pl.boards.map((b) => (isObj(b) && typeof b.name === 'string' ? b.name : '')).filter(Boolean) : []
      e.boards.set(pl.version, boards)
      byId.set(id, e)
    }
  }
  if (byId.size === 0) throw new Error('В индексе нет ни одной платформы (platforms пуст).')
  const platforms = [...byId.entries()].map(([id, e]) => {
    const versions = [...e.versions].sort(compareVersions)
    const latest = versions[versions.length - 1]
    const boards = [...new Set((e.boards.get(latest) ?? []).filter((n) => n.length <= 60 && !/[<>]/.test(n)))].slice(0, 400)
    return { id, name: e.name, latest, releases: e.versions.length, boards }
  })
  return { platforms, maintainers: [...maint] }
}

// ---------- Список адресов (board_manager.additional_urls) ----------

/** Добавляет адрес, если его ещё нет (сравнение без учёта регистра хоста). Возвращает новый список. */
export function addUrlToList(list: readonly string[], url: string): string[] {
  return list.some((u) => sameUrl(u, url)) ? [...list] : [...list, url]
}

export function removeUrlFromList(list: readonly string[], url: string): string[] {
  return list.filter((u) => !sameUrl(u, url))
}

/** Достаёт адреса из JSON `arduino-cli config dump --format json` (разные версии CLI дают чуть разную форму). */
export function urlsFromConfigDump(raw: string): string[] {
  try {
    const j = JSON.parse(raw) as Obj
    const cfg = isObj(j.config) ? j.config : j
    const bm = isObj(cfg.board_manager) ? cfg.board_manager : {}
    const arr = bm.additional_urls
    if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === 'string')
    if (typeof arr === 'string' && arr) return [arr]
  } catch { /* не JSON */ }
  return []
}

// ---------- Представление источников ----------

export function catalogView(s: CatalogSource, configured: readonly string[]): SourceView {
  return {
    kind: 'catalog', id: s.id, name: s.name, maintainer: s.maintainer, url: s.url, https: s.https, description: s.description,
    platformsCount: s.platformsCount, connected: configured.some((u) => sameUrl(u, s.url)), verifiedAt: s.verifiedAt,
    cores: s.cores.map((c) => ({ id: c.id, name: c.name, latest: c.latest }))
  }
}

export function customView(c: CustomSource, configured: readonly string[]): SourceView {
  return {
    kind: 'custom', id: 'custom:' + urlKey(c.url), name: c.name, maintainer: c.maintainers.join(', '), url: c.url, https: c.https,
    description: `Свой адрес. Найдено платформ: ${c.platforms.length}.`, platformsCount: c.platforms.length,
    connected: configured.some((u) => sameUrl(u, c.url)), cores: c.platforms
  }
}

/** Адрес из конфига, о котором приложение ничего не знает (добавлен вручную или другой программой). */
export function otherView(url: string): SourceView {
  let host = url
  try { host = new URL(url).hostname } catch { /* оставляем как есть */ }
  return {
    kind: 'other', id: 'other:' + urlKey(url), name: host, maintainer: '', url, https: /^https:/i.test(url),
    description: 'Адрес из настроек arduino-cli, которого нет в каталоге.', platformsCount: 0, connected: true, cores: []
  }
}

/** Собирает итоговый список: каталог, свои проверенные, остальные адреса из конфига. */
export function buildSourceViews(catalog: readonly CatalogSource[], custom: readonly CustomSource[], configured: readonly string[]): SourceView[] {
  const out: SourceView[] = catalog.map((s) => catalogView(s, configured))
  const known = [...catalog.map((s) => s.url)]
  for (const c of custom) {
    if (known.some((u) => sameUrl(u, c.url))) continue
    known.push(c.url)
    out.push(customView(c, configured))
  }
  for (const u of configured) {
    if (known.some((k) => sameUrl(k, u))) continue
    known.push(u)
    out.push(otherView(u))
  }
  return out
}

// ---------- Группировка поиска ядер ----------

interface RawCore { id: string; name: string; latest?: string; installed?: string }

/**
 * Раскладывает найденные ядра по источникам. Источник определяется по id ядра: сначала по каталогу, затем по
 * своим проверенным адресам; arduino:* — встроенный индекс Arduino; остальное — «Прочие».
 */
export function groupCores(found: readonly RawCore[], catalog: readonly CatalogSource[], custom: readonly CustomSource[]): CoreGroup[] {
  const owner = new Map<string, { sourceId: string; title: string; url?: string }>()
  for (const s of catalog) for (const c of s.cores) if (!owner.has(c.id)) owner.set(c.id, { sourceId: s.id, title: s.name, url: s.url })
  for (const cs of custom) for (const p of cs.platforms) if (!owner.has(p.id)) owner.set(p.id, { sourceId: 'custom:' + urlKey(cs.url), title: cs.name, url: cs.url })
  const groups = new Map<string, CoreGroup>()
  for (const f of found) {
    const o = owner.get(f.id) ?? (f.id.startsWith('arduino:') ? { sourceId: '_arduino', title: 'Arduino (встроенный источник)', url: undefined } : { sourceId: '_unknown', title: 'Прочие источники', url: undefined })
    const g = groups.get(o.sourceId) ?? { sourceId: o.sourceId, title: o.title, url: o.url, cores: [] }
    g.cores.push({ id: f.id, name: f.name, latest: f.latest, installed: f.installed })
    groups.set(o.sourceId, g)
  }
  const rank = (g: CoreGroup): number => (g.sourceId === '_arduino' ? 0 : g.sourceId === '_unknown' ? 2 : 1)
  return [...groups.values()]
    .map((g) => ({ ...g, cores: [...g.cores].sort((a, b) => a.name.localeCompare(b.name, 'en')) }))
    .sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title, 'ru'))
}

// ---------- Поиск по каталогу (ядра, которых ещё нет) ----------

const tokens = (q: string): string[] => q.toLowerCase().split(/[\s,]+/).filter(Boolean)

/**
 * Ищет по каталогу проверенных источников: название, теги, описание, ядра и названия плат.
 * Возвращает ВСЕ подходящие источники (подключённость видна по полю connected).
 */
export function searchCatalog(q: string, catalog: readonly CatalogSource[], configured: readonly string[]): CatalogHit[] {
  const t = tokens(q)
  if (t.length === 0) return []
  const hits: CatalogHit[] = []
  for (const s of catalog) {
    const head = `${s.name} ${s.tags} ${s.description} ${s.maintainer} ${s.architectures.join(' ')}`.toLowerCase()
    const matches: string[] = []
    const coreIds: string[] = []
    const allIn = (hay: string): boolean => t.every((x) => hay.includes(x))
    let ok = allIn(head)
    for (const c of s.cores) {
      const coreHay = `${c.id} ${c.name}`.toLowerCase()
      if (allIn(coreHay) || allIn(`${head} ${coreHay}`)) { ok = true; matches.push(c.name); coreIds.push(c.id) }
      for (const b of c.boards) if (allIn(b.toLowerCase())) { ok = true; if (!coreIds.includes(c.id)) coreIds.push(c.id); if (matches.length < 6 && !matches.includes(b)) matches.push(b) }
    }
    if (ok) hits.push({ source: catalogView(s, configured), matches: matches.slice(0, 6), coreIds: coreIds.length ? coreIds : s.cores.map((x) => x.id) })
  }
  return hits
}

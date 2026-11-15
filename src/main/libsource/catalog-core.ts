// Чистая логика каталога: сжатие library_index.json, сопоставление с репозиториями, поиск.
import { compareVersions, normalizeRepoUrl } from './repo'
import type { CatalogEntry, RepoId, SearchResult } from './types'

/** Сжатая запись об одном репозитории из индекса Arduino. */
export interface IndexInfo {
  /** «owner/repo» в регистре индекса */
  id: string
  n: string
  a?: string
  s?: string
  c?: string
  /** Версии, новые первыми (не более MAX_VERSIONS) */
  v: string[]
}

export type IndexMap = Record<string, IndexInfo>

const MAX_VERSIONS = 30

interface RawLib {
  name?: unknown
  version?: unknown
  author?: unknown
  sentence?: unknown
  category?: unknown
  repository?: unknown
  website?: unknown
}

/** «Имя <email>» → «Имя» */
export const cleanAuthor = (a?: string): string | undefined => a?.replace(/\s*<[^>]*>/g, '').trim() || undefined

const str = (x: unknown): string | undefined => (typeof x === 'string' && x.trim() ? x.trim() : undefined)

/** Репозиторий записи индекса: сначала поле repository, затем website (оба нормализуются). */
export function repoOfIndexEntry(l: RawLib): RepoId | null {
  return normalizeRepoUrl(l.repository) ?? normalizeRepoUrl(l.website)
}

/** library_index.json (массив libraries) → карта «ключ репозитория → сжатая информация». */
export function compactIndex(libs: unknown[]): IndexMap {
  const map: IndexMap = {}
  for (const raw of libs) {
    const l = raw as RawLib
    if (!l || typeof l !== 'object') continue
    const id = repoOfIndexEntry(l)
    const name = str(l.name)
    if (!id || !name) continue
    const ver = str(l.version)
    const cur = map[id.key]
    if (!cur) {
      map[id.key] = { id: `${id.owner}/${id.repo}`, n: name, a: str(l.author), s: str(l.sentence), c: str(l.category), v: ver ? [ver] : [] }
      continue
    }
    if (!ver || cur.v.includes(ver)) continue
    const newest = cur.v.length === 0 || compareVersions(ver, cur.v[0]) > 0
    cur.v.push(ver)
    cur.v.sort((x, y) => compareVersions(y, x))
    if (cur.v.length > MAX_VERSIONS) cur.v.length = MAX_VERSIONS
    if (newest) { // описание берём у самой новой версии
      cur.n = name
      cur.a = str(l.author) ?? cur.a
      cur.s = str(l.sentence) ?? cur.s
      cur.c = str(l.category) ?? cur.c
    }
  }
  return map
}

export interface CatalogIndex {
  entries: CatalogEntry[]
  /** Нижний регистр: имя, автор, описание, owner/repo — для быстрого поиска */
  hay: string[]
  nameL: string[]
  repoL: string[]
  authorL: string[]
  /** Порядок по умолчанию (для пустого запроса) */
  order: number[]
  byKey: Map<string, number>
}

/** Сопоставляет реестр (repositories.txt), индекс Arduino и пользовательский список. */
export function buildCatalog(registry: RepoId[], index: IndexMap, custom: RepoId[] = []): CatalogIndex {
  const entries: CatalogEntry[] = []
  const byKey = new Map<string, number>()
  const add = (id: RepoId, isCustom: boolean, display?: string): void => {
    const have = byKey.get(id.key)
    if (have !== undefined) {
      if (isCustom) entries[have].custom = true
      return
    }
    const info = index[id.key]
    const idStr = display ?? `${id.owner}/${id.repo}`
    const [owner, repo] = idStr.split('/')
    entries.push({
      id: idStr,
      owner,
      repo,
      name: info ? info.n : idStr,
      author: cleanAuthor(info?.a),
      sentence: info?.s,
      category: info?.c,
      latest: info?.v[0],
      inIndex: !!info,
      custom: isCustom || undefined
    })
    byKey.set(id.key, entries.length - 1)
  }
  for (const c of custom) add(c, true)
  for (const r of registry) add(r, false)
  // Репозитории из индекса, которых нет в реестре
  for (const [key, info] of Object.entries(index)) {
    if (byKey.has(key)) continue
    const [owner, repo] = info.id.split('/')
    add({ owner, repo, key }, false, info.id)
  }
  const hay: string[] = []
  const nameL: string[] = []
  const repoL: string[] = []
  const authorL: string[] = []
  for (const e of entries) {
    nameL.push(e.name.toLowerCase())
    repoL.push(e.id.toLowerCase())
    authorL.push((e.author ?? '').toLowerCase())
    hay.push(`${e.name} ${e.author ?? ''} ${e.sentence ?? ''} ${e.id}`.toLowerCase())
  }
  const order = entries.map((_, i) => i)
  order.sort((a, b) => {
    const ea = entries[a], eb = entries[b]
    if (!!ea.custom !== !!eb.custom) return ea.custom ? -1 : 1
    if (ea.inIndex !== eb.inIndex) return ea.inIndex ? -1 : 1
    return nameL[a] < nameL[b] ? -1 : nameL[a] > nameL[b] ? 1 : 0
  })
  return { entries, hay, nameL, repoL, authorL, order, byKey }
}

/** Разбивает запрос на токены (буквы/цифры любых алфавитов). «owner/repo» остаётся одним токеном. */
export function tokenize(q: string): string[] {
  return q.toLowerCase().split(/[^\p{L}\p{N}_/.#+-]+/u).map((t) => t.replace(/^[-.]+|[-.]+$/g, '')).filter(Boolean)
}

export const MAX_PAGE = 100

/**
 * Поиск: каждый токен должен встретиться в имени/авторе/описании/owner-repo.
 * Выше те, где токен совпал с именем (точно / в начале / внутри), затем с репозиторием и автором.
 */
export function searchCatalog(cat: CatalogIndex, query: string, offset = 0, limit = MAX_PAGE): SearchResult {
  const lim = Math.max(1, Math.min(MAX_PAGE, Math.floor(limit) || MAX_PAGE))
  const off = Math.max(0, Math.floor(offset) || 0)
  const toks = tokenize(query)
  if (toks.length === 0) {
    return { total: cat.order.length, offset: off, items: cat.order.slice(off, off + lim).map((i) => cat.entries[i]) }
  }
  const scored: { i: number; s: number }[] = []
  for (let i = 0; i < cat.entries.length; i++) {
    const h = cat.hay[i]
    let score = 0
    let ok = true
    for (const t of toks) {
      if (!h.includes(t)) { ok = false; break }
      const n = cat.nameL[i]
      if (n === t) score += 1000
      else if (n.startsWith(t)) score += 500
      else if (n.includes(t)) score += 300
      else if (cat.repoL[i].includes(t)) score += 200
      else if (cat.authorL[i].includes(t)) score += 100
      else score += 10
    }
    if (ok) {
      if (cat.entries[i].custom) score += 50
      if (cat.entries[i].inIndex) score += 5
      scored.push({ i, s: score })
    }
  }
  scored.sort((a, b) => b.s - a.s || (cat.nameL[a.i] < cat.nameL[b.i] ? -1 : cat.nameL[a.i] > cat.nameL[b.i] ? 1 : 0))
  return { total: scored.length, offset: off, items: scored.slice(off, off + lim).map((x) => cat.entries[x.i]) }
}

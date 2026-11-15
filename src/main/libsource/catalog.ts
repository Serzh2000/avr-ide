// Локальный каталог: загрузка repositories.txt и library_index.json, кэш на диске, поиск в памяти.
// Без сети работаем по сохранённой копии.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import { buildCatalog, compactIndex, searchCatalog, type CatalogIndex, type IndexMap } from './catalog-core'
import { fetchBuffer } from './net'
import { parseRepositories, repoId } from './repo'
import type { CatalogEntry, RepoId, SearchResult } from './types'

export const REGISTRY_URL = 'https://raw.githubusercontent.com/arduino/library-registry/main/repositories.txt'
export const INDEX_URL = 'https://downloads.arduino.cc/libraries/library_index.json'

interface Cache {
  v: 1
  registryAt: number
  indexAt: number
  /** «owner/repo» в регистре реестра */
  repos: string[]
  index: IndexMap
}

let dir = ''
let cache: Cache | null = null
let built: CatalogIndex | null = null
let customList: RepoId[] = []
let refreshing = false

export function initCatalog(cacheDir: string): void {
  dir = cacheDir
}

const file = (): string => join(dir, 'catalog.json')

function load(): Cache | null {
  if (cache) return cache
  try {
    const j = JSON.parse(readFileSync(file(), 'utf8')) as Cache
    if (j && j.v === 1 && Array.isArray(j.repos) && j.index && typeof j.index === 'object') cache = j
  } catch { /* кэша нет или он повреждён */ }
  return cache
}

function save(c: Cache): void {
  mkdirSync(dir, { recursive: true })
  const tmp = file() + '.tmp'
  writeFileSync(tmp, JSON.stringify(c), 'utf8')
  renameSync(tmp, file())
}

export function setCustom(list: RepoId[]): void {
  customList = list
  built = null
}

function getBuilt(): CatalogIndex {
  if (built) return built
  const c = load()
  const registry: RepoId[] = []
  for (const s of c?.repos ?? []) {
    const [o, r] = s.split('/')
    const id = repoId(o, r)
    if (id) registry.push(id)
  }
  built = buildCatalog(registry, c?.index ?? {}, customList)
  return built
}

export function catalogInfo(): { loaded: boolean; registryAt: number; indexAt: number; total: number; inIndex: number; custom: number; refreshing: boolean } {
  const c = load()
  const b = getBuilt()
  return {
    loaded: !!c,
    registryAt: c?.registryAt ?? 0,
    indexAt: c?.indexAt ?? 0,
    total: b.entries.length,
    inIndex: b.entries.filter((e) => e.inIndex).length,
    custom: customList.length,
    refreshing
  }
}

export function search(q: string, offset?: number, limit?: number): SearchResult {
  return searchCatalog(getBuilt(), q, offset, limit)
}

export function findEntry(owner: string, repo: string): CatalogEntry | null {
  const b = getBuilt()
  const i = b.byKey.get(`${owner}/${repo}`.toLowerCase())
  return i === undefined ? null : b.entries[i]
}

export interface RefreshOpts {
  onProgress?: (text: string) => void
  signal?: AbortSignal
}

/** Обновляет оба источника независимо; возвращает список сообщений об ошибках (пусто — всё хорошо). */
export async function refreshCatalog(o: RefreshOpts = {}): Promise<string[]> {
  if (refreshing) return ['Каталог уже обновляется.']
  refreshing = true
  const errors: string[] = []
  const base: Cache = load() ?? { v: 1, registryAt: 0, indexAt: 0, repos: [], index: {} }
  const next: Cache = { ...base }
  try {
    try {
      o.onProgress?.('Загрузка списка репозиториев (реестр Arduino)…')
      const buf = await fetchBuffer(REGISTRY_URL, { maxBytes: 30 * 1048576, signal: o.signal })
      const ids = parseRepositories(buf.toString('utf8'))
      if (ids.length < 100) throw new Error('Реестр вернул подозрительно мало репозиториев.')
      next.repos = ids.map((i) => `${i.owner}/${i.repo}`)
      next.registryAt = Date.now()
    } catch (e) {
      errors.push('Реестр репозиториев: ' + (e as Error).message)
    }
    try {
      o.onProgress?.('Загрузка индекса библиотек Arduino (около 60 МБ)…')
      const buf = await fetchBuffer(INDEX_URL, {
        maxBytes: 400 * 1048576,
        timeoutMs: 10 * 60_000,
        signal: o.signal,
        onProgress: (got, total) => o.onProgress?.(`Загрузка индекса библиотек Arduino: ${(got / 1048576).toFixed(0)}${total ? ' из ' + (total / 1048576).toFixed(0) : ''} МБ…`)
      })
      o.onProgress?.('Разбор индекса…')
      const j = JSON.parse(buf.toString('utf8')) as { libraries?: unknown[] }
      if (!Array.isArray(j.libraries)) throw new Error('В индексе нет списка библиотек.')
      next.index = compactIndex(j.libraries)
      next.indexAt = Date.now()
    } catch (e) {
      errors.push('Индекс библиотек: ' + (e as Error).message)
    }
    if (next.registryAt !== base.registryAt || next.indexAt !== base.indexAt) {
      save(next)
      cache = next
      built = null
    }
  } finally {
    refreshing = false
  }
  return errors
}

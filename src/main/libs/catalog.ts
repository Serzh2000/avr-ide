// Каталог библиотек Arduino из локального library_index.json (его скачивает arduino-cli).
// Нужен справочнику, чтобы показать описание библиотеки до установки. Сеть не используется.
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

export interface CatalogLibrary {
  name: string
  /** Последняя версия. */
  version: string
  /** До 15 последних версий, новые первыми. */
  versions: string[]
  author?: string
  maintainer?: string
  sentence?: string
  paragraph?: string
  website?: string
  category?: string
  architectures: string[]
  dependencies: string[]
  providesIncludes?: string[]
}

interface Raw {
  name?: unknown; version?: unknown; author?: unknown; maintainer?: unknown; sentence?: unknown; paragraph?: unknown
  website?: unknown; category?: unknown; architectures?: unknown; dependencies?: unknown; providesIncludes?: unknown
}

let cache: { path: string; mtime: number; size: number; libs: CatalogLibrary[] } | null = null

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }
/** Текст из индекса: <br> → перевод строки, прочие HTML-теги и сущности убираются. */
const str = (v: unknown, max = 2000): string | undefined => {
  if (typeof v !== 'string') return undefined
  const t = v
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]{0,200}>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_m, e: string) => ENT[e])
    .replace(/[ \t]+\n/g, '\n')
    .trim()
  return t ? t.slice(0, max) : undefined
}
const versions = new Intl.Collator('en', { numeric: true })
const newer = (a: string, b: string): number => Number(a.includes('-')) - Number(b.includes('-')) || versions.compare(b, a)

/** Каталог, сгруппированный по имени (последняя версия + список версий). null — индекса нет. */
export async function loadCatalog(dataDir: string): Promise<CatalogLibrary[] | null> {
  const path = join(dataDir, 'library_index.json')
  const s = await stat(path).catch(() => null)
  if (!s?.isFile() || s.size > 160 * 1024 * 1024) return null
  if (cache && cache.path === path && cache.mtime === s.mtimeMs && cache.size === s.size) return cache.libs
  let list: unknown
  try { list = (JSON.parse(await readFile(path, 'utf8')) as { libraries?: unknown }).libraries } catch { return null }
  if (!Array.isArray(list)) return null
  const byName = new Map<string, Raw[]>()
  for (const r of list as Raw[]) {
    if (!r || typeof r.name !== 'string' || typeof r.version !== 'string') continue
    const arr = byName.get(r.name)
    if (arr) arr.push(r)
    else byName.set(r.name, [r])
  }
  const libs: CatalogLibrary[] = []
  for (const [name, rels] of byName) {
    rels.sort((a, b) => newer(a.version as string, b.version as string))
    const last = rels[0]
    libs.push({
      name,
      version: last.version as string,
      versions: rels.slice(0, 15).map((r) => r.version as string),
      author: str(last.author, 300),
      maintainer: str(last.maintainer, 300),
      sentence: str(last.sentence, 500),
      paragraph: str(last.paragraph, 3000),
      website: str(last.website, 500),
      category: str(last.category, 100),
      architectures: Array.isArray(last.architectures) ? last.architectures.filter((a): a is string => typeof a === 'string').slice(0, 30) : [],
      dependencies: Array.isArray(last.dependencies)
        ? last.dependencies.flatMap((d) => (d && typeof (d as { name?: unknown }).name === 'string' ? [(d as { name: string }).name] : [])).slice(0, 30)
        : [],
      providesIncludes: Array.isArray(last.providesIncludes) ? last.providesIncludes.filter((h): h is string => typeof h === 'string').slice(0, 30) : undefined
    })
  }
  cache = { path, mtime: s.mtimeMs, size: s.size, libs }
  return libs
}

/** Поиск по имени, описанию и заголовкам: точное имя и начало имени — выше. */
export function searchCatalog(libs: CatalogLibrary[], query: string, limit = 60): CatalogLibrary[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const words = q.split(/\s+/).filter(Boolean)
  const scored: { lib: CatalogLibrary; score: number }[] = []
  for (const lib of libs) {
    const name = lib.name.toLowerCase()
    const text = `${name} ${(lib.sentence ?? '').toLowerCase()} ${(lib.providesIncludes ?? []).join(' ').toLowerCase()} ${(lib.author ?? '').toLowerCase()}`
    if (!words.every((w) => text.includes(w))) continue
    const score = name === q ? 0 : name.startsWith(q) ? 1 : name.includes(q) ? 2 : (lib.providesIncludes ?? []).some((h) => h.toLowerCase().startsWith(q)) ? 3 : 4
    scored.push({ lib, score })
  }
  scored.sort((a, b) => a.score - b.score || a.lib.name.localeCompare(b.lib.name, 'en', { sensitivity: 'base' }))
  return scored.slice(0, limit).map((s) => s.lib)
}

// Чистая логика поиска. Только `import type` — файл можно запускать напрямую в node:test.
import type { FuncEntry, PlatformId } from './types'

/** Разбивает строку на токены: нижний регистр, разделители, camelCase. */
export function tokenize(s: string): string[] {
  const spaced = s.replace(/([a-zа-яё0-9])([A-ZА-ЯЁ])/g, '$1 $2')
  return spaced
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

function lastSegment(name: string): string {
  const i = name.lastIndexOf('.')
  return (i >= 0 ? name.slice(i + 1) : name).toLowerCase()
}

export function matchesPlatform(e: FuncEntry, platform?: PlatformId | 'all' | string): boolean {
  return !platform || platform === 'all' || e.platforms.includes(platform as PlatformId)
}

/** Оценка записи для запроса. 0 — не подходит. */
export function scoreEntry(e: FuncEntry, query: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 1
  const name = e.name.toLowerCase()
  const last = lastSegment(e.name)
  let score = 0

  if (name === q) score += 1000
  else if (last === q) score += 900
  else if (e.aliases?.some((a) => a.toLowerCase() === q)) score += 800
  else if (name.startsWith(q)) score += 500
  else if (last.startsWith(q)) score += 450

  const nameTokens = tokenize(e.name)
  const cat = e.category.toLowerCase()
  const sig = e.signature.toLowerCase()
  const desc = e.description.toLowerCase()
  const paramText = e.params.map((p) => `${p.name} ${p.desc}`).join(' ').toLowerCase()
  const extra = [...(e.notes ?? []), ...(e.warnings ?? []), e.returns].join(' ').toLowerCase()

  for (const raw of tokenize(query)) {
    // грубый стемминг для русских слов: «прерывание» ~ «прерывания»
    const t = raw.length >= 6 && /[а-яё]/.test(raw) ? raw.slice(0, -2) : raw
    let s = 0
    if (name.includes(t)) s += 40
    else if (nameTokens.some((n) => n.startsWith(t))) s += 25
    if (e.aliases?.some((a) => a.toLowerCase().includes(t))) s += 20
    if (cat.includes(t)) s += 10
    if (sig.includes(t)) s += 8
    if (desc.includes(t)) s += 4
    if (paramText.includes(t)) s += 3
    if (extra.includes(t)) s += 2
    if (s === 0) return 0 // все токены запроса должны где-то встретиться
    score += s
  }
  return score
}

export function search(entries: FuncEntry[], query: string, platform?: PlatformId | 'all' | string): FuncEntry[] {
  const pool = entries.filter((e) => matchesPlatform(e, platform))
  if (!query.trim()) return pool
  return pool
    .map((e, i) => ({ e, i, s: scoreEntry(e, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.e)
}

/**
 * Точный поиск по слову под курсором (для F1): имя целиком или последний сегмент (println -> Serial.println),
 * затем совпадение по префиксу. Возвращает undefined, если подходящего нет.
 */
export function lookupIn(entries: FuncEntry[], word: string, platform?: PlatformId | 'all' | string): FuncEntry | undefined {
  const w = word.trim().toLowerCase()
  if (!w) return undefined
  const pool = entries.filter((e) => matchesPlatform(e, platform))
  const exact = pool.find((e) => e.name.toLowerCase() === w) ?? pool.find((e) => lastSegment(e.name) === w)
  if (exact) return exact
  const alias = pool.find((e) => e.aliases?.some((a) => a.toLowerCase() === w))
  if (alias) return alias
  const best = search(pool, w)[0]
  return best && scoreEntry(best, w) >= 450 ? best : undefined
}

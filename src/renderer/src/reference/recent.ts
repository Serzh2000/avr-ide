// Недавние запросы и подсказки поиска справочника. Хранилище — localStorage (может быть недоступно).
import type { FuncEntry } from './types'

const KEY = 'avr-ide.reference.recent'
const MAX = 8

export const EXAMPLE_QUERIES = ['Serial.begin', 'pinMode', 'digitalWrite', 'analogRead', 'WiFi.begin', 'millis']

export function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

/** Добавляет запрос в начало списка (дубликаты схлопываются); возвращает новый список. */
export function pushRecent(list: string[], query: string): string[] {
  const q = query.trim()
  if (q.length < 2) return list
  const next = [q, ...list.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* хранилище недоступно */
  }
  return next
}

export function clearRecent(): string[] {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* хранилище недоступно */
  }
  return []
}

/** Подсказки по набранному тексту: имена записей, содержащие запрос (начинающиеся с него — выше). */
export function suggestNames(entries: FuncEntry[], query: string, limit = 7): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const starts: string[] = []
  const inner: string[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    const n = e.name
    const low = n.toLowerCase()
    if (seen.has(low)) continue
    const last = low.slice(low.lastIndexOf('.') + 1)
    if (low.startsWith(q) || last.startsWith(q)) starts.push(n)
    else if (low.includes(q)) inner.push(n)
    else continue
    seen.add(low)
    if (starts.length >= limit) break
  }
  return [...starts, ...inner].slice(0, limit)
}

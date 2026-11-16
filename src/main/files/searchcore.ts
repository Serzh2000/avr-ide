// Чистая логика поиска и замены по тексту (без fs и Electron — тестируется напрямую).

export interface SearchOptions {
  caseSensitive: boolean
  wholeWord: boolean
  regex: boolean
}

export interface LineMatch {
  /** Номер строки с 1 */
  line: number
  /** Столбец начала совпадения с 1 */
  col: number
  /** Длина совпадения */
  len: number
  /** Текст строки (обрезан до PREVIEW_MAX символов вокруг совпадения) */
  text: string
  /** Где в text начинается совпадение */
  start: number
}

export const MAX_QUERY = 200
export const MAX_LINE = 2000
const PREVIEW_MAX = 240

/**
 * Эвристика против катастрофического возврата: вложенные квантификаторы вида (a+)+, (.*)*, (a|b+)*, (\w+\s?)+.
 * Это не полная защита, поэтому дополнительно режется длина строки и общее время поиска.
 */
export function isDangerousRegex(src: string): boolean {
  // группа, внутри которой есть квантификатор (+ * {n,}) и которая сама повторяется (+ * {n,} или {n,m})
  const groups: { start: number; quant: boolean }[] = []
  let escaped = false
  let inClass = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (escaped) { escaped = false; continue }
    if (c === '\\') { escaped = true; continue }
    if (inClass) { if (c === ']') inClass = false; continue }
    if (c === '[') { inClass = true; continue }
    if (c === '(') { groups.push({ start: i, quant: false }); continue }
    if (c === '+' || c === '*' || (c === '{' && /^\{\d*,\d*\}/.test(src.slice(i)))) {
      if (groups.length) groups[groups.length - 1].quant = true
      continue
    }
    if (c === ')') {
      const g = groups.pop()
      if (!g) continue
      const next = src.slice(i + 1)
      const repeated = /^(?:[+*]|\{\d*,\d*\})/.test(next)
      if (g.quant && repeated) return true
      // внутри повторяющейся внешней группы квантификатор «поднимается» на уровень выше
      if (g.quant && groups.length) groups[groups.length - 1].quant = true
    }
  }
  // чередование одинаковых альтернатив внутри повторяемой группы: (a|a)*
  const alt = /\(([^()|]+)\|\1\)[+*]/
  return alt.test(src)
}

export type MatcherResult = { ok: true; re: RegExp } | { ok: false; error: string }

/** Собирает регулярное выражение из запроса и опций. Всегда с флагом g. */
export function buildMatcher(query: string, o: SearchOptions): MatcherResult {
  if (typeof query !== 'string' || !query) return { ok: false, error: 'Введите, что искать.' }
  if (query.length > MAX_QUERY) return { ok: false, error: `Запрос слишком длинный (не более ${MAX_QUERY} символов).` }
  let src: string
  if (o.regex) {
    if (isDangerousRegex(query)) return { ok: false, error: 'Это выражение может «зависнуть» на длинных строках (вложенные повторы). Упростите его.' }
    src = query
  } else {
    src = query.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  }
  if (o.wholeWord) src = `(?<![\\p{L}\\p{N}_])(?:${src})(?![\\p{L}\\p{N}_])`
  const flags = 'g' + (o.caseSensitive ? '' : 'i') + (o.wholeWord ? 'u' : '')
  try {
    return { ok: true, re: new RegExp(src, flags) }
  } catch (e) {
    return { ok: false, error: 'Неверное регулярное выражение: ' + (e instanceof Error ? e.message.replace(/^Invalid regular expression: /, '') : String(e)) }
  }
}

/** Ищет совпадения построчно. Возвращает не более `limit` штук; `deadline` — момент (ms), после которого поиск прерывается. */
export function findInText(text: string, re: RegExp, limit: number, deadline = Infinity): { matches: LineMatch[]; truncated: boolean } {
  const matches: LineMatch[] = []
  const lines = text.split(/\r\n|\n|\r/)
  for (let li = 0; li < lines.length; li++) {
    if ((li & 63) === 0 && Date.now() > deadline) return { matches, truncated: true }
    const full = lines[li]
    const line = full.length > MAX_LINE ? full.slice(0, MAX_LINE) : full
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(line))) {
      if (m[0].length === 0) { re.lastIndex++; continue }
      if (matches.length >= limit) return { matches, truncated: true }
      let from = 0
      let t = line
      if (t.length > PREVIEW_MAX) {
        from = Math.max(0, Math.min(m.index - 60, t.length - PREVIEW_MAX))
        t = t.slice(from, from + PREVIEW_MAX)
      }
      matches.push({ line: li + 1, col: m.index + 1, len: m[0].length, text: t, start: m.index - from })
    }
  }
  return { matches, truncated: false }
}

/** Заменяет все совпадения. В обычном режиме замена — буквальный текст; в regex-режиме работают $1, $&. */
export function replaceInText(text: string, re: RegExp, replacement: string, regexMode: boolean): { text: string; count: number } {
  let count = 0
  // как и поиск, замена работает построчно (концы строк сохраняются как есть)
  const parts = text.split(/(\r\n|\n|\r)/)
  for (let i = 0; i < parts.length; i += 2) {
    const r = replaceInLine(parts[i], re, replacement, regexMode)
    parts[i] = r.text
    count += r.count
  }
  return { text: parts.join(''), count }
}

function replaceInLine(text: string, re: RegExp, replacement: string, regexMode: boolean): { text: string; count: number } {
  let count = 0
  re.lastIndex = 0
  const out = text.replace(re, (...args: unknown[]) => {
    const m = args[0] as string
    if (m.length === 0) return m
    count++
    if (!regexMode) return replacement
    const groups = args.slice(1, args.findIndex((a) => typeof a === 'number')) as (string | undefined)[]
    return replacement.replace(/\$(\$|&|\d{1,2})/g, (_s, k: string) => {
      if (k === '$') return '$'
      if (k === '&') return m
      const g = groups[Number(k) - 1]
      return g ?? ''
    })
  })
  return { text: out, count }
}

/** Похоже ли содержимое на бинарное (нулевой байт в начале). */
export const looksBinary = (buf: Uint8Array): boolean => buf.subarray(0, 8000).includes(0)

const BINARY_EXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'zip', 'gz', 'tar', '7z', 'rar', 'exe', 'dll', 'bin', 'elf', 'hex', 'o', 'a', 'obj',
  'pdf', 'woff', 'woff2', 'ttf', 'otf', 'mp3', 'wav', 'mp4', 'avi', 'class', 'jar', 'lib', 'eep', 'map'
])
export const hasBinaryExt = (name: string): boolean => {
  const i = name.lastIndexOf('.')
  return i > 0 && BINARY_EXT.has(name.slice(i + 1).toLowerCase())
}

/** Пропускаемые при обходе имена: скрытые (с точки) и служебные папки. */
const SKIP_DIRS = new Set(['node_modules', 'build', 'out', 'dist'])
export const skipEntry = (name: string, isDir: boolean): boolean => name.startsWith('.') || (isDir && SKIP_DIRS.has(name.toLowerCase())) || name === 'Thumbs.db'

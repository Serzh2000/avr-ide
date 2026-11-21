// Разбор контекста по тексту перед курсором (для дополнения, подсказок и перехода). Чистые функции без Monaco.

/** Заменяет комментарии и содержимое строк пробелами (длина и переводы строк сохраняются). */
export function maskCode(text: string): string {
  const out: string[] = []
  const n = text.length
  let i = 0
  while (i < n) {
    const c = text[i]
    if (c === '/' && text[i + 1] === '*') {
      const e = text.indexOf('*/', i + 2)
      const stop = e < 0 ? n : e + 2
      out.push(text.slice(i, stop).replace(/[^\n]/g, ' '))
      i = stop
    } else if (c === '/' && text[i + 1] === '/') {
      let e = text.indexOf('\n', i)
      if (e < 0) e = n
      out.push(' '.repeat(e - i))
      i = e
    } else if (c === '"' || c === "'") {
      let j = i + 1
      while (j < n && text[j] !== c && text[j] !== '\n') { if (text[j] === '\\') j++; j++ }
      const stop = Math.min(j + 1, n)
      out.push(c + ' '.repeat(Math.max(0, stop - i - 2)) + (stop - i >= 2 ? c : ''))
      i = stop
    } else { out.push(c); i++ }
  }
  return out.join('')
}

/** Где находится конец текста: в коде, комментарии или строковом литерале. */
export function cursorState(text: string): 'code' | 'comment' | 'string' {
  const n = text.length
  let i = text.length > 80000 ? text.length - 80000 : 0
  while (i < n) {
    const c = text[i]
    if (c === '/' && text[i + 1] === '*') {
      const e = text.indexOf('*/', i + 2)
      if (e < 0) return 'comment'
      i = e + 2
    } else if (c === '/' && text[i + 1] === '/') {
      const e = text.indexOf('\n', i)
      if (e < 0) return 'comment'
      i = e
    } else if (c === '"' || c === "'") {
      let j = i + 1
      while (j < n && text[j] !== c && text[j] !== '\n') {
        if (text[j] === '\\') j++
        j++
      }
      if (j >= n) return 'string'
      i = j + 1
    } else i++
  }
  return 'code'
}

export type CompletionContext =
  | { kind: 'none' }
  | { kind: 'include'; quote: '<' | '"'; prefix: string }
  | { kind: 'member'; chain: string[]; op: '->' | '.'; prefix: string }
  | { kind: 'plain'; prefix: string; reg?: { chain: string[]; reg: string } }

/** Контекст дополнения. `before` — весь текст от начала файла (или хвост) до курсора. */
export function completionContext(before: string): CompletionContext {
  const lineStart = before.lastIndexOf('\n') + 1
  const line = before.slice(lineStart)
  const inc = /^\s*#\s*include\s*([<"])([^>"]*)$/.exec(line)
  if (inc) return { kind: 'include', quote: inc[1] as '<' | '"', prefix: inc[2] }
  // в комментарии или строке подсказок нет
  if (cursorState(before) !== 'code') return { kind: 'none' }
  if (/^\s*#/.test(line) && !/^\s*#\s*(?:if|elif|define|undef|ifdef|ifndef)\b/.test(line)) return { kind: 'none' }
  const tail = before.length > 6000 ? before.slice(-6000) : before
  const masked = maskCode(tail)
  const cut = Math.min(tail.length, line.length)
  const maskTail = masked.slice(-cut)
  const idPrefix = /[A-Za-z_$][\w$]*$/.exec(maskTail)?.[0] ?? ''
  const mm = /((?:[A-Za-z_]\w*(?:\[[^\]\n]*\])*\s*(?:->|\.)\s*)*[A-Za-z_]\w*(?:\[[^\]\n]*\])*)\s*(->|\.)\s*([A-Za-z_]\w*)?$/.exec(maskTail)
  if (mm) {
    const chain = (mm[1] + mm[2]).split(/->|\./).map((x) => x.replace(/\[[^\]]*\]/g, '').trim()).filter(Boolean)
    // «1.5» и «x.» после числа — не доступ к члену
    if (chain.length && !/^\d/.test(chain[0])) return { kind: 'member', chain, op: mm[2] as '->' | '.', prefix: mm[3] ?? '' }
  }
  // «регистр»: в операторе уже был «ПЕРИФЕРИЯ->РЕГИСТР», дальше набирается значение
  const stmtStart = Math.max(masked.lastIndexOf(';'), masked.lastIndexOf('{'), masked.lastIndexOf('}'))
  const stmt = masked.slice(stmtStart + 1)
  const reg = /((?:[A-Za-z_]\w*\s*(?:->|\.)\s*)*[A-Za-z_]\w*)\s*(->|\.)\s*([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*(?:[|&^+\-]?=|[|&^]|<<|>>)/.exec(stmt)
  if (reg && idPrefix.length < stmt.length) {
    const chain = (reg[1] + reg[2]).split(/->|\./).map((x) => x.trim()).filter(Boolean)
    return { kind: 'plain', prefix: idPrefix, reg: { chain, reg: reg[3] } }
  }
  return { kind: 'plain', prefix: idPrefix }
}

/** Слово под курсором и контекст (доступ к члену): для hover и перехода. */
export interface WordCtx { word: string; start: number; end: number; chain?: string[] }

export function wordContext(line: string, col0: number): WordCtx | null {
  // col0: позиция курсора (0-based) внутри строки
  let s = Math.min(col0, line.length)
  let e = s
  while (s > 0 && /[\w$]/.test(line[s - 1])) s--
  while (e < line.length && /[\w$]/.test(line[e])) e++
  if (s === e) return null
  const word = line.slice(s, e)
  if (/^\d/.test(word)) return null
  // цепочка слева: «a.b->» перед словом
  const left = line.slice(0, s)
  const m = /((?:[A-Za-z_]\w*(?:\[[^\]]*\])*\s*(?:->|\.)\s*)*[A-Za-z_]\w*(?:\[[^\]]*\])*)\s*(->|\.)\s*$/.exec(left)
  if (m) {
    const chain = (m[1] + m[2]).split(/->|\./).map((x) => x.replace(/\[[^\]]*\]/g, '').trim()).filter(Boolean)
    return { word, start: s, end: e, chain }
  }
  return { word, start: s, end: e }
}

/** Вызов функции под курсором: имя функции и номер аргумента (для подсказки параметров). */
export function callContext(before: string): { name: string; arg: number } | null {
  const masked = maskCode(before.length > 4000 ? before.slice(-4000) : before)
  let depth = 0
  let arg = 0
  for (let i = masked.length - 1; i >= 0; i--) {
    const c = masked[i]
    if (c === ')' || c === ']' || c === '}') depth++
    else if (c === '(' || c === '[' || c === '{') {
      if (depth === 0) {
        if (c !== '(') return null
        const m = /([A-Za-z_]\w*)\s*$/.exec(masked.slice(0, i))
        if (!m || /^(if|for|while|switch|return|sizeof)$/.test(m[1])) return null
        return { name: m[1], arg }
      }
      depth--
    } else if (c === ',' && depth === 0) arg++
    else if (c === ';' && depth === 0) return null
  }
  return null
}

// Устойчивый (не идеальный) разбор заголовков C/C++ для подсказок. Чистые функции, без зависимостей.
// Схема: лексер (токены + комментарии + #define + #include, брейсы сопоставляются с учётом #if/#else) →
// разбор областей (пространства имён, классы, перечисления, функции, переменные, typedef) по «операторам».
import type { LibParam, LibSymbol, LibSymbolKind } from './types'

export interface ParseOptions {
  /** Путь заголовка относительно папки библиотеки (попадёт в LibSymbol.header). */
  header: string
  /** Больше — разбираем только начало файла (по умолчанию 700 КБ). */
  maxBytes?: number
  /** Бюджет времени на файл, мс (по умолчанию 1500). */
  maxMs?: number
  /** Максимум символов с файла (по умолчанию 6000). */
  maxSymbols?: number
}

export interface IncludeRef {
  name: string
  angle: boolean
}

export interface ParseResult {
  symbols: LibSymbol[]
  includes: IncludeRef[]
  warnings: string[]
}

// ---------------------------------------------------------------------------------------------
// Лексер
// ---------------------------------------------------------------------------------------------

interface Tok {
  /** i — идентификатор, n — число, s — строка/символ, p — пунктуация. */
  t: 'i' | 'n' | 's' | 'p'
  v: string
  line: number
  /** Перед токеном были пробелы/перевод строки/комментарий. */
  sp: boolean
}

interface Comment {
  startLine: number
  endLine: number
  /** Очищенные строки текста. */
  lines: string[]
  trailing: boolean
  doxy: boolean
}

interface Lexed {
  toks: Tok[]
  /** Индекс закрывающей `}` для `{` (или конец ветки #if при несбалансированности); -1 — нет. */
  bodyEnd: number[]
  /** Индекс, с которого продолжать после блока. */
  bodyAfter: number[]
  leadByEnd: Map<number, Comment>
  trailByLine: Map<number, Comment>
  defines: DefineRec[]
  includes: IncludeRef[]
}

interface DefineRec {
  name: string
  params?: string[]
  value: string
  line: number
  trailingDoc?: string
}

function isIdStart(c: number): boolean {
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 36 || c > 127
}
function isIdPart(c: number): boolean {
  return isIdStart(c) || (c >= 48 && c <= 57)
}
function isDigit(c: number): boolean {
  return c >= 48 && c <= 57
}

function cleanCommentLines(raw: string, block: boolean): string[] {
  let lines: string[]
  if (block) {
    const body = raw.replace(/^\/\*[*!]?<?/, '').replace(/\*\/$/, '')
    lines = body.split(/\r?\n/).map((l) => l.replace(/^\s*\*+(?!\/)\s?/, '').replace(/^\s+/, ''))
  } else {
    lines = raw.split(/\r?\n/).map((l) => l.replace(/^\s*\/\/[/!]?<?\s?/, ''))
  }
  return lines.map((l) => l.replace(/\s+$/, ''))
}

function lex(src: string, deadline: number): Lexed {
  const toks: Tok[] = []
  const bodyEnd: number[] = []
  const bodyAfter: number[] = []
  const leadByEnd = new Map<number, Comment>()
  const trailByLine = new Map<number, Comment>()
  const defines: DefineRec[] = []
  const includes: IncludeRef[] = []
  const n = src.length
  const braceStack: number[] = []
  const condStack: { snap: number }[] = []
  let line = 1
  let i = 0
  let lineHasCode = false
  let space = false
  let lastLineComment: Comment | null = null

  const push = (t: Tok['t'], v: string): void => {
    toks.push({ t, v, line, sp: space })
    bodyEnd.push(-1)
    bodyAfter.push(-1)
    space = false
    lineHasCode = true
  }
  const addComment = (c: Comment): void => {
    if (c.trailing) trailByLine.set(c.startLine, c)
    else leadByEnd.set(c.endLine, c)
  }

  while (i < n) {
    if ((toks.length & 1023) === 0 && Date.now() > deadline) break
    const ch = src.charCodeAt(i)
    // переводы строк
    if (ch === 10) {
      line++
      i++
      lineHasCode = false
      space = true
      continue
    }
    if (ch === 32 || ch === 9 || ch === 13 || ch === 12 || ch === 11) {
      i++
      space = true
      continue
    }
    // комментарии
    if (ch === 47 /* / */) {
      const nx = src.charCodeAt(i + 1)
      if (nx === 47) {
        let j = i
        while (j < n && src.charCodeAt(j) !== 10) j++
        const raw = src.slice(i, j)
        const doxy = /^\/\/[/!]/.test(raw)
        const trailing = lineHasCode
        const lines = cleanCommentLines(raw, false)
        const prev = lastLineComment
        if (!trailing && prev && !prev.trailing && prev.endLine === line - 1 && prev.doxy === doxy) {
          prev.lines.push(...lines)
          leadByEnd.delete(prev.endLine)
          prev.endLine = line
          leadByEnd.set(line, prev)
        } else {
          const c: Comment = { startLine: line, endLine: line, lines, trailing, doxy }
          addComment(c)
          lastLineComment = trailing ? null : c
        }
        i = j
        space = true
        continue
      }
      if (nx === 42) {
        let j = src.indexOf('*/', i + 2)
        j = j < 0 ? n : j + 2
        const raw = src.slice(i, j)
        const startLine = line
        let nl = 0
        for (let k = 0; k < raw.length; k++) if (raw.charCodeAt(k) === 10) nl++
        line += nl
        const c: Comment = { startLine, endLine: line, lines: cleanCommentLines(raw, true), trailing: lineHasCode, doxy: /^\/\*[*!]/.test(raw) }
        addComment(c)
        lastLineComment = null
        i = j
        space = true
        continue
      }
    }
    // директивы препроцессора
    if (ch === 35 /* # */ && !lineHasCode) {
      let j = i
      let logical = ''
      let seg = j
      let startLine = line
      for (;;) {
        while (j < n && src.charCodeAt(j) !== 10) j++
        if (j > seg && src.charCodeAt(j - 1) === 92 /* \ */ && j < n) {
          logical += src.slice(seg, j - 1) + ' '
          j++
          line++
          seg = j
          continue
        }
        logical += src.slice(seg, j)
        // блочный комментарий, не закрытый в этой строке
        const lastOpen = logical.lastIndexOf('/*')
        if (lastOpen >= 0 && logical.indexOf('*/', lastOpen) < 0 && j < n) {
          const close = src.indexOf('*/', j)
          const endAt = close < 0 ? n : close + 2
          for (let k = j; k < endAt; k++) if (src.charCodeAt(k) === 10) line++
          logical += ' '
          j = endAt
          seg = j
          continue
        }
        break
      }
      i = j
      lastLineComment = null
      space = true
      // трейлинг-комментарий в директиве
      let trailingText: string | undefined
      let body = logical.replace(/\/\*+<?(.*?)\*\//g, (_m, c: string) => {
        if (!trailingText && c.trim()) trailingText = c.trim()
        return ' '
      })
      const sl = body.indexOf('//')
      if (sl >= 0) {
        trailingText = body.slice(sl).replace(/^\/\/[/!]?<?\s?/, '').trim()
        body = body.slice(0, sl)
      }
      const dm = /^#\s*(\w+)\s*(.*)$/.exec(body.trim())
      const dir = dm ? dm[1] : ''
      const rest = dm ? dm[2] : ''
      if (dir === 'define') {
        const m = /^([A-Za-z_]\w*)(\(([^)]*)\))?\s*(.*)$/.exec(rest)
        if (m) {
          defines.push({
            name: m[1],
            params: m[2] ? m[3].split(',').map((s) => s.trim()).filter(Boolean) : undefined,
            value: m[4].trim(),
            line: startLine,
            trailingDoc: trailingText
          })
        }
      } else if (dir === 'include') {
        const m = /^[<"]([^>"]+)[>"]/.exec(rest)
        if (m) includes.push({ name: m[1].trim(), angle: rest.startsWith('<') })
      } else if (dir === 'if' || dir === 'ifdef' || dir === 'ifndef') {
        condStack.push({ snap: braceStack.length })
        if (dir === 'if' && /^(0|false)$/.test(rest.trim())) {
          // #if 0 — пропускаем до соответствующих #else/#elif/#endif
          let nest = 0
          let p = i
          let ln = line
          while (p < n) {
            if (src.charCodeAt(p) === 10) {
              ln++
              p++
              const m = /^[ \t]*#[ \t]*(\w+)/.exec(src.slice(p, p + 24))
              if (m) {
                const d = m[1]
                if (d === 'if' || d === 'ifdef' || d === 'ifndef') nest++
                else if (d === 'endif') {
                  if (nest === 0) break
                  nest--
                } else if ((d === 'else' || d === 'elif') && nest === 0) break
              }
              continue
            }
            p++
          }
          line = ln
          i = p
        }
      } else if (dir === 'else' || dir === 'elif') {
        const top = condStack[condStack.length - 1]
        if (top) {
          while (braceStack.length > top.snap) {
            const o = braceStack.pop()!
            bodyEnd[o] = toks.length
            bodyAfter[o] = toks.length
          }
        }
      } else if (dir === 'endif') {
        condStack.pop()
      }
      continue
    }
    // строки и символы
    if (ch === 34 /* " */) {
      let j = i + 1
      while (j < n) {
        const c = src.charCodeAt(j)
        if (c === 92) j += 2
        else if (c === 34 || c === 10) break
        else j++
      }
      push('s', src.slice(i, Math.min(j + 1, n)))
      i = Math.min(j + 1, n)
      continue
    }
    if (ch === 39 /* ' */) {
      const m = /^'(?:\\.[^']{0,6}|[^\\'\n])'/.exec(src.slice(i, i + 10))
      if (m) {
        push('s', m[0])
        i += m[0].length
        continue
      }
      i++
      space = true
      continue
    }
    if (isIdStart(ch)) {
      let j = i + 1
      while (j < n && isIdPart(src.charCodeAt(j))) j++
      const word = src.slice(i, j)
      // префиксы строк: L"..", u8"..", R"(..)"
      if (src.charCodeAt(j) === 34 && /^(L|u|U|u8)$/.test(word)) {
        i = j
        continue
      }
      push('i', word)
      i = j
      continue
    }
    if (isDigit(ch) || (ch === 46 && isDigit(src.charCodeAt(i + 1)))) {
      let j = i + 1
      const hex = ch === 48 && (src.charCodeAt(i + 1) | 32) === 120
      while (j < n) {
        const c = src.charCodeAt(j)
        if (isIdPart(c) || c === 46 || c === 39) j++
        else if ((c === 43 || c === 45) && !hex && /[eEpP]/.test(src[j - 1])) j++
        else break
      }
      push('n', src.slice(i, j))
      i = j
      continue
    }
    // пунктуация
    const two = src.substr(i, 2)
    if (two === '::' || two === '->') {
      push('p', two)
      i += 2
      continue
    }
    if (ch === 46 && src.substr(i, 3) === '...') {
      push('p', '...')
      i += 3
      continue
    }
    const c1 = src[i]
    if (c1 === '{') {
      braceStack.push(toks.length)
      push('p', c1)
    } else if (c1 === '}') {
      const o = braceStack.pop()
      if (o !== undefined) {
        bodyEnd[o] = toks.length
        bodyAfter[o] = toks.length + 1
      }
      push('p', c1)
    } else push('p', c1)
    i++
  }
  // незакрытые `{`: до конца файла
  for (const o of braceStack) {
    bodyEnd[o] = toks.length
    bodyAfter[o] = toks.length
  }
  return { toks, bodyEnd, bodyAfter, leadByEnd, trailByLine, defines, includes }
}

// ---------------------------------------------------------------------------------------------
// Документация
// ---------------------------------------------------------------------------------------------

const LICENSE_RE = /copyright|licen[sc]e|permission is hereby|all rights reserved|SPDX-|redistribut|warranty|\(c\)\s*\d{4}/i

/** Превращает строки комментария в краткий текст (Doxygen-теги разбираются). */
export function formatDoc(rawLines: string[]): string | undefined {
  // теги в одной строке с текстом (/** @brief A. @param x B */) — разносим по строкам
  const lines = rawLines.flatMap((l) => l.replace(/\s+(?=[@\\](?:brief|param|returns?|retval|note|warning)\b)/g, '\n').split('\n'))
  const brief: string[] = []
  const params: [string, string][] = []
  const notes: string[] = []
  let returns = ''
  type Cur = 'brief' | 'param' | 'return' | 'note' | 'skip'
  let cur: Cur = 'brief'
  let blankAfterBrief = false
  const joined = lines.join('\n')
  if (LICENSE_RE.test(joined) && joined.length > 60) return undefined
  for (const rawLine of lines) {
    const l = rawLine.trim()
    if (!l) {
      if (brief.length) blankAfterBrief = true
      if (cur !== 'brief') cur = 'brief'
      continue
    }
    if (/^[-=*#_/\\~+.\s]+$/.test(l)) continue
    const tm = /^[@\\](brief|details|param(?:\[[^\]]*\])?|tparam|returns?|retval|result|note|warning|attention|remark|deprecated|todo|see|sa|file|ingroup|defgroup|addtogroup|author|date|version|since|class|struct|fn|name|code|endcode|copyright|example|\{|\}|par)\b\s*(.*)$/i.exec(l)
    if (tm) {
      const tag = tm[1].toLowerCase()
      const text = tm[2]
      if (tag === 'brief' || tag === 'details' || tag === 'par') {
        cur = 'brief'
        if (text) brief.push(text)
      } else if (tag.startsWith('param')) {
        const pm = /^(\w+)\s*(.*)$/.exec(text)
        params.push(pm ? [pm[1], pm[2]] : [text, ''])
        cur = 'param'
      } else if (tag === 'tparam') {
        cur = 'skip'
      } else if (tag === 'return' || tag === 'returns' || tag === 'retval' || tag === 'result') {
        returns += (returns ? '; ' : '') + text
        cur = 'return'
      } else if (tag === 'note' || tag === 'warning' || tag === 'attention' || tag === 'remark' || tag === 'deprecated') {
        notes.push((tag === 'warning' || tag === 'attention' ? 'Внимание: ' : tag === 'deprecated' ? 'Устарело: ' : 'Примечание: ') + text)
        cur = 'note'
      } else cur = 'skip'
      continue
    }
    if (cur === 'param' && params.length) params[params.length - 1][1] += ' ' + l
    else if (cur === 'return') returns += ' ' + l
    else if (cur === 'note' && notes.length) notes[notes.length - 1] += ' ' + l
    else if (cur === 'brief') {
      if (blankAfterBrief) brief.push('\n' + l)
      else brief.push(l)
      blankAfterBrief = false
    }
  }
  let text = brief.join(' ').replace(/ \n/g, '\n').trim()
  if (text.length > 400) text = text.slice(0, 397).replace(/\s+\S*$/, '') + '…'
  const parts: string[] = []
  if (text) parts.push(text)
  for (const [n, d] of params) if (n) parts.push(`${n}${d.trim() ? ' — ' + d.trim().slice(0, 140) : ''}`)
  if (returns.trim()) parts.push('Возвращает: ' + returns.trim().slice(0, 160))
  for (const x of notes.slice(0, 2)) parts.push(x.slice(0, 200))
  let out = parts.join('\n').trim()
  if (!/[\p{L}]/u.test(out)) return undefined
  // закомментированный код — не документация
  if (parts.length === 1 && /[;{}]\s*$/.test(out) && /\(/.test(out) && !/\s/.test(out.split('(')[0].trim().split(' ').slice(-1)[0] ?? '#')) return undefined
  if (out.length > 800) out = out.slice(0, 797) + '…'
  return out
}

// ---------------------------------------------------------------------------------------------
// Разбор объявлений
// ---------------------------------------------------------------------------------------------

const MODIFIERS = new Set(['static', 'inline', 'virtual', 'constexpr', 'consteval', 'constinit', 'explicit', 'extern', 'friend', 'typedef', 'mutable', 'register', 'thread_local', '__inline', '__inline__', '__forceinline', '_Noreturn', '__extension__'])
const ATTR_WORDS = new Set([
  'IRAM_ATTR', 'ICACHE_RAM_ATTR', 'ICACHE_FLASH_ATTR', 'ICACHE_RODATA_ATTR', 'DRAM_ATTR', 'RTC_DATA_ATTR', 'RTC_NOINIT_ATTR', 'RTC_IRAM_ATTR', 'EXT_RAM_ATTR', 'PROGMEM', 'FASTRUN', 'FLASHMEM', 'DMAMEM', 'FASTRUN',
  '__STATIC_INLINE', '_ALWAYS_INLINE', 'ALWAYS_INLINE', 'NOINLINE', 'INLINE', '__attribute__', '__declspec', 'alignas', '__restrict', '__restrict__', 'restrict', 'noexcept', 'override', 'final', 'volatile_', 'NEVER_INLINE', 'FORCE_INLINE', '__unused', 'UNUSED', 'WEAK', '__weak'
])
const ATTR_SUFFIX_RE = /^_*[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_(?:API|ATTR|EXPORT|PUBLIC|DEPRECATED|INLINE|NOINLINE|IMPORT|DLL)$/
const NOT_DECL = new Set(['return', 'else', 'goto', 'delete', 'new', 'case', 'throw', 'break', 'continue', 'do', 'if', 'while', 'for', 'switch', 'using', 'namespace', 'static_assert', 'sizeof', 'typeof', 'default', 'try', 'catch', 'asm'])
const KEYWORD_NAMES = new Set([...NOT_DECL, 'class', 'struct', 'union', 'enum', 'public', 'private', 'protected', 'template', 'typename', 'operator', 'this', 'nullptr', 'true', 'false'])
const TYPE_WORDS = new Set(['unsigned', 'signed', 'long', 'short', 'int', 'char', 'double', 'float', 'bool', 'void', 'auto', 'const', 'volatile', 'wchar_t', 'char16_t', 'char32_t'])
const OPEN_BR = new Set(['(', '[', '{'])
const CLOSE_BR = new Set([')', ']', '}'])

function isAttrIdent(v: string): boolean {
  return ATTR_WORDS.has(v) || ATTR_SUFFIX_RE.test(v)
}

/** Склеивает токены, сохраняя исходные пробелы (комментарии выброшены). */
function joinToks(toks: Tok[], from = 0, to = toks.length): string {
  let s = ''
  for (let k = from; k < to; k++) {
    const t = toks[k]
    if (k > from && (t.sp || toks[k - 1].v === ',')) s += ' '
    s += t.v
  }
  return s
}

function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

/** Индекс закрывающей скобки для открывающей в toks[at] (`(`/`[`/`{`/`<` не поддерживается); -1 если нет. */
function matchClose(toks: Tok[], at: number): number {
  const open = toks[at].v
  const close = open === '(' ? ')' : open === '[' ? ']' : '}'
  let d = 0
  for (let k = at; k < toks.length; k++) {
    const v = toks[k].v
    if (v === open) d++
    else if (v === close) {
      d--
      if (d === 0) return k
    }
  }
  return -1
}

/** Закрывающая угловая скобка для `<` в toks[at] (ориентируясь на скобки); -1 если не нашли. */
function matchAngle(toks: Tok[], at: number): number {
  let d = 0
  let pd = 0
  for (let k = at; k < toks.length; k++) {
    const v = toks[k].v
    if (v === '(' || v === '[' || v === '{') pd++
    else if (v === ')' || v === ']' || v === '}') pd--
    else if (pd === 0 && v === '<') d++
    else if (pd === 0 && v === '>') {
      d--
      if (d === 0) return k
    } else if (pd === 0 && v === ';' && k > at) return -1
  }
  return -1
}

/** Делит токены по запятым верхнего уровня (скобки и шаблонные <> учитываются). */
function splitTop(toks: Tok[]): Tok[][] {
  const out: Tok[][] = []
  let cur: Tok[] = []
  let pd = 0
  let ad = 0
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]
    const v = t.v
    if (t.t === 'p') {
      if (OPEN_BR.has(v)) pd++
      else if (CLOSE_BR.has(v)) pd = Math.max(0, pd - 1)
      else if (v === '<' && pd === 0 && k > 0 && toks[k - 1].t === 'i' && toks[k - 1].v !== 'operator') ad++
      else if (v === '>' && pd === 0 && ad > 0) ad--
      else if (v === ',' && pd === 0 && ad === 0) {
        out.push(cur)
        cur = []
        continue
      }
    }
    cur.push(t)
  }
  if (cur.length) out.push(cur)
  return out
}

/** Первый `=` верхнего уровня (не внутри скобок/шаблона). */
function topEq(toks: Tok[]): number {
  let pd = 0
  let ad = 0
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]
    if (t.t !== 'p') continue
    const v = t.v
    if (OPEN_BR.has(v)) pd++
    else if (CLOSE_BR.has(v)) pd = Math.max(0, pd - 1)
    else if (v === '<' && pd === 0 && k > 0 && toks[k - 1].t === 'i' && toks[k - 1].v !== 'operator') ad++
    else if (v === '>' && pd === 0 && ad > 0) ad--
    else if (v === '=' && pd === 0 && ad === 0) return k
  }
  return -1
}

/** Первая `(` верхнего уровня до `=`; -1 если нет. */
function findTopParen(toks: Tok[]): number {
  let ad = 0
  let pd = 0
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]
    if (t.t !== 'p') continue
    const v = t.v
    if (v === '(') {
      if (pd === 0 && ad === 0) return k
      pd++
    } else if (v === '[' || v === '{') pd++
    else if (v === ')' || v === ']' || v === '}') pd = Math.max(0, pd - 1)
    else if (v === '<' && pd === 0 && k > 0 && toks[k - 1].t === 'i' && toks[k - 1].v !== 'operator') ad++
    else if (v === '>' && pd === 0 && ad > 0) ad--
    else if (v === '=' && pd === 0 && ad === 0) return -1
  }
  return -1
}

interface Flags {
  static: boolean
  virtual: boolean
  constexpr: boolean
  typedef: boolean
  friend: boolean
  extern: boolean
  explicit: boolean
}

interface Head {
  toks: Tok[]
  flags: Flags
  template?: string
}

/** Убирает шаблонный префикс, модификаторы, атрибуты и макросы-обёртки; запоминает флаги. */
function normalizeHead(raw: Tok[]): Head {
  const flags: Flags = { static: false, virtual: false, constexpr: false, typedef: false, friend: false, extern: false, explicit: false }
  let k = 0
  let template: string | undefined
  // template <...>
  while (k < raw.length && raw[k].v === 'template' && raw[k + 1]?.v === '<') {
    const e = matchAngle(raw, k + 1)
    if (e < 0) break
    template = (template ? template + ' ' : '') + 'template ' + joinToks(raw, k + 1, e + 1)
    k = e + 1
  }
  // ИМЯ_МАКРОСА(...) перед объявлением (DEPRECATED("x") void f();)
  if (raw[k] && raw[k].t === 'i' && /^[A-Z][A-Z0-9_]{2,}$/.test(raw[k].v) && raw[k + 1]?.v === '(' && !isAttrIdent(raw[k].v)) {
    const e = matchClose(raw, k + 1)
    if (e > 0 && raw.length - e > 2 && raw.slice(e + 1).some((t) => t.v === '(' || t.v === '{' || t.t === 'i')) k = e + 1
  }
  const out: Tok[] = []
  for (; k < raw.length; k++) {
    const t = raw[k]
    if (t.t === 'i') {
      if (MODIFIERS.has(t.v)) {
        if (t.v === 'static') flags.static = true
        else if (t.v === 'virtual') flags.virtual = true
        else if (t.v === 'constexpr' || t.v === 'consteval' || t.v === 'constinit') flags.constexpr = true
        else if (t.v === 'typedef') flags.typedef = true
        else if (t.v === 'friend') flags.friend = true
        else if (t.v === 'extern') {
          flags.extern = true
          if (raw[k + 1]?.t === 's') k++
        } else if (t.v === 'explicit') flags.explicit = true
        continue
      }
      if (isAttrIdent(t.v)) {
        if (raw[k + 1]?.v === '(') {
          const e = matchClose(raw, k + 1)
          if (e > 0) k = e
        }
        continue
      }
    } else if (t.v === '[' && raw[k + 1]?.v === '[') {
      const e = matchClose(raw, k)
      if (e > 0) {
        k = e
        continue
      }
    }
    out.push(t)
  }
  return { toks: out, flags, template }
}

const SIG_MAX = 420
function isPrefixMacro(a: Tok, b: Tok): boolean {
  if (a.t !== 'i' || b.t !== 'i' || !/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(a.v)) return false
  return PREFIX_FOLLOW.has(b.v) || /(?:NAMESPACE|_BEGIN|_END|_DECLS)$/.test(a.v)
}
const PREFIX_FOLLOW = new Set(['class', 'struct', 'template', 'enum', 'union', 'using', 'typedef', 'namespace', 'static', 'inline', 'extern', 'constexpr', 'virtual', 'friend'])

interface Ctx {
  kind: 'global' | 'ns' | 'class'
  /** Полное имя (с вложенностью через ::) или undefined для глобальной области. */
  qname?: string
  /** Простое имя класса. */
  name?: string
  access: 'public' | 'protected' | 'private'
  isStruct?: boolean
}

class Parser {
  readonly symbols: LibSymbol[] = []
  readonly warnings: string[] = []
  private seen = new Set<string>()
  private aborted = false
  private stmtCount = 0
  private errors = 0
  private readonly lx: Lexed
  private readonly header: string
  private readonly deadline: number
  private readonly maxSymbols: number
  constructor(lx: Lexed, header: string, deadline: number, maxSymbols: number) {
    this.lx = lx
    this.header = header
    this.deadline = deadline
    this.maxSymbols = maxSymbols
  }

  private doc(startLine: number, endLine: number, preferTrailing = false): string | undefined {
    if (preferTrailing) {
      const tr0 = this.lx.trailByLine.get(endLine)
      const d0 = tr0 ? formatDoc(tr0.lines) : undefined
      if (d0) return d0
    }
    const lead = this.lx.leadByEnd.get(startLine - 1)
    if (lead) {
      const d = formatDoc(lead.lines)
      if (d) return d
    }
    const tr = this.lx.trailByLine.get(endLine)
    if (tr) return formatDoc(tr.lines)
    return undefined
  }

  private add(sym: LibSymbol): void {
    if (this.symbols.length >= this.maxSymbols) {
      if (!this.aborted) {
        this.aborted = true
        this.warnings.push(`${this.header}: достигнут лимит символов (${this.maxSymbols}), остальное пропущено`)
      }
      return
    }
    const key = `${sym.kind}|${sym.owner ?? ''}|${sym.signature}`
    if (this.seen.has(key)) return
    this.seen.add(key)
    this.symbols.push(sym)
  }

  run(): void {
    const t = this.lx.toks
    this.parseRange(0, t.length, { kind: 'global', access: 'public' }, 0)
    for (const d of this.lx.defines) this.addDefine(d)
    if (this.errors > 0) this.warnings.push(`${this.header}: не удалось разобрать ${this.errors} объявлений`)
  }

  private addDefine(d: DefineRec): void {
    if (d.name.startsWith('_') && !d.params) return
    // include guard
    if (!d.value && !d.params && (/_H(PP|XX|H)?_*$/i.test(d.name) || /^_+[A-Z0-9_]+_*$/.test(d.name) || /INCLUDED$|_GUARD$/.test(d.name))) return
    let value = d.value.replace(/\s+/g, ' ').trim()
    if (value.length > 140) value = value.slice(0, 137) + '…'
    const lead = this.lx.leadByEnd.get(d.line - 1)
    const doc = (d.trailingDoc ? formatDoc([d.trailingDoc]) : undefined) ?? (lead ? formatDoc(lead.lines) : undefined)
    if (!value && !doc && !d.params) return
    const params: LibParam[] | undefined = d.params ? d.params.map((p) => ({ type: '', name: p })) : undefined
    this.add({
      kind: 'macro',
      name: d.name,
      signature: `#define ${d.name}${d.params ? '(' + d.params.join(', ') + ')' : ''}${value ? ' ' + value : ''}`,
      params,
      doc,
      header: this.header,
      line: d.line,
      access: 'public'
    })
  }

  private tick(): boolean {
    if (this.aborted) return false
    if ((++this.stmtCount & 127) === 0 && Date.now() > this.deadline) {
      this.aborted = true
      this.warnings.push(`${this.header}: превышен лимит времени разбора, результат неполный`)
      return false
    }
    return true
  }

  private parseRange(from: number, to: number, ctx: Ctx, depth: number): void {
    const t = this.lx.toks
    let i = from
    while (i < to && this.tick()) {
      const tk = t[i]
      if (tk.v === ';' || tk.v === '}') {
        i++
        continue
      }
      if (ctx.kind === 'class' && tk.t === 'i' && (tk.v === 'public' || tk.v === 'private' || tk.v === 'protected')) {
        let k = i + 1
        while (k < to && t[k].t === 'i' && t[k].v !== ':') k++ // «public slots:»
        if (t[k]?.v === ':') {
          ctx.access = tk.v as Ctx['access']
          i = k + 1
          continue
        }
      }
      if (ctx.kind === 'class' && tk.t === 'i' && (tk.v === 'signals' || tk.v === 'slots' || tk.v === 'Q_SIGNALS' || tk.v === 'Q_SLOTS') && t[i + 1]?.v === ':') {
        i += 2
        continue
      }
      // конец «оператора»
      let j = i
      // шаблонный заголовок (и макросы-обёртки перед ним): `=` в аргументах по умолчанию — не инициализатор
      for (;;) {
        if (j < to - 1 && isPrefixMacro(t[j], t[j + 1])) {
          j++
          continue
        }
        if (j < to - 1 && t[j].v === 'template' && t[j + 1].v === '<') {
          const e = matchAngle(t, j + 1)
          if (e > 0 && e < to) {
            j = e + 1
            continue
          }
        }
        break
      }
      let pd = 0
      let sawEq = false
      let sawOp = false
      let term: ';' | '{' | 'end' = 'end'
      for (; j < to; j++) {
        const v = t[j].v
        const tt = t[j].t
        if (tt !== 'p') {
          if (tt === 'i' && v === 'operator' && pd === 0) sawOp = true
          continue
        }
        if (v === '(' || v === '[') pd++
        else if (v === ')' || v === ']') pd = Math.max(0, pd - 1)
        else if (v === '=' && pd === 0 && !sawOp) sawEq = true
        else if (v === '{') {
          if (pd > 0 || sawEq) {
            const after = this.lx.bodyAfter[j]
            j = Math.max(j, Math.min(after, to) - 1)
            continue
          }
          term = '{'
          break
        } else if (v === ';' && pd === 0) {
          term = ';'
          break
        } else if (v === '}' && pd === 0) break
      }
      const headEnd = j
      let next = headEnd + 1
      try {
        if (headEnd > i) next = this.statement(i, headEnd, term, to, ctx, depth)
        else if (term === '{') next = Math.min(this.lx.bodyAfter[headEnd], to)
      } catch {
        this.errors++
        next = Math.max(next, headEnd + 1)
      }
      i = Math.max(next, i + 1)
    }
  }

  /** Обрабатывает «оператор» [i, headEnd); возвращает индекс, с которого продолжать. */
  private statement(i: number, headEnd: number, term: ';' | '{' | 'end', to: number, ctx: Ctx, depth: number): number {
    const t = this.lx.toks
    // макросы-обёртки перед объявлением (ARDUINOJSON_BEGIN_PUBLIC_NAMESPACE class X; …)
    while (i < headEnd - 1 && isPrefixMacro(t[i], t[i + 1])) i++
    const raw = t.slice(i, headEnd)
    const startLine = raw[0].line
    const endLine = term === 'end' ? raw[raw.length - 1].line : t[headEnd].line
    const afterOf = (): number => Math.min(term === '{' ? this.lx.bodyAfter[headEnd] : headEnd + 1, to)
    const emit = ctx.access !== 'private'

    // using namespace / using X::y — пропускаем; using Alias = T — typedef
    if (raw[0].v === 'using') {
      if (raw[1]?.v === 'namespace' || raw.length < 4 || raw[2]?.v !== '=') return afterOf()
      if (emit && raw[1].t === 'i') {
        const rhs = joinToks(raw, 3)
        this.add({ kind: 'typedef', name: raw[1].v, owner: ctx.qname, signature: trunc(`using ${raw[1].v} = ${rhs}`, SIG_MAX), doc: this.doc(startLine, endLine), header: this.header, line: startLine, access: ctx.access })
      }
      return afterOf()
    }
    // template<...> using X = ...
    if (raw[0].v === 'namespace') {
      if (term !== '{') return afterOf()
      const names = raw.slice(1).filter((x) => x.t === 'i').map((x) => x.v)
      const qn = names.length ? (ctx.qname ? ctx.qname + '::' : '') + names.join('::') : ctx.qname
      if (depth < 12) this.parseRange(headEnd + 1, Math.min(this.lx.bodyEnd[headEnd], to), { kind: 'ns', qname: qn, access: 'public' }, depth + 1)
      return afterOf()
    }
    if (raw[0].v === 'inline' && raw[1]?.v === 'namespace' && term === '{') {
      const names = raw.slice(2).filter((x) => x.t === 'i').map((x) => x.v)
      const qn = names.length ? (ctx.qname ? ctx.qname + '::' : '') + names.join('::') : ctx.qname
      if (depth < 12) this.parseRange(headEnd + 1, Math.min(this.lx.bodyEnd[headEnd], to), { kind: 'ns', qname: qn, access: 'public' }, depth + 1)
      return afterOf()
    }
    if (raw[0].v === 'static_assert' || raw[0].v === 'friend') return afterOf()

    const head = normalizeHead(raw)
    const h = head.toks
    if (head.flags.friend) return afterOf()
    // extern "C" { … }
    if (term === '{' && (h.length === 0 || (h.length === 1 && h[0].t === 's')) && head.flags.extern) {
      if (depth < 12) this.parseRange(headEnd + 1, Math.min(this.lx.bodyEnd[headEnd], to), ctx, depth + 1)
      return afterOf()
    }
    if (h.length === 0) return afterOf()

    const first = h[0].v
    if (first === 'enum') return this.enumDecl(h, head, i, headEnd, term, to, ctx, startLine, endLine)
    if (first === 'class' || first === 'struct' || first === 'union') {
      if (term === '{') return this.classDecl(h, head, i, headEnd, to, ctx, depth, startLine, endLine)
      if (h.length <= 3 && !h.slice(1).some((x) => x.v === '*' || x.v === '&')) return afterOf() // forward declaration
    }
    if (NOT_DECL.has(first)) return term === '{' ? afterOf() : afterOf()

    let consumedBody = term === '{'
    if (term === '{') {
      // функция с телом, конструктор с init-списком, либо переменная с фигурной инициализацией
      if (findTopParen(h) < 0 && h.length >= 2 && emit) this.variableDecl(h, head, ctx, startLine, endLine)
      else if (emit) this.functionDecl(h, head, ctx, startLine, endLine)
      let next = this.lx.bodyAfter[headEnd]
      if (findTopParen(h) < 0) {
        // хвост до `;`
        let k = next
        while (k < to && t[k].v !== ';' && k - next < 12 && (t[k].t === 'i' || t[k].v === ',' || t[k].v === '*' || t[k].v === '&' || t[k].v === '[' || t[k].v === ']' || t[k].t === 'n')) k++
        if (t[k]?.v === ';' && k < to) next = k + 1
      }
      return Math.min(next, to)
    }
    if (!consumedBody && emit) {
      if (head.flags.typedef) this.typedefDecl(h, head, ctx, startLine, endLine)
      else if (findTopParen(h) >= 0) this.functionDecl(h, head, ctx, startLine, endLine)
      else this.variableDecl(h, head, ctx, startLine, endLine)
    }
    return afterOf()
  }

  // ---- typedef ----
  private typedefDecl(h: Tok[], head: Head, ctx: Ctx, startLine: number, endLine: number): void {
    // typedef void (*cb)(int);  typedef int (fn)(int);
    let name: string | undefined
    const p = findTopParen(h)
    if (p >= 0 && (h[p + 1]?.v === '*' || h[p + 1]?.v === '&')) {
      for (let k = p + 2; k < h.length; k++) if (h[k].t === 'i') { name = h[k].v; break }
    } else if (p > 0 && h[p - 1].t === 'i') name = h[p - 1].v
    else {
      for (let k = h.length - 1; k >= 0; k--) {
        if (h[k].t === 'i') {
          name = h[k].v
          break
        }
        if (h[k].v !== ']' && h[k].t !== 'n' && h[k].v !== '[') break
      }
    }
    if (!name || KEYWORD_NAMES.has(name)) return
    this.add({ kind: 'typedef', name, owner: ctx.qname, signature: trunc('typedef ' + joinToks(h), SIG_MAX), doc: this.doc(startLine, endLine), header: this.header, line: startLine, access: ctx.access })
  }

  // ---- функции / методы / конструкторы ----
  private looksLikeParams(params: Tok[], ctx: Ctx): boolean {
    if (params.length === 0) return true
    for (const p of splitTop(params)) {
      if (p.length === 0) return false
      if (p.length === 1 && p[0].v === '...') continue
      const eq = topEq(p)
      const decl = eq >= 0 ? p.slice(0, eq) : p
      if (decl.length === 0) return false
      const f = decl[0]
      if (f.t === 'n' || f.t === 's' || f.v === '&' || f.v === '-' || f.v === '!' || f.v === '(' || f.v === '{') return false
      if (decl.some((x) => x.t === 'n' || x.t === 's') && !decl.some((x) => x.v === '[' || x.v === '<')) return false
      if (decl.length === 1 && ctx.kind !== 'class' && /^[A-Z][A-Z0-9_]+$/.test(decl[0].v)) return false
    }
    return true
  }

  private functionDecl(h: Tok[], head: Head, ctx: Ctx, startLine: number, endLine: number): void {
    if (h.some((x) => x.v === 'operator' && x.t === 'i')) return
    const p = findTopParen(h)
    if (p <= 0) return
    // указатель на функцию: void (*cb)(int) — переменная
    if (h[p + 1]?.v === '*' || h[p + 1]?.v === '&') {
      if (head.flags.typedef) return this.typedefDecl(h, head, ctx, startLine, endLine)
      let name: string | undefined
      for (let k = p + 2; k < h.length; k++) if (h[k].t === 'i') { name = h[k].v; break }
      if (name && !KEYWORD_NAMES.has(name)) this.add({ kind: 'variable', name, owner: ctx.qname, signature: trunc(joinToks(h), SIG_MAX), doc: this.doc(startLine, endLine), header: this.header, line: startLine, isStatic: head.flags.static, access: ctx.access })
      return
    }
    const nameTok = h[p - 1]
    if (nameTok.t !== 'i' || KEYWORD_NAMES.has(nameTok.v)) return
    if (h[p - 2]?.v === '::' || h[p - 2]?.v === '~') return // определение вне класса / деструктор
    const name = nameTok.v
    const ret = h.slice(0, p - 1)
    const close = matchClose(h, p)
    const paramToks = h.slice(p + 1, close < 0 ? h.length : close)
    const after = close < 0 ? [] : h.slice(close + 1)
    if (after.some((x, k) => x.v === '=' && h[close + 1 + k + 1]?.v === 'delete')) return
    const isCtor = ret.length === 0
    if (isCtor) {
      if (!(ctx.kind === 'class' && name === ctx.name)) return
    } else {
      if (ret.some((x) => NOT_DECL.has(x.v) || x.v === '=' || x.v === '.' || x.v === '->')) return
      const last = ret[ret.length - 1]
      if (!(last.t === 'i' || last.v === '*' || last.v === '&' || last.v === '>' || last.v === ']')) return
    }
    if (!this.looksLikeParams(paramToks, ctx)) {
      // «DHT dht(2, DHT22);» — переменная с аргументами конструктора
      if (!isCtor && ctx.kind !== 'class') return this.variableDecl(h.slice(0, p), head, ctx, startLine, endLine)
      return
    }
    // хвост: const / -> T
    let isConst = false
    let trailingRet: string | undefined
    for (let k = 0; k < after.length; k++) {
      const v = after[k].v
      if (v === 'const') isConst = true
      else if (v === '->') trailingRet = joinToks(after, k + 1)
      else if (v === '=' || v === ':') break
    }
    const params = this.parseParams(paramToks)
    const retText = isCtor ? undefined : trailingRet && /^auto$/.test(joinToks(ret)) ? trailingRet : joinToks(ret)
    const paramsText = joinToks(paramToks)
    const sigHead = (head.template ? head.template + ' ' : '') + (head.flags.static ? 'static ' : '') + (head.flags.virtual ? 'virtual ' : '')
    const retSep = retText && !(/[*&]$/.test(retText) && !nameTok.sp) ? ' ' : ''
    const signature = trunc(`${sigHead}${retText ? retText + retSep : ''}${name}(${paramsText})${isConst ? ' const' : ''}`, SIG_MAX)
    const kind: LibSymbolKind = isCtor ? 'constructor' : ctx.kind === 'class' ? 'method' : 'function'
    this.add({
      kind,
      name,
      owner: ctx.qname,
      signature,
      returns: retText,
      params,
      doc: this.doc(startLine, endLine),
      header: this.header,
      line: startLine,
      access: ctx.access,
      isStatic: head.flags.static || undefined,
      isConst: isConst || undefined,
      template: head.template
    })
  }

  private parseParams(toks: Tok[]): LibParam[] {
    const out: LibParam[] = []
    for (const p of splitTop(toks)) {
      if (p.length === 0) continue
      if (p.length === 1 && p[0].v === 'void') continue
      if (p.length === 1 && p[0].v === '...') {
        out.push({ type: '...', name: '' })
        continue
      }
      const eq = topEq(p)
      const decl = eq >= 0 ? p.slice(0, eq) : p
      const defaultValue = eq >= 0 ? trunc(joinToks(p, eq + 1), 100) : undefined
      let name = ''
      let typeToks = decl
      let arr = ''
      let end = decl.length
      while (end > 0 && decl[end - 1].v === ']') {
        let b = end - 1
        while (b >= 0 && decl[b].v !== '[') b--
        if (b < 0) break
        arr = joinToks(decl, b, end) + arr
        end = b
      }
      const core = decl.slice(0, end)
      const fp = core.findIndex((x, k) => x.v === '(' && (core[k + 1]?.v === '*' || core[k + 1]?.v === '&'))
      if (fp >= 0) {
        const ni = core.findIndex((x, k) => k > fp && x.t === 'i')
        if (ni > 0) {
          name = core[ni].v
          typeToks = core.filter((_, k) => k !== ni)
        }
      } else if (core.length >= 2) {
        const last = core[core.length - 1]
        const prev = core[core.length - 2]
        const qualifierOnly = core.length === 2 && prev.t === 'i' && (prev.v === 'const' || prev.v === 'volatile' || prev.v === 'struct' || prev.v === 'class' || prev.v === 'enum' || prev.v === 'typename')
        if (last.t === 'i' && !TYPE_WORDS.has(last.v) && prev.v !== '::' && prev.v !== '<' && !qualifierOnly) {
          // «unsigned x», «long x» — name есть; «const Foo», «struct Foo» — нет
          name = last.v
          typeToks = core.slice(0, core.length - 1)
        }
      }
      out.push({ type: joinToks(typeToks) + arr, name, ...(defaultValue !== undefined ? { defaultValue } : {}) })
    }
    return out
  }

  // ---- переменные и константы ----
  private variableDecl(h: Tok[], head: Head, ctx: Ctx, startLine: number, endLine: number): void {
    if (h.length < 2) return
    if (NOT_DECL.has(h[0].v)) return
    const segs = splitTop(h)
    if (segs.length === 0) return
    const firstSeg = segs[0]
    let cut = firstSeg.length
    let pd = 0
    for (let k = 0; k < firstSeg.length; k++) {
      const x = firstSeg[k]
      if (x.t !== 'p') continue
      if (x.v === '(' || x.v === '[' || x.v === '{') {
        if (pd === 0 && k > 0) { cut = k; break }
        pd++
      } else if (x.v === ')' || x.v === ']' || x.v === '}') pd = Math.max(0, pd - 1)
      else if (pd === 0 && (x.v === '=' || x.v === ':')) {
        cut = k
        break
      }
    }
    if (cut < 2) return
    const nameTok = firstSeg[cut - 1]
    if (nameTok.t !== 'i' || KEYWORD_NAMES.has(nameTok.v) || TYPE_WORDS.has(nameTok.v)) return
    const typeToks = firstSeg.slice(0, cut - 1)
    if (typeToks.some((x) => NOT_DECL.has(x.v) || x.v === '=' || x.v === '.' || x.v === '->' || x.v === '(')) return
    const lastT = typeToks[typeToks.length - 1]
    if (!(lastT.t === 'i' || lastT.v === '*' || lastT.v === '&' || lastT.v === '>')) return
    const baseType = joinToks(typeToks)
    const doc = this.doc(startLine, endLine, true)
    const emitVar = (name: string, typeText: string, tail: Tok[], typeTokens: Tok[], nameSp: boolean): void => {
      const eq = topEq(tail)
      let arr = ''
      for (let k = 0; k < tail.length; k++) if (tail[k].v === '[') { arr = joinToks(tail, k, (eq >= 0 && eq > k) ? eq : tail.length); break }
      const value = eq >= 0 ? trunc(joinToks(tail, eq + 1), 120) : undefined
      let lastStar = -1
      let constIdx = -1
      typeTokens.forEach((x, k) => {
        if (x.v === '*' || x.v === '&') lastStar = k
        if (x.v === 'const') constIdx = k
      })
      const isConst = head.flags.constexpr || (constIdx >= 0 && constIdx > lastStar)
      const sig = (head.flags.static ? 'static ' : '') + (head.flags.constexpr ? 'constexpr ' : '') + typeText + (/[*&]$/.test(typeText) && !nameSp ? '' : ' ') + name + arr + (value !== undefined ? ' = ' + value : '')
      this.add({
        kind: isConst ? 'constant' : 'variable',
        name,
        owner: ctx.qname,
        signature: trunc(sig, SIG_MAX),
        returns: typeText + arr,
        doc,
        header: this.header,
        line: startLine,
        access: ctx.access,
        isStatic: head.flags.static || undefined,
        isConst: isConst || undefined
      })
    }
    emitVar(nameTok.v, baseType, firstSeg.slice(cut), typeToks, nameTok.sp)
    for (let s = 1; s < segs.length && s < 24; s++) {
      const seg = segs[s]
      let k = 0
      let stars = ''
      while (k < seg.length && (seg[k].v === '*' || seg[k].v === '&')) stars += seg[k++].v
      if (seg[k]?.t !== 'i' || KEYWORD_NAMES.has(seg[k].v)) continue
      const baseClean = joinToks(typeToks.filter((x) => x.v !== '*' && x.v !== '&'))
      emitVar(seg[k].v, baseClean + stars, seg.slice(k + 1), typeToks.filter((x) => x.v !== '*' && x.v !== '&'), seg[k].sp || !stars)
    }
  }

  // ---- enum ----
  private enumDecl(h: Tok[], head: Head, i: number, headEnd: number, term: ';' | '{' | 'end', to: number, ctx: Ctx, startLine: number, endLine: number): number {
    const t = this.lx.toks
    const afterOf = (): number => Math.min(term === '{' ? this.lx.bodyAfter[headEnd] : headEnd + 1, to)
    if (term !== '{') {
      // `enum Mode mode;` — переменная; forward declaration `enum class X : int;` — пропуск
      if (h.length > 4 && !h.some((x) => x.v === ':')) this.variableDecl(h, head, ctx, startLine, endLine)
      return afterOf()
    }
    let k = 1
    const scoped = h[k]?.v === 'class' || h[k]?.v === 'struct'
    if (scoped) k++
    let name: string | undefined
    let colon = -1
    for (let m = k; m < h.length; m++) {
      if (h[m].v === ':') { colon = m; break }
      if (h[m].t === 'i' && !isAttrIdent(h[m].v)) name = h[m].v
    }
    const underlying = colon >= 0 ? joinToks(h, colon + 1) : ''
    let after = this.lx.bodyAfter[headEnd]
    // хвост: typedef enum {...} name_t;
    let tailName: string | undefined
    let semi = -1
    for (let m = after; m < to && m - after < 10; m++) {
      if (t[m].v === ';') { semi = m; break }
      if (t[m].t === 'i') tailName = t[m].v
      else if (t[m].v !== ',' && t[m].v !== '*') break
    }
    if (semi >= 0) after = semi + 1
    if (!name && head.flags.typedef) name = tailName
    const emit = ctx.access !== 'private'
    const doc = this.doc(startLine, endLine)
    if (!emit) return Math.min(after, to)
    if (name) {
      this.add({ kind: 'enum', name, owner: ctx.qname, signature: trunc(`enum ${scoped ? 'class ' : ''}${name}${underlying ? ' : ' + underlying : ''}`, SIG_MAX), doc, header: this.header, line: startLine, access: ctx.access })
    }
    // значения
    const bodyEnd = Math.min(this.lx.bodyEnd[headEnd], to)
    const body = t.slice(headEnd + 1, bodyEnd)
    let counter: number | null = 0
    let idx = headEnd + 1
    for (const seg of splitTop(body)) {
      const segStart = idx
      idx += seg.length + 1
      if (seg.length === 0) continue
      // отбрасываем атрибуты
      const s2 = seg.filter((x) => !(x.t === 'i' && isAttrIdent(x.v)))
      if (s2.length === 0 || s2[0].t !== 'i') continue
      const vname = s2[0].v
      if (KEYWORD_NAMES.has(vname)) continue
      const eq = s2.findIndex((x) => x.v === '=')
      let valueText: string | undefined
      if (eq === 1) {
        valueText = trunc(joinToks(s2, 2), 80)
        const num = /^-?(?:0[xX][0-9a-fA-F]+|\d+)[uUlL]*$/.test(valueText) ? Number(valueText.replace(/[uUlL]+$/, '')) : NaN
        counter = Number.isNaN(num) ? null : num + 1
      } else if (counter !== null) {
        valueText = String(counter)
        counter++
      }
      const lastTokLine = t[Math.min(segStart + seg.length, bodyEnd - 1)]?.line ?? s2[0].line
      const vdoc = this.doc(s2[0].line, Math.max(lastTokLine, s2[0].line), true)
      const qual = scoped && name ? name + '::' : ''
      this.add({
        kind: 'enumValue',
        name: vname,
        owner: scoped && name ? name : ctx.qname,
        signature: `${qual}${vname}${valueText !== undefined ? ' = ' + valueText : ''}`,
        returns: name,
        doc: vdoc,
        header: this.header,
        line: s2[0].line,
        access: ctx.access
      })
    }
    return Math.min(after, to)
  }

  // ---- class / struct / union ----
  private classDecl(h: Tok[], head: Head, i: number, headEnd: number, to: number, ctx: Ctx, depth: number, startLine: number, endLine: number): number {
    const t = this.lx.toks
    const kw = h[0].v
    let colon = -1
    let ad = 0
    for (let m = 1; m < h.length; m++) {
      const v = h[m].v
      if (v === '<') ad++
      else if (v === '>' && ad > 0) ad--
      else if (v === ':' && ad === 0) { colon = m; break }
    }
    const nameToks = h.slice(1, colon < 0 ? h.length : colon).filter((x) => x.v !== 'final')
    let name: string | undefined
    ad = 0
    for (const x of nameToks) {
      if (x.v === '<') ad++
      else if (x.v === '>') ad = Math.max(0, ad - 1)
      else if (ad === 0 && x.t === 'i' && !isAttrIdent(x.v)) name = x.v
    }
    const bases: string[] = []
    if (colon >= 0) {
      for (const seg of splitTop(h.slice(colon + 1))) {
        const s = seg.filter((x) => x.v !== 'public' && x.v !== 'private' && x.v !== 'protected' && x.v !== 'virtual')
        const text = joinToks(s)
        if (text) bases.push(trunc(text, 80))
      }
    }
    const bodyStart = headEnd + 1
    const bodyEnd = Math.min(this.lx.bodyEnd[headEnd], to)
    let after = this.lx.bodyAfter[headEnd]
    // хвост: } name; / } name, *ptr;
    let tailName: string | undefined
    let semi = -1
    for (let m = after; m < to && m - after < 12; m++) {
      if (t[m].v === ';') { semi = m; break }
      if (t[m].t === 'i') tailName = t[m].v
      else if (t[m].v !== ',' && t[m].v !== '*' && t[m].v !== '&' && t[m].v !== '[' && t[m].v !== ']' && t[m].t !== 'n') break
    }
    if (semi >= 0) after = semi + 1
    if (!name && head.flags.typedef) name = tailName
    const isStruct = kw !== 'class'
    // анонимная структура/union — члены принадлежат внешней области
    if (!name) {
      if (depth < 12) this.parseRange(bodyStart, bodyEnd, ctx, depth + 1)
      return Math.min(after, to)
    }
    if (ctx.access === 'private') return Math.min(after, to)
    const qname = (ctx.qname ? ctx.qname + '::' : '') + name
    const sig = `${head.template ? head.template + ' ' : ''}${kw} ${name}${bases.length ? ' : ' + bases.join(', ') : ''}`
    this.add({ kind: isStruct ? 'struct' : 'class', name, owner: ctx.qname, signature: trunc(sig, SIG_MAX), doc: this.doc(startLine, endLine), header: this.header, line: startLine, access: ctx.access, bases: bases.length ? bases : undefined, template: head.template })
    if (depth < 12) this.parseRange(bodyStart, bodyEnd, { kind: 'class', qname, name, access: isStruct ? 'public' : 'private', isStruct }, depth + 1)
    if (head.flags.typedef && tailName && tailName !== name) {
      this.add({ kind: 'typedef', name: tailName, owner: ctx.qname, signature: `typedef ${kw} ${name} ${tailName}`, header: this.header, line: startLine, access: ctx.access })
    }
    return Math.min(after, to)
  }
}

/** Разбирает текст заголовка. Никогда не бросает исключений. */
export function parseHeader(text: string, options: ParseOptions): ParseResult {
  const maxBytes = options.maxBytes ?? 700_000
  const maxMs = options.maxMs ?? 1500
  const warnings: string[] = []
  const deadline = Date.now() + maxMs
  try {
    if (text.length > maxBytes) {
      const cut = text.lastIndexOf('\n', maxBytes)
      text = text.slice(0, cut > 0 ? cut : maxBytes)
      warnings.push(`${options.header}: файл слишком большой, разобрана только первая часть (${Math.round(maxBytes / 1024)} КБ)`)
    }
    const lx = lex(text, deadline)
    if (Date.now() > deadline) warnings.push(`${options.header}: превышен лимит времени при чтении файла`)
    const p = new Parser(lx, options.header, deadline, options.maxSymbols ?? 6000)
    p.run()
    return { symbols: p.symbols, includes: lx.includes, warnings: [...warnings, ...p.warnings] }
  } catch (e) {
    return { symbols: [], includes: [], warnings: [...warnings, `${options.header}: ошибка разбора (${e instanceof Error ? e.message : String(e)})`] }
  }
}

/** Все #include скетча/заголовка (без комментариев). */
export function extractIncludes(code: string): IncludeRef[] {
  const out: IncludeRef[] = []
  const seen = new Set<string>()
  const src = code.length > 2_000_000 ? code.slice(0, 2_000_000) : code
  // комментарии убираем грубо: блоки и строчные
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '')
  const re = /^[ \t]*#[ \t]*include[ \t]*([<"])([^>"\n]+)[>"]/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(clean))) {
    const name = m[2].trim()
    const key = (m[1] === '<' ? '<' : '"') + name
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name, angle: m[1] === '<' })
    if (out.length >= 500) break
  }
  return out
}

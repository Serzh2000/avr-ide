// Лёгкий разбор C/C++ для индекса символов: препроцессор (#define/#if/#ifdef/#include) и объявления верхнего уровня
// (функции, структуры, typedef, enum, переменные, поля). Не компилятор: цель — подсказки, переход и поиск, поэтому
// ошибки разбора пропускаются, а не прерывают работу. Один проход по тексту, без регулярных выражений на каждый символ.
import { evalCondition } from './expr'
import type { FileIndex, IncludeRef, Sym } from './types'

export interface ParseOptions {
  /** Макросы из проекта: «STM32F103xB» или «NAME=значение» */
  defines?: string[]
  /** Язык: по умолчанию C; для .cpp включается __cplusplus */
  cpp?: boolean
  /** Макросы из других файлов проекта; имена, которых нет в самом файле, спрашиваются здесь */
  ext?: (name: string) => string | undefined
}

/** Предопределённые макросы компилятора arm-none-eabi-gcc (минимум для выбора ветвей CMSIS). */
const PREDEFINED: Record<string, string> = {
  __GNUC__: '14', __GNUC_MINOR__: '2', __arm__: '1', __ARM_ARCH: '7', __thumb__: '1', __STDC__: '1', __STDC_VERSION__: '201710L', __INT_MAX__: '2147483647'
}

interface Tok { s: string; t: 0 | 1 | 2 | 3; p: number; e: number; l: number; c: number }

interface Comment { text: string; start: number }

const QUALIFIERS = new Set(['const', 'volatile', 'static', 'extern', 'register', 'inline', 'restrict', '__restrict', '__IO', '__I', '__O', '__IM', '__OM', '__IOM', '__STATIC_INLINE', '__STATIC_FORCEINLINE', '__NO_RETURN', '__WEAK', '__ALIGNED', '__PACKED', '__INLINE', '__RAM_FUNC', 'typedef', 'struct', 'union', 'enum', 'class', 'signed', 'constexpr', 'virtual', 'explicit', 'mutable', '_Noreturn', '__weak', 'volatile_', 'friend', 'unsigned_'])
const ATTR_WORDS = new Set(['__attribute__', '__declspec', 'alignas', '_Alignas', '__asm', '__asm__', 'asm', '_Pragma', '__extension__'])
const AGG = new Set(['struct', 'union', 'enum', 'class'])
const STOP_WORDS = new Set(['return', 'using', 'static_assert', '_Static_assert', 'goto', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue'])

const isIdStart = (c: number): boolean => (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 36 || c > 127
const isIdChar = (c: number): boolean => isIdStart(c) || (c >= 48 && c <= 57)
const isDigit = (c: number): boolean => c >= 48 && c <= 57

// Очистка doc-комментария: убирает рамку, звёздочки и «!<».
export function cleanDoc(raw: string): string {
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/^\s*(\/\/+|\*+(?!\/))?\s*[!<]*\s?/, '').replace(/\s*\*+\s*$/, '').trim())
  let s = lines.filter((l) => l && !/^[-=*_#~]{3,}$/.test(l)).join('\n').replace(/\*{2,}/g, ' ').replace(/[ \t]+/g, ' ').trim()
  s = s.replace(/^[\s*!<-]+/, '').replace(/(^|\n)[@\\]brief\s+/g, '$1')
  return s.length > 600 ? s.slice(0, 597) + '…' : s
}

const collapse = (s: string): string => s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ' ').replace(/\\\r?\n/g, ' ').replace(/\s+/g, ' ').trim()

interface Scan {
  toks: Tok[]
  syms: Sym[]
  includes: IncludeRef[]
  lead: Map<number, Comment>
  trail: Map<number, string>
  lines: number
  free: [string, string | null][]
}

/** Первый проход: комментарии, директивы препроцессора и токены активных веток. */
function scan(text: string, opts: ParseOptions): Scan {
  const defs = new Map<string, string>()
  for (const [k, v] of Object.entries(PREDEFINED)) defs.set(k, v)
  if (opts.cpp) defs.set('__cplusplus', '201703L')
  for (const d of opts.defines ?? []) {
    const eq = d.indexOf('=')
    defs.set(eq < 0 ? d : d.slice(0, eq), eq < 0 ? '1' : d.slice(eq + 1))
  }
  const free = new Map<string, string | null>()
  const look = (n: string): string | undefined => {
    const v = defs.get(n)
    if (v !== undefined || !opts.ext) return v
    const e = opts.ext(n)
    free.set(n, e ?? null)
    return e
  }

  const toks: Tok[] = []
  const syms: Sym[] = []
  const includes: IncludeRef[] = []
  const lead = new Map<number, Comment>()
  const trail = new Map<number, string>()
  const cond: { parent: boolean; taken: boolean; cur: boolean }[] = []
  let active = true
  const n = text.length
  let pos = 0
  let line = 1
  let lineStart = 0
  let atLineStart = true

  const advanceLines = (from: number, to: number): void => {
    for (let i = text.indexOf('\n', from); i >= 0 && i < to; i = text.indexOf('\n', i + 1)) { line++; lineStart = i + 1 }
  }

  const directive = (): void => {
    const startLine = line
    const col = pos - lineStart + 1
    // логический конец: продолжение строк «\» и многострочные /* */
    let e = pos
    for (;;) {
      let eol = text.indexOf('\n', e)
      if (eol < 0) eol = n
      const raw = text.slice(e, eol)
      const open = raw.lastIndexOf('/*')
      if (open >= 0 && raw.indexOf('*/', open) < 0) {
        const close = text.indexOf('*/', eol)
        e = close < 0 ? n : text.indexOf('\n', close)
        if (e < 0) e = n
        if (e >= n) break
        continue
      }
      const trimmed = raw.endsWith('\r') ? raw.slice(0, -1) : raw
      if (trimmed.endsWith('\\') && eol < n) { e = eol + 1; continue }
      e = eol
      break
    }
    const rawLine = text.slice(pos, e)
    advanceLines(pos, e)
    const hadSlash = rawLine.indexOf('/') >= 0
    let trailing: string | undefined
    let body = rawLine
    if (hadSlash) {
      const m = /\/\*([\s\S]*?)\*\/|\/\/([^\n]*)/.exec(rawLine)
      if (m) trailing = m[1] ?? m[2]
      body = rawLine.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ' ')
    }
    if (body.indexOf('\\') >= 0) body = body.replace(/\\\r?\n/g, ' ')
    pos = e
    const dm = /^#\s*([A-Za-z_]\w*)\s*(.*?)\s*$/s.exec(body)
    if (!dm) return
    const name = dm[1]
    const rest = dm[2]
    switch (name) {
      case 'define': {
        if (!active) return
        const m = /^([A-Za-z_]\w*)(\(([^)]*)\))?(?:\s+([\s\S]*))?$/.exec(rest)
        if (!m) return
        const value = (m[4] ?? '').trim()
        const sym: Sym = { n: m[1], k: 'macro', l: startLine, c: col + body.indexOf(m[1], 1) - 0, v: value.length > 200 ? value.slice(0, 200) + '…' : value }
        // столбец имени: позиция в исходной строке
        sym.c = col + rawLine.indexOf(m[1], 1)
        if (m[2] !== undefined) {
          sym.a = m[3].trim() === '' ? [] : m[3].split(',').map((x) => x.trim())
          sym.s = `#define ${m[1]}(${sym.a.join(', ')}) ${sym.v}`
        } else sym.s = `#define ${m[1]} ${sym.v}`.trimEnd()
        const lc = lead.get(startLine - 1)
        const tr = trailing ? cleanDoc(trailing) : ''
        const doc = tr && !/^(?:0x[0-9a-fA-F]+[uUlL]*|d+)$/.test(tr) ? tr : lc ? cleanDoc(lc.text) : tr
        if (doc) sym.d = doc
        syms.push(sym)
        defs.set(m[1], m[2] !== undefined ? '(' + value + ')' : value)
        return
      }
      case 'undef': if (active) defs.delete(rest.trim()); return
      case 'include': case 'include_next': {
        if (!active) return
        const m = /^(?:"([^"]+)"|<([^>]+)>)/.exec(rest)
        if (m) includes.push({ name: (m[1] ?? m[2]).trim(), sys: m[2] !== undefined, line: startLine })
        return
      }
      case 'if': {
        const parent = active
        const v = parent && evalCondition(rest, look)
        cond.push({ parent, taken: v, cur: v })
        active = v
        return
      }
      case 'ifdef': case 'ifndef': {
        const parent = active
        const has = look(rest.split(/\s/)[0]) !== undefined
        const v = parent && (name === 'ifdef' ? has : !has)
        cond.push({ parent, taken: v, cur: v })
        active = v
        return
      }
      case 'elif': case 'elifdef': case 'elifndef': {
        const top = cond[cond.length - 1]
        if (!top) return
        if (!top.parent || top.taken) top.cur = false
        else {
          const v = name === 'elif' ? evalCondition(rest, look) : name === 'elifdef' ? look(rest) !== undefined : look(rest) === undefined
          top.taken = v
          top.cur = v
        }
        active = top.cur
        return
      }
      case 'else': {
        const top = cond[cond.length - 1]
        if (!top) return
        top.cur = top.parent && !top.taken
        top.taken = true
        active = top.cur
        return
      }
      case 'endif': {
        cond.pop()
        active = cond.length ? cond[cond.length - 1].cur : true
        return
      }
      default: return
    }
  }

  while (pos < n) {
    const ch = text.charCodeAt(pos)
    if (ch === 10) { line++; pos++; lineStart = pos; atLineStart = true; continue }
    if (ch === 32 || ch === 9 || ch === 13 || ch === 12 || ch === 11) { pos++; continue }
    if (ch === 47) {
      const nx = text.charCodeAt(pos + 1)
      if (nx === 42) {
        const end = text.indexOf('*/', pos + 2)
        const stop = end < 0 ? n : end + 2
        const body = text.slice(pos + 2, end < 0 ? n : end)
        const startLine = line
        advanceLines(pos, stop)
        if (atLineStart) lead.set(line, { text: body, start: startLine })
        else if (!trail.has(startLine)) trail.set(line, body)
        // после многострочного комментария остаток строки уже не «начало строки»
        if (line !== startLine) atLineStart = false
        pos = stop
        continue
      }
      if (nx === 47) {
        let eol = text.indexOf('\n', pos)
        if (eol < 0) eol = n
        const body = text.slice(pos + 2, eol)
        if (atLineStart) {
          const prev = lead.get(line - 1)
          lead.set(line, prev && prev.text.length < 2000 ? { text: prev.text + '\n' + body, start: prev.start } : { text: body, start: line })
        } else trail.set(line, body)
        pos = eol
        continue
      }
    }
    if (atLineStart && ch === 35) { directive(); continue }
    atLineStart = false
    if (!active) { pos++; continue }
    const col = pos - lineStart + 1
    if (isIdStart(ch)) {
      let j = pos + 1
      while (j < n && isIdChar(text.charCodeAt(j))) j++
      toks.push({ s: text.slice(pos, j), t: 0, p: pos, e: j, l: line, c: col })
      pos = j
      continue
    }
    if (isDigit(ch) || (ch === 46 && isDigit(text.charCodeAt(pos + 1)))) {
      let j = pos + 1
      while (j < n) {
        const c = text.charCodeAt(j)
        if (isIdChar(c) || c === 46) j++
        else if ((c === 43 || c === 45) && /[eEpP]/.test(text[j - 1]) && !/^0[xX]/.test(text.slice(pos, pos + 2))) j++
        else break
      }
      toks.push({ s: text.slice(pos, j), t: 1, p: pos, e: j, l: line, c: col })
      pos = j
      continue
    }
    if (ch === 34 || ch === 39) {
      let j = pos + 1
      while (j < n) {
        const c = text.charCodeAt(j)
        if (c === 92) { j += 2; continue }
        if (c === ch || c === 10) break
        j++
      }
      toks.push({ s: text.slice(pos, Math.min(j + 1, n)), t: 2, p: pos, e: Math.min(j + 1, n), l: line, c: col })
      pos = Math.min(j + 1, n)
      continue
    }
    if (ch === 92) { pos++; continue }
    const two = text.slice(pos, pos + 2)
    if (two === '->' || two === '::') { toks.push({ s: two, t: 3, p: pos, e: pos + 2, l: line, c: col }); pos += 2; continue }
    if (ch === 46 && text.startsWith('...', pos)) { toks.push({ s: '...', t: 3, p: pos, e: pos + 3, l: line, c: col }); pos += 3; continue }
    toks.push({ s: text[pos], t: 3, p: pos, e: pos + 1, l: line, c: col })
    pos++
  }
  return { toks, syms, includes, lead, trail, lines: line, free: [...free] }
}

class Decls {
  private readonly match: Int32Array
  private readonly open: Int32Array
  private anon = 0
  private readonly T: Tok[]
  private readonly text: string
  private readonly sc: Scan
  private readonly out: Sym[]

  constructor(T: Tok[], text: string, sc: Scan, out: Sym[]) {
    this.T = T
    this.text = text
    this.sc = sc
    this.out = out
    this.match = new Int32Array(T.length).fill(-1)
    this.open = new Int32Array(T.length).fill(-1)
    const stack: number[] = []
    for (let i = 0; i < T.length; i++) {
      const s = T[i].t === 3 ? T[i].s : ''
      if (s === '(' || s === '[' || s === '{') stack.push(i)
      else if (s === ')' || s === ']' || s === '}') {
        const want = s === ')' ? '(' : s === ']' ? '[' : '{'
        // закрывающая без пары — пропускаем; пара другого вида — снимаем до подходящей
        let k = stack.length - 1
        while (k >= 0 && T[stack[k]].s !== want) k--
        if (k >= 0) {
          const o = stack[k]
          this.match[o] = i
          this.open[i] = o
          stack.length = k
        }
      }
    }
    for (const o of stack) this.match[o] = T.length
  }

  run(): void { this.block(0, this.T.length, undefined) }

  private src(a: number, b: number): string {
    if (b <= a) return ''
    const s = collapse(this.text.slice(this.T[a].p, this.T[b - 1].e))
    return s.length > 400 ? s.slice(0, 397) + '…' : s
  }

  private docFor(startTok: number, endTok: number): string | undefined {
    const lc = this.sc.lead.get(this.T[startTok].l - 1)
    if (lc) { const d = cleanDoc(lc.text); if (d) return d }
    const tr = this.sc.trail.get(this.T[Math.max(startTok, endTok - 1)].l) ?? this.sc.trail.get(this.T[startTok].l)
    if (tr) { const d = cleanDoc(tr); if (d) return d }
    return undefined
  }

  private block(i: number, end: number, parent: string | undefined): void {
    const T = this.T
    while (i < end) {
      const t = T[i]
      if (t.t === 3 && (t.s === ';' || t.s === '}' || t.s === ')' || t.s === ']')) { i++; continue }
      if (t.t === 0) {
        if (t.s === 'extern' && T[i + 1]?.t === 2 && T[i + 2]?.s === '{') { const c = Math.min(this.match[i + 2], end); this.block(i + 3, c, parent); i = c + 1; continue }
        if (t.s === 'namespace') {
          let j = i + 1
          while (j < end && T[j].s !== '{' && T[j].s !== ';') j++
          if (T[j]?.s === '{') { const c = Math.min(this.match[j], end); this.block(j + 1, c, parent); i = c + 1; continue }
          i = j + 1
          continue
        }
        if ((t.s === 'public' || t.s === 'private' || t.s === 'protected') && T[i + 1]?.s === ':') { i += 2; continue }
        if (t.s === 'template' && T[i + 1]?.s === '<') {
          // template<...>: пропускаем список параметров
          let d = 0
          let j = i + 1
          for (; j < end; j++) { if (T[j].s === '<') d++; else if (T[j].s === '>') { d--; if (d === 0) break } }
          i = j + 1
          continue
        }
        if (STOP_WORDS.has(t.s)) { i = this.skipStatement(i, end); continue }
      }
      i = this.statement(i, end, parent)
    }
  }

  private skipStatement(i: number, end: number): number {
    const T = this.T
    let j = i
    while (j < end) {
      const s = T[j].t === 3 ? T[j].s : ''
      if (s === '(' || s === '[') { j = this.match[j] + 1; continue }
      if (s === '{') return this.match[j] + 1
      if (s === ';') return j + 1
      j++
    }
    return end
  }

  /** Разбирает одно объявление, возвращает индекс следующего токена. */
  private statement(i: number, end: number, parent: string | undefined): number {
    const T = this.T
    let j = i
    let brace = -1
    while (j < end) {
      const s = T[j].t === 3 ? T[j].s : ''
      if (s === '(' || s === '[') { j = Math.min(this.match[j] + 1, end); continue }
      if (s === '{') { brace = j; break }
      if (s === ';') break
      j++
    }
    if (brace < 0) {
      this.simple(i, j, parent)
      return Math.max(j + 1, i + 1)
    }
    const close = Math.min(this.match[brace], end)
    const prev = T[brace - 1]
    // инициализатор: «= {…}»
    if (prev && prev.s === '=') {
      let k = close + 1
      while (k < end && T[k].s !== ';') { if (T[k].s === '(' || T[k].s === '[' || T[k].s === '{') k = this.match[k]; k++ }
      this.simple(i, brace - 1 >= i ? brace - 1 : brace, parent)
      return k + 1
    }
    // выделяем «голову» без атрибутов, чтобы понять, что это
    let kw = -1
    for (let k = i; k < brace; k++) {
      if (T[k].s === '(' || T[k].s === '[') { k = this.match[k]; continue }
      if (T[k].t === 0 && AGG.has(T[k].s)) { kw = k; break }
    }
    let last = brace - 1
    while (last > i && T[last].t === 0 && (T[last].s === 'const' || T[last].s === 'noexcept' || T[last].s === 'override' || T[last].s === 'final')) last--
    const closesParen = T[last]?.s === ')'
    let isFunc = false
    if (closesParen) {
      const o = this.open[last]
      const before = o > 0 ? T[o - 1] : undefined
      isFunc = !(before && ATTR_WORDS.has(before.s))
    }
    if (kw >= 0 && !isFunc) return this.aggregate(i, kw, brace, close, end, parent)
    if (isFunc) {
      this.func(i, last, close, parent, true)
      let k = close + 1
      if (T[k]?.s === ';') k++
      return k
    }
    // неизвестный блок (asm, макрос) — пропускаем тело
    return close + 1
  }

  /** Токены списка объявителей/параметров в плоский список верхнего уровня: группы скобок заменяются одной записью. */
  private flat(a: number, b: number): number[] {
    const out: number[] = []
    for (let k = a; k < b; k++) {
      out.push(k)
      const s = this.T[k].t === 3 ? this.T[k].s : ''
      if (s === '(' || s === '[' || s === '{') k = Math.min(this.match[k], b - 1)
    }
    return out
  }

  private typeText(a: number, b: number): { t: string; ptr: boolean } {
    const words: string[] = []
    let ptr = false
    const T = this.T
    for (let k = a; k < b; k++) {
      const tk = T[k]
      if (tk.t === 0) {
        if (QUALIFIERS.has(tk.s)) continue
        if (ATTR_WORDS.has(tk.s) && T[k + 1]?.s === '(') { k = this.match[k + 1]; continue }
        words.push(tk.s)
      } else if (tk.s === '*') ptr = true
      else if (tk.s === '&') ptr = true
      else if (tk.s === '::') words.push('::')
      else if (tk.s === '<') { let d = 0; let m = k; for (; m < b; m++) { if (T[m].s === '<') d++; else if (T[m].s === '>') { d--; if (d === 0) break } } words.push(this.src(k, m + 1)); k = m } else if (tk.s === '(' || tk.s === '[') k = this.match[k]
    }
    return { t: words.join(' ').replace(/ :: /g, '::'), ptr }
  }

  private params(open: number, close: number): string[] {
    const out: string[] = []
    let from = open + 1
    for (let k = open + 1; k <= close; k++) {
      const s = this.T[k]?.t === 3 ? this.T[k].s : ''
      if (k < close && (s === '(' || s === '[' || s === '{')) { k = this.match[k]; continue }
      if (k === close || s === ',') {
        const p = this.src(from, k)
        if (p) out.push(p)
        from = k + 1
      }
    }
    if (out.length === 1 && out[0] === 'void') return []
    return out
  }

  /** Функция: голова — токены [i, last], где last — закрывающая скобка параметров; body — закрывающая скобка тела (или -1). */
  private func(i: number, last: number, bodyClose: number, parent: string | undefined, hasBody: boolean): boolean {
    const T = this.T
    // ищем скобку параметров: первая «(» верхнего уровня, перед которой идентификатор, не атрибут
    let paren = -1
    for (let k = i; k <= last; k++) {
      const s = T[k].t === 3 ? T[k].s : ''
      if (s === '(') {
        const before = k > i ? T[k - 1] : undefined
        if (before && before.t === 0 && !ATTR_WORDS.has(before.s)) { paren = k; break }
        if (before && ATTR_WORDS.has(before.s)) { k = this.match[k]; continue }
        // «(*имя)» — указатель на функцию: переменная
        if (T[k + 1]?.s === '*') return this.variable(i, last + 1, parent)
        k = this.match[k]
        continue
      }
      if (s === '=' || s === '[' || s === '{') return false
    }
    if (paren < 0) return false
    const nameTok = T[paren - 1]
    if (STOP_WORDS.has(nameTok.s) || nameTok.s === 'sizeof') return false
    // имя с областью видимости Class::method
    let qualifier: string | undefined
    let headEnd = paren - 1
    if (T[paren - 2]?.s === '::' && T[paren - 3]?.t === 0) { qualifier = T[paren - 3].s; headEnd = paren - 3 }
    const ret = this.typeText(i, headEnd)
    // без типа результата — не объявление (вызов макроса), кроме конструкторов класса
    if (!ret.t && !(parent && nameTok.s === parent) && !qualifier) return false
    const pclose = Math.min(this.match[paren], this.T.length - 1)
    const params = this.params(paren, pclose)
    const sym: Sym = { n: nameTok.s, k: 'function', l: nameTok.l, c: nameTok.c, a: params, r: ret.t + (ret.ptr ? ' *' : '') }
    if (!ret.t) delete sym.r
    sym.s = this.src(i, pclose + 1).replace(/^(?:(?:static|inline|extern|__STATIC_INLINE|__STATIC_FORCEINLINE)\s+)+/, '')
    const st = (): boolean => { for (let k = i; k < paren; k++) if (T[k].s === 'static') return true; return false }
    if (st()) sym.st = 1
    if (hasBody) sym.b = 1
    if (parent) sym.p = parent
    else if (qualifier) sym.p = qualifier
    const doc = this.docFor(i, bodyClose >= 0 ? pclose + 1 : pclose + 1)
    if (doc) sym.d = doc
    this.out.push(sym)
    return true
  }

  private simple(i: number, j: number, parent: string | undefined): void {
    const T = this.T
    if (j <= i) return
    if (T[i].s === 'typedef') { this.typedef(i, j); return }
    if (T[i].t === 0 && (STOP_WORDS.has(T[i].s) || T[i].s === 'using' || T[i].s === 'friend' || T[i].s === 'asm' || T[i].s === '__asm' || T[i].s === '_Pragma')) return
    // прототип или переменная
    const fl = this.flat(i, j)
    let eq = fl.findIndex((k) => T[k].s === '=' && T[k].t === 3)
    const lim = eq < 0 ? fl.length : eq
    // функциональный объявитель: идентификатор, затем группа «(…)» верхнего уровня
    for (let q = 0; q < lim; q++) {
      const tk = T[fl[q]]
      if (tk.t === 3 && tk.s === '(') {
        const before = q > 0 ? T[fl[q - 1]] : undefined
        if (before && before.t === 0 && ATTR_WORDS.has(before.s)) continue
        if (before && before.t === 0) { if (this.func(i, Math.min(this.match[fl[q]], j - 1), -1, parent, false)) return; break }
        if (T[fl[q] + 1]?.s === '*') break // указатель на функцию — переменная
        continue
      }
    }
    this.variable(i, j, parent)
  }

  /** Переменная или поле (возможно, несколько объявителей через запятую). */
  private variable(i: number, j: number, parent: string | undefined): boolean {
    const T = this.T
    const segs: [number, number][] = []
    let from = i
    for (let k = i; k < j; k++) {
      const s = T[k].t === 3 ? T[k].s : ''
      if (s === '(' || s === '[' || s === '{') { k = Math.min(this.match[k], j - 1); continue }
      if (s === ',') { segs.push([from, k]); from = k + 1 }
    }
    segs.push([from, j])
    let baseT = ''
    let baseStatic = false
    for (let k = i; k < j; k++) if (T[k].s === 'static') baseStatic = true
    let made = false
    for (let q = 0; q < segs.length; q++) {
      const [a, b] = segs[q]
      const fl = this.flat(a, b)
      // граница объявителя: «=», «:» (битовое поле) или конец
      let stop = fl.length
      for (let x = 0; x < fl.length; x++) { const tk = T[fl[x]]; if (tk.t === 3 && (tk.s === '=' || tk.s === ':')) { stop = x; break } }
      // имя: последний идентификатор до stop, не считая групп скобок; для «(*имя)(…)» — идентификатор внутри первой группы
      let nameIdx = -1
      let fnPtr = false
      for (let x = stop - 1; x >= 0; x--) {
        const tk = T[fl[x]]
        if (tk.t === 0) { nameIdx = fl[x]; break }
        if (tk.s === '[') continue
        if (tk.s === '(') { continue }
      }
      if (nameIdx < 0) {
        const g = fl.find((k) => T[k].s === '(' && T[k + 1]?.s === '*')
        if (g !== undefined) {
          for (let k = this.match[g] - 1; k > g; k--) if (T[k].t === 0) { nameIdx = k; fnPtr = true; break }
        }
      } else {
        // имя перед «(*…)» не годится: у указателя на функцию имя внутри скобок
        const g = fl.find((k) => T[k].s === '(' && T[k + 1]?.s === '*')
        if (g !== undefined && g < nameIdx) { for (let k = this.match[g] - 1; k > g; k--) if (T[k].t === 0) { nameIdx = k; fnPtr = true; break } }
      }
      if (nameIdx < 0) continue
      const nameTok = T[nameIdx]
      let typeEnd = nameIdx
      let ptr = false
      let tt: string
      if (q === 0) {
        const r = this.typeText(a, fnPtr ? fl.find((k) => T[k].s === '(' && T[k + 1]?.s === '*')! : nameIdx)
        tt = r.t
        ptr = r.ptr || fnPtr
        baseT = tt
        if (!tt && !parent) return made
        if (!tt && parent && a === nameIdx) continue
      } else {
        tt = baseT
        // звёздочки перед именем конкретного объявителя
        for (let k = a; k < typeEnd; k++) if (T[k].s === '*') ptr = true
      }
      const sym: Sym = { n: nameTok.s, k: parent ? 'field' : 'variable', l: nameTok.l, c: nameTok.c }
      if (tt) sym.t = tt
      if (ptr) sym.ptr = 1
      if (parent) sym.p = parent
      // массив
      const dims: string[] = []
      for (let x = 0; x < fl.length; x++) {
        const k = fl[x]
        if (k > nameIdx && T[k].s === '[' && this.match[k] <= j) { const d = this.src(k + 1, this.match[k]); if (d) dims.push(d) }
      }
      if (dims.length) sym.arr = dims.length === 1 ? dims[0] : dims.map((d) => `(${d})`).join('*')
      // битовое поле
      for (let x = 0; x < fl.length; x++) {
        const k = fl[x]
        if (T[k].s === ':' && T[k + 1]?.t === 1 && k > nameIdx) { const w = parseInt(T[k + 1].s, 10); if (!Number.isNaN(w)) sym.bits = w; break }
      }
      if (!parent && baseStatic) sym.st = 1
      // объявление без инициализатора
      let declEnd = b
      for (let x = 0; x < fl.length; x++) { const tk = T[fl[x]]; if (tk.t === 3 && tk.s === '=') { declEnd = fl[x]; break } }
      sym.s = this.src(q === 0 ? a : i, declEnd).replace(/^(?:(?:static|extern)\s+)+/, '')
      const doc = this.docFor(i, j)
      if (doc) sym.d = doc
      this.out.push(sym)
      made = true
    }
    return made
  }

  private typedef(i: number, j: number): void {
    const T = this.T
    const fl = this.flat(i + 1, j)
    // указатель на функцию: typedef R (*Name)(P);
    const g = fl.find((k) => T[k].s === '(' && T[k + 1]?.s === '*')
    let nameTok: Tok | undefined
    let target = ''
    if (g !== undefined) {
      for (let k = this.match[g] - 1; k > g; k--) if (T[k].t === 0) { nameTok = T[k]; break }
      target = this.src(i + 1, j)
    } else {
      let ni = -1
      for (let x = fl.length - 1; x >= 0; x--) { const tk = T[fl[x]]; if (tk.t === 0) { ni = fl[x]; break } }
      if (ni < 0) return
      nameTok = T[ni]
      const r = this.typeText(i + 1, ni)
      target = r.t
      if (!target) return
      const dims: string[] = []
      for (const k of fl) if (k > ni && T[k].s === '[' && this.match[k] <= j) dims.push(this.src(k + 1, this.match[k]))
      const sym: Sym = { n: nameTok.s, k: 'typedef', l: nameTok.l, c: nameTok.c, t: target, s: this.src(i, j) }
      if (r.ptr) sym.ptr = 1
      if (dims.length) sym.arr = dims.join('*')
      const doc = this.docFor(i, j)
      if (doc) sym.d = doc
      this.out.push(sym)
      return
    }
    if (!nameTok) return
    const sym: Sym = { n: nameTok.s, k: 'typedef', l: nameTok.l, c: nameTok.c, t: target, s: this.src(i, j), ptr: 1 }
    const doc = this.docFor(i, j)
    if (doc) sym.d = doc
    this.out.push(sym)
  }

  /** struct/union/enum/class с телом. */
  private aggregate(i: number, kw: number, brace: number, close: number, end: number, parent: string | undefined): number {
    const T = this.T
    const isTypedef = T[i].s === 'typedef' || (() => { for (let k = i; k < kw; k++) if (T[k].s === 'typedef') return true; return false })()
    const kind = T[kw].s as 'struct' | 'union' | 'enum' | 'class'
    // тег: первый идентификатор после ключевого слова (после class/struct у enum class и атрибутов)
    let tag: Tok | undefined
    for (let k = kw + 1; k < brace; k++) {
      const tk = T[k]
      if (tk.t === 0 && ATTR_WORDS.has(tk.s) && T[k + 1]?.s === '(') { k = this.match[k + 1]; continue }
      if (tk.t === 0 && (tk.s === 'class' || tk.s === 'struct')) continue
      if (tk.t === 3 && tk.s === ':') break
      if (tk.t === 0 && !QUALIFIERS.has(tk.s)) { tag = tk; break }
    }
    // объявители после тела: до «;»
    let semi = close + 1
    while (semi < end && T[semi].s !== ';') {
      const s = T[semi].t === 3 ? T[semi].s : ''
      if (s === '(' || s === '[' || s === '{') semi = this.match[semi]
      semi++
    }
    semi = Math.min(semi, end)
    const declarators: Tok[] = []
    const ptrDecl = new Set<Tok>()
    {
      let sawStar = false
      for (let k = close + 1; k < semi; k++) {
        const tk = T[k]
        if (tk.s === '(' || tk.s === '[' || tk.s === '{') { k = this.match[k]; continue }
        if (tk.s === '*') sawStar = true
        else if (tk.s === ',') sawStar = false
        else if (tk.t === 0 && !QUALIFIERS.has(tk.s)) { declarators.push(tk); if (sawStar) ptrDecl.add(tk); sawStar = false }
      }
    }
    const typedefNames = isTypedef ? declarators : []
    const first = typedefNames.find((d) => !ptrDecl.has(d))
    let owner: string
    if (isTypedef && first) owner = first.s
    else if (tag) owner = tag.s
    else owner = `${parent ? parent + '::' : ''}<anon${++this.anon}>`
    const nameTok = isTypedef && first ? first : tag
    const head = this.src(i, brace)
    const typeSym: Sym | null = nameTok ? { n: owner, k: kind, l: nameTok.l, c: nameTok.c, s: `${kind} ${owner}` } : null
    if (typeSym) {
      const doc = this.docFor(i, semi)
      if (doc) typeSym.d = doc
      this.out.push(typeSym)
    }
    // алиасы: тег указывает на typedef-имя, остальные typedef-имена — на тип
    if (isTypedef) {
      if (tag && tag.s !== owner) this.out.push({ n: tag.s, k: kind, l: tag.l, c: tag.c, t: owner, s: `${kind} ${tag.s}` })
      for (const d of typedefNames) if (d.s !== owner) { const sy: Sym = { n: d.s, k: 'typedef', l: d.l, c: d.c, t: owner, s: this.src(i, semi) }; if (ptrDecl.has(d)) sy.ptr = 1; this.out.push(sy) }
    }
    // тело
    if (kind === 'enum') this.enumBody(brace + 1, close, isTypedef || tag ? owner : '')
    else this.members(brace + 1, close, owner)
    // обычные объявители (не typedef): переменные этого типа
    if (!isTypedef) {
      for (const d of declarators) {
        const sym: Sym = { n: d.s, k: parent ? 'field' : 'variable', l: d.l, c: d.c, t: owner }
        if (ptrDecl.has(d)) sym.ptr = 1
        if (parent) sym.p = parent
        this.out.push(sym)
      }
    }
    return semi + 1
  }

  /** Члены структуры: объявления верхнего уровня тела; вложенные безымянные struct/union «растворяются» в родителе. */
  private members(a: number, b: number, owner: string): void {
    const T = this.T
    let i = a
    while (i < b) {
      const t = T[i]
      if (t.t === 3 && (t.s === ';' || t.s === '}')) { i++; continue }
      if (t.t === 0 && (t.s === 'public' || t.s === 'private' || t.s === 'protected') && T[i + 1]?.s === ':') { i += 2; continue }
      // вложенная безымянная: «struct { … };» или «union { … };»
      let brace = -1
      let k = i
      while (k < b) {
        const s = T[k].t === 3 ? T[k].s : ''
        if (s === '(' || s === '[') { k = this.match[k] + 1; continue }
        if (s === '{') { brace = k; break }
        if (s === ';') break
        k++
      }
      if (brace >= 0 && T[i].t === 0 && AGG.has(T[i].s)) {
        const cl = Math.min(this.match[brace], b)
        const hasTag = T[i + 1]?.t === 0 && T[i + 1]?.s !== '{'
        let semi = cl + 1
        while (semi < b && T[semi].s !== ';') semi++
        const hasDecl = semi > cl + 1
        if (!hasTag && !hasDecl) {
          if (T[i].s === 'enum') this.enumBody(brace + 1, cl, '')
          else this.members(brace + 1, cl, owner)
          i = semi + 1
          continue
        }
        i = this.aggregate(i, i, brace, cl, b, owner)
        continue
      }
      i = this.statement(i, b, owner)
    }
  }

  private enumBody(a: number, b: number, owner: string): void {
    const T = this.T
    let from = a
    for (let k = a; k <= b; k++) {
      const s = k < b && T[k].t === 3 ? T[k].s : ''
      if (k < b && (s === '(' || s === '[' || s === '{')) { k = this.match[k]; continue }
      if (k === b || s === ',') {
        if (k > from && T[from].t === 0) {
          const nm = T[from]
          const sym: Sym = { n: nm.s, k: 'enumerator', l: nm.l, c: nm.c }
          if (owner) sym.p = owner
          if (T[from + 1]?.s === '=') sym.v = this.src(from + 2, k)
          const lc = this.sc.lead.get(nm.l - 1)
          const tr = this.sc.trail.get(T[Math.max(from, k - 1)].l)
          const doc = lc ? cleanDoc(lc.text) : tr ? cleanDoc(tr) : ''
          if (doc) sym.d = doc
          sym.s = this.src(from, k)
          this.out.push(sym)
        }
        from = k + 1
      }
    }
  }
}

/** Разбор файла C/C++/заголовка. */
export function parseSource(text: string, opts: ParseOptions = {}): FileIndex {
  const sc = scan(text, opts)
  const out: Sym[] = sc.syms
  try {
    new Decls(sc.toks, text, sc, out).run()
  } catch {
    // сбой разбора объявлений не должен ломать индекс макросов
  }
  return { includes: sc.includes, syms: out, lines: sc.lines, free: sc.free }
}

/** Ассемблер GNU as (ARM): метки, .global/.weak/.equ/.set и #define. */
export function parseAsm(text: string, opts: ParseOptions = {}): FileIndex {
  const syms: Sym[] = []
  const includes: IncludeRef[] = []
  const lines = text.split('\n')
  const seen = new Set<string>()
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/\r$/, '')
    const ln = raw.replace(/\/\*.*?\*\//g, ' ').replace(/(^|\s)@.*$/, '$1').replace(/\/\/.*$/, '')
    const inc = /^\s*#\s*include\s*(?:"([^"]+)"|<([^>]+)>)/.exec(ln)
    if (inc) { includes.push({ name: inc[1] ?? inc[2], sys: inc[2] !== undefined, line: i + 1 }); continue }
    const def = /^\s*#\s*define\s+([A-Za-z_]\w*)(?:\s+(.*))?$/.exec(ln)
    if (def) { syms.push({ n: def[1], k: 'macro', l: i + 1, c: ln.indexOf(def[1], ln.indexOf('define')) + 1, v: (def[2] ?? '').trim(), s: `#define ${def[1]} ${(def[2] ?? '').trim()}`.trimEnd() }); continue }
    const lab = /^\s*([A-Za-z_.$][\w.$]*)\s*:(?!:)/.exec(ln)
    if (lab && !/^\d/.test(lab[1]) && !seen.has(lab[1])) {
      seen.add(lab[1])
      syms.push({ n: lab[1], k: 'label', l: i + 1, c: ln.indexOf(lab[1]) + 1, s: lab[1] + ':' })
      continue
    }
    const eq = /^\s*\.(?:equ|set|equiv)\s+([A-Za-z_.$][\w.$]*)\s*,\s*(.+)$/.exec(ln)
    if (eq) syms.push({ n: eq[1], k: 'macro', l: i + 1, c: ln.indexOf(eq[1]) + 1, v: eq[2].trim(), s: `.equ ${eq[1]}, ${eq[2].trim()}` })
  }
  void opts
  return { includes, syms, lines: lines.length, free: [] }
}

// Вычисление константных выражений препроцессора C: условия #if/#elif и значения макросов (маски регистров, адреса периферии).
// Целые — BigInt. Неизвестные идентификаторы в условии равны 0 (как в препроцессоре); в режиме значения — «не вычислено».

/** Значение макроса по имени: undefined — не определён. */
export type MacroLookup = (name: string) => string | undefined

interface Tk { t: 'n' | 'i' | 'o'; v: string; n?: bigint }

class Unknown extends Error {}

const OPS3 = ['<<=', '>>=']
const OPS2 = ['||', '&&', '==', '!=', '<=', '>=', '<<', '>>', '->']
const NUM_RE = /^(0[xX][0-9a-fA-F']+|0[bB][01']+|\d[\d']*)([uUlL]*)/
const CAST_WORDS = new Set(['uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'size_t', 'uintptr_t', 'intptr_t', 'unsigned', 'signed', 'int', 'long', 'short', 'char', 'const', 'volatile'])

function tokenize(src: string): Tk[] {
  const out: Tk[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') { i++; continue }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1
      while (j < src.length && /[\w]/.test(src[j])) j++
      out.push({ t: 'i', v: src.slice(i, j) })
      i = j
      continue
    }
    if (/[0-9]/.test(ch)) {
      const m = NUM_RE.exec(src.slice(i, i + 40))
      if (!m) throw new Unknown()
      let digits = m[1].replace(/'/g, '')
      // восьмеричные: 0 + цифры
      let n: bigint
      if (/^0[0-7]+$/.test(digits)) n = BigInt('0o' + digits.slice(1))
      else n = BigInt(digits)
      i += m[0].length
      // вещественное число — не целое
      if (src[i] === '.' || ((src[i] === 'e' || src[i] === 'E') && !/^0[xX]/.test(digits))) throw new Unknown()
      digits = ''
      out.push({ t: 'n', v: m[0], n })
      continue
    }
    if (ch === "'") {
      const m = /^'(\\.|[^\\'])'/.exec(src.slice(i, i + 6))
      if (!m) throw new Unknown()
      const body = m[1]
      out.push({ t: 'n', v: m[0], n: BigInt(body.length === 1 ? body.charCodeAt(0) : body === '\\n' ? 10 : body === '\\0' ? 0 : body.charCodeAt(1)) })
      i += m[0].length
      continue
    }
    const three = src.slice(i, i + 3)
    if (OPS3.includes(three)) { out.push({ t: 'o', v: three }); i += 3; continue }
    const two = src.slice(i, i + 2)
    if (OPS2.includes(two)) { out.push({ t: 'o', v: two }); i += 2; continue }
    out.push({ t: 'o', v: ch })
    i++
  }
  return out
}

const MASK64 = (1n << 64n) - 1n

class Evaluator {
  private p = 0
  private readonly toks: Tk[]
  private readonly look: MacroLookup
  private readonly cond: boolean
  private readonly depth: number
  constructor(toks: Tk[], look: MacroLookup, cond: boolean, depth: number) {
    this.toks = toks
    this.look = look
    this.cond = cond
    this.depth = depth
  }

  private peek(): Tk | undefined { return this.toks[this.p] }
  private next(): Tk | undefined { return this.toks[this.p++] }
  private isOp(v: string): boolean { const t = this.peek(); return !!t && t.t === 'o' && t.v === v }
  private eat(v: string): boolean { if (this.isOp(v)) { this.p++; return true } return false }

  run(): bigint {
    const v = this.ternary()
    if (this.p < this.toks.length) throw new Unknown()
    return v
  }

  private ternary(): bigint {
    const c = this.bin(0)
    if (this.eat('?')) {
      const a = this.ternary()
      if (!this.eat(':')) throw new Unknown()
      const b = this.ternary()
      return c !== 0n ? a : b
    }
    return c
  }

  private static readonly PREC: Record<string, number> = { '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10 }

  private bin(min: number): bigint {
    let left = this.unary()
    for (;;) {
      const t = this.peek()
      if (!t || t.t !== 'o') break
      const prec = Evaluator.PREC[t.v]
      if (!prec || prec <= min) break
      this.p++
      const right = this.bin(prec)
      left = Evaluator.apply(t.v, left, right)
    }
    return left
  }

  private static apply(op: string, a: bigint, b: bigint): bigint {
    switch (op) {
      case '||': return a !== 0n || b !== 0n ? 1n : 0n
      case '&&': return a !== 0n && b !== 0n ? 1n : 0n
      case '|': return a | b
      case '^': return a ^ b
      case '&': return a & b
      case '==': return a === b ? 1n : 0n
      case '!=': return a !== b ? 1n : 0n
      case '<': return a < b ? 1n : 0n
      case '>': return a > b ? 1n : 0n
      case '<=': return a <= b ? 1n : 0n
      case '>=': return a >= b ? 1n : 0n
      case '<<': if (b < 0n || b > 63n) throw new Unknown(); return (a << b) & MASK64
      case '>>': if (b < 0n || b > 63n) throw new Unknown(); return a >> b
      case '+': return a + b
      case '-': return a - b
      case '*': return a * b
      case '/': if (b === 0n) throw new Unknown(); return a / b
      case '%': if (b === 0n) throw new Unknown(); return a % b
    }
    throw new Unknown()
  }

  private unary(): bigint {
    const t = this.peek()
    if (!t) throw new Unknown()
    if (t.t === 'o') {
      if (t.v === '!') { this.p++; return this.unary() === 0n ? 1n : 0n }
      if (t.v === '~') { this.p++; return ~this.unary() & MASK64 }
      if (t.v === '-') { this.p++; return -this.unary() }
      if (t.v === '+') { this.p++; return this.unary() }
      if (t.v === '(') {
        // приведение типа: (uint32_t) выражение
        let q = this.p + 1
        let words = 0
        while (this.toks[q]?.t === 'i' && CAST_WORDS.has(this.toks[q].v)) { q++; words++ }
        if (words > 0 && this.toks[q]?.t === 'o' && this.toks[q].v === ')') {
          const after = this.toks[q + 1]
          if (after && (after.t === 'n' || after.t === 'i' || (after.t === 'o' && (after.v === '(' || after.v === '-' || after.v === '~' || after.v === '!')))) {
            this.p = q + 1
            return this.unary()
          }
        }
        this.p++
        const v = this.ternary()
        if (!this.eat(')')) throw new Unknown()
        return v
      }
      throw new Unknown()
    }
    this.p++
    if (t.t === 'n') return t.n!
    // идентификатор
    if (t.v === 'defined') {
      const par = this.eat('(')
      const id = this.next()
      if (!id || id.t !== 'i') throw new Unknown()
      if (par && !this.eat(')')) throw new Unknown()
      return this.look(id.v) !== undefined ? 1n : 0n
    }
    if (this.isOp('(')) {
      // вызов функции или функционального макроса / __has_include(...): пропускаем скобки, значение неизвестно
      let d = 0
      do {
        const x = this.next()
        if (!x) throw new Unknown()
        if (x.t === 'o' && x.v === '(') d++
        else if (x.t === 'o' && x.v === ')') d--
      } while (d > 0)
      if (this.cond) return 0n
      throw new Unknown()
    }
    if (t.v === 'true') return 1n
    if (t.v === 'false') return 0n
    const val = this.look(t.v)
    if (val === undefined) { if (this.cond) return 0n; throw new Unknown() }
    if (this.depth > 12) throw new Unknown()
    const text = val.trim()
    if (text === '') { if (this.cond) return 0n; throw new Unknown() }
    try {
      return new Evaluator(tokenize(text), this.look, this.cond, this.depth + 1).run()
    } catch (e) {
      if (this.cond && e instanceof Unknown) return 0n
      throw e
    }
  }
}

/** Значение выражения или undefined, если вычислить нельзя. */
export function evalConst(src: string, look: MacroLookup): bigint | undefined {
  try {
    return new Evaluator(tokenize(src), look, false, 0).run()
  } catch (e) {
    if (e instanceof Unknown) return undefined
    return undefined
  }
}

/** Условие #if/#elif: неизвестное и ошибки — «ложь». */
export function evalCondition(src: string, look: MacroLookup): boolean {
  try {
    return new Evaluator(tokenize(src), look, true, 0).run() !== 0n
  } catch {
    return false
  }
}

/** «0x4 (4)» / «0x40021000»: короткая запись значения для подсказок. */
export function formatValue(v: bigint): string {
  const hex = '0x' + v.toString(16).toUpperCase()
  if (v < 0n) return v.toString()
  return v < 10n ? v.toString() : `${hex} (${v.toString()})`
}

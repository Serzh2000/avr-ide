// Разбор протокола GDB/MI (GDB manual, «GDB/MI Output Syntax»). Чистый код без Electron.
// Грамматика: output → (out-of-band)* [result-record] "(gdb)"; result-record → [token] "^" class ("," result)*;
// async → [token] ("*"|"+"|"=") class ("," result)*; stream → ("~"|"@"|"&") c-string.

export type MiValue = string | MiValue[] | { [k: string]: MiValue }
export type MiTuple = { [k: string]: MiValue }

export type MiRecord =
  | { type: 'result'; token?: number; cls: 'done' | 'running' | 'connected' | 'error' | 'exit'; data: MiTuple }
  | { type: 'exec' | 'status' | 'notify'; token?: number; cls: string; data: MiTuple }
  | { type: 'console' | 'target' | 'log'; text: string }
  | { type: 'prompt' }

class Reader {
  i = 0
  readonly s: string
  constructor(s: string) { this.s = s }
  peek(): string { return this.s[this.i] ?? '' }
  eof(): boolean { return this.i >= this.s.length }
  expect(c: string): void { if (this.s[this.i] !== c) throw new Error(`MI: ожидалось «${c}» в позиции ${this.i}: ${this.s.slice(Math.max(0, this.i - 10), this.i + 20)}`); this.i++ }
}

function cstring(r: Reader): string {
  r.expect('"')
  let out = ''
  while (!r.eof() && r.peek() !== '"') {
    const c = r.s[r.i++]
    if (c !== '\\') { out += c; continue }
    const n = r.s[r.i++]
    switch (n) {
      case 'n': out += '\n'; break
      case 't': out += '\t'; break
      case 'r': out += '\r'; break
      case 'a': out += '\x07'; break
      case 'b': out += '\b'; break
      case 'f': out += '\f'; break
      case 'v': out += '\v'; break
      case 'e': out += '\x1b'; break
      case '"': out += '"'; break
      case '\\': out += '\\'; break
      default:
        if (n >= '0' && n <= '7') {
          // восьмеричный код байта (до трёх цифр); последовательность байт собирается в UTF-8 ниже
          let v = n
          while (v.length < 3 && /[0-7]/.test(r.peek())) v += r.s[r.i++]
          out += String.fromCharCode(parseInt(v, 8))
        } else out += n ?? ''
    }
  }
  r.expect('"')
  return decodeBytes(out)
}

/** Если в строке есть символы 0x80–0xFF, считаем их байтами UTF-8 (так GDB экранирует не-ASCII). */
function decodeBytes(s: string): string {
  if (!/[\x80-\xff]/.test(s) || /[^\x00-\xff]/.test(s)) return s
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(s, (c) => c.charCodeAt(0))) } catch { return s }
}

function ident(r: Reader): string {
  const st = r.i
  while (!r.eof() && /[A-Za-z0-9_.\-]/.test(r.peek())) r.i++
  if (r.i === st) throw new Error(`MI: ожидалось имя в позиции ${st}`)
  return r.s.slice(st, r.i)
}

function value(r: Reader): MiValue {
  const c = r.peek()
  if (c === '"') return cstring(r)
  if (c === '{') {
    r.i++
    const o: MiTuple = {}
    if (r.peek() === '}') { r.i++; return o }
    for (;;) {
      const k = ident(r); r.expect('=')
      const v = value(r)
      o[k] = k in o ? ([] as MiValue[]).concat(o[k], [v]) : v
      if (r.peek() === ',') { r.i++; continue }
      r.expect('}'); return o
    }
  }
  if (c === '[') {
    r.i++
    const a: MiValue[] = []
    if (r.peek() === ']') { r.i++; return a }
    for (;;) {
      // элементы — значения или result (имя=значение): в списке имя отбрасываем
      if (r.peek() === '"' || r.peek() === '{' || r.peek() === '[') a.push(value(r))
      else { ident(r); r.expect('='); a.push(value(r)) }
      if (r.peek() === ',') { r.i++; continue }
      r.expect(']'); return a
    }
  }
  throw new Error(`MI: неожиданный символ «${c}» в позиции ${r.i}`)
}

function results(r: Reader): MiTuple {
  const o: MiTuple = {}
  while (r.peek() === ',') {
    r.i++
    const k = ident(r); r.expect('=')
    o[k] = value(r)
  }
  return o
}

/** Разбирает одну строку вывода GDB/MI. Возвращает null для пустых строк. */
export function parseMiLine(line: string): MiRecord | null {
  const s = line.replace(/\r?\n$/, '')
  if (!s.trim()) return null
  if (/^\(gdb\)\s*$/.test(s)) return { type: 'prompt' }
  const r = new Reader(s)
  const tk = /^\d+/.exec(s)
  const token = tk ? Number(tk[0]) : undefined
  if (tk) r.i = tk[0].length
  const c = r.s[r.i++]
  if (c === '~' || c === '@' || c === '&') return { type: c === '~' ? 'console' : c === '@' ? 'target' : 'log', text: cstring(r) }
  if (c === '^' || c === '*' || c === '+' || c === '=') {
    const cls = ident(r)
    const data = results(r)
    if (c === '^') return { type: 'result', token, cls: cls as 'done', data }
    return { type: c === '*' ? 'exec' : c === '+' ? 'status' : 'notify', token, cls, data }
  }
  throw new Error('MI: непонятная строка: ' + s.slice(0, 80))
}

// ---------- удобные выборки ----------

export const str = (v: MiValue | undefined): string | undefined => (typeof v === 'string' ? v : undefined)
export const arr = (v: MiValue | undefined): MiValue[] => (Array.isArray(v) ? v : v === undefined ? [] : [v])
export const obj = (v: MiValue | undefined): MiTuple => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})
export const num = (v: MiValue | undefined): number | undefined => {
  if (typeof v !== 'string') return undefined
  const n = /^0x/i.test(v) ? parseInt(v, 16) : Number(v)
  return Number.isFinite(n) ? n : undefined
}

/** Кадр из остановки или стека → удобные поля. */
export interface MiFrame { level: number; func: string; file?: string; fullname?: string; line?: number; addr: number }
export function frameOf(v: MiValue | undefined): MiFrame {
  const f = obj(v)
  return { level: num(f['level']) ?? 0, func: str(f['func']) ?? '??', file: str(f['file']), fullname: str(f['fullname']), line: num(f['line']), addr: num(f['addr']) ?? 0 }
}

/** Экранирование аргумента команды MI в двойных кавычках. */
export const miQuote = (s: string): string => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'

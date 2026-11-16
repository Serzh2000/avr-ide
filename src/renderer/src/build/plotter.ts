// Чистая логика серийного плоттера: разбор строк порта, накопление точек, масштаб. Без DOM и React.

/** Одно значение из строки: имя (если задано) и число. */
export interface Sample { name: string | null; value: number }

const SPLIT = /[,\t ;]+/
const NUM = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/

/**
 * Разбирает одну строку порта. Понимает:
 *   «1 2 3», «1,2,3», «1\t2\t3»        — безымянные значения;
 *   «a:1,b:2», «a:1 b:2», «a: 1, b: 2» — именованные (как в Arduino IDE 2).
 * Если в строке есть что-то кроме чисел (обычный текст) — это не данные графика, возвращается null.
 */
export function parseLine(line: string): Sample[] | null {
  const t = line.replace(/\r/g, '').trim()
  if (!t || t.length > 600) return null
  const tokens = t.split(SPLIT).filter(Boolean)
  const out: Sample[] = []
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    const colon = tok.indexOf(':')
    if (colon === -1) {
      if (!NUM.test(tok)) return null
      out.push({ name: null, value: Number(tok) })
      continue
    }
    const name = tok.slice(0, colon)
    let val = tok.slice(colon + 1)
    // «имя: 5» — значение в следующем токене
    if (val === '' && i + 1 < tokens.length) val = tokens[++i]
    if (!name || !NUM.test(val)) return null
    out.push({ name: name.slice(0, 40), value: Number(val) })
  }
  if (!out.length || out.some((s) => !Number.isFinite(s.value))) return null
  return out
}

/** Режет поток на строки: хранит неполный «хвост» между порциями данных. */
export class LineSplitter {
  private tail = ''
  push(chunk: string): string[] {
    const parts = (this.tail + chunk).split(/\r\n|\n|\r/)
    this.tail = parts.pop() ?? ''
    if (this.tail.length > 2000) this.tail = ''
    return parts
  }
  reset(): void { this.tail = '' }
}

/** Накопитель точек: ряды имён и строк значений (NaN — «в этой строке значения нет»). */
export class PlotBuffer {
  names: string[] = []
  rows: number[][] = []
  /** Абсолютный номер первой хранимой строки (растёт, когда старые строки отбрасываются) */
  first = 0
  /** Растёт при каждом изменении — по нему перерисовывается график */
  version = 0
  capacity: number
  constructor(capacity = 5000) { this.capacity = capacity }

  get total(): number { return this.first + this.rows.length }

  /** Добавляет одну строку значений. Безымянные получают имена «Значение 1…» по позиции. */
  add(samples: Sample[]): void {
    const row: number[] = new Array(this.names.length).fill(NaN)
    samples.forEach((s, i) => {
      const name = s.name ?? `Значение ${i + 1}`
      let k = this.names.indexOf(name)
      if (k === -1) {
        if (this.names.length >= 16) return
        k = this.names.push(name) - 1
        for (const r of this.rows) r.push(NaN)
        row.push(NaN)
      }
      row[k] = s.value
    })
    this.rows.push(row)
    if (this.rows.length > this.capacity) {
      const drop = this.rows.length - this.capacity
      this.rows.splice(0, drop)
      this.first += drop
    }
    this.version++
  }

  /** Принимает строки порта; возвращает, сколько точек добавлено. */
  feed(lines: string[]): number {
    let n = 0
    for (const l of lines) {
      const s = parseLine(l)
      if (s) { this.add(s); n++ }
    }
    return n
  }

  clear(): void {
    this.first = this.total
    this.names = []
    this.rows = []
    this.version++
  }

  /** Последние `count` строк, заканчивая абсолютным номером `endAbs` (не включая); без него — до конца. */
  window(count: number, endAbs?: number): { rows: number[][]; start: number } {
    const end = Math.min(endAbs ?? this.total, this.total)
    const endIdx = Math.max(0, end - this.first)
    const startIdx = Math.max(0, endIdx - Math.max(2, count))
    return { rows: this.rows.slice(startIdx, endIdx), start: this.first + startIdx }
  }
}

/** Диапазон по Y для видимых рядов. Плоский график раздвигается, чтобы линия не прилипала к краю. */
export function computeRange(rows: number[][], visible: boolean[]): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (const r of rows) {
    for (let k = 0; k < r.length; k++) {
      const v = r[k]
      if (!visible[k] || !Number.isFinite(v)) continue
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  if (min === Infinity) return { min: 0, max: 1 }
  if (min === max) {
    const d = Math.abs(min) * 0.1 || 1
    return { min: min - d, max: max + d }
  }
  const pad = (max - min) * 0.08
  return { min: min - pad, max: max + pad }
}

/** «Круглые» деления оси: шаг 1, 2, 5 × 10^n. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!(max > min) || !Number.isFinite(min) || !Number.isFinite(max)) return [min]
  const raw = (max - min) / Math.max(1, target)
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / pow
  const step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)))
  return out
}

/** Подпись деления: без хвоста нулей, большие и малые числа — короче. */
export function formatTick(v: number): string {
  if (!Number.isFinite(v)) return ''
  const a = Math.abs(v)
  if (a !== 0 && (a >= 1e6 || a < 1e-3)) return v.toExponential(1).replace('e+', 'e')
  return String(Number(v.toPrecision(6)))
}

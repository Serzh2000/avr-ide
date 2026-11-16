// Контекст вызова функции для Signature Help и разбор слова под курсором. Чистая логика.
import { scan } from './scan'
import { CONTROL_KEYWORDS } from './constants'
import { isComplexChain, receiverChain } from '../libs/infer'

export interface CallContext {
  /** Цепочка имён как написано: `Serial.println`, `server.on`, `digitalWrite`. */
  chain: string
  /** Слово-функция (последний сегмент) и объект перед ним. */
  name: string
  qualifier: string | null
  /** Слово перед `::` (Класс::метод, пространство::функция); для `.`/`->` — null. */
  scope?: string
  /** Составной получатель (`obj.a().b(` → `obj.a()`; `doc["k"].as(` → `doc["k"]`); только если он не простое имя. */
  receiver?: string
  /** Индекс активного аргумента (с 0). */
  argIndex: number
}

/**
 * Ищет незакрытую «(» перед курсором и считает запятые верхнего уровня.
 * Возвращает null, если курсор не внутри вызова (или это if/while/for и т.п.).
 */
export function findCallContext(textBefore: string): CallContext | null {
  const tail = textBefore.slice(-4000)
  const { masked } = scan(tail)
  let depth = 0
  let commas = 0
  for (let i = masked.length - 1; i >= 0; i--) {
    const c = masked[i]
    if (c === ')' || c === ']' || c === '}') depth++
    else if (c === '[') {
      if (depth > 0) depth--
    } else if (c === '{' || c === ';') {
      if (depth === 0) return null // граница оператора
      if (c === '{') depth--
    } else if (c === '(') {
      if (depth > 0) {
        depth--
        continue
      }
      const before = masked.slice(0, i).replace(/\s+$/, '')
      const m = /([A-Za-z_]\w*(?:\s*(?:\.|->|::)\s*[A-Za-z_]\w*)*)$/.exec(before)
      if (!m) return null
      const chain = m[1].replace(/\s+/g, '').replace(/->/g, '.')
      const last = /(?:(\.|::))?([A-Za-z_]\w*)$/.exec(chain)!
      const name = last[2]
      const head = last[1] ? chain.slice(0, chain.length - name.length - last[1].length) : ''
      const prevWord = /([A-Za-z_]\w*)$/.exec(head)?.[1] ?? null
      if (!last[1] && CONTROL_KEYWORDS.has(name)) return null
      // составной получатель перед именем: obj.a().b(
      let receiver: string | undefined
      const pre = before.slice(0, m.index)
      const sepM = /(\.|->)\s*$/.exec(pre)
      if (sepM) {
        const rc = receiverChain(pre.slice(0, sepM.index))
        if (rc && isComplexChain(rc)) receiver = rc
      }
      return { chain, name, qualifier: last[1] === '.' ? prevWord : null, argIndex: commas, ...(last[1] === '::' && prevWord ? { scope: prevWord } : {}), ...(receiver ? { receiver } : {}) }
    } else if (c === ',' && depth === 0) commas++
  }
  return null
}

export interface WordAt {
  word: string
  /** Начало/конец слова в строке (0-based, [start, end)). */
  start: number
  end: number
  /** Слово перед точкой: в `Serial.println` для `println` это `Serial`. Работает и для `->`. */
  qualifier: string | null
  /** Слово перед `::`: в `Adafruit_BMP280::SAMPLING_X1` для `SAMPLING_X1` это `Adafruit_BMP280`. */
  scope: string | null
  /** Составной получатель слева (`obj.a().` / `doc["k"].`), если он не простое имя. */
  receiver?: string
}

/** Слово в позиции column (0-based) строки line и квалификатор. */
export function wordAt(line: string, column: number): WordAt | null {
  const isW = (ch: string | undefined): boolean => !!ch && /\w/.test(ch)
  let s = column
  let e = column
  while (s > 0 && isW(line[s - 1])) s--
  while (e < line.length && isW(line[e])) e++
  if (s === e) return null
  const word = line.slice(s, e)
  if (/^\d/.test(word)) return null
  const before = line.slice(0, s)
  const q = /([A-Za-z_]\w*)\s*(?:\.|->)\s*$/.exec(before)
  const sc = q ? null : /([A-Za-z_]\w*)\s*::\s*$/.exec(before)
  let receiver: string | undefined
  if (!q && !sc) {
    const sepM = /(\.|->)\s*$/.exec(before)
    if (sepM) {
      const rc = receiverChain(before.slice(0, sepM.index))
      if (rc && isComplexChain(rc)) receiver = rc
    }
  }
  return { word, start: s, end: e, qualifier: q ? q[1] : null, scope: sc ? sc[1] : null, ...(receiver ? { receiver } : {}) }
}

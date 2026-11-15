// Контекст вызова функции для Signature Help и разбор слова под курсором. Чистая логика.
import { scan } from './scan'
import { CONTROL_KEYWORDS } from './constants'

export interface CallContext {
  /** Цепочка имён как написано: `Serial.println`, `server.on`, `digitalWrite`. */
  chain: string
  /** Слово-функция (последний сегмент) и объект перед ним. */
  name: string
  qualifier: string | null
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
      const m = /([A-Za-z_]\w*(?:\s*\.\s*[A-Za-z_]\w*)*)$/.exec(before)
      if (!m) return null
      const chain = m[1].replace(/\s+/g, '')
      const parts = chain.split('.')
      const name = parts[parts.length - 1]
      if (parts.length === 1 && CONTROL_KEYWORDS.has(name)) return null
      return { chain, name, qualifier: parts.length > 1 ? parts[parts.length - 2] : null, argIndex: commas }
    } else if (c === ',' && depth === 0) commas++
  }
  return null
}

export interface WordAt {
  word: string
  /** Начало/конец слова в строке (0-based, [start, end)). */
  start: number
  end: number
  /** Слово перед точкой: в `Serial.println` для `println` это `Serial`. */
  qualifier: string | null
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
  const q = /([A-Za-z_]\w*)\s*\.\s*$/.exec(line.slice(0, s))
  return { word, start: s, end: e, qualifier: q ? q[1] : null }
}

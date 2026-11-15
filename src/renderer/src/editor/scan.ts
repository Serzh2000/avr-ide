// Простой сканер C/C++: маскирует комментарии и литералы, ищет незакрытые скобки/кавычки.
// Чистая логика, без зависимостей.

export interface ScanProblem {
  /** Смещения в тексте [start, end). */
  start: number
  end: number
  message: string
  severity: 'error' | 'warning'
  /** Незакрытый литерал/комментарий (нужно для подавления автодополнения). */
  unterminated?: boolean
}

export interface ScanResult {
  /** Текст той же длины: содержимое комментариев и строк/символов заменено пробелами (переводы строк сохранены). */
  masked: string
  problems: ScanProblem[]
  /** Номера строк (с 0), которые начинаются внутри блочного комментария. */
  commentContinuationLines: Set<number>
}

const OPEN: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
const CLOSE: Record<string, string> = { ')': '(', ']': '[', '}': '{' }

function blank(ch: string): string {
  return ch === '\n' || ch === '\r' ? ch : ' '
}

export function lineOf(text: string, offset: number): number {
  let line = 1
  for (let i = 0; i < offset && i < text.length; i++) if (text.charCodeAt(i) === 10) line++
  return line
}

/** Смещение -> {line, column}, нумерация с 1. */
export function posAt(text: string, offset: number): { line: number; column: number } {
  let line = 1
  let last = -1
  const end = Math.min(offset, text.length)
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) {
      line++
      last = i
    }
  }
  return { line, column: end - last }
}

export function scan(text: string): ScanResult {
  const n = text.length
  const out: string[] = new Array(n)
  const problems: ScanProblem[] = []
  const commentContinuationLines = new Set<number>()
  const stack: { ch: string; at: number }[] = []
  let bracketsBroken = false
  // Условная компиляция может законно давать «несбалансированные» скобки — тогда скобки не проверяем.
  const hasCond = /^[ \t]*#[ \t]*(else|elif)\b/m.test(text)

  let i = 0
  while (i < n) {
    const c = text[i]
    const next = text[i + 1]

    // комментарии
    if (c === '/' && next === '/') {
      while (i < n && text[i] !== '\n') {
        out[i] = blank(text[i])
        i++
      }
      continue
    }
    if (c === '/' && next === '*') {
      const endIdx = text.indexOf('*/', i + 2)
      const stop = endIdx < 0 ? n : endIdx + 2
      const start = i
      let lineIdx = lineOf(text, start) - 1
      for (; i < stop; i++) {
        out[i] = blank(text[i])
        if (text[i] === '\n' && (endIdx < 0 || i < endIdx)) commentContinuationLines.add(++lineIdx)
        else if (text[i] === '\n') lineIdx++
      }
      if (endIdx < 0) problems.push({ start, end: Math.min(start + 2, n), message: 'Не закрыт комментарий /* */', severity: 'error', unterminated: true })
      continue
    }

    // #error / #warning: текст свободный, апострофы там не кавычки
    if (c === '#') {
      const lineStart = text.lastIndexOf('\n', i - 1) + 1
      if (/^[ \t]*$/.test(text.slice(lineStart, i)) && /^#[ \t]*(error|warning)\b/.test(text.slice(i, i + 20))) {
        out[i] = '#'
        i++
        while (i < n && text[i] !== '\n') {
          out[i] = blank(text[i])
          i++
        }
        continue
      }
    }

    // сырая строка R"delim( ... )delim"
    if (c === 'R' && next === '"' && !/\w/.test(text[i - 1] ?? ' ')) {
      const open = text.indexOf('(', i + 2)
      const delim = open > 0 && open - (i + 2) <= 16 ? text.slice(i + 2, open) : null
      if (delim !== null && !/[\s)\\"]/.test(delim)) {
        const endIdx = text.indexOf(')' + delim + '"', open + 1)
        const stop = endIdx < 0 ? n : endIdx + delim.length + 2
        for (let k = i; k < stop; k++) out[k] = blank(text[k])
        i = stop
        continue
      }
    }

    // строки и символы
    if (c === '"' || c === "'") {
      // разделитель цифр C++14: 1'000'000
      if (c === "'" && /[0-9a-fA-F]/.test(text[i - 1] ?? '') && /[0-9a-fA-F]/.test(next ?? '') && /[0-9]/.test(text[i - 2] ?? text[i - 1])) {
        out[i] = c
        i++
        continue
      }
      const start = i
      out[i] = c
      i++
      let closed = false
      while (i < n) {
        const d = text[i]
        if (d === '\\' && i + 1 < n) {
          out[i] = ' '
          out[i + 1] = blank(text[i + 1])
          if (text[i + 1] === '\r' && text[i + 2] === '\n') {
            out[i + 2] = '\n'
            i++
          }
          i += 2
          continue
        }
        if (d === '\n') break
        if (d === c) {
          out[i] = c
          i++
          closed = true
          break
        }
        out[i] = ' '
        i++
      }
      if (!closed) {
        let end = i
        if (text[end - 1] === '\r') end--
        problems.push({
          start,
          end: Math.max(end, start + 1),
          message: c === '"' ? 'Не закрыта строка: не хватает закрывающей кавычки "' : "Не закрыт символьный литерал: не хватает закрывающего '",
          severity: 'error',
          unterminated: true
        })
      }
      continue
    }

    out[i] = c
    if (!bracketsBroken && !hasCond) {
      if (OPEN[c]) stack.push({ ch: c, at: i })
      else if (CLOSE[c]) {
        const top = stack[stack.length - 1]
        if (!top) {
          problems.push({ start: i, end: i + 1, message: `Лишняя закрывающая скобка ${c}`, severity: 'error' })
          bracketsBroken = true
        } else if (top.ch !== CLOSE[c]) {
          problems.push({
            start: i,
            end: i + 1,
            message: `Ожидалась ${OPEN[top.ch]} (для ${top.ch} на строке ${lineOf(text, top.at)}), а найдена ${c}`,
            severity: 'error'
          })
          bracketsBroken = true
        } else stack.pop()
      }
    }
    i++
  }

  if (!bracketsBroken && !hasCond) {
    for (const s of stack.slice(-3)) {
      problems.push({ start: s.at, end: s.at + 1, message: `Не закрыта скобка ${s.ch}: не хватает ${OPEN[s.ch]}`, severity: 'error' })
    }
  }
  problems.sort((a, b) => a.start - b.start)
  return { masked: out.join(''), problems, commentContinuationLines }
}

/** Находится ли конец текста внутри комментария или строки (для подавления автодополнения). */
export function insideCommentOrString(textBeforeCursor: string): boolean {
  const tail = textBeforeCursor.slice(-6000)
  if (!tail) return false
  const { masked, problems } = scan(tail)
  const last = tail.length - 1
  if (masked[last] === ' ' && tail[last] !== ' ' && tail[last] !== '\t') return true
  // литерал/комментарий открыт, но содержимого ещё нет (курсор сразу после кавычки)
  return problems.some((p) => p.unterminated && p.end >= tail.length - (tail.endsWith('\r') ? 1 : 0))
}

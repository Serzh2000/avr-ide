// Простое автоформатирование C/C++: отступы по скобкам. Число и порядок строк не меняются
// (только ведущие пробелы и пробелы в конце строк), поэтому подходит и для форматирования выделения.
import { scan } from './scan'

export interface FormatOptions {
  indent?: string
}

interface Frame {
  isSwitch: boolean
  inCase: boolean
}

export function formatCode(text: string, opts: FormatOptions = {}): string {
  const indent = opts.indent ?? '  '
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const src = text.split(/\r?\n/)
  const scanned = scan(text)
  const maskedLines = scanned.masked.split(/\r?\n/)
  const commentLines = scanned.commentContinuationLines
  const out: string[] = []

  const stack: Frame[] = []
  let parenDepth = 0
  let pendingControl = 0
  let continuation = false // предыдущая строка препроцессора заканчивалась на «\»
  let pendingSwitch = false

  for (let li = 0; li < src.length; li++) {
    const raw = src[li]
    const m = maskedLines[li] ?? ''
    const trimmedRaw = raw.trim()

    // внутри многострочного комментария содержимое не трогаем, только хвостовые пробелы
    if (commentLines.has(li)) {
      out.push(raw.replace(/[ 	]+$/, ''))
      continue
    }

    if (continuation) {
      continuation = /\\\s*$/.test(raw)
      out.push(raw.replace(/[ \t]+$/, ''))
      continue
    }
    if (trimmedRaw === '') {
      out.push('')
      continue
    }
    if (/^#/.test(trimmedRaw)) {
      continuation = /\\\s*$/.test(raw)
      out.push(trimmedRaw)
      continue
    }

    const code = m.trim()
    // комментарий без кода — выравниваем по текущему уровню
    const level0 = stack.length
    let level = level0
    const top = stack[stack.length - 1]

    // метка case/default
    const isLabel = /^(case\b[^:]*|default)\s*:(?!:)/.test(code)
    // ведущие закрывающие скобки
    const lead = /^[}\])]+/.exec(code)?.[0] ?? ''
    const leadBraces = (lead.match(/\}/g) ?? []).length

    if (top?.isSwitch && top.inCase && !isLabel) level += 1
    if (leadBraces > 0) {
      // закрывающая скобка выравнивается по открывающей
      level = Math.max(0, level0 - leadBraces)
    }
    if (parenDepth > 0 && !/^\)/.test(code)) level += 1
    if (pendingControl > 0 && !/^\{/.test(code) && leadBraces === 0) level += pendingControl

    out.push(indent.repeat(level) + trimmedRaw.replace(/[ \t]+$/, ''))

    // обновляем состояние по символам строки
    if (/\bswitch\b/.test(code)) pendingSwitch = true
    for (const ch of code) {
      if (ch === '{') {
        stack.push({ isSwitch: pendingSwitch, inCase: false })
        pendingSwitch = false
        pendingControl = 0
      } else if (ch === '}') {
        stack.pop()
        pendingControl = 0
      } else if (ch === '(' || ch === '[') parenDepth++
      else if (ch === ')' || ch === ']') parenDepth = Math.max(0, parenDepth - 1)
    }
    if (isLabel) {
      const f = stack[stack.length - 1]
      if (f?.isSwitch) f.inCase = true
    }
    // управляющая конструкция без скобки: следующая строка получает отступ
    if (parenDepth === 0) {
      const ctl = /^(?:\}\s*)?(?:else\s+if|if|for|while|else|do)\b/.test(code)
      const endsOpen = /[;{}:,]\s*$/.test(code) || /\bwhile\b.*\)\s*;$/.test(code)
      if (ctl && !endsOpen && !/\{\s*$/.test(code)) pendingControl += 1
      else if (!ctl || endsOpen) {
        if (/;\s*$/.test(code) || /\}\s*$/.test(code) || /\{\s*$/.test(code)) pendingControl = 0
      }
    }
  }
  return out.join(eol)
}

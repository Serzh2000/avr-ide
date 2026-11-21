// Подсказки профессионального режима (C/C++ для ARM): без функций Arduino. Ключевые слова C, типы stdint, сниппеты main/for/while/struct
// и символы самого файла (функции, переменные, макросы из CMSIS/HAL, если они объявлены в открытом файле). Чистая функция — проверяется тестами.
import type { Candidate } from './completion'
import type { FileSymbol } from './symbols'

const KEYWORDS = ['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'goto', 'sizeof', 'typedef', 'struct', 'union', 'enum', 'static', 'extern', 'volatile', 'const', 'inline', 'register', 'void', 'char', 'short', 'int', 'long', 'float', 'double', 'signed', 'unsigned']
const TYPES = ['uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'size_t', 'bool']
const MACROS = ['NULL', 'true', 'false', 'UINT32_MAX', 'INT32_MAX']

interface Snip { prefix: string; title: string; body: string }
const SNIPS: Snip[] = [
  { prefix: 'main', title: 'Функция main', body: '#include <stdint.h>\n\nint main(void)\n{\n\t$0\n\twhile (1) {\n\t}\n}\n' },
  { prefix: 'for', title: 'Цикл for', body: 'for (uint32_t ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t$0\n}' },
  { prefix: 'while', title: 'Цикл while', body: 'while (${1:условие}) {\n\t$0\n}' },
  { prefix: 'if', title: 'Условие if', body: 'if (${1:условие}) {\n\t$0\n}' },
  { prefix: 'struct', title: 'Структура', body: 'typedef struct {\n\t${1:uint32_t field;}\n} ${2:Name_t};' },
  { prefix: 'enum', title: 'Перечисление', body: 'typedef enum {\n\t${1:VALUE_A},\n\t${2:VALUE_B}\n} ${3:Name_t};' },
  { prefix: 'isr', title: 'Обработчик прерывания', body: 'void ${1:SysTick_Handler}(void)\n{\n\t$0\n}' },
  { prefix: 'reg', title: 'Запись в бит регистра', body: '${1:GPIOA}->${2:ODR} |= (1U << ${3:5});' },
  { prefix: 'inc', title: '#include <…>', body: '#include <${1:stdint.h}>' }
]

const cand = (label: string, kind: Candidate['kind'], rank: number, extra: Partial<Candidate> = {}): Candidate => ({ label, kind, insertText: label, isSnippet: false, rank, ...extra })

/** Кандидаты для автодополнения в Pro: без функций Arduino. */
export function proCandidates(symbols: FileSymbol[]): Candidate[] {
  const out: Candidate[] = []
  for (const k of KEYWORDS) out.push(cand(k, 'keyword', 40))
  for (const k of TYPES) out.push(cand(k, 'type', 30, { detail: 'тип из stdint.h' }))
  for (const k of MACROS) out.push(cand(k, 'macro', 50))
  for (const s of SNIPS) out.push({ label: s.prefix, kind: 'snippet', insertText: s.body, isSnippet: true, rank: 20, detail: s.title, filterText: s.prefix })
  const seen = new Set<string>()
  for (const s of symbols) {
    if (seen.has(s.name)) continue
    seen.add(s.name)
    out.push(cand(s.name, s.kind === 'function' ? 'function' : s.kind === 'macro' ? 'macro' : 'variable', 10, { detail: s.detail }))
  }
  return out
}

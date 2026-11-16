// Разбор вывода компилятора (gcc через arduino-cli) в список проблем. Чистые функции, без зависимостей.
import type { EditorMarker } from '../contracts'

export interface Problem {
  severity: 'error' | 'warning' | 'info'
  /** Путь файла из вывода компилятора; null — ошибка без привязки к файлу (например, ошибка линковщика) */
  file: string | null
  line: number
  column: number
  message: string
}

const GCC_RE = /^(.+?):(\d+):(?:(\d+):)?\s*(fatal error|error|warning|note):\s*(.*)$/i
const UNDEF_RE = /^(.+?):(\d+):\s*(undefined reference to .*|multiple definition of .*)$/i
const GENERIC_RE = /^(?:collect2|[\w.+-]*ld)(?:\.exe)?:\s*(?:fatal )?error:\s*(.*)$/i
const TOP_ERR_RE = /^(?:fatal )?error:\s*(.+)$/i

const sevOf = (s: string): Problem['severity'] => {
  const k = s.toLowerCase()
  return k === 'warning' ? 'warning' : k === 'note' ? 'info' : 'error'
}

/** Разбирает текст вывода сборки. Повторяющиеся записи схлопываются. */
export function parseProblems(text: string): Problem[] {
  const out: Problem[] = []
  const seen = new Set<string>()
  const push = (p: Problem): void => {
    const k = `${p.severity}|${p.file}|${p.line}|${p.column}|${p.message}`
    if (seen.has(k)) return
    seen.add(k)
    out.push(p)
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    let m = GCC_RE.exec(line)
    if (m) {
      push({ severity: sevOf(m[4]), file: m[1], line: Number(m[2]), column: m[3] ? Number(m[3]) : 1, message: m[5].trim() })
      continue
    }
    m = UNDEF_RE.exec(line)
    if (m) {
      push({ severity: 'error', file: m[1], line: Number(m[2]), column: 1, message: m[3].trim() })
      continue
    }
    m = GENERIC_RE.exec(line)
    if (m) {
      push({ severity: 'error', file: null, line: 1, column: 1, message: `Ошибка линковки: ${m[1].trim()}` })
      continue
    }
    m = TOP_ERR_RE.exec(line)
    if (m) push({ severity: 'error', file: null, line: 1, column: 1, message: m[1].trim() })
  }
  return out
}

/** Приводит путь к сравнимому виду (слэши, регистр для путей Windows). */
export function normPath(p: string): string {
  const s = p.replace(/\\/g, '/').replace(/\/+/g, '/')
  return /^[A-Za-z]:\//.test(s) ? s.toLowerCase() : s
}

export const samePath = (a: string, b: string): boolean => normPath(a) === normPath(b)

/** Имя файла без папки. */
export const baseName = (p: string): string => p.replace(/\\/g, '/').split('/').pop() ?? p

/** Маркеры Monaco для одного файла. Проблемы без файла и `info` из других файлов не берутся. */
export function markersFor(problems: Problem[], filePath: string | null | undefined): EditorMarker[] {
  if (!filePath) return []
  return problems
    .filter((p) => p.file && samePath(p.file, filePath))
    .map((p) => {
      const id = /^['‘`]([A-Za-z_]\w*)['’`]/.exec(p.message)
      return {
        startLine: p.line,
        startColumn: p.column,
        endLine: p.line,
        endColumn: p.column + (id ? id[1].length : 1),
        severity: p.severity,
        message: p.message,
        source: 'arduino-cli'
      }
    })
}

export interface SizeInfo {
  flash?: { used: number; pct: number; max: number }
  ram?: { used: number; pct: number; max: number }
}

/** Итог сборки: «Sketch uses N bytes (P%) of program storage space. Maximum is M bytes.» */
export function parseSize(text: string): SizeInfo | null {
  // arduino-cli пишет итог на языке системы: при русской локали Windows — «Скетч использует … байт (N%) памяти устройства. Всего доступно … байт.»
  const f = /Sketch uses (\d+) bytes \((\d+)%\) of program storage space\. Maximum is (\d+) bytes/.exec(text)
    ?? /Скетч использует (\d+) байт[а-я]* \((\d+)%\) памяти устройства\. Всего доступно (\d+) байт/.exec(text)
  const r = /Global variables use (\d+) bytes \((\d+)%\) of dynamic memory(?:, leaving \d+ bytes for local variables)?\. Maximum is (\d+) bytes/.exec(text)
    ?? /Глобальные переменные используют (\d+) байт[а-я]* \((\d+)%\) динамической памяти(?:, оставляя \d+ байт[а-я]* для локальных переменных)?\. Максимум: (\d+) байт/.exec(text)
  // Формат ядра ESP8266
  const ef = /Code in flash[^\n]*?used (\d+) \/ (\d+) bytes \((\d+)%\)/.exec(text)
  const er = /Variables and constants in RAM[^\n]*?used (\d+) \/ (\d+) bytes \((\d+)%\)/.exec(text)
  if (!f && !r && !ef && !er) return null
  const f2 = f ? [f[0], f[1], f[2], f[3]] : ef ? [ef[0], ef[1], ef[3], ef[2]] : null
  const r2 = r ? [r[0], r[1], r[2], r[3]] : er ? [er[0], er[1], er[3], er[2]] : null
  return {
    flash: f2 ? { used: Number(f2[1]), pct: Number(f2[2]), max: Number(f2[3]) } : undefined,
    ram: r2 ? { used: Number(r2[1]), pct: Number(r2[2]), max: Number(r2[3]) } : undefined
  }
}

/** Этап сборки по строке вывода (для подписи прогресса): текст и условный процент. */
export function phaseOf(line: string): { label: string; pct: number } | null {
  if (/Detecting libraries|Generating function prototypes/i.test(line)) return { label: 'Анализ скетча и библиотек', pct: 10 }
  if (/Compiling sketch/i.test(line)) return { label: 'Компиляция скетча', pct: 30 }
  if (/Compiling libraries/i.test(line)) return { label: 'Компиляция библиотек', pct: 50 }
  if (/Compiling core/i.test(line)) return { label: 'Компиляция ядра', pct: 70 }
  if (/Linking everything together/i.test(line)) return { label: 'Линковка', pct: 90 }
  if (/Sketch uses|Скетч использует/i.test(line)) return { label: 'Готово', pct: 100 }
  if (/Uploading|avrdude|esptool|Writing at|Connecting\.\./i.test(line)) return { label: 'Загрузка на плату', pct: 95 }
  return null
}

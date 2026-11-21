// Разбор сообщений arm-none-eabi-gcc/ld в список Diagnostic (пути — относительно корня проекта).
import type { Diagnostic } from '../interfaces'

const GCC_RE = /^(.+?):(\d+):(?:(\d+):)?\s*(fatal error|error|warning|note):\s*(.*)$/i
const UNDEF_RE = /^(.+?):(\d+):\s*(undefined reference to .*|multiple definition of .*)$/i
const LD_RE = /^(?:.*[\\/])?(?:collect2|[\w.+-]*ld)(?:\.exe)?:\s*(?:fatal )?(error|warning):\s*(.*)$/i
const OVERFLOW_RE = /region `(\w+)' overflowed by (\d+) bytes/
const TOP_RE = /^(fatal error|error):\s*(.+)$/i

/** Путь из вывода gcc → относительный путь проекта с «/», если файл внутри корня. */
export function relativeTo(root: string, file: string): string {
  const f = file.replace(/\\/g, '/')
  const r = root.replace(/\\/g, '/').replace(/\/+$/, '')
  return f.toLowerCase().startsWith(r.toLowerCase() + '/') ? f.slice(r.length + 1) : f
}

const sev = (s: string): Diagnostic['severity'] => (s.toLowerCase() === 'warning' ? 'warning' : s.toLowerCase() === 'note' ? 'note' : 'error')

export function parseDiagnostics(text: string, root: string): Diagnostic[] {
  const out: Diagnostic[] = []
  const seen = new Set<string>()
  const push = (d: Diagnostic): void => {
    const k = `${d.severity}|${d.file}|${d.line}|${d.column}|${d.message}`
    if (!seen.has(k)) { seen.add(k); out.push(d) }
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    let m = GCC_RE.exec(line)
    if (m) { push({ severity: sev(m[4]), message: m[5].trim(), file: relativeTo(root, m[1]), line: Number(m[2]), column: m[3] ? Number(m[3]) : 1 }); continue }
    m = UNDEF_RE.exec(line)
    if (m) { push({ severity: 'error', message: m[3].trim(), file: relativeTo(root, m[1]), line: Number(m[2]), column: 1 }); continue }
    m = OVERFLOW_RE.exec(line)
    if (m) { push({ severity: 'error', message: `Область памяти ${m[1]} переполнена на ${m[2]} байт: уменьшите программу или выберите чип побольше.` }); continue }
    m = LD_RE.exec(line)
    if (m) { push({ severity: sev(m[1]), message: `Компоновщик: ${m[2].trim()}` }); continue }
    m = TOP_RE.exec(line)
    if (m) push({ severity: 'error', message: m[2].trim() })
  }
  return out
}

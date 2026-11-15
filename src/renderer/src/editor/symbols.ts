// Символы текущего файла: функции, переменные, #define, типы. Регулярные выражения по «замаскированному» тексту.
import { scan } from './scan'

export type SymbolKind = 'function' | 'variable' | 'macro' | 'type'

export interface FileSymbol {
  name: string
  kind: SymbolKind
  /** Строка объявления (с 1). */
  line: number
  /** Тип переменной или возвращаемый тип функции. */
  type?: string
  /** Имена параметров функции / функционального макроса. */
  params?: string[]
  /** Текст сигнатуры или значение макроса — для подсказок. */
  detail: string
}

const NOT_TYPES = new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'return', 'goto', 'new', 'delete', 'sizeof', 'using', 'typedef', 'throw', 'break', 'continue', 'namespace', 'template', 'public', 'private', 'protected'])
const MODS = '(?:(?:static|inline|extern|const|volatile|unsigned|signed|constexpr|register|IRAM_ATTR|ICACHE_RAM_ATTR|RTC_DATA_ATTR|PROGMEM)\\s+)*'
const FUNC_RE = new RegExp(`^\\s*${MODS}([A-Za-z_][\\w:<>,]*(?:\\s*[*&]+\\s*|\\s+))(?:(?:IRAM_ATTR|ICACHE_RAM_ATTR)\\s+)?([A-Za-z_]\\w*)\\s*\\(([^()]*)\\)\\s*(?:const\\s*)?(?:noexcept\\s*)?(\\{|;|$)`)
const VAR_RE = new RegExp(`^\\s*${MODS}([A-Za-z_][\\w:]*(?:<[^<>;]*>)?(?:\\s*[*&]+\\s*|\\s+))([A-Za-z_]\\w*)\\s*(\\[[^\\]]*\\])?\\s*(=|;|,|\\(|\\{)`)
const TYPE_RE = /^\s*(?:typedef\s+)?(?:struct|class|enum(?:\s+class)?|union)\s+([A-Za-z_]\w*)/
const DEFINE_RE = /^\s*#\s*define\s+([A-Za-z_]\w*)(\(([^)]*)\))?[ \t]*(.*)$/

/** Похоже ли содержимое скобок на список параметров функции (а не аргументы конструктора). */
function looksLikeParams(args: string, retType: string): boolean {
  const a = args.trim()
  if (a === '' || a === 'void') return true
  if (/^void\b/.test(retType.trim())) return true
  return a.split(',').every((p) => /^[\s\w:<>*&]*[\s*&]\w+\s*(=.*)?$/.test(p.trim()) || /\.\.\./.test(p))
}

function paramNames(args: string): string[] {
  const a = args.trim()
  if (!a || a === 'void') return []
  return a.split(',').map((p) => {
    const m = /([A-Za-z_]\w*)\s*(\[[^\]]*\])?\s*(=.*)?$/.exec(p.trim())
    return m ? m[1] : p.trim()
  })
}

export function extractSymbols(text: string): FileSymbol[] {
  const { masked } = scan(text)
  const lines = masked.split('\n')
  const raw = text.split('\n')
  const symbols: FileSymbol[] = []
  const seen = new Set<string>()
  const add = (s: FileSymbol): void => {
    const key = s.kind + ':' + s.name
    if (seen.has(key)) return
    seen.add(key)
    symbols.push(s)
  }

  let depth = 0
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].replace(/\r$/, '')
    const startDepth = depth
    // #define читаем по исходной строке (значение может содержать строку)
    const dm = DEFINE_RE.exec(raw[li].replace(/\r$/, ''))
    if (dm) {
      const value = dm[4].replace(/\/\/.*$/, '').trim()
      add({
        name: dm[1],
        kind: 'macro',
        line: li + 1,
        params: dm[2] ? dm[3].split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        detail: `#define ${dm[1]}${dm[2] ?? ''}${value ? ' ' + value : ''}`
      })
    } else if (!/^\s*#/.test(line)) {
      if (startDepth === 0) {
        const tm = TYPE_RE.exec(line)
        if (tm) add({ name: tm[1], kind: 'type', line: li + 1, detail: line.trim().replace(/\s*\{.*$/, '') })
        const fm = FUNC_RE.exec(line)
        if (fm && !NOT_TYPES.has(fm[1].trim().split(/\s+/)[0]) && !NOT_TYPES.has(fm[2]) && looksLikeParams(fm[3], fm[1]) && !tm) {
          add({
            name: fm[2],
            kind: 'function',
            line: li + 1,
            type: fm[1].trim(),
            params: paramNames(fm[3]),
            detail: `${fm[1].trim()} ${fm[2]}(${fm[3].trim()})`
          })
        } else if (!tm) {
          const vm = VAR_RE.exec(line)
          if (vm && !NOT_TYPES.has(vm[1].trim().split(/\s+/)[0]) && !NOT_TYPES.has(vm[2])) {
            add({ name: vm[2], kind: 'variable', line: li + 1, type: vm[1].trim(), detail: `${vm[1].trim()} ${vm[2]}${vm[3] ?? ''}` })
          }
        }
      } else {
        // локальные переменные: только с «понятным» типом, чтобы не ловить вызовы и выражения
        const lm = /^\s*(?:(?:const|static|volatile|unsigned|signed)\s+)*((?:u?int(?:8|16|32|64)_t|int|long|short|float|double|char|bool|boolean|byte|word|size_t|String|unsigned\s+(?:int|long|char))\b[*&\s]*)([A-Za-z_]\w*)\s*(\[[^\]]*\])?\s*(=|;|,)/.exec(line)
        if (lm) add({ name: lm[2], kind: 'variable', line: li + 1, type: lm[1].trim(), detail: `${lm[1].trim()} ${lm[2]}${lm[3] ?? ''}` })
        // параметры циклов for (int i = ...)
        const fl = /\bfor\s*\(\s*(?:const\s+)?(int|long|unsigned|byte|uint\d+_t|size_t|auto)\s+([A-Za-z_]\w*)\s*=/.exec(line)
        if (fl) add({ name: fl[2], kind: 'variable', line: li + 1, type: fl[1], detail: `${fl[1]} ${fl[2]}` })
      }
    }
    for (const ch of line) {
      if (ch === '{') depth++
      else if (ch === '}') depth = Math.max(0, depth - 1)
    }
  }
  return symbols
}

/** Имя переменной -> тип (для разрешения `server.on` -> `WebServer.on`). */
export function variableTypes(symbols: FileSymbol[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const s of symbols) {
    if (s.kind !== 'variable' || !s.type) continue
    const base = s.type.replace(/^(?:const|static|volatile|extern)\s+/g, '').replace(/<.*$/, '').replace(/[*&\s]+$/g, '').trim()
    if (/^[A-Za-z_]\w*$/.test(base)) out[s.name] = base
  }
  return out
}

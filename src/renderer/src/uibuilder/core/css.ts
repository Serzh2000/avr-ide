// Стили: проверка значений и компиляция в строку CSS для setPanelStyle / setElementStyle / setCustomCSS.
// Принцип: в вывод попадают только значения, прошедшие строгую проверку (белый список символов),
// поэтому в CSS и в C++-строки невозможно протащить ; { } " ' \ < > url() expression() и т. п.
import type { StyleSpec } from './types'

export type StyleKind = 'color' | 'length' | 'lengths' | 'shadow' | 'font' | 'weight' | 'align' | 'border' | 'opacity'

export interface StyleField {
  key: keyof StyleSpec
  css: string
  kind: StyleKind
  title: string
  /** Подсказка/пример. */
  hint: string
  /** Допустимые значения для выпадающего списка (если есть). */
  choices?: string[]
}

/** Порядок полей = порядок свойств в сгенерированной строке (детерминированно). */
export const STYLE_FIELDS: StyleField[] = [
  { key: 'color', css: 'color', kind: 'color', title: 'Цвет текста', hint: '#ffffff, rgba(0,0,0,.5), white' },
  { key: 'background', css: 'background', kind: 'color', title: 'Фон', hint: '#1abc9c' },
  { key: 'borderRadius', css: 'border-radius', kind: 'lengths', title: 'Скругление', hint: '12px' },
  { key: 'boxShadow', css: 'box-shadow', kind: 'shadow', title: 'Тень', hint: '0 4px 12px rgba(0,0,0,.35)' },
  { key: 'border', css: 'border', kind: 'border', title: 'Рамка', hint: '1px solid #ffffff' },
  { key: 'fontSize', css: 'font-size', kind: 'length', title: 'Размер шрифта', hint: '16px' },
  { key: 'fontWeight', css: 'font-weight', kind: 'weight', title: 'Начертание', hint: 'bold, 600' },
  { key: 'fontFamily', css: 'font-family', kind: 'font', title: 'Шрифт', hint: 'Segoe UI, Arial, sans-serif' },
  { key: 'textAlign', css: 'text-align', kind: 'align', title: 'Выравнивание', hint: 'left / center / right', choices: ['left', 'center', 'right', 'justify'] },
  { key: 'padding', css: 'padding', kind: 'lengths', title: 'Внутренний отступ', hint: '8px 12px' },
  { key: 'margin', css: 'margin', kind: 'lengths', title: 'Внешний отступ', hint: '4px' },
  { key: 'width', css: 'width', kind: 'length', title: 'Ширина', hint: '100%, 240px' },
  { key: 'minHeight', css: 'min-height', kind: 'length', title: 'Мин. высота', hint: '100px' },
  { key: 'opacity', css: 'opacity', kind: 'opacity', title: 'Прозрачность', hint: '0…1' }
]

const MAX_VALUE_LEN = 200
const LEN = String.raw`-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|%|vh|vw|vmin|vmax|pt|ch)?`
const RE_LEN = new RegExp(`^(?:${LEN}|auto|inherit)$`)
const RE_HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const RE_FUNC_COLOR = /^(?:rgb|rgba|hsl|hsla)\([0-9.%\s,/deg-]+\)$/
const RE_NAMED = /^[A-Za-z]{3,24}$/
const RE_SAFE_CHARS = /^[A-Za-z0-9#%.,()\s/-]+$/
const FORBIDDEN_WORDS = /(url|expression|javascript|import|var|attr|image|script|behavior|binding|calc)/i
const RE_FONT = /^[A-Za-z0-9 ,_-]+$/

function balancedParens(s: string): boolean {
  let d = 0
  for (const ch of s) {
    if (ch === '(') d++
    else if (ch === ')') {
      d--
      if (d < 0) return false
    }
  }
  return d === 0
}

function colorProblem(v: string): string | null {
  if (RE_HEX.test(v) || RE_FUNC_COLOR.test(v) || RE_NAMED.test(v)) return null
  return 'ожидается цвет: #rgb, #rrggbb, rgb()/rgba()/hsl()/hsla() или имя цвета'
}

/** Проблема со значением (текст) или null. Пустое значение — «не задано», это не проблема. */
export function styleValueProblem(kind: StyleKind, raw: string): string | null {
  const v = raw.trim()
  if (v === '') return null
  if (v.length > MAX_VALUE_LEN) return `слишком длинное значение (максимум ${MAX_VALUE_LEN} символов)`
  switch (kind) {
    case 'color':
      return colorProblem(v)
    case 'length':
      return RE_LEN.test(v) ? null : 'ожидается длина: число с px/em/rem/%/vh/vw или auto'
    case 'lengths': {
      const parts = v.split(/\s+/)
      if (parts.length > 4 || !parts.every((p) => RE_LEN.test(p))) return 'ожидается 1–4 длины через пробел (например 8px 12px)'
      return null
    }
    case 'shadow':
    case 'border': {
      if (v === 'none') return null
      if (!RE_SAFE_CHARS.test(v) || !balancedParens(v) || FORBIDDEN_WORDS.test(v))
        return 'недопустимые символы или слова (разрешены буквы, цифры, # % . , ( ) / -)'
      return null
    }
    case 'font':
      return RE_FONT.test(v) ? null : 'шрифт: буквы, цифры, пробел, запятая, дефис (без кавычек)'
    case 'weight':
      return /^(?:normal|bold|bolder|lighter|[1-9]00)$/.test(v) ? null : 'normal, bold, bolder, lighter или 100–900'
    case 'align':
      return /^(?:left|center|right|justify)$/.test(v) ? null : 'left, center, right или justify'
    case 'opacity': {
      const n = Number(v)
      return Number.isFinite(n) && n >= 0 && n <= 1 ? null : 'число от 0 до 1'
    }
  }
}

export interface StyleIssue {
  key: string
  message: string
}

/** Проблемы всех полей стиля. Неизвестные ключи — тоже проблема (защита от «левых» полей в ui.json). */
export function styleProblems(spec: StyleSpec | undefined): StyleIssue[] {
  const out: StyleIssue[] = []
  if (!spec || typeof spec !== 'object') return out
  const known = new Set<string>(STYLE_FIELDS.map((f) => f.key))
  for (const k of Object.keys(spec)) if (!known.has(k)) out.push({ key: k, message: `неизвестное свойство стиля «${k}»` })
  for (const f of STYLE_FIELDS) {
    const val = spec[f.key]
    if (val === undefined) continue
    if (typeof val !== 'string') {
      out.push({ key: f.key, message: `${f.title}: значение должно быть строкой` })
      continue
    }
    const p = styleValueProblem(f.kind, val)
    if (p) out.push({ key: f.key, message: `${f.title}: ${p}` })
  }
  return out
}

/** Компилирует стиль в «prop:value;…». Некорректные и пустые поля пропускаются. */
export function compileStyle(spec: StyleSpec | undefined): string {
  if (!spec || typeof spec !== 'object') return ''
  let out = ''
  for (const f of STYLE_FIELDS) {
    const val = spec[f.key]
    if (typeof val !== 'string') continue
    const v = val.trim().replace(/\s+/g, ' ')
    if (v === '' || styleValueProblem(f.kind, v)) continue
    out += `${f.css}:${v};`
  }
  return out
}

/** Стиль задан (после фильтрации непустых корректных полей). */
export function hasStyle(spec: StyleSpec | undefined): boolean {
  return compileStyle(spec) !== ''
}

/** Название CSS-класса (один или несколько через пробел). */
export function classProblem(cls: string): string | null {
  const v = cls.trim()
  if (v === '') return null
  if (v.length > 64) return 'слишком длинное имя класса (максимум 64 символа)'
  return /^[A-Za-z_][A-Za-z0-9_-]*(?: [A-Za-z_][A-Za-z0-9_-]*)*$/.test(v)
    ? null
    : 'класс: латинские буквы, цифры, _ и -, не начинается с цифры'
}

/** Преобразует стиль в объект для React (camelCase), для превью на холсте. */
export function styleToReact(spec: StyleSpec | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!spec) return out
  for (const f of STYLE_FIELDS) {
    const val = spec[f.key]
    if (typeof val !== 'string') continue
    const v = val.trim()
    if (v === '' || styleValueProblem(f.kind, v)) continue
    out[f.key] = v
  }
  return out
}

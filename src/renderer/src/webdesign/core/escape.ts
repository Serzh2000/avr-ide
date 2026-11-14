// Безопасное экранирование пользовательских значений для HTML / CSS / JS / C++.
import type { ColorValue, PaletteKey } from './types'
import { PALETTE_KEYS } from './types'

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** JSON для вставки внутрь <script>: исключает «</script», «<!--» и разделители строк U+2028/2029. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/** Конечное число или запасное значение; ограничивает диапазон. */
export function num(v: unknown, fallback: number, min = -1e6, max = 1e6): number {
  const n = typeof v === 'number' ? v : Number.NaN
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/** Число в CSS/JS без экспоненты и хвостов. */
export function fmt(n: number): string {
  const r = Math.round(n * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}

const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const FUNC = /^(?:rgb|hsl)a?\(\s*[0-9.%\s,/-]+\)$/i

export function isPaletteKey(v: string): v is PaletteKey {
  return (PALETTE_KEYS as readonly string[]).includes(v)
}

/** Допустим ли цвет (токен палитры или безопасный литерал). */
export function isColor(v: unknown): v is ColorValue {
  if (typeof v !== 'string') return false
  return isPaletteKey(v) || v === 'transparent' || HEX.test(v) || FUNC.test(v)
}

/** Значение цвета для CSS либо null, если оно небезопасно/некорректно. Токены → var(--wd-…). */
export function colorCss(v: unknown): string | null {
  if (!isColor(v)) return null
  return isPaletteKey(v) ? `var(--wd-${v})` : v
}

/** Литерал цвета без токенов (для палитры темы): #hex / rgb / hsl либо null. */
export function literalColor(v: unknown): string | null {
  if (typeof v !== 'string') return null
  return HEX.test(v) || FUNC.test(v) ? v : null
}

const BLOCK_ID = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/
export function isBlockId(id: string): boolean {
  return BLOCK_ID.test(id)
}

/** Допустимый src картинки: data:image base64 либо относительный путь без схемы. */
export function isSafeImageSrc(src: string): boolean {
  if (/^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(src)) return true
  return /^[A-Za-z0-9_][A-Za-z0-9_./-]{0,120}$/.test(src) && !src.includes('..')
}

// ---------- C++ ----------

const CPP_KEYWORDS = new Set(
  ('alignas alignof and and_eq asm auto bitand bitor bool break case catch char class compl const constexpr ' +
    'const_cast continue decltype default delete do double dynamic_cast else enum explicit export extern false ' +
    'float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq ' +
    'private protected public register reinterpret_cast return short signed sizeof static static_assert static_cast ' +
    'struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual ' +
    'void volatile wchar_t while xor xor_eq').split(' ')
)

const RESERVED = new Set(
  ('setup loop main Serial WiFi ESP String HIGH LOW INPUT OUTPUT INPUT_PULLUP LED_BUILTIN A0 millis micros delay ' +
    'delayMicroseconds pinMode digitalWrite digitalRead analogRead analogWrite ledcWrite ledcSetup ledcAttach ' +
    'ledcAttachPin constrain min max abs round map random AsyncWebServer AsyncWebSocket AsyncWebSocketClient ' +
    'AwsEventType AwsFrameInfo WS_EVT_CONNECT WS_EVT_DATA WS_EVT_DISCONNECT HTTP_GET NULL INT_MIN INT_MAX ' +
    'server client type data len arg now msg key raw').split(' ')
)

export function isCppIdentifier(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
}

/** Текст проблемы либо null, если имя годится для переменной прошивки. */
export function identProblem(name: string): string | null {
  if (!name) return 'имя не задано'
  if (!isCppIdentifier(name)) return 'допустимы латинские буквы, цифры и _, первый символ — не цифра'
  if (name.length > 40) return 'слишком длинное имя (максимум 40 символов)'
  if (name.includes('__')) return 'двойное подчёркивание зарезервировано в C++'
  if (name.startsWith('_')) return 'не начинайте имя с подчёркивания'
  if (CPP_KEYWORDS.has(name)) return 'это ключевое слово C++'
  if (RESERVED.has(name)) return 'имя занято Arduino/ESPAsyncWebServer/генератором'
  if (/^(wd_|WD_|wd[A-Z])/.test(name)) return 'префикс wd_/WD_/wd… зарезервирован для генератора'
  if (/^(GPIO|gpio|A|D)\d+$/.test(name)) return 'имя совпадает с пином платы или ключом пина (gpioN)'
  return null
}

/** Литерал строки C++: экранирует \, ", управляющие символы и «??» (триграфы); UTF-8 остаётся как есть. */
export function cppString(s: string): string {
  let out = '"'
  for (const ch of String(s)) {
    const c = ch.codePointAt(0) as number
    if (ch === '\\') out += '\\\\'
    else if (ch === '"') out += '\\"'
    else if (ch === '\n') out += '\\n'
    else if (ch === '\r') out += '\\r'
    else if (ch === '\t') out += '\\t'
    else if (ch === '?') out += '\\?'
    else if (c < 0x20 || c === 0x7f) out += '\\x' + c.toString(16).padStart(2, '0') + '""'
    else out += ch
  }
  return out + '"'
}

/** Разделитель raw-строки C++, которого заведомо нет в содержимом. */
export function rawDelimiter(content: string, base = 'WDPAGE'): string {
  let d = base
  let i = 0
  while (content.includes(`)${d}"`)) d = base + String(++i)
  return d
}

/** Число в JS/C++ без экспоненты (для литералов). */
export function intLiteral(n: number): string {
  return String(Math.trunc(Number.isFinite(n) ? n : 0))
}

/** Размер строки в байтах UTF-8. */
export function utf8Length(s: string): number {
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c < 0x80) n += 1
    else if (c < 0x800) n += 2
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4
      i++
    } else n += 3
  }
  return n
}

/** Собственное свойство объекта (защита от 'constructor', '__proto__' и т.п. в ключах из JSON). */
export function has(obj: object, key: unknown): boolean {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key)
}

// Вспомогательные функции C++: идентификаторы, литералы.
import type { UiVariable, VarType } from './types'

const CPP_KEYWORDS = [
  'alignas', 'alignof', 'and', 'and_eq', 'asm', 'auto', 'bitand', 'bitor', 'bool', 'break', 'case',
  'catch', 'char', 'class', 'compl', 'const', 'constexpr', 'const_cast', 'continue', 'decltype',
  'default', 'delete', 'do', 'double', 'dynamic_cast', 'else', 'enum', 'explicit', 'export',
  'extern', 'false', 'float', 'for', 'friend', 'goto', 'if', 'inline', 'int', 'long', 'mutable',
  'namespace', 'new', 'noexcept', 'not', 'not_eq', 'nullptr', 'operator', 'or', 'or_eq', 'private',
  'protected', 'public', 'register', 'reinterpret_cast', 'return', 'short', 'signed', 'sizeof',
  'static', 'static_assert', 'static_cast', 'struct', 'switch', 'template', 'this', 'thread_local',
  'throw', 'true', 'try', 'typedef', 'typeid', 'typename', 'union', 'unsigned', 'using', 'virtual',
  'void', 'volatile', 'wchar_t', 'while', 'xor', 'xor_eq'
]

/** Имена, которые нельзя использовать: Arduino/ESP/ESPUI и то, что объявляет сам генератор. */
const RESERVED = [
  'setup', 'loop', 'main', 'Serial', 'WiFi', 'ESPUI', 'ESP', 'String', 'Control', 'ControlType',
  'ControlColor', 'Verbosity', 'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'LED_BUILTIN',
  'A0', 'millis', 'micros', 'delay', 'delayMicroseconds', 'pinMode', 'digitalWrite', 'digitalRead',
  'analogRead', 'analogWrite', 'ledcWrite', 'ledcSetup', 'ledcAttach', 'ledcAttachPin', 'constrain',
  'min', 'max', 'abs', 'round', 'map', 'random', 'sender', 'type', 'val', 'on', 'cur', 'prev',
  'ssid', 'password', 'B_DOWN', 'B_UP', 'S_ACTIVE', 'S_INACTIVE', 'SL_VALUE', 'N_VALUE', 'T_VALUE',
  'S_VALUE', 'NULL', 'INT_MIN', 'INT_MAX',
  // libc/Arduino: имена, которые ломают компиляцию как глобальные переменные
  'clock', 'time', 'rand', 'srand', 'div', 'exit', 'printf', 'log', 'exp', 'sin', 'cos', 'tan', 'pow',
  'sqrt', 'floor', 'ceil', 'index', 'signal', 'remove', 'rename', 'free', 'malloc', 'system', 'getenv',
  'errno', 'stdin', 'stdout', 'stderr', 'bit', 'word', 'byte', 'boolean', 'sq', 'radians', 'degrees',
  'lowByte', 'highByte', 'tone', 'noTone', 'Wire', 'SPI', 'EEPROM', 'Preferences', 'yield', 'sleep',
  'abort', 'atoi', 'atof', 'strlen', 'memcpy', 'memset', 'tm', 'size_t'
]

const KEYWORD_SET = new Set(CPP_KEYWORDS)
const RESERVED_SET = new Set(RESERVED)

/** Префиксы, которыми генератор называет свои сущности. */
export const GENERATED_PREFIXES = ['cb_', 'ui_', 'UI_', 'UIGEN_']

export function isCppIdentifier(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
}

/** Возвращает текст проблемы или null, если имя годится. */
export function identProblem(name: string): string | null {
  if (!name) return 'имя не задано'
  if (!isCppIdentifier(name)) return 'допустимы латинские буквы, цифры и _, первый символ — не цифра'
  if (name.length > 48) return 'слишком длинное имя (максимум 48 символов)'
  if (name.includes('__')) return 'двойное подчёркивание зарезервировано в C++'
  if (name.startsWith('_')) return 'не начинайте имя с подчёркивания'
  if (KEYWORD_SET.has(name)) return 'это ключевое слово C++'
  if (RESERVED_SET.has(name)) return 'имя занято Arduino/ESPUI/генератором'
  for (const p of GENERATED_PREFIXES)
    if (name.startsWith(p)) return `префикс «${p}» зарезервирован для генератора`
  if (/^(GPIO|A)\d+$/.test(name) || /^D\d+$/.test(name)) return 'имя совпадает с макросом пина платы'
  return null
}

/** Литерал строки C++: экранирует \, ", управляющие символы; UTF-8 остаётся как есть. */
export function cppString(s: string): string {
  let out = '"'
  for (const ch of s) {
    const c = ch.codePointAt(0) as number
    if (ch === '\\') out += '\\\\'
    else if (ch === '"') out += '\\"'
    else if (ch === '\n') out += '\\n'
    else if (ch === '\r') out += '\\r'
    else if (ch === '\t') out += '\\t'
    else if (c < 0x20 || c === 0x7f) out += '\\x' + c.toString(16).padStart(2, '0') + '""'
    else if (ch === '?') out += '\\?' // исключает триграфы
    else out += ch
  }
  return out + '"'
}

export function cppType(t: VarType): string {
  return t
}

/** Проверка литерала начального значения; null — корректно. */
export function initProblem(type: VarType, init: string): string | null {
  const s = init.trim()
  if (type === 'String') return null
  if (s === '') return null
  if (type === 'bool') return /^(true|false|0|1)$/.test(s) ? null : 'для bool допустимо true/false/0/1'
  if (type === 'int') {
    if (!/^-?\d+$/.test(s)) return 'для int нужно целое число'
    const n = Number(s)
    if (n > 2147483647 || n < -2147483648) return 'значение вне диапазона int32'
    return null
  }
  return /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s) ? null : 'для float нужно число (например 21.5)'
}

/** Литерал C++ начального значения переменной. */
export function varInitLiteral(v: UiVariable): string {
  const s = v.init.trim()
  switch (v.type) {
    case 'bool':
      return s === 'true' || s === '1' ? 'true' : 'false'
    case 'int':
      return s === '' ? '0' : String(parseInt(s, 10))
    case 'float': {
      if (s === '') return '0.0f'
      const n = Number(s)
      if (!Number.isFinite(n)) return '0.0f'
      const txt = /[.eE]/.test(String(n)) ? String(n) : n.toFixed(1)
      return txt + 'f'
    }
    case 'String':
      return cppString(v.init)
  }
}

/** Число в литерал для int-параметров ESPUI (округляется). */
export function intLiteral(n: number): string {
  return String(Math.round(n))
}

/** Число как литерал float C++ (всегда с точкой и суффиксом f). */
export function floatLiteral(n: number): string {
  const t = String(n)
  return (/[.eE]/.test(t) ? t : t + '.0') + 'f'
}

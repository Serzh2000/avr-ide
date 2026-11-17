// Разбор и сборка FQBN с параметрами платы: vendor:arch:board[:опция=значение,опция=значение].
// Чистые функции без Electron — используются и в main (проверка входных данных), и в renderer.

export type PlatformKind = 'avr' | 'esp8266' | 'esp32' | 'stm32' | 'rp2040' | 'generic'

const PART_RE = /^[A-Za-z0-9_.+-]+$/
const KEY_RE = /^[A-Za-z0-9_.-]{1,60}$/
const VALUE_RE = /^[A-Za-z0-9_.+-]{1,80}$/
/** Первый символ vendor — не «-»: иначе строку можно принять за флаг командной строки. */
const VENDOR_RE = /^[A-Za-z0-9_][A-Za-z0-9_.+-]*$/
export const MAX_FQBN_LEN = 400

export interface ParsedFqbn {
  vendor: string
  arch: string
  board: string
  /** Параметры в том порядке, в котором они записаны */
  options: [string, string][]
}

export const isOptionKey = (s: unknown): s is string => typeof s === 'string' && KEY_RE.test(s)
export const isOptionValue = (s: unknown): s is string => typeof s === 'string' && VALUE_RE.test(s)

/** Разбирает и строго проверяет FQBN. null — строка недопустима (лишние символы, пустые или повторяющиеся опции). */
export function parseFqbn(s: unknown): ParsedFqbn | null {
  if (typeof s !== 'string' || s.length === 0 || s.length > MAX_FQBN_LEN) return null
  const parts = s.split(':')
  if (parts.length < 3 || parts.length > 4) return null
  const [vendor, arch, board, rest] = parts
  if (!VENDOR_RE.test(vendor) || !PART_RE.test(arch) || !PART_RE.test(board)) return null
  const options: [string, string][] = []
  if (parts.length === 4) {
    if (rest === '') return null
    const seen = new Set<string>()
    for (const pair of rest.split(',')) {
      const eq = pair.indexOf('=')
      if (eq <= 0) return null
      const k = pair.slice(0, eq)
      const v = pair.slice(eq + 1)
      if (!isOptionKey(k) || !isOptionValue(v) || seen.has(k)) return null
      seen.add(k)
      options.push([k, v])
    }
  }
  return { vendor, arch, board, options }
}

export const isFqbn = (s: unknown): s is string => parseFqbn(s) !== null

/** FQBN без параметров: vendor:arch:board. Для недопустимой строки — первые три части как есть. */
export const baseFqbn = (fqbn: string): string => fqbn.split(':').slice(0, 3).join(':')

/** Параметры из FQBN (для недопустимой строки — пусто). */
export function fqbnOptions(fqbn: string): Record<string, string> {
  const p = parseFqbn(fqbn)
  return p ? Object.fromEntries(p.options) : {}
}

/** Собирает FQBN из базового и набора параметров (порядок — как в объекте). Недопустимые пары отбрасываются. */
export function buildFqbn(base: string, options: Record<string, string>): string {
  const b = baseFqbn(base)
  const pairs = Object.entries(options).filter(([k, v]) => isOptionKey(k) && isOptionValue(v))
  return pairs.length ? `${b}:${pairs.map(([k, v]) => `${k}=${v}`).join(',')}` : b
}

/** Меняет один параметр; value === null — убирает его (вернуть значение по умолчанию). */
export function withOption(fqbn: string, key: string, value: string | null): string {
  const o = fqbnOptions(fqbn)
  if (value === null) delete o[key]
  else o[key] = value
  return buildFqbn(fqbn, o)
}

/** Платформа по FQBN. null — FQBN пуст; незнакомое ядро — 'generic'. */
export function platformOfFqbn(fqbn: string | null | undefined): PlatformKind | null {
  if (!fqbn) return null
  const [vendor = '', arch = ''] = fqbn.split(':')
  const v = vendor.toLowerCase()
  const a = arch.toLowerCase()
  if (a === 'avr') return 'avr'
  if (v === 'esp8266' || a === 'esp8266') return 'esp8266'
  if (v === 'esp32' || a === 'esp32') return 'esp32'
  if (a === 'stm32' || v === 'stmicroelectronics') return 'stm32'
  if (a === 'rp2040' || a === 'rp2350' || a === 'mbed_rp2040' || a === 'mbed_rp2350') return 'rp2040'
  return 'generic'
}

/** Нужен ли COM-порт для прошивки: required — да; optional — используется, если выбран (BOOTSEL/авто-сброс); none — не нужен. */
export type PortPolicy = 'required' | 'optional' | 'none'

/** Способы прошивки STM32, где нужен последовательный порт (остальные — ST-Link/DFU/диск/USB-HID — без порта). */
const STM32_SERIAL_METHODS = /serial|stm32flash|bmp|maple|usbasp|jlink_serial/i

/**
 * Политика порта по FQBN. Для STM32 решает upload_method (явный в FQBN или переданный как значение по умолчанию),
 * для RP2040 порт необязателен (плата может быть в режиме BOOTSEL и видна как диск).
 */
export function portPolicy(fqbn: string, defaults: Record<string, string> = {}): PortPolicy {
  const kind = platformOfFqbn(fqbn)
  if (kind === 'rp2040') return 'optional'
  if (kind === 'stm32') {
    const method = fqbnOptions(fqbn)['upload_method'] ?? defaults['upload_method']
    if (!method) return 'optional'
    return STM32_SERIAL_METHODS.test(method) ? 'required' : 'none'
  }
  return 'required'
}

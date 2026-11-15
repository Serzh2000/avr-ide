import type { TargetPlatform } from '../contracts'

export interface BoardPreset { name: string; fqbn: string; core: string }

/** Популярные платы, которые показываем, даже если ядро ещё не установлено. */
export const BOARD_PRESETS: BoardPreset[] = [
  { name: 'Arduino Uno', fqbn: 'arduino:avr:uno', core: 'arduino:avr' },
  { name: 'Arduino Nano', fqbn: 'arduino:avr:nano', core: 'arduino:avr' },
  { name: 'Arduino Mega or Mega 2560', fqbn: 'arduino:avr:mega', core: 'arduino:avr' },
  { name: 'NodeMCU 1.0 (ESP-12E Module)', fqbn: 'esp8266:esp8266:nodemcuv2', core: 'esp8266:esp8266' },
  { name: 'ESP32 Dev Module', fqbn: 'esp32:esp32:esp32', core: 'esp32:esp32' },
  { name: 'ESP32S3 Dev Module', fqbn: 'esp32:esp32:esp32s3', core: 'esp32:esp32' },
  { name: 'ESP32C3 Dev Module', fqbn: 'esp32:esp32:esp32c3', core: 'esp32:esp32' }
]

export const BAUDS = [9600, 19200, 38400, 57600, 74880, 115200, 230400, 460800, 921600]

export type BoardGroup = 'AVR' | 'ESP8266' | 'ESP32' | 'Другие'
export const GROUP_ORDER: BoardGroup[] = ['AVR', 'ESP8266', 'ESP32', 'Другие']

/** Группа по FQBN (vendor:arch:board). */
export function groupOf(fqbn: string): BoardGroup {
  const [vendor, arch] = fqbn.split(':')
  if (arch === 'avr') return 'AVR'
  if (vendor === 'esp8266' || arch === 'esp8266') return 'ESP8266'
  if (vendor === 'esp32' || arch === 'esp32') return 'ESP32'
  return 'Другие'
}

export function platformOf(fqbn: string | null | undefined): TargetPlatform | null {
  if (!fqbn) return null
  const g = groupOf(fqbn)
  return g === 'ESP32' ? 'esp32' : g === 'ESP8266' ? 'esp8266' : g === 'AVR' ? 'avr' : null
}

/** Id ядра по FQBN: vendor:arch. */
export const coreOf = (fqbn: string): string => fqbn.split(':').slice(0, 2).join(':')

/** Базовые ядра для установки в один клик. */
export const BASE_CORES = [
  { id: 'arduino:avr', label: 'Arduino AVR', hint: 'Uno, Nano, Mega, Leonardo, Pro Mini', esp: false },
  { id: 'esp32:esp32', label: 'ESP32', hint: 'ESP32, S3, C3 (Espressif)', esp: true },
  { id: 'esp8266:esp8266', label: 'ESP8266', hint: 'NodeMCU, Wemos D1, ESP-01', esp: true }
] as const

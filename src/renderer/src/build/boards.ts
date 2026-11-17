import type { TargetPlatform } from '../contracts'
import { baseFqbn, platformOfFqbn } from '../../../main/cli/fqbn'

export interface BoardPreset { name: string; fqbn: string; core: string }

/** Популярные платы, которые показываем, даже если ядро ещё не установлено. */
export const BOARD_PRESETS: BoardPreset[] = [
  { name: 'Arduino Uno', fqbn: 'arduino:avr:uno', core: 'arduino:avr' },
  { name: 'Arduino Nano', fqbn: 'arduino:avr:nano', core: 'arduino:avr' },
  { name: 'Arduino Mega or Mega 2560', fqbn: 'arduino:avr:mega', core: 'arduino:avr' },
  { name: 'Arduino Leonardo', fqbn: 'arduino:avr:leonardo', core: 'arduino:avr' },
  { name: 'NodeMCU 1.0 (ESP-12E Module)', fqbn: 'esp8266:esp8266:nodemcuv2', core: 'esp8266:esp8266' },
  { name: 'LOLIN(WEMOS) D1 R2 & mini', fqbn: 'esp8266:esp8266:d1_mini', core: 'esp8266:esp8266' },
  { name: 'Generic ESP8266 Module', fqbn: 'esp8266:esp8266:generic', core: 'esp8266:esp8266' },
  { name: 'ESP32 Dev Module', fqbn: 'esp32:esp32:esp32', core: 'esp32:esp32' },
  { name: 'ESP32S3 Dev Module', fqbn: 'esp32:esp32:esp32s3', core: 'esp32:esp32' },
  { name: 'ESP32C3 Dev Module', fqbn: 'esp32:esp32:esp32c3', core: 'esp32:esp32' },
  { name: 'DOIT ESP32 DEVKIT V1', fqbn: 'esp32:esp32:esp32doit-devkit-v1', core: 'esp32:esp32' },
  { name: 'ESP32 Wrover Module', fqbn: 'esp32:esp32:esp32wrover', core: 'esp32:esp32' },
  // STM32duino: у «общих» плат конкретная модель задаётся параметром pnum — готовые варианты ниже подставляют его
  { name: 'Blue Pill F103C8 (STM32F103C8)', fqbn: 'STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C8', core: 'STMicroelectronics:stm32' },
  { name: 'Black Pill F411CE (STM32F411CE)', fqbn: 'STMicroelectronics:stm32:GenF4:pnum=BLACKPILL_F411CE', core: 'STMicroelectronics:stm32' },
  { name: 'Black Pill F401CC (STM32F401CC)', fqbn: 'STMicroelectronics:stm32:GenF4:pnum=BLACKPILL_F401CC', core: 'STMicroelectronics:stm32' },
  { name: 'Nucleo F401RE', fqbn: 'STMicroelectronics:stm32:Nucleo_64:pnum=NUCLEO_F401RE', core: 'STMicroelectronics:stm32' },
  { name: 'Nucleo F411RE', fqbn: 'STMicroelectronics:stm32:Nucleo_64:pnum=NUCLEO_F411RE', core: 'STMicroelectronics:stm32' },
  { name: 'Nucleo L476RG', fqbn: 'STMicroelectronics:stm32:Nucleo_64:pnum=NUCLEO_L476RG', core: 'STMicroelectronics:stm32' },
  { name: 'Nucleo F103RB', fqbn: 'STMicroelectronics:stm32:Nucleo_64:pnum=NUCLEO_F103RB', core: 'STMicroelectronics:stm32' },
  // Raspberry Pi Pico: ядро Earle Philhower (arduino-pico)
  { name: 'Raspberry Pi Pico', fqbn: 'rp2040:rp2040:rpipico', core: 'rp2040:rp2040' },
  { name: 'Raspberry Pi Pico W', fqbn: 'rp2040:rp2040:rpipicow', core: 'rp2040:rp2040' },
  { name: 'Raspberry Pi Pico 2', fqbn: 'rp2040:rp2040:rpipico2', core: 'rp2040:rp2040' },
  { name: 'Raspberry Pi Pico 2 W', fqbn: 'rp2040:rp2040:rpipico2w', core: 'rp2040:rp2040' },
  { name: 'Raspberry Pi Pico (официальное ядро Arduino Mbed)', fqbn: 'arduino:mbed_rp2040:pico', core: 'arduino:mbed_rp2040' }
]

export const BAUDS = [9600, 19200, 38400, 57600, 74880, 115200, 230400, 460800, 921600]

export type BoardGroup = 'STM32' | 'RP2040' | 'ESP32' | 'ESP8266' | 'AVR' | 'Другие'
export const GROUP_ORDER: BoardGroup[] = ['STM32', 'RP2040', 'ESP32', 'ESP8266', 'AVR', 'Другие']

/** Группа по FQBN (vendor:arch:board[:опции]). */
export function groupOf(fqbn: string): BoardGroup {
  switch (platformOfFqbn(fqbn)) {
    case 'stm32': return 'STM32'
    case 'rp2040': return 'RP2040'
    case 'esp32': return 'ESP32'
    case 'esp8266': return 'ESP8266'
    case 'avr': return 'AVR'
    default: return 'Другие'
  }
}

/** Платформа выбранной платы. Незнакомые ядра — 'generic'; без платы — null. */
export function platformOf(fqbn: string | null | undefined): TargetPlatform | null {
  return platformOfFqbn(fqbn)
}

/** Платы с Wi-Fi-стеком ESP: только для них работают ESPUI и веб-дизайнер. */
export const isEspPlatform = (p: TargetPlatform | null | undefined): boolean => p === 'esp32' || p === 'esp8266'

export { baseFqbn }

/** Id ядра по FQBN: vendor:arch. */
export const coreOf = (fqbn: string): string => fqbn.split(':').slice(0, 2).join(':')

/** Ядра сторонних источников, которые ставятся в один клик (адрес берётся из проверенного каталога). */
export const SOURCE_CORES = [
  {
    id: 'STMicroelectronics:stm32', label: 'STM32', hint: 'Nucleo, Blue Pill, Black Pill, Discovery (STM32duino)',
    source: { name: 'STM32 (STMicroelectronics)', url: 'https://github.com/stm32duino/BoardManagerFiles/raw/main/package_stmicroelectronics_index.json', https: true }
  },
  {
    id: 'rp2040:rp2040', label: 'Raspberry Pi Pico', hint: 'Pico, Pico W, Pico 2 — RP2040 и RP2350 (Earle Philhower)',
    source: { name: 'Raspberry Pi Pico/RP2040 (Earle Philhower)', url: 'https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json', https: true }
  }
] as const

/** Базовые ядра для установки в один клик. */
export const BASE_CORES = [
  { id: 'arduino:avr', label: 'Arduino AVR', hint: 'Uno, Nano, Mega, Leonardo, Pro Mini', esp: false },
  { id: 'esp32:esp32', label: 'ESP32', hint: 'ESP32, S3, C3 (Espressif)', esp: true },
  { id: 'esp8266:esp8266', label: 'ESP8266', hint: 'NodeMCU, Wemos D1, ESP-01', esp: true }
] as const

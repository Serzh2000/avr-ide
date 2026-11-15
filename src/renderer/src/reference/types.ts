/** Идентификаторы платформ справочника. */
export type PlatformId = 'avr' | 'esp8266' | 'esp32' | 'esp32s3' | 'esp32c3'

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  avr: 'AVR (Uno/Nano/Mega)',
  esp8266: 'ESP8266',
  esp32: 'ESP32',
  esp32s3: 'ESP32-S3',
  esp32c3: 'ESP32-C3'
}

export const ALL_PLATFORMS: PlatformId[] = ['avr', 'esp8266', 'esp32', 'esp32s3', 'esp32c3']
export const ESP32_FAMILY: PlatformId[] = ['esp32', 'esp32s3', 'esp32c3']

export interface FuncParam {
  name: string
  type: string
  desc: string
}

export interface FuncEntry {
  /** Имя как в коде, например "digitalWrite" или "Serial.begin" */
  name: string
  category: string
  signature: string
  description: string
  params: FuncParam[]
  returns: string
  example: string
  platforms: PlatformId[]
  /** Дополнительные заметки (включая сомнительные факты с пометкой «проверить») */
  notes?: string[]
  /** Предупреждения (ограничения, грабли) */
  warnings?: string[]
  /** Синонимы/альтернативные написания для поиска */
  aliases?: string[]
  /** Запись из библиотеки проекта (разобрана из заголовка): библиотека, файл и строка. Для встроенных записей нет. */
  source?: { lib: string; version?: string; header: string; line: number; kind: string }
}

export interface PinInfo {
  /** Подпись на плате: "D1", "A0", "GPIO4" */
  label: string
  /** Номер GPIO/пина в коде скетча; null — если нет цифрового номера */
  gpio: number | null
  functions: string[]
  notes?: string
  /** Особый пин: strapping / флэш / только вход и т.п. */
  special?: 'strapping' | 'flash' | 'input-only' | 'usb' | 'warning'
}

export interface BoardEntry {
  id: string
  name: string
  mcu: string
  platform: PlatformId
  pins: PinInfo[]
  notes?: string[]
}

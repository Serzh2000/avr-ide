/** Идентификаторы платформ справочника. */
export type PlatformId = 'avr' | 'esp8266' | 'esp32' | 'esp32s3' | 'esp32c3' | 'stm32' | 'rp2040' | 'esp32s2' | 'esp32c6' | 'samd' | 'teensy' | 'renesas' | 'nrf52' | 'esp32c2' | 'esp32h2' | 'silabs'

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  avr: 'AVR (Uno/Nano/Mega)',
  esp8266: 'ESP8266',
  esp32: 'ESP32',
  esp32s3: 'ESP32-S3',
  esp32c3: 'ESP32-C3',
  stm32: 'STM32',
  rp2040: 'RP2040 / RP2350 (Pico)',
  esp32s2: 'ESP32-S2',
  esp32c6: 'ESP32-C6',
  samd: 'SAM / SAMD (Zero, Due, Nano 33, Feather M0)',
  teensy: 'Teensy (PJRC)',
  renesas: 'Renesas RA (Arduino Uno R4)',
  nrf52: 'Nordic nRF52',
  esp32c2: 'ESP32-C2 (ESP8684)',
  esp32h2: 'ESP32-H2',
  silabs: 'Silicon Labs (Nano Matter)'
}

export const ALL_PLATFORMS: PlatformId[] = ['avr', 'esp8266', 'esp32', 'esp32s3', 'esp32c3', 'stm32', 'rp2040']
/** Платформы справочника плат: список функций использует ALL_PLATFORMS, платы — расширенный набор. */
export const BOARD_PLATFORMS: PlatformId[] = [...ALL_PLATFORMS, 'esp32s2', 'esp32c6', 'samd', 'teensy', 'renesas', 'nrf52', 'esp32c2', 'esp32h2', 'silabs']
/** Группы списка плат: заголовок и платформы (порядок групп — порядок в списке). */
export const BOARD_GROUPS: { title: string; platforms: PlatformId[] }[] = [
  { title: 'Arduino AVR', platforms: ['avr'] },
  { title: 'Arduino / Adafruit SAM и SAMD', platforms: ['samd'] },
  { title: 'ESP8266', platforms: ['esp8266'] },
  { title: 'ESP32', platforms: ['esp32', 'esp32s2', 'esp32s3', 'esp32c2', 'esp32c3', 'esp32c6', 'esp32h2'] },
  { title: 'STM32', platforms: ['stm32'] },
  { title: 'Raspberry Pi Pico', platforms: ['rp2040'] },
  { title: 'Arduino Renesas (Uno R4)', platforms: ['renesas'] },
  { title: 'Nordic nRF52', platforms: ['nrf52'] },
  { title: 'Silicon Labs (Matter)', platforms: ['silabs'] },
  { title: 'Teensy', platforms: ['teensy'] }
]
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

export type PinKind = 'power' | 'gnd' | 'reset' | 'ref' | 'nc'

export interface PinInfo {
  /** Уникальное в пределах платы имя: "D1", "A0", "GPIO4", "3V3", "GND" */
  label: string
  /** Номер GPIO/пина в коде скетча; null — если нет цифрового номера (питание, земля, сброс) */
  gpio: number | null
  functions: string[]
  notes?: string
  /** Особый пин: strapping / флэш / только вход и т.п. */
  special?: 'strapping' | 'flash' | 'input-only' | 'usb' | 'warning'
  /** Не GPIO: питание, земля, сброс, опорное напряжение, не подключён */
  kind?: PinKind
  /** Как писать вывод в скетче, если это не просто номер (STM32: «PC13», «PA5»; Nucleo: можно и «D13») */
  code?: string
  /** Вывод выдерживает 5 В (5V-tolerant) — по документации МК */
  fiveV?: boolean
  /** Не красить по периферии (на любом выводе доступно почти всё — RP2040): цвет — цифровой/аналоговый */
  plain?: boolean
}

/** Электрические характеристики выводов платы. */
export interface BoardElectrical {
  /** Логический уровень и допустимое напряжение на пинах */
  logic: string
  /** Какие выводы выдерживают 5 В (если уместно) */
  tolerant?: string
  /** Ток с одного вывода */
  current: string
  /** Питание платы */
  supply?: string
}

/** Элемент оформления платы (вид сверху). Координаты — мм от левого верхнего угла платы. */
export type BoardComp =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill?: string; r?: number }
  | { t: 'usb'; x: number; y: number; w: number; h: number; kind: 'a' | 'b' | 'micro' | 'mini' | 'c'; side: 'l' | 'r' | 't' | 'b' }
  | { t: 'chip'; x: number; y: number; w: number; h: number; text?: string; leads?: 'qfp' | 'dip' | 'sop' | 'none' }
  | { t: 'module'; x: number; y: number; w: number; h: number; text: string; ant: number; antSide: 't' | 'b' | 'l' | 'r' }
  | { t: 'btn'; x: number; y: number; label?: string; lp?: 'l' | 'r' | 't' | 'b' }
  | { t: 'led'; x: number; y: number; color: string; label?: string }
  | { t: 'jack'; x: number; y: number; w: number; h: number }
  | { t: 'xtal'; x: number; y: number; w: number; h: number }
  | { t: 'icsp'; x: number; y: number; vertical?: boolean }
  | { t: 'text'; x: number; y: number; text: string; size?: number; rot?: number; bold?: boolean }

/**
 * Гребёнка выводов. Токен — «имя» или «имя|надпись на плате»; число — дополнительный зазор в мм.
 * Имя — label пина платы; один и тот же пин (GND, 3V3) может встречаться несколько раз.
 */
export interface BoardHeader {
  x: number
  y: number
  dir: 'down' | 'right'
  pins: (string | number)[]
  /** С какой стороны от платы подписи */
  labels: 'l' | 'r' | 't' | 'b'
  /** Только надпись, без тегов функций (плотные или внутренние контакты) */
  bare?: boolean
  /** Точные координаты выводов, мм (из рисунка платы); тогда x, y и dir не используются, а pins — по одному токену на точку */
  pts?: [number, number][]
}

export interface BoardLayout {
  /** Габариты платы, мм */
  w: number
  h: number
  /** Цвет текстолита */
  pcb: string
  corner?: number
  headers: BoardHeader[]
  comps: BoardComp[]
  /** Подпись к габаритам */
  size?: string
  /** Монтажные отверстия */
  holes?: [number, number][]
  /** Готовый рисунок платы (id в data/boardArt) — тогда comps/pcb не рисуются */
  art?: string
}

export interface BoardEntry {
  id: string
  name: string
  mcu: string
  platform: PlatformId
  /** Как называется номер пина в карточке пина (по умолчанию «GPIO»; для плат с номерами Arduino — «Пин Arduino №») */
  numLabel?: string
  pins: PinInfo[]
  notes?: string[]
  electrical?: BoardElectrical
  /** Первоисточники распиновки (документация производителя, схема) */
  source?: string[]
  /** Характеристики платы: ядро, частота, память и т.п. (подпись, значение) */
  specs?: [string, string][]
}

// Модель конфигурации выводов и тактирования Pro-проекта: файл avride.pins.json (схема 1).
// Чистые типы и константы: без Electron и DOM, годятся и для main, и для renderer.

/** Имя файла в корне проекта, рядом с avride.project.json. */
export const PINS_FILE = 'avride.pins.json'
export const PINS_SCHEMA = 1

export type GpioRole = 'input' | 'output' | 'analog' | 'exti'
export type Pull = 'none' | 'up' | 'down'
export type Speed = 'low' | 'medium' | 'high' | 'veryhigh'
export type OType = 'pp' | 'od'
export type Level = 'low' | 'high'
export type Edge = 'rising' | 'falling' | 'both'
export type GenMode = 'cmsis' | 'hal'

export const GPIO_ROLES: readonly GpioRole[] = ['input', 'output', 'analog', 'exti']
export const PULLS: readonly Pull[] = ['none', 'up', 'down']
export const SPEEDS: readonly Speed[] = ['low', 'medium', 'high', 'veryhigh']
export const OTYPES: readonly OType[] = ['pp', 'od']
export const EDGES: readonly Edge[] = ['rising', 'falling', 'both']

/**
 * Вывод порта: роль GPIO (вход, выход, аналог, внешнее прерывание) и пользовательская метка.
 * Альтернативные функции (USART1_TX …) хранятся не здесь, а в peripherals[<ПЕРИФЕРИЯ>].signals: так конфликт «вывод занят двумя ролями» виден явно.
 * Для вывода с альтернативной функцией запись нужна только ради метки, подтверждения защищённого вывода, подтяжки и скорости.
 */
export interface PinCfg {
  role?: GpioRole
  pull?: Pull
  speed?: Speed
  otype?: OType
  /** Начальный уровень выхода */
  initial?: Level
  edge?: Edge
  /** Метка: LED, BTN … Становится именем в gpio.h (LED_PORT, LED_PIN, LED_ON()) */
  label?: string
  /** Пользователь подтвердил занятие защищённого вывода (SWD, генератор, BOOT0) */
  confirmed?: boolean
}

export interface PeriphCfg {
  enabled: boolean
  /** Сигнал → вывод: { "USART1_TX": "PA9" } */
  signals: Record<string, string>
  /** USART: скорость, бод (кадр всегда 8N1) */
  baud?: number
}

export type ClockSource = 'hsi' | 'hse' | 'pll'
export type PllSource = 'hsi' | 'hse'

export interface PllCfg {
  /** F4, G4: делитель входа */
  m?: number
  /** F4, G4: множитель */
  n?: number
  /** F4: делитель выхода SYSCLK (2, 4, 6, 8) */
  p?: number
  /** F4: делитель для USB, SDIO, RNG (2…15) */
  q?: number
  /** G4: делитель выхода SYSCLK (2, 4, 6, 8) */
  r?: number
  /** F1: множитель PLL (2…16) */
  mul?: number
  /** F1: делить HSE на 2 перед PLL */
  hseDiv2?: boolean
}

export interface ClockCfg {
  source: ClockSource
  /** Источник PLL (для source = pll) */
  pllSource: PllSource
  /** Частота внешнего генератора, Гц */
  hseHz: number
  /** Внешний генератор подаёт готовый сигнал (без кварца) */
  hseBypass: boolean
  pll: PllCfg
  ahbDiv: number
  apb1Div: number
  apb2Div: number
}

export interface PinsConfig {
  schemaVersion: typeof PINS_SCHEMA
  /** Идентификатор чипа в базе: «stm32f103c8» */
  chip: string
  /** Корпус из базы («LQFP48»); пусто — первый */
  package?: string
  /** Как генерировать код: регистры CMSIS или HAL (только если HAL-заголовки есть в проекте) */
  mode: GenMode
  pins: Record<string, PinCfg>
  peripherals: Record<string, PeriphCfg>
  clock: ClockCfg
}

export interface PinIssue {
  severity: 'error' | 'warning' | 'info'
  /** Короткий код для тестов и подсветки */
  code: string
  message: string
  pin?: string
  periph?: string
}

// Модель проекта «Веб-конструктор». Источник истины — project.json.
// ВАЖНО: файлы core/* без enum и parameter properties — их запускает напрямую Node (type stripping).

export const WD_VERSION = 1
/** Версия генератора; пишется в заголовки сгенерированных файлов. */
export const GENERATOR_VERSION = 1

export type Platform = 'esp8266' | 'esp32'
export type VarType = 'bool' | 'int' | 'float' | 'String'

export interface WdVariable {
  name: string
  type: VarType
  /** Литерал начального значения (текстом). Пусто => значение по умолчанию типа. */
  init: string
}

export type BlockType =
  | 'section'
  | 'grid'
  | 'flex'
  | 'card'
  | 'heading'
  | 'text'
  | 'button'
  | 'switch'
  | 'slider'
  | 'input'
  | 'color'
  | 'sensor'
  | 'indicator'
  | 'gauge'
  | 'progress'
  | 'chart'
  | 'image'
  | 'icon'
  | 'divider'

/** Имя токена палитры или литерал цвета (#hex, rgb(), hsl(), transparent). */
export type ColorValue = string

export const PALETTE_KEYS = [
  'bg',
  'surface',
  'text',
  'muted',
  'primary',
  'accent',
  'success',
  'warning',
  'danger',
  'border'
] as const
export type PaletteKey = (typeof PALETTE_KEYS)[number]
export type Palette = Record<PaletteKey, string>

export type FontKey = 'sans' | 'serif' | 'mono' | 'rounded'
export type ShadowKey = 'none' | 'sm' | 'md' | 'lg'
export type AnimKey = 'none' | 'fade' | 'slide-up' | 'zoom' | 'pulse' | 'float' | 'glow'
export type IconName =
  | 'bulb'
  | 'thermometer'
  | 'droplet'
  | 'fan'
  | 'power'
  | 'wifi'
  | 'home'
  | 'sun'
  | 'moon'
  | 'bolt'
  | 'gauge'
  | 'bell'
  | 'lock'
  | 'cloud'

export const ICON_NAMES: IconName[] = [
  'bulb', 'thermometer', 'droplet', 'fan', 'power', 'wifi', 'home', 'sun', 'moon', 'bolt', 'gauge', 'bell', 'lock', 'cloud'
]

/**
 * Привязка блока.
 *  var — к переменной прошивки. toUi: устройство→страница, fromUi: страница→устройство, both: оба;
 *  pin — к пину. toPin: страница→пин (digitalWrite / PWM), fromPin: пин→страница (digitalRead / analogRead).
 */
export type Binding =
  | { kind: 'none' }
  | { kind: 'var'; variable: string; direction: 'toUi' | 'fromUi' | 'both' }
  | {
      kind: 'pin'
      pin: number
      direction: 'toPin' | 'fromPin'
      mode: 'digital' | 'analog'
      invert?: boolean
      pull?: 'none' | 'up'
    }

export interface BlockHover {
  bg?: ColorValue
  color?: ColorValue
  /** Приподнять (translateY(-3px)). */
  lift?: boolean
  /** Масштаб, 1 = без изменения. */
  scale?: number
  shadow?: ShadowKey
}

export interface Gradient {
  from: ColorValue
  to: ColorValue
  angle: number
}

export interface BlockStyle {
  bg?: ColorValue
  /** Градиент фона (перекрывает bg). */
  gradient?: Gradient
  color?: ColorValue
  /** Переопределения для тёмной темы. */
  darkBg?: ColorValue
  darkColor?: ColorValue
  darkGradient?: Gradient
  padding?: number
  margin?: number
  gap?: number
  radius?: number
  borderWidth?: number
  borderColor?: ColorValue
  shadow?: ShadowKey
  font?: FontKey
  /** Размер шрифта, px. */
  size?: number
  weight?: number
  align?: 'left' | 'center' | 'right'
  /** Ширина, % от родителя. */
  widthPct?: number
  maxWidth?: number
  minHeight?: number
  opacity?: number
  /** Сколько колонок занимает в сетке. */
  span?: number
  anim?: AnimKey
  animMs?: number
  animDelay?: number
  /** Длительность transition, мс. */
  transitionMs?: number
  hover?: BlockHover
}

export interface ResponsiveOverride {
  columns?: number
  direction?: 'row' | 'column'
  hidden?: boolean
  padding?: number
  size?: number
  align?: 'left' | 'center' | 'right'
  widthPct?: number
}

export interface BlockProps {
  /** Основной текст: heading / text / button. */
  text?: string
  /** Подпись: switch / slider / input / color / sensor / indicator / gauge / progress / chart / card (заголовок). */
  label?: string
  /** heading: уровень 1–4. */
  level?: number
  /** Вывод значения: единицы, префикс/суффикс, знаков после запятой. */
  unit?: string
  prefix?: string
  suffix?: string
  decimals?: number
  min?: number
  max?: number
  step?: number
  placeholder?: string
  inputType?: 'text' | 'number'
  /** button: momentary — true при нажатии и false при отпускании; send — одно значение `value` по клику. */
  action?: 'momentary' | 'send'
  value?: string
  /** grid: колонок на десктопе. */
  columns?: number
  /** flex */
  direction?: 'row' | 'column'
  wrap?: boolean
  justify?: 'start' | 'center' | 'end' | 'between'
  alignItems?: 'start' | 'center' | 'end' | 'stretch'
  icon?: IconName
  iconSize?: number
  /** image: data:image/...;base64,... или относительный путь. */
  src?: string
  alt?: string
  /** indicator: тексты состояний. */
  onText?: string
  offText?: string
  /** chart: число точек, заливка под линией. */
  points?: number
  fill?: boolean
}

export interface Block {
  /** Уникальный id (латиница/цифры/_/-). Используется как DOM-id и CSS-класс. */
  id: string
  type: BlockType
  props: BlockProps
  style: BlockStyle
  responsive?: { tablet?: ResponsiveOverride; mobile?: ResponsiveOverride }
  binding: Binding
  children: Block[]
}

export interface Theme {
  /** auto — по системной теме; light / dark — фиксированная начальная. */
  mode: 'auto' | 'light' | 'dark'
  /** Показывать кнопку переключения темы. */
  toggle: boolean
  light: Palette
  dark: Palette
  font: FontKey
  /** Базовый размер шрифта, px. */
  baseSize: number
  /** Базовый радиус скругления, px. */
  radius: number
  /** Максимальная ширина содержимого, px. */
  maxWidth: number
}

export interface PageSettings {
  title: string
  lang: string
  description: string
  theme: Theme
  /** Брейкпоинты (max-width), px. */
  tablet: number
  mobile: number
  /** Показывать индикатор соединения с устройством. */
  showStatus: boolean
  /** Максимальная задержка переподключения WebSocket, мс. */
  reconnectMs: number
}

export interface WifiSettings {
  mode: 'sta' | 'ap'
  ssid: string
  password: string
  apSsid: string
  apPassword: string
  hostname: string
}

export interface DeviceSettings {
  wsPath: string
  port: number
  /** Период опроса переменных/пинов на изменения, мс. */
  updateMs: number
  /** PWM (ESP32 ledc). */
  pwmFreq: number
  pwmBits: number
  /** ESP32: API LEDC ядра — v3 (ledcAttach) или v2 (ledcSetup/ledcAttachPin). */
  ledcApi: 'v2' | 'v3'
  /** Как отдавать страницу: send (форк ESP32Async) или send_P (старый me-no-dev). */
  serveApi: 'send' | 'send_P'
  serialLog: boolean
}

export interface WdProject {
  version: number
  platform: Platform
  page: PageSettings
  wifi: WifiSettings
  device: DeviceSettings
  variables: WdVariable[]
  /** Корневые блоки страницы (обычно секции). */
  blocks: Block[]
}

export type IssueSeverity = 'error' | 'warning'

export interface Issue {
  severity: IssueSeverity
  code: string
  message: string
  blockId?: string
  variable?: string
}

export interface SiteOutput {
  /** Разметка документа со ссылками на style.css и app.js. */
  html: string
  css: string
  js: string
  /** Один самодостаточный HTML-файл (CSS и JS встроены) — именно он идёт в прошивку. */
  bundle: string
}

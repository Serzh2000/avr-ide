// Модель проекта конструктора ESPUI. Источник истины — ui.json.
// ВАЖНО: файлы core/* без enum и parameter properties — их запускает напрямую Node (type stripping).

export const UI_JSON_VERSION = 2
/** Версия генератора; пишется в заголовок ui_generated.h. */
export const GENERATOR_VERSION = 2

export type Platform = 'esp8266' | 'esp32'
export type VarType = 'bool' | 'int' | 'float' | 'String'

export interface UiVariable {
  name: string
  type: VarType
  /** Литерал начального значения (как текст). Пусто => значение по умолчанию типа. */
  init: string
  /**
   * Переменная из скетча пользователя: генератор её НЕ объявляет (код использует её напрямую,
   * поэтому #include "ui_generated.h" должен стоять после её объявления). Тип и init подставляются по скетчу.
   */
  external?: boolean
}

/** Типы виджетов (подтверждённое подмножество ESPUI, см. data/espui/API_NOTES.md). */
export type WidgetType =
  | 'label'
  | 'button'
  | 'switcher'
  | 'slider'
  | 'number'
  | 'text'
  | 'select'
  | 'graph'
  | 'separator'
  | 'pad'
  | 'padCenter'
  | 'password'
  | 'time'
  | 'fileDisplay'
  | 'accel'

/** Цвета ESPUI (enum ControlColor из ESPUIcontrol.h). */
export type EspuiColor =
  | 'Turquoise'
  | 'Emerald'
  | 'Peterriver'
  | 'Wetasphalt'
  | 'Sunflower'
  | 'Carrot'
  | 'Alizarin'
  | 'Dark'
  | 'None'

export const ESPUI_COLORS: EspuiColor[] = [
  'Turquoise',
  'Emerald',
  'Peterriver',
  'Wetasphalt',
  'Sunflower',
  'Carrot',
  'Alizarin',
  'Dark',
  'None'
]

/**
 * Привязка элемента.
 *  none     — без привязки;
 *  var      — к переменной. toUi: device→UI (переменная показывается), fromUi: UI→device
 *             (callback пишет в переменную), both: оба направления;
 *  pin      — к пину. toPin: UI→pin (digitalWrite / analogWrite / ledcWrite),
 *             fromPin: pin→UI (digitalRead / analogRead);
 *  callback — вызов функции пользователя void fn(Control* sender, int type).
 */
export type Binding =
  | { kind: 'none' }
  | { kind: 'var'; variable: string; direction: 'toUi' | 'fromUi' | 'both' }
  | { kind: 'callback'; fn: string }
  | {
      kind: 'pin'
      pin: number
      direction: 'toPin' | 'fromPin'
      /** digital: digitalWrite/digitalRead; analog: PWM-запись или analogRead. */
      mode: 'digital' | 'analog'
      /** Инвертировать логику (digital). */
      invert?: boolean
      /** Подтяжка входа (digital fromPin). */
      pull?: 'none' | 'up'
      /** Имя пина из скетча (#define LED_PIN 2 / const int ledPin = 2): генератор пишет в код это имя вместо числа. */
      pinName?: string
    }

export type BindingKind = Binding['kind']

export interface SelectOption {
  label: string
  value: string
}

/** Структурированный CSS-стиль (панели или элемента). Значения проверяются core/css.ts. */
export interface StyleSpec {
  color?: string
  background?: string
  borderRadius?: string
  boxShadow?: string
  fontSize?: string
  fontWeight?: string
  fontFamily?: string
  padding?: string
  margin?: string
  border?: string
  textAlign?: string
  width?: string
  minHeight?: string
  opacity?: string
}

/** Тип поля ввода Text (ESPUI.setInputType → атрибут type у input). */
export type TextInputType = 'text' | 'date' | 'time' | 'color' | 'email' | 'tel' | 'url' | 'number' | 'datetime-local'

/** Свойства элемента: набор зависит от type (см. widgets.ts). Все поля необязательны. */
export interface ElementProps {
  color?: EspuiColor
  /** Растянуть панель на всю ширину (ESPUI.setPanelWide). */
  wide?: boolean
  /** Вертикальный вид (ESPUI.setVertical; только slider/switcher). */
  vertical?: boolean
  /** button: текст на кнопке. */
  text?: string
  /** label: префикс/суффикс при выводе переменной; начальный текст при отсутствии привязки. */
  prefix?: string
  suffix?: string
  initial?: string
  /** Знаков после запятой при выводе float. */
  decimals?: number
  /** slider/number: границы и шаг. */
  min?: number
  max?: number
  step?: number
  /** switcher: начальное состояние без привязки. */
  on?: boolean
  /** select: список вариантов. */
  options?: SelectOption[]
  /** graph: множитель значения перед приведением к int. */
  scale?: number
  /** graph: период добавления точек, мс (пусто — каждый период обновления UI). */
  graphMs?: number
  /** graph: очистить график при старте (ESPUI.clearGraph). */
  clearOnStart?: boolean
  /** button: hold (по умолчанию: «пока нажата») или toggle (переключение по нажатию). */
  action?: 'hold' | 'toggle'
  /** text: тип поля ввода (setInputType) и максимальная длина (Max → maxlength). */
  inputType?: TextInputType
  maxLength?: number
  /** fileDisplay: путь к файлу (URL, который подгрузит браузер). */
  file?: string
  /** time: период запроса времени у браузера, сек (0 — не запрашивать; ESPUI.updateTime). */
  pollSec?: number
  /** Элемент недоступен для ввода (ESPUI.setEnabled(id, false)). */
  disabled?: boolean
  /** Элемент скрыт (ESPUI.updateVisibility(id, false)). */
  hidden?: boolean
  /** Стиль карточки (setPanelStyle) и внутреннего элемента (setElementStyle). */
  panelStyle?: StyleSpec
  elementStyle?: StyleSpec
  /** CSS-класс карточки (setPanelClass); определяется в теме/своём CSS. */
  panelClass?: string
}

export interface UiElement {
  /** Идентификатор C++ (имя глобальной переменной uint16_t с ID контрола). */
  id: string
  type: WidgetType
  label: string
  props: ElementProps
  binding: Binding
  /** Группа: перед первым элементом каждой подряд идущей группы генератор ставит Separator с названием группы. */
  group?: string
}

export interface UiTab {
  /** Идентификатор C++ (используется только если вкладок больше одной). */
  id: string
  title: string
  elements: UiElement[]
}

export interface WifiSettings {
  /** sta — подключиться к роутеру; ap — собственная точка доступа. */
  mode: 'sta' | 'ap'
  ssid: string
  password: string
  /** Параметры точки доступа (режим ap и резерв при неудаче sta). */
  apSsid: string
  apPassword: string
  hostname: string
}

export interface UiSettings {
  /** Заголовок страницы ESPUI. */
  title: string
  /** Логин/пароль веб-интерфейса (необязательно). */
  authUser: string
  authPass: string
  /** Период обновления выходных элементов, мс. */
  updateMs: number
  /** ESPUI.sliderContinuous: слать значение слайдера при перетаскивании. */
  sliderContinuous: boolean
  /** Печатать IP в Serial (Serial.begin вызывает пользователь). */
  serialLog: boolean
  /** PWM для пинов (ESP32 ledc). */
  pwmFreq: number
  pwmBits: number
  /** Поднять DNSServer для captive portal в режиме AP (ESPUI DNS сама не запускает). */
  dnsCaptive: boolean
}

/** Переопределения темы поверх пресета (значения проверяются core/css.ts). */
export interface ThemeVars {
  pageBg?: string
  pageText?: string
  fontFamily?: string
  cardRadius?: string
  cardShadow?: string
  cardText?: string
  buttonRadius?: string
  headerColor?: string
  /** Акцент: активная вкладка, включённый переключатель. */
  accent?: string
  /** Фон карточек по цветам ESPUI (имя цвета → CSS-цвет). */
  colors?: Partial<Record<Exclude<EspuiColor, 'None'>, string>>
}

export interface UiTheme {
  /** Идентификатор пресета (см. themes.ts); 'default' — родная тема ESPUI, CSS не генерируется. */
  preset: string
  vars: ThemeVars
}

export interface UiProject {
  version: number
  platform: Platform
  wifi: WifiSettings
  settings: UiSettings
  theme: UiTheme
  variables: UiVariable[]
  tabs: UiTab[]
}

export interface GenerateOptions {
  /** ESP32: API LEDC ядра Arduino-ESP32 — v2 (ledcSetup/ledcAttachPin) или v3 (ledcAttach). По умолчанию v3. */
  ledcApi?: 'v2' | 'v3'
  /** Добавлять в заголовок дату/версию. По умолчанию нет — вывод детерминирован. */
  timestamp?: string
}

export type IssueSeverity = 'error' | 'warning'

export interface Issue {
  severity: IssueSeverity
  code: string
  message: string
  elementId?: string
  variable?: string
  tabId?: string
}

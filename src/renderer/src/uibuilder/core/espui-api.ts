// Подтверждённые константы и лимиты ESPUI (источники — см. data/espui/API_NOTES.md, п.1–3, 7–8).
import type { EspuiColor, Platform } from './types'

/** enum ControlType : uint8_t (ESPUIcontrol.h, master). */
export const CONTROL_TYPE: Record<string, number> = {
  Title: 0,
  Pad: 1,
  PadWithCenter: 2,
  Button: 3,
  Label: 4,
  Switcher: 5,
  Slider: 6,
  Number: 7,
  Text: 8,
  Graph: 9,
  GraphPoint: 10,
  Tab: 11,
  Select: 12,
  Option: 13,
  Min: 14,
  Max: 15,
  Step: 16,
  Gauge: 17,
  Accel: 18,
  Separator: 19,
  Time: 20,
  FileDisplay: 21,
  ClearGraph: 22,
  Fragment: 98,
  Password: 99,
  UpdateOffset: 100
}

/** enum ControlColor : uint8_t. */
export const COLOR_NUMBER: Record<EspuiColor, number> = {
  Turquoise: 0,
  Emerald: 1,
  Peterriver: 2,
  Wetasphalt: 3,
  Sunflower: 4,
  Carrot: 5,
  Alizarin: 6,
  Dark: 7,
  None: 255
}

/** Фактические цвета CSS ESPUI (dataStyleCSS.h). Dark и None во фронтенде — один и тот же класс `dark`. */
export const COLOR_CSS: Record<EspuiColor, string> = {
  Turquoise: '#1abc9c',
  Emerald: '#2ecc71',
  Peterriver: '#3498db',
  Wetasphalt: '#34495e',
  Sunflower: '#f1c40f',
  Carrot: '#e67e22',
  Alizarin: '#e74c3c',
  Dark: '#444857',
  None: '#444857'
}

/** Имя CSS-класса цвета во фронтенде. */
export const COLOR_CLASS: Record<EspuiColor, string> = {
  Turquoise: 'turquoise',
  Emerald: 'emerald',
  Peterriver: 'peterriver',
  Wetasphalt: 'wetasphalt',
  Sunflower: 'sunflower',
  Carrot: 'carrot',
  Alizarin: 'alizarin',
  Dark: 'dark',
  None: 'dark'
}

/** Константы второго аргумента callback'а (ESPUI.h). */
export const EVENT: Record<string, number> = {
  B_DOWN: -1,
  B_UP: 1,
  P_LEFT_DOWN: -2,
  P_LEFT_UP: 2,
  P_RIGHT_DOWN: -3,
  P_RIGHT_UP: 3,
  P_FOR_DOWN: -4,
  P_FOR_UP: 4,
  P_BACK_DOWN: -5,
  P_BACK_UP: 5,
  P_CENTER_DOWN: -6,
  P_CENTER_UP: 6,
  S_ACTIVE: -7,
  S_INACTIVE: 7,
  SL_VALUE: 8,
  N_VALUE: 9,
  T_VALUE: 10,
  S_VALUE: 11,
  TM_VALUE: 12
}

/** MessageTypes (ESPUI.h). */
export const MESSAGE_TYPE = {
  InitialGui: 200,
  Reload: 201,
  ExtendGui: 210,
  UpdateGui: 220,
  ExtendedUpdateGui: 230
} as const

/** Размер JSON-документа для одной порции (jsonInitialDocumentSize) и запас, который оставляет ESPUIclient.cpp. */
export function jsonDocumentSize(platform: Platform): number {
  return platform === 'esp8266' ? 2000 : 8000
}
export const JSON_MARGIN = 100
/** JsonMarshaledOverhead из ESPUIcontrol.h (константа служебных байт на контрол). */
export const JSON_OVERHEAD = 64

/** Длина строки в байтах UTF-8. */
export function utf8Len(s: string): number {
  let n = 0
  for (const ch of s) {
    const c = ch.codePointAt(0) as number
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4
  }
  return n
}

/** Предел байт стилей на один элемент, после которого на ESP8266 выдаём предупреждение. */
export const STYLE_WARN_BYTES_ESP8266 = 400
/** Предел размера темы (custom.css) на ESP8266, байт. */
export const THEME_WARN_BYTES_ESP8266 = 2000

// Правила пинов ESP8266 / ESP32 и выводов на гребёнках Pico W / Pico 2 W.
import type { IssueSeverity, Platform } from './types'

export type PinRole = 'out-digital' | 'out-pwm' | 'in-digital' | 'in-analog'

export interface PinProblem {
  severity: IssueSeverity
  code: string
  message: string
}

/** Номер Arduino-пина A0 на ESP8266 (константа A0 == 17). */
export const ESP8266_A0 = 17

const ESP8266_DIGITAL = [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16]
const ESP32_ADC2 = [0, 2, 4, 12, 13, 14, 15, 25, 26, 27]
const ESP32_INPUT_ONLY = [34, 35, 36, 39, 37, 38]
const ESP32_STRAPPING = [0, 2, 5, 12, 15]
const PICO_ADC = [26, 27, 28]
const PICO_GPIO = [...Array.from({ length: 23 }, (_, gpio) => gpio), ...PICO_ADC]

export const pwmMax = (platform: Platform, pwmBits: number): number =>
  platform === 'esp32' ? 2 ** pwmBits - 1 : platform === 'pico-w' ? 255 : 1023

export function checkPin(platform: Platform, pin: number, role: PinRole): PinProblem[] {
  const out: PinProblem[] = []
  const err = (code: string, message: string): void => {
    out.push({ severity: 'error', code, message })
  }
  const warn = (code: string, message: string): void => {
    out.push({ severity: 'warning', code, message })
  }
  if (!Number.isInteger(pin) || pin < 0) {
    err('pin-invalid', `Некорректный номер пина: ${String(pin)}`)
    return out
  }
  if (platform === 'pico-w') {
    if (!PICO_GPIO.includes(pin)) err('pin-range', `GPIO${pin} не выведен на гребёнки Pico W / Pico 2 W`)
    else if (role === 'in-analog' && !PICO_ADC.includes(pin)) err('pin-adc', 'На Pico W / Pico 2 W аналоговые входы на гребёнке — GP26, GP27 и GP28')
    return out
  }
  if (platform === 'esp8266') {
    if (role === 'in-analog') {
      if (pin !== ESP8266_A0) err('pin-adc', 'На ESP8266 аналоговый вход один — A0 (пин 17)')
      return out
    }
    if (pin === ESP8266_A0) {
      err('pin-adc-digital', 'A0 на ESP8266 — только аналоговый вход')
      return out
    }
    if (pin >= 6 && pin <= 11) {
      err('pin-flash', `GPIO${pin} занят флеш-памятью ESP8266`)
      return out
    }
    if (!ESP8266_DIGITAL.includes(pin)) {
      err('pin-range', `GPIO${pin} не существует на ESP8266`)
      return out
    }
    if (role === 'out-pwm' && pin === 16) err('pin-pwm', 'GPIO16 на ESP8266 не поддерживает PWM')
    if (pin === 1 || pin === 3) warn('pin-uart', `GPIO${pin} — UART (Serial)`)
    if (pin === 0 || pin === 2 || pin === 15) warn('pin-strapping', `GPIO${pin} — strapping-пин`)
    return out
  }
  if (pin > 48) {
    err('pin-range', `GPIO${pin} не существует на ESP32`)
    return out
  }
  if (pin >= 6 && pin <= 11) warn('pin-flash', `GPIO${pin} на классическом ESP32 занят флеш-памятью`)
  if ((role === 'out-digital' || role === 'out-pwm') && ESP32_INPUT_ONLY.includes(pin))
    warn('pin-input-only', `GPIO${pin} на классическом ESP32 только входной`)
  if (role === 'in-analog' && ESP32_ADC2.includes(pin))
    warn('pin-adc2', `GPIO${pin} относится к ADC2: analogRead не работает при включённом WiFi`)
  if (ESP32_STRAPPING.includes(pin)) warn('pin-strapping', `GPIO${pin} — strapping-пин`)
  return out
}

/** Список пинов для выбора в UI. */
export function pinChoices(platform: Platform, role: PinRole): Array<{ pin: number; label: string }> {
  if (platform === 'pico-w') return (role === 'in-analog' ? PICO_ADC : PICO_GPIO).map((pin) => ({ pin, label: `GP${pin}` }))
  if (platform === 'esp8266') {
    if (role === 'in-analog') return [{ pin: ESP8266_A0, label: 'A0' }]
    return ESP8266_DIGITAL.filter((p) => !(role === 'out-pwm' && p === 16)).map((p) => ({ pin: p, label: `GPIO${p}` }))
  }
  const list: Array<{ pin: number; label: string }> = []
  for (let p = 0; p <= 39; p++) {
    if (p >= 6 && p <= 11) continue
    if ([20, 24, 28, 29, 30, 31].includes(p)) continue
    list.push({ pin: p, label: `GPIO${p}` })
  }
  return list
}

/** Как записать пин в коде C++. */
export function pinLiteral(platform: Platform, pin: number, role: PinRole): string {
  if (platform === 'esp8266' && role === 'in-analog') return 'A0'
  return String(pin)
}

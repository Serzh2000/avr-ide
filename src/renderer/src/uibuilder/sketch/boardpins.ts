// Пины выбранной платы с подписями — для выпадающего списка привязки.
import { checkPin, pinChoices } from '../core/pins'
import type { PinRole } from '../core/pins'
import type { Platform } from '../core/types'

export interface BoardPin {
  pin: number
  /** «GPIO2», «D4 · GPIO2». */
  label: string
  /** Пояснение: «встроенный светодиод на многих платах». */
  note?: string
  /** Проблема (strapping, только вход…) — серьёзность и текст. */
  problem?: { severity: 'error' | 'warning'; message: string }
}

const ESP8266_LABEL: Record<number, string> = { 16: 'D0', 5: 'D1', 4: 'D2', 0: 'D3', 2: 'D4', 14: 'D5', 12: 'D6', 13: 'D7', 15: 'D8', 3: 'RX', 1: 'TX' }

const NOTES_ESP32: Record<number, string> = {
  0: 'кнопка BOOT',
  1: 'UART TX (Serial)',
  2: 'встроенный светодиод на многих платах',
  3: 'UART RX (Serial)',
  34: 'только вход',
  35: 'только вход',
  36: 'только вход (VP)',
  39: 'только вход (VN)'
}
const NOTES_ESP8266: Record<number, string> = {
  0: 'кнопка FLASH',
  1: 'UART TX (Serial)',
  2: 'встроенный светодиод (инверсный) на многих платах',
  3: 'UART RX (Serial)',
  16: 'без ШИМ'
}

export function boardPinLabel(platform: Platform, pin: number): string {
  if (platform === 'esp8266') {
    if (pin === 17) return 'A0'
    const d = ESP8266_LABEL[pin]
    return d && d.startsWith('D') ? `${d} · GPIO${pin}` : `GPIO${pin}`
  }
  return `GPIO${pin}`
}

/** Допустимые для роли пины платы (с замечаниями). */
export function boardPins(platform: Platform, role: PinRole): BoardPin[] {
  return pinChoices(platform, role).map((c) => {
    const probs = checkPin(platform, c.pin, role)
    const worst = probs.find((p) => p.severity === 'error') ?? probs[0]
    const bp: BoardPin = { pin: c.pin, label: boardPinLabel(platform, c.pin) }
    const note = (platform === 'esp8266' ? NOTES_ESP8266 : NOTES_ESP32)[c.pin]
    if (note) bp.note = note
    if (worst) bp.problem = { severity: worst.severity, message: worst.message }
    return bp
  })
}

import { baseFqbn, platformOfFqbn } from '../../../../main/cli/fqbn'
import type { Platform } from './types'

export function isPicoWBoard(fqbn: string | null | undefined): boolean {
  const base = baseFqbn(fqbn ?? '')
  return base === 'rp2040:rp2040:rpipicow' || base === 'rp2040:rp2040:rpipico2w'
}

/** Поддержка интеграции определяется выбранной платой, а не наличием архитектуры RP2040. */
export function webPlatformFor(fqbn: string | null | undefined): Platform | null {
  if (isPicoWBoard(fqbn)) return 'pico-w'
  const platform = platformOfFqbn(fqbn)
  return platform === 'esp32' || platform === 'esp8266' ? platform : null
}

export const WEB_TARGET_NAMES: Record<Platform, string> = {
  esp32: 'ESP32',
  esp8266: 'ESP8266',
  'pico-w': 'Pico W / Pico 2 W'
}

export const WEB_TCP_LIBRARIES: Record<Platform, string> = {
  esp32: 'AsyncTCP',
  esp8266: 'ESPAsyncTCP',
  'pico-w': 'RPAsyncTCP'
}

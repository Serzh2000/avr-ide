// Встроенный светодиод платы — только по подтверждённым данным справочника (пин с функцией LED_BUILTIN).
import type { PinInfo } from './types'

export interface LedInfo { label: string; gpio: number | null }

/** Пины, у которых в данных платы прямо указана функция LED_BUILTIN. Пусто — данных нет, ничего не выдумываем. */
export function builtinLeds(pins: PinInfo[]): LedInfo[] {
  return pins.filter((p) => p.functions.some((f) => f === 'LED_BUILTIN')).map((p) => ({ label: p.label, gpio: p.gpio }))
}

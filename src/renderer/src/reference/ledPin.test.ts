import test from 'node:test'
import assert from 'node:assert/strict'
import { builtinLeds } from './ledPin'
import type { PinInfo } from './types'

const pin = (label: string, gpio: number | null, functions: string[]): PinInfo => ({ label, gpio, functions } as PinInfo)

test('builtinLeds: только пины с функцией LED_BUILTIN', () => {
  assert.deepEqual(builtinLeds([pin('D12', null, ['PWM']), pin('D13', null, ['SPI SCK', 'LED_BUILTIN'])]), [{ label: 'D13', gpio: null }])
  assert.deepEqual(builtinLeds([pin('D4', 2, ['GPIO', 'LED_BUILTIN'])]), [{ label: 'D4', gpio: 2 }])
})

test('builtinLeds: нет данных — пустой список, подсказки не выдумываем', () => {
  assert.deepEqual(builtinLeds([pin('GPIO2', 2, ['GPIO', 'LED (на многих платах)'])]), [])
  assert.deepEqual(builtinLeds([]), [])
})

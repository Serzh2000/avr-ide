// Функции выводов дополнительных плат STM32 (Nucleo-64 и др.) из PeripheralPins.c ядра STM32duino -> src/renderer/src/reference/data/stm32FuncsMore.ts
//   node scripts/boardart/stm32funcs-more.mjs <папка клона Arduino_Core_STM32 (с variants/)>
// Источник: https://github.com/stm32duino/Arduino_Core_STM32 (BSD-3-Clause, © STMicroelectronics). Разбор тот же, что в scripts/build-stm32-funcs.mjs.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const core = process.argv[2]
if (!core) throw new Error('usage: stm32funcs-more.mjs <Arduino_Core_STM32 dir>')
const find = (family, prefix) => join(core, 'variants', family, readdirSync(join(core, 'variants', family)).find((d) => d.startsWith(prefix)))
const chips = {
  f411re: join(find('STM32F4xx', 'F411R'), 'PeripheralPins.c'),
  f446re: join(find('STM32F4xx', 'F446R'), 'PeripheralPins.c'),
  f103rb: join(find('STM32F1xx', 'F103R(8-B)T'), 'PeripheralPins.c'),
  l476rg: join(find('STM32L4xx', 'L475R'), 'PeripheralPins.c'),
  g474re: join(find('STM32G4xx', 'G473R'), 'PeripheralPins.c'),
  l053r8: join(find('STM32L0xx', 'L052R(6-8)T'), 'PeripheralPins.c'),
  g431kb: join(find('STM32G4xx', 'G431K'), 'PeripheralPins.c'),
  l152re: join(find('STM32L1xx', 'L151RET'), 'PeripheralPins.c'),
  f303re: join(find('STM32F3xx', 'F303R(D-E)T'), 'PeripheralPins.c')
}
const KINDS = {
  ADC: (p, c) => (c ? c.replace(/^ADC(\d+)_IN(\d+).*/, 'ADC$1_IN$2') : p + ' ADC'),
  DAC: (p, c) => c || p,
  I2C_SDA: (p) => `${p} SDA`, I2C_SCL: (p) => `${p} SCL`,
  TIM: (p, c) => (c ? c.trim() : p),
  UART_TX: (p) => `${p} TX`, UART_RX: (p) => `${p} RX`, UART_RTS: (p) => `${p} RTS`, UART_CTS: (p) => `${p} CTS`,
  SPI_MOSI: (p) => `${p} MOSI`, SPI_MISO: (p) => `${p} MISO`, SPI_SCLK: (p) => `${p} SCK`, SPI_SSEL: (p) => `${p} SS`,
  CAN_RD: (p) => `${p} RX`, CAN_TD: (p) => `${p} TX`,
  USB: (_p, c) => (c || 'USB').trim()
}
const out = {}
for (const [chip, file] of Object.entries(chips)) {
  const src = readFileSync(file, 'utf8')
  const res = {}
  let cur = null
  for (const line of src.split(/\r?\n/)) {
    const h = /PinMap_(\w+)\[\]\s*=\s*\{/.exec(line)
    if (h) { cur = h[1]; continue }
    if (/^\};/.test(line)) { cur = null; continue }
    if (!cur) continue
    const m = /\{\s*(P[A-H]_\d+)(?:_ALT\d)?\s*,\s*(\w+)\s*,.*?\}\s*,?\s*(?:\/\/\s*(.*))?$/.exec(line)
    if (!m) continue
    const pin = m[1].replace('_', '')
    const kind = cur.replace(/^USB_OTG_FS$|^USB_OTG_HS$/, 'USB')
    const fmt = KINDS[kind]
    if (!fmt) continue
    const text = fmt(m[2], m[3])
    ;(res[pin] ??= [])
    if (!res[pin].includes(text)) res[pin].push(text)
  }
  out[chip] = res
}
const head = `// СГЕНЕРИРОВАНО scripts/boardart/stm32funcs-more.mjs — не править вручную.
// Функции выводов STM32 — из PeripheralPins.c ядра STM32duino (https://github.com/stm32duino/Arduino_Core_STM32, BSD-3-Clause, © STMicroelectronics).
/* eslint-disable */
export const stm32FuncsMore: Record<string, Record<string, string[]>> = `
writeFileSync(join(process.cwd(), 'src/renderer/src/reference/data/stm32FuncsMore.ts'), head + JSON.stringify(out, null, 1) + String.fromCharCode(10))
for (const [c, r] of Object.entries(out)) console.log(c, Object.keys(r).length)

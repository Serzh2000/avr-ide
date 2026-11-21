// Юнит-тесты конфигуратора выводов и тактирования: схема файла, конфликты, формулы частот, генераторы, пользовательские блоки.
import test from 'node:test'
import assert from 'node:assert/strict'
import { getChip } from '../chipdb'
import { autoClock, computeClock, flashLatency, solvePll, usartBrr, clockProfile } from './clock'
import { findPin, pinGuards, signalPins, peripheralsIn } from './model'
import { assignSignal, autoPlace, clearPin, enablePeripheral, patchPin, setClock, setGpioRole } from './ops'
import { defaultPinsConfig, parsePinsText, serializePins } from './schema'
import { checkConfig, hasErrors } from './validate'
import { mergeUserBlocks } from './gen/common'
import { planGeneration, planMainInsert } from './gen/index'
import { f1Direction } from './gen/pins'
import type { PinsConfig } from './types'

const chip = (id: string) => getChip(id)!
const codes = (cfg: PinsConfig): string[] => checkConfig(cfg).map((i) => i.code)
const OPTS = { srcDir: 'src', incDir: 'include' }

/** Типовая конфигурация: светодиод и USART на ST-Link VCP / выводах платы, тактирование по умолчанию. */
function baseConfig(id: string): PinsConfig {
  let c = defaultPinsConfig(id)
  const ch = chip(id)
  if (id === 'stm32f103c8') {
    c = setGpioRole(c, 'PC13', 'output', { label: 'LED', initial: 'high' })
    c = enablePeripheral(c, ch, 'USART1')
  } else {
    c = setGpioRole(c, 'PA5', 'output', { label: 'LED' })
    c = setGpioRole(c, 'PC13', 'input', { label: 'BTN', pull: 'none' })
    c = enablePeripheral(c, ch, 'USART2')
  }
  return c
}

// ---------- схема ----------

test('схема: значения по умолчанию, запись и чтение возвращают то же', () => {
  const c = baseConfig('stm32f103c8')
  const text = serializePins(c)
  assert.ok(text.endsWith('\n'))
  const r = parsePinsText(text)
  assert.ok(r.ok)
  if (r.ok) { assert.deepEqual(r.config, c); assert.equal(r.migratedFrom, null) }
  assert.equal(serializePins((r as { config: PinsConfig }).config), text, 'запись канонична')
})

test('схема: порядок выводов естественный (PA2 раньше PA10), пустые записи не пишутся', () => {
  let c = defaultPinsConfig('stm32f103c8')
  c = setGpioRole(c, 'PB1', 'input')
  c = setGpioRole(c, 'PA10', 'input')
  c = setGpioRole(c, 'PA2', 'input')
  c = patchPin(c, 'PB3', { label: '' })
  assert.deepEqual(Object.keys(JSON.parse(serializePins(c)).pins), ['PA2', 'PA10', 'PB1'])
})

test('схема: ошибки структуры названы по пути', () => {
  const bad = (o: unknown): string => { const r = parsePinsText(JSON.stringify(o)); assert.ok(!r.ok); return r.ok ? '' : r.errors.map((e) => e.path + ': ' + e.message).join('|') }
  assert.match(bad({ schemaVersion: 1, chip: 'stm32xxx' }), /нет в базе/)
  assert.match(bad({ schemaVersion: 1, chip: 'stm32f103c8', pins: { PA9: { role: 'banana' } } }), /pins\.PA9\.role/)
  assert.match(bad({ schemaVersion: 1, chip: 'stm32f103c8', pins: { X9: {} } }), /Имя вывода/)
  assert.match(bad({ schemaVersion: 1, chip: 'stm32f103c8', peripherals: { USART1: { enabled: true, signals: { USART1_TX: 'zz' } } } }), /signals/)
  assert.match(bad({ schemaVersion: 1, chip: 'stm32f103c8', clock: { source: 'pll', apb1Div: 3 } }), /apb1Div/)
  assert.match(bad({ schemaVersion: 2, chip: 'stm32f103c8' }), /более новой/)
  const r = parsePinsText('{oops')
  assert.ok(!r.ok)
})

test('схема: миграция файла без schemaVersion на версию 1', () => {
  const r = parsePinsText(JSON.stringify({ chip: 'stm32f411re', pins: { PA5: { role: 'output', label: 'LED' } } }))
  assert.ok(r.ok)
  if (r.ok) {
    assert.equal(r.migratedFrom, 0)
    assert.equal(r.config.schemaVersion, 1)
    assert.equal(r.config.mode, 'cmsis')
    assert.equal(r.config.clock.source, 'hsi')
    assert.equal(r.config.pins['PA5'].label, 'LED')
    assert.ok(r.warnings.length > 0)
  }
})

// ---------- база: выводы ----------

test('защищённые выводы F103C8: SWD, генераторы, JTAG', () => {
  const g = pinGuards(chip('stm32f103c8').packages[0])
  assert.equal(g.get('PA13')?.[0].kind, 'swd')
  assert.equal(g.get('PA14')?.[0].kind, 'swd')
  assert.equal(g.get('PD0')?.[0].kind, 'osc')
  assert.equal(g.get('PC14')?.[0].kind, 'osc32')
  assert.equal(g.get('PA15')?.[0].kind, 'jtag')
  assert.equal(g.get('PA9'), undefined)
  assert.ok(g.has('BOOT0'), 'BOOT0 помечен')
})

test('сигналы по выводам: USART1_TX на PA9 без ремапа и на PB6 с ремапом USART1_ENABLE', () => {
  const pkg = chip('stm32f103c8').packages[0]
  const l = signalPins(pkg, 'USART1_TX')
  assert.deepEqual(l.map((x) => [x.pin, x.remap ?? '']), [['PA9', ''], ['PB6', 'USART1_ENABLE']])
  assert.ok(peripheralsIn(pkg).some((p) => p.name === 'USART3'))
  assert.ok(!peripheralsIn(pkg).some((p) => p.name === 'SYS' || p.name === 'RTC'))
  assert.ok(findPin(pkg, 'PC13'))
  assert.equal(findPin(pkg, 'VDD'), undefined)
})

test('F4/G4: номер AF берётся из базы', () => {
  const f4 = signalPins(chip('stm32f411re').packages[0], 'USART2_TX')
  assert.deepEqual(f4.map((x) => [x.pin, x.af]), [['PA2', 7]])
  const g4 = signalPins(chip('stm32g474re').packages[0], 'USART2_TX').find((x) => x.pin === 'PA2')
  assert.equal(g4?.af, 7)
})

// ---------- конфликты ----------

test('конфигурация без конфликтов: светодиод PC13 и USART1 на PA9/PA10', () => {
  const c = baseConfig('stm32f103c8')
  assert.deepEqual(c.peripherals['USART1'].signals, { USART1_TX: 'PA9', USART1_RX: 'PA10' })
  assert.equal(c.peripherals['USART1'].baud, 115200)
  const bad = checkConfig(c).filter((i) => i.severity !== 'info')
  assert.deepEqual(bad, [])
})

test('конфликт: вывод занят GPIO и USART; «подобрать свободные» его решает через ремап F1', () => {
  let c = defaultPinsConfig('stm32f103c8')
  c = setGpioRole(c, 'PA10', 'input', { label: 'BTN' })
  c = enablePeripheral(c, chip('stm32f103c8'), 'USART1')
  const issues = checkConfig(c)
  const busy = issues.find((i) => i.code === 'pin-busy')
  assert.ok(busy && busy.pin === 'PA10', JSON.stringify(issues))
  assert.ok(hasErrors(issues))
  const fixed = autoPlace(c, chip('stm32f103c8'), 'USART1')
  assert.ok(fixed)
  assert.deepEqual(fixed!.peripherals['USART1'].signals, { USART1_TX: 'PB6', USART1_RX: 'PB7' }, 'оба вывода на ремап USART1_ENABLE')
  assert.deepEqual(checkConfig(fixed!).filter((i) => i.severity === 'error'), [])
})

test('F1: выводы одной периферии из разных вариантов ремапа — конфликт remap-mismatch', () => {
  let c = defaultPinsConfig('stm32f103c8')
  c = assignSignal(c, 'PA9', 'USART1_TX')
  c = assignSignal(c, 'PB7', 'USART1_RX')
  assert.ok(codes(c).includes('remap-mismatch'))
  c = assignSignal(c, 'PB6', 'USART1_TX')
  assert.ok(!codes(c).includes('remap-mismatch'))
})

test('сигнал, которого на выводе нет, и периферия, которой нет в корпусе — ошибки', () => {
  let c = defaultPinsConfig('stm32f103c8')
  c.peripherals['USART1'] = { enabled: true, signals: { USART1_TX: 'PA10' } }
  c.peripherals['USART6'] = { enabled: true, signals: { USART6_TX: 'PC6' } }
  c.pins['PZ9'] = { role: 'input' }
  const cs = codes(c)
  assert.ok(cs.includes('af-missing'))
  assert.ok(cs.includes('periph-missing'))
  assert.ok(cs.includes('pin-missing'))
  assert.match(checkConfig(c).find((i) => i.code === 'af-missing')!.message, /есть на: PA9, PB6/)
})

test('защищённые выводы: SWD без подтверждения — ошибка, с подтверждением — предупреждение', () => {
  let c = defaultPinsConfig('stm32f103c8')
  c = setGpioRole(c, 'PA13', 'output')
  assert.ok(codes(c).includes('pin-reserved'))
  c = patchPin(c, 'PA13', { confirmed: true })
  const i = checkConfig(c)
  assert.ok(!i.some((x) => x.code === 'pin-reserved'))
  assert.ok(i.some((x) => x.code === 'pin-reserved-ok' && x.severity === 'warning'))
  // генератор на F1: JTAG не мешает PB3, но JTAG отключается
  let d = setGpioRole(defaultPinsConfig('stm32f103c8'), 'PB3', 'output')
  d = patchPin(d, 'PB3', {})
  assert.ok(!hasErrors(checkConfig(d)))
})

test('HSE занимает выводы генератора: PD0/PD1 как GPIO при HSE — конфликт', () => {
  let c = defaultPinsConfig('stm32f103c8')
  c = patchPin(setGpioRole(c, 'PD0', 'input'), 'PD0', { confirmed: true })
  assert.ok(!codes(c).includes('pin-busy'))
  c = setClock(c, { source: 'hse' })
  assert.ok(codes(c).includes('pin-busy'))
  c = setClock(c, { source: 'pll', pllSource: 'hse', pll: { mul: 9 } })
  assert.ok(codes(c).includes('pin-busy'))
})

test('метки: допустимые имена и повторы', () => {
  let c = defaultPinsConfig('stm32f103c8')
  c = setGpioRole(c, 'PC13', 'output', { label: 'LED' })
  c = setGpioRole(c, 'PA0', 'input', { label: 'led' })
  assert.ok(codes(c).includes('label-dup'))
  c = patchPin(c, 'PA0', { label: '1btn' })
  assert.ok(codes(c).includes('label'))
})

test('освобождение вывода убирает и роль GPIO, и сигнал периферии', () => {
  const c = clearPin(baseConfig('stm32f103c8'), 'PA9')
  assert.deepEqual(c.peripherals['USART1'].signals, { USART1_RX: 'PA10' })
})

// ---------- частоты ----------

test('F1: HSI/2 × 16 = 64 МГц, APB1 /2 → 32 МГц, 2 wait states (пример ST NUCLEO-F103RB)', () => {
  const r = computeClock(chip('stm32f103rb'), { source: 'pll', pllSource: 'hsi', hseHz: 8e6, hseBypass: false, pll: { mul: 16 }, ahbDiv: 1, apb1Div: 2, apb2Div: 1 })
  assert.ok(r.ok, JSON.stringify(r.issues))
  assert.equal(r.sysclk, 64e6)
  assert.equal(r.pclk1, 32e6)
  assert.equal(r.pclk2, 64e6)
  assert.equal(r.timclk1, 64e6, 'таймеры APB1 удваиваются при делителе 2')
  assert.equal(r.latency, 2)
})

test('F1: HSE 8 МГц × 9 = 72 МГц, APB1 /2 = 36 — в пределах; APB1 без делителя — ошибка', () => {
  const base = { source: 'pll' as const, pllSource: 'hse' as const, hseHz: 8e6, hseBypass: false, pll: { mul: 9 }, ahbDiv: 1, apb1Div: 2, apb2Div: 1 }
  const ok = computeClock(chip('stm32f103c8'), base)
  assert.ok(ok.ok)
  assert.equal(ok.sysclk, 72e6)
  assert.equal(ok.pclk1, 36e6)
  const bad = computeClock(chip('stm32f103c8'), { ...base, apb1Div: 1 })
  assert.ok(!bad.ok)
  assert.ok(bad.issues.some((i) => i.code === 'pclk1-max'))
  assert.ok(computeClock(chip('stm32f103c8'), { ...base, pll: { mul: 10 } }).issues.some((i) => i.code === 'sys-max'), '80 МГц выше предела 72')
  assert.ok(computeClock(chip('stm32f103c8'), { ...base, hseHz: 25e6 }).issues.some((i) => i.code === 'hse-range'))
  assert.ok(computeClock(chip('stm32f103c8'), { ...base, pll: { mul: 17 } }).issues.some((i) => i.code === 'pll-mul'))
})

test('wait states Flash по таблицам HAL', () => {
  assert.deepEqual([24, 25, 48, 49, 72].map((m) => flashLatency('f1', m * 1e6, m * 1e6)), [0, 1, 1, 2, 2])
  assert.deepEqual([30, 31, 60, 84, 100, 168].map((m) => flashLatency('f4', m * 1e6, m * 1e6)), [0, 1, 1, 2, 3, 5])
  assert.deepEqual([34, 35, 68, 102, 136, 150, 170].map((m) => flashLatency('g4', m * 1e6, m * 1e6)), [0, 1, 1, 2, 3, 4, 4])
})

test('F4 (NUCLEO-F411RE, пример ST): HSE 8 МГц, M=8 N=400 P=4 Q=7 → 100 МГц, VCO 400, Q 57,1 МГц, 3 wait states', () => {
  const r = computeClock(chip('stm32f411re'), { source: 'pll', pllSource: 'hse', hseHz: 8e6, hseBypass: false, pll: { m: 8, n: 400, p: 4, q: 7 }, ahbDiv: 1, apb1Div: 2, apb2Div: 1 })
  assert.ok(r.ok, JSON.stringify(r.issues))
  assert.equal(r.sysclk, 100e6)
  assert.equal(r.pllVco, 400e6)
  assert.equal(r.pllIn, 1e6)
  assert.ok(Math.abs(r.pllQ! - 57142857) < 2)
  assert.equal(r.pclk1, 50e6)
  assert.equal(r.latency, 3)
})

test('F4: границы входа и выхода VCO, M, N, P', () => {
  const b = { source: 'pll' as const, pllSource: 'hse' as const, hseHz: 8e6, hseBypass: false, ahbDiv: 1, apb1Div: 2, apb2Div: 1 }
  const c = (pll: object) => computeClock(chip('stm32f411re'), { ...b, pll }).issues.map((i) => i.code)
  assert.ok(c({ m: 2, n: 100, p: 4 }).includes('vco-in'), 'вход VCO 4 МГц выше 2')
  assert.ok(c({ m: 8, n: 50, p: 2 }).includes('vco-out'), 'VCO 50 МГц ниже 100')
  assert.ok(c({ m: 8, n: 49, p: 2 }).includes('pll-n'))
  assert.ok(c({ m: 1, n: 100, p: 2 }).includes('pll-m'))
  assert.ok(c({ m: 8, n: 400, p: 3 }).includes('pll-p'))
  assert.ok(c({ m: 4, n: 100, p: 2 }).includes('sys-max') === false, '100 МГц допустимо для F411')
  assert.ok(c({ m: 4, n: 120, p: 2 }).includes('sys-max'), '120 МГц выше предела F411')
})

test('G4 (NUCLEO-G474RE, пример ST): HSI 16 МГц, M=4 N=85 R=2 → 170 МГц, VCO 340, 4 wait states', () => {
  const r = computeClock(chip('stm32g474re'), { source: 'pll', pllSource: 'hsi', hseHz: 8e6, hseBypass: false, pll: { m: 4, n: 85, r: 2 }, ahbDiv: 1, apb1Div: 1, apb2Div: 1 })
  assert.ok(r.ok, JSON.stringify(r.issues))
  assert.equal(r.sysclk, 170e6)
  assert.equal(r.pllVco, 340e6)
  assert.equal(r.pllIn, 4e6)
  assert.equal(r.latency, 4)
  const bad = computeClock(chip('stm32g474re'), { source: 'pll', pllSource: 'hsi', hseHz: 8e6, hseBypass: false, pll: { m: 1, n: 21, r: 2 }, ahbDiv: 1, apb1Div: 1, apb2Div: 1 })
  assert.ok(bad.issues.some((i) => i.code === 'vco-in'), '16 МГц на входе VCO выше 8')
})

test('подбор PLL: точные решения для известных частот', () => {
  const f4 = solvePll(chip('stm32f411re'), { pllSource: 'hse', hseHz: 8e6 }, 100e6)!
  assert.ok(f4.exact && f4.sysclk === 100e6)
  assert.ok(computeClock(chip('stm32f411re'), { source: 'pll', pllSource: 'hse', hseHz: 8e6, hseBypass: false, pll: f4.pll, ahbDiv: 1, apb1Div: 2, apb2Div: 1 }).ok)
  const g4 = solvePll(chip('stm32g474re'), { pllSource: 'hsi', hseHz: 8e6 }, 170e6)!
  assert.deepEqual(g4.pll, { m: 4, n: 85, r: 2 })
  const f1 = solvePll(chip('stm32f103c8'), { pllSource: 'hse', hseHz: 8e6 }, 72e6)!
  assert.deepEqual(f1.pll, { mul: 9, hseDiv2: false })
  const hsi = solvePll(chip('stm32f103c8'), { pllSource: 'hsi', hseHz: 8e6 }, 64e6)!
  assert.deepEqual(hsi.pll, { mul: 16 })
  assert.equal(solvePll(chip('stm32f411re'), { pllSource: 'hse', hseHz: 8e6 }, 120e6), null, 'выше предела 100')
  assert.equal(solvePll(chip('stm32l476rg'), { pllSource: 'hse', hseHz: 8e6 }, 80e6), null, 'семейство не поддержано')
  const ac = autoClock(chip('stm32f411re'), defaultPinsConfig('stm32f411re').clock, 100e6)!
  assert.ok(ac.exact && ac.cfg.apb1Div === 2 && ac.cfg.apb2Div === 1)
})

test('профили: F446, F401 и прочие семейства — «пока вручную» без автоподбора', () => {
  assert.equal(clockProfile(chip('stm32f446re')).pllAuto, false)
  assert.equal(clockProfile(chip('stm32f401re')).pllAuto, false)
  assert.equal(clockProfile(chip('stm32l476rg')).kind, null)
  assert.equal(clockProfile(chip('stm32h743zi')).kind, null)
  const r = computeClock(chip('stm32l476rg'), defaultPinsConfig('stm32l476rg').clock)
  assert.ok(!r.ok && r.issues[0].code === 'clock-manual')
  assert.ok(computeClock(chip('stm32f446re'), { source: 'pll', pllSource: 'hse', hseHz: 8e6, hseBypass: false, pll: { m: 4, n: 180, p: 2 }, ahbDiv: 1, apb1Div: 4, apb2Div: 2 }).issues.some((i) => i.code === 'clock-pll-manual'))
})

test('BRR USART (передискретизация 16): известные числа', () => {
  // RM0008, таблица 192: 72 МГц, 115,2 кбит/с → USARTDIV 39,0625 → мантисса 39, дробная 1 → BRR 0x271
  assert.equal(usartBrr(72e6, 115200)!.brr, 0x271)
  assert.equal(usartBrr(36e6, 115200)!.brr, 0x138)
  assert.equal(usartBrr(8e6, 9600)!.brr, 833)
  assert.equal(usartBrr(50e6, 115200)!.brr, 434)
  assert.equal(usartBrr(100e6, 115200)!.brr, 868)
  assert.equal(usartBrr(170e6, 115200)!.brr, 1476)
  const e = usartBrr(72e6, 115200)!
  assert.ok(Math.abs(e.errorPct) < 0.01)
  assert.ok(Math.abs(usartBrr(8e6, 115200)!.errorPct) < 4, '8 МГц и 115200: заметная ошибка')
  assert.equal(usartBrr(1e6, 1e6), null, 'BRR < 16')
  assert.equal(usartBrr(100e6, 1), null)
})

test('предупреждение об ошибке скорости USART', () => {
  let c = baseConfig('stm32f103c8')
  const withBaud = (b: number): PinsConfig => ({ ...c, peripherals: { ...c.peripherals, USART1: { ...c.peripherals['USART1'], baud: b } } })
  assert.ok(codes(withBaud(460800)).includes('baud-error'), '8 МГц / 17 = 470588 бод: ошибка 2,1 %')
  assert.ok(codes(withBaud(921600)).includes('baud-range'), 'BRR < 16: скорость недостижима')
  assert.ok(!codes(c).includes('baud-error') && !codes(c).includes('baud-range'), '115200 при 8 МГц: ошибка 0,6 %')
})

// ---------- генерация ----------

const plan = (c: PinsConfig, existing: Record<string, string | undefined> = {}) => planGeneration(c, existing, OPTS, false)
const file = (p: ReturnType<typeof plan>, path: string): string => p.files.find((f) => f.path === path)!.content

test('генерация F103C8: файлы, светодиод, USART1, SysTick; значения регистров по документации', () => {
  const p = plan(baseConfig('stm32f103c8'))
  assert.ok(p.ok, p.blocked ?? '')
  assert.deepEqual(p.files.map((f) => f.path).sort(), ['include/board.h', 'include/clock.h', 'include/gpio.h', 'include/uart.h', 'src/board.c', 'src/clock.c', 'src/gpio.c', 'src/uart.c'])
  const gpio = file(p, 'src/gpio.c')
  assert.match(gpio, /RCC->APB2ENR \|= RCC_APB2ENR_IOPAEN \| RCC_APB2ENR_IOPCEN;/)
  assert.match(gpio, /GPIOC->BSRR = 1u << 13u;/, 'светодиод: начальный уровень высокий')
  assert.match(gpio, /gpio_cfg\(GPIOC, 13u, 0x2u\)/, 'PC13: выход 2 МГц, двухтактный = 0x2')
  assert.match(gpio, /gpio_cfg\(GPIOA, 9u, 0xBu\)/, 'PA9 USART1_TX: AF двухтактный 50 МГц = CNF 10 MODE 11 = 0xB')
  assert.match(gpio, /gpio_cfg\(GPIOA, 10u, 0x4u\)/, 'PA10 USART1_RX: вход без подтяжки = 0x4')
  assert.match(file(p, 'include/gpio.h'), /#define LED_TOGGLE\(\)/)
  const uart = file(p, 'src/uart.c')
  assert.match(uart, /USART1->BRR = \(CLOCK_PCLK2_HZ \+ \(115200u - 1u\) \/ 2u\) \/ 115200u;/)
  assert.match(uart, /RCC->APB2ENR \|= RCC_APB2ENR_USART1EN;/)
  assert.match(uart, /USART1->CR1 = USART_CR1_TE \| USART_CR1_RE \| USART_CR1_UE;/)
  assert.match(file(p, 'src/board.c'), /SysTick_Config\(SystemCoreClock \/ 1000u\)/)
  assert.match(file(p, 'include/clock.h'), /#define CLOCK_SYSCLK_HZ  8000000u/)
})

test('генерация F103C8: тактирование 72 МГц от HSE через PLL ×9, APB1 /2, 2 wait states', () => {
  let c = baseConfig('stm32f103c8')
  const a = autoClock(chip('stm32f103c8'), setClock(c, { source: 'pll', pllSource: 'hse', hseHz: 8e6 }).clock, 72e6)!
  c = setClock(c, a.cfg)
  const p = plan(c)
  assert.ok(p.ok, p.blocked ?? '')
  const clk = file(p, 'src/clock.c')
  assert.match(clk, /RCC->CR \|= RCC_CR_HSEON;/)
  assert.match(clk, /FLASH->ACR = \(FLASH->ACR & ~FLASH_ACR_LATENCY_Msk\) \| FLASH_ACR_PRFTBE \| 2u;/)
  assert.match(clk, /\(9u - 2u\) << RCC_CFGR_PLLMULL_Pos\) \| RCC_CFGR_PLLSRC;/)
  assert.match(clk, /RCC_CFGR_HPRE_DIV1 \| RCC_CFGR_PPRE1_DIV2 \| RCC_CFGR_PPRE2_DIV1/)
  assert.match(clk, /SystemCoreClock = CLOCK_SYSCLK_HZ;/)
  assert.match(file(p, 'include/clock.h'), /#define CLOCK_PCLK1_HZ   36000000u/)
  assert.match(file(p, 'src/uart.c'), /CLOCK_PCLK2_HZ/, 'USART1 на APB2')
})

test('генерация F411RE: GPIO через MODER/AFR, USART2 на PA2/PA3 (AF7), PLL 100 МГц, масштаб 1', () => {
  let c = baseConfig('stm32f411re')
  c = setClock(c, { pllSource: 'hse', hseHz: 8e6 })
  c = setClock(c, autoClock(chip('stm32f411re'), c.clock, 100e6)!.cfg)
  const p = plan(c)
  assert.ok(p.ok, p.blocked ?? '')
  const g = file(p, 'src/gpio.c')
  assert.match(g, /RCC->AHB1ENR \|= RCC_AHB1ENR_GPIOAEN \| RCC_AHB1ENR_GPIOCEN;/)
  assert.match(g, /gpio_cfg\(GPIOA, 2u, PIN_AF, PIN_PP, 2u, 0u, 7u\)/)
  assert.match(g, /gpio_cfg\(GPIOA, 3u, PIN_AF, PIN_PP, 2u, 0u, 7u\)/)
  assert.match(g, /gpio_cfg\(GPIOA, 5u, PIN_OUT, PIN_PP, 0u, 0u, 0u\)/)
  const k = file(p, 'src/clock.c')
  assert.match(k, /PWR->CR \|= PWR_CR_VOS;/)
  assert.match(k, /FLASH_ACR_ICEN \| FLASH_ACR_DCEN \| FLASH_ACR_PRFTEN \| 3u/)
  assert.match(k, /RCC->PLLCFGR = \(\d+u << RCC_PLLCFGR_PLLM_Pos\) \| \(\d+u << RCC_PLLCFGR_PLLN_Pos\) \| \(\d+u << RCC_PLLCFGR_PLLP_Pos\)/)
  assert.match(file(p, 'include/clock.h'), /#define CLOCK_SYSCLK_HZ  100000000u/)
  assert.match(file(p, 'src/uart.c'), /CLOCK_PCLK1_HZ/)
})

test('генерация G474RE: AHB2ENR, USART2 (ISR/TDR), PLL 170 МГц, boost и промежуточный делитель AHB', () => {
  let c = baseConfig('stm32g474re')
  c = setClock(c, autoClock(chip('stm32g474re'), c.clock, 170e6)!.cfg)
  const p = plan(c)
  assert.ok(p.ok, p.blocked ?? '')
  const k = file(p, 'src/clock.c')
  assert.match(k, /PWR->CR5 &= ~PWR_CR5_R1MODE;/)
  assert.match(k, /RCC_PLLCFGR_PLLM_Pos\) \| \(85u << RCC_PLLCFGR_PLLN_Pos\)/)
  assert.match(k, /\(\(4u - 1u\) << RCC_PLLCFGR_PLLM_Pos\)/)
  assert.match(k, /RCC_CFGR_HPRE_DIV2 \|/, 'промежуточный делитель выше 80 МГц')
  assert.match(k, /\| 4u;/, '4 wait states')
  assert.match(file(p, 'src/gpio.c'), /RCC->AHB2ENR \|= RCC_AHB2ENR_GPIOAEN \| RCC_AHB2ENR_GPIOCEN;/)
  const u = file(p, 'src/uart.c')
  assert.match(u, /USART_ISR_TXE_TXFNF/)
  assert.match(u, /USART2->TDR = b;/)
})

test('генерация: ремап F1 и отключение JTAG попадают в AFIO->MAPR', () => {
  let c = defaultPinsConfig('stm32f103c8')
  c = assignSignal(c, 'PB6', 'USART1_TX')
  c = assignSignal(c, 'PB7', 'USART1_RX')
  c = setGpioRole(c, 'PB3', 'output')
  const p = plan(c)
  assert.ok(p.ok, p.blocked ?? JSON.stringify(p.issues))
  const g = file(p, 'src/gpio.c')
  assert.match(g, /RCC_APB2ENR_AFIOEN/)
  assert.match(g, /mapr &= ~\(AFIO_MAPR_SWJ_CFG_Msk \| AFIO_MAPR_USART1_REMAP\);/)
  assert.match(g, /mapr \|= AFIO_MAPR_SWJ_CFG_JTAGDISABLE \| AFIO_MAPR_USART1_REMAP;/)
})

test('генерация не выполняется при ошибках, для неподдержанных семейств и режима HAL без HAL', () => {
  const bad = setGpioRole(defaultPinsConfig('stm32f103c8'), 'PA13', 'output')
  assert.equal(plan(bad).ok, false)
  assert.match(plan(bad).blocked!, /ошибки/)
  const l4 = setGpioRole(defaultPinsConfig('stm32l476rg'), 'PA5', 'output', { label: 'LED' })
  const pl = plan(l4)
  assert.equal(pl.ok, false)
  assert.match(pl.blocked!, /не поддерживается/)
  const hal = { ...baseConfig('stm32f103c8'), mode: 'hal' as const }
  assert.match(plan(hal).blocked!, /HAL/)
})

test('режим регистров: неподдержанная периферия — выводы настроены, инициализация вручную (info)', () => {
  let c = defaultPinsConfig('stm32f103c8')
  c = assignSignal(c, 'PB6', 'I2C1_SCL')
  c = assignSignal(c, 'PB7', 'I2C1_SDA')
  const p = plan(c)
  assert.ok(p.ok)
  assert.ok(p.issues.some((i) => i.code === 'gen-unsupported' && i.periph === 'I2C1'))
  assert.match(file(p, 'src/gpio.c'), /gpio_cfg\(GPIOB, 6u, 0xFu\)/, 'I2C: AF с открытым стоком 50 МГц = 0xF')
  assert.equal(f1Direction('FOO_BAR'), 'skip')
})

test('аналог и EXTI: ADC1_IN0 — аналоговый режим, EXTI — вход с предупреждением', () => {
  let c = defaultPinsConfig('stm32f411re')
  c = assignSignal(c, 'PA0', 'ADC1_IN0')
  c = setGpioRole(c, 'PC13', 'exti', { pull: 'up', label: 'BTN' })
  const p = plan(c)
  assert.ok(p.ok, p.blocked ?? '')
  const g = file(p, 'src/gpio.c')
  assert.match(g, /gpio_cfg\(GPIOA, 0u, PIN_ANALOG,/)
  assert.match(g, /gpio_cfg\(GPIOC, 13u, PIN_IN, PIN_PP, 0u, 1u, 0u\)/)
  assert.ok(p.notes.some((n) => /EXTI/.test(n.text)))
})

// ---------- пользовательские блоки ----------

test('повторная генерация идемпотентна и не затирает пользовательские блоки', () => {
  const c = baseConfig('stm32f103c8')
  const first = plan(c)
  const disk: Record<string, string> = Object.fromEntries(first.files.map((f) => [f.path, f.content]))
  const again = plan(c, disk)
  assert.ok(again.files.every((f) => f.status === 'same'), 'без изменений: все файлы совпадают')
  // пользователь пишет код в блоках
  disk['src/gpio.c'] = disk['src/gpio.c'].replace('/* USER CODE BEGIN gpio_init_end */\n\n    /* USER CODE END gpio_init_end */', '/* USER CODE BEGIN gpio_init_end */\n    LED_RESET(); /* мой код */\n    /* USER CODE END gpio_init_end */')
  disk['src/board.c'] = disk['src/board.c'].replace('/* USER CODE BEGIN board_c */\n\n/* USER CODE END board_c */', '/* USER CODE BEGIN board_c */\nint my_helper(void) { return 7; }\n/* USER CODE END board_c */')
  // конфигурация меняется: другой вывод светодиода
  let c2 = clearPin(c, 'PC13')
  c2 = setGpioRole(c2, 'PB12', 'output', { label: 'LED' })
  const p2 = plan(c2, disk)
  const g = file(p2, 'src/gpio.c')
  assert.match(g, /LED_RESET\(\); \/\* мой код \*\//)
  assert.match(g, /GPIOB->BSRR/)
  assert.ok(!/GPIOC->BSRR/.test(g))
  assert.match(file(p2, 'src/board.c'), /int my_helper\(void\) \{ return 7; \}/)
  assert.deepEqual(p2.files.find((f) => f.path === 'src/gpio.c')!.keptBlocks, ['gpio_init_end'])
  // и ещё раз с теми же данными — стабильно
  const disk2 = Object.fromEntries(p2.files.map((f) => [f.path, f.content]))
  assert.ok(plan(c2, disk2).files.every((f) => f.status === 'same'))
})

test('блок, исчезнувший из шаблона, не теряется: уходит в конец файла как Orphan_', () => {
  const m = mergeUserBlocks('/* USER CODE BEGIN a */\n\n/* USER CODE END a */\n', '/* USER CODE BEGIN a */ x /* USER CODE END a */\n/* USER CODE BEGIN gone */ мой код /* USER CODE END gone */\n')
  assert.match(m.text, /BEGIN a \*\/ x /)
  assert.match(m.text, /BEGIN Orphan_gone \*\/ мой код /)
  assert.deepEqual(m.orphans, ['gone'])
  const again = mergeUserBlocks('/* USER CODE BEGIN a */\n\n/* USER CODE END a */\n', m.text)
  assert.equal(again.text, m.text, 'стабильно при повторе')
})

test('файл без отметки генератора помечается как чужой', () => {
  const p = plan(baseConfig('stm32f103c8'), { 'src/gpio.c': '// мой gpio.c\nvoid x(void){}\n' })
  const f = p.files.find((x) => x.path === 'src/gpio.c')!
  assert.equal(f.foreign, true)
  assert.equal(f.status, 'changed')
  assert.equal(p.files.find((x) => x.path === 'src/clock.c')!.foreign, false)
})

// ---------- main.c ----------

test('main.c: вставка #include и board_init() минимальна и идемпотентна', () => {
  const src = '// Мигание\n#include "stm32f1xx.h"\n#include <stdint.h>\n\nint main(void)\n{\n    RCC->APB2ENR |= 1;\n    for (;;) {\n    }\n}\n'
  const r = planMainInsert(src)
  assert.ok(r.changed)
  assert.match(r.code, /#include <stdint.h>\n#include "board.h"\n/)
  assert.match(r.code, /int main\(void\)\n\{\n    board_init\(\);\n    RCC->APB2ENR/)
  assert.equal(planMainInsert(r.code).changed, false)
  // вызов в комментарии не считается
  assert.ok(planMainInsert('// board_init();\nint main(void) {\n  return 0;\n}\n').changed)
  // без main
  assert.equal(planMainInsert('int x;\n').changed, false)
  // без #include вообще
  const n = planMainInsert('/* заголовок */\nint main(void) {\n    return 0;\n}\n')
  assert.match(n.code, /\/\* заголовок \*\/\n#include "board.h"\n\nint main/)
  // CRLF
  assert.match(planMainInsert('#include "a.h"\r\nint main(void)\r\n{\r\n    for(;;){}\r\n}\r\n').code, /\{\r\n    board_init\(\);\r\n    for/)
})

// ---------- режим HAL ----------

test('режим HAL: HAL_GPIO_Init, HAL_RCC_OscConfig/ClockConfig, HAL_UART_Init и имена по меткам', () => {
  let c = baseConfig('stm32f103c8')
  c = setClock(c, { pllSource: 'hse', hseHz: 8e6 })
  c = setClock(c, autoClock(chip('stm32f103c8'), c.clock, 72e6)!.cfg)
  const p = planGeneration({ ...c, mode: 'hal' }, {}, OPTS, true)
  assert.ok(p.ok, p.blocked ?? '')
  const g = file(p, 'src/gpio.c')
  assert.match(g, /__HAL_RCC_GPIOC_CLK_ENABLE\(\);/)
  assert.match(g, /gi\.Pin = GPIO_PIN_13; gi\.Mode = GPIO_MODE_OUTPUT_PP;/)
  assert.match(g, /gi\.Pin = GPIO_PIN_9; gi\.Mode = GPIO_MODE_AF_PP;/)
  assert.match(g, /gi\.Pin = GPIO_PIN_10; gi\.Mode = GPIO_MODE_INPUT;/)
  assert.match(file(p, 'include/gpio.h'), /#define LED_TOGGLE\(\) HAL_GPIO_TogglePin\(LED_PORT, LED_PIN\)/)
  const k = file(p, 'src/clock.c')
  assert.match(k, /osc\.PLL\.PLLMUL = RCC_PLL_MUL9;/)
  assert.match(k, /RCC_SYSCLKSOURCE_PLLCLK/)
  assert.match(k, /HAL_RCC_ClockConfig\(&clk, FLASH_LATENCY_2\)/)
  assert.match(k, /RCC_HCLK_DIV2/)
  assert.match(file(p, 'src/uart.c'), /huart1\.Init\.BaudRate = 115200u;/)
  assert.match(file(p, 'src/board.c'), /HAL_Init\(\)/)
  // F4/G4: номера AF и поля PLL
  let f4 = baseConfig('stm32f411re')
  f4 = setClock(f4, { pllSource: 'hse', hseHz: 8e6 })
  f4 = setClock(f4, autoClock(chip('stm32f411re'), f4.clock, 100e6)!.cfg)
  const pf4 = planGeneration({ ...f4, mode: 'hal' }, {}, OPTS, true)
  assert.match(file(pf4, 'src/gpio.c'), /gi\.Alternate = 7u;/)
  assert.match(file(pf4, 'src/clock.c'), /osc\.PLL\.PLLP = RCC_PLLP_DIV\d;/)
  assert.match(file(pf4, 'src/clock.c'), /__HAL_PWR_VOLTAGESCALING_CONFIG\(PWR_REGULATOR_VOLTAGE_SCALE1\)/)
  let g4 = baseConfig('stm32g474re')
  g4 = setClock(g4, autoClock(chip('stm32g474re'), g4.clock, 170e6)!.cfg)
  const pg4 = planGeneration({ ...g4, mode: 'hal' }, {}, OPTS, true)
  assert.match(file(pg4, 'src/clock.c'), /HAL_PWREx_ControlVoltageScaling\(PWR_REGULATOR_VOLTAGE_SCALE1_BOOST\)/)
  assert.match(file(pg4, 'src/clock.c'), /osc\.PLL\.PLLR = RCC_PLLR_DIV2;/)
  assert.match(file(pg4, 'src/clock.c'), /FLASH_LATENCY_4/)
})

test('режим HAL: ремап F1 и JTAG через макросы HAL', () => {
  let c = defaultPinsConfig('stm32f103c8')
  c = assignSignal(c, 'PB6', 'USART1_TX')
  c = assignSignal(c, 'PB7', 'USART1_RX')
  c = setGpioRole(c, 'PB3', 'output')
  const p = planGeneration({ ...c, mode: 'hal' }, {}, OPTS, true)
  assert.ok(p.ok, p.blocked ?? '')
  const g = file(p, 'src/gpio.c')
  assert.match(g, /__HAL_AFIO_REMAP_SWJ_NOJTAG\(\);/)
  assert.match(g, /__HAL_AFIO_REMAP_USART1_ENABLE\(\);/)
})

test('файл с переводами строк CRLF не считается изменённым', () => {
  const c = baseConfig('stm32f103c8')
  const first = plan(c)
  const disk = Object.fromEntries(first.files.map((f) => [f.path, f.content.replace(/\n/g, '\r\n')]))
  assert.ok(plan(c, disk).files.every((f) => f.status === 'same'))
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHIPS } from './chips/index'
import { BOARD_FACTS } from './boardFacts'
import { analogChannels, boardsForChip, chipDatabase, getChip, getPackage, listChips, memoryMap, pinFunctions, pinsBySignal, searchChips, specialPins } from './chipdb'
import { boards } from '../../renderer/src/reference/data'

const PRIORITY = ['stm32f103c8', 'stm32f401ce', 'stm32f411ce', 'stm32f446re', 'stm32f411re', 'stm32f401re', 'stm32g431kb', 'stm32g474re', 'stm32l476rg', 'stm32l053r8', 'stm32f103rb', 'stm32f407vg', 'stm32h743zi', 'stm32f303re', 'stm32l152re', 'stm32f030f4']

test('база: все приоритетные чипы есть, id уникальны', () => {
  assert.equal(new Set(CHIPS.map((c) => c.id)).size, CHIPS.length)
  for (const id of PRIORITY) assert.ok(getChip(id), id)
  assert.equal(listChips().length, CHIPS.length)
})

test('вес данных ≤ 150 КБ на чип и ≤ 3 МБ всего', () => {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'chips')
  let total = 0
  for (const f of fs.readdirSync(dir)) {
    const n = fs.statSync(path.join(dir, f)).size
    total += n
    assert.ok(n <= 150 * 1024, `${f}: ${n} байт`)
  }
  assert.ok(total <= 3 * 1024 * 1024, 'всего ' + total)
})

test('выводы: позиции уникальны, BOOT0 и NRST есть, AF в 0..15', () => {
  for (const c of CHIPS) for (const p of c.packages) {
    const pos = p.pins.map((r) => r[0])
    assert.equal(new Set(pos).size, pos.length, `${c.id} ${p.name}: позиции`)
    const names = p.pins.filter((r) => r[2] === 'io').map((r) => r[1])
    assert.equal(new Set(names).size, names.length, `${c.id} ${p.name}: имена портов`)
    const sp = specialPins(p).map((s) => s.role)
    assert.ok(sp.includes('BOOT0'), `${c.id} ${p.name}: нет BOOT0`)
    assert.ok(sp.includes('NRST'), `${c.id} ${p.name}: нет NRST`)
    assert.ok(sp.includes('SWDIO') && sp.includes('SWCLK'), `${c.id} ${p.name}: нет SWD`)
    for (const r of p.pins) {
      assert.ok(/^P[A-K]\d{1,2}$/.test(r[1]) || r[2] !== 'io', `${c.id}: имя ${r[1]}`)
      for (const f of r[4]) {
        assert.ok(f[1] >= -1 && f[1] <= 15, `${c.id} ${r[1]} ${f[0]}: AF ${f[1]}`)
        if (f[2] !== undefined) assert.ok(c.family === 'STM32F1', `${c.id}: ремап вне F1`)
      }
    }
  }
})

test('функции ссылаются на существующую периферию кристалла', () => {
  for (const c of CHIPS) {
    const inst = new Set(c.peripherals)
    for (const [, name, , , funcs] of c.packages[0].pins) for (const [s] of funcs) {
      const m = /^(USART|UART|SPI|I2C|ADC|DAC|FDCAN|SDIO|QUADSPI|SAI|LPUART|LPTIM)(\d+)_/.exec(s) ?? /^(TIM)(\d+)_(?:CH|ETR|BKIN)/.exec(s)
      if (m) assert.ok(inst.has(m[1] + m[2]), `${c.id} ${name}: ${s} — нет ${m[1]}${m[2]} в периферии`)
    }
  }
})

test('память: Flash = объёму из open-pin-data, области не пересекаются', () => {
  for (const c of CHIPS) {
    const flash = c.regions.filter((r) => r[3] === 'flash').reduce((a, r) => a + r[2], 0)
    assert.equal(flash, c.flashKB * 1024, c.id)
    const rs = [...memoryMap(c)].sort((a, b) => a[1] - b[1])
    for (let i = 1; i < rs.length; i++) assert.ok(rs[i - 1][1] + rs[i - 1][2] <= rs[i][1], `${c.id}: ${rs[i - 1][0]} и ${rs[i][0]} пересекаются`)
    assert.equal(c.regions[0][1], 0x08000000, c.id)
  }
})

test('файлы проекта: имена согласованы между собой', () => {
  for (const c of CHIPS) {
    const f = c.files
    assert.equal(f.header, f.startup.replace(/^startup_/, '').replace(/\.s$/, '.h'), c.id)
    assert.equal(f.define.toLowerCase().slice(5, 9), f.header.slice(5, 9), c.id)
    assert.ok(/\.svd$/.test(f.svd) && /\.cfg$/.test(f.openocd), c.id)
  }
  const f1 = getChip('stm32f103c8')!.files
  assert.deepEqual([f1.header, f1.define, f1.startup, f1.openocd, f1.svd], ['stm32f103xb.h', 'STM32F103xB', 'startup_stm32f103xb.s', 'stm32f1x.cfg', 'stm32f1/STM32F103.svd'])
})

test('Blue Pill: PC13 — вывод 2 корпуса LQFP48, светодиод — по факту из STM32duino', () => {
  const c = getChip('stm32f103c8')!
  const p = getPackage(c, 'LQFP48')
  assert.equal(p.pins.find((r) => r[1] === 'PC13')![0], '2')
  assert.equal(p.pins.find((r) => r[0] === '44')![1], 'BOOT0')
  assert.equal(BOARD_FACTS.find((b) => b.board === 'bluepill')!.led, 'PC13')
  for (const b of BOARD_FACTS) for (const pin of [b.led, b.button]) if (pin) assert.ok(getPackage(getChip(b.chip)!).pins.some((r) => r[1] === pin), `${b.name}: ${pin}`)
})

test('запросы: сигнал, аналоговые каналы, поиск, ремап F1', () => {
  const g4 = getChip('stm32g431kb')!
  const tx = pinsBySignal(getPackage(g4), 'USART1_TX').map((x) => x.pin)
  assert.ok(tx.includes('PA9') && tx.includes('PB6'), tx.join())
  assert.deepEqual(pinFunctions('stm32g431kb', 'PA9').find((f) => f[0] === 'USART1_TX'), ['USART1_TX', 7])
  const f1 = getPackage(getChip('stm32f103c8')!)
  assert.ok(pinFunctions('stm32f103c8', 'PB6').some((f) => f[0] === 'USART1_TX' && f[2] === 'USART1_ENABLE'))
  assert.ok(pinFunctions('stm32f103c8', 'PA9').some((f) => f[0] === 'USART1_TX' && f[2] === undefined))
  assert.ok(analogChannels(f1).some((a) => a.pin === 'PA0' && a.signal === 'ADC1_IN0'))
  assert.deepEqual(searchChips('lqfp48').map((c) => c.id), ['stm32f103c8'])
  assert.ok(searchChips('cortex-m7').some((c) => c.id === 'stm32h743zi'))
  assert.equal(searchChips('stm32f4 wlcsp').length, 2)
  assert.deepEqual(pinFunctions('нет', 'PA0'), [])
})

test('адаптер ChipDatabase: форматы как в interfaces.ts', async () => {
  assert.equal(chipDatabase.implemented, true)
  const info = await chipDatabase.getChip('STM32F103C8')
  assert.equal(info?.deviceDefine, 'STM32F103xB')
  assert.equal(info?.flashBytes, 64 * 1024)
  assert.equal((await chipDatabase.listChips({ family: 'STM32G4' })).length, 2)
  assert.ok((await chipDatabase.pinFunctions('stm32f401ce')).PA9.some((f) => f.signal === 'USART1_TX' && f.af === 7))
  assert.equal(await chipDatabase.getChip('x'), null)
})

test('платы справочника ↔ база: boardsForChip; расхождения (CHIPDB_DIFFS=1 печатает)', () => {
  const st = boards.filter((b) => b.platform === 'stm32')
  assert.deepEqual(boardsForChip(getChip('stm32f103c8')!, st).map((b) => b.id), ['bluepill'])
  const diffs: string[] = []
  let checked = 0
  for (const c of CHIPS) for (const b of boardsForChip(c, st)) {
    const pkg = getPackage(c)
    for (const pin of b.pins) {
      const code = pin.code ?? ''
      if (!/^P[A-K]\d+$/.test(code)) continue
      const row = pkg.pins.find((r) => r[1] === code)
      if (!row) { diffs.push(`${b.id}: ${code} нет в корпусе ${pkg.name}`); continue }
      for (const f of pin.functions) {
        const sig = f.replace(/\s*\(.*$/, '').replace(/ /g, '_').replace('_SS', '_NSS')
        if (!/^(USART|UART|SPI|I2C|TIM|ADC)\d/.test(sig)) continue
        checked++
        if (!row[4].some((x) => x[0] === sig)) diffs.push(`${b.id}: ${code} «${f}» нет в базе`)
      }
    }
  }
  for (const fact of BOARD_FACTS) {
    const b = st.find((x) => x.id === fact.board)
    if (!b || !fact.led) continue
    const p = b.pins.find((x) => x.code === fact.led)
    if (!p || !p.functions.includes('LED_BUILTIN')) diffs.push(`${b.id}: светодиод ${fact.led} по STM32duino, в справочнике LED_BUILTIN не помечен`)
  }
  assert.ok(checked > 100, 'проверено функций: ' + checked)
  if (process.env.CHIPDB_DIFFS) console.log('проверено функций:', checked, '\n' + diffs.join('\n'))
})

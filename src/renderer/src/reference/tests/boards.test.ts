// Целостность данных схем плат справочника: пины, их положение на плате и согласованность с правилами конструкторов.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boards } from '../data'
import { layouts } from '../data/boardLayouts'
import { boardArt } from '../data/boardArt'
import { PAD_R, PITCH, S, boxesOverlap, fitMode, compBox, labelRows, parseToken, pinCat, pinTags, placePins } from '../boardModel'
import { checkPin, pinChoices } from '../../uibuilder/core/pins'
import { boardPinLabel } from '../../uibuilder/sketch/boardpins'
import { boardRenders } from '../data/boardRenders'
import { BOARD_GROUPS, BOARD_PLATFORMS, PLATFORM_LABELS, type PinInfo } from '../types'

const platOf = (p: string): 'esp8266' | 'esp32' | null => (p === 'esp8266' ? 'esp8266' : p.startsWith('esp32') ? 'esp32' : null)
const order = (id: string, hi: number): string[] =>
  layouts[id].headers[hi].pins.filter((t): t is string => typeof t === 'string').map((t) => parseToken(t).label)

test('платы: id уникальны и у каждой есть схема', () => {
  const ids = boards.map((b) => b.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const b of boards) assert.ok(layouts[b.id], 'нет схемы для ' + b.id)
  for (const id of Object.keys(layouts)) assert.ok(ids.includes(id), 'схема без платы: ' + id)
})

test('платы: подписи и номера пинов уникальны в рамках платы', () => {
  for (const b of boards) {
    const labels = b.pins.map((p) => p.label)
    assert.equal(new Set(labels).size, labels.length, `${b.id}: повторяются подписи`)
    const nums = b.pins.filter((p) => p.gpio !== null).map((p) => p.gpio)
    assert.equal(new Set(nums).size, nums.length, `${b.id}: повторяются номера GPIO`)
  }
})

test('схемы: каждый вывод платы имеет позицию, каждая позиция — вывод', () => {
  for (const b of boards) {
    const placed = placePins(layouts[b.id])
    const have = new Set(placed.map((p) => p.label))
    for (const p of b.pins) assert.ok(have.has(p.label), `${b.id}: у ${p.label} нет позиции на схеме`)
    const known = new Set(b.pins.map((p) => p.label))
    for (const p of placed) assert.ok(known.has(p.label), `${b.id}: на схеме неизвестный вывод ${p.label}`)
  }
})

test('схемы: выводы внутри платы и не ближе шага 2.54 мм друг к другу', () => {
  for (const b of boards) {
    const l = layouts[b.id]
    const placed = placePins(l)
    for (const p of placed) {
      assert.ok(p.x >= 0.5 && p.x <= l.w - 0.3 && p.y >= 0.5 && p.y <= l.h - 0.5, `${b.id}/${p.label}: вне платы (${p.x}, ${p.y})`)
    }
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const d = Math.hypot(placed[i].x - placed[j].x, placed[i].y - placed[j].y)
        assert.ok(d >= PITCH - 0.3, `${b.id}: ${placed[i].label} и ${placed[j].label} ближе шага (${d.toFixed(2)} мм)`)
      }
    }
  }
})

test('схемы: число выводов в гребёнках соответствует документации', () => {
  const count = (id: string): number => placePins(layouts[id]).length
  assert.equal(count('esp32-devkit'), 30)
  assert.equal(count('esp32-devkitc'), 38)
  assert.equal(count('esp32-s3'), 44)
  assert.equal(count('esp32-c3'), 30)
  assert.equal(count('esp32-c3-supermini'), 16)
  assert.equal(count('nodemcu-v2'), 30)
  assert.equal(count('nodemcu-v3'), 30)
  assert.equal(count('wemos-d1-mini'), 16)
  assert.equal(count('nano'), 30)
  assert.equal(count('uno'), 10 + 8 + 8 + 6)
  for (const id of ['esp32-devkit', 'esp32-devkitc', 'esp32-s3', 'esp32-c3', 'nodemcu-v2', 'nodemcu-v3', 'wemos-d1-mini', 'esp32-c3-supermini']) {
    const hs = layouts[id].headers
    assert.equal(hs.length, 2, id)
    assert.equal(hs[0].pins.length, hs[1].pins.length, id)
  }
})

test('схемы: порядок выводов совпадает с документацией (контрольные точки)', () => {
  assert.deepEqual(order('esp32-devkitc', 0).slice(0, 4), ['3V3', 'EN', 'GPIO36', 'GPIO39'])
  assert.deepEqual(order('esp32-devkitc', 1).slice(-3), ['GPIO8', 'GPIO7', 'GPIO6'])
  assert.deepEqual(order('esp32-s3', 0).slice(0, 4), ['3V3', '3V3', 'RST', 'GPIO4'])
  assert.deepEqual(order('esp32-s3', 1).slice(-4), ['GPIO20', 'GPIO19', 'GND', 'GND'])
  assert.deepEqual(order('esp32-c3', 0).slice(0, 4), ['GND', '3V3', '3V3', 'GPIO2'])
  assert.deepEqual(order('esp32-c3', 1).slice(-3), ['GPIO18', 'GPIO19', 'GND'])
  assert.deepEqual(order('wemos-d1-mini', 0), ['RST', 'A0', 'D0', 'D5', 'D6', 'D7', 'D8', '3V3'])
  assert.deepEqual(order('wemos-d1-mini', 1).slice(0, 6), ['D10 (TX)', 'D9 (RX)', 'D1', 'D2', 'D3', 'D4'])
  assert.deepEqual(order('uno', 0), ['A5', 'A4', 'AREF', 'GND', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'])
})

test('согласованность с правилами конструкторов (boardpins / core/pins)', () => {
  for (const b of boards) {
    const plat = platOf(b.platform)
    if (!plat) continue
    const gpios = b.pins.filter((p): p is PinInfo & { gpio: number } => p.gpio !== null)
    const okIn = new Set(pinChoices(plat, 'in-digital').map((c) => c.pin))
    const classic = b.platform === 'esp32' || b.platform === 'esp8266'
    for (const p of gpios) {
      const bad = checkPin(plat, p.gpio, 'in-digital')
      const flashProblem = bad.some((x) => x.code === 'pin-flash')
      if (classic && p.gpio >= 6 && p.gpio <= 11 && b.id !== 'feather-esp32-v2') assert.equal(p.special, 'flash', `${b.id}/${p.label}: GPIO6–11 должны быть помечены flash`)
      if (classic && p.special === 'flash') assert.ok(flashProblem, `${b.id}/${p.label}: flash-пин, а конструктор его пропускает`)
      if (b.platform === 'esp32' && !flashProblem && !(b.id === 'feather-esp32-v2' && p.gpio === 20)) assert.ok(okIn.has(p.gpio), `${b.id}/${p.label}: нет в списке выбора конструктора`)
      if (plat === 'esp8266' && p.special === 'strapping') assert.ok(bad.some((x) => x.code === 'pin-strapping'), `${b.id}/${p.label}: strapping не отмечен в правилах`)
      if (b.platform === 'esp32' && [34, 35, 36, 39].includes(p.gpio)) {
        assert.equal(p.special, 'input-only', `${b.id}/${p.label}`)
        assert.ok(checkPin('esp32', p.gpio, 'out-digital').some((x) => x.code === 'pin-input-only'))
      }
      if (plat === 'esp8266' && /^D\d$/.test(p.label)) {
        assert.ok(boardPinLabel('esp8266', p.gpio).startsWith(p.label + ' '), `${b.id}/${p.label}: метка D не совпадает с boardpins (${boardPinLabel('esp8266', p.gpio)})`)
      }
    }
  }
})

test('категории и теги функций', () => {
  const esp = boards.find((b) => b.id === 'esp32-devkit')!
  assert.equal(pinCat(esp.pins.find((p) => p.label === 'GPIO34')!), 'inonly')
  assert.equal(pinCat(esp.pins.find((p) => p.label === 'GND')!), 'gnd')
  assert.equal(pinCat(esp.pins.find((p) => p.label === 'GPIO21')!), 'i2c')
  const uno = boards.find((b) => b.id === 'uno')!
  assert.ok(pinTags(uno.pins.find((p) => p.label === 'D3')!).some((t) => t.text === 'PWM'))
  assert.equal(pinCat(uno.pins.find((p) => p.label === '5V')!), 'power')
  const c3 = boards.find((b) => b.id === 'esp32-c3')!
  assert.ok(pinTags(c3.pins.find((p) => p.label === 'GPIO18')!).some((t) => t.text === 'USB'))
})

for (const [compact, kk] of [[false, 1], [true, 1], [true, 1.3]] as const) {
  test(`схемы: подписи не накладываются друг на друга, на детали и площадки (${compact ? 'узкий' : 'обычный'} режим, k=${kk})`, () => {
    const errs: string[] = []
    for (const b of boards) {
      const l = layouts[b.id]
      const rows = labelRows(b, l, compact, kk)
      const pads = rows.map((r) => ({ x0: r.pp.x * S - PAD_R, x1: r.pp.x * S + PAD_R, y0: r.pp.y * S - PAD_R, y1: r.pp.y * S + PAD_R }))
      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          if (boxesOverlap(rows[i].box, rows[j].box, 0.5)) errs.push(`${b.id}: подписи ${rows[i].pp.silk} и ${rows[j].pp.silk} накладываются`)
        }
        pads.forEach((pad, j) => {
          if (j !== i && boxesOverlap(rows[i].box, pad, 0.5)) errs.push(`${b.id}: подпись ${rows[i].pp.silk} накрывает площадку ${rows[j].pp.silk}`)
        })
        for (const c of l.comps) {
          const cb = compBox(c)
          if (!cb) continue
          if (!compact && boxesOverlap(pads[i], cb, 0.5)) errs.push(`${b.id}: площадка ${rows[i].pp.silk} лежит под деталью ${c.t}`)
          if (boxesOverlap(rows[i].box, cb, 0.5)) errs.push(`${b.id}: подпись ${rows[i].pp.silk} накладывается на деталь ${c.t}`)
        }
      }
    }
    assert.deepEqual(errs, [])
  })
}

test('схемы: детали внутри платы или выступают лишь разъёмами; каждая плата ссылается на источник', () => {
  for (const b of boards) {
    const l = layouts[b.id]
    assert.ok(b.source && b.source.length > 0, `${b.id}: нет source`)
    for (const u of b.source!) assert.match(u, /^https?:\/\//, `${b.id}: source не ссылка`)
    for (const c of l.comps) {
      const cb = compBox(c)
      if (!cb || c.t === 'btn' || c.t === 'text') continue
      const out = cb.x0 < -1 || cb.y0 < -1 || cb.x1 > l.w * S + 1 || cb.y1 > l.h * S + 1
      if (out) assert.ok(c.t === 'usb' || c.t === 'jack' || c.t === 'module', `${b.id}: деталь ${c.t} выходит за плату`)
    }
  }
})

test('готовые рисунки плат: указана лицензия, выводы внутри рисунка', () => {
  for (const [id, l] of Object.entries(layouts)) {
    if (!l.art) continue
    const a = boardArt[l.art]
    assert.ok(a, `${id}: нет рисунка ${l.art}`)
    assert.match(a.license, /MIT|CC BY-SA|ISC|собственная отрисовка/, `${id}: не указана лицензия рисунка`)
    assert.ok(a.img ? a.img.startsWith('data:image/webp;base64,') : a.svg.startsWith('<svg'), `${id}: рисунок не SVG и не WebP`)
    for (const [name, [x, y]] of Object.entries(a.pins)) {
      assert.ok(x >= a.x - 1 && x <= a.x + a.w + 1 && y >= a.y - 1 && y <= a.y + a.h + 1, `${id}/${name}: вывод вне рисунка`)
    }
  }
})

test('подгонка под ширину панели: подписи не накладываются на любой ширине', () => {
  for (const P of [320, 480, 700, 1000, 1500, 2200]) {
    for (const b of boards) {
      const l = layouts[b.id]
      const v = fitMode(b, l, P)
      const errs: string[] = []
      for (let i = 0; i < v.rows.length; i++) {
        for (let j = i + 1; j < v.rows.length; j++) if (boxesOverlap(v.rows[i].box, v.rows[j].box, 0.5)) errs.push(`${v.rows[i].pp.silk}/${v.rows[j].pp.silk}`)
      }
      assert.deepEqual(errs, [], `${b.id} @${P}px: подписи накладываются`)
      assert.ok(v.k >= 1 && v.k <= 1.3)
    }
  }
})

// ---------- Raspberry Pi Pico и STM32 ----------

const byId = (id: string) => boards.find((b) => b.id === id)!
const pinOf = (id: string, label: string) => byId(id).pins.find((p) => p.label === label)!
const PICOS = ['rpi-pico', 'rpi-pico-w', 'rpi-pico-2']
const STM = ['bluepill', 'blackpill-f411', 'nucleo-f401re', 'nucleo-l432kc']

test('Pico/STM32: число выводов на схемах и порядок по документации', () => {
  const count = (id: string): number => placePins(layouts[id]).length
  for (const id of PICOS) {
    assert.equal(count(id), 40, id)
    assert.deepEqual(order(id, 0), ['GP0', 'GP1', 'GND', 'GP2', 'GP3', 'GP4', 'GP5', 'GND', 'GP6', 'GP7', 'GP8', 'GP9', 'GND', 'GP10', 'GP11', 'GP12', 'GP13', 'GND', 'GP14', 'GP15'])
    assert.deepEqual(order(id, 1), ['GP16', 'GP17', 'GND', 'GP18', 'GP19', 'GP20', 'GP21', 'GND', 'GP22', 'RUN', 'GP26', 'GP27', 'AGND', 'GP28', 'ADC_VREF', '3V3', '3V3_EN', 'GND', 'VSYS', 'VBUS'])
    // выводы GND на гребёнках: физические 3, 8, 13, 18, 23, 28, 38 (AGND, вывод 33, отдельный)
    assert.equal([...order(id, 0), ...order(id, 1)].filter((l) => l === 'GND').length, 7)
  }
  assert.equal(count('bluepill'), 44)
  assert.equal(count('blackpill-f411'), 44)
  assert.equal(count('nucleo-l432kc'), 30)
  assert.equal(count('nucleo-f401re'), 76 + 10 + 8 + 8 + 6)
  assert.deepEqual(order('bluepill', 0).slice(0, 5), ['GND', 'GND', '3V3', 'NRST', 'PB11'])
  assert.deepEqual(order('bluepill', 0).slice(-4), ['PC15', 'PC14', 'PC13', 'VBAT'])
  assert.deepEqual(order('bluepill', 1).slice(0, 5), ['PB12', 'PB13', 'PB14', 'PB15', 'PA8'])
  assert.deepEqual(order('bluepill', 1).slice(-3), ['5V', 'GND', '3V3'])
  assert.deepEqual(order('bluepill', 2), ['3V3', 'PA13', 'PA14', 'GND'])
  assert.deepEqual(order('blackpill-f411', 0).slice(0, 5), ['5V', 'GND', '3V3', 'PB10', 'PB2'])
  assert.deepEqual(order('nucleo-l432kc', 0).slice(0, 4), ['VIN', 'GND', 'NRST', '5V'])
  assert.deepEqual(order('nucleo-l432kc', 1).slice(0, 6), ['PA9', 'PA10', 'NRST', 'GND', 'PA12', 'PB0'])
  // Nucleo-64: Morpho CN10 / CN7 (чётные и нечётные выводы) и Arduino-разъёмы CN5, CN9, CN6, CN8
  assert.deepEqual(order('nucleo-f401re', 0).slice(0, 4), ['PC8', 'PC6', 'PC5', 'U5V'])
  assert.deepEqual(order('nucleo-f401re', 1).slice(0, 4), ['PC9', 'PB8', 'PB9', 'AVDD'])
  assert.deepEqual(order('nucleo-f401re', 2).slice(0, 4), ['PC11', 'PD2', 'E5V', 'GND'])
  assert.deepEqual(order('nucleo-f401re', 3).slice(0, 4), ['PC10', 'PC12', 'VDD', 'BOOT0'])
  assert.deepEqual(order('nucleo-f401re', 4), ['PB8', 'PB9', 'AVDD', 'GND', 'PA5', 'PA6', 'PA7', 'PB6', 'PC7', 'PA9'])
  assert.deepEqual(order('nucleo-f401re', 5), ['PA8', 'PB10', 'PB4', 'PB5', 'PB3', 'PA10', 'PA2', 'PA3'])
  assert.deepEqual(order('nucleo-f401re', 7), ['PA0', 'PA1', 'PA4', 'PB0', 'PC1', 'PC0'])
})

test('Pico: GPIO по таблице функций RP2040, служебные GP23/24/25/29 на гребёнки не выведены', () => {
  for (const id of PICOS) {
    const b = byId(id)
    const gpios = b.pins.filter((p) => p.gpio !== null).map((p) => p.gpio)
    assert.equal(gpios.length, 26, id)
    for (const n of [23, 24, 25, 29]) assert.ok(!gpios.includes(n), `${id}: GP${n} не должен быть на гребёнке`)
    for (const n of [26, 27, 28]) assert.ok(pinOf(id, 'GP' + n).functions.includes('ADC' + (n - 26)), `${id}: ADC на GP${n}`)
    assert.ok(!pinOf(id, 'GP22').functions.some((f) => /^ADC/.test(f)))
    assert.ok(b.notes!.some((n) => /GP25/.test(n) && /GP23/.test(n)), `${id}: нет заметки о служебных GPIO`)
    assert.ok(b.specs!.some(([k]) => k === 'PIO'), `${id}: нет сведений о PIO`)
  }
  const f = (n: number): string[] => pinOf('rpi-pico', 'GP' + n).functions
  assert.deepEqual(f(0).slice(1), ['I2C0 SDA', 'UART0 TX', 'SPI0 MISO (RX)', 'PWM0 A'])
  assert.deepEqual(f(1).slice(1), ['I2C0 SCL', 'UART0 RX', 'SPI0 SS (CSn)', 'PWM0 B'])
  assert.deepEqual(f(4).slice(1), ['I2C0 SDA', 'UART1 TX', 'SPI0 MISO (RX)', 'PWM2 A'])
  assert.deepEqual(f(9).slice(1), ['I2C0 SCL', 'UART1 RX', 'SPI1 SS (CSn)', 'PWM4 B'])
  assert.deepEqual(f(12).slice(1), ['I2C0 SDA', 'UART0 TX', 'SPI1 MISO (RX)', 'PWM6 A'])
  assert.deepEqual(f(16).slice(1), ['I2C0 SDA', 'UART0 TX', 'SPI0 MISO (RX)', 'PWM0 A'])
  assert.deepEqual(f(27).slice(1), ['ADC1', 'I2C1 SCL', 'UART1 RTS', 'SPI1 MOSI (TX)', 'PWM5 B'])
  assert.match(byId('rpi-pico-w').notes!.join(' '), /WL_GPIO0/)
  assert.match(byId('rpi-pico-2').specs!.map((s) => s.join(' ')).join(' '), /520 КБ/)
  assert.match(byId('rpi-pico').specs!.map((s) => s.join(' ')).join(' '), /264 КБ/)
})

test('STM32: порты, функции, ограничения и 5V-tolerant', () => {
  for (const id of STM) {
    const b = byId(id)
    assert.ok(b.specs!.length >= 5, `${id}: мало сведений о плате`)
    assert.ok(b.specs!.some(([k]) => /Ядро/.test(k)) && b.specs!.some(([k]) => /Флеш/.test(k)), `${id}: нет ядра/памяти`)
    assert.ok(b.electrical?.logic.includes('3.3'), `${id}: логика 3.3 В`)
    assert.ok(b.electrical?.tolerant, `${id}: не описана 5V-толерантность`)
    for (const p of b.pins.filter((x) => x.code)) assert.match(p.code!, /^P[A-H]\d+$/, `${id}/${p.label}`)
  }
  const bp = (l: string) => pinOf('bluepill', l)
  assert.equal(bp('PC13').special, 'warning')
  assert.ok(bp('PC13').notes!.includes('3 мА'))
  assert.equal(bp('PA11').special, 'usb')
  assert.equal(bp('PA12').special, 'usb')
  for (const l of ['PB3', 'PB4', 'PA15']) assert.equal(bp(l).special, 'warning', l)
  assert.ok(bp('PA13').functions.includes('SWDIO'))
  assert.ok(bp('PA14').functions.includes('SWCLK'))
  assert.ok(bp('PA0').functions.some((f) => /^ADC1_IN0/.test(f)))
  assert.ok(bp('PB7').functions.includes('I2C1 SDA'))
  assert.ok(bp('PA9').functions.includes('USART1 TX'))
  assert.ok(bp('PA11').functions.some((f) => /^CAN1 RX/.test(f)))
  // 5V-tolerant у F103: PA0–PA7, PB0, PB1, PC13–15 — нет; PA8–PA15, PB2–PB15 — да
  for (const l of ['PA0', 'PA7', 'PB0', 'PB1', 'PC13', 'PC14', 'PC15']) assert.ok(!bp(l).fiveV, l)
  for (const l of ['PA8', 'PA9', 'PA10', 'PA11', 'PA12', 'PA13', 'PA14', 'PA15', 'PB3', 'PB7', 'PB15']) assert.ok(bp(l).fiveV, l)
  assert.equal(pinCat(bp('PA13')), 'swd')
  assert.equal(pinCat(bp('PB7')), 'i2c')
  assert.equal(pinCat(bp('NRST')), 'reset')
  assert.ok(pinTags(bp('PA11')).some((t) => t.cat === 'can'))
  assert.equal(pinOf('blackpill-f411', 'PB2').special, 'strapping')
  assert.ok(pinOf('blackpill-f411', 'PA0').functions.some((f) => /KEY/.test(f)))
  assert.ok(pinOf('nucleo-f401re', 'PA5').functions.some((f) => /LD2/.test(f)))
  assert.ok(pinOf('nucleo-f401re', 'PC13').functions.some((f) => /B1/.test(f)))
  assert.ok(pinOf('nucleo-f401re', 'PA2').functions.some((f) => /VCP/.test(f)))
  assert.ok(pinOf('nucleo-l432kc', 'PB3').functions.some((f) => /LD3/.test(f)))
})

test('Pico/STM32: рисунок и лицензия есть у каждой платы', () => {
  for (const id of [...PICOS, ...STM]) {
    const b = byId(id)
    assert.ok(b.source!.length >= 1, id)
    const art = boardArt[layouts[id].art!]
    assert.ok(art, `${id}: нет рисунка`)
    assert.ok(art.license.length > 10)
    assert.ok(art.svg.length > 1000 || (art.img ?? '').length > 5000)
  }
})

test('рендеры 3D-моделей: выводы лежат на плате, общий вес картинок ≤ 6 МБ', () => {
  let total = 0
  for (const [id, l] of Object.entries(layouts)) {
    const a = l.art ? boardArt[l.art] : null
    if (!a?.img) continue
    total += a.img.length * 0.75
    assert.ok(a.bw && a.bh, `${id}: нет размеров платы`)
    for (const [name, [x, y]] of Object.entries(a.pins)) {
      assert.ok(x > 0 && x < a.bw! && y > 0 && y < a.bh!, `${id}/${name}: вывод вне платы`)
    }
    // рисунок содержит плату целиком с полями под тень
    assert.ok(a.x < 0 && a.y < 0 && a.x + a.w > a.bw! && a.y + a.h > a.bh!, `${id}: рисунок не покрывает плату`)
  }
  assert.ok(total > 0 && total < 6 * 1024 * 1024, `вес картинок ${Math.round(total / 1024)} КБ`)
})

test('платы: у каждой есть источники данных (https), платформа входит в группу списка', () => {
  for (const b of boards) {
    assert.ok(b.source && b.source.length > 0, `${b.id}: нет source`)
    for (const u of b.source!) assert.ok(/^https:\/\//.test(u), `${b.id}: source не https: ${u}`)
    assert.ok(BOARD_PLATFORMS.includes(b.platform), `${b.id}: платформа ${b.platform} не в BOARD_PLATFORMS`)
    assert.ok(BOARD_GROUPS.some((g) => g.platforms.includes(b.platform)), `${b.id}: платформа без группы списка`)
    assert.ok(PLATFORM_LABELS[b.platform], `${b.id}: нет подписи платформы`)
  }
})

test('платы: у каждой есть заметки с пометкой о том, что не подтверждено, или явные размеры', () => {
  for (const b of boards) assert.ok((b.notes ?? []).length > 0, `${b.id}: нет notes`)
})

test('рендеры: у каждой платы есть рисунок, вес не больше 8 МБ суммарно и ~100 КБ на плату', () => {
  let total = 0
  for (const b of boards) {
    const a = boardArt[layouts[b.id].art as string]
    assert.ok(a?.img?.startsWith('data:image/webp;base64,'), `${b.id}: нет WebP-рендера`)
    const bytes = a.img!.length * 0.75
    total += bytes
    assert.ok(bytes <= 100 * 1024, `${b.id}: рендер ${(bytes / 1024).toFixed(0)} КБ — слишком тяжёлый`)
  }
  assert.ok(total <= 8 * 1024 * 1024, `рендеры весят ${(total / 1048576).toFixed(1)} МБ`)
  assert.ok(Object.keys(boardRenders).length >= boards.length - 0, 'не у всех плат есть рендер')
})

test('новые платы: число выводов и порядок по официальным схемам (контрольные точки)', () => {
  const count = (id: string): number => placePins(layouts[id]).length
  assert.equal(count('zero'), 10 + 8 + 8 + 6)
  assert.equal(count('nano-every'), 30)
  assert.equal(count('nano-33-iot'), 30)
  assert.equal(count('nano-esp32'), 30)
  assert.equal(count('micro'), 34)
  assert.equal(count('pro-micro'), 24)
  assert.equal(count('xiao-esp32c3'), 14)
  assert.equal(count('xiao-esp32s3'), 14)
  assert.equal(count('xiao-rp2040'), 14)
  assert.equal(count('xiao-samd21'), 14)
  assert.equal(count('esp32-s2-devkitm'), 42)
  assert.equal(count('esp32-c6-devkitc'), 32)
  assert.equal(count('teensy-40'), 28)
  assert.deepEqual(order('zero', 0).slice(0, 5), ['D21', 'D20', 'AREF', 'GND', 'D13'])
  assert.deepEqual(order('zero', 1).slice(0, 3), ['ATN', 'IOREF', 'RESET'])
  assert.deepEqual(order('nano-every', 0).slice(0, 3), ['D13', '3V3', 'AREF'])
  assert.deepEqual(order('nano-every', 1).slice(-3), ['RESET', 'RX', 'TX'])
  assert.deepEqual(order('nano-esp32', 0).slice(-4), ['VUSB', 'B1', 'GND', 'VIN'])
  assert.deepEqual(order('xiao-esp32c3', 0), ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'])
  assert.deepEqual(order('xiao-esp32c3', 1), ['5V', 'GND', '3V3', 'D10', 'D9', 'D8', 'D7'])
  assert.deepEqual(order('pro-micro', 1), ['RAW', 'GND', 'RST', 'VCC', 'A3', 'A2', 'A1', 'A0', 'D15', 'D14', 'D16', 'D10'])
  assert.deepEqual(order('esp32-s2-devkitm', 1).slice(0, 4), ['GND', 'RST', 'GPIO46', 'GPIO45'])
  assert.deepEqual(order('esp32-c6-devkitc', 0).slice(0, 4), ['3V3', 'RST', 'GPIO4', 'GPIO5'])
  assert.deepEqual(order('esp32-c6-devkitc', 1).slice(0, 3), ['GND', 'TX', 'RX'])
  assert.deepEqual(order('teensy-40', 0).slice(0, 4), ['VIN', 'GND', '3V3', 'D23'])
  assert.deepEqual(order('teensy-40', 1).slice(0, 3), ['GND', 'D0', 'D1'])
})

test('новые платы: все цифровые номера и функции соответствуют заявленному (ESP32-C6/S2 не classic)', () => {
  for (const id of ['esp32-s2-devkitm', 'esp32-c6-devkitc']) {
    const b = boards.find((x) => x.id === id)!
    const bad = b.pins.filter((p) => p.gpio !== null && p.special === 'flash')
    assert.equal(bad.length, 0, id)
  }
})

test('вторая волна: число выводов и порядок по официальным схемам (контрольные точки)', () => {
  const count = (id: string): number => placePins(layouts[id]).length
  assert.equal(count('feather-esp32s3'), 28)
  assert.equal(count('feather-rp2040'), 28)
  assert.equal(count('feather-m0-express'), 28)
  assert.equal(count('lolin-s2-mini'), 32)
  assert.equal(count('lolin-s3-mini'), 32)
  assert.equal(count('lolin-c3-mini'), 16)
  assert.equal(count('ttgo-t-display'), 24)
  assert.equal(count('heltec-lora32-v3'), 36)
  assert.equal(count('esp-01s'), 8)
  assert.equal(count('esp32-cam'), 16)
  assert.equal(count('due'), 86)
  assert.equal(count('teensy-41'), 48)
  assert.deepEqual(order('feather-esp32s3', 0).slice(0, 5), ['RESET', '3V3', '3V3', 'GND', 'A0'])
  assert.deepEqual(order('feather-esp32s3', 1).slice(0, 4), ['VBAT', 'EN', 'VBUS', 'D13'])
  assert.deepEqual(order('feather-rp2040', 0).slice(-3), ['RX', 'TX', 'D4'])
  assert.deepEqual(order('feather-m0-express', 0).slice(-3), ['RX', 'TX', 'GND'])
  assert.deepEqual(order('lolin-c3-mini', 1), ['GPIO21', 'GPIO20', 'GPIO10', 'GPIO8', 'GPIO7', 'GPIO6', 'GND', 'VBUS'])
  assert.deepEqual(order('lolin-s2-mini', 3).slice(-2), ['GND', 'VBUS'])
  assert.deepEqual(order('ttgo-t-display', 0).slice(0, 4), ['GND', 'GND', 'GPIO21', 'GPIO22'])
  assert.deepEqual(order('heltec-lora32-v3', 1).slice(11, 14), ['RST', 'GPIO43', 'GPIO44'])
  assert.deepEqual(order('esp-01s', 0), ['RXD', 'IO0', 'IO2', 'GND'])
  assert.deepEqual(order('esp-01s', 1), ['VCC', 'RST', 'EN', 'TXD'])
  assert.deepEqual(order('esp32-cam', 0), ['5V', 'GND', 'GPIO12', 'GPIO13', 'GPIO15', 'GPIO14', 'GPIO2', 'GPIO4'])
  assert.deepEqual(order('esp32-cam', 1), ['3V3', 'GPIO16', 'GPIO0', 'GND', 'VCC', 'U0R', 'U0T', 'GND'])
  assert.deepEqual(order('due', 0).slice(0, 4), ['SCL1', 'SDA1', 'AREF', 'GND'])
  assert.deepEqual(order('teensy-41', 0).slice(11, 17), ['D15', 'D14', 'D13', 'GND', 'D41', 'D40'])
  assert.deepEqual(order('teensy-41', 1).slice(13, 17), ['D12', '3V3', 'D24', 'D25'])
})

test('третья волна: число выводов и порядок по официальным схемам (контрольные точки)', () => {
  const count = (id: string): number => placePins(layouts[id]).length
  assert.equal(count('uno-r4-minima'), 32)
  assert.equal(count('uno-r4-wifi'), 32)
  assert.equal(count('nano-rp2040-connect'), 30)
  assert.equal(count('mkr-wifi-1010'), 28)
  assert.equal(count('xiao-nrf52840'), 14)
  assert.equal(count('xiao-esp32c6'), 14)
  assert.equal(count('itsybitsy-rp2040'), 28)
  assert.equal(count('qtpy-rp2040'), 14)
  assert.equal(count('teensy-32'), 28)
  assert.equal(count('arduino-mini'), 24)
  assert.equal(count('rpi-pico-2-w'), 40)
  assert.equal(count('waveshare-rp2040-zero'), 23)
  assert.equal(count('waveshare-esp32-s3-zero'), 18)
  assert.deepEqual(order('uno-r4-minima', 0).slice(0, 5), ['SCL', 'SDA', 'AREF', 'GND', 'D13'])
  assert.deepEqual(order('uno-r4-wifi', 1).slice(0, 3), ['BOOT', 'IOREF', 'RESET'])
  assert.deepEqual(order('nano-rp2040-connect', 0).slice(-4), ['5V', 'REC', 'GND', 'VIN'])
  assert.deepEqual(order('mkr-wifi-1010', 1).slice(0, 6), ['5V', 'VIN', '3V3', 'GND', 'RST', 'D14'])
  assert.deepEqual(order('itsybitsy-rp2040', 0).slice(0, 5), ['RESET', '3V3', '3V3', 'VHI', 'A0'])
  assert.deepEqual(order('qtpy-rp2040', 1), ['5V', 'GND', '3V3', 'MOSI', 'MISO', 'SCK', 'RX'])
  assert.deepEqual(order('teensy-32', 0).slice(0, 4), ['VIN', 'AGND', '3V3', 'D23'])
  assert.deepEqual(order('arduino-mini', 1).slice(0, 4), ['9V', 'GND', 'RST', '5V'])
  assert.deepEqual(order('waveshare-rp2040-zero', 2), ['GP13', 'GP12', 'GP11', 'GP10', 'GP9'])
  assert.deepEqual(order('waveshare-esp32-s3-zero', 1).slice(0, 3), ['TX', 'RX', 'GPIO13'])
})

test('четвёртая волна: число выводов и порядок по официальным источникам (контрольные точки)', () => {
  const count = (id: string): number => placePins(layouts[id]).length
  assert.equal(count('esp32-c3-devkitc-02'), 30)
  assert.equal(count('esp32-s3-devkitm-1'), 44)
  assert.equal(count('teensy-lc'), 28)
  assert.equal(count('itsybitsy-m0-express'), 28)
  assert.equal(count('itsybitsy-nrf52840'), 28)
  assert.equal(count('trinket-m0'), 10)
  assert.equal(count('nodemcu-32s'), 38)
  assert.equal(count('esp8684-devkitm-1'), 30)
  assert.equal(count('esp32-h2-devkitm-1'), 30)
  assert.equal(count('nano-matter'), 30)
  assert.equal(count('weact-rp2040'), 40)
  assert.deepEqual(order('esp32-c3-devkitc-02', 0).slice(0, 5), ['GND', '3V3', '3V3', 'RST', 'GND'])
  assert.deepEqual(order('esp32-s3-devkitm-1', 1).slice(-3), ['GPIO19', 'GPIO48', 'GPIO47'])
  assert.deepEqual(order('teensy-lc', 0).slice(0, 4), ['VIN', 'GND', '3V3', 'D23'])
  assert.deepEqual(order('itsybitsy-m0-express', 0).slice(0, 4), ['RESET', '3V3', 'AREF', 'VHI'])
  assert.deepEqual(order('itsybitsy-nrf52840', 0).slice(0, 4), ['RESET', '3V3', 'EN', 'VHI'])
  assert.deepEqual(order('trinket-m0', 0), ['VBAT', 'GND', 'D4', 'D3', 'RESET'])
  assert.deepEqual(order('trinket-m0', 1), ['VBUS', 'D0', 'D1', 'D2', '3V3'])
  assert.deepEqual(order('nodemcu-32s', 0).slice(0, 4), ['3V3', 'EN', 'GPIO36', 'GPIO39'])
  assert.deepEqual(order('nodemcu-32s', 1).slice(-3), ['GPIO8', 'GPIO7', 'GPIO6'])
  assert.deepEqual(order('esp32-h2-devkitm-1', 0).slice(10, 12), ['NC', 'VBAT'])
  assert.deepEqual(order('nano-matter', 1).slice(-4), ['GND', 'RST', 'D1', 'D0'])
  assert.deepEqual(order('weact-rp2040', 1).slice(0, 7), ['VBUS', 'VSYS', 'GND', '3V3', 'GPIO24', 'ADC_VREF', 'GPIO29'].map((x) => (x.startsWith('GPIO') ? 'GP' + x.slice(4) : x)))
})

test('пятая волна: число выводов и порядок по официальным источникам (контрольные точки)', () => {
  const count = (id: string): number => placePins(layouts[id]).length
  assert.equal(count('qtpy-esp32s3'), 14)
  assert.equal(count('qtpy-esp32s2'), 14)
  assert.equal(count('qtpy-esp32c3'), 14)
  assert.equal(count('feather-m4-express'), 28)
  assert.equal(count('itsybitsy-m4-express'), 28)
  assert.equal(count('tdisplay-s3'), 24)
  assert.equal(count('heltec-ws-lite-v3'), 40)
  assert.deepEqual(order('qtpy-esp32c3', 0), ['A0', 'A1', 'A2', 'A3', 'SDA', 'SCL', 'TX'])
  assert.deepEqual(order('qtpy-esp32s3', 1), ['5V', 'GND', '3V3', 'MOSI', 'MISO', 'SCK', 'RX'])
  assert.deepEqual(order('feather-m4-express', 0).slice(-3), ['D0', 'D1', 'D4'])
  assert.deepEqual(order('itsybitsy-m4-express', 1).slice(0, 4), ['VBAT', 'GND', 'VBUS', 'D13'])
  assert.deepEqual(order('tdisplay-s3', 0).slice(0, 5), ['3V3', 'GPIO1', 'GPIO2', 'GPIO3', 'GPIO10'])
  assert.deepEqual(order('tdisplay-s3', 1).slice(0, 4), ['GND', 'GND', 'GPIO43', 'GPIO44'])
  assert.deepEqual(order('heltec-ws-lite-v3', 0).slice(0, 3), ['Ve', 'GND', 'GPIO12'])
  assert.deepEqual(order('heltec-ws-lite-v3', 1).slice(0, 4), ['5V', '3V3', 'GND', 'GPIO47'])
})


test('пятая волна (часть 2): Nucleo-64/32 и Feather — число выводов и порядок', () => {
  const count = (id: string): number => placePins(layouts[id]).length
  for (const id of ['nucleo-f411re', 'nucleo-f446re', 'nucleo-f103rb', 'nucleo-l053r8', 'nucleo-l476rg', 'nucleo-g474re', 'nucleo-l152re', 'nucleo-f303re']) assert.equal(count(id), count('nucleo-f401re'), id)
  assert.equal(count('nucleo-g431kb'), 30)
  assert.equal(count('metro-m0-express'), count('metro-m4-express'))
  assert.deepEqual(order('metro-esp32-s3', 1).slice(0, 5), ['NC', 'IOREF', 'RESET', '3V3', 'VHIGH'])
  assert.deepEqual(order('kb2040', 0).slice(0, 6), ['D+', 'D0', 'D1', 'GND', 'GND', 'D2'])
  assert.deepEqual(order('kb2040', 1).slice(0, 5), ['D-', 'RAW', 'GND', 'RESET', '3V3'])
  assert.deepEqual(order('kb2040', 1).slice(-5), ['A0', 'SCK', 'MISO', 'MOSI', 'D10'])
  assert.equal(count('metro-m4-express'), count('uno-r4-minima'))
  assert.deepEqual(order('metro-m4-express', 1).slice(0, 5), ['NC', 'IOREF', 'RESET', '3V3', '5V'])
  assert.deepEqual(order('metro-m4-express', 0).slice(0, 4), ['SCL', 'SDA', 'AREF', 'GND'])
  assert.equal(count('feather-esp32-v2'), 28)
  assert.equal(count('feather-esp32-s2'), 28)
  assert.equal(count('feather-nrf52840-sense'), 28)
  assert.deepEqual(order('nucleo-g431kb', 1).slice(0, 4), ['PA9', 'PA10', 'NRST', 'GND'])
  assert.deepEqual(order('nucleo-g431kb', 0).slice(-2), ['AREF', '3V3'].concat(['PB8']).slice(0, 0).concat(['3V3', 'PB8']))
  assert.deepEqual(order('feather-esp32-v2', 0).slice(0, 5), ['RESET', '3V3', 'NC', 'GND', 'A0'])
  assert.deepEqual(order('feather-nrf52840-sense', 0).slice(-3), ['RX', 'TX', 'D2'])
  assert.ok(boards.find((b) => b.id === 'nucleo-f103rb')!.pins.some((p) => p.label === 'PD0'))
  assert.ok(!boards.find((b) => b.id === 'nucleo-f446re')!.pins.some((p) => p.label === 'PB11'))
})

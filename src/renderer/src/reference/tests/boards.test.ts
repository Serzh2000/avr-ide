// Целостность данных схем плат справочника: пины, их положение на плате и согласованность с правилами конструкторов.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boards } from '../data'
import { layouts } from '../data/boardLayouts'
import { boardArt } from '../data/boardArt'
import { PAD_R, PITCH, S, boxesOverlap, fitMode, compBox, labelRows, parseToken, pinCat, pinTags, placePins } from '../boardModel'
import { checkPin, pinChoices } from '../../uibuilder/core/pins'
import { boardPinLabel } from '../../uibuilder/sketch/boardpins'
import type { PinInfo } from '../types'

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
      if (classic && p.gpio >= 6 && p.gpio <= 11) assert.equal(p.special, 'flash', `${b.id}/${p.label}: GPIO6–11 должны быть помечены flash`)
      if (classic && p.special === 'flash') assert.ok(flashProblem, `${b.id}/${p.label}: flash-пин, а конструктор его пропускает`)
      if (b.platform === 'esp32' && !flashProblem) assert.ok(okIn.has(p.gpio), `${b.id}/${p.label}: нет в списке выбора конструктора`)
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
    assert.match(a.license, /MIT|CC BY-SA/, `${id}: не указана лицензия рисунка`)
    assert.ok(a.svg.startsWith('<svg'), `${id}: рисунок не SVG`)
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

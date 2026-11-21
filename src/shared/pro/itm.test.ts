import test from 'node:test'
import assert from 'node:assert/strict'
import { ItmParser, ItmText, parseItm } from './itm'

const u = (...b: number[]): Uint8Array => Uint8Array.from(b)
const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0))
/** Однобайтные пакеты SWIT порта 0, как делает ITM_SendChar: заголовок 0x01, затем символ */
const sendChar = (s: string): number[] => ascii(s).flatMap((c) => [0x01, c])

test('SWIT: один, два и четыре байта; номер порта берётся из битов 7:3', () => {
  const e = parseItm(u(0x01, 0x48, 0x02, 0x69, 0x21, 0x0b, 1, 2, 3, 4))
  assert.deepEqual(e, [
    { type: 'swit', port: 0, data: u(0x48) },
    { type: 'swit', port: 0, data: u(0x69, 0x21) },
    { type: 'swit', port: 1, data: u(1, 2, 3, 4) }
  ])
})

test('printf-подобный текст из однобайтных пакетов собирается в строку', () => {
  const t = new ItmText(0)
  assert.equal(t.feed(parseItm(u(...sendChar('Hello\r\n')))), 'Hello\r\n')
  assert.equal(t.stats.bytes, 7)
  assert.deepEqual(t.stats.ports, { 0: 7 })
})

test('порты разделяются: текст берётся только с выбранного, остальные считаются', () => {
  const t = new ItmText(0)
  const text = t.feed(parseItm(u(0x01, 0x41, 0x09, 0x58, 0x01, 0x42)))
  assert.equal(text, 'AB')
  assert.deepEqual(t.stats.ports, { 0: 2, 1: 1 })
})

test('переполнение 0x70 даёт событие и не портит следующий пакет', () => {
  const e = parseItm(u(0x01, 0x41, 0x70, 0x01, 0x42))
  assert.deepEqual(e.map((x) => x.type), ['swit', 'overflow', 'swit'])
  const t = new ItmText(0)
  assert.equal(t.feed(e), 'AB')
  assert.equal(t.stats.overflows, 1)
})

test('локальные метки времени: формат 2 (один байт) и формат 1 (с продолжением)', () => {
  assert.deepEqual(parseItm(u(0x30)), [{ type: 'timestamp', ticks: 3, kind: 'local' }])
  // 0xC0: формат 1, TC=0; 0x85 (продолжение, 5), 0x03 → 5 + 3*128 = 389
  assert.deepEqual(parseItm(u(0xc0, 0x85, 0x03)), [{ type: 'timestamp', ticks: 389, kind: 'local' }])
  // метка между пакетами данных не мешает тексту
  const t = new ItmText(0)
  assert.equal(t.feed(parseItm(u(0x01, 0x41, 0xd0, 0x81, 0x01, 0x01, 0x42))), 'AB')
  assert.equal(t.stats.timestamps, 1)
})

test('глобальные метки времени 0x94 и 0xB4', () => {
  assert.deepEqual(parseItm(u(0x94, 0x81, 0x02)), [{ type: 'timestamp', ticks: 1 + 2 * 128, kind: 'global' }])
  assert.deepEqual(parseItm(u(0xb4, 0x07)), [{ type: 'timestamp', ticks: 7, kind: 'global' }])
})

test('синхронизация: серия нулей и 0x80; нули в начале потока не ломают разбор', () => {
  const e = parseItm(u(0, 0, 0, 0, 0, 0x80, 0x01, 0x41))
  assert.deepEqual(e.map((x) => x.type), ['sync', 'swit'])
})

test('аппаратные источники DWT пропускаются вместе с нагрузкой и считаются', () => {
  // 0x17: SS=3 (4 байта), бит 2 = 1 (hw), источник 2 (PC sample)
  const e = parseItm(u(0x17, 1, 2, 3, 4, 0x01, 0x5a))
  assert.deepEqual(e.map((x) => x.type), ['hw', 'swit'])
  const t = new ItmText(0)
  assert.equal(t.feed(e), 'Z')
  assert.equal(t.stats.hw, 1)
})

test('граница куска посреди пакета: результат тот же, что при подаче целиком', () => {
  const all = u(...sendChar('abc'), 0x70, 0x03, 1, 2, 3, 4, 0xc0, 0x85, 0x03, 0x01, 0x7a)
  const whole = parseItm(all)
  for (let cut = 1; cut < all.length; cut++) {
    const p = new ItmParser()
    const ev = [...p.push(all.slice(0, cut)), ...p.push(all.slice(cut))]
    assert.deepEqual(ev, whole, 'разрез на ' + cut)
  }
})

test('UTF-8: символ, разорванный между пакетами, собирается', () => {
  // «ы» = D1 8B
  const t = new ItmText(0)
  let s = t.feed(parseItm(u(0x01, 0xd1)))
  s += t.feed(parseItm(u(0x01, 0x8b, 0x01, 0x21)))
  assert.equal(s, 'ы!')
})

test('мусор и незнакомые расширения не вызывают исключений', () => {
  assert.doesNotThrow(() => parseItm(u(0xff, 0xff, 0xff, 0xff, 0xff, 0x01)))
  const rnd = Uint8Array.from({ length: 2000 }, (_, i) => (i * 131 + 7) & 0xff)
  assert.doesNotThrow(() => parseItm(rnd))
})

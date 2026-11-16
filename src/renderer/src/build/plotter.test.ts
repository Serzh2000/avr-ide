import test from 'node:test'
import assert from 'node:assert/strict'
import { LineSplitter, PlotBuffer, computeRange, formatTick, niceTicks, parseLine } from './plotter'

test('parseLine: числа через пробел, запятую и табуляцию', () => {
  assert.deepEqual(parseLine('1 2 3'), [{ name: null, value: 1 }, { name: null, value: 2 }, { name: null, value: 3 }])
  assert.deepEqual(parseLine('1.5,-2,3e2')?.map((s) => s.value), [1.5, -2, 300])
  assert.deepEqual(parseLine('4\t5\r')?.map((s) => s.value), [4, 5])
  assert.deepEqual(parseLine('  7  ')?.map((s) => s.value), [7])
})

test('parseLine: именованные значения', () => {
  assert.deepEqual(parseLine('temp:23.5,hum:40'), [{ name: 'temp', value: 23.5 }, { name: 'hum', value: 40 }])
  assert.deepEqual(parseLine('a:1 b:2'), [{ name: 'a', value: 1 }, { name: 'b', value: 2 }])
  assert.deepEqual(parseLine('Temperature: 23.5, Hum: 40'), [{ name: 'Temperature', value: 23.5 }, { name: 'Hum', value: 40 }])
})

test('parseLine: обычный текст и мусор — не данные', () => {
  assert.equal(parseLine('Hello world'), null)
  assert.equal(parseLine('--- COM3 @ 115200 ---'), null)
  assert.equal(parseLine('x:abc'), null)
  assert.equal(parseLine('1 2 oops'), null)
  assert.equal(parseLine(''), null)
  assert.equal(parseLine('NaN'), null)
  assert.equal(parseLine(':5'), null)
  assert.equal(parseLine('1'.repeat(700)), null)
})

test('LineSplitter: неполные строки склеиваются между порциями', () => {
  const s = new LineSplitter()
  assert.deepEqual(s.push('1 2'), [])
  assert.deepEqual(s.push(' 3\r\n4 5'), ['1 2 3'])
  assert.deepEqual(s.push('\n6\n'), ['4 5', '6'])
  assert.deepEqual(s.push('x'), [])
})

test('PlotBuffer: имена, пропуски и безымянные ряды', () => {
  const b = new PlotBuffer()
  b.feed(['1 2', 'мусор', 'a:5'])
  assert.deepEqual(b.names, ['Значение 1', 'Значение 2', 'a'])
  assert.equal(b.rows.length, 2)
  assert.deepEqual(b.rows[0].slice(0, 2), [1, 2])
  assert.ok(Number.isNaN(b.rows[0][2]))
  assert.equal(b.rows[1][2], 5)
  assert.ok(Number.isNaN(b.rows[1][0]))
})

test('PlotBuffer: ёмкость, абсолютная нумерация и окно', () => {
  const b = new PlotBuffer(10)
  for (let i = 0; i < 25; i++) b.add([{ name: null, value: i }])
  assert.equal(b.rows.length, 10)
  assert.equal(b.first, 15)
  assert.equal(b.total, 25)
  const w = b.window(4)
  assert.deepEqual(w.rows.map((r) => r[0]), [21, 22, 23, 24])
  assert.equal(w.start, 21)
  // «пауза»: окно, заканчивающееся на 20-й точке, не двигается при новых данных
  const frozen = b.window(3, 20)
  b.add([{ name: null, value: 99 }])
  assert.deepEqual(b.window(3, 20).rows.map((r) => r[0]), frozen.rows.map((r) => r[0]))
  assert.deepEqual(frozen.rows.map((r) => r[0]), [17, 18, 19])
})

test('PlotBuffer: очистка и лимит числа рядов', () => {
  const b = new PlotBuffer()
  b.add([{ name: 'a', value: 1 }])
  b.clear()
  assert.equal(b.rows.length, 0)
  assert.deepEqual(b.names, [])
  assert.equal(b.total, 1)
  const many = Array.from({ length: 30 }, (_, i) => ({ name: 'n' + i, value: i }))
  b.add(many)
  assert.equal(b.names.length, 16)
})

test('computeRange: поля, плоская линия, скрытые ряды', () => {
  const r = computeRange([[0, 10], [100, 5]], [true, true])
  assert.ok(r.min < 0 && r.max > 100)
  const flat = computeRange([[5], [5]], [true])
  assert.ok(flat.min < 5 && flat.max > 5)
  const zero = computeRange([[0], [0]], [true])
  assert.deepEqual(zero, { min: -1, max: 1 })
  const hidden = computeRange([[1, 1000], [2, 2000]], [true, false])
  assert.ok(hidden.max < 10)
  assert.deepEqual(computeRange([[NaN]], [true]), { min: 0, max: 1 })
})

test('niceTicks и formatTick', () => {
  assert.deepEqual(niceTicks(0, 10, 5), [0, 2, 4, 6, 8, 10])
  assert.deepEqual(niceTicks(-1, 1, 4), [-1, -0.5, 0, 0.5, 1])
  assert.ok(niceTicks(0.1, 0.9).every((v) => v >= 0.1 && v <= 0.9))
  assert.equal(formatTick(2.5), '2.5')
  assert.equal(formatTick(1500000), '1.5e6')
  assert.equal(formatTick(0), '0')
})

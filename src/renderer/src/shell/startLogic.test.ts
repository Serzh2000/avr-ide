import test from 'node:test'
import assert from 'node:assert/strict'
import { formatWhen, midEllipsis, shortBoard } from './startLogic'

const now = new Date(2026, 10, 15, 18, 30)

test('formatWhen: сегодня, вчера, неделя, дата', () => {
  assert.equal(formatWhen(new Date(2026, 10, 15, 9, 5).getTime(), now), 'сегодня, 09:05')
  assert.equal(formatWhen(new Date(2026, 10, 14, 23, 59).getTime(), now), 'вчера')
  assert.equal(formatWhen(new Date(2026, 10, 12, 10, 0).getTime(), now), '3 дн. назад')
  assert.equal(formatWhen(new Date(2026, 9, 2, 10, 0).getTime(), now), '2 окт')
  assert.equal(formatWhen(new Date(2025, 2, 3, 10, 0).getTime(), now), '3 мар 2025')
})

test('shortBoard: имя платы или хвост FQBN', () => {
  assert.equal(shortBoard(undefined, () => 'x'), '')
  assert.equal(shortBoard('arduino:avr:uno', () => 'Arduino Uno'), 'Arduino Uno')
  assert.equal(shortBoard('esp32:esp32:esp32s3', () => undefined), 'esp32s3')
})

test('midEllipsis: короткий путь не меняется, длинный сокращается в середине', () => {
  assert.equal(midEllipsis('C:\a\b', 58), 'C:\a\b')
  const long = 'C:\Users\someone\Documents\Arduino\projects\very_long_folder_name\MyProject'
  const r = midEllipsis(long, 40)
  assert.equal(r.length, 40)
  assert.ok(r.startsWith('C:\Users'))
  assert.ok(r.endsWith('MyProject'))
  assert.ok(r.includes('…'))
})

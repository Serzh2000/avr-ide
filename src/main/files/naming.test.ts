import test from 'node:test'
import assert from 'node:assert/strict'
import { suggestSketchName, validateSketchName } from './naming'

test('validateSketchName: допустимые имена', () => {
  for (const n of ['blink', 'My_Project-2', '_x', 'a', 'sketch_nov15a']) assert.equal(validateSketchName(n), null, n)
})

test('validateSketchName: понятные сообщения', () => {
  assert.match(validateSketchName('')!, /Введите/)
  assert.match(validateSketchName('-abc')!, /дефис/)
  assert.match(validateSketchName('проект')!, /латинск/)
  assert.match(validateSketchName('my project')!, /пробел/)
  assert.match(validateSketchName('a.b')!, /Допустимы/)
  assert.match(validateSketchName('a/b')!, /Допустимы/)
  assert.match(validateSketchName('NUL')!, /зарезервировано/)
  assert.match(validateSketchName('x'.repeat(64))!, /длинное/)
})

test('suggestSketchName: формат и пропуск занятых', () => {
  const d = new Date(2026, 10, 5)
  assert.equal(suggestSketchName(() => false, d), 'sketch_nov05a')
  const taken = new Set(['sketch_nov05a', 'sketch_nov05b'])
  assert.equal(suggestSketchName((n) => taken.has(n), d), 'sketch_nov05c')
  const all = (n: string): boolean => /[a-z]$/.test(n)
  assert.equal(suggestSketchName(all, d), 'sketch_nov051')
})

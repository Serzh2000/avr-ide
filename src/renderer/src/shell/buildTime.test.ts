import test from 'node:test'
import assert from 'node:assert/strict'
import { fmtElapsed, isLongFirstBuild } from './buildTime'

test('fmtElapsed: минуты, секунды, часы', () => {
  assert.equal(fmtElapsed(0), '0:00')
  assert.equal(fmtElapsed(42), '0:42')
  assert.equal(fmtElapsed(125), '2:05')
  assert.equal(fmtElapsed(3725), '1:02:05')
  assert.equal(fmtElapsed(-3), '0:00')
})

test('isLongFirstBuild: после 30 секунд и до линковки', () => {
  assert.equal(isLongFirstBuild(10, 'Компиляция ядра'), false)
  assert.equal(isLongFirstBuild(45, 'Компиляция ядра · 120 файлов'), true)
  assert.equal(isLongFirstBuild(45, 'Линковка'), false)
  assert.equal(isLongFirstBuild(200, undefined), true)
})

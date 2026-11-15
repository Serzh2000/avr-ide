import test from 'node:test'
import assert from 'node:assert/strict'
import { isInside, isSketchFileName, isSketchName, isValidEntryName } from './paths'

const win = process.platform === 'win32'
const root = win ? 'C:\\proj\\blink' : '/proj/blink'
const j = (s: string): string => (win ? 'C:\\' + s.replace(/\//g, '\\') : '/' + s)

test('isInside: внутри и снаружи', () => {
  assert.ok(isInside(root, root))
  assert.ok(isInside(root, j('proj/blink/a.ino')))
  assert.ok(isInside(root, j('proj/blink/sub/x.h')))
  assert.ok(!isInside(root, j('proj/blink/../other/a.ino')))
  assert.ok(!isInside(root, j('proj/blink2/a.ino')))
  assert.ok(!isInside(root, j('proj')))
  assert.ok(!isInside(root, ''))
  assert.ok(!isInside(root, j('proj/blink/a\0.ino')))
})

test('isValidEntryName', () => {
  for (const ok of ['a.ino', 'ui_generated.h', 'папка', 'data.json']) assert.ok(isValidEntryName(ok), ok)
  for (const bad of ['', '.', '..', 'a/b', 'a\\b', 'a:b', 'con', 'NUL.txt', 'x.', ' x', 'a*b', 5, null]) {
    assert.ok(!isValidEntryName(bad), String(bad))
  }
})

test('isSketchName / isSketchFileName', () => {
  assert.ok(isSketchName('Blink_1'))
  assert.ok(!isSketchName('-x'))
  assert.ok(!isSketchName('мой'))
  assert.ok(isSketchFileName('ui_generated.h'))
  assert.ok(isSketchFileName('page.html'))
  assert.ok(!isSketchFileName('evil.exe'))
  assert.ok(!isSketchFileName('..\\x.h'))
  assert.ok(!isSketchFileName('noext'))
})

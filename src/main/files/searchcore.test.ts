import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMatcher, findInText, hasBinaryExt, isDangerousRegex, looksBinary, replaceInText, skipEntry } from './searchcore'

const opt = (o: Partial<{ caseSensitive: boolean; wholeWord: boolean; regex: boolean }> = {}) => ({ caseSensitive: false, wholeWord: false, regex: false, ...o })
const re = (q: string, o = opt()): RegExp => {
  const m = buildMatcher(q, o)
  assert.ok(m.ok, 'ok')
  return (m as { re: RegExp }).re
}

test('обычный поиск: спецсимволы экранируются, регистр по умолчанию не важен', () => {
  const r = findInText('digitalWrite(13, HIGH);\nDigitalWrite(a.b)', re('digitalWrite('), 100)
  assert.equal(r.matches.length, 2)
  assert.deepEqual(r.matches.map((m) => [m.line, m.col, m.len]), [[1, 1, 13], [2, 1, 13]])
  assert.equal(findInText('a.b axb', re('a.b'), 10).matches.length, 1)
})

test('учёт регистра', () => {
  assert.equal(findInText('Led led LED', re('led', opt({ caseSensitive: true })), 10).matches.length, 1)
  assert.equal(findInText('Led led LED', re('led'), 10).matches.length, 3)
})

test('целое слово, в том числе с кириллицей', () => {
  const o = opt({ wholeWord: true })
  assert.equal(findInText('pin pinMode pin_1 pin', re('pin', o), 10).matches.length, 2)
  assert.equal(findInText('кот котёнок кот', re('кот', o), 10).matches.length, 2)
})

test('регулярные выражения и ошибки', () => {
  const o = opt({ regex: true })
  const r = findInText('x1 y22 z333', re('[a-z]\\d{2,}', o), 10)
  assert.deepEqual(r.matches.map((m) => m.col), [4, 8])
  const bad = buildMatcher('(abc', o)
  assert.equal(bad.ok, false)
  assert.match((bad as { error: string }).error, /регулярное/)
  assert.equal(buildMatcher('', o).ok, false)
  assert.equal(buildMatcher('a'.repeat(300), opt()).ok, false)
})

test('защита от катастрофических регулярок', () => {
  for (const s of ['(a+)+', '(.*)*', '(\\w+\\s?)+$', '((a+)b)*', '(a|a)*', '(x+x+)+y']) assert.ok(isDangerousRegex(s), s)
  for (const s of ['a+b+', '(abc)+', '[a-z]+\\d*', '(foo|bar)+', '\\(a+\\)+', '[(+]+', 'digitalWrite\\((\\d+),']) assert.ok(!isDangerousRegex(s), s)
  const m = buildMatcher('(a+)+$', opt({ regex: true }))
  assert.equal(m.ok, false)
})

test('сверхдлинные строки режутся, время ограничено', () => {
  const long = 'a'.repeat(100000) + 'needle'
  assert.equal(findInText(long, re('needle'), 10).matches.length, 0)
  assert.equal(findInText('needle\n'.repeat(1000), re('needle'), 10, Date.now() - 1).truncated, true)
  const lim = findInText('x\n'.repeat(50), re('x'), 5)
  assert.equal(lim.matches.length, 5)
  assert.equal(lim.truncated, true)
})

test('предпросмотр: длинная строка обрезается вокруг совпадения', () => {
  const line = 'q'.repeat(500) + 'FIND' + 'w'.repeat(500)
  const m = findInText(line, re('FIND'), 5).matches[0]
  assert.ok(m.text.length <= 240)
  assert.equal(m.text.slice(m.start, m.start + m.len), 'FIND')
  assert.equal(m.col, 501)
})

test('пустые совпадения пропускаются', () => {
  assert.equal(findInText('abc', re('x*', opt({ regex: true })), 10).matches.length, 0)
})

test('замена: буквальный текст и подстановки $1 в режиме регулярок', () => {
  assert.deepEqual(replaceInText('a.b a.b', re('a.b'), '$1', false), { text: '$1 $1', count: 2 })
  const o = opt({ regex: true })
  assert.deepEqual(replaceInText('pin 13, pin 7', re('pin (\\d+)', o), 'P$1', true), { text: 'P13, P7', count: 2 })
  assert.equal(replaceInText('ab', re('(a)(b)', o), '$2$1$$$&', true).text, 'ba$ab')
  assert.deepEqual(replaceInText('abc', re('x', opt()), 'y', false), { text: 'abc', count: 0 })
  assert.equal(replaceInText('Led led', re('led'), 'X', false).text, 'X X')
})

test('бинарные файлы и пропускаемые имена', () => {
  assert.ok(looksBinary(new Uint8Array([65, 0, 66])))
  assert.ok(!looksBinary(new Uint8Array([65, 66])))
  assert.ok(hasBinaryExt('a.PNG') && hasBinaryExt('fw.bin') && !hasBinaryExt('a.ino') && !hasBinaryExt('Makefile'))
  assert.ok(skipEntry('.git', true) && skipEntry('node_modules', true) && skipEntry('.hidden.txt', false))
  assert.ok(!skipEntry('data', true) && !skipEntry('Blink.ino', false))
})

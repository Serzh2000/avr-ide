// Запуск: node --test data/reference/search.test.mjs   (Node 22.6+/24: TS-типы вырезаются автоматически)
import test from 'node:test'
import assert from 'node:assert/strict'

const base = '../../src/renderer/src/reference/'
const { search, lookupIn, tokenize } = await import(base + 'search.ts')
const { general } = await import(base + 'data/general.ts')
const { avr } = await import(base + 'data/avr.ts')
const { esp8266 } = await import(base + 'data/esp8266.ts')
const { esp32 } = await import(base + 'data/esp32.ts')
const { boards } = await import(base + 'data/boards.ts')

const all = [...general, ...avr, ...esp8266, ...esp32]

test('tokenize: camelCase и точки', () => {
  assert.deepEqual(tokenize('digitalWrite'), ['digital', 'write'])
  assert.deepEqual(tokenize('Serial.begin'), ['serial', 'begin'])
})

test('точное имя — первым', () => {
  assert.equal(search(all, 'digitalWrite')[0].name, 'digitalWrite')
  assert.equal(search(all, 'millis')[0].name, 'millis')
})

test('метод по последнему сегменту', () => {
  assert.equal(search(all, 'println')[0].name, 'Serial.println')
})

test('фильтр по платформе', () => {
  const r = search(all, 'ledc', 'esp8266')
  assert.ok(!r.some((e) => e.name.startsWith('ledc')))
  assert.ok(search(all, 'ledc', 'esp32').length >= 3)
})

test('поиск по описанию на русском', () => {
  assert.ok(search(all, 'прерывание').some((e) => e.name === 'attachInterrupt'))
})

test('lookup для F1', () => {
  assert.equal(lookupIn(all, 'pinMode')?.name, 'pinMode')
  assert.equal(lookupIn(all, 'WiFi.begin', 'esp8266')?.platforms.join(), 'esp8266')
  assert.equal(lookupIn(all, 'qwertyzzz'), undefined)
  assert.equal(lookupIn(all, 'EEPROM.read', 'esp32'), undefined)
})

test('целостность данных', () => {
  const keys = new Set()
  for (const e of all) {
    const k = e.name + '|' + e.platforms.join(',')
    assert.ok(!keys.has(k), 'дубликат ' + k)
    keys.add(k)
    assert.ok(e.platforms.length > 0, e.name)
    assert.ok(e.signature && e.description && e.example, e.name)
  }
  for (const b of boards) {
    const labels = new Set()
    for (const p of b.pins) {
      assert.ok(!labels.has(p.label), `${b.id}: дубликат пина ${p.label}`)
      labels.add(p.label)
    }
  }
})

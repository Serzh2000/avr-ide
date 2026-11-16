import test from 'node:test'
import assert from 'node:assert/strict'
import { archMatches, coreOfFqbn, exampleLabel, freeName, parseArchitectures, pickMainIno, projectNameFromExample, targetFileName } from './core'

test('архитектуры библиотеки и совместимость с платой', () => {
  assert.deepEqual(parseArchitectures('avr, esp32'), ['avr', 'esp32'])
  assert.deepEqual(parseArchitectures(undefined), ['*'])
  assert.deepEqual(parseArchitectures(' '), ['*'])
  assert.ok(archMatches(['*'], 'esp32'))
  assert.ok(archMatches(['AVR', 'esp8266'], 'avr'))
  assert.ok(!archMatches(['avr'], 'esp32'))
  assert.ok(archMatches([], 'avr'))
})

test('ядро и архитектура из fqbn', () => {
  assert.deepEqual(coreOfFqbn('esp32:esp32:esp32doit-devkit-v1'), { core: 'esp32:esp32', arch: 'esp32' })
  assert.equal(coreOfFqbn('bad'), null)
  assert.equal(coreOfFqbn(''), null)
})

test('имя проекта из примера и занятые имена', () => {
  assert.equal(exampleLabel('Basics/Blink'), 'Basics / Blink')
  assert.equal(projectNameFromExample('Basics / Blink'), 'Blink')
  assert.equal(projectNameFromExample('WiFi Scan (мой)'), 'WiFi_Scan')
  assert.equal(projectNameFromExample('---'), 'Example')
  const taken = new Set(['Blink', 'Blink_2'])
  assert.equal(freeName('Blink', (n) => taken.has(n)), 'Blink_3')
  assert.equal(freeName('Other', (n) => taken.has(n)), 'Other')
})

test('главный .ino и переименование при копировании', () => {
  assert.equal(pickMainIno('Blink', ['helper.ino', 'blink.ino']), 'blink.ino')
  assert.equal(pickMainIno('X', ['b.ino', 'a.ino']), 'a.ino')
  assert.equal(pickMainIno('X', []), null)
  assert.equal(targetFileName('blink.ino', 'blink.ino', 'MyBlink'), 'MyBlink.ino')
  assert.equal(targetFileName('config.h', 'blink.ino', 'MyBlink'), 'config.h')
  assert.equal(targetFileName('a.ino', null, 'N'), 'a.ino')
})

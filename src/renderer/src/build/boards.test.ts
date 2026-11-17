import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BOARD_PRESETS, GROUP_ORDER, SOURCE_CORES, coreOf, groupOf, isEspPlatform, platformOf } from './boards'
import { isFqbn } from '../../../main/cli/fqbn'

test('platformOf: STM32, RP2040, ESP, AVR и неизвестные ядра', () => {
  assert.equal(platformOf('STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C8'), 'stm32')
  assert.equal(platformOf('rp2040:rp2040:rpipico'), 'rp2040')
  assert.equal(platformOf('arduino:mbed_rp2040:pico'), 'rp2040')
  assert.equal(platformOf('esp32:esp32:esp32'), 'esp32')
  assert.equal(platformOf('esp8266:esp8266:nodemcuv2'), 'esp8266')
  assert.equal(platformOf('arduino:avr:uno'), 'avr')
  assert.equal(platformOf('arduino:samd:mkr1000'), 'generic')
  assert.equal(platformOf(''), null)
  assert.equal(platformOf(null), null)
})

test('groupOf: группы в списках плат', () => {
  assert.deepEqual(GROUP_ORDER, ['STM32', 'RP2040', 'ESP32', 'ESP8266', 'AVR', 'Другие'])
  assert.equal(groupOf('STMicroelectronics:stm32:Nucleo_64:pnum=NUCLEO_F401RE'), 'STM32')
  assert.equal(groupOf('rp2040:rp2040:rpipico2'), 'RP2040')
  assert.equal(groupOf('arduino:avr:uno'), 'AVR')
  assert.equal(groupOf('adafruit:samd:feather'), 'Другие')
})

test('isEspPlatform: конструкторы только для ESP', () => {
  assert.ok(isEspPlatform('esp32') && isEspPlatform('esp8266'))
  assert.ok(!isEspPlatform('stm32') && !isEspPlatform('rp2040') && !isEspPlatform('generic') && !isEspPlatform(null))
})

test('BOARD_PRESETS: все FQBN допустимы, ядро совпадает с FQBN', () => {
  for (const p of BOARD_PRESETS) {
    assert.ok(isFqbn(p.fqbn), p.fqbn)
    assert.equal(coreOf(p.fqbn), p.core, p.name)
  }
  assert.ok(BOARD_PRESETS.some((p) => p.fqbn === 'STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C8'))
})

test('SOURCE_CORES: адреса совпадают с проверенным каталогом', () => {
  const cat = JSON.parse(readFileSync(new URL('../../../../data/boardsources/sources.json', import.meta.url), 'utf8')) as { sources: { url: string; https: boolean; cores: { id: string }[] }[] }
  for (const c of SOURCE_CORES) {
    const s = cat.sources.find((x) => x.cores.some((k) => k.id === c.id))
    assert.ok(s, c.id)
    assert.equal(s!.url, c.source.url)
    assert.ok(s!.https && c.source.https && c.source.url.startsWith('https://'))
  }
})

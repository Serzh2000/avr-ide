import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addBlock, checkPin, createBlock, createDefaultProject, generateCpp, generateSite, parseProject, pinChoices, serializeProject, TEMPLATES, validate } from '../core/index'
import { staticFirmwareFor } from '../core/standalone'
import { webPlatformFor } from '../core/targets'
import { genPage } from '../../shell/pageGen'

test('интеграция Pico включается только для Pico W / Pico 2 W с Arduino-Pico', () => {
  for (const board of ['rpipicow', 'rpipico2w']) {
    const fqbn = `rp2040:rp2040:${board}:flash=2097152_0`
    assert.equal(webPlatformFor(fqbn), 'pico-w')
    assert.equal(staticFirmwareFor(fqbn), 'pico-arduino')
  }
  for (const fqbn of ['rp2040:rp2040:rpipico', 'rp2040:rp2040:rpipico2', 'arduino:mbed_nano:nanorp2040connect', 'arduino:renesas_uno:unor4wifi']) {
    assert.equal(webPlatformFor(fqbn), null)
  }
  assert.equal(webPlatformFor('esp32:esp32:esp32'), 'esp32')
  assert.equal(webPlatformFor('esp8266:esp8266:nodemcuv2'), 'esp8266')
})

test('Pico W: выводы на гребёнках и отдельный диапазон PWM', () => {
  assert.deepEqual(pinChoices('pico-w', 'in-analog').map(({ pin }) => pin), [26, 27, 28])
  assert.deepEqual(checkPin('pico-w', 26, 'in-analog'), [])
  assert.deepEqual(checkPin('pico-w', 15, 'out-pwm'), [])
  assert.equal(checkPin('pico-w', 15, 'in-analog')[0]?.code, 'pin-adc')
  for (const pin of [23, 24, 25, 29]) assert.equal(checkPin('pico-w', pin, 'out-digital')[0]?.severity, 'error')
})

test('платформа Pico W сохраняется; генератор и автогенерация сохраняют обмен со скетчем', () => {
  const p = createDefaultProject('pico-w')
  p.device.port = 8080
  p.variables.push({ name: 'enabled', type: 'bool', init: 'false', external: true })
  const relay = createBlock('switch', 'toggle')
  relay.binding = { kind: 'var', variable: 'enabled', direction: 'both' }
  const dimmer = createBlock('slider', 'dimmer')
  dimmer.binding = { kind: 'pin', pin: 15, mode: 'analog', direction: 'toPin' }
  dimmer.props.max = 255
  addBlock(p, relay, p.blocks[0].id)
  addBlock(p, dimmer, p.blocks[0].id)
  const json = serializeProject(p)
  const restored = parseProject(json)
  assert.ok(restored.ok)
  assert.equal(restored.project.platform, 'pico-w')
  const out = genPage('web', { json, board: 'pico-w', sketchCode: 'bool enabled = false;\nvoid setup() {}\nvoid loop() {}\n' })
  assert.ok(out.ok)
  assert.deepEqual(out.errors, [])
  assert.match(out.header, /#include <RPAsyncTCP.h>/)
  assert.match(out.header, /ARDUINO_RASPBERRY_PI_PICO_W.*ARDUINO_RASPBERRY_PI_PICO_2W/)
  assert.match(out.header, /AsyncWebSocket wd_ws/)
  assert.match(out.header, /enabled = wd_truthy\(val\)/)
  assert.doesNotMatch(out.header, /^bool enabled =/m)
  assert.match(out.header, /constrain\(\(int\)v.toFloat\(\), 0, 255\)/)
  assert.match(out.header, /analogWrite\(15, duty\)/)
  assert.match(out.header, /#define WD_PORT 8080/)
  assert.doesNotMatch(out.header, /#include <(?:ESP8266WiFi|AsyncTCP|ESPAsyncTCP)\.h>/)
  assert.doesNotMatch(generateSite(p, true).js, /new WebSocket/)
})

test('шаблоны для Pico W не используют внутренние выводы или АЦП от другой платы', () => {
  for (const t of TEMPLATES) {
    const p = t.build('pico-w')
    assert.deepEqual(validate(p).filter((i) => i.severity === 'error'), [], t.id)
    assert.match(generateCpp(p).header, /#include <RPAsyncTCP.h>/, t.id)
  }
})

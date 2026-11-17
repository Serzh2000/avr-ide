import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSketchYaml, isFqbn, parseSketchYaml, updateSketchYaml } from './sketchyaml'

test('parse: fqbn и порт, кавычки и комментарии', () => {
  assert.deepEqual(parseSketchYaml('default_fqbn: esp32:esp32:esp32\ndefault_port: COM3\n'), { fqbn: 'esp32:esp32:esp32', port: 'COM3' })
  assert.deepEqual(parseSketchYaml("default_fqbn: 'arduino:avr:uno' # плата\r\ndefault_port: \"/dev/ttyUSB0\"\r\n"), { fqbn: 'arduino:avr:uno', port: '/dev/ttyUSB0' })
  assert.deepEqual(parseSketchYaml(''), { fqbn: null, port: null })
  assert.deepEqual(parseSketchYaml('default_fqbn:\n'), { fqbn: null, port: null })
})

test('parse: вложенные ключи и мусор игнорируются', () => {
  const t = 'profiles:\n  uno:\n    default_fqbn: arduino:avr:nano\ndefault_fqbn: esp8266:esp8266:nodemcuv2\n'
  assert.equal(parseSketchYaml(t).fqbn, 'esp8266:esp8266:nodemcuv2')
  assert.equal(parseSketchYaml('default_fqbn: не плата\n').fqbn, null)
  assert.equal(parseSketchYaml('default_fqbn: a:b\n').fqbn, null)
})

test('isFqbn: опции платы', () => {
  assert.ok(isFqbn('esp32:esp32:esp32'))
  assert.ok(isFqbn('esp32:esp32:esp32:CPUFreq=240,FlashMode=qio'))
  assert.ok(!isFqbn('esp32:esp32'))
  assert.ok(!isFqbn('a:b:c; rm -rf'))
  assert.ok(!isFqbn(42))
})

test('update: заменяет только свои строки, остальное не трогает', () => {
  const src = '# мой скетч\nprofiles:\n  x:\n    default_fqbn: arduino:avr:nano\ndefault_fqbn: arduino:avr:uno\nadditional: 1\n'
  const out = updateSketchYaml(src, { fqbn: 'esp32:esp32:esp32' })
  assert.equal(out, '# мой скетч\nprofiles:\n  x:\n    default_fqbn: arduino:avr:nano\ndefault_fqbn: esp32:esp32:esp32\nadditional: 1\n')
})

test('update: добавляет недостающее, сохраняет CRLF, удаляет по null', () => {
  assert.equal(updateSketchYaml('', { fqbn: 'arduino:avr:uno' }), 'default_fqbn: arduino:avr:uno\n')
  assert.equal(updateSketchYaml('foo: 1\r\n', { fqbn: 'arduino:avr:uno', port: 'COM5' }), 'foo: 1\r\ndefault_fqbn: arduino:avr:uno\r\ndefault_port: COM5\r\n')
  assert.equal(updateSketchYaml('default_fqbn: a:b:c\ndefault_port: COM1\n', { port: null }), 'default_fqbn: a:b:c\n')
  assert.equal(updateSketchYaml('x: 1', { fqbn: undefined }), 'x: 1\n')
})

test('update: недопустимые значения отклоняются', () => {
  assert.throws(() => updateSketchYaml('', { fqbn: 'bad' }))
  assert.throws(() => updateSketchYaml('', { port: 'COM3\nfoo: bar' }))
})

test('build: новый файл читается обратно', () => {
  const t = buildSketchYaml('esp32:esp32:esp32s3', 'COM4')
  assert.equal(t, 'default_fqbn: esp32:esp32:esp32s3\ndefault_port: COM4\n')
  assert.deepEqual(parseSketchYaml(t), { fqbn: 'esp32:esp32:esp32s3', port: 'COM4' })
})

test('sketch.yaml: FQBN с параметрами платы читается, пишется и обновляется', () => {
  const fq = 'STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C8,upload_method=swdMethod,usb=CDCgen'
  const t = buildSketchYaml(fq, 'COM4')
  assert.equal(t, `default_fqbn: ${fq}\ndefault_port: COM4\n`)
  assert.deepEqual(parseSketchYaml(t), { fqbn: fq, port: 'COM4' })
  // параметры в кавычках и с комментарием (так может записать другая IDE)
  assert.equal(parseSketchYaml(`default_fqbn: "${fq}" # Blue Pill\n`).fqbn, fq)
  const pico = 'rp2040:rp2040:rpipico:flash=2097152_0,freq=133,usbstack=picosdk'
  assert.equal(parseSketchYaml(`default_fqbn: ${pico}\n`).fqbn, pico)
  // смена способа загрузки не трогает остальные строки
  const next = updateSketchYaml('# плата\ndefault_fqbn: ' + fq + '\ndefault_port: COM4\nextra: 1\n', { fqbn: fq.replace('swdMethod', 'dfuMethod') })
  assert.equal(next, '# плата\ndefault_fqbn: ' + fq.replace('swdMethod', 'dfuMethod') + '\ndefault_port: COM4\nextra: 1\n')
})

test('sketch.yaml: недопустимые параметры не попадают в файл', () => {
  assert.throws(() => updateSketchYaml('', { fqbn: 'a:b:c:k=v\nevil: 1' }))
  assert.throws(() => updateSketchYaml('', { fqbn: 'a:b:c:k=v,k=w' }))
  assert.throws(() => updateSketchYaml('', { fqbn: 'a:b:c:k=' }))
  assert.equal(parseSketchYaml('default_fqbn: a:b:c:k=v;calc\n').fqbn, null)
})

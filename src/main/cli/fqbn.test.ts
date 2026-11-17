import test from 'node:test'
import assert from 'node:assert/strict'
import { baseFqbn, buildFqbn, fqbnOptions, isFqbn, parseFqbn, platformOfFqbn, portPolicy, withOption } from './fqbn'
import { isFqbn as validateIsFqbn } from './validate'
import { parseBoardDetails } from './details'

const BLUEPILL = 'STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C8,upload_method=swdMethod,usb=CDCgen'
const PICO = 'rp2040:rp2040:rpipico:flash=2097152_0,freq=133,usbstack=picosdk'

test('parseFqbn: плата с параметрами STM32 и RP2040', () => {
  const p = parseFqbn(BLUEPILL)!
  assert.equal(p.vendor, 'STMicroelectronics')
  assert.equal(p.arch, 'stm32')
  assert.equal(p.board, 'GenF1')
  assert.deepEqual(p.options, [['pnum', 'BLUEPILL_F103C8'], ['upload_method', 'swdMethod'], ['usb', 'CDCgen']])
  assert.deepEqual(parseFqbn(PICO)!.options, [['flash', '2097152_0'], ['freq', '133'], ['usbstack', 'picosdk']])
  assert.deepEqual(parseFqbn('arduino:avr:uno')!.options, [])
})

test('isFqbn: допустимые строки', () => {
  for (const f of ['arduino:avr:uno', 'esp32:esp32:esp32:CPUFreq=240,FlashMode=qio', BLUEPILL, PICO, 'esp8266:esp8266:nodemcuv2:eesz=4M2M,xtal=80', 'arduino:mbed_rp2040:pico'])
    assert.ok(isFqbn(f), f)
})

test('isFqbn: инъекции и мусор отклоняются', () => {
  const bad = [
    '', 'a:b', 'a:b:c:d:e', ':b:c', 'a::c', 'a:b:', '-x:b:c', '--help:b:c',
    'a:b:c;rm -rf /', 'a:b:c && calc', 'a:b:c|x', 'a:b:c\nfoo', 'a:b:c d', 'a:b:c"', "a:b:c'", 'a:b:`id`', 'a:b:$(id)', 'a:b:c%00',
    'a:b:c:', 'a:b:c:=v', 'a:b:c:k=', 'a:b:c:k', 'a:b:c:k=v,', 'a:b:c:,k=v', 'a:b:c:k=v,,j=w', 'a:b:c:k==v', 'a:b:c:k=v=w',
    'a:b:c:k=v,k=w', 'a:b:c:k=v;j=w', 'a:b:c:k=v w', 'a:b:c:k=--flag x', 'a:b:c:k=../../x', 'a:b:c:k=C:\\x',
    'a:b:c:' + 'k=v,'.repeat(200) + 'z=1', 'a:b:c:' + 'x'.repeat(500) + '=1'
  ]
  for (const f of bad) assert.ok(!isFqbn(f), JSON.stringify(f))
  for (const f of [undefined, null, 42, {}, ['a:b:c'], true]) assert.ok(!isFqbn(f as unknown))
})

test('validate.isFqbn — тот же строгий разбор', () => {
  assert.ok(validateIsFqbn(BLUEPILL))
  assert.ok(!validateIsFqbn('a:b:c:k=v;calc'))
  assert.ok(!validateIsFqbn('-a:b:c'))
})

test('baseFqbn / fqbnOptions', () => {
  assert.equal(baseFqbn(BLUEPILL), 'STMicroelectronics:stm32:GenF1')
  assert.equal(baseFqbn('arduino:avr:uno'), 'arduino:avr:uno')
  assert.deepEqual(fqbnOptions(PICO), { flash: '2097152_0', freq: '133', usbstack: 'picosdk' })
  assert.deepEqual(fqbnOptions('arduino:avr:uno'), {})
  assert.deepEqual(fqbnOptions('мусор'), {})
})

test('buildFqbn и withOption сохраняют порядок и отбрасывают недопустимое', () => {
  assert.equal(buildFqbn('STMicroelectronics:stm32:GenF1:pnum=X', { pnum: 'BLUEPILL_F103C8', usb: 'CDCgen' }), 'STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C8,usb=CDCgen')
  assert.equal(buildFqbn('arduino:avr:uno', {}), 'arduino:avr:uno')
  assert.equal(buildFqbn('arduino:avr:uno', { 'a b': 'c', k: 'v;x', ok: '1' }), 'arduino:avr:uno:ok=1')
  assert.equal(withOption('esp32:esp32:esp32', 'CPUFreq', '240'), 'esp32:esp32:esp32:CPUFreq=240')
  assert.equal(withOption('esp32:esp32:esp32:CPUFreq=240,FlashMode=qio', 'CPUFreq', '80'), 'esp32:esp32:esp32:CPUFreq=80,FlashMode=qio')
  assert.equal(withOption('esp32:esp32:esp32:CPUFreq=240', 'CPUFreq', null), 'esp32:esp32:esp32')
  assert.equal(withOption(BLUEPILL, 'upload_method', 'dfuMethod'), 'STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C8,upload_method=dfuMethod,usb=CDCgen')
  assert.ok(isFqbn(withOption(BLUEPILL, 'upload_method', 'dfuMethod')))
  // круг: разбор -> сборка даёт ту же строку
  const p = parseFqbn(PICO)!
  assert.equal(buildFqbn(PICO, Object.fromEntries(p.options)), PICO)
})

test('platformOfFqbn: известные ядра и generic', () => {
  assert.equal(platformOfFqbn('arduino:avr:uno'), 'avr')
  assert.equal(platformOfFqbn('esp8266:esp8266:nodemcuv2'), 'esp8266')
  assert.equal(platformOfFqbn('esp32:esp32:esp32s3'), 'esp32')
  assert.equal(platformOfFqbn('m5stack:esp32:m5stack_core'), 'esp32')
  assert.equal(platformOfFqbn(BLUEPILL), 'stm32')
  assert.equal(platformOfFqbn('SparkFun:stm32:thingplus'), 'stm32')
  assert.equal(platformOfFqbn(PICO), 'rp2040')
  assert.equal(platformOfFqbn('rp2040:rp2040:rpipico2w'), 'rp2040')
  assert.equal(platformOfFqbn('arduino:mbed_rp2040:pico'), 'rp2040')
  assert.equal(platformOfFqbn('arduino:samd:mkr1000'), 'generic')
  assert.equal(platformOfFqbn('что-то'), 'generic')
  assert.equal(platformOfFqbn(''), null)
  assert.equal(platformOfFqbn(null), null)
  assert.equal(platformOfFqbn(undefined), null)
})

test('portPolicy: порт нужен не всегда', () => {
  assert.equal(portPolicy('arduino:avr:uno'), 'required')
  assert.equal(portPolicy('esp32:esp32:esp32'), 'required')
  assert.equal(portPolicy('some:weird:board'), 'required')
  assert.equal(portPolicy('rp2040:rp2040:rpipico'), 'optional')
  assert.equal(portPolicy('STMicroelectronics:stm32:GenF1:upload_method=swdMethod'), 'none')
  assert.equal(portPolicy('STMicroelectronics:stm32:GenF1:upload_method=dfuMethod'), 'none')
  assert.equal(portPolicy('STMicroelectronics:stm32:GenF1:upload_method=MassStoragemethod'), 'none')
  assert.equal(portPolicy('STMicroelectronics:stm32:GenF1:upload_method=serialMethod'), 'required')
  assert.equal(portPolicy('STMicroelectronics:stm32:GenF1:upload_method=stm32flashMethod'), 'required')
  // способ по умолчанию берётся из описания платы, явный параметр его перекрывает
  assert.equal(portPolicy('STMicroelectronics:stm32:GenF1', { upload_method: 'swdMethod' }), 'none')
  assert.equal(portPolicy('STMicroelectronics:stm32:GenF1:upload_method=serialMethod', { upload_method: 'swdMethod' }), 'required')
  assert.equal(portPolicy('STMicroelectronics:stm32:GenF1'), 'optional')
})

test('parseBoardDetails: config_options из arduino-cli', () => {
  const d = parseBoardDetails({
    name: 'Generic STM32F1 series',
    config_options: [
      { option: 'pnum', option_label: 'Board part number', values: [{ value: 'BLUEPILL_F103C8', value_label: 'BluePill F103C8', selected: true }, { value: 'x y', value_label: 'bad' }] },
      { option: 'upload_method', option_label: 'Upload method', values: [{ value: 'swdMethod', value_label: 'STM32CubeProgrammer (SWD)' }, { value: 'dfuMethod', value_label: 'STM32CubeProgrammer (DFU)', selected: true }] },
      { option: 'bad;opt', option_label: 'x', values: [{ value: 'a', value_label: 'a' }] },
      { option: 'empty', option_label: 'x', values: [] }
    ]
  }, BLUEPILL)
  assert.equal(d.fqbn, 'STMicroelectronics:stm32:GenF1')
  assert.equal(d.name, 'Generic STM32F1 series')
  assert.deepEqual(d.options.map((o) => o.id), ['pnum', 'upload_method'])
  assert.deepEqual(d.options[0].values.map((v) => v.value), ['BLUEPILL_F103C8'])
  assert.equal(d.options[1].values[1].selected, true)
  assert.deepEqual(parseBoardDetails({}, 'arduino:avr:uno').options, [])
})

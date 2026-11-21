import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePnp } from './probes'

const V21 = [
  { PNPDeviceID: 'USB\\VID_0483&PID_374B\\066DFF485054877267163321', Name: 'Составное USB устройство', ConfigManagerErrorCode: 0, Service: 'usbccgp' },
  { PNPDeviceID: 'USB\\VID_0483&PID_374B&MI_00\\7&1A2B3C&0&0000', Name: 'STM32 STLink', ConfigManagerErrorCode: 0, Service: 'WinUSB' },
  { PNPDeviceID: 'USB\\VID_0483&PID_374B&MI_02\\7&1A2B3C&0&0002', Name: 'STMicroelectronics STLink Virtual COM Port', ConfigManagerErrorCode: 0, Service: 'usbser' }
]

test('ST-Link V2-1: серийный номер, виртуальный COM, драйвер на месте', () => {
  const p = parsePnp(JSON.stringify(V21))
  assert.equal(p.length, 1)
  assert.deepEqual([p[0].name, p[0].serial, p[0].driver, p[0].vcp], ['ST-Link V2-1', '066DFF485054877267163321', 'ok', true])
})

test('ST-Link V2 («свисток»): один объект JSON, без COM-порта', () => {
  const p = parsePnp(JSON.stringify({ PNPDeviceID: 'USB\\VID_0483&PID_3748\\57FF72064965525123461387', ConfigManagerErrorCode: 0, Service: 'WinUSB' }))
  assert.deepEqual([p[0].name, p[0].vcp, p[0].driver], ['ST-Link V2', false, 'ok'])
})

test('нет драйвера: код 28 Диспетчера устройств', () => {
  const p = parsePnp(JSON.stringify({ PNPDeviceID: 'USB\\VID_0483&PID_3748\\ABC123', ConfigManagerErrorCode: 28, Service: null }))
  assert.equal(p[0].driver, 'missing')
})

test('неизвестный драйвер не ломает разбор; чужие устройства и пустой ответ игнорируются', () => {
  assert.equal(parsePnp(JSON.stringify({ PNPDeviceID: 'USB\\VID_0483&PID_374E\\XYZ', ConfigManagerErrorCode: 0, Service: '' }))[0].driver, 'unknown')
  assert.deepEqual(parsePnp(JSON.stringify([{ PNPDeviceID: 'USB\\VID_0483&PID_5740\\1', Service: 'usbser' }])), [])
  assert.deepEqual(parsePnp(''), [])
  assert.deepEqual(parsePnp('не json'), [])
})

test('два ST-Link различаются серийными номерами', () => {
  const mk = (s: string): object => ({ PNPDeviceID: `USB\\VID_0483&PID_3748\\${s}`, ConfigManagerErrorCode: 0, Service: 'WinUSB' })
  assert.deepEqual(parsePnp(JSON.stringify([mk('AAA'), mk('BBB')])).map((x) => x.id), ['AAA', 'BBB'])
})

// ---- J-Link и CMSIS-DAP ----

test('J-Link: серийный номер из экземпляра, VID 1366; драйвер WinUSB — ok, прочий — не тот драйвер', () => {
  const mk = (service: string, code = 0): object => ({ PNPDeviceID: 'USB\\VID_1366&PID_0101\\000601003266', Name: 'J-Link driver', ConfigManagerErrorCode: code, Service: service })
  const ok = parsePnp(JSON.stringify(mk('WinUSB')))
  assert.deepEqual([ok[0].kind, ok[0].name, ok[0].serial, ok[0].driver, ok[0].usbId], ['jlink', 'J-Link', '000601003266', 'ok', '1366:0101'])
  assert.equal(parsePnp(JSON.stringify(mk('JLinkUSB')))[0].driver, 'missing')
  assert.equal(parsePnp(JSON.stringify(mk('', 28)))[0].driver, 'missing')
  assert.equal(parsePnp(JSON.stringify(mk('')))[0].driver, 'unknown')
})

test('J-Link: PID из списка OpenOCD (1051, 0105) распознаются, чужой PID SEGGER без имени J-Link — нет', () => {
  const rec = (pid: string, name = 'USB device'): object => ({ PNPDeviceID: `USB\\VID_1366&PID_${pid}\\123456`, Name: name, ConfigManagerErrorCode: 0, Service: 'WinUSB' })
  assert.equal(parsePnp(JSON.stringify([rec('1051'), rec('0105')])).length, 2)
  assert.equal(parsePnp(JSON.stringify(rec('7777'))).length, 0)
  assert.equal(parsePnp(JSON.stringify(rec('7777', 'SEGGER J-Link OB'))).length, 1)
})

test('CMSIS-DAP: DAPLink 0D28:0204 и Raspberry Pi Debug Probe 2E8A:000C; HID-драйвер не требует установки', () => {
  const p = parsePnp(JSON.stringify([
    { PNPDeviceID: 'USB\\VID_0D28&PID_0204\\0240000032044e4500257009997b00386781000097969900', Name: 'USB Composite Device', ConfigManagerErrorCode: 0, Service: 'usbccgp' },
    { PNPDeviceID: 'USB\\VID_0D28&PID_0204&MI_03\\7&2B5D&0&0003', Name: 'CMSIS-DAP v1', ConfigManagerErrorCode: 0, Service: 'HidUsb' },
    { PNPDeviceID: 'USB\\VID_2E8A&PID_000C\\E6614103E7123456', Name: 'Debug Probe (CMSIS-DAP)', ConfigManagerErrorCode: 0, Service: 'WinUSB' }
  ]))
  assert.deepEqual(p.map((x) => [x.kind, x.name, x.driver]), [['cmsis-dap', 'DAPLink (CMSIS-DAP)', 'ok'], ['cmsis-dap', 'Raspberry Pi Debug Probe (CMSIS-DAP)', 'ok']])
  assert.equal(p[0].serial, '0240000032044E4500257009997B00386781000097969900')
})

test('CMSIS-DAP неизвестного производителя находится по «CMSIS-DAP» в названии (как в OpenOCD); без такого названия — игнорируется', () => {
  const dev = { PNPDeviceID: 'USB\\VID_1234&PID_5678\\ABCDEF', Name: 'Мой программатор', ConfigManagerErrorCode: 0, Service: 'usbccgp' }
  assert.equal(parsePnp(JSON.stringify([dev])).length, 0)
  const withName = [dev, { PNPDeviceID: 'USB\\VID_1234&PID_5678&MI_01\\7&1&0&0001', Name: 'CMSIS-DAP v2 Interface', ConfigManagerErrorCode: 0, Service: 'WinUSB' }]
  const p = parsePnp(JSON.stringify(withName))
  assert.deepEqual([p.length, p[0].kind, p[0].name, p[0].driver, p[0].serial], [1, 'cmsis-dap', 'CMSIS-DAP', 'ok', 'ABCDEF'])
})

test('разные программаторы вместе: типы и порядок сохраняются', () => {
  const p = parsePnp(JSON.stringify([
    { PNPDeviceID: 'USB\\VID_0483&PID_374B\\AAA', Service: 'WinUSB', ConfigManagerErrorCode: 0 },
    { PNPDeviceID: 'USB\\VID_1366&PID_0101\\BBB', Service: 'WinUSB', ConfigManagerErrorCode: 0 }
  ]))
  assert.deepEqual(p.map((x) => x.kind), ['stlink', 'jlink'])
})

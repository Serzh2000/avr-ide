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

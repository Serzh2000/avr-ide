import test from 'node:test'
import assert from 'node:assert/strict'
import { explainOpenOcdLog, phaseOf, summarizeFlash, targetVoltage } from './logParse'

const OK = `Open On-Chip Debugger 0.12.0
Info : STLINK V2J37S7 (API v2) VID:PID 0483:3748
Info : Target voltage: 3.250000
Info : [stm32f1x.cpu] Cortex-M3 r1p1 processor detected
Info : device id = 0x20036410
Info : flash size = 64 KiB
** Programming Started **
** Programming Finished **
** Verify Started **
** Verified OK **
** Resetting Target **
wrote 2048 bytes from file build/Debug/app.elf in 0.512345s (3.904 KiB/s)`

test('фазы прошивки по строкам журнала', () => {
  assert.equal(phaseOf('** Programming Started **')?.phase, 'program')
  assert.equal(phaseOf('** Verified OK **')?.phase, 'verify')
  assert.equal(phaseOf('** Resetting Target **')?.phase, 'reset')
  assert.equal(phaseOf('Info : Target voltage: 3.2')?.phase, 'connect')
  assert.equal(phaseOf('что-то другое'), null)
})

test('итоги успешной прошивки', () => {
  const s = summarizeFlash(OK)
  assert.equal(s.verified, true)
  assert.equal(s.wroteBytes, 2048)
  assert.equal(s.deviceId, '0x20036410')
  assert.equal(s.flashKiB, 64)
  assert.equal(s.probe, 'STLINK V2J37S7')
  assert.match(s.target ?? '', /Cortex-M3/)
  assert.equal(targetVoltage(OK), 3.25)
})

const cases: [string, string, string][] = [
  ['ST-Link не найден', 'Error: open failed\nError: No ST-LINK detected', 'no-probe'],
  ['нет драйвера', 'Error: libusb_open() failed with LIBUSB_ERROR_NOT_SUPPORTED\nError: open failed', 'no-driver'],
  ['нет питания', 'Info : STLINK V2J29S7 (API v2) VID:PID 0483:3748\nInfo : Target voltage: 0.052000\nError: init mode failed (unable to connect to the target)', 'no-power'],
  ['неверный IDCODE', 'Warn : UNEXPECTED idcode: 0x2ba01477\nError: expected 1 of 1: 0x1ba01477', 'wrong-target'],
  ['защита RDP', 'Error: device is protected\nError: stm32x device protected', 'read-protected'],
  ['verify', 'Error: checksum mismatch - attempting binary compare\n** Verify Failed **', 'verify-failed'],
  ['порт занят', "Error: couldn't bind gdb to socket on port 3333: Address already in use", 'port-busy'],
  ['нет скриптов', "embedded:startup.tcl:60: Error: Can't find interface/stlink.cfg", 'no-scripts'],
  ['нет связи при нормальном питании', 'Info : Target voltage: 3.280000\nError: init mode failed (unable to connect to the target)', 'connect-failed'],
  ['неизвестное', 'Error: something unexpected', 'unknown']
]
for (const [name, log, kind] of cases) {
  test('ошибка: ' + name, () => {
    const e = explainOpenOcdLog(log)
    assert.equal(e.kind, kind)
    assert.ok(e.title.length > 5 && e.hint.length > 10)
  })
}

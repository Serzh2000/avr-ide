// Приём SWO на имитаторе OpenOCD (scripts/e2e/fakes/fake-openocd.mjs): настоящего OpenOCD и устройства нет.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { swoArgs } from './args'
import { explainOpenOcdLog } from './logParse'
import { freePort } from './programmer'
import { startSwo } from './swo'

const FAKE = resolve(process.cwd(), 'scripts', 'e2e', 'fakes', 'fake-openocd.mjs')

async function run(mode: string, kind: 'stlink' | 'jlink' | 'cmsis-dap'): Promise<{ text: string; ports: Record<number, number>; stop: () => Promise<void> } | { error: string }> {
  const dir = mkdtempSync(join(tmpdir(), 'avride-swo-'))
  const modeFile = join(dir, 'mode.txt')
  writeFileSync(modeFile, mode)
  process.env['AVRIDE_FAKE_MODE_FILE'] = modeFile
  const port = await freePort()
  const args = swoArgs({ programmer: kind, target: 'target/stm32f1x.cfg' }, { port, traceClockHz: 72_000_000, swoHz: 2_000_000 })
  let text = ''
  let ports: Record<number, number> = {}
  try {
    const h = await startSwo({ exe: FAKE, args, port, explain: (l) => explainOpenOcdLog(l, kind), onData: (c) => { text += c.text; ports = c.stats.ports } })
    await new Promise((r) => setTimeout(r, 600))
    return { get text() { return text }, get ports() { return ports }, stop: h.stop }
  } catch (e) { return { error: (e as Error).message } }
}

test('swoArgs: tpiu configure/enable, init, itm port 0 on; без gdb/telnet/tcl и без reset/program', () => {
  const a = swoArgs({ target: 'target/stm32f1x.cfg' }, { port: 4000, traceClockHz: 72_000_000, swoHz: 2_000_000 })
  const s = a.join(' ')
  assert.match(s, /-protocol uart -output :4000 -traceclk 72000000 -pin-freq 2000000; \$t enable/)
  assert.ok(a.indexOf('init') > a.findIndex((x) => /tpiu names/.test(x) && /configure/.test(x)), 'init после настройки tpiu')
  assert.equal(a.at(-1), 'itm port 0 on')
  assert.ok(a.includes('gdb_port disabled') && a.includes('telnet_port disabled') && a.includes('tcl_port disabled'))
  assert.ok(!/program|erase|reset halt|flash /.test(s))
  assert.throws(() => swoArgs({ target: 't' }, { port: 0, traceClockHz: 72e6, swoHz: 2e6 }), /порт/)
  assert.throws(() => swoArgs({ target: 't' }, { port: 4000, traceClockHz: 5, swoHz: 2e6 }), /Частота/)
  assert.throws(() => swoArgs({ target: 't' }, { port: 4000, traceClockHz: 72e6, swoHz: 10 }), /Скорость/)
})

test('SWO на имитаторе: текст порта 0, статистика по портам, остановка', async () => {
  const r = await run('ok', 'jlink')
  assert.ok(!('error' in r), 'error' in r ? r.error : '')
  if ('error' in r) return
  try {
    assert.match(r.text, /^Привет из SWO\r\n/)
    assert.equal(r.ports[1], Buffer.byteLength('канал 1'))
  } finally { await r.stop() }
})

test('SWO: у цели нет TPIU — объяснимая ошибка запуска', async () => {
  const r = await run('notpiu', 'stlink')
  assert.ok('error' in r)
  if ('error' in r) assert.match(r.error, /TPIU/)
})

test('ошибки по типам программатора: J-Link и CMSIS-DAP (строки OpenOCD 0.12.0)', () => {
  assert.equal(explainOpenOcdLog('Error: No J-Link device found', 'jlink').kind, 'no-probe')
  assert.match(explainOpenOcdLog('Error: No J-Link device found', 'jlink').title, /J-Link/)
  assert.equal(explainOpenOcdLog('Error: Failed to open device: access error', 'jlink').kind, 'no-driver')
  assert.match(explainOpenOcdLog('Error: Multiple devices found, specify the desired device', 'jlink').title, /несколько/)
  assert.equal(explainOpenOcdLog('Error: Device supports JTAG transport only', 'jlink').kind, 'connect-failed')
  assert.equal(explainOpenOcdLog('Error: unable to find a matching CMSIS-DAP device', 'cmsis-dap').kind, 'no-probe')
  assert.match(explainOpenOcdLog('Error: unable to find a matching CMSIS-DAP device', 'cmsis-dap').title, /CMSIS-DAP/)
  assert.equal(explainOpenOcdLog('Error: CMSIS-DAP: SWD not supported', 'cmsis-dap').kind, 'connect-failed')
  assert.equal(explainOpenOcdLog('Error: libusb_open() failed with LIBUSB_ERROR_NOT_SUPPORTED', 'jlink').kind, 'no-driver')
  // для ST-Link прежнее поведение
  assert.equal(explainOpenOcdLog('Error: No ST-LINK detected', 'stlink').kind, 'no-probe')
  assert.equal(explainOpenOcdLog('Error: No ST-LINK detected').title, 'ST-Link не найден')
})

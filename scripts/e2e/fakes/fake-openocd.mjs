// Имитатор OpenOCD для автотестов. НИЧЕГО не открывает и не пишет в устройство: печатает правдоподобный журнал и завершается.
// Режим берётся из файла AVRIDE_FAKE_MODE_FILE (ok | nopower | nodriver | noprobe | verifyfail | rdp | wrongid), каждый запуск читает его заново.
// Журнал запусков (аргументы) дописывается в AVRIDE_FAKE_LOG — по нему тесты проверяют командную строку.
import { appendFileSync, readFileSync } from 'node:fs'

const args = process.argv.slice(2)
if (process.env.AVRIDE_FAKE_LOG) appendFileSync(process.env.AVRIDE_FAKE_LOG, JSON.stringify({ tool: 'openocd', args }) + '\n')
const mode = (() => { try { return readFileSync(process.env.AVRIDE_FAKE_MODE_FILE, 'utf8').trim() } catch { return 'ok' } })()
const err = (l) => process.stderr.write(l + '\n')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const cmds = []
for (let i = 0; i < args.length; i++) if (args[i] === '-c') cmds.push(args[++i])

const header = async () => {
  err('Open On-Chip Debugger 0.12.0 (имитатор)')
  err('Info : STLINK V2J37S7 (API v2) VID:PID 0483:3748')
  err(`Info : Target voltage: ${mode === 'nopower' ? '0.052000' : '3.250000'}`)
}
const fail = (lines) => { for (const l of lines) err(l); process.exit(1) }

if (mode === 'noprobe') fail(['Error: open failed', 'Error: No ST-LINK detected'])
if (mode === 'nodriver') fail(['Error: libusb_open() failed with LIBUSB_ERROR_NOT_SUPPORTED', 'Error: open failed'])
await header()
if (mode === 'nopower') fail(['Error: init mode failed (unable to connect to the target)'])
if (mode === 'wrongid') fail(['Warn : UNEXPECTED idcode: 0x2ba01477', 'Error: expected 1 of 1: 0x1ba01477'])
if (mode === 'rdp') fail(['Info : [stm32f1x.cpu] Cortex-M3 r1p1 processor detected', 'Error: device is protected'])
err('Info : [stm32f1x.cpu] Cortex-M3 r1p1 processor detected')
err('Info : device id = 0x20036410')
err('Info : flash size = 64 KiB')

const gdb = cmds.find((c) => /^gdb_port \d+/.test(c))
if (gdb) {
  const port = gdb.split(' ')[1]
  await sleep(150)
  err(`Info : Listening on port ${port} for gdb connections`)
  setInterval(() => undefined, 1 << 30)
} else {
  const prog = cmds.find((c) => /^program /.test(c))
  if (prog) {
    await sleep(150)
    err('** Programming Started **')
    await sleep(300)
    err('** Programming Finished **')
    await sleep(100)
    if (mode === 'verifyfail') fail(['** Verify Started **', 'Error: checksum mismatch - attempting binary compare', '** Verify Failed **'])
    if (/ verify/.test(prog)) { err('** Verify Started **'); await sleep(150); err('** Verified OK **') }
    if (/ reset/.test(prog)) err('** Resetting Target **')
    err('wrote 2048 bytes from file build/Debug/app.elf in 0.512345s (3.904 KiB/s)')
  } else if (cmds.some((c) => /erase_sector/.test(c))) {
    await sleep(200)
    err('Info : erased sectors 0 through 63 on flash bank 0 (имитация)')
  } else if (cmds.includes('targets')) {
    err('    TargetName         Type       Endian TapName            State')
    err(' 0* stm32f1x.cpu      hla_target little stm32f1x.cpu       running')
  }
  process.exit(0)
}

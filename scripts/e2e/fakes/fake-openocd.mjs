// Имитатор OpenOCD для автотестов. НИЧЕГО не открывает и не пишет в устройство: печатает правдоподобный журнал и завершается.
// Режим берётся из файла AVRIDE_FAKE_MODE_FILE (ok | nopower | nodriver | noprobe | verifyfail | rdp | wrongid | notpiu), каждый запуск читает его заново.
// Тип программатора определяется по `-f interface/<stlink|jlink|cmsis-dap>.cfg`: от него зависят строки журнала и тексты ошибок
// (тексты ошибок jlink и cmsis-dap — из исходников OpenOCD v0.12.0; остальные строки журнала — имитация).
// Журнал запусков (аргументы) дописывается в AVRIDE_FAKE_LOG — по нему тесты проверяют командную строку.
// SWO: если в аргументах есть `-output :<порт>` (команда tpiu configure), имитатор открывает TCP-сервер на этом порту и отдаёт поток ITM
// (синхронизация, текст порта 0 однобайтными пакетами SWIT, порт 1, метки времени, переполнение). Свой текст для проверки: дописать его в файл
// `<AVRIDE_FAKE_MODE_FILE>.swo` — имитатор отправит и очистит файл.
import { appendFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:net'

const args = process.argv.slice(2)
if (process.env.AVRIDE_FAKE_LOG) appendFileSync(process.env.AVRIDE_FAKE_LOG, JSON.stringify({ tool: 'openocd', args }) + '\n')
const mode = (() => { try { return readFileSync(process.env.AVRIDE_FAKE_MODE_FILE, 'utf8').trim() } catch { return 'ok' } })()
const err = (l) => process.stderr.write(l + '\n')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const cmds = []
for (let i = 0; i < args.length; i++) if (args[i] === '-c') cmds.push(args[++i])
const iface = (/interface\/(stlink|jlink|cmsis-dap)\.cfg/.exec(args.join(' ')) ?? [])[1] ?? 'stlink'
const serial = (/adapter serial (\S+)/.exec(cmds.join('\n')) ?? [])[1]

const header = async () => {
  err('Open On-Chip Debugger 0.12.0 (имитатор)')
  if (iface === 'stlink') {
    err('Info : STLINK V2J37S7 (API v2) VID:PID 0483:3748')
    err(`Info : Target voltage: ${mode === 'nopower' ? '0.052000' : '3.250000'}`)
  } else if (iface === 'jlink') {
    err('Info : J-Link V11 compiled Apr 27 2021 16:01:50')
    err(`Info : Hardware version: 11.00${serial ? ' (серийный ' + serial + ')' : ''}`)
    err(`Info : VTarget = ${mode === 'nopower' ? '0.052' : '3.300'} V`)
    err('Info : clock speed 1800 kHz')
  } else {
    err('Info : CMSIS-DAP: SWD supported')
    err('Info : CMSIS-DAP: Interface Initialised (SWD)')
    err(`Info : Using CMSIS-DAPv2 interface with VID:PID=0x0d28:0x0204, serial=${serial ?? 'unknown'}`)
  }
}
const fail = (lines) => { for (const l of lines) err(l); process.exit(1) }

if (mode === 'noprobe') fail(iface === 'jlink' ? ['Error: No J-Link device found'] : iface === 'cmsis-dap' ? ['Error: unable to find a matching CMSIS-DAP device'] : ['Error: open failed', 'Error: No ST-LINK detected'])
if (mode === 'nodriver') fail(iface === 'jlink' ? ['Error: Failed to open device: access error'] : iface === 'cmsis-dap' ? ['Error: libusb_open() failed with LIBUSB_ERROR_NOT_SUPPORTED', 'Error: unable to find a matching CMSIS-DAP device'] : ['Error: libusb_open() failed with LIBUSB_ERROR_NOT_SUPPORTED', 'Error: open failed'])
await header()
if (mode === 'nopower') fail(['Error: init mode failed (unable to connect to the target)'])
if (mode === 'wrongid') fail(['Warn : UNEXPECTED idcode: 0x2ba01477', 'Error: expected 1 of 1: 0x1ba01477'])
if (mode === 'rdp') fail(['Info : [stm32f1x.cpu] Cortex-M3 r1p1 processor detected', 'Error: device is protected'])
err('Info : [stm32f1x.cpu] Cortex-M3 r1p1 processor detected')
err('Info : device id = 0x20036410')
err('Info : flash size = 64 KiB')

const gdb = cmds.find((c) => /^gdb_port \d+/.test(c))
const swo = cmds.map((c) => /-output :(\d+)/.exec(c)).find(Boolean)
if (swo) {
  if (mode === 'notpiu') fail(['Error: SWO: в целевом файле нет блока TPIU'])
  const port = Number(swo[1])
  // ITM: однобайтные пакеты SWIT порта 0 (как ITM_SendChar)
  const swit = (port0, text) => Buffer.concat([...Buffer.from(text, 'utf8')].map((c) => Buffer.from([(port0 << 3) | 1, c])))
  const clients = new Set()
  const srv = createServer((s) => {
    clients.add(s)
    s.on('close', () => clients.delete(s))
    s.on('error', () => undefined)
    s.write(Buffer.from([0, 0, 0, 0, 0, 0x80]))
    s.write(swit(0, 'Привет из SWO\r\n'))
    s.write(Buffer.from([0x30]))
    s.write(swit(1, 'канал 1'))
    s.write(Buffer.from([0x70]))
  })
  srv.listen(port, '127.0.0.1', () => err(`Info : starting trace server for stm32f1x.tpiu on :${port}`))
  const feed = (process.env.AVRIDE_FAKE_MODE_FILE ?? '') + '.swo'
  let n = 0
  setInterval(() => {
    if (feed && existsSync(feed)) {
      const t = readFileSync(feed, 'utf8')
      if (t) { writeFileSync(feed, ''); for (const c of clients) c.write(swit(0, t)) }
    }
  }, 100)
  setInterval(() => { n++; for (const c of clients) c.write(Buffer.concat([swit(0, `tick ${n}\r\n`), Buffer.from([0xc0, 0x85, 0x03])])) }, 1500)
} else if (gdb) {
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
    err(` 0* stm32f1x.cpu      ${iface === 'stlink' ? 'hla_target' : 'cortex_m'} little stm32f1x.cpu       running`)
  }
  process.exit(0)
}

// Имитатор arm-none-eabi-gdb --interpreter=mi3 для автотестов. Отвечает по протоколу GDB/MI «выполнением» воображаемой программы
// (строки 8, 9, 10, 12, 13 файла main.c). К устройству не подключается; команда записи во Flash (-target-download) только журналируется
// в AVRIDE_FAKE_LOG, чтобы тест мог убедиться, что её никто не вызывал без подтверждения.
import { appendFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const LOG = process.env.AVRIDE_FAKE_LOG
let SRC = (process.env.AVRIDE_FAKE_SRC || 'main.c').replace(/\\/g, '/')
const note = (o) => { if (LOG) appendFileSync(LOG, JSON.stringify({ tool: 'gdb', ...o }) + '\n') }
note({ args: process.argv.slice(2) })

const LINES = [8, 9, 10, 12, 13]
const FUNC = (l) => (l <= 10 ? 'main' : 'delay_ms')
const ADDR = (l) => 0x08000100 + l * 4
const frame = (l, level) => `frame={${level !== undefined ? `level="${level}",` : ''}addr="0x${ADDR(l).toString(16).padStart(8, '0')}",func="${FUNC(l)}",args=[],file="main.c",fullname="${SRC}",line="${l}"}`
let cur = 8
let running = false
let bpSeq = 1
const bps = new Map()
const mem = new Map()
const out = (s) => process.stdout.write(s + '\n')
const q = (s) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'

const stop = (reason, l) => { running = false; cur = l; out(`*stopped,reason="${reason}",${frame(l)},thread-id="1",stopped-threads="all"`) }
const nextLine = (l) => LINES[(LINES.indexOf(l) + 1) % LINES.length]
const bpTable = () => `BreakpointTable={nr_rows="${bps.size}",nr_cols="6",hdr=[],body=[${[...bps.values()].map((b) => 'bkpt=' + b.text).join(',')}]}`
const regs = ['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11', 'r12', 'sp', 'lr', 'pc', 'xPSR']

function handle(tok, cmd) {
  note({ cmd })
  const done = (extra = '') => out(`${tok}^done${extra}`)
  if (/^-file-symbol-file/.test(cmd) && !process.env.AVRIDE_FAKE_SRC) {
    // <корень>/build/<конфигурация>/<имя>.elf -> <корень>/src/main.c
    const elf = /"(.*)"/.exec(cmd)?.[1]
    if (elf) SRC = elf.split(String.fromCharCode(92)).join('/').split('/').slice(0, -3).concat('src', 'main.c').join('/')
  }
  if (/^-gdb-set|^-file-symbol-file|^-break-condition/.test(cmd)) return done()
  if (/^-target-select/.test(cmd)) return out(`${tok}^connected,addr="0x08000100",func="??",args=[]`)
  if (/^-interpreter-exec/.test(cmd)) { out('~"Unable to match requested speed 1800 kHz, using 1000 kHz\\n"'); return done() }
  if (/^-break-insert/.test(cmd)) {
    const line = /--line (\d+)/.exec(cmd)?.[1]
    const cond = /-c "((?:[^"\\]|\\.)*)"/.exec(cmd)?.[1]
    const isMain = /\bmain$/.test(cmd.trim())
    const l = line ? Number(line) : (/main$/.test(cmd.trim()) ? 8 : 12)
    const id = bpSeq++
    const text = `{number="${id}",type="hw breakpoint",disp="${/ -t /.test(cmd) ? 'del' : 'keep'}",enabled="y",addr="0x${ADDR(l).toString(16).padStart(8, '0')}",func="${FUNC(l)}",file="main.c",fullname="${SRC}",line="${l}"${cond ? `,cond="${cond}"` : ''},times="0"}`
    bps.set(id, { id, line: l, temp: / -t /.test(cmd), isMain, text })
    return done(`,bkpt=${text}`)
  }
  if (/^-break-delete/.test(cmd)) { bps.delete(Number(cmd.split(' ')[1])); return done() }
  if (/^-break-list/.test(cmd)) return done(',' + bpTable())
  if (/^-exec-continue/.test(cmd)) {
    running = true
    out(`${tok}^running`); out('*running,thread-id="all"')
    setTimeout(() => {
      if (!running) return
      // ближайшая точка останова впереди по кругу
      for (let i = 1; i <= LINES.length; i++) {
        const l = LINES[(LINES.indexOf(cur) + i) % LINES.length]
        const hit = [...bps.values()].find((b) => b.line === l)
        if (hit) { if (hit.temp) bps.delete(hit.id); return stop('breakpoint-hit', l) }
      }
    }, 120)
    return
  }
  if (/^-exec-(next|step|finish)/.test(cmd)) {
    running = true
    out(`${tok}^running`); out('*running,thread-id="all"')
    setTimeout(() => stop('end-stepping-range', nextLine(cur)), 80)
    return
  }
  if (/^-exec-interrupt/.test(cmd)) { done(); if (running) setTimeout(() => stop('signal-received', cur), 40); return }
  if (/^-stack-list-frames/.test(cmd)) return done(`,stack=[${frame(cur, 0)},frame={level="1",addr="0x08000220",func="main",file="main.c",fullname="${SRC}",line="10"}]`)
  if (/^-stack-select-frame/.test(cmd)) return done()
  if (/^-stack-list-variables/.test(cmd)) return done(`,variables=[{name="counter",type="uint32_t",value="${cur * 3}"}]`)
  if (/^-data-evaluate-expression/.test(cmd)) {
    const e = /"((?:[^"\\]|\\.)*)"/.exec(cmd)?.[1] ?? ''
    if (e === 'counter') return done(`,value="${cur * 3}"`)
    if (e === 'nosuch') return out(`${tok}^error,msg="No symbol \\"nosuch\\" in current context."`)
    return done(',value="0"')
  }
  if (/^-data-list-register-names/.test(cmd)) return done(`,register-names=[${regs.map(q).join(',')}]`)
  if (/^-data-list-register-values/.test(cmd)) return done(`,register-values=[${regs.map((r, i) => `{number="${i}",value="0x${(r === 'pc' ? ADDR(cur) : r === 'sp' ? 0x20004ff8 : r === 'xPSR' ? 0x61000000 : i * 0x11).toString(16)}"}`).join(',')}]`)
  if (/^-data-read-memory-bytes/.test(cmd)) {
    const [, a, n] = cmd.split(' ')
    const addr = Number(a); const len = Number(n)
    const bytes = Array.from({ length: len }, (_, i) => (mem.get(addr + i) ?? ((addr + i) & 0xff)).toString(16).padStart(2, '0')).join('')
    return done(`,memory=[{begin="${a}",offset="0x00000000",end="0x${(addr + len).toString(16)}",contents="${bytes}"}]`)
  }
  if (/^-data-write-memory-bytes/.test(cmd)) {
    const [, a, hex] = cmd.split(' ')
    for (let i = 0; i < hex.length / 2; i++) mem.set(Number(a) + i, parseInt(hex.slice(i * 2, i * 2 + 2), 16))
    return done()
  }
  if (/^-data-disassemble/.test(cmd)) {
    const rows = Array.from({ length: 6 }, (_, i) => `{address="0x${(ADDR(cur) + i * 2).toString(16).padStart(8, '0')}",func-name="${FUNC(cur)}",offset="${i * 2}",inst="${['push\t{r7, lr}', 'sub\tsp, #8', 'add\tr7, sp, #0', 'movs\tr0, #1', 'bl\t0x8000200 <delay_ms>', 'nop'][i]}"}`)
    return done(`,asm_insns=[${rows.join(',')}]`)
  }
  if (/^-target-download/.test(cmd)) { note({ WROTE_FLASH: true }); out('~"Loading section .text (имитация)\\n"'); return done() }
  if (/^-gdb-exit/.test(cmd)) { out(`${tok}^exit`); process.exit(0) }
  out(`${tok}^error,msg="Undefined MI command: ${cmd.split(' ')[0]}"`)
}

const rl = createInterface({ input: process.stdin })
rl.on('line', (line) => {
  const m = /^(\d*)(-.*)$/.exec(line.trim())
  if (!m) return
  handle(m[1], m[2])
  out('(gdb) ')
})
rl.on('close', () => process.exit(0))

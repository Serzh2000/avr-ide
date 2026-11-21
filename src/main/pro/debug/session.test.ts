// Сессия отладки на имитаторе GDB (scripts/e2e/fakes/fake-gdb.mjs). Реальных устройств и программ нет.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnTool } from '../openocd/runner'
import { GdbDebugSession, GdbError, MiClient } from './session'
import type { DebugEvent } from '../interfaces'

const FAKE = resolve(process.cwd(), 'scripts', 'e2e', 'fakes', 'fake-gdb.mjs')

function start(): { s: GdbDebugSession; log: () => { cmd?: string; WROTE_FLASH?: boolean }[]; events: DebugEvent[] } {
  const dir = mkdtempSync(join(tmpdir(), 'avride-fakegdb-'))
  const logFile = join(dir, 'log.jsonl')
  process.env['AVRIDE_FAKE_LOG'] = logFile
  process.env['AVRIDE_FAKE_SRC'] = 'C:/p/src/main.c'
  const mi = new MiClient(spawnTool(FAKE, ['--interpreter=mi3']), 5000)
  const s = new GdbDebugSession(mi, 'C:/p', async () => undefined)
  const events: DebugEvent[] = []
  s.onEvent((e) => events.push(e))
  const log = (): { cmd?: string; WROTE_FLASH?: boolean }[] => (existsSync(logFile) ? readFileSync(logFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [])
  return { s, log, events }
}

test('точки останова, продолжение, шаг, стек, переменные, регистры, память, дизассемблер', async () => {
  const { s, log, events } = start()
  try {
    const bp = await s.setBreakpoint('C:\\p\\src\\main.c', 12, { condition: 'counter > 3' })
    assert.deepEqual([bp.id, bp.line, bp.file, bp.verified, bp.condition], [1, 12, 'src/main.c', true, 'counter > 3'])
    assert.equal((await s.setFunctionBreakpoint('delay_ms')).function, 'delay_ms')
    assert.equal((await s.listBreakpoints()).length, 2)

    await s.resume()
    const stop = await s.waitStopped()
    assert.deepEqual([stop.state, stop.reason, stop.line], ['stopped', 'breakpoint-hit', 12])
    assert.deepEqual(events.map((e) => e.state).slice(0, 2), ['running', 'stopped'])

    await s.stepOver()
    assert.equal((await s.waitStopped()).line, 13)
    const st = await s.stack()
    assert.equal(st[0].function, 'delay_ms')
    assert.equal(st[0].line, 13)
    assert.equal(st[0].pc, 0x08000100 + 13 * 4)

    const vars = await s.locals()
    assert.deepEqual(vars[0], { name: 'counter', type: 'uint32_t', value: '39' })
    assert.equal(await s.evaluate('counter'), '39')
    await assert.rejects(() => s.evaluate('nosuch'), /No symbol/)

    const regs = await s.readRegisters()
    assert.equal(regs['pc'], 0x08000100 + 13 * 4)
    assert.equal(regs['sp'], 0x20004ff8)
    assert.equal(regs['xPSR'], 0x61000000)

    const mem = await s.readMemory(0x20000000, 8)
    assert.deepEqual(Array.from(mem), [0, 1, 2, 3, 4, 5, 6, 7])
    await s.writeMemory(0x20000002, Uint8Array.of(0xaa))
    assert.equal((await s.readMemory(0x20000002, 1))[0], 0xaa)

    const dis = await s.disassemble(null, 4)
    assert.equal(dis.length, 4)
    assert.match(dis[0].text, /push/)

    await s.removeBreakpoint(1)
    assert.equal((await s.listBreakpoints()).length, 1)

    // пауза во время работы
    await s.removeBreakpoint(2)
    await s.resume()
    assert.equal(s.state(), 'running')
    await s.pause()
    assert.equal((await s.waitStopped()).reason, 'signal-received')

    // запись во Flash не вызывалась ни разу
    assert.equal(log().some((r) => r.WROTE_FLASH || /target-download/.test(r.cmd ?? '')), false)
  } finally {
    await s.stop()
  }
})

test('loadProgram — единственный путь записи во Flash и он явный', async () => {
  const { s, log } = start()
  try {
    await s.loadProgram()
    assert.equal(log().some((r) => r.WROTE_FLASH), true)
  } finally { await s.stop() }
})

test('неверные аргументы отвергаются до обращения к GDB', async () => {
  const { s } = start()
  try {
    await assert.rejects(() => s.setBreakpoint('a.c', 0), GdbError)
    await assert.rejects(() => s.setFunctionBreakpoint('a b; quit'), /имя функции/)
    await assert.rejects(() => s.readMemory(0, 0), /Длина/)
    await assert.rejects(() => s.writeMemory(0, new Uint8Array(0)), /Запись/)
  } finally { await s.stop() }
})

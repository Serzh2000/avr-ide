// Сессия отладки: arm-none-eabi-gdb в режиме MI3 + GDB-сервер OpenOCD. Загрузка символов из ELF БЕЗ записи в устройство
// (`-file-symbol-file` + `-target-select extended-remote`); запись во Flash — только loadProgram() по явной кнопке.
import type { ChildProcessWithoutNullStreams } from 'child_process'
import { basename, relative, isAbsolute } from 'path'
import type { Breakpoint, DebugEvent, DebugSession, DebugState, DebugVar, DisasmLine, StackFrame } from '../interfaces'
import { lineReader } from '../openocd/runner'
import { arr, frameOf, miQuote, num, obj, parseMiLine, str } from './mi'
import type { MiRecord, MiTuple } from './mi'

type Pending = { resolve: (r: { cls: string; data: MiTuple }) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }

export class GdbError extends Error {
  constructor(msg: string) { super(msg); this.name = 'GdbError' }
}

/** Транспорт MI: токены команд, ответы, асинхронные события. Не знает про OpenOCD — проверяется на имитаторе. */
export class MiClient {
  private token = 0
  private pending = new Map<number, Pending>()
  private asyncCbs = new Set<(r: MiRecord) => void>()
  private logCbs = new Set<(l: string) => void>()
  exited = false
  private readonly child: ChildProcessWithoutNullStreams
  private readonly timeoutMs: number

  constructor(child: ChildProcessWithoutNullStreams, timeoutMs = 20000) {
    this.child = child
    this.timeoutMs = timeoutMs
    const out = lineReader((line) => {
      let rec: MiRecord | null
      try { rec = parseMiLine(line) } catch { this.log(line); return }
      if (!rec) return
      if (rec.type === 'result') {
        const p = rec.token !== undefined ? this.pending.get(rec.token) : undefined
        if (!p) return
        this.pending.delete(rec.token!)
        clearTimeout(p.timer)
        if (rec.cls === 'error') p.reject(new GdbError(str(rec.data['msg']) ?? 'Ошибка GDB'))
        else p.resolve({ cls: rec.cls, data: rec.data })
      } else if (rec.type === 'console' || rec.type === 'target') {
        for (const l of rec.text.split(/\r?\n/)) if (l.trim()) this.log(l)
      } else if (rec.type === 'log') { /* внутренний журнал GDB — не показываем */ }
      else if (rec.type !== 'prompt') this.asyncCbs.forEach((cb) => cb(rec))
    })
    child.stdout.on('data', (d) => out.push(d))
    const err = lineReader((l) => this.log(l))
    child.stderr.on('data', (d) => err.push(d))
    child.on('close', () => {
      this.exited = true
      out.flush()
      for (const [, p] of this.pending) { clearTimeout(p.timer); p.reject(new GdbError('GDB завершился.')) }
      this.pending.clear()
      this.asyncCbs.forEach((cb) => cb({ type: 'exec', cls: 'exited-process', data: {} }))
    })
  }

  private log(l: string): void { this.logCbs.forEach((cb) => cb(l)) }
  onAsync(cb: (r: MiRecord) => void): () => void { this.asyncCbs.add(cb); return () => { this.asyncCbs.delete(cb) } }
  onLog(cb: (l: string) => void): () => void { this.logCbs.add(cb); return () => { this.logCbs.delete(cb) } }

  send(cmd: string, timeoutMs = this.timeoutMs): Promise<{ cls: string; data: MiTuple }> {
    if (this.exited) return Promise.reject(new GdbError('GDB уже завершён.'))
    const t = ++this.token
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(t); reject(new GdbError(`GDB не ответил на «${cmd.split(' ')[0]}».`)) }, timeoutMs)
      this.pending.set(t, { resolve, reject, timer })
      this.child.stdin.write(`${t}${cmd}\n`)
    })
  }

  kill(): void { try { this.child.kill() } catch { /* уже завершён */ } }
}

const hex = (n: number): string => '0x' + (n >>> 0).toString(16)

function toBreakpoint(b: MiTuple, root: string | null): Breakpoint {
  const full = str(b['fullname']) ?? str(b['file']) ?? ''
  return {
    id: num(b['number']) ?? 0,
    file: full && root && isAbsolute(full) && !relative(root, full).startsWith('..') ? relative(root, full).replace(/\\/g, '/') : full,
    line: num(b['line']) ?? 0,
    verified: str(b['addr']) !== '<PENDING>',
    function: str(b['func']),
    condition: str(b['cond']),
    address: num(b['addr'])
  }
}

export class GdbDebugSession implements DebugSession {
  readonly id: string
  private st: DebugState = 'stopped'
  private evCbs = new Set<(e: DebugEvent) => void>()
  private stopWaiters: ((e: DebugEvent) => void)[] = []

  private readonly mi: MiClient
  private readonly root: string | null
  private readonly stopServer: () => Promise<void>

  constructor(mi: MiClient, root: string | null, stopServer: () => Promise<void>, id = 'dbg-' + Date.now()) {
    this.mi = mi
    this.root = root
    this.stopServer = stopServer
    this.id = id
    mi.onAsync((r) => {
      if (r.type !== 'exec') return
      if (r.cls === 'running') { if (this.st !== 'running') this.emit({ state: 'running' }) }
      else if (r.cls === 'stopped') {
        const reason = str(r.data['reason'])
        if (reason === 'exited-normally' || reason === 'exited' || reason === 'exited-signalled') { this.emit({ state: 'exited', reason }); return }
        const f = frameOf(r.data['frame'])
        this.emit({ state: 'stopped', reason, file: f.fullname ?? f.file, line: f.line })
      } else if (r.cls === 'exited-process') this.emit({ state: 'exited', reason: 'gdb-exit' })
    })
  }

  private emit(e: DebugEvent): void {
    this.st = e.state
    this.evCbs.forEach((cb) => cb(e))
    if (e.state !== 'running') { const w = this.stopWaiters; this.stopWaiters = []; w.forEach((f) => f(e)) }
  }

  onEvent(cb: (e: DebugEvent) => void): () => void { this.evCbs.add(cb); return () => { this.evCbs.delete(cb) } }
  onLog(cb: (l: string) => void): () => void { return this.mi.onLog(cb) }
  state(): DebugState { return this.st }

  waitStopped(ms = 30000): Promise<DebugEvent> {
    if (this.st !== 'running') return Promise.resolve({ state: this.st })
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new GdbError('Программа не остановилась за отведённое время.')), ms)
      this.stopWaiters.push((e) => { clearTimeout(t); resolve(e) })
    })
  }

  private async exec(cmd: string): Promise<void> {
    const r = await this.mi.send(cmd)
    // ^running приходит раньше *running: фиксируем состояние сразу, чтобы waitStopped не принял старое «остановлено»
    if (r.cls === 'running' && this.st !== 'running') this.emit({ state: 'running' })
  }
  resume(): Promise<void> { return this.exec('-exec-continue') }
  pause(): Promise<void> { return this.exec('-exec-interrupt') }
  stepOver(): Promise<void> { return this.exec('-exec-next') }
  stepInto(): Promise<void> { return this.exec('-exec-step') }
  stepOut(): Promise<void> { return this.exec('-exec-finish') }

  private place(file: string): string {
    const f = file.replace(/\\/g, '/')
    if (this.root && isAbsolute(file)) {
      const rel = relative(this.root, file)
      if (!rel.startsWith('..') && !isAbsolute(rel)) return rel.replace(/\\/g, '/')
      return basename(f)
    }
    return f
  }

  async setBreakpoint(file: string, line: number, opts?: { condition?: string }): Promise<Breakpoint> {
    if (!Number.isInteger(line) || line < 1) throw new GdbError('Неверный номер строки.')
    const cond = opts?.condition ? ` -c ${miQuote(opts.condition)}` : ''
    const r = await this.mi.send(`-break-insert -h${cond} --source ${miQuote(this.place(file))} --line ${line}`)
    return toBreakpoint(obj(r.data['bkpt']), this.root)
  }
  async setFunctionBreakpoint(name: string, opts?: { condition?: string }): Promise<Breakpoint> {
    if (!/^[A-Za-z_][\w:]*$/.test(name)) throw new GdbError('Неверное имя функции.')
    const cond = opts?.condition ? ` -c ${miQuote(opts.condition)}` : ''
    const r = await this.mi.send(`-break-insert -h${cond} ${name}`)
    return toBreakpoint(obj(r.data['bkpt']), this.root)
  }
  async removeBreakpoint(id: number): Promise<void> { await this.mi.send(`-break-delete ${Math.floor(id)}`) }
  async listBreakpoints(): Promise<Breakpoint[]> {
    const r = await this.mi.send('-break-list')
    return arr(obj(r.data['BreakpointTable'])['body']).map((b) => toBreakpoint(obj(b), this.root))
  }

  async stack(): Promise<StackFrame[]> {
    const r = await this.mi.send('-stack-list-frames')
    return arr(r.data['stack']).map((v) => { const f = frameOf(v); return { index: f.level, function: f.func, file: f.fullname ?? f.file, line: f.line, pc: f.addr } })
  }
  async selectFrame(index: number): Promise<void> { await this.mi.send(`-stack-select-frame ${Math.floor(index)}`) }

  async locals(): Promise<DebugVar[]> {
    const r = await this.mi.send('-stack-list-variables --simple-values')
    return arr(r.data['variables']).map((v) => { const o = obj(v); return { name: str(o['name']) ?? '?', value: str(o['value']) ?? '', type: str(o['type']) } })
  }
  async evaluate(expr: string): Promise<string> {
    const r = await this.mi.send(`-data-evaluate-expression ${miQuote(expr)}`)
    return str(r.data['value']) ?? ''
  }

  async readRegisters(): Promise<Record<string, number>> {
    const names = arr((await this.mi.send('-data-list-register-names')).data['register-names']).map((n) => str(n) ?? '')
    const vals = arr((await this.mi.send('-data-list-register-values --skip-unavailable x')).data['register-values'])
    const out: Record<string, number> = {}
    for (const v of vals) {
      const o = obj(v)
      const idx = num(o['number'])
      const val = str(o['value'])
      if (idx === undefined || !names[idx] || val === undefined) continue
      const n = /^0x[0-9a-f]+$/i.test(val) ? parseInt(val, 16) : NaN
      if (Number.isFinite(n)) out[names[idx]] = n >>> 0
    }
    return out
  }

  async readMemory(address: number, length: number): Promise<Uint8Array> {
    if (length < 1 || length > 65536) throw new GdbError('Длина чтения памяти: от 1 до 65536 байт.')
    const r = await this.mi.send(`-data-read-memory-bytes ${hex(address)} ${Math.floor(length)}`)
    const m = obj(arr(r.data['memory'])[0])
    const c = str(m['contents']) ?? ''
    const out = new Uint8Array(c.length >> 1)
    for (let i = 0; i < out.length; i++) out[i] = parseInt(c.slice(i * 2, i * 2 + 2), 16)
    return out
  }

  async writeMemory(address: number, bytes: Uint8Array): Promise<void> {
    if (!bytes.length || bytes.length > 1024) throw new GdbError('Запись: от 1 до 1024 байт.')
    await this.mi.send(`-data-write-memory-bytes ${hex(address)} ${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`)
  }

  async disassemble(address: number | null, count: number): Promise<DisasmLine[]> {
    const n = Math.min(Math.max(1, Math.floor(count)), 200)
    // от адреса (по умолчанию — текущий PC) на n*4 байт хватает для n инструкций Thumb (2–4 байта)
    const start = address === null ? '$pc' : hex(address)
    const r = await this.mi.send(`-data-disassemble -s ${start} -e ${address === null ? `"$pc+${n * 4}"` : hex(address + n * 4)} -- 0`)
    return arr(r.data['asm_insns']).slice(0, n).map((v) => {
      const o = obj(v)
      return { address: num(o['address']) ?? 0, text: str(o['inst']) ?? '', func: str(o['func-name']), offset: num(o['offset']) }
    })
  }

  async loadProgram(): Promise<void> {
    await this.mi.send('-target-download', 120000)
  }

  async stop(): Promise<void> {
    try { if (!this.mi.exited) await this.mi.send('-gdb-exit', 3000) } catch { /* GDB уже закрыт */ }
    this.mi.kill()
    await this.stopServer()
  }
}

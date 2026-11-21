// ProgrammerProvider на OpenOCD (ST-Link V2 / V2-1 / V3, J-Link, CMSIS-DAP; SWD). Прошивка выполняется ТОЛЬКО по явной команде пользователя (кнопка «Прошить»).
import { createServer } from 'net'
import { existsSync } from 'fs'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import type { FlashOptions, GdbServerHandle, Probe, ProgrammerProvider, ProjectContext, RunOptions } from '../interfaces'
import { eraseArgs, gdbServerArgs, missingScripts, pickTarget, programArgs, projectProgrammer } from './args'
import type { OpenOcdBase } from './args'
import { ERR, FlashFailure, explainOpenOcdLog, noDriverError, noProbeError, phaseOf, summarizeFlash } from './logParse'
import type { FlashError, FlashSummary } from './logParse'
import { listUsbProbes } from './probes'
import type { ProgrammerKind } from '../../../shared/pro/programmers'
import { lineReader, runTool, scriptsDirFor, spawnTool } from './runner'

export type OpenocdLocator = () => string | null

export function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const s = createServer()
    s.once('error', rej)
    s.listen(0, '127.0.0.1', () => { const p = (s.address() as { port: number }).port; s.close(() => res(p)) })
  })
}

export class OpenOcdProgrammer implements ProgrammerProvider {
  readonly id = 'openocd'
  readonly implemented = true
  /** Итог последней успешной прошивки (для интерфейса) */
  lastSummary: FlashSummary | null = null

  private readonly locate: OpenocdLocator
  private readonly probes: () => Promise<Probe[]>
  private readonly exists: (p: string) => boolean

  constructor(locate: OpenocdLocator, probes: () => Promise<Probe[]> = listUsbProbes, exists: (p: string) => boolean = existsSync) {
    this.locate = locate
    this.probes = probes
    this.exists = exists
  }

  listProbes(): Promise<Probe[]> { return this.probes() }

  /** Журнал OpenOCD → понятная ошибка для типа программатора. J-Link, видимый в системе, но «не найденный» OpenOCD, почти всегда означает не тот драйвер. */
  explain(log: string, kind: ProgrammerKind, probe: Probe | null): FlashError {
    const e = explainOpenOcdLog(log, kind)
    if (e.kind === 'no-probe' && probe && kind !== 'stlink' && probe.driver !== 'ok') return noDriverError(kind)
    return e
  }

  /** Всё, что нужно для запуска OpenOCD: программа, тип и серийный номер программатора, цель, скрипты. Бросает FlashFailure с понятным объяснением. */
  async prepare(ctx: ProjectContext, probe: Probe | null, o: { speedKhz?: number; resetMode?: 'normal' | 'under-reset' }): Promise<{ exe: string; base: OpenOcdBase; kind: ProgrammerKind; probe: Probe }> {
    const exe = this.locate()
    if (!exe) throw new FlashFailure(ERR.noOpenocd)
    const target = pickTarget(ctx.project)
    if (!target) throw new FlashFailure({ ...ERR.noScripts, title: 'Для этого чипа не известна цель OpenOCD', hint: 'Укажите «programmer.openocdTarget» в avride.project.json, например target/stm32f1x.cfg.' })
    let p = probe
    if (!p) {
      const all = await this.probes()
      const want = projectProgrammer(ctx.project)
      p = all.find((x) => x.kind === want) ?? null
      if (!p) throw new FlashFailure(noProbeError(want))
    }
    const kind = p.kind
    if (p.driver === 'missing') throw new FlashFailure(noDriverError(kind))
    const scripts = scriptsDirFor(exe)
    const miss = missingScripts(scripts, kind, target, this.exists)
    if (miss.length) throw new FlashFailure({ ...ERR.noScripts, title: 'У OpenOCD нет нужных файлов настроек', hint: `В папке scripts OpenOCD не найдено: ${miss.join(', ')}. Переустановите OpenOCD кнопкой «Установить OpenOCD» или проверьте цель в проекте (programmer.openocdTarget).` })
    return { exe, kind, probe: p, base: { programmer: kind, scripts, target, serial: p.serial, speedKhz: o.speedKhz, resetMode: o.resetMode } }
  }

  async flash(ctx: ProjectContext, probe: Probe | null, opts: FlashOptions & RunOptions): Promise<void> {
    if (!existsSync(opts.file)) throw new FlashFailure({ ...ERR.unknown, title: 'Нет файла прошивки', hint: 'Сначала соберите проект (кнопка «Собрать»).' })
    const { exe, base, kind, probe: pr } = await this.prepare(ctx, probe, opts)
    const address = opts.address ?? ctx.project.target.memory.flash.origin
    const args = programArgs({ ...base, file: opts.file, address, verify: opts.verify, reset: opts.reset })
    opts.onLog?.(`> openocd ${args.join(' ')}`)
    opts.onPhase?.('connect', 'Подключение к плате', 0.05)
    const r = await runTool(exe, args, {
      signal: opts.signal, timeoutMs: 120000,
      onLine: (l) => { opts.onLog?.(l); const ph = phaseOf(l); if (ph) opts.onPhase?.(ph.phase, ph.label, ph.fraction) }
    })
    if (r.cancelled) throw new FlashFailure(ERR.cancelled)
    if (r.timedOut) throw new FlashFailure(ERR.timeout)
    if (r.code !== 0) throw new FlashFailure(this.explain(r.log, kind, pr))
    this.lastSummary = summarizeFlash(r.log)
    opts.onPhase?.('done', 'Готово', 1)
  }

  async erase(ctx: ProjectContext, probe: Probe | null, opts: { mass?: boolean } & RunOptions): Promise<void> {
    if (!opts.mass) throw new FlashFailure({ ...ERR.unknown, title: 'Постраничное стирание выполняется при прошивке', hint: 'Отдельно можно стереть только всю память целиком.' })
    const { exe, base, kind, probe: pr } = await this.prepare(ctx, probe, {})
    const args = eraseArgs(base)
    opts.onLog?.(`> openocd ${args.join(' ')}`)
    const r = await runTool(exe, args, { signal: opts.signal, timeoutMs: 120000, onLine: (l) => opts.onLog?.(l) })
    if (r.cancelled) throw new FlashFailure(ERR.cancelled)
    if (r.timedOut) throw new FlashFailure(ERR.timeout)
    if (r.code !== 0) throw new FlashFailure(this.explain(r.log, kind, pr))
  }

  async startGdbServer(ctx: ProjectContext, probe: Probe | null, opts: RunOptions & { speedKhz?: number; resetMode?: 'normal' | 'under-reset' } = {}): Promise<GdbServerHandle> {
    const { exe, base, kind, probe: pr } = await this.prepare(ctx, probe, opts)
    const port = await freePort()
    const args = gdbServerArgs(base, port)
    opts.onLog?.(`> openocd ${args.join(' ')}`)
    const child: ChildProcessWithoutNullStreams = spawnTool(exe, args)
    let log = ''
    return new Promise<GdbServerHandle>((resolve, reject) => {
      let settled = false
      const stop = (): Promise<void> => new Promise((res) => {
        if (child.exitCode !== null || child.killed) { res(); return }
        child.once('close', () => res())
        child.kill()
        setTimeout(res, 3000)
      })
      const rd = lineReader((l) => {
        log += l + '\n'
        opts.onLog?.(l)
        if (!settled && /Listening on port \d+ for gdb connections/i.test(l)) { settled = true; resolve({ port, stop }) }
      })
      child.stdout.on('data', (d) => rd.push(d))
      child.stderr.on('data', (d) => rd.push(d))
      child.on('error', (e) => { if (!settled) { settled = true; reject(e) } })
      child.on('close', () => {
        rd.flush()
        if (!settled) { settled = true; reject(new FlashFailure(this.explain(log, kind, pr))) }
      })
      const t = setTimeout(() => { if (!settled) { settled = true; void stop(); reject(new FlashFailure(ERR.timeout)) } }, 20000)
      void t
      opts.signal?.addEventListener('abort', () => { void stop() }, { once: true })
    })
  }
}

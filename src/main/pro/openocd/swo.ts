// Приём SWO/ITM через OpenOCD: отдельный запуск OpenOCD отдаёт поток трассировки на TCP-порт localhost (tpiu ... -output :порт),
// IDE подключается клиентом, разбирает пакеты ITM (shared/pro/itm.ts) и передаёт текст порта 0 в интерфейс.
// Прошивка и стирание не выполняются; устройство только слушается (в блоки TPIU/ITM записываются настройки трассировки).
import { connect } from 'net'
import type { Socket } from 'net'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import { ItmParser, ItmText } from '../../../shared/pro/itm'
import type { ItmStats } from '../../../shared/pro/itm'
import { FlashFailure, ERR } from './logParse'
import type { FlashError } from './logParse'
import { lineReader, spawnTool } from './runner'

export interface SwoChunk { text: string; stats: ItmStats }

export interface SwoRun {
  exe: string
  args: string[]
  port: number
  /** Объяснение сбоя запуска по журналу OpenOCD */
  explain: (log: string) => FlashError
  onLog?: (line: string) => void
  onData: (c: SwoChunk) => void
  /** Соединение закрылось уже после успешного запуска (OpenOCD завершился, плату отключили) */
  onEnd?: (reason: string) => void
}

export interface SwoHandle { stop(): Promise<void> }

const FLUSH_MS = 40

/** Запускает OpenOCD и подключается к его серверу трассировки. Резолвится, когда соединение установлено. */
export function startSwo(run: SwoRun): Promise<SwoHandle> {
  const child: ChildProcessWithoutNullStreams = spawnTool(run.exe, run.args)
  let log = ''
  let sock: Socket | null = null
  let stopped = false
  let connected = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let flushTimer: ReturnType<typeof setInterval> | undefined
  const parser = new ItmParser()
  const text = new ItmText(0)
  let pending = ''
  let dirty = false

  const flush = (): void => {
    if (!pending && !dirty) return
    const t = pending
    pending = ''
    dirty = false
    run.onData({ text: t, stats: { ...text.stats, ports: { ...text.stats.ports } } })
  }

  const stop = (): Promise<void> => new Promise((res) => {
    stopped = true
    clearTimeout(timer)
    clearInterval(flushTimer)
    try { sock?.destroy() } catch { /* уже закрыт */ }
    if (child.exitCode !== null || child.killed) { res(); return }
    child.once('close', () => res())
    try { child.kill() } catch { res() }
    setTimeout(res, 3000)
  })

  return new Promise<SwoHandle>((resolve, reject) => {
    let settled = false
    const fail = (e: FlashError): void => { if (settled) return; settled = true; void stop(); reject(new FlashFailure(e)) }
    const rd = lineReader((l) => { log += l + '\n'; run.onLog?.(l) })
    child.stdout.on('data', (d) => rd.push(d))
    child.stderr.on('data', (d) => rd.push(d))
    child.on('error', (e) => { if (!settled) { settled = true; reject(e) } })
    child.on('close', () => {
      rd.flush()
      if (!settled) { settled = true; reject(new FlashFailure(run.explain(log))); return }
      if (!stopped) { flush(); run.onEnd?.('OpenOCD завершил работу') }
    })

    const started = Date.now()
    const tryConnect = (): void => {
      if (stopped || settled) return
      if (child.exitCode !== null) return // close-обработчик сообщит об ошибке
      if (Date.now() - started > 20000) { fail({ ...ERR.timeout, title: 'SWO не запустился', hint: 'OpenOCD не открыл сервер трассировки за 20 секунд. Подробности — во вкладке «Вывод».' }); return }
      const s = connect({ host: '127.0.0.1', port: run.port })
      s.once('connect', () => {
        sock = s
        connected = true
        settled = true
        flushTimer = setInterval(flush, FLUSH_MS)
        resolve({ stop })
      })
      s.on('data', (d: Buffer) => {
        const ev = parser.push(new Uint8Array(d.buffer, d.byteOffset, d.length))
        const t = text.feed(ev)
        if (t) pending += t
        dirty = true
      })
      s.on('error', () => { /* повтор или завершение — решает close */ })
      s.on('close', () => {
        if (!connected) { timer = setTimeout(tryConnect, 150); return }
        if (!stopped) { flush(); run.onEnd?.('соединение с сервером трассировки закрыто') }
      })
    }
    timer = setTimeout(tryConnect, 300)
  })
}

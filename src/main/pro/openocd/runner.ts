// Запуск внешних программ (openocd, gdb) с построчным выводом, отменой и ограничением времени.
import { spawn } from 'child_process'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { spawnSpec } from '../tools/find'

export interface RunResult { code: number | null; log: string; cancelled: boolean; timedOut: boolean }

export function spawnTool(toolPath: string, args: string[]): ChildProcessWithoutNullStreams {
  const s = spawnSpec(toolPath, args)
  return spawn(s.command, s.args, { windowsHide: true, env: { ...process.env, ...s.env } })
}

/** Построчное чтение потока (учитывает \r и неполные строки). */
export function lineReader(onLine: (l: string) => void): { push(chunk: Buffer | string): void; flush(): void } {
  let buf = ''
  return {
    push(chunk) {
      buf += chunk.toString()
      const parts = buf.split(/\r\n|\n|\r/)
      buf = parts.pop() ?? ''
      for (const p of parts) if (p.trim()) onLine(p)
    },
    flush() { if (buf.trim()) onLine(buf); buf = '' }
  }
}

export function runTool(toolPath: string, args: string[], opts: { onLine?: (l: string) => void; signal?: AbortSignal; timeoutMs?: number } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    let log = ''
    let cancelled = false
    let timedOut = false
    const child = spawnTool(toolPath, args)
    const rd = lineReader((l) => { log += l + '\n'; opts.onLine?.(l) })
    child.stdout.on('data', (d) => rd.push(d))
    child.stderr.on('data', (d) => rd.push(d))
    const kill = (): void => { try { child.kill() } catch { /* уже завершён */ } }
    const onAbort = (): void => { cancelled = true; kill() }
    if (opts.signal?.aborted) onAbort()
    opts.signal?.addEventListener('abort', onAbort, { once: true })
    const timer = opts.timeoutMs ? setTimeout(() => { timedOut = true; kill() }, opts.timeoutMs) : undefined
    child.on('error', (e) => { clearTimeout(timer); reject(e) })
    child.on('close', (code) => {
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onAbort)
      rd.flush()
      resolve({ code, log, cancelled, timedOut })
    })
  })
}

/** Каталог tcl-скриптов рядом с OpenOCD (xPack: ../openocd/scripts, CubeIDE: ../openocd/scripts, Linux: ../share/openocd/scripts). */
export function scriptsDirFor(openocdPath: string): string | undefined {
  const bin = dirname(openocdPath)
  for (const rel of [['..', 'openocd', 'scripts'], ['..', 'share', 'openocd', 'scripts'], ['..', 'scripts'], ['..', '..', 'openocd', 'scripts']]) {
    const d = join(bin, ...rel)
    if (existsSync(join(d, 'interface'))) return d
  }
  return undefined
}

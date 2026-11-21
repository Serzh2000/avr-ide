// Запуск программ инструментария с построчным выводом и отменой (убивает всё дерево процессов).
import { spawn } from 'child_process'

export interface ExecResult { code: number | null; stdout: string; stderr: string; cancelled: boolean; error?: string }
export interface ExecOptions {
  cwd?: string
  env?: Record<string, string | undefined>
  onLine?: (line: string, stream: 'stdout' | 'stderr') => void
  signal?: AbortSignal
  /** Ограничение накопленного вывода (байт на поток); по умолчанию 4 МБ */
  maxBuffer?: number
}

export function killTree(pid: number | undefined): void {
  if (!pid) return
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true })
  else { try { process.kill(-pid, 'SIGTERM') } catch { try { process.kill(pid, 'SIGTERM') } catch { /* уже завершён */ } } }
}

/** PATH с папкой bin инструментария впереди: gcc ищет свои cc1 и ld рядом с собой, но make-подобные вызовы удобнее с PATH. */
export function envWithBin(bin: string | undefined, extra?: Record<string, string | undefined>): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env, ...extra }
  if (bin) {
    const key = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH'
    env[key] = bin + (process.platform === 'win32' ? ';' : ':') + (env[key] ?? '')
  }
  return env
}

export function execStream(tool: string, args: string[], o: ExecOptions = {}): Promise<ExecResult> {
  return new Promise((resolve) => {
    if (o.signal?.aborted) return resolve({ code: null, stdout: '', stderr: '', cancelled: true })
    const max = o.maxBuffer ?? 4 * 1024 * 1024
    let child
    try {
      child = spawn(tool, args, { cwd: o.cwd, env: o.env as NodeJS.ProcessEnv | undefined, windowsHide: true, shell: false })
    } catch (e) {
      return resolve({ code: -1, stdout: '', stderr: '', cancelled: false, error: String(e) })
    }
    let stdout = ''
    let stderr = ''
    let cancelled = false
    const carry = { stdout: '', stderr: '' }
    const feed = (stream: 'stdout' | 'stderr', text: string): void => {
      if (stream === 'stdout') { if (stdout.length < max) stdout += text } else if (stderr.length < max) stderr += text
      if (!o.onLine) return
      carry[stream] += text
      const lines = carry[stream].split(/\r?\n/)
      carry[stream] = lines.pop() ?? ''
      for (const l of lines) o.onLine(l, stream)
    }
    child.stdout.setEncoding('utf8').on('data', (t: string) => feed('stdout', t))
    child.stderr.setEncoding('utf8').on('data', (t: string) => feed('stderr', t))
    const onAbort = (): void => { cancelled = true; killTree(child.pid) }
    o.signal?.addEventListener('abort', onAbort, { once: true })
    child.on('error', (e) => { o.signal?.removeEventListener('abort', onAbort); resolve({ code: -1, stdout, stderr, cancelled, error: e.message }) })
    child.on('close', (code) => {
      o.signal?.removeEventListener('abort', onAbort)
      for (const s of ['stdout', 'stderr'] as const) if (carry[s] && o.onLine) o.onLine(carry[s], s)
      resolve({ code, stdout, stderr, cancelled })
    })
  })
}

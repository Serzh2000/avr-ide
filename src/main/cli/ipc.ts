import { BrowserWindow, dialog, ipcMain, type WebContents } from 'electron'
import { spawn, type ChildProcess } from 'child_process'
import { basename, dirname, extname } from 'path'
import { findCli, INSTALL_HELP, statusFromPath } from './binary'
import { setCliPath } from '../files/store'
import { isBaud, isCoreId, isFqbn, isLibName, isPort, isQuery, isUrl } from './validate'
import type { BoardEntry, CliResult, CliStatus, CoreInfo, EspUrlsStatus, LibInfo, OpKind, PortInfo } from './types'

const ESP_URLS = [
  'https://arduino.esp8266.com/stable/package_esp8266com_index.json',
  'https://espressif.github.io/arduino-esp32/package_esp32_index.json'
]

const fail = (error: string, notFound = false): { ok: false; error: string; notFound?: boolean } => ({ ok: false, error, notFound })

// ---------- Запуск процессов ----------

/** Дерево процессов на Windows убивается через taskkill (аргументы массивом). */
function killTree(child: ChildProcess): void {
  if (!child.pid) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
  } else {
    child.kill('SIGTERM')
  }
}

export interface Captured { code: number | null; stdout: string; stderr: string }

/** Запуск с накоплением вывода (для команд с --format json). */
export function capture(bin: string, args: string[], env?: Record<string, string>): Promise<Captured> {
  return new Promise((resolve) => {
    const c = spawn(bin, args, { windowsHide: true, shell: false, env: env ? { ...process.env, ...env } : process.env })
    let stdout = ''
    let stderr = ''
    c.stdout.setEncoding('utf8').on('data', (d: string) => (stdout += d))
    c.stderr.setEncoding('utf8').on('data', (d: string) => (stderr += d))
    c.on('error', (e) => resolve({ code: -1, stdout, stderr: stderr + String(e) }))
    c.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

async function json<T>(args: string[]): Promise<CliResult<T>> {
  const f = findCli()
  if (!f) return fail(INSTALL_HELP, true)
  const r = await capture(f.path, [...args, '--format', 'json'])
  if (r.code !== 0) return fail((r.stderr || r.stdout).trim() || `arduino-cli завершился с кодом ${r.code}`)
  try {
    return { ok: true, data: JSON.parse(r.stdout) as T }
  } catch {
    return fail('Не удалось разобрать JSON-ответ arduino-cli:\n' + r.stdout.slice(0, 500))
  }
}

// ---------- Текущая операция (одна за раз) ----------

let opSeq = 0
let current: { id: number; kind: OpKind; child: ChildProcess | null; abort: AbortController; cancelled: boolean } | null = null
let monitor: ChildProcess | null = null

function send(wc: WebContents, channel: string, payload: unknown): void {
  if (!wc.isDestroyed()) wc.send(channel, payload)
}

function startOp(wc: WebContents, kind: OpKind, args: string[]): CliResult<{ opId: number }> {
  const f = findCli()
  if (!f) return fail(INSTALL_HELP, true)
  if (current) return fail('Уже выполняется другая операция. Дождитесь окончания или нажмите «Отмена».')
  // Порт нельзя держать открытым во время прошивки
  if (kind === 'upload') stopMonitor()

  const opId = ++opSeq
  const child = spawn(f.path, args, { windowsHide: true, shell: false })
  const op = { id: opId, kind, child, abort: new AbortController(), cancelled: false }
  current = op
  send(wc, 'cli:log', { opId, stream: 'info', text: `$ arduino-cli ${args.join(' ')}\n` })
  child.stdout.setEncoding('utf8').on('data', (text: string) => send(wc, 'cli:log', { opId, stream: 'stdout', text }))
  child.stderr.setEncoding('utf8').on('data', (text: string) => send(wc, 'cli:log', { opId, stream: 'stderr', text }))
  let finished = false
  const done = (code: number | null): void => {
    if (finished) return
    finished = true
    if (current === op) current = null
    send(wc, 'cli:done', { opId, kind, code, cancelled: op.cancelled })
  }
  child.on('error', (e) => {
    send(wc, 'cli:log', { opId, stream: 'stderr', text: `Не удалось запустить arduino-cli: ${String(e)}\n` })
    done(-1)
  })
  child.on('close', done)
  return { ok: true, data: { opId } }
}

/** Контекст асинхронной операции (скачивание + запуск arduino-cli), события идут в тот же поток cli:log / cli:done. */
export interface OpContext {
  opId: number
  signal: AbortSignal
  log: (stream: 'stdout' | 'stderr' | 'info', text: string) => void
  /** Своё событие в renderer (например, результат установки) — приходит до cli:done */
  emit: (channel: string, payload: unknown) => void
  /** Запускает arduino-cli с доп. переменными окружения только для этого процесса; возвращает код завершения */
  runCli: (args: string[], env?: Record<string, string>) => Promise<number | null>
}

/**
 * Операция, у которой есть подготовительный этап в самом приложении (скачивание архива).
 * work возвращает код завершения (0 — успех). Отмена прерывает signal и убивает дочерний процесс.
 */
export function startAsyncOp(wc: WebContents, kind: OpKind, work: (ctx: OpContext) => Promise<number | null>): CliResult<{ opId: number }> {
  const f = findCli()
  if (!f) return fail(INSTALL_HELP, true)
  if (current) return fail('Уже выполняется другая операция. Дождитесь окончания или нажмите «Отмена».')
  const opId = ++opSeq
  const op = { id: opId, kind, child: null as ChildProcess | null, abort: new AbortController(), cancelled: false }
  current = op
  const log = (stream: 'stdout' | 'stderr' | 'info', text: string): void => send(wc, 'cli:log', { opId, stream, text })
  const ctx: OpContext = {
    opId,
    signal: op.abort.signal,
    log,
    emit: (channel, payload) => send(wc, channel, payload),
    runCli: (args, env) =>
      new Promise((resolve) => {
        if (op.cancelled) return resolve(null)
        log('info', `$ arduino-cli ${args.join(' ')}
`)
        const child = spawn(f.path, args, { windowsHide: true, shell: false, env: env ? { ...process.env, ...env } : process.env })
        op.child = child
        child.stdout.setEncoding('utf8').on('data', (t: string) => log('stdout', t))
        child.stderr.setEncoding('utf8').on('data', (t: string) => log('stderr', t))
        child.on('error', (e) => { log('stderr', `Не удалось запустить arduino-cli: ${String(e)}
`); resolve(-1) })
        child.on('close', (code) => { op.child = null; resolve(code) })
      })
  }
  void (async () => {
    let code: number | null = -1
    try {
      code = await work(ctx)
    } catch (e) {
      if (!op.cancelled) log('stderr', `${e instanceof Error ? e.message : String(e)}
`)
    }
    if (current === op) current = null
    send(wc, 'cli:done', { opId, kind, code, cancelled: op.cancelled })
  })()
  return { ok: true, data: { opId } }
}

/** Имитация порта для проверки интерфейса без платы: включается только переменной окружения AVRIDE_SIM_MONITOR=1. */
let simTimer: ReturnType<typeof setInterval> | null = null
let simWc: WebContents | null = null

function startSimMonitor(wc: WebContents): void {
  let n = 0
  simWc = wc
  simTimer = setInterval(() => {
    n++
    const t = n / 10
    const line = `temp:${(24 + 3 * Math.sin(t)).toFixed(2)},hum:${(45 + 10 * Math.cos(t / 2)).toFixed(1)},pwm:${(n * 7) % 100}\n`
    // иногда строка приходит двумя порциями — как от настоящего порта
    if (n % 5 === 0) {
      send(wc, 'monitor:data', { text: line.slice(0, 9), stream: 'stdout' })
      send(wc, 'monitor:data', { text: line.slice(9), stream: 'stdout' })
    } else send(wc, 'monitor:data', { text: line, stream: 'stdout' })
    if (n % 40 === 0) send(wc, 'monitor:data', { text: 'Привет из имитации порта\n', stream: 'stdout' })
  }, 50)
}

function stopMonitor(): void {
  if (simTimer) {
    clearInterval(simTimer)
    simTimer = null
    if (simWc) send(simWc, 'monitor:closed', null)
    simWc = null
  }
  if (monitor) {
    killTree(monitor)
    monitor = null
  }
}

/** Проверяет, что путь — это .ino в папке с тем же именем (требование arduino-cli). */
function sketchDir(inoPath: unknown): { ok: true; dir: string } | { ok: false; error: string } {
  if (typeof inoPath !== 'string' || extname(inoPath).toLowerCase() !== '.ino') {
    return { ok: false, error: 'Сначала сохраните скетч как файл .ino.' }
  }
  const dir = dirname(inoPath)
  if (basename(dir) !== basename(inoPath, extname(inoPath))) {
    return {
      ok: false,
      error:
        `Скетч должен лежать в папке с тем же именем, что и файл (${basename(inoPath, '.ino')}/${basename(inoPath)}). ` +
        'Используйте «Сохранить как…» — папка будет создана автоматически.'
    }
  }
  return { ok: true, dir }
}

// ---------- Разбор JSON разных версий arduino-cli ----------

type Obj = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

function parsePorts(d: Obj): PortInfo[] {
  const arr: Obj[] = Array.isArray(d) ? d : (d.detected_ports ?? [])
  return arr.map((e) => {
    const p: Obj = e.port ?? e
    return {
      address: String(p.address ?? ''),
      label: String(p.label ?? p.address ?? ''),
      protocol: String(p.protocol ?? ''),
      boards: ((e.matching_boards ?? e.boards ?? []) as Obj[]).map((b) => ({ name: String(b.name), fqbn: b.fqbn }))
    }
  }).filter((p) => p.address)
}

function parseCores(d: Obj): CoreInfo[] {
  const arr: Obj[] = Array.isArray(d) ? d : (d.platforms ?? [])
  return arr.map((p) => {
    const latest: string | undefined = p.latest_version ?? p.latest
    const rel: Obj | undefined = p.releases?.[latest ?? '']
    return {
      id: String(p.id),
      name: String(p.name ?? rel?.name ?? p.id),
      installed: p.installed_version ?? p.installed ?? undefined,
      latest
    }
  })
}

function parseLibs(d: Obj, installed: boolean): LibInfo[] {
  if (installed) {
    const arr: Obj[] = d.installed_libraries ?? (Array.isArray(d) ? d : [])
    return arr.map((e) => {
      const l: Obj = e.library ?? e
      return { name: String(l.name), version: l.version, sentence: l.sentence, latest: e.release?.version, installDir: typeof l.install_dir === 'string' ? l.install_dir : undefined }
    })
  }
  const arr: Obj[] = d.libraries ?? []
  return arr.map((l) => ({
    name: String(l.name),
    latest: l.latest?.version,
    sentence: l.latest?.sentence
  }))
}

// ---------- Регистрация IPC ----------

export function registerCliIpc(): void {
  ipcMain.handle('cli:status', async (): Promise<CliStatus> => {
    const f = findCli()
    if (!f) return statusFromPath(null)
    const r = await capture(f.path, ['version', '--format', 'json'])
    let version: string | undefined
    try {
      const j = JSON.parse(r.stdout) as Obj
      version = j.VersionString ?? j.version
    } catch { /* не критично */ }
    return statusFromPath(f, version)
  })

  ipcMain.handle('cli:boards', async (): Promise<CliResult<PortInfo[]>> => {
    const r = await json<Obj>(['board', 'list'])
    return r.ok ? { ok: true, data: parsePorts(r.data) } : r
  })

  ipcMain.handle('cli:cores', async (): Promise<CliResult<CoreInfo[]>> => {
    const r = await json<Obj>(['core', 'list'])
    return r.ok ? { ok: true, data: parseCores(r.data) } : r
  })

  ipcMain.handle('cli:core-search', async (_e, q: unknown): Promise<CliResult<CoreInfo[]>> => {
    if (!isQuery(q)) return fail('Недопустимый поисковый запрос.')
    const r = await json<Obj>(['core', 'search', ...(q.trim() ? [q.trim()] : [])])
    return r.ok ? { ok: true, data: parseCores(r.data) } : r
  })

  ipcMain.handle('cli:lib-search', async (_e, q: unknown): Promise<CliResult<LibInfo[]>> => {
    if (!isQuery(q) || !q.trim()) return fail('Введите поисковый запрос (латиница, цифры, пробел, . _ + - :).')
    const r = await json<Obj>(['lib', 'search', q.trim()])
    return r.ok ? { ok: true, data: parseLibs(r.data, false).slice(0, 100) } : r
  })

  ipcMain.handle('cli:lib-list', async (): Promise<CliResult<LibInfo[]>> => {
    const r = await json<Obj>(['lib', 'list'])
    return r.ok ? { ok: true, data: parseLibs(r.data, true) } : r
  })

  ipcMain.handle('cli:core-install', (e, id: unknown) => {
    if (!isCoreId(id)) return fail('Недопустимый идентификатор ядра (ожидается вид vendor:arch).')
    return startOp(e.sender, 'core-install', ['core', 'install', id, '--no-color'])
  })

  ipcMain.handle('cli:lib-install', (e, name: unknown) => {
    if (!isLibName(name)) return fail('Недопустимое имя библиотеки.')
    return startOp(e.sender, 'lib-install', ['lib', 'install', name as string, '--no-color'])
  })

  ipcMain.handle('cli:update-index', (e) => startOp(e.sender, 'index-update', ['core', 'update-index', '--no-color']))

  // Явное действие пользователя: прописать в конфиг arduino-cli URL пакетов ESP, затем обновить индекс
  ipcMain.handle('cli:add-esp-urls', async (e) => {
    const f = findCli()
    if (!f) return fail(INSTALL_HELP, true)
    const have = (await capture(f.path, ['config', 'dump', '--format', 'json'])).stdout
    for (const u of ESP_URLS) {
      if (!isUrl(u)) return fail('Внутренняя ошибка: некорректный URL.')
      if (have.includes(u)) continue
      const r = await capture(f.path, ['config', 'add', 'board_manager.additional_urls', u])
      if (r.code !== 0) return fail((r.stderr || r.stdout).trim())
    }
    return startOp(e.sender, 'index-update', ['core', 'update-index', '--no-color'])
  })

  ipcMain.handle('cli:core-upgrade', (e, id: unknown) => {
    if (!isCoreId(id)) return fail('Недопустимый идентификатор ядра.')
    return startOp(e.sender, 'core-install', ['core', 'upgrade', (id as string).replace(/@.*$/, ''), '--no-color'])
  })

  ipcMain.handle('cli:core-uninstall', (e, id: unknown) => {
    if (!isCoreId(id)) return fail('Недопустимый идентификатор ядра.')
    return startOp(e.sender, 'core-install', ['core', 'uninstall', (id as string).replace(/@.*$/, ''), '--no-color'])
  })

  ipcMain.handle('cli:lib-upgrade', (e, name: unknown) => {
    if (!isLibName(name)) return fail('Недопустимое имя библиотеки.')
    return startOp(e.sender, 'lib-install', ['lib', 'upgrade', (name as string).replace(/@.*$/, ''), '--no-color'])
  })

  ipcMain.handle('cli:lib-uninstall', (e, name: unknown) => {
    if (!isLibName(name)) return fail('Недопустимое имя библиотеки.')
    return startOp(e.sender, 'lib-install', ['lib', 'uninstall', (name as string).replace(/@.*$/, ''), '--no-color'])
  })

  // Все платы установленных ядер (для выбора платы)
  ipcMain.handle('cli:board-listall', async (): Promise<CliResult<BoardEntry[]>> => {
    const r = await json<Obj>(['board', 'listall'])
    if (!r.ok) return r
    const arr: Obj[] = Array.isArray(r.data) ? r.data : (r.data.boards ?? [])
    return {
      ok: true,
      data: arr
        .filter((b) => b.fqbn && !b.hidden)
        .map((b) => ({ name: String(b.name), fqbn: String(b.fqbn), platform: String(b.platform?.id ?? String(b.fqbn).split(':').slice(0, 2).join(':')) }))
    }
  })

  // Какие адреса пакетов ESP уже прописаны в конфиге arduino-cli
  ipcMain.handle('cli:esp-urls-status', async (): Promise<CliResult<EspUrlsStatus>> => {
    const f = findCli()
    if (!f) return fail(INSTALL_HELP, true)
    const out = (await capture(f.path, ['config', 'dump', '--format', 'json'])).stdout
    return { ok: true, data: { esp8266: out.includes(ESP_URLS[0]), esp32: out.includes(ESP_URLS[1]) } }
  })

  // Пользователь вручную указывает arduino-cli (путь выбирается диалогом, не приходит из renderer)
  ipcMain.handle('cli:pick-path', async (e): Promise<CliResult<string | null>> => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const r = await dialog.showOpenDialog(win!, {
      title: 'Укажите arduino-cli',
      properties: ['openFile'],
      filters: process.platform === 'win32' ? [{ name: 'arduino-cli.exe', extensions: ['exe'] }, { name: 'Все файлы', extensions: ['*'] }] : []
    })
    if (r.canceled || !r.filePaths[0]) return { ok: true, data: null }
    const chk = await capture(r.filePaths[0], ['version', '--format', 'json'])
    if (chk.code !== 0) return fail('Выбранный файл не похож на arduino-cli (команда version завершилась с ошибкой).')
    setCliPath(r.filePaths[0])
    return { ok: true, data: r.filePaths[0] }
  })

  ipcMain.handle('cli:reset-path', () => {
    setCliPath(null)
    return true
  })

  ipcMain.handle('cli:compile', (e, path: unknown, fqbn: unknown) => {
    if (!isFqbn(fqbn)) return fail('Недопустимый FQBN платы.')
    const s = sketchDir(path)
    if (!s.ok) return fail(s.error)
    return startOp(e.sender, 'compile', ['compile', '--fqbn', fqbn, '--no-color', s.dir])
  })

  ipcMain.handle('cli:upload', (e, path: unknown, fqbn: unknown, port: unknown) => {
    if (!isFqbn(fqbn)) return fail('Недопустимый FQBN платы.')
    if (!isPort(port)) return fail('Недопустимое имя порта (ожидается COMn или /dev/...).')
    const s = sketchDir(path)
    if (!s.ok) return fail(s.error)
    // compile --upload: собирает (если нужно) и прошивает за один вызов
    return startOp(e.sender, 'upload', ['compile', '--upload', '--fqbn', fqbn, '--port', port, '--no-color', s.dir])
  })

  ipcMain.handle('cli:cancel', () => {
    if (!current) return false
    current.cancelled = true
    current.abort.abort()
    if (current.child) killTree(current.child)
    return true
  })

  // ---- Монитор порта через `arduino-cli monitor` ----
  ipcMain.handle('monitor:start', (e, port: unknown, baud: unknown): CliResult<null> => {
    if (process.env['AVRIDE_SIM_MONITOR'] === '1' && isPort(port) && isBaud(baud)) {
      stopMonitor()
      startSimMonitor(e.sender)
      return { ok: true, data: null }
    }
    const f = findCli()
    if (!f) return fail(INSTALL_HELP, true)
    if (!isPort(port)) return fail('Недопустимое имя порта.')
    if (!isBaud(baud)) return fail('Недопустимая скорость порта.')
    if (current?.kind === 'upload') return fail('Идёт прошивка — порт занят.')
    stopMonitor()
    const wc = e.sender
    const child = spawn(f.path, ['monitor', '--port', port, '--config', `baudrate=${baud}`, '--quiet', '--no-color'], {
      windowsHide: true,
      shell: false
    })
    monitor = child
    child.stdout.setEncoding('utf8').on('data', (text: string) => send(wc, 'monitor:data', { text, stream: 'stdout' }))
    child.stderr.setEncoding('utf8').on('data', (text: string) => send(wc, 'monitor:data', { text, stream: 'stderr' }))
    const closed = (): void => {
      if (monitor === child) monitor = null
      send(wc, 'monitor:closed', null)
    }
    child.on('error', (err) => {
      send(wc, 'monitor:data', { text: `Не удалось запустить монитор: ${String(err)}\n`, stream: 'stderr' })
      closed()
    })
    child.on('close', closed)
    return { ok: true, data: null }
  })

  ipcMain.handle('monitor:send', (_e, text: unknown): boolean => {
    if (!monitor || typeof text !== 'string' || text.length > 4096) return false
    return monitor.stdin?.write(text) ?? false
  })

  ipcMain.handle('monitor:stop', () => {
    stopMonitor()
    return true
  })
}

export function shutdownCli(): void {
  stopMonitor()
  if (current) {
    current.abort.abort()
    if (current.child) killTree(current.child)
  }
}

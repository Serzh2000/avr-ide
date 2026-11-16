// Запуск собранного приложения Electron с изолированными данными и подключение к нему по CDP.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Cdp, Page, sleep } from './cdp.mjs'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
export const ARTIFACTS = join(ROOT, 'scripts', 'e2e', 'artifacts')
/** Готовая изолированная среда arduino-cli (ядро ESP32 + библиотеки ESPUI) */
export const ARD2 = join(tmpdir(), 'ard2')

function newestMtime(dir) {
  let m = 0
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    m = Math.max(m, e.isDirectory() ? newestMtime(p) : statSync(p).mtimeMs)
  }
  return m
}

/** Собирает приложение, если исходники новее сборки. */
export function ensureBuilt() {
  const out = join(ROOT, 'out', 'main', 'index.js')
  const stale = !existsSync(out) || newestMtime(join(ROOT, 'src')) > statSync(out).mtimeMs
    || statSync(join(ROOT, 'package.json')).mtimeMs > statSync(out).mtimeMs
  if (!stale) return false
  console.log('Сборка приложения (npm run build)…')
  const r = spawnSync('npm run build', { cwd: ROOT, shell: true, stdio: 'inherit' })
  if (r.status !== 0) throw new Error('npm run build завершился с ошибкой')
  return true
}

function freePort() {
  return new Promise((res, rej) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)) })
    s.on('error', rej)
  })
}

/** Убивает процесс и его потомков по PID (taskkill /T), только по PID. */
export function killTree(pid) {
  if (!pid) return
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
  else { try { process.kill(pid, 'SIGKILL') } catch { /* уже завершён */ } }
}

export function rmTemp(dir) {
  try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }) } catch { /* занято — не страшно */ }
}

/**
 * Запускает приложение.
 * opts.arduino: 'empty' (по умолчанию, пустые временные каталоги arduino-cli) | 'ard2' (готовая среда с ядром esp32)
 * opts.files: { 'имя/в/папке/скетчей': 'содержимое' } — заготовки проектов в папке скетчей
 * opts.projects: ['Имя', …] — какие из них показать в «Недавних»
 */
export async function launch(opts = {}) {
  const tmp = mkdtempSync(join(tmpdir(), 'avride-e2e-'))
  const userData = join(tmp, 'userData')
  const sketchbook = join(tmp, 'sketchbook')
  mkdirSync(userData, { recursive: true })
  mkdirSync(sketchbook, { recursive: true })
  // Папка скетчей в настройках приложения — временная, чтобы не писать в Documents\Arduino пользователя
  for (const [rel, content] of Object.entries(opts.files ?? {})) {
    const p = join(sketchbook, rel)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, content)
  }
  // opts.projects — имена готовых папок из files; попадают в «Недавние» на стартовом экране
  const recent = (opts.projects ?? []).map((n, i) => ({ path: join(sketchbook, n), lastOpened: Date.now() - i * 1000 }))
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ cliPath: null, sketchbookDir: sketchbook, recent }))
  const ard = opts.arduino === 'ard2'
    ? { data: join(ARD2, 'data'), user: join(ARD2, 'user'), dl: join(ARD2, 'dl') }
    : { data: join(tmp, 'ard', 'data'), user: join(tmp, 'ard', 'user'), dl: join(tmp, 'ard', 'dl') }
  if (opts.arduino !== 'ard2') for (const d of Object.values(ard)) mkdirSync(d, { recursive: true })

  const port = await freePort()
  const env = { ...process.env, AVRIDE_E2E: '1', AVRIDE_SIM_MONITOR: '1', ARDUINO_DIRECTORIES_DATA: ard.data, ARDUINO_DIRECTORIES_USER: ard.user, ARDUINO_DIRECTORIES_DOWNLOADS: ard.dl, ...(opts.env ?? {}) }
  delete env.ELECTRON_RENDERER_URL
  delete env.ELECTRON_RUN_AS_NODE
  const exe = join(ROOT, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron')
  const child = spawn(exe, [
    '.', `--remote-debugging-port=${port}`, '--remote-allow-origins=*', `--user-data-dir=${userData}`,
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'
  ], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  child.stdout.on('data', (d) => { log += d })
  child.stderr.on('data', (d) => { log += d })
  let exited = false
  child.on('exit', () => { exited = true })

  const close = async () => {
    try { cdp?.close() } catch { /* */ }
    killTree(child.pid)
    for (let i = 0; i < 20 && !exited; i++) await sleep(100)
    rmTemp(tmp)
  }

  let cdp = null
  try {
    let target = null
    const t0 = Date.now()
    while (!target) {
      if (exited) throw new Error('приложение завершилось при запуске:\n' + log.slice(-800))
      if (Date.now() - t0 > 30000) throw new Error('приложение не открыло порт отладки за 30 с')
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
        target = list.find((t) => t.type === 'page' && t.url.startsWith('file:'))
      } catch { /* ещё не готово */ }
      if (!target) await sleep(200)
    }
    cdp = await Cdp.connect(target.webSocketDebuggerUrl)
    const page = new Page(cdp)
    const consoleErrors = []
    cdp.on((m) => {
      if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)
    })
    await cdp.send('Runtime.enable')
    await cdp.send('Page.enable')
    // окно запущено без фокуса (AVRIDE_E2E): страница должна вести себя как активная
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true })
    await page.waitFor(`document.readyState === 'complete' && !!document.querySelector('#root')?.children.length`, { timeout: 20000, what: 'загрузка интерфейса' })
    return { page, cdp, tmp, sketchbook, userData, pid: child.pid, port, close, consoleErrors, log: () => log, ard }
  } catch (e) {
    await close()
    throw e
  }
}

// IPC «пакетов ядер»: поиск (cores:list), выбор папки (cores:add-folder), установка без интернета (cores:install-pack).
// Из renderer приходит только непрозрачный ключ пакета; пути выбираются диалогом ОС и ищутся в main.
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs'
import { delimiter, dirname, join, resolve } from 'path'
import { findCli, INSTALL_HELP } from '../cli/binary'
import { capture, startAsyncOp } from '../cli/ipc'
import type { CliResult } from '../cli/types'
import { urlsFromConfigDump } from '../boardsources/core'
import { packStatus } from './core'
import { installFromPack, scanRoots } from './packs'
import type { CliEnv, FoundPack, Root } from './packs'
import type { PackInfo, PacksState } from './types'

const fail = (error: string, notFound = false): { ok: false; error: string; notFound?: boolean } => ({ ok: false, error, notFound })
const KEY_RE = /^[be]:[a-z0-9][a-z0-9_-]{0,30}:[0-9A-Za-z._+-]{1,40}:[0-9a-f]{10}$/

// ---------- Где искать ----------

const foldersFile = (): string => join(app.getPath('userData'), 'core-folders.json')

function customFolders(): string[] {
  try {
    const j = JSON.parse(readFileSync(foldersFile(), 'utf8')) as { dirs?: unknown }
    return Array.isArray(j.dirs) ? j.dirs.filter((d): d is string => typeof d === 'string' && d.length < 500).slice(0, 8) : []
  } catch { return [] }
}

function saveFolders(dirs: string[]): void {
  try { writeFileSync(foldersFile(), JSON.stringify({ dirs: dirs.slice(0, 8) })) } catch { /* не критично */ }
}

function dirOk(p: string): boolean {
  try { return statSync(p).isDirectory() } catch { return false }
}

function bundledRoots(): Root[] {
  const cands = [
    join(process.resourcesPath ?? '', 'cores'),
    join(app.getAppPath(), 'build', 'cores-bundle'),
    join(process.cwd(), 'build', 'cores-bundle')
  ]
  return [...new Set(cands.map((c) => resolve(c)))].filter(dirOk).map((dir) => ({ dir, origin: 'bundled' as const }))
}

function externalDirs(): { auto: string[]; custom: string[] } {
  const auto: string[] = []
  const add = (p: string | undefined): void => {
    if (p && dirOk(p) && !auto.some((a) => resolve(a).toLowerCase() === resolve(p).toLowerCase())) auto.push(resolve(p))
  }
  const path = (n: 'downloads' | 'desktop'): string | undefined => { try { return app.getPath(n) } catch { return undefined } }
  // portable: рядом с exe, который запустил пользователь; установленная версия: рядом с папкой установки
  add(process.env['PORTABLE_EXECUTABLE_DIR'])
  if (app.isPackaged) { add(dirname(process.execPath)); add(dirname(dirname(process.execPath))) }
  add(path('downloads'))
  add(path('desktop'))
  for (const d of (process.env['AVRIDE_CORES_DIRS'] ?? '').split(delimiter)) add(d || undefined)
  return { auto, custom: customFolders().filter(dirOk) }
}

// ---------- Состояние arduino-cli ----------

type Dirs = { data?: string; downloads?: string }

async function cliEnv(cli: string): Promise<CliEnv | null> {
  const r = await capture(cli, ['config', 'dump', '--format', 'json'])
  if (r.code !== 0) return null
  try {
    const j = JSON.parse(r.stdout) as { config?: { directories?: Dirs }; directories?: Dirs }
    const d = j.config?.directories ?? j.directories
    if (!d?.data || !d.downloads) return null
    return { data: resolve(d.data), downloads: resolve(d.downloads), urls: urlsFromConfigDump(r.stdout) }
  } catch { return null }
}

async function installedCores(cli: string): Promise<Map<string, string>> {
  const m = new Map<string, string>()
  const r = await capture(cli, ['core', 'list', '--format', 'json'])
  if (r.code !== 0) return m
  try {
    type P = { id?: string; installed_version?: string; installed?: string }
    const j = JSON.parse(r.stdout) as { platforms?: P[] } | P[]
    const arr = Array.isArray(j) ? j : (j.platforms ?? [])
    for (const p of arr) {
      const v = p.installed_version ?? p.installed
      if (p.id && v) m.set(p.id, v)
    }
  } catch { /* пусто */ }
  return m
}

async function scan(): Promise<{ found: FoundPack[]; searched: string[]; custom: string[] }> {
  const ext = externalDirs()
  const roots: Root[] = [...bundledRoots(), ...[...ext.auto, ...ext.custom].map((dir) => ({ dir, origin: 'external' as const }))]
  return { found: await scanRoots(roots), searched: ext.auto, custom: ext.custom }
}

function toInfo(p: FoundPack, installed: Map<string, string>): PackInfo {
  const m = p.manifest
  if (!m) {
    return {
      key: p.key, id: 'x', title: p.archive ? 'Архив пакета ядра' : 'Пакет ядра', coreId: '', version: '', origin: 'external', where: p.dir, bytes: 0, diskNeed: 0,
      status: p.archive ? 'archive' : 'invalid',
      error: p.archive ? 'Распакуйте архив в папку (пакет читается только из папки) и нажмите «Обновить список».' : p.error
    }
  }
  const inst = installed.get(m.coreId)
  return {
    key: p.key, id: m.id, title: m.title, coreId: m.coreId, version: m.version, origin: p.origin, where: p.origin === 'bundled' ? '' : p.dir,
    bytes: m.archivesBytes, diskNeed: Math.round(m.archivesBytes * (1 + m.unpackFactor)), status: packStatus(m, inst), installedVersion: inst
  }
}

// ---------- Регистрация ----------

export function registerCoresIpc(): void {
  ipcMain.handle('cores:list', async (): Promise<CliResult<PacksState>> => {
    const cli = findCli()
    const installed = cli ? await installedCores(cli.path) : new Map<string, string>()
    const { found, searched, custom } = await scan()
    return { ok: true, data: { packs: found.map((p) => toInfo(p, installed)), searched, custom } }
  })

  // Пользователь выбирает папку, где лежит пакет ядра (или папка с пакетами); путь выбирается диалогом ОС
  ipcMain.handle('cores:add-folder', async (e): Promise<CliResult<string | null>> => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const r = await dialog.showOpenDialog(win!, { title: 'Папка с пакетом ядра (AVR-IDE-core-…)', properties: ['openDirectory'] })
    if (r.canceled || !r.filePaths[0]) return { ok: true, data: null }
    const dir = resolve(r.filePaths[0])
    if (!dirOk(dir)) return fail('Папка недоступна.')
    // допустима и сама папка пакета (с manifest.json), и папка, внутри которой лежат пакеты
    const hasManifest = existsSync(join(dir, 'manifest.json'))
    if (hasManifest && !/^AVR-IDE-core-/i.test(dir.split(/[\\/]/).pop() ?? '')) return fail('Папка пакета должна называться AVR-IDE-core-… — выберите папку целиком, не её содержимое.')
    const target = hasManifest ? dirname(dir) : dir
    const list = customFolders()
    if (!list.some((d) => resolve(d).toLowerCase() === target.toLowerCase())) list.push(target)
    saveFolders(list)
    return { ok: true, data: target }
  })

  ipcMain.handle('cores:clear-folders', () => { saveFolders([]); return true })

  ipcMain.handle('cores:install-pack', async (e, key: unknown) => {
    if (typeof key !== 'string' || !KEY_RE.test(key)) return fail('Недопустимый ключ пакета.')
    const cli = findCli()
    if (!cli) return fail(INSTALL_HELP, true)
    const { found } = await scan()
    const pack = found.find((p) => p.key === key && p.manifest)
    if (!pack) return fail('Пакет не найден (возможно, его переместили). Обновите список.')
    return startAsyncOp(e.sender, 'core-install', async (ctx) => {
      const env = await cliEnv(cli.path)
      if (!env) { ctx.log('stderr', 'Не удалось получить настройки arduino-cli.\n'); return 1 }
      env.installed = (await installedCores(cli.path)).get(pack.manifest!.coreId)
      return installFromPack(pack, {
        env,
        log: ctx.log,
        progress: (p) => ctx.emit('cores:progress', { opId: ctx.opId, label: p.label, pct: p.pct }),
        signal: ctx.signal,
        runCli: ctx.runCli
      })
    })
  })
}

// Сканирование диска: примеры ядер, встроенных и установленных библиотек. Результат кэшируется, объём ограничен.
import { readdir, readFile, stat } from 'fs/promises'
import { homedir } from 'os'
import { basename, join } from 'path'
import { findCli } from '../cli/binary'
import { capture } from '../cli/ipc'
import { compareVersions } from '../boardsources/core'
import { parseProperties } from '../libsource/props'
import { exampleLabel, parseArchitectures, pickMainIno } from './core'

export interface ExampleItem { id: string; name: string }
export interface ExampleLib {
  id: string
  name: string
  /** core — библиотека ядра платы, builtin — встроенная в arduino-cli, user — установленная пользователем */
  origin: 'core' | 'builtin' | 'user'
  /** Для библиотек ядра: vendor:arch */
  core?: string
  architectures: string[]
  version?: string
  examples: ExampleItem[]
}
export interface ExamplesList { libs: ExampleLib[]; scannedAt: number; truncated: boolean }
export interface ExamplePreview { name: string; files: { name: string; content: string; cut: boolean }[] }

const MAX_LIBS = 600
const MAX_EXAMPLES = 6000
const MAX_PER_LIB = 300
const MAX_DEPTH = 3
const CACHE_MS = 30_000
const PREVIEW_CUT = 120_000

let generation = 0
/** id → папка примера. Хранится только в main: renderer получает лишь идентификаторы. */
let registry = new Map<string, string>()
let cache: ExamplesList | null = null

export const exampleDir = (id: unknown): string | null => (typeof id === 'string' ? registry.get(id) ?? null : null)

async function isDir(p: string): Promise<boolean> {
  const s = await stat(p).catch(() => null)
  return !!s?.isDirectory()
}

async function subdirs(p: string): Promise<string[]> {
  try {
    return (await readdir(p, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && !e.isSymbolicLink() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  } catch {
    return []
  }
}

/** Папки с .ino внутри examples (до трёх уровней вложенности). */
async function findExamples(dir: string, rel: string, depth: number, out: { rel: string; abs: string }[]): Promise<void> {
  if (out.length >= MAX_PER_LIB) return
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
  if (rel && entries.some((e) => e.isFile() && e.name.toLowerCase().endsWith('.ino'))) { out.push({ rel, abs: dir }); return }
  if (depth >= MAX_DEPTH) return
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))) {
    if (!e.isDirectory() || e.isSymbolicLink() || e.name.startsWith('.')) continue
    await findExamples(join(dir, e.name), rel ? rel + '/' + e.name : e.name, depth + 1, out)
  }
}

async function cliDirs(): Promise<{ data: string; user: string }> {
  let data =
    process.platform === 'win32' ? join(process.env['LOCALAPPDATA'] ?? join(homedir(), 'AppData', 'Local'), 'Arduino15')
      : process.platform === 'darwin' ? join(homedir(), 'Library', 'Arduino15')
        : join(homedir(), '.arduino15')
  let user = join(homedir(), 'Documents', 'Arduino')
  const f = findCli()
  if (f) {
    try {
      const r = await capture(f.path, ['config', 'dump', '--format', 'json'])
      if (r.code === 0) {
        const j = JSON.parse(r.stdout) as { directories?: { data?: string; user?: string } }
        if (j.directories?.data) data = j.directories.data
        if (j.directories?.user) user = j.directories.user
      }
    } catch { /* остаются каталоги по умолчанию */ }
  }
  return { data, user }
}

export async function scanExamples(force = false): Promise<ExamplesList> {
  if (!force && cache && Date.now() - cache.scannedAt < CACHE_MS) return cache
  const gen = ++generation
  const reg = new Map<string, string>()
  let n = 0
  let truncated = false
  const libs: ExampleLib[] = []
  const dirs = await cliDirs()

  const addLib = async (libDir: string, origin: ExampleLib['origin'], core?: string): Promise<void> => {
    if (libs.length >= MAX_LIBS || n >= MAX_EXAMPLES) { truncated = true; return }
    const exDir = join(libDir, 'examples')
    if (!(await isDir(exDir))) return
    const found: { rel: string; abs: string }[] = []
    await findExamples(exDir, '', 0, found)
    if (!found.length) return
    let props: Record<string, string> = {}
    try { props = parseProperties(await readFile(join(libDir, 'library.properties'), 'utf8')) } catch { /* у библиотек ядра файла может не быть */ }
    const archs = core ? [core.split(':')[1]] : parseArchitectures(props['architectures'])
    const examples: ExampleItem[] = []
    for (const f of found) {
      if (n >= MAX_EXAMPLES) { truncated = true; break }
      const id = `g${gen}-${n++}`
      reg.set(id, f.abs)
      examples.push({ id, name: exampleLabel(f.rel) })
    }
    libs.push({
      id: `${origin}:${core ?? ''}:${basename(libDir)}`,
      name: props['name'] || basename(libDir).replace(/_/g, ' '),
      origin, core, architectures: archs, version: props['version'], examples
    })
  }

  const userLibs = join(dirs.user, 'libraries')
  for (const d of await subdirs(userLibs)) await addLib(join(userLibs, d), 'user')
  const builtin = join(dirs.data, 'libraries')
  for (const d of await subdirs(builtin)) await addLib(join(builtin, d), 'builtin')
  // библиотеки установленных ядер: берётся последняя версия
  const pk = join(dirs.data, 'packages')
  for (const vendor of await subdirs(pk)) {
    const hw = join(pk, vendor, 'hardware')
    for (const arch of await subdirs(hw)) {
      const vers = (await subdirs(join(hw, arch))).sort(compareVersions)
      const last = vers[vers.length - 1]
      if (!last) continue
      const lib = join(hw, arch, last, 'libraries')
      for (const d of await subdirs(lib)) await addLib(join(lib, d), 'core', `${vendor}:${arch}`)
    }
  }
  libs.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))
  registry = reg
  cache = { libs, scannedAt: Date.now(), truncated }
  return cache
}

/** Файлы примера для предпросмотра: главный .ino первым; только текст, с лимитами. */
export async function previewExample(dir: string): Promise<ExamplePreview> {
  const entries = (await readdir(dir, { withFileTypes: true }))
    .filter((e) => e.isFile() && /\.(ino|h|hpp|c|cpp|txt|md|json|html|css|js)$/i.test(e.name))
    .map((e) => e.name)
  const main = pickMainIno(basename(dir), entries.filter((n) => /\.ino$/i.test(n)))
  const order = [...(main ? [main] : []), ...entries.filter((n) => n !== main).sort()].slice(0, 12)
  const files: ExamplePreview['files'] = []
  for (const name of order) {
    const buf = await readFile(join(dir, name))
    if (buf.subarray(0, 4000).includes(0)) continue
    files.push({ name, content: buf.subarray(0, PREVIEW_CUT).toString('utf8').replace(/^﻿/, ''), cut: buf.length > PREVIEW_CUT })
  }
  return { name: basename(dir), files }
}

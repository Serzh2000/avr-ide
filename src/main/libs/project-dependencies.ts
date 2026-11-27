import { lstat, readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { defaultProfile, dependencyArgument, declaredDependencies, directHeaders, LIBRARY_MANIFEST, resolveDependencyPlan } from './dependencies'
import type { DependencyLibrary, DependencyPlan } from './dependencies'
import { libraryAvailability } from './resolve'
import { parseFqbn } from '../cli/fqbn'
import { isLibName } from '../cli/validate'
import { bundledLibraries } from './bundled'
import { PREFERRED_PROVIDERS } from './shadowing'

const CPP = /\.(?:ino|h|hpp|hh|hxx|c|cc|cpp|cxx)$/i
const HEADER = /\.h(?:pp|h|xx)?$/i
const MAX_FILE = 512_000
const MAX_PROJECT_BYTES = 3_000_000
const MAX_FILES = 128
const MAX_ENTRIES = 4000
// Заголовки, которые план добавляет сам (сервер для ESPUI и TCP-транспорт): их наличие тоже нужно проверить
const EXTRA_TRANSPORTS = ['ESPAsyncWebServer.h', 'AsyncTCP.h', 'ESPAsyncTCP.h', 'RPAsyncTCP.h']

let indexCache: { path: string; mtime: number; size: number; entries: DependencyLibrary[] } | undefined

async function libraryIndex(data: string): Promise<DependencyLibrary[] | null> {
  const path = join(data, 'library_index.json')
  const s = await stat(path).catch(() => null)
  if (!s?.isFile() || s.size > 128 * 1024 * 1024) return null
  if (indexCache?.path === path && indexCache.mtime === s.mtimeMs && indexCache.size === s.size) return indexCache.entries
  let source: unknown
  try { source = JSON.parse(await readFile(path, 'utf8')) } catch { return null }
  const list = (source as { libraries?: unknown })?.libraries
  if (!Array.isArray(list)) return null
  const entries: DependencyLibrary[] = list.flatMap((lib) => {
    if (!lib || !isLibName(lib.name) || lib.name.includes('@') || typeof lib.version !== 'string'
      || !isLibName(dependencyArgument({ name: lib.name, version: lib.version })) || !Array.isArray(lib.architectures)) return []
    return [{
      name: lib.name, version: lib.version,
      architectures: lib.architectures.filter((a: unknown): a is string => typeof a === 'string'),
      providesIncludes: Array.isArray(lib.providesIncludes) ? lib.providesIncludes.filter((h: unknown): h is string => typeof h === 'string') : undefined
    }]
  })
  indexCache = { path, mtime: s.mtimeMs, size: s.size, entries }
  return entries
}

async function scanProject(root: string): Promise<{ headers: string[]; local: Set<string> }> {
  const headers = new Set<string>()
  const local = new Set<string>()
  let files = 0
  let visited = 0
  let remaining = MAX_PROJECT_BYTES
  async function scan(dir: string, depth: number): Promise<void> {
    if (depth > 8 || files >= MAX_FILES) return
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (files >= MAX_FILES || ++visited > MAX_ENTRIES) break
      if (entry.name.startsWith('.')) continue
      const path = join(dir, entry.name)
      if (entry.isDirectory() && ((depth === 0 && entry.name === 'src') || depth > 0)) { await scan(path, depth + 1); continue }
      if (!entry.isFile() || !CPP.test(entry.name)) continue
      if (HEADER.test(entry.name)) local.add(entry.name.toLowerCase())
      const info = await stat(path).catch(() => null)
      if (!info?.isFile() || info.size > MAX_FILE || info.size > remaining) continue
      files++
      remaining -= info.size
      for (const header of directHeaders(await readFile(path, 'utf8'))) headers.add(header)
    }
  }
  await scan(root, 0)
  return { headers: [...headers].filter((header) => !local.has(header.toLowerCase())).slice(0, 100), local }
}

export async function planProjectDependencies(root: string, fqbn: string, user: string, data: string): Promise<DependencyPlan> {
  const readProjectFile = async (name: string): Promise<string | null> => {
    const path = join(root, name)
    const info = await lstat(path).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return null; throw e })
    if (!info) return null
    if (!info.isFile() || info.size > 128_000) throw new Error(`Не удалось безопасно прочитать ${name}.`)
    return readFile(path, 'utf8')
  }
  const yaml = await readProjectFile('sketch.yaml')
  const profile = yaml ? defaultProfile(yaml) : undefined
  if (profile) return { profile, install: [], choose: [], unknown: [], conflicts: [], needsIndex: false }
  const manifest = await readProjectFile(LIBRARY_MANIFEST)
  const declared = manifest !== null ? declaredDependencies(manifest) : []
  const { headers, local } = await scanProject(root)
  const arch = parseFqbn(fqbn)?.arch ?? ''
  if (!headers.length && !declared.length) {
    return { install: [], choose: [], unknown: [], conflicts: [], needsIndex: false }
  }
  const { availableHeaders, installed } = libraryAvailability({ userLibraryDirs: [join(user, 'libraries')], dataDirs: [data] }, fqbn, [...headers, ...EXTRA_TRANSPORTS])
  for (const h of EXTRA_TRANSPORTS) if (local.has(h.toLowerCase())) availableHeaders.add(h)
  // Заголовок от старой копии (AsyncTCP 1.x и т. п.) не считается найденным: ставим актуальную версию из пакета,
  // при сборке она закрепляется через --library (см. shadowing.ts)
  for (const [h, name] of Object.entries(PREFERRED_PROVIDERS)) {
    if (availableHeaders.has(h) && !local.has(h.toLowerCase()) && !installed.has(name.toLowerCase())) availableHeaders.delete(h)
  }
  const inputs = { headers, availableHeaders, installed, declared, arch }
  const preliminary = resolveDependencyPlan({ ...inputs, index: null })
  if (!preliminary.needsIndex) return preliminary
  const registry = await libraryIndex(data)
  const bundled = (await bundledLibraries())?.libraries ?? []
  // Встроенная версия предпочтительнее: она ставится без сети. Реестр нужен, если манифест просит другую версию.
  const pinned = (name: string): boolean => declared.some((d) => d.version && d.name.toLowerCase() === name.toLowerCase() &&
    !bundled.some((b) => b.name.toLowerCase() === name.toLowerCase() && b.version === d.version))
  const own = new Set(bundled.filter((b) => !pinned(b.name)).map((b) => b.name.toLowerCase()))
  const merged = [...(registry ?? []).filter((l) => !own.has(l.name.toLowerCase())),
    ...bundled.map(({ name, version, architectures, providesIncludes }) => ({ name, version, architectures, providesIncludes }))]
  const plan = resolveDependencyPlan({ ...inputs, index: merged, partial: !registry })
  // `lib install --zip-path` не ставит зависимости: добавляем их сами (встроенные — из пакета, остальные — из реестра).
  const have = new Set([...installed.keys(), ...plan.install.map((d) => d.name.toLowerCase())])
  const queue = plan.install.map((d) => d.name.toLowerCase())
  while (queue.length && plan.install.length < 20) {
    const current = queue.shift()
    const lib = bundled.find((b) => b.name.toLowerCase() === current)
    for (const name of lib?.depends ?? []) {
      if (have.has(name.toLowerCase())) continue
      have.add(name.toLowerCase())
      const dep = bundled.find((b) => b.name.toLowerCase() === name.toLowerCase())
      plan.install.push(dep ? { name: dep.name, version: dep.version } : { name })
      queue.push(name.toLowerCase())
    }
  }
  return plan
}

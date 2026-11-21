// Сборка индекса проекта: обход файлов, разбор по ходу включений (#include), кэш по mtime/размеру. Файловая система подаётся
// интерфейсом (BuildFs), поэтому всё проверяется юнит-тестами без Electron.
import { parseAsm, parseSource } from '../../../shared/pro/cindex/parse'
import type { IndexFile } from '../../../shared/pro/cindex/projectIndex'
import type { FileIndex } from '../../../shared/pro/cindex/types'

export interface BuildFs {
  stat(p: string): Promise<{ mtime: number; size: number } | null>
  read(p: string): Promise<string>
  list(dir: string): Promise<{ name: string; dir: boolean }[]>
}

export interface CachedFile { m: number; s: number; idx: FileIndex }
export interface CacheData { v: number; defKey: string; files: Record<string, CachedFile> }
export const CACHE_VERSION = 3

export interface BuildInput {
  /** Корень проекта (абсолютный, «/») */
  root: string
  sources: string[]
  includes: string[]
  startupFile?: string
  /** Макросы проекта: «NAME» или «NAME=значение» */
  defines: string[]
  /** Запасные папки заголовков (кэш пакета поддержки CMSIS), абсолютные */
  extraIncludeDirs?: string[]
  fs: BuildFs
  cache?: CacheData | null
  /** Несохранённые тексты открытых файлов: абсолютный путь → текст */
  overlay?: Map<string, string>
  /** Чем занят: уступать цикл событий между файлами */
  yieldFn?: () => Promise<void>
}

export interface BuildStats { files: number; parsed: number; cached: number; symbols: number; ms: number; passes: number }
export interface BuildResult { files: IndexFile[]; cache: CacheData; stats: BuildStats; ownDirs: string[] }

const SRC_EXT = /\.(c|h|cpp|hpp|cc|cxx|hh|s|inc)$/i
const ASM_EXT = /\.s$/i
const SKIP_DIRS = new Set(['build', '.git', 'node_modules', '.vscode', 'out', 'Debug', 'Release'])
const VENDOR_SEGS = new Set(['drivers', 'middlewares', 'third_party', 'thirdparty', 'vendor', 'cmsis'])
const DEVICE_HEADER = /^stm32[a-z]\d+x[a-z0-9]*\.h$/i
const MAX_FILES = 6000

export const norm = (p: string): string => p.replace(/\\/g, '/').replace(/\/+/g, '/')
const dirOf = (p: string): string => p.slice(0, Math.max(0, p.lastIndexOf('/')))
const join = (a: string, b: string): string => {
  const parts = (a.endsWith('/') ? a : a + '/') + b
  const out: string[] = []
  for (const seg of parts.split('/')) { if (seg === '..') out.pop(); else if (seg !== '.' && !(seg === '' && out.length > 0)) out.push(seg) }
  return out.join('/')
}
const sameKey = (p: string): string => (/^[A-Za-z]:/.test(p) ? p.toLowerCase() : p)

/** Файл «свой»: внутри проекта и не в папках сторонних пакетов (drivers, Middlewares, …). */
export function isOwnPath(root: string, abs: string): boolean {
  const r = sameKey(root).replace(/\/$/, '') + '/'
  const a = sameKey(abs)
  if (!a.startsWith(r)) return false
  return !a.slice(r.length).split('/').slice(0, -1).some((s) => VENDOR_SEGS.has(s.toLowerCase()))
}

async function walk(fs: BuildFs, dir: string, out: string[], depth: number): Promise<void> {
  if (depth > 10 || out.length > MAX_FILES) return
  let entries: { name: string; dir: boolean }[]
  try { entries = await fs.list(dir) } catch { return }
  for (const e of entries) {
    if (e.dir) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) await walk(fs, join(dir, e.name), out, depth + 1) }
    else if (SRC_EXT.test(e.name)) out.push(join(dir, e.name))
  }
}

/** Макросы, заданные -D: «NAME» или «NAME=значение». */
function externalDefs(defines: string[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const d of defines) { const eq = d.indexOf('='); m.set(eq < 0 ? d : d.slice(0, eq), eq < 0 ? '1' : d.slice(eq + 1)) }
  return m
}

export async function buildIndex(inp: BuildInput): Promise<BuildResult> {
  const t0 = Date.now()
  const root = norm(inp.root).replace(/\/$/, '')
  const defKey = inp.defines.join('|')
  const cacheIn = inp.cache && inp.cache.v === CACHE_VERSION && inp.cache.defKey === defKey ? inp.cache.files : {}
  const cacheOut: Record<string, CachedFile> = {}
  const projDefs = externalDefs(inp.defines)

  // 1. файлы проекта — корни обхода
  const found: string[] = []
  for (const rel of [...inp.sources, ...inp.includes]) {
    const abs = join(root, rel)
    const st = await inp.fs.stat(abs)
    if (!st) continue
    if (SRC_EXT.test(abs)) found.push(abs)
    else await walk(inp.fs, abs, found, 0)
  }
  if (inp.startupFile) found.push(join(root, inp.startupFile))
  const roots: string[] = []
  const rootSeen = new Set<string>()
  for (const f of found) {
    const k = sameKey(f)
    if (rootSeen.has(k)) continue
    rootSeen.add(k)
    if (DEVICE_HEADER.test(f.slice(f.lastIndexOf('/') + 1)) || !isOwnPath(root, f)) {
      if (!(inp.startupFile && k === sameKey(join(root, inp.startupFile)))) continue
    }
    roots.push(f)
  }
  roots.sort()
  // 2. папки заголовков
  const incDirs = inp.includes.map((i) => join(root, i))
  const dirs = [...incDirs, ...(inp.extraIncludeDirs ?? []).map(norm)]

  const existsCache = new Map<string, boolean>()
  const exists = async (p: string): Promise<boolean> => {
    const k = sameKey(p)
    const c = existsCache.get(k)
    if (c !== undefined) return c
    const ok = !!(await inp.fs.stat(p))
    existsCache.set(k, ok)
    return ok
  }
  const resolveInc = async (name: string, sys: boolean, from: string): Promise<string | null> => {
    if (!sys) { const p = join(dirOf(from), name); if (await exists(p)) return p }
    for (const d of dirs) { const p = join(d, name); if (await exists(p)) return p }
    return null
  }

  // 3. разбор по проходам: макросы из одних файлов влияют на условия в других
  const G = new Map<string, { f: string; v: string }>()
  for (const [k, v] of projDefs) G.set(k, { f: '', v })
  interface Entry { path: string; m: number; s: number; idx: FileIndex }
  let entries = new Map<string, Entry>()
  let parsed = 0
  let cachedHits = 0
  const parseOne = async (path: string, prevCache: boolean): Promise<Entry | null> => {
    const st = await inp.fs.stat(path)
    if (!st) return null
    const ov = inp.overlay?.get(sameKey(path))
    const ext = (name: string): string | undefined => { const g = G.get(name); return g && g.f !== path ? g.v : undefined }
    const ck = cacheIn[sameKey(path)]
    if (ov === undefined && prevCache && ck && ck.m === st.mtime && ck.s === st.size && ck.idx.free.every(([n, v]) => (ext(n) ?? null) === v)) { cachedHits++; return { path, m: st.mtime, s: st.size, idx: ck.idx } }
    const text = ov ?? (await inp.fs.read(path))
    const idx = ASM_EXT.test(path) ? parseAsm(text) : parseSource(text, { defines: [], ext, cpp: /\.(cpp|hpp|cc|cxx|hh)$/i.test(path) })
    parsed++
    if (inp.yieldFn) await inp.yieldFn()
    return { path, m: st.mtime, s: st.size, idx }
  }

  let passes = 0
  let order: string[] = []
  for (; passes < 4; passes++) {
    const prev = entries
    entries = new Map()
    order = []
    const queue = [...roots]
    const seen = new Set<string>()
    let changed = false
    const addMacros = (e: Entry): void => {
      for (const s of e.idx.syms) if (s.k === 'macro' && !G.has(s.n)) G.set(s.n, { f: e.path, v: s.a ? '(' + (s.v ?? '') + ')' : s.v ?? '' })
    }
    while (queue.length) {
      const p = queue.shift()!
      const k = sameKey(p)
      if (seen.has(k)) continue
      seen.add(k)
      let e: Entry | null | undefined = prev.get(k)
      if (e) {
        // условия файла могли измениться из-за макросов, найденных позже
        const ext = (name: string): string | undefined => { const g = G.get(name); return g && g.f !== p ? g.v : undefined }
        const st = await inp.fs.stat(p)
        const ov = inp.overlay?.get(k)
        if (!st || ov !== undefined || st.mtime !== e.m || !e.idx.free.every(([n, v]) => (ext(n) ?? null) === v)) { e = await parseOne(p, false); changed = true }
      } else {
        e = await parseOne(p, true)
        if (passes > 0) changed = true
      }
      if (!e) continue
      entries.set(k, e)
      order.push(p)
      addMacros(e)
      for (const inc of e.idx.includes) {
        const r = await resolveInc(inc.name, inc.sys, p)
        if (r && !seen.has(sameKey(r))) queue.push(r)
      }
      if (order.length > MAX_FILES) break
    }
    if (!changed && passes >= 1) { passes++; break }
  }

  const files: IndexFile[] = []
  for (const p of order) {
    const e = entries.get(sameKey(p))!
    files.push({ path: p, own: isOwnPath(root, p), idx: e.idx })
    cacheOut[sameKey(p)] = { m: e.m, s: e.s, idx: e.idx }
  }
  let symbols = 0
  for (const f of files) symbols += f.idx.syms.length
  return { files, cache: { v: CACHE_VERSION, defKey, files: cacheOut }, ownDirs: incDirs, stats: { files: files.length, parsed, cached: cachedHits, symbols, ms: Date.now() - t0, passes } }
}

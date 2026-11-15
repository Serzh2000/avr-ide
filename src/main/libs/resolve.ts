// Сопоставление #include скетча с установленными библиотеками и разбор их заголовков.
// Только fs/path/os: без electron — чтобы проверять на реальных библиотеках из node.
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { basename, dirname, join, relative, sep } from 'path'
import { extractIncludes, parseHeader } from './parse-header'
import type { LibExample, LibSymbol, ProjectLibrary } from './types'

export const LIMITS = {
  /** Сколько заголовков одной библиотеки разбираем. */
  headersPerLib: 40,
  /** Глубина транзитивных include внутри библиотеки. */
  includeDepth: 2,
  symbolsPerLib: 8000,
  symbolsTotal: 30000,
  libsPerSketch: 60,
  examplesPerLib: 80,
  headerMaxBytes: 700_000,
  headerMaxMs: 1500,
  /** Общий бюджет времени на один запрос (мс): после него остальные библиотеки пропускаются с предупреждением. */
  requestMs: 6000
}

const HEADER_RE = /\.(h|hpp|hh|hxx)$/i
const SKIP_DIRS = new Set(['examples', 'example', 'test', 'tests', 'docs', 'doc', 'extras', '.git', '.github', 'node_modules', 'tools', 'data', 'pio_examples', 'img', 'lang', 'scripts', 'build'])

export interface Roots {
  /** Папки, в которых лежат папки библиотек пользователя (Documents/Arduino/libraries и т.п.). */
  userLibraryDirs: string[]
  /** Папки данных Arduino15 (packages/…). */
  dataDirs: string[]
}

export function defaultRoots(documentsDir?: string): Roots {
  const home = homedir()
  const docs = documentsDir || join(home, 'Documents')
  const userLibraryDirs = [join(docs, 'Arduino', 'libraries'), join(home, 'Arduino', 'libraries')]
  const dataDirs: string[] = []
  if (process.platform === 'win32') {
    if (process.env.LOCALAPPDATA) dataDirs.push(join(process.env.LOCALAPPDATA, 'Arduino15'))
    dataDirs.push(join(home, 'AppData', 'Local', 'Arduino15'))
  } else if (process.platform === 'darwin') dataDirs.push(join(home, 'Library', 'Arduino15'))
  else dataDirs.push(join(home, '.arduino15'), join(home, '.var', 'app', 'cc.arduino.IDE2', 'Arduino15'))
  return { userLibraryDirs, dataDirs }
}

// ---------------------------------------------------------------------------------------------
// Каталог библиотек
// ---------------------------------------------------------------------------------------------

export interface CatalogEntry {
  dir: string
  folder: string
  name: string
  version?: string
  author?: string
  sentence?: string
  architectures: string[]
  /** Корень, относительно которого записаны include (src для recursive-раскладки, иначе папка библиотеки). */
  includeRoot: string
  location: 'user' | 'platform'
  /** vendor:arch для библиотек ядра. */
  platform?: string
  /** Заголовки: относительный (от includeRoot) путь с / → оригинальное написание. */
  headers?: Map<string, string>
  headersLower?: Map<string, string>
  examples?: LibExample[]
}

export function parseProperties(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^﻿/, '').trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
  return out
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}
function mtimeOf(p: string): number {
  try {
    return statSync(p).mtimeMs
  } catch {
    return 0
  }
}
function safeReaddir(p: string): string[] {
  try {
    return readdirSync(p)
  } catch {
    return []
  }
}

function semverCmp(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((x) => parseInt(x, 10) || 0)
  const pb = b.split(/[.-]/).map((x) => parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return a.localeCompare(b)
}

function readEntry(dir: string, location: CatalogEntry['location'], platform?: string): CatalogEntry | null {
  const folder = basename(dir)
  let props: Record<string, string> = {}
  const pf = join(dir, 'library.properties')
  if (existsSync(pf)) {
    try {
      props = parseProperties(readFileSync(pf, 'utf8'))
    } catch {
      /* без свойств */
    }
  }
  const src = join(dir, 'src')
  const includeRoot = isDir(src) ? src : dir
  // без src и без заголовков в корне — не библиотека
  if (includeRoot === dir && !safeReaddir(dir).some((f) => HEADER_RE.test(f)) && !existsSync(pf)) return null
  return {
    dir,
    folder,
    name: props.name || folder.replace(/_/g, ' '),
    version: props.version,
    author: props.author?.replace(/\s*<[^>]*>/g, ''),
    sentence: props.sentence,
    architectures: (props.architectures || '*').split(',').map((s) => s.trim()).filter(Boolean),
    includeRoot,
    location,
    platform
  }
}

export interface Catalog {
  signature: string
  entries: CatalogEntry[]
}

function listLibraryDirs(roots: Roots, platformFilter: Set<string> | null): { dir: string; location: CatalogEntry['location']; platform?: string }[] {
  const out: { dir: string; location: CatalogEntry['location']; platform?: string }[] = []
  const seen = new Set<string>()
  for (const root of roots.userLibraryDirs) {
    for (const f of safeReaddir(root)) {
      const d = join(root, f)
      if (seen.has(d.toLowerCase()) || !isDir(d)) continue
      seen.add(d.toLowerCase())
      out.push({ dir: d, location: 'user' })
    }
  }
  for (const data of roots.dataDirs) {
    const pk = join(data, 'packages')
    for (const vendor of safeReaddir(pk)) {
      const hw = join(pk, vendor, 'hardware')
      for (const arch of safeReaddir(hw)) {
        const key = `${vendor}:${arch}`
        if (platformFilter && !platformFilter.has(key)) continue
        const archDir = join(hw, arch)
        if (!isDir(archDir)) continue
        const versions = safeReaddir(archDir).filter((v) => isDir(join(archDir, v))).sort(semverCmp)
        const ver = versions[versions.length - 1]
        // ядра, установленные «вручную» без папки версии
        const base = ver && isDir(join(archDir, ver, 'libraries')) ? join(archDir, ver) : isDir(join(archDir, 'libraries')) ? archDir : null
        if (!base) continue
        for (const f of safeReaddir(join(base, 'libraries'))) {
          const d = join(base, 'libraries', f)
          if (isDir(d)) out.push({ dir: d, location: 'platform', platform: key })
        }
      }
    }
  }
  return out
}

/** Дешёвая подпись состояния диска: имена папок и mtime каталога/library.properties. */
export function catalogSignature(roots: Roots, platformFilter: Set<string> | null): string {
  const parts: string[] = []
  for (const l of listLibraryDirs(roots, platformFilter)) parts.push(`${l.dir}@${mtimeOf(l.dir)}@${mtimeOf(join(l.dir, 'library.properties'))}`)
  return parts.join('|')
}

export function buildCatalog(roots: Roots, platformFilter: Set<string> | null): Catalog {
  const entries: CatalogEntry[] = []
  const sigParts: string[] = []
  for (const l of listLibraryDirs(roots, platformFilter)) {
    sigParts.push(`${l.dir}@${mtimeOf(l.dir)}@${mtimeOf(join(l.dir, 'library.properties'))}`)
    const e = readEntry(l.dir, l.location, l.platform)
    if (e) entries.push(e)
  }
  return { signature: sigParts.join('|'), entries }
}

/** Заголовки библиотеки (лениво): относительный путь от includeRoot. */
function ensureHeaders(e: CatalogEntry): void {
  if (e.headers) return
  const map = new Map<string, string>()
  const lower = new Map<string, string>()
  let count = 0
  const walk = (dir: string, rel: string, depth: number): void => {
    if (depth > 4 || count > 3000) return
    for (const f of safeReaddir(dir)) {
      const full = join(dir, f)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        if (SKIP_DIRS.has(f.toLowerCase()) || f.startsWith('.')) continue
        walk(full, rel ? `${rel}/${f}` : f, depth + 1)
      } else if (HEADER_RE.test(f)) {
        const r = rel ? `${rel}/${f}` : f
        map.set(r, r)
        lower.set(r.toLowerCase(), r)
        count++
      }
    }
  }
  walk(e.includeRoot, '', 0)
  e.headers = map
  e.headersLower = lower
}

function ensureExamples(e: CatalogEntry): LibExample[] {
  if (e.examples) return e.examples
  const out: LibExample[] = []
  const root = join(e.dir, 'examples')
  const walk = (dir: string, depth: number): void => {
    if (depth > 3 || out.length >= LIMITS.examplesPerLib) return
    const names = safeReaddir(dir)
    const ino = names.find((n) => /\.(ino|pde)$/i.test(n) && n.toLowerCase().replace(/\.(ino|pde)$/, '') === basename(dir).toLowerCase()) ?? names.find((n) => /\.(ino|pde)$/i.test(n))
    if (ino && dir !== root) out.push({ name: relative(root, dir).split(sep).join('/'), path: join(dir, ino) })
    for (const n of names) {
      if (out.length >= LIMITS.examplesPerLib) return
      const d = join(dir, n)
      if (!n.startsWith('.') && isDir(d)) walk(d, depth + 1)
    }
  }
  if (isDir(root)) walk(root, 0)
  e.examples = out
  return out
}

// ---------------------------------------------------------------------------------------------
// Разбор заголовков с кэшем по пути и mtime
// ---------------------------------------------------------------------------------------------

interface ParsedFile {
  mtime: number
  size: number
  symbols: LibSymbol[]
  includes: { name: string; angle: boolean }[]
  warnings: string[]
}
const parseCache = new Map<string, ParsedFile>()
const PARSE_CACHE_MAX = 600

function parseFileCached(abs: string, relHeader: string): ParsedFile | null {
  let st
  try {
    st = statSync(abs)
  } catch {
    return null
  }
  const key = abs + '\u0000' + relHeader
  const hit = parseCache.get(key)
  if (hit && hit.mtime === st.mtimeMs && hit.size === st.size) return hit
  let text: string
  try {
    if (st.size > LIMITS.headerMaxBytes * 4) {
      return { mtime: st.mtimeMs, size: st.size, symbols: [], includes: [], warnings: [`${relHeader}: файл слишком большой (${Math.round(st.size / 1024)} КБ), пропущен`] }
    }
    text = readFileSync(abs, 'utf8')
  } catch {
    return null
  }
  const r = parseHeader(text, { header: relHeader, maxBytes: LIMITS.headerMaxBytes, maxMs: LIMITS.headerMaxMs })
  const rec: ParsedFile = { mtime: st.mtimeMs, size: st.size, symbols: r.symbols, includes: r.includes, warnings: r.warnings }
  if (parseCache.size >= PARSE_CACHE_MAX) parseCache.delete(parseCache.keys().next().value as string)
  parseCache.set(key, rec)
  return rec
}

// ---------------------------------------------------------------------------------------------
// Выбор библиотеки для include
// ---------------------------------------------------------------------------------------------

export interface ResolveOptions {
  fqbn?: string | null
  roots?: Roots
  documentsDir?: string
  /** Доп. папки библиотек пользователя (из arduino-cli). */
  extraUserDirs?: string[]
  extraDataDirs?: string[]
}

function fqbnPlatform(fqbn?: string | null): { key: string; arch: string } | null {
  if (!fqbn) return null
  const m = /^([\w.-]+):([\w.-]+)/.exec(fqbn)
  return m ? { key: `${m[1]}:${m[2]}`, arch: m[2] } : null
}

/** Архитектура по тексту include, если плата не выбрана. */
export function guessArch(includeNames: string[]): string | null {
  const names = includeNames.map((n) => n.toLowerCase())
  if (names.some((n) => /^(esp8266wifi|esp8266webserver|esp8266httpclient|esp8266mdns|esp8266wifimulti|esp8266httpupdateserver|espasynctcp|espasyncudp|esp8266ping|esp8266netbios)\.h$/.test(n))) return 'esp8266'
  if (names.some((n) => /^(avr\/|softwareserial|usbapi)/.test(n))) return 'avr'
  return null
}

function archOk(e: CatalogEntry, arch: string | null): boolean {
  if (!arch) return true
  return e.architectures.includes('*') || e.architectures.some((a) => a.toLowerCase() === arch.toLowerCase())
}

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function findHeader(e: CatalogEntry, name: string): string | null {
  ensureHeaders(e)
  const n = name.replace(/\\/g, '/').replace(/^\.\//, '')
  if (e.headers!.has(n)) return n
  const low = e.headersLower!.get(n.toLowerCase())
  return low ?? null
}

interface Match {
  entry: CatalogEntry
  header: string
  includeName: string
  compatible: boolean
}

function pickEntry(includeName: string, entries: CatalogEntry[], arch: string | null): Match | null {
  const base = normName(includeName.replace(/\.[^.]+$/, '').split('/').pop() ?? includeName)
  let best: { m: Match; score: number } | null = null
  for (const e of entries) {
    const h = findHeader(e, includeName)
    if (!h) continue
    const compatible = archOk(e, arch)
    let score = 0
    if (compatible) score += 100
    if (normName(e.folder) === base || normName(e.name) === base) score += 20
    else if (normName(e.folder).startsWith(base) || base.startsWith(normName(e.folder))) score += 6
    if (e.location === 'user') score += 2
    else score += 1
    // заголовок лежит в корне include — предпочтительнее вложенного
    if (!includeName.includes('/') && !h.includes('/')) score += 1
    if (!best || score > best.score) best = { m: { entry: e, header: h, includeName, compatible }, score }
  }
  return best ? best.m : null
}

// ---------------------------------------------------------------------------------------------
// Кэши запросов
// ---------------------------------------------------------------------------------------------

interface CatalogCache {
  key: string
  checkedAt: number
  signature: string
  catalog: Catalog
}
const catalogCaches = new Map<string, CatalogCache>()
const resultCache = new Map<string, ProjectLibrary[]>()
const SIG_RECHECK_MS = 2000

function getCatalog(roots: Roots, platformFilter: Set<string> | null): Catalog {
  const key = JSON.stringify([roots, platformFilter ? [...platformFilter].sort() : null])
  const now = Date.now()
  const hit = catalogCaches.get(key)
  if (hit && now - hit.checkedAt < SIG_RECHECK_MS) return hit.catalog
  const sig = catalogSignature(roots, platformFilter)
  if (hit && hit.signature === sig) {
    hit.checkedAt = now
    return hit.catalog
  }
  const catalog = buildCatalog(roots, platformFilter)
  catalogCaches.set(key, { key, checkedAt: now, signature: sig, catalog })
  return catalog
}

/** Сбросить все кэши (например, после установки библиотеки). */
export function resetLibCaches(): void {
  catalogCaches.clear()
  resultCache.clear()
  parseCache.clear()
}

function libraryFor(entry: CatalogEntry, matches: Match[], deadline: number): ProjectLibrary {
  ensureHeaders(entry)
  const warnings: string[] = []
  const symbols: LibSymbol[] = []
  const seenSym = new Set<string>()
  const parsedHeaders: string[] = []
  const queue: { rel: string; depth: number }[] = matches.map((m) => ({ rel: m.header, depth: 0 }))
  const seen = new Set<string>()
  const relToLib = (rel: string): string => relative(entry.dir, join(entry.includeRoot, rel)).split(sep).join('/')
  let hdrCount = 0
  while (queue.length) {
    const { rel, depth } = queue.shift()!
    if (seen.has(rel.toLowerCase())) continue
    seen.add(rel.toLowerCase())
    if (hdrCount >= LIMITS.headersPerLib) {
      warnings.push(`разобрано ${LIMITS.headersPerLib} заголовков, остальные пропущены`)
      break
    }
    if (Date.now() > deadline) {
      warnings.push('превышен бюджет времени, часть заголовков пропущена')
      break
    }
    hdrCount++
    const abs = join(entry.includeRoot, rel)
    const libRel = relToLib(rel)
    const parsed = parseFileCached(abs, libRel)
    if (!parsed) {
      warnings.push(`${libRel}: не удалось прочитать`)
      continue
    }
    parsedHeaders.push(libRel)
    for (const w of parsed.warnings) if (warnings.length < 8) warnings.push(w)
    for (const s of parsed.symbols) {
      const key = `${s.kind}|${s.owner ?? ''}|${s.signature}`
      if (seenSym.has(key)) continue
      seenSym.add(key)
      symbols.push(s)
      if (symbols.length >= LIMITS.symbolsPerLib) break
    }
    if (symbols.length >= LIMITS.symbolsPerLib) {
      warnings.push(`лимит ${LIMITS.symbolsPerLib} символов на библиотеку`)
      break
    }
    if (depth < LIMITS.includeDepth) {
      for (const inc of parsed.includes) {
        // сначала рядом с текущим файлом, затем от корня include
        const near = dirname(rel) === '.' ? inc.name : `${dirname(rel).split(sep).join('/')}/${inc.name}`
        const norm = (p: string): string => {
          const out: string[] = []
          for (const part of p.split('/')) {
            if (part === '..') out.pop()
            else if (part !== '.') out.push(part)
          }
          return out.join('/')
        }
        let found: string | null = null
        for (const cand of [...(inc.angle ? [] : [norm(near)]), inc.name]) {
          const h = findHeader(entry, cand)
          if (h) {
            found = h
            break
          }
        }
        if (found && !seen.has(found.toLowerCase())) queue.push({ rel: found, depth: depth + 1 })
      }
    }
  }
  return {
    name: entry.name,
    version: entry.version,
    author: entry.author,
    sentence: entry.sentence,
    path: entry.dir,
    matchedIncludes: [...new Set(matches.map((m) => m.includeName))],
    headers: parsedHeaders,
    symbols,
    examples: ensureExamples(entry),
    warnings: warnings.length ? warnings : undefined
  }
}

/**
 * Библиотеки, подключённые в скетче. Источники — только тексты #include и установленные библиотеки на диске.
 * Принимает как исходный текст (code), так и заранее извлечённые имена (includes).
 */
export async function resolveLibraries(code: string, options: ResolveOptions = {}): Promise<ProjectLibrary[]> {
  const base = options.roots ?? defaultRoots(options.documentsDir)
  const roots: Roots = {
    userLibraryDirs: [...new Set([...base.userLibraryDirs, ...(options.extraUserDirs ?? [])])],
    dataDirs: [...new Set([...base.dataDirs, ...(options.extraDataDirs ?? [])])]
  }
  const incs = extractIncludes(typeof code === 'string' ? code : '')
  if (incs.length === 0) return []
  const fq = fqbnPlatform(options.fqbn)
  const arch = fq?.arch ?? guessArch(incs.map((i) => i.name))
  // библиотеки ядра: выбранная плата; без платы — все установленные, но совместимость решает arch
  const platformFilter = fq ? new Set([fq.key]) : null
  const catalog = getCatalog(roots, platformFilter)
  const cacheKey = `${catalog.signature.length}:${hash(catalog.signature)}|${options.fqbn ?? ''}|${arch ?? ''}|${incs.map((i) => i.name).join(',')}`
  const cached = resultCache.get(cacheKey)
  if (cached) return cached
  const flying = inflight.get(cacheKey)
  if (flying) return flying
  const p = computeLibraries(cacheKey, incs, options, fq, arch, catalog)
  inflight.set(cacheKey, p)
  try {
    return await p
  } finally {
    inflight.delete(cacheKey)
  }
}

const inflight = new Map<string, Promise<ProjectLibrary[]>>()
const yieldLoop = (): Promise<void> => new Promise((r) => setImmediate(r))

async function computeLibraries(cacheKey: string, incs: { name: string; angle: boolean }[], options: ResolveOptions, fq: { key: string; arch: string } | null, arch: string | null, catalog: Catalog): Promise<ProjectLibrary[]> {

  const deadline = Date.now() + LIMITS.requestMs
  // без платы: библиотеки ядер подходящей архитектуры (WiFi есть и в esp32, и в esp8266)
  let entries = catalog.entries
  if (!fq) {
    const platforms = new Set(entries.filter((e) => e.platform).map((e) => e.platform!))
    const want = arch ? [...platforms].filter((p) => p.split(':')[1] === arch) : [...platforms].filter((p) => p.split(':')[1] === 'esp32')
    const keep = new Set(want.length ? want : [...platforms])
    entries = entries.filter((e) => !e.platform || keep.has(e.platform))
  }
  const byDir = new Map<string, { entry: CatalogEntry; matches: Match[]; order: number }>()
  incs.forEach((inc, idx) => {
    const m = pickEntry(inc.name, entries, arch)
    if (!m) return
    const k = m.entry.dir
    const rec = byDir.get(k)
    if (rec) rec.matches.push(m)
    else byDir.set(k, { entry: m.entry, matches: [m], order: idx })
  })
  const result: ProjectLibrary[] = []
  let total = 0
  for (const rec of [...byDir.values()].sort((a, b) => a.order - b.order).slice(0, LIMITS.libsPerSketch)) {
    if (total >= LIMITS.symbolsTotal) break
    await yieldLoop()
    const lib = libraryFor(rec.entry, rec.matches, deadline)
    if (rec.matches.some((m) => !m.compatible)) {
      lib.warnings = [...(lib.warnings ?? []), `библиотека рассчитана на архитектуры: ${rec.entry.architectures.join(', ')}; для выбранной платы может не подойти`]
    }
    total += lib.symbols.length
    result.push(lib)
  }
  if (resultCache.size >= 24) resultCache.delete(resultCache.keys().next().value as string)
  resultCache.set(cacheKey, result)
  return result
}

function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return h
}

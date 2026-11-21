// Служба индекса символов Pro-режима: хранит индекс открытого проекта в памяти, кэш на диске (userData/pro/index), принимает несохранённые
// тексты открытых файлов и отвечает на запросы редактора. Разбор идёт в main по файлам с уступкой цикла событий между файлами (UI не блокируется).
import { createHash } from 'crypto'
import { app, ipcMain } from 'electron'
import { execFile } from 'child_process'
import { statSync } from 'fs'
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { ProjectIndex } from '../../../shared/pro/cindex/projectIndex'
import { parseAsm, parseSource } from '../../../shared/pro/cindex/parse'
import { guard, needRoot, UserError } from '../../files/ipc'
import type { ProProject } from '../project/types'
import { proDataDir, supportDir } from '../paths'
import { chipRecordForProject } from '../support/support'
import { SUPPORT_CORES, SUPPORT_DEVICES } from '../support/manifest'
import { locateTool } from '../tools/config'
import { spawnSpec } from '../tools/find'
import { buildIndex, norm } from './builder'
import type { BuildFs, CacheData } from './builder'
import { completion, definitions, hover, references, renamePlan, signature, symLoc } from './queries'
import type { TextSource } from './queries'
import type { CursorReq, FormatResult, IndexStatus } from './types'

const nodeFs: BuildFs = {
  async stat(p) { try { const s = await stat(p); return s.isFile() ? { mtime: s.mtimeMs, size: s.size } : s.isDirectory() ? { mtime: s.mtimeMs, size: 0 } : null } catch { return null } },
  read: (p) => readFile(p, 'utf8').then((t) => t.replace(/^﻿/, '')),
  async list(d) { return (await readdir(d, { withFileTypes: true })).map((e) => ({ name: e.name, dir: e.isDirectory() })) }
}

const yieldLoop = (): Promise<void> => new Promise((r) => setImmediate(r))
const keyOf = (p: string): string => (/^[A-Za-z]:/.test(p) ? p.toLowerCase() : p)

type ReadProject = (root: string) => Promise<{ found: false } | { found: true; ok: true; project: ProProject } | { found: true; ok: false; error: string }>

/** Папки заголовков из кэша пакета поддержки CMSIS (запасной вариант, пока файлы ещё не скопированы в проект). */
export function supportIncludeDirs(project: ProProject): string[] {
  const rec = chipRecordForProject(project)
  if (!rec) return []
  const out: string[] = []
  const dev = SUPPORT_DEVICES[rec.files.cmsisRepo]
  if (dev) out.push(norm(join(supportDir(), `${dev.repo}@${dev.tag}`, 'Include')))
  const core = SUPPORT_CORES[rec.core.toLowerCase().replace('+', 'plus')]
  if (core) out.push(norm(join(supportDir(), `${core.repo}@${core.tag}`, 'Core', 'Include')))
  return out
}

interface State {
  root: string
  ix: ProjectIndex
  overlay: Map<string, string>
  status: IndexStatus
  cache: CacheData | null
  building: Promise<IndexStatus> | null
  defKey: string
  includesSig: Map<string, string>
  rebuildTimer: NodeJS.Timeout | null
  lastCheck: number
  project: ProProject | null
  configuration: string
  saveTimer: NodeJS.Timeout | null
}

let st: State | null = null

const cacheFile = (root: string): string => join(proDataDir(), 'index', createHash('sha1').update(keyOf(norm(root))).digest('hex').slice(0, 14) + '.json')

async function loadCache(root: string): Promise<CacheData | null> {
  try { return JSON.parse(await readFile(cacheFile(root), 'utf8')) as CacheData } catch { return null }
}

async function saveCache(root: string, data: CacheData): Promise<void> {
  try {
    const f = cacheFile(root)
    await mkdir(join(proDataDir(), 'index'), { recursive: true })
    const tmp = f + '.tmp'
    await writeFile(tmp, JSON.stringify(data), 'utf8')
    await rename(tmp, f)
  } catch { /* кэш — только ускорение */ }
}

function definesOf(project: ProProject, configuration: string): string[] {
  const rec = chipRecordForProject(project)
  const cfg = project.configurations[configuration] ?? project.configurations.Debug
  const out: string[] = []
  for (const d of [...(rec?.files.define ? [rec.files.define] : []), ...project.defines, ...(cfg?.defines ?? [])]) if (d && !out.includes(d)) out.push(d)
  return out
}

function emptyStatus(root: string): IndexStatus { return { root, ready: false, building: false, files: 0, symbols: 0, parsed: 0, cached: 0, ms: 0 } }

export async function ensureIndex(readProject: ReadProject, opts: { configuration?: string; force?: boolean } = {}): Promise<IndexStatus> {
  const root = norm(needRoot())
  if (!st || st.root !== root) {
    st = { root, ix: new ProjectIndex(), overlay: new Map(), status: emptyStatus(root), cache: null, building: null, defKey: '', includesSig: new Map(), rebuildTimer: null, lastCheck: 0, project: null, configuration: 'Debug', saveTimer: null }
  }
  const s = st
  if (s.building) return s.building
  const cfg = opts.configuration ?? s.configuration
  // повторная проверка чаще раза в 1.5 с не нужна (если не принудительно)
  if (!opts.force && s.status.ready && cfg === s.configuration && Date.now() - s.lastCheck < 1500) return s.status
  s.building = (async () => {
    try {
      const pr = await readProject(root)
      if (!pr.found || !pr.ok) { s.status = { ...emptyStatus(root), error: !pr.found ? 'Нет avride.project.json.' : pr.error }; return s.status }
      s.project = pr.project
      s.configuration = cfg
      const defines = definesOf(pr.project, cfg)
      if (!s.cache) s.cache = await loadCache(root)
      s.status = { ...s.status, building: true }
      const r = await buildIndex({
        root, sources: pr.project.sources, includes: pr.project.includes, startupFile: pr.project.startupFile, defines,
        extraIncludeDirs: supportIncludeDirs(pr.project), fs: nodeFs, cache: s.cache,
        overlay: new Map([...s.overlay].map(([k, v]) => [keyOf(k), v])), yieldFn: yieldLoop
      })
      s.ix.build(r.files)
      s.defKey = defines.join('|')
      s.cache = r.cache
      s.includesSig = new Map(r.files.map((f) => [keyOf(f.path), f.idx.includes.map((i) => i.name).join(',')]))
      s.status = { root, ready: true, building: false, files: r.stats.files, symbols: r.stats.symbols, parsed: r.stats.parsed, cached: r.stats.cached, ms: r.stats.ms }
      s.lastCheck = Date.now()
      if (r.stats.parsed > 0) {
        if (s.saveTimer) clearTimeout(s.saveTimer)
        s.saveTimer = setTimeout(() => { if (s.cache) void saveCache(root, s.cache) }, 800)
      }
      return s.status
    } catch (e) {
      s.status = { ...emptyStatus(root), error: String((e as Error)?.message ?? e) }
      return s.status
    } finally {
      s.building = null
    }
  })()
  return s.building
}

/** Несохранённый текст открытого файла: перечитывает только его, при смене #include просит пересобрать индекс. */
function setOverlay(readProject: ReadProject, path: string, text: string): void {
  const s = st
  if (!s) return
  const p = norm(path)
  s.overlay.set(keyOf(p), text)
  const fi = s.ix.files.findIndex((f) => keyOf(f.path) === keyOf(p))
  if (fi < 0) { scheduleRebuild(readProject); return }
  const ext = (name: string): string | undefined => {
    for (const x of s.ix.lookup(name)) if (x.k === 'macro' && !x.a && s.ix.files[x.f!]?.path !== p) return x.v ?? ''
    return undefined
  }
  const idx = /\.s$/i.test(p) ? parseAsm(text) : parseSource(text, { ext, cpp: /\.(cpp|hpp|cc|cxx|hh)$/i.test(p) })
  const incSig = idx.includes.map((i) => i.name).join(',')
  s.ix.replaceFile(fi, idx)
  if (s.includesSig.get(keyOf(p)) !== incSig) { s.includesSig.set(keyOf(p), incSig); scheduleRebuild(readProject) }
}

function scheduleRebuild(readProject: ReadProject): void {
  const s = st
  if (!s) return
  if (s.rebuildTimer) clearTimeout(s.rebuildTimer)
  s.rebuildTimer = setTimeout(() => { s.rebuildTimer = null; void ensureIndex(readProject, { force: true }) }, 600)
}

function textSource(s: State): TextSource {
  return {
    all: () => s.ix.files.map((f) => ({ path: f.path, own: f.own })),
    read: async (path) => {
      const ov = s.overlay.get(keyOf(norm(path)))
      if (ov !== undefined) return ov
      try { return await nodeFs.read(path) } catch { return undefined }
    }
  }
}

// ---- форматирование ----

let formatterCache: { path: string | null } | null = null

export function findClangFormat(): string | null {
  if (formatterCache) return formatterCache.path
  let p = locateTool('clang-format')?.path ?? null
  if (!p && process.platform === 'win32') {
    for (const base of [process.env['ProgramFiles'], process.env['ProgramFiles(x86)']]) {
      if (!base) continue
      const c = join(base, 'LLVM', 'bin', 'clang-format.exe')
      try { if (statSync(c).isFile()) { p = c; break } } catch { /* нет */ }
    }
  }
  formatterCache = { path: p }
  return p
}

function runClangFormat(bin: string, text: string, filePath: string, cwd: string): Promise<FormatResult> {
  return new Promise((resolve) => {
    const spec = spawnSpec(bin, ['--assume-filename=' + filePath, '--style=file', '--fallback-style=LLVM'])
    const child = execFile(spec.command, spec.args, { cwd, timeout: 15000, maxBuffer: 16 * 1024 * 1024, windowsHide: true, env: { ...process.env, ...spec.env } }, (err, stdout, stderr) => {
      if (err) { resolve({ ok: false, error: (stderr || err.message || 'clang-format завершился с ошибкой').toString().trim().slice(0, 400) }); return }
      resolve({ ok: true, text: stdout })
    })
    child.stdin?.end(text)
  })
}

// ---- IPC ----

export function registerSymbolsIpc(deps: { readProject: ReadProject }): void {
  const run = (kind: string, a: Record<string, unknown>): Promise<unknown> => {
    const s = st
    const need = (): State => { if (!s || !s.status.ready) throw new UserError('Индекс символов ещё не готов.'); return s }
    switch (kind) {
      case 'ensure': return ensureIndex(deps.readProject, { configuration: typeof a.configuration === 'string' ? a.configuration : undefined, force: !!a.force })
      case 'status': return Promise.resolve(s?.status ?? emptyStatus(''))
      case 'overlay': {
        if (typeof a.path === 'string' && typeof a.text === 'string' && s) setOverlay(deps.readProject, a.path, a.text)
        return Promise.resolve(true)
      }
      case 'clear-overlay': { if (s && typeof a.path === 'string') s.overlay.delete(keyOf(norm(a.path))); return Promise.resolve(true) }
      case 'complete': return Promise.resolve(completion(need().ix, { before: String(a.before ?? '') }))
      case 'hover': return Promise.resolve(hover(need().ix, a as unknown as CursorReq))
      case 'signature': return Promise.resolve(signature(need().ix, String(a.before ?? '')))
      case 'definition': return Promise.resolve(definitions(need().ix, a as unknown as CursorReq))
      case 'references': return references(need().ix, a as unknown as CursorReq, textSource(need()))
      case 'rename': return renamePlan(need().ix, a as unknown as CursorReq, String(a.newName ?? ''), textSource(need()))
      case 'search': return Promise.resolve(need().ix.search(String(a.query ?? ''), 80).map((x) => symLoc(need().ix, x)))
      case 'read': {
        const p = norm(String(a.path ?? ''))
        const known = need().ix.files.some((f) => keyOf(f.path) === keyOf(p))
        if (!known) throw new UserError('Файл не входит в индекс проекта.')
        return nodeFs.read(p).then((text) => ({ text }))
      }
      case 'formatter': { const p = findClangFormat(); return Promise.resolve({ available: !!p, path: p }) }
      case 'format': {
        const bin = findClangFormat()
        if (!bin) return Promise.resolve({ ok: false, error: 'clang-format не найден.' } satisfies FormatResult)
        return runClangFormat(bin, String(a.text ?? ''), String(a.path ?? 'file.c'), s?.root ?? needRoot())
      }
      default: throw new UserError('Неизвестный запрос индекса.')
    }
  }
  ipcMain.handle('pro:sym', (_e, kind: unknown, args: unknown) => guard(async () => run(String(kind), (args && typeof args === 'object' ? args : {}) as Record<string, unknown>)))
  app.on('before-quit', () => { if (st?.saveTimer && st.cache) { clearTimeout(st.saveTimer); void saveCache(st.root, st.cache) } })
}

/** Для тестов и e2e: сбросить состояние. */
export function resetSymbolService(): void { st = null; formatterCache = null }

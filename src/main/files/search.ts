// Поиск и замена по текстовым файлам открытого проекта. Пути в запись попадают только из ответа поиска и проверяются inside().
import { ipcMain } from 'electron'
import { readdir, readFile, stat, writeFile } from 'fs/promises'
import { join, relative } from 'path'
import { guard, inside, needRoot, UserError } from './ipc'
import { buildMatcher, findInText, hasBinaryExt, looksBinary, replaceInText, skipEntry } from './searchcore'
import type { LineMatch, SearchOptions } from './searchcore'

const MAX_FILE = 1024 * 1024
const MAX_FILES = 3000
const MAX_DEPTH = 10
const MAX_MATCHES = 2000
const MAX_PER_FILE = 300
const MAX_MS = 8000
const MAX_REPLACE_FILES = 500

export interface SearchFile { path: string; rel: string; matches: LineMatch[] }
export interface SearchResponse {
  files: SearchFile[]
  total: number
  scanned: number
  /** Поиск остановлен по лимиту (совпадений, файлов или времени) */
  truncated: boolean
}
export interface ReplaceResponse { replaced: number; files: number; skipped: string[] }

function opts(o: unknown): SearchOptions {
  const x = (o ?? {}) as Partial<SearchOptions>
  return { caseSensitive: x.caseSensitive === true, wholeWord: x.wholeWord === true, regex: x.regex === true }
}

async function* walk(dir: string, depth: number, state: { n: number }): AsyncGenerator<string> {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
  entries.sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true }))
  for (const e of entries) {
    if (e.isSymbolicLink() || skipEntry(e.name, e.isDirectory())) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (depth < MAX_DEPTH) yield* walk(p, depth + 1, state) }
    else if (e.isFile() && !hasBinaryExt(e.name)) {
      if (state.n++ >= MAX_FILES) return
      yield p
    }
  }
}

async function readText(p: string): Promise<string | null> {
  const s = await stat(p)
  if (!s.isFile() || s.size > MAX_FILE) return null
  const buf = await readFile(p)
  if (looksBinary(buf)) return null
  return buf.toString('utf8').replace(/^﻿/, '')
}

export function registerSearchIpc(): void {
  ipcMain.handle('search:run', (_e, query: unknown, o: unknown) =>
    guard(async (): Promise<SearchResponse> => {
      const root = needRoot()
      const m = buildMatcher(query as string, opts(o))
      if (!m.ok) throw new UserError(m.error)
      const deadline = Date.now() + MAX_MS
      const out: SearchResponse = { files: [], total: 0, scanned: 0, truncated: false }
      const state = { n: 0 }
      for await (const p of walk(root, 0, state)) {
        if (Date.now() > deadline) { out.truncated = true; break }
        let text: string | null
        try { text = await readText(p) } catch { continue }
        if (text === null) continue
        out.scanned++
        const r = findInText(text, m.re, Math.min(MAX_PER_FILE, MAX_MATCHES - out.total), deadline)
        if (r.truncated) out.truncated = true
        if (r.matches.length) {
          out.files.push({ path: p, rel: relative(root, p).replace(/\\/g, '/'), matches: r.matches })
          out.total += r.matches.length
        }
        if (out.total >= MAX_MATCHES) { out.truncated = true; break }
      }
      if (state.n >= MAX_FILES) out.truncated = true
      return out
    })
  )

  /** Замена в перечисленных файлах (пути из результатов поиска). Файл, изменившийся с момента поиска, тоже обрабатывается заново по диску. */
  ipcMain.handle('search:replace', (_e, query: unknown, o: unknown, replacement: unknown, paths: unknown) =>
    guard(async (): Promise<ReplaceResponse> => {
      needRoot()
      if (typeof replacement !== 'string' || replacement.length > 2000) throw new UserError('Слишком длинный текст замены.')
      if (!Array.isArray(paths) || !paths.length) throw new UserError('Нет файлов для замены.')
      if (paths.length > MAX_REPLACE_FILES) throw new UserError('Слишком много файлов за один раз.')
      const op = opts(o)
      const m = buildMatcher(query as string, op)
      if (!m.ok) throw new UserError(m.error)
      const res: ReplaceResponse = { replaced: 0, files: 0, skipped: [] }
      const deadline = Date.now() + MAX_MS * 2
      for (const raw of paths) {
        if (Date.now() > deadline) { res.skipped.push('Остановлено по времени'); break }
        let p: string
        try { p = await inside(raw) } catch { res.skipped.push(String(raw)); continue }
        try {
          const text = await readText(p)
          if (text === null) { res.skipped.push(p); continue }
          const r = replaceInText(text, m.re, replacement, op.regex)
          if (r.count === 0) continue
          await writeFile(p, r.text, 'utf8')
          res.replaced += r.count
          res.files++
        } catch { res.skipped.push(p) }
      }
      return res
    })
  )
}

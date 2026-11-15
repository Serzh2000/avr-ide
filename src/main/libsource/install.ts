// Получение списка тегов и скачивание zip-архива библиотеки с GitHub (без электрона и без git).
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { fetchBuffer, NetError } from './net'
import { buildRefsUrl, buildTagsApiUrl, buildZipUrl, compareVersions, isRef, parseGitRefs } from './repo'
import type { RefKind, RefList } from './types'
import { inspectLibraryZip, type ZipInspection } from './zip'

export const MAX_ZIP_BYTES = 50 * 1048576
const REFS_TTL = 10 * 60_000
const refsCache = new Map<string, { at: number; value: RefList }>()

export function clearRefsCache(): void {
  refsCache.clear()
}

/**
 * Теги и ветка по умолчанию. Сначала git smart-HTTP (info/refs) — он не расходует лимит API GitHub;
 * если не вышло — API (с токеном, если задан). Результат кэшируется на 10 минут.
 */
export async function listRefs(owner: string, repo: string, token: string | null, signal?: AbortSignal): Promise<RefList> {
  const key = `${owner}/${repo}`.toLowerCase()
  const hit = refsCache.get(key)
  if (hit && Date.now() - hit.at < REFS_TTL) return hit.value
  let value: RefList
  let gitErr: NetError | null = null
  try {
    const buf = await fetchBuffer(buildRefsUrl(owner, repo), { maxBytes: 8 * 1048576, signal, timeoutMs: 30_000, headers: { 'User-Agent': 'git/2.45.0' } })
    const r = parseGitRefs(buf)
    value = { tags: r.tags.slice(0, 100), defaultBranch: r.defaultBranch ?? (r.heads.includes('main') ? 'main' : r.heads.includes('master') ? 'master' : r.heads[0]), source: 'git' }
  } catch (e) {
    if (signal?.aborted) throw e
    gitErr = e as NetError
    if (gitErr.status === 404) throw gitErr
    try {
      const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const buf = await fetchBuffer(buildTagsApiUrl(owner, repo), { maxBytes: 4 * 1048576, signal, timeoutMs: 30_000, headers })
      const arr = JSON.parse(buf.toString('utf8')) as { name?: unknown }[]
      const tags = arr.map((t) => t.name).filter((n): n is string => isRef(n)).sort((a, b) => compareVersions(b, a))
      value = { tags, source: 'api' }
    } catch (e2) {
      const ne = e2 as NetError
      if (ne.rateLimited || ne.status === 404) throw ne
      // Список недоступен — всё же можно поставить ветку по умолчанию
      return { tags: [], source: 'none', note: `Не удалось получить список тегов: ${ne.message}` }
    }
  }
  refsCache.set(key, { at: Date.now(), value })
  return value
}

export interface Downloaded {
  zipPath: string
  size: number
  inspection: ZipInspection
  cleanup: () => void
}

/** Скачивает архив во временную папку и проверяет его содержимое. Вызывающий обязан вызвать cleanup(). */
export async function downloadLibraryZip(
  owner: string,
  repo: string,
  kind: RefKind,
  ref: string | undefined,
  o: { signal?: AbortSignal; onProgress?: (got: number, total: number | null) => void }
): Promise<Downloaded> {
  const url = buildZipUrl(owner, repo, kind, ref)
  const buf = await fetchBuffer(url, { maxBytes: MAX_ZIP_BYTES, signal: o.signal, onProgress: o.onProgress })
  const inspection = inspectLibraryZip(buf)
  if (!inspection.ok) throw new Error(inspection.error ?? 'Архив не прошёл проверку.')
  const tmp = mkdtempSync(join(tmpdir(), 'avride-gh-'))
  const cleanup = (): void => { try { rmSync(tmp, { recursive: true, force: true }) } catch { /* ignore */ } }
  try {
    const zipPath = join(tmp, `${repo}.zip`)
    writeFileSync(zipPath, buf)
    return { zipPath, size: buf.length, inspection, cleanup }
  } catch (e) {
    cleanup()
    throw e
  }
}

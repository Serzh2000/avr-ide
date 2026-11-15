// Чистые функции: разбор и проверка адресов GitHub-репозиториев, построение URL.
// Никаких готовых URL из renderer не принимаем — строим сами из проверенных owner/repo/ref.
import type { RefKind, RepoId } from './types'

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/
const REPO_RE = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/
const REF_RE = /^[A-Za-z0-9_][A-Za-z0-9._+/-]{0,99}$/

export const isOwner = (s: unknown): s is string => typeof s === 'string' && OWNER_RE.test(s)
export const isRepoName = (s: unknown): s is string => typeof s === 'string' && REPO_RE.test(s)
export const isRef = (s: unknown): s is string =>
  typeof s === 'string' && REF_RE.test(s) && !s.includes('..') && !s.includes('//') && !s.endsWith('/') && !s.endsWith('.lock')
export const isRefKind = (s: unknown): s is RefKind => s === 'tag' || s === 'branch' || s === 'default'

export function repoId(owner: string, repo: string): RepoId | null {
  if (!isOwner(owner) || !isRepoName(repo)) return null
  return { owner, repo, key: `${owner}/${repo}`.toLowerCase() }
}

/**
 * Приводит адрес репозитория к owner/repo. Понимает https://github.com/o/r, .git, слеш на конце,
 * www., http, git@github.com:o/r.git, ссылки вглубь (/tree/main) и краткую запись «o/r».
 */
export function normalizeRepoUrl(input: unknown): RepoId | null {
  if (typeof input !== 'string') return null
  let s = input.trim().replace(/^git\+/i, '')
  if (!s || s.length > 300) return null
  const ssh = /^git@github\.com:(.+)$/i.exec(s)
  if (ssh) s = 'https://github.com/' + ssh[1]
  else if (/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+(\.git)?\/?$/.test(s)) s = 'https://github.com/' + s
  let u: URL
  try { u = new URL(s) } catch { return null }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const host = u.hostname.toLowerCase()
  if (host !== 'github.com' && host !== 'www.github.com') return null
  const segs = u.pathname.split('/').filter(Boolean)
  if (segs.length < 2) return null
  return repoId(segs[0], segs[1].replace(/\.git$/i, ''))
}

/** Разбор repositories.txt: по URL в строке; пустые, комментарии и чужие хосты пропускаются; дубликаты убираются. */
export function parseRepositories(text: string): RepoId[] {
  const seen = new Set<string>()
  const out: RepoId[] = []
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const id = normalizeRepoUrl(t)
    if (!id || seen.has(id.key)) continue
    seen.add(id.key)
    out.push(id)
  }
  return out
}

const encRef = (ref: string): string => ref.split('/').map(encodeURIComponent).join('/')

/** URL zip-архива. Для kind='default' берётся HEAD (ветка по умолчанию). */
export function buildZipUrl(owner: string, repo: string, kind: RefKind, ref?: string): string {
  if (!isOwner(owner) || !isRepoName(repo)) throw new Error('Недопустимый репозиторий.')
  const base = `https://codeload.github.com/${owner}/${repo}/zip/`
  if (kind === 'default') return base + 'HEAD'
  if (!isRef(ref)) throw new Error('Недопустимое имя тега или ветки.')
  return base + (kind === 'tag' ? 'refs/tags/' : 'refs/heads/') + encRef(ref)
}

export function buildTagsApiUrl(owner: string, repo: string): string {
  if (!isOwner(owner) || !isRepoName(repo)) throw new Error('Недопустимый репозиторий.')
  return `https://api.github.com/repos/${owner}/${repo}/tags?per_page=100`
}

export function buildRefsUrl(owner: string, repo: string): string {
  if (!isOwner(owner) || !isRepoName(repo)) throw new Error('Недопустимый репозиторий.')
  return `https://github.com/${owner}/${repo}.git/info/refs?service=git-upload-pack`
}

export function buildRepoPageUrl(owner: string, repo: string): string {
  if (!isOwner(owner) || !isRepoName(repo)) throw new Error('Недопустимый репозиторий.')
  return `https://github.com/${owner}/${repo}`
}

/** Сравнение версий вида 1.2.3 / v1.2.3-beta (числовые части сравниваются как числа). */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^[vV]/, '').split(/[.\-+_]/)
  const pb = b.replace(/^[vV]/, '').split(/[.\-+_]/)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i]
    const y = pb[i]
    if (x === undefined) return /^\d+$/.test(y) ? -1 : 1 // «1.2» < «1.2.1», но «1.2» > «1.2-beta»
    if (y === undefined) return /^\d+$/.test(x) ? 1 : -1
    const nx = /^\d+$/.test(x)
    const ny = /^\d+$/.test(y)
    if (nx && ny) {
      const d = Number(x) - Number(y)
      if (d) return d < 0 ? -1 : 1
    } else if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

/**
 * Разбор ответа git smart-HTTP (info/refs): pkt-line, теги и ветка по умолчанию (symref=HEAD:refs/heads/x).
 * Не требует API GitHub и его лимитов.
 */
export function parseGitRefs(buf: Buffer | string): { tags: string[]; defaultBranch?: string; heads: string[] } {
  const b = typeof buf === 'string' ? Buffer.from(buf, 'latin1') : buf
  const tags = new Set<string>()
  const heads: string[] = []
  let defaultBranch: string | undefined
  let pos = 0
  while (pos + 4 <= b.length) {
    const len = parseInt(b.toString('latin1', pos, pos + 4), 16)
    if (!Number.isFinite(len)) break
    if (len === 0) { pos += 4; continue }
    if (len < 4 || pos + len > b.length) break
    const line = b.toString('utf8', pos + 4, pos + len).replace(/\n$/, '')
    pos += len
    if (line.startsWith('#')) continue
    const nul = line.indexOf('\u0000')
    const refPart = nul >= 0 ? line.slice(0, nul) : line
    const caps = nul >= 0 ? line.slice(nul + 1) : ''
    const name = refPart.slice(refPart.indexOf(' ') + 1)
    if (caps) {
      const m = /(?:^|\s)symref=HEAD:refs\/heads\/(\S+)/.exec(caps)
      if (m) defaultBranch = m[1]
    }
    if (name.startsWith('refs/tags/')) {
      const t = name.slice('refs/tags/'.length).replace(/\^\{\}$/, '')
      if (isRef(t)) tags.add(t)
    } else if (name.startsWith('refs/heads/')) {
      const h = name.slice('refs/heads/'.length)
      if (isRef(h)) heads.push(h)
    }
  }
  return { tags: [...tags].sort((x, y) => compareVersions(y, x)), defaultBranch, heads }
}

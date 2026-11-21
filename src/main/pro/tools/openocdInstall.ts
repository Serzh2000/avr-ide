// Установка xPack OpenOCD «одной кнопкой»: скачивание релиза с GitHub (xpack-dev-tools/openocd-xpack), проверка SHA-256, распаковка в userData/pro-tools.
// Лицензия OpenOCD — GPL-2.0 (см. licenses/THIRD_PARTY.md). Скачивание — только после подтверждения пользователя (см. план installPlan).
import { spawn } from 'child_process'
import { createHash } from 'crypto'
import { createReadStream, createWriteStream } from 'fs'
import { mkdir, readdir, rename, rm, stat } from 'fs/promises'
import { join } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'

export const OPENOCD_REPO = 'xpack-dev-tools/openocd-xpack'
/** Проверенная версия: все ссылки и контрольные суммы берутся из этого релиза. */
export const OPENOCD_TAG = 'v0.12.0-7'
export const OPENOCD_LICENSE = 'GPL-2.0'

export interface ReleaseAsset { name: string; size: number; browser_download_url: string; digest?: string }
export interface Release { tag_name: string; assets: ReleaseAsset[] }

export interface InstallPlan {
  tag: string
  file: string
  size: number
  url: string
  sha256: string
  /** Откуда: человекочитаемо */
  source: string
  license: string
}

/** Подбирает архив для платформы: win32-x64.zip. */
export function pickAsset(rel: Release, platform: string = process.platform, arch: string = process.arch): { zip: ReleaseAsset; sha?: ReleaseAsset } | null {
  const key = `${platform}-${arch}`
  const zip = rel.assets.find((a) => a.name.endsWith(`-${key}.zip`))
  if (!zip) return null
  return { zip, sha: rel.assets.find((a) => a.name === zip.name + '.sha') }
}

/** Файл .sha xPack: «<64 hex> *<имя файла>». */
export function parseShaFile(text: string, fileName: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{64})\s+\*?(.+?)\s*$/.exec(line.trim())
    if (m && m[2] === fileName) return m[1].toLowerCase()
  }
  return null
}

export const digestHex = (d?: string): string | null => { const m = /^sha256:([0-9a-f]{64})$/i.exec(d ?? ''); return m ? m[1].toLowerCase() : null }

export async function sha256File(p: string): Promise<string> {
  const h = createHash('sha256')
  await pipeline(createReadStream(p), h)
  return h.digest('hex')
}

const GH = { 'User-Agent': 'avr-ide', Accept: 'application/vnd.github+json' }
async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: GH })
  if (!r.ok) throw new Error(`GitHub ответил ${r.status} на ${url}`)
  return (await r.json()) as T
}
async function getText(url: string): Promise<string> {
  const r = await fetch(url, { headers: { 'User-Agent': 'avr-ide' } })
  if (!r.ok) throw new Error(`Сервер ответил ${r.status} на ${url}`)
  return r.text()
}

/** Что будет скачано: имя, размер, источник, контрольная сумма. Ничего не загружает (кроме метаданных релиза). */
export async function installPlan(): Promise<InstallPlan> {
  // Только для автотестов: готовый план без обращения к сети
  if (process.env['AVRIDE_E2E'] === '1' && process.env['AVRIDE_PRO_INSTALL_PLAN']) return JSON.parse(process.env['AVRIDE_PRO_INSTALL_PLAN']) as InstallPlan
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Установка OpenOCD одной кнопкой доступна только для Windows x64. Установите OpenOCD вручную и укажите путь в настройках.')
  let rel: Release
  try { rel = await getJson<Release>(`https://api.github.com/repos/${OPENOCD_REPO}/releases/tags/${OPENOCD_TAG}`) } catch (e) {
    throw new Error('Не удалось связаться с GitHub: проверьте подключение к интернету. ' + (e instanceof Error ? e.message : ''))
  }
  const a = pickAsset(rel)
  if (!a) throw new Error('В релизе OpenOCD нет архива для Windows x64.')
  let sha: string | null = null
  if (a.sha) sha = parseShaFile(await getText(a.sha.browser_download_url), a.zip.name)
  const dg = digestHex(a.zip.digest)
  if (sha && dg && sha !== dg) throw new Error('Контрольные суммы релиза противоречат друг другу — установка отменена.')
  sha = sha ?? dg
  if (!sha) throw new Error('У релиза нет контрольной суммы SHA-256 — установка отменена.')
  return { tag: rel.tag_name, file: a.zip.name, size: a.zip.size, url: a.zip.browser_download_url, sha256: sha, source: `github.com/${OPENOCD_REPO} (релиз ${rel.tag_name})`, license: OPENOCD_LICENSE }
}

function bsdtar(zip: string, dest: string): Promise<void> {
  const exe = join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'tar.exe')
  return new Promise((resolve, reject) => {
    const c = spawn(exe, ['-xf', zip, '-C', dest], { windowsHide: true })
    let err = ''
    c.stderr.on('data', (d: Buffer) => (err += d.toString()))
    c.on('error', reject)
    c.on('close', (code) => (code === 0 ? resolve() : reject(new Error('Не удалось распаковать архив: ' + err.trim()))))
  })
}

/** Скачивает, проверяет SHA-256, распаковывает в <toolsRoot>/openocd/<имя архива без .zip>. Возвращает путь к openocd.exe. */
export async function installOpenocd(plan: InstallPlan, toolsRoot: string, onProgress: (done: number, total: number) => void, signal?: AbortSignal): Promise<string> {
  const root = join(toolsRoot, 'openocd')
  await mkdir(root, { recursive: true })
  const tmp = join(root, '.download-' + Date.now())
  await mkdir(tmp, { recursive: true })
  try {
    const zip = join(tmp, plan.file)
    const r = await fetch(plan.url, { headers: { 'User-Agent': 'avr-ide' }, signal })
    if (!r.ok || !r.body) throw new Error(`Не удалось скачать OpenOCD (ответ ${r.status}).`)
    const total = Number(r.headers.get('content-length')) || plan.size
    let done = 0
    const src = Readable.fromWeb(r.body as never)
    src.on('data', (c: Buffer) => { done += c.length; onProgress(done, total) })
    await pipeline(src, createWriteStream(zip), { signal })
    const got = await sha256File(zip)
    if (got !== plan.sha256) throw new Error('Контрольная сумма скачанного архива не совпала — файл повреждён или подменён, он удалён.')
    const out = join(tmp, 'x')
    await mkdir(out)
    await bsdtar(zip, out)
    const entries = await readdir(out)
    const top = entries.length === 1 ? entries[0] : null
    if (!top) throw new Error('Неожиданная структура архива OpenOCD.')
    const final = join(root, top)
    await rm(final, { recursive: true, force: true })
    await rename(join(out, top), final)
    const exe = join(final, 'bin', 'openocd.exe')
    if (!(await stat(exe).catch(() => null))) throw new Error('В распакованном архиве нет bin/openocd.exe.')
    return exe
  } finally {
    await rm(tmp, { recursive: true, force: true, maxRetries: 3 }).catch(() => undefined)
  }
}

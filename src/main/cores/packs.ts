// Работа с пакетами ядер на диске (без electron): поиск, проверка файлов, копирование, установка через arduino-cli.
import { createHash } from 'crypto'
import { createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { createGunzip } from 'zlib'
import { copyFile, lstat, mkdir, readdir, readFile, rename, rm, statfs } from 'fs/promises'
import { basename, dirname, join, parse, resolve } from 'path'
import { indexFileName, parseManifest, planInstall, resolveInside } from './core'
import type { InstallPlan, PackManifest } from './core'

export type Origin = 'bundled' | 'external'

export interface FoundPack {
  /** Непрозрачный ключ для renderer (путь наружу не отдаётся для выбора) */
  key: string
  origin: Origin
  dir: string
  manifest: PackManifest | null
  error?: string
  /** .zip-архив пакета: IDE читает только папки */
  archive?: string
}

export interface Root { dir: string; origin: Origin }

const PACK_DIR_RE = /^AVR-IDE-core-/i
const isDir = async (p: string): Promise<boolean> => (await lstat(p).catch(() => null))?.isDirectory() ?? false

async function readPack(dir: string, origin: Origin): Promise<FoundPack | null> {
  const mp = join(dir, 'manifest.json')
  const st = await lstat(mp).catch(() => null)
  if (!st?.isFile()) return null
  try {
    if (st.size > 1024 * 1024) throw new Error('Пакет ядра повреждён: manifest.json слишком большой')
    const manifest = parseManifest(await readFile(mp, 'utf8'))
    // Быстрая проверка наличия файлов (хеши — перед установкой)
    for (const f of manifest.files) {
      const s = await lstat(resolveInside(dir, f.path)).catch(() => null)
      if (!s?.isFile()) throw new Error(`Пакет неполный: нет файла ${f.path}`)
      if (s.size !== f.size) throw new Error(`Пакет повреждён: размер ${f.path} не совпадает (${s.size} вместо ${f.size})`)
    }
    return { key: '', origin, dir, manifest }
  } catch (e) {
    return { key: '', origin, dir, manifest: null, error: (e as Error).message }
  }
}

/** Ищет пакеты в корнях. Встроенные: все подпапки с manifest.json; внешние: папки AVR-IDE-core-* (и на уровень глубже), .zip. */
export async function scanRoots(roots: Root[]): Promise<FoundPack[]> {
  const out: FoundPack[] = []
  const seen = new Set<string>()
  const add = (p: FoundPack | null): void => {
    if (!p) return
    const k = resolve(p.dir).toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    out.push(p)
  }
  for (const r of roots) {
    if (!(await isDir(r.dir))) continue
    if (r.origin === 'external' && PACK_DIR_RE.test(basename(r.dir))) add(await readPack(r.dir, r.origin))
    // в «Загрузках» бывают тысячи файлов: сначала отбираем по имени, потом ограничиваем число
    const names = (await readdir(r.dir).catch(() => [] as string[])).filter((n) => r.origin === 'bundled' || PACK_DIR_RE.test(n))
    for (const n of names.slice(0, 100)) {
      const p = join(r.dir, n)
      if (/\.zip$/i.test(n) && r.origin === 'external') {
        const s = await lstat(p).catch(() => null)
        if (s?.isFile()) out.push({ key: '', origin: 'external', dir: p, manifest: null, archive: p })
        continue
      }
      if (!(await isDir(p))) continue
      const pack = await readPack(p, r.origin)
      if (pack) { add(pack); continue }
      // распаковка zip иногда даёт вложенную папку с тем же именем
      if (r.origin === 'external') for (const sub of (await readdir(p).catch(() => [] as string[])).slice(0, 20)) if (PACK_DIR_RE.test(sub)) add(await readPack(join(p, sub), r.origin))
    }
  }
  // ключи и устранение дублей: на одно ядро — самая свежая версия, при равенстве встроенный раньше внешнего
  const good = out.filter((p) => p.manifest)
  good.sort((a, b) => cmpVer(b.manifest!.version, a.manifest!.version) || (a.origin === 'bundled' ? -1 : 1) - (b.origin === 'bundled' ? -1 : 1))
  const byCore = new Set<string>()
  const result: FoundPack[] = []
  for (const p of good) {
    const id = `${p.manifest!.coreId}`
    if (byCore.has(id)) continue
    byCore.add(id)
    p.key = `${p.origin === 'bundled' ? 'b' : 'e'}:${p.manifest!.id}:${p.manifest!.version}:${createHash('sha1').update(resolve(p.dir).toLowerCase()).digest('hex').slice(0, 10)}`
    result.push(p)
  }
  for (const p of out.filter((x) => !x.manifest)) {
    p.key = `x:${createHash('sha1').update(resolve(p.dir).toLowerCase()).digest('hex').slice(0, 10)}`
    result.push(p)
  }
  return result
}

function cmpVer(a: string, b: string): number {
  const pa = a.split(/[.\-+]/).map((x) => parseInt(x, 10) || 0)
  const pb = b.split(/[.\-+]/).map((x) => parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

// ---------- Проверка файлов ----------

export function hashFile(path: string, onBytes?: (n: number) => void, signal?: AbortSignal): Promise<string> {
  return new Promise((res, rej) => {
    const h = createHash('sha256')
    const s = createReadStream(path, { highWaterMark: 1 << 20 })
    s.on('data', (d) => {
      h.update(d)
      onBytes?.(d.length)
      if (signal?.aborted) s.destroy(new Error('cancelled'))
    })
    s.on('end', () => res(h.digest('hex')))
    s.on('error', rej)
  })
}

export interface Progress { label: string; pct: number | null }

export interface VerifyItem { rel: string; size: number; sha256: string }

/** Файлы пакета, которые нужны для этой установки (по плану). */
export function itemsOf(m: PackManifest, plan: InstallPlan): VerifyItem[] {
  return [
    ...plan.copyIndexes.flatMap((x) => [{ rel: x.file, size: x.size, sha256: x.sha256 }, ...(x.sig ? [{ rel: x.sig.file, size: x.sig.size, sha256: x.sig.sha256 }] : [])]),
    ...(plan.copyLibraryIndex && m.libraryIndex ? [{ rel: m.libraryIndex.file, size: m.libraryIndex.size, sha256: m.libraryIndex.sha256 }, { rel: m.libraryIndex.sig.file, size: m.libraryIndex.sig.size, sha256: m.libraryIndex.sig.sha256 }] : []),
    ...plan.copyFiles.map((f) => ({ rel: f.path, size: f.size, sha256: f.sha256 }))
  ]
}

/** Проверка файлов пакета: размеры и SHA-256. Бросает Error с понятным текстом. */
export async function verifyItems(dir: string, items: VerifyItem[], onProgress: (p: Progress) => void, signal?: AbortSignal): Promise<void> {
  const total = items.reduce((s, i) => s + i.size, 0)
  let done = 0
  let last = 0
  for (const it of items) {
    if (signal?.aborted) throw new Error('Отменено.')
    const p = resolveInside(dir, it.rel)
    const st = await lstat(p).catch(() => null)
    if (!st?.isFile()) throw new Error(`Нет файла ${it.rel}. Пакет неполный — скопируйте его заново.`)
    if (st.size !== it.size) throw new Error(`Файл ${it.rel} повреждён (размер ${st.size}, должен быть ${it.size}). Скопируйте пакет заново.`)
    const h = await hashFile(p, (n) => {
      done += n
      if (Date.now() - last > 250) { last = Date.now(); onProgress({ label: 'Проверка пакета', pct: total ? (done / total) * 100 : null }) }
    }, signal).catch((e) => { throw new Error(signal?.aborted ? 'Отменено.' : `Не удалось прочитать ${it.rel}: ${(e as Error).message}`) })
    if (h !== it.sha256) throw new Error(`Файл ${it.rel} не прошёл проверку контрольной суммы — пакет повреждён или подменён. Скопируйте его заново.`)
  }
  onProgress({ label: 'Проверка пакета', pct: 100 })
}

// ---------- Место на диске ----------

export async function freeBytes(path: string): Promise<number> {
  let p = resolve(path)
  for (let i = 0; i < 12; i++) {
    try {
      const s = await statfs(p)
      return Number(s.bavail) * Number(s.bsize)
    } catch {
      const up = dirname(p)
      if (up === p) break
      p = up
    }
  }
  return Number.MAX_SAFE_INTEGER
}

export const sameVolume = (a: string, b: string): boolean => parse(resolve(a)).root.toLowerCase() === parse(resolve(b)).root.toLowerCase()

// ---------- Установка ----------

export interface CliEnv {
  data: string
  downloads: string
  urls: string[]
  /** Установленная версия ядра (если есть) */
  installed?: string
}

export interface InstallDeps {
  env: CliEnv
  log: (stream: 'stdout' | 'stderr' | 'info', text: string) => void
  progress: (p: Progress) => void
  signal: AbortSignal
  runCli: (args: string[]) => Promise<number | null>
}

/** Читает индексы из каталога данных (нет файла/не JSON → null). */
async function readDataIndexes(data: string, m: PackManifest): Promise<Map<string, unknown | null>> {
  const map = new Map<string, unknown | null>()
  for (const ix of m.indexes) {
    const n = indexFileName(ix.url)
    try { map.set(n, JSON.parse((await readFile(join(data, n), 'utf8')).replace(/^﻿/, ''))) } catch { map.set(n, null) }
  }
  return map
}

async function stagedFiles(downloads: string, m: PackManifest): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  for (const f of m.files) {
    const n = f.path.slice('packages/'.length)
    const s = await lstat(join(downloads, 'packages', n)).catch(() => null)
    if (s?.isFile()) map.set(n, s.size)
  }
  return map
}

/** План установки по состоянию диска. */
export async function makePlan(m: PackManifest, env: CliEnv): Promise<InstallPlan> {
  const [dataIndexes, staged, freeData, freeStaging, hasLib] = await Promise.all([
    readDataIndexes(env.data, m), stagedFiles(env.downloads, m), freeBytes(env.data), freeBytes(env.downloads),
    lstat(join(env.data, 'library_index.json')).then((s) => s.isFile() && s.size > 1000).catch(() => false)
  ])
  const installedTools = new Set<string>()
  for (const f of m.files) {
    if (f.kind !== 'tool') continue
    if ((await lstat(join(env.data, 'packages', f.packager, 'tools', f.name, f.version)).catch(() => null))?.isDirectory()) installedTools.add(`${f.packager}/${f.name}/${f.version}`)
  }
  return planInstall({ manifest: m, installed: env.installed, dataIndexes, staged, installedTools, hasLibraryIndex: hasLib, configuredUrls: env.urls, freeData, freeStaging, sameVolume: sameVolume(env.data, env.downloads) })
}

async function copyAtomic(src: string, dst: string): Promise<void> {
  await mkdir(dirname(dst), { recursive: true })
  const tmp = dst + '.avride-tmp'
  await rm(tmp, { force: true })
  await copyFile(src, tmp)
  await rename(tmp, dst)
}

/**
 * Установка ядра из пакета: проверка файлов → индексы в каталог данных → архивы в staging → `core install` без сети →
 * удаление скопированных архивов. Возвращает код завершения (0 — успех).
 */
export async function installFromPack(pack: FoundPack, deps: InstallDeps): Promise<number> {
  const m = pack.manifest!
  const { env, log, progress, signal } = deps
  const stop = (): boolean => signal.aborted
  log('info', `Пакет ядра: ${m.title} ${m.version} (${pack.origin === 'bundled' ? 'встроенный в IDE' : pack.dir})\n`)

  const plan = await makePlan(m, env)
  log('info', plan.reason + '\n')
  if (plan.action === 'skip') return 0
  if (plan.action === 'blocked') { log('stderr', plan.reason + '\n'); return 1 }

  // 1. Проверка пакета целиком до любых изменений на диске пользователя
  log('info', 'Проверяю целостность файлов пакета (размеры и SHA-256)…\n')
  try { await verifyItems(pack.dir, itemsOf(m, plan), progress, signal) } catch (e) { log('stderr', (e as Error).message + '\n'); return stop() ? 130 : 1 }
  log('stdout', 'Файлы пакета целы.\n')
  if (stop()) return 130

  // 2. Индексы: копируем только если у пользователя нет подходящего (его собственные не затираем без нужды)
  const copiedStaging: string[] = []
  try {
    for (const ix of plan.copyIndexes) {
      const n = indexFileName(ix.url)
      log('info', `Индекс ${n}: копирую в каталог данных.\n`)
      await copyAtomic(resolveInside(pack.dir, ix.file), join(env.data, n))
      if (ix.sig) await copyAtomic(resolveInside(pack.dir, ix.sig.file), join(env.data, n + '.sig'))
    }
    if (plan.copyLibraryIndex && m.libraryIndex) {
      log('info', 'Индекс библиотек: распаковываю в каталог данных (без него arduino-cli пытается скачать его из интернета).\n')
      const dst = join(env.data, 'library_index.json')
      await mkdir(env.data, { recursive: true })
      await rm(dst + '.avride-tmp', { force: true })
      await pipeline(createReadStream(resolveInside(pack.dir, m.libraryIndex.file)), createGunzip(), createWriteStream(dst + '.avride-tmp'))
      await rename(dst + '.avride-tmp', dst)
      await copyAtomic(resolveInside(pack.dir, m.libraryIndex.sig.file), join(env.data, 'library_index.json.sig'))
    }
    if (plan.addUrl) {
      log('info', 'Адрес пакетов нужно прописать в настройках arduino-cli, чтобы ядро было видно в менеджере и обновлялось:\n')
      const c = await deps.runCli(['config', 'add', 'board_manager.additional_urls', plan.addUrl])
      if (c !== 0) return c ?? 1
    }

    // 3. Архивы в staging (копии, пакет остаётся нетронутым)
    const total = plan.copyFiles.reduce((s, f) => s + f.size, 0)
    let done = 0
    let i = 0
    for (const f of plan.copyFiles) {
      if (stop()) return 130
      i++
      const dst = join(env.downloads, 'packages', f.path.slice('packages/'.length))
      progress({ label: `Копирование архивов ${i} из ${plan.copyFiles.length}`, pct: total ? (done / total) * 100 : null })
      await copyAtomic(resolveInside(pack.dir, f.path), dst)
      copiedStaging.push(dst)
      done += f.size
    }
    log('info', `Скопировано архивов: ${plan.copyFiles.length}. Запускаю установку (интернет не нужен).\n`)
    progress({ label: 'Установка ядра', pct: null })

    // 4. Обычная установка ядра: arduino-cli найдёт архивы в staging и проверит их контрольные суммы сам
    const code = await deps.runCli(plan.command)
    return code ?? 1
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    const msg = err.code === 'ENOSPC' ? 'Закончилось место на диске. Освободите место и повторите.'
      : err.code === 'EACCES' || err.code === 'EPERM' ? `Нет прав на запись: ${err.path ?? ''}. Закройте программы, которые используют эту папку, и повторите.`
        : err.message
    log('stderr', msg + '\n')
    return 1
  } finally {
    // 5. Копии в staging больше не нужны (занимали бы двойной объём); пакет остаётся на месте
    for (const p of copiedStaging) await rm(p, { force: true }).catch(() => { /* не страшно */ })
    if (copiedStaging.length) log('info', `Временные копии архивов удалены (${copiedStaging.length}).\n`)
  }
}

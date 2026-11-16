// Чистая логика «пакетов ядер» (без electron, сети и файловой системы): разбор manifest.json, безопасные пути,
// проверка индексов, план установки. Покрыта тестами в cores.test.ts.
import { isAbsolute, resolve, sep } from 'path'
import { compareVersions } from '../boardsources/core'

export interface PackIndexEntry {
  url: string
  file: string
  size: number
  sha256: string
  sig?: { file: string; size: number; sha256: string }
}

export interface PackLibraryIndex {
  file: string
  size: number
  sha256: string
  sig: { file: string; size: number; sha256: string }
}

export interface PackFileEntry {
  path: string
  size: number
  sha256: string
  kind: 'platform' | 'tool'
  packager: string
  name: string
  version: string
  host: string | null
  index: string
}

export interface PackManifest {
  format: 1
  id: string
  title: string
  package: string
  arch: string
  coreId: string
  version: string
  host: string
  createdAt: string
  indexUrl: string
  indexes: PackIndexEntry[]
  /** library_index.json.gz + подпись: arduino-cli без него при первом запуске лезет в интернет */
  libraryIndex?: PackLibraryIndex
  archivesBytes: number
  unpackFactor: number
  files: PackFileEntry[]
}

const MAX_FILE = 8 * 1024 * 1024 * 1024
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,200}$/
const IDENT_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,60}$/
const VER_RE = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,60}$/
const SHA_RE = /^[0-9a-f]{64}$/
const URL_RE = /^https?:\/\/[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]{1,300}$/

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const bad = (msg: string): never => { throw new Error('Пакет ядра повреждён: ' + msg) }

function str(o: Obj, k: string, re: RegExp, what: string): string {
  const v = o[k]
  if (typeof v !== 'string' || !re.test(v)) return bad(`некорректное поле «${what}»`)
  return v
}

function num(o: Obj, k: string, what: string, min = 1): number {
  const v = o[k]
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > MAX_FILE) return bad(`некорректный размер «${what}»`)
  return v
}

/** Относительный путь внутри пакета: только `<dir>/<имя>` без «..», дисков и обратных косых. */
export function safeRel(rel: unknown, dir: 'packages' | 'index'): string {
  if (typeof rel !== 'string') return bad('путь не строка')
  const m = /^(packages|index)\/([^/\\]+)$/.exec(rel)
  if (!m || m[1] !== dir || !NAME_RE.test(m[2]) || m[2].includes('..')) return bad(`недопустимый путь «${String(rel).slice(0, 80)}»`)
  return rel
}

/** Абсолютный путь к файлу пакета; бросает ошибку, если он выходит за папку пакета. */
export function resolveInside(root: string, rel: string): string {
  if (isAbsolute(rel)) return bad('абсолютный путь в manifest.json')
  const base = resolve(root)
  const full = resolve(base, rel)
  if (full !== base && !full.startsWith(base + sep)) return bad('путь выходит за пределы папки пакета')
  return full
}

/** Разбор и строгая проверка manifest.json. Бросает Error с понятным текстом. */
export function parseManifest(raw: string): PackManifest {
  if (raw.length > 1024 * 1024) bad('manifest.json слишком большой')
  let j: unknown
  try { j = JSON.parse(raw.replace(/^﻿/, '')) } catch { return bad('manifest.json не читается как JSON') }
  if (!isObj(j)) return bad('manifest.json должен быть объектом')
  if (j.format !== 1) bad('неизвестный формат пакета (ожидается format: 1)')
  const id = str(j, 'id', /^[a-z0-9][a-z0-9_-]{0,30}$/, 'id')
  const pkg = str(j, 'package', IDENT_RE, 'package')
  const arch = str(j, 'arch', IDENT_RE, 'arch')
  const coreId = str(j, 'coreId', /^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+$/, 'coreId')
  if (coreId !== `${pkg}:${arch}`) bad('coreId не совпадает с package:arch')
  const version = str(j, 'version', VER_RE, 'version')
  const indexUrl = str(j, 'indexUrl', URL_RE, 'indexUrl')
  const title = typeof j.title === 'string' && j.title.length <= 80 ? j.title : id
  if (!Array.isArray(j.indexes) || j.indexes.length < 1 || j.indexes.length > 10) bad('нет списка индексов')
  const indexes: PackIndexEntry[] = (j.indexes as unknown[]).map((e) => {
    if (!isObj(e)) return bad('запись индекса')
    const url = str(e, 'url', URL_RE, 'url индекса')
    const file = safeRel(e.file, 'index')
    if (!/\.json$/.test(file)) bad('индекс должен быть файлом .json')
    const out: PackIndexEntry = { url, file, size: num(e, 'size', file), sha256: str(e, 'sha256', SHA_RE, 'sha256 индекса') }
    if (e.sig !== undefined) {
      if (!isObj(e.sig)) return bad('подпись индекса')
      const sf = safeRel(e.sig.file, 'index')
      if (sf !== file + '.sig') bad('подпись индекса должна называться <индекс>.sig')
      out.sig = { file: sf, size: num(e.sig, 'size', sf), sha256: str(e.sig, 'sha256', SHA_RE, 'sha256 подписи') }
    }
    return out
  })
  if (!Array.isArray(j.files) || j.files.length < 1 || j.files.length > 400) bad('нет списка файлов')
  const seen = new Set<string>()
  const files: PackFileEntry[] = (j.files as unknown[]).map((e) => {
    if (!isObj(e)) return bad('запись файла')
    const path = safeRel(e.path, 'packages')
    if (seen.has(path)) bad(`файл «${path}» указан дважды`)
    seen.add(path)
    const kind = e.kind === 'platform' || e.kind === 'tool' ? e.kind : bad('kind файла')
    const index = str(e, 'index', URL_RE, 'index файла')
    if (!indexes.some((x) => x.url === index)) bad(`файл «${path}» ссылается на индекс, которого нет в пакете`)
    return {
      path, size: num(e, 'size', path), sha256: str(e, 'sha256', SHA_RE, `sha256 «${path}»`), kind,
      packager: str(e, 'packager', IDENT_RE, 'packager'), name: str(e, 'name', IDENT_RE, 'name'),
      version: str(e, 'version', VER_RE, 'version файла'),
      host: typeof e.host === 'string' && IDENT_RE.test(e.host) ? e.host : null,
      index
    } as PackFileEntry
  })
  const plats = files.filter((f) => f.kind === 'platform')
  if (plats.length !== 1 || plats[0].name !== arch || plats[0].packager !== pkg || plats[0].version !== version) bad('в пакете должна быть ровно одна платформа, совпадающая с package/arch/version')
  if (!indexes.some((x) => x.url === indexUrl)) bad('основной индекс пакета не найден среди indexes')
  let libraryIndex: PackLibraryIndex | undefined
  if (j.libraryIndex !== undefined) {
    const l = j.libraryIndex
    if (!isObj(l) || !isObj(l.sig)) return bad('индекс библиотек')
    const file = safeRel(l.file, 'index')
    const sf = safeRel(l.sig.file, 'index')
    if (file !== 'index/library_index.json.gz' || sf !== 'index/library_index.json.sig') bad('неожиданные имена файлов индекса библиотек')
    libraryIndex = { file, size: num(l, 'size', file), sha256: str(l, 'sha256', SHA_RE, 'sha256 индекса библиотек'), sig: { file: sf, size: num(l.sig, 'size', sf), sha256: str(l.sig, 'sha256', SHA_RE, 'sha256 подписи библиотек') } }
  }
  const unpack = typeof j.unpackFactor === 'number' && j.unpackFactor >= 1 && j.unpackFactor <= 10 ? j.unpackFactor : 4
  const archivesBytes = files.reduce((s, f) => s + f.size, 0)
  return {
    format: 1, id, title, package: pkg, arch, coreId, version, host: typeof j.host === 'string' ? j.host.slice(0, 30) : 'windows-x64',
    createdAt: typeof j.createdAt === 'string' ? j.createdAt.slice(0, 40) : '', indexUrl, indexes, libraryIndex, archivesBytes, unpackFactor: unpack, files
  }
}

// ---------- Индексы ----------

const shaOf = (c: unknown): string => String(c ?? '').replace(/^SHA-256:/i, '').toLowerCase()

/**
 * Проверяет, что индекс, уже лежащий у пользователя, описывает все файлы пакета, относящиеся к нему
 * (та же версия и та же контрольная сумма). Если да — трогать его не нужно.
 */
export function indexSatisfies(json: unknown, m: PackManifest, indexUrl: string): boolean {
  if (!isObj(json) || !Array.isArray(json.packages)) return false
  for (const f of m.files.filter((x) => x.index === indexUrl)) {
    const pkg = (json.packages as unknown[]).find((p) => isObj(p) && p.name === f.packager)
    if (!isObj(pkg)) return false
    if (f.kind === 'platform') {
      const pl = (Array.isArray(pkg.platforms) ? pkg.platforms : []).find((p) => isObj(p) && p.architecture === f.name && p.version === f.version)
      if (!isObj(pl) || shaOf(pl.checksum) !== f.sha256) return false
    } else {
      const t = (Array.isArray(pkg.tools) ? pkg.tools : []).find((x) => isObj(x) && x.name === f.name && x.version === f.version)
      const systems = isObj(t) && Array.isArray(t.systems) ? t.systems : []
      if (!systems.some((s) => isObj(s) && shaOf(s.checksum) === f.sha256)) return false
    }
  }
  return true
}

/** Имя файла индекса в каталоге данных — как у arduino-cli: последний сегмент адреса. */
export function indexFileName(url: string): string {
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '') } catch { return '' }
}

// ---------- План установки ----------

export type PackStatus = 'ready' | 'installed' | 'upgrade' | 'newer'

/** Статус пакета относительно установленного ядра. */
export function packStatus(m: PackManifest, installed: string | undefined): PackStatus {
  if (!installed) return 'ready'
  const c = compareVersions(installed, m.version)
  return c === 0 ? 'installed' : c < 0 ? 'upgrade' : 'newer'
}

export interface PlanInput {
  manifest: PackManifest
  /** Установленная версия ядра (если есть) */
  installed?: string
  /** Индексы пользователя: имя файла → разобранный JSON (null — файла нет или он не читается) */
  dataIndexes: Map<string, unknown | null>
  /** Файлы, уже лежащие в staging/packages: имя → размер */
  staged: Map<string, number>
  /** Уже установленные инструменты («пакетировщик/имя/версия»): их архивы копировать не нужно */
  installedTools?: Set<string>
  /** В каталоге данных уже есть library_index.json */
  hasLibraryIndex?: boolean
  /** Адреса из board_manager.additional_urls */
  configuredUrls: string[]
  /** Свободное место (байт) на томе каталога данных и на томе staging; sameVolume — это один том */
  freeData: number
  freeStaging: number
  sameVolume: boolean
}

export interface InstallPlan {
  action: 'skip' | 'install' | 'blocked'
  reason: string
  copyIndexes: PackIndexEntry[]
  /** Архивы, которые нужно скопировать в staging (уже лежащие с верным размером не копируются и потом не удаляются) */
  copyFiles: PackFileEntry[]
  /** Распаковать индекс библиотек в каталог данных */
  copyLibraryIndex: boolean
  addUrl: string | null
  needData: number
  needStaging: number
  command: string[]
}

const defaultIndexUrl = 'https://downloads.arduino.cc/packages/package_index.json'
const sameUrlLoose = (a: string, b: string): boolean => a.replace(/\/+$/, '').toLowerCase() === b.replace(/\/+$/, '').toLowerCase()

const GB = 1024 ** 3
export const fmtBytes = (n: number): string => (n >= GB ? (n / GB).toFixed(1).replace('.', ',') + ' ГБ' : Math.max(1, Math.round(n / 1048576)) + ' МБ')

/** Составляет план установки пакета; ничего не выполняет. */
export function planInstall(p: PlanInput): InstallPlan {
  const m = p.manifest
  const st = packStatus(m, p.installed)
  const empty: InstallPlan = { action: 'skip', reason: '', copyIndexes: [], copyFiles: [], copyLibraryIndex: false, addUrl: null, needData: 0, needStaging: 0, command: [] }
  if (st === 'installed') return { ...empty, reason: `Ядро ${m.coreId} версии ${m.version} уже установлено — ничего не меняю.` }
  if (st === 'newer') return { ...empty, reason: `Установлена более новая версия ${p.installed} — комплект (${m.version}) не нужен.` }

  const copyIndexes = m.indexes.filter((ix) => !indexSatisfies(p.dataIndexes.get(indexFileName(ix.url)) ?? null, m, ix.url))
  const copyLibraryIndex = !!m.libraryIndex && !p.hasLibraryIndex
  // Инструмент, который уже установлен, не копируем: arduino-cli его всё равно пропустит
  const need = m.files.filter((f) => f.kind === 'platform' || !p.installedTools?.has(`${f.packager}/${f.name}/${f.version}`))
  const copyFiles = need.filter((f) => p.staged.get(f.path.slice('packages/'.length)) !== f.size)
  const stagingBytes = copyFiles.reduce((s, f) => s + f.size, 0)
  // Распаковка занимает ≈ unpackFactor × размера архивов; архивы в staging временные (удаляются после установки)
  const needData = Math.round(need.reduce((s, f) => s + f.size, 0) * m.unpackFactor) + copyIndexes.reduce((s, x) => s + x.size * 2, 0) + (copyLibraryIndex ? 80 * 1048576 : 0)
  const needStaging = stagingBytes
  const addUrl = sameUrlLoose(m.indexUrl, defaultIndexUrl) || p.configuredUrls.some((u) => sameUrlLoose(u, m.indexUrl)) ? null : m.indexUrl
  const command = ['core', 'install', `${m.coreId}@${m.version}`, '--no-color']

  const lack = (need: number, free: number): boolean => free < need + 200 * 1048576
  if (p.sameVolume ? lack(needData + needStaging, Math.min(p.freeData, p.freeStaging)) : lack(needData, p.freeData) || lack(needStaging, p.freeStaging)) {
    const total = p.sameVolume ? needData + needStaging : Math.max(needData, needStaging)
    const free = p.sameVolume ? Math.min(p.freeData, p.freeStaging) : lack(needData, p.freeData) ? p.freeData : p.freeStaging
    return { ...empty, action: 'blocked', reason: `Недостаточно места на диске: нужно около ${fmtBytes(total)}, свободно ${fmtBytes(free)}. Освободите место и повторите.`, needData, needStaging }
  }
  return {
    action: 'install',
    reason: st === 'upgrade' ? `Обновление ${m.coreId} ${p.installed} → ${m.version} из комплекта.` : `Установка ${m.coreId} ${m.version} из комплекта.`,
    copyIndexes, copyFiles, copyLibraryIndex, addUrl, needData, needStaging, command
  }
}

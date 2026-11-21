// «Пакет поддержки чипа»: файлы CMSIS (заголовки ядра и устройства, system_*.c, startup_*.s) из первоисточников ST.
// Скачиваются по запросу (после подтверждения пользователя) с адресов неизменяемых коммитов тегов, проверяются по git-SHA-1 (blob) из манифеста,
// кэшируются в папке данных приложения и копируются в проект (drivers/CMSIS, startup/). Лицензия файлов — Apache-2.0 (© STMicroelectronics, © Arm).
import { createHash } from 'crypto'
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { listChips } from '../../../shared/pro/chipdb'
import type { ChipRecord } from '../../../shared/pro/chipdb'
import { STARTUP_PLACEHOLDER } from '../project/scaffold'
import type { ProProject } from '../project/types'
import { supportDir } from '../paths'
import { SUPPORT_CORES, SUPPORT_DEVICES } from './manifest'
import type { SupportFile, SupportSet } from './manifest'

export const RAW_HOST = 'raw.githubusercontent.com'

/** git-SHA-1 содержимого файла (как у объекта blob в git): sha1("blob <размер>\0" + содержимое). */
export function gitBlobSha1(data: Buffer): string {
  return createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')
}

/** Запись базы чипов, соответствующая проекту: по обозначению кристалла, иначе по имени startup-файла. */
export function chipRecordForProject(p: ProProject): ChipRecord | undefined {
  const name = p.target.chip.toLowerCase()
  const all = listChips()
  return all.find((c) => c.name.toLowerCase() === name) ?? all.find((c) => name.startsWith(c.id))
    ?? all.find((c) => p.startupFile.split('/').pop() === c.files.startup)
}

const familyOf = (header: string): string => /^(stm32[a-z]\d)/.exec(header)![1]

/** Папка устройства в проекте: drivers/CMSIS/Device/ST/STM32F1xx. */
export const deviceDirOf = (rec: ChipRecord): string => `drivers/CMSIS/Device/ST/${familyOf(rec.files.header).replace('stm32', 'STM32')}xx`

export interface SupportJob {
  url: string
  sha1: string
  size: number
  /** Путь в кэше (абсолютный) */
  cache: string
  /** Куда копировать в проекте (относительно корня) */
  dest: string
  /** Для startup — файл должен заменить заготовку */
  kind: 'core' | 'device' | 'system' | 'startup' | 'license'
}

const rawUrl = (s: SupportSet, f: SupportFile): string => `https://${RAW_HOST}/STMicroelectronics/${s.repo}/${s.commit}/${f.path.split('/').map(encodeURIComponent).join('/')}`
const cachePathOf = (s: SupportSet, f: SupportFile): string => join(supportDir(), `${s.repo}@${s.tag}`, ...f.path.split('/'))

export interface SupportPlan { chip: ChipRecord; jobs: SupportJob[]; bytes: number; sources: string[]; licenses: string[] }

/** Какие файлы нужны чипу: заголовки ядра, заголовки и system_*.c устройства, startup, лицензия. Ничего не скачивает. */
export function supportPlanFor(rec: ChipRecord, startupDest: string): SupportPlan | null {
  const dev = SUPPORT_DEVICES[rec.files.cmsisRepo]
  const coreKey = rec.core.toLowerCase().replace('+', 'plus')
  const core = SUPPORT_CORES[coreKey]
  if (!dev || !core) return null
  const fam = familyOf(rec.files.header)
  const devDir = deviceDirOf(rec)
  const jobs: SupportJob[] = []
  for (const f of core.files) jobs.push({ url: rawUrl(core, f), sha1: f.sha1, size: f.size, cache: cachePathOf(core, f), dest: 'drivers/CMSIS/Include/' + f.path.split('/').pop(), kind: 'core' })
  const want = new Set([`Include/${fam}xx.h`, `Include/system_${fam}xx.h`, `Include/${rec.files.header}`])
  for (const f of dev.files) {
    const base = f.path.split('/').pop()!
    let dest: string | null = null
    let kind: SupportJob['kind'] = 'device'
    if (want.has(f.path)) dest = `${devDir}/Include/${base}`
    else if (f.path === `Source/Templates/system_${fam}xx.c`) { dest = `${devDir}/Source/${base}`; kind = 'system' }
    else if (f.path === `Source/Templates/gcc/${rec.files.startup}`) { dest = startupDest; kind = 'startup' }
    else if (/^licen[cs]e(\.(md|txt))?$/i.test(f.path)) { dest = `${devDir}/${base}`; kind = 'license' }
    if (dest) jobs.push({ url: rawUrl(dev, f), sha1: f.sha1, size: f.size, cache: cachePathOf(dev, f), dest, kind })
  }
  if (!jobs.some((j) => j.kind === 'startup') || !jobs.some((j) => j.kind === 'system')) return null
  return {
    chip: rec, jobs, bytes: jobs.reduce((s, j) => s + j.size, 0),
    sources: [`https://github.com/STMicroelectronics/${dev.repo} (${dev.tag})`, `https://github.com/STMicroelectronics/${core.repo} (${core.tag})`],
    licenses: ['Apache-2.0 © STMicroelectronics, © Arm Limited']
  }
}

const exists = async (p: string): Promise<boolean> => !!(await stat(p).catch(() => null))

export interface SupportStatus {
  /** Чип проекта есть в базе и для него известны файлы */
  known: boolean
  chip?: string
  /** Всё нужное уже лежит в проекте */
  installed: boolean
  /** Файлов не хватает в проекте, но все они есть в кэше (копирование без интернета) */
  cached: boolean
  /** Размер недостающего (к скачиванию), байт */
  downloadBytes: number
  missing: string[]
  sources: string[]
  licenses: string[]
}

export async function supportStatus(root: string, project: ProProject): Promise<SupportStatus> {
  const rec = chipRecordForProject(project)
  if (!rec) return { known: false, installed: true, cached: false, downloadBytes: 0, missing: [], sources: [], licenses: [] }
  const plan = supportPlanFor(rec, project.startupFile)
  if (!plan) return { known: false, chip: rec.name, installed: true, cached: false, downloadBytes: 0, missing: [], sources: [], licenses: [] }
  const missing: string[] = []
  for (const j of plan.jobs) {
    const p = join(root, ...j.dest.split('/'))
    if (!(await exists(p))) missing.push(j.dest)
    else if (j.kind === 'startup' && (await readFile(p, 'utf8')).includes(STARTUP_PLACEHOLDER)) missing.push(j.dest)
  }
  let dl = 0
  let allCached = true
  for (const j of plan.jobs.filter((x) => missing.includes(x.dest))) {
    if (!(await cacheValid(j))) { allCached = false; dl += j.size }
  }
  return { known: true, chip: rec.name, installed: missing.length === 0, cached: missing.length > 0 && allCached, downloadBytes: dl, missing, sources: plan.sources, licenses: plan.licenses }
}

async function cacheValid(j: SupportJob): Promise<boolean> {
  try { return gitBlobSha1(await readFile(j.cache)) === j.sha1 } catch { return false }
}

export interface SupportHooks { log: (t: string) => void; progress: (label: string, pct: number | null) => void; signal: AbortSignal }

/** Скачивает недостающие файлы в кэш (с проверкой git-SHA-1). */
export async function fetchToCache(jobs: SupportJob[], h: SupportHooks, fetchImpl: typeof fetch = fetch): Promise<void> {
  const todo: SupportJob[] = []
  for (const j of jobs) if (!(await cacheValid(j))) todo.push(j)
  let i = 0
  for (const j of todo) {
    if (h.signal.aborted) throw new Error('Скачивание отменено.')
    h.progress('Скачивание файлов CMSIS', Math.floor((i / todo.length) * 100))
    h.log(`Скачиваю ${j.url.replace(/^https:\/\/raw\.githubusercontent\.com\/STMicroelectronics\//, '')}\n`)
    let res: Response
    try { res = await fetchImpl(j.url, { signal: h.signal }) } catch {
      if (h.signal.aborted) throw new Error('Скачивание отменено.')
      throw new Error(`Не удалось подключиться к ${RAW_HOST}. Проверьте интернет и повторите.`)
    }
    if (!res.ok) throw new Error(`Сервер ответил ${res.status} для ${j.dest}. Повторите позже.`)
    const buf = Buffer.from(await res.arrayBuffer())
    const sha = gitBlobSha1(buf)
    if (sha !== j.sha1) throw new Error(`Контрольная сумма файла ${j.dest.split('/').pop()} не совпала (git SHA-1 ${sha.slice(0, 12)}…, ожидалось ${j.sha1.slice(0, 12)}…). Файл не сохранён.`)
    await mkdir(dirname(j.cache), { recursive: true })
    const part = j.cache + '.part'
    await writeFile(part, buf)
    await rm(j.cache, { force: true })
    await rename(part, j.cache)
    i++
  }
  h.progress('Скачивание файлов CMSIS', 100)
}

/** Копирует файлы из кэша в проект; существующие файлы (кроме заготовки startup) не перезаписываются. Возвращает список записанных путей. */
export async function copyIntoProject(root: string, jobs: SupportJob[], opts: { overwrite?: boolean } = {}): Promise<string[]> {
  const written: string[] = []
  for (const j of jobs) {
    const dest = join(root, ...j.dest.split('/'))
    if (await exists(dest)) {
      const isStub = j.kind === 'startup' && (await readFile(dest, 'utf8')).includes(STARTUP_PLACEHOLDER)
      if (!isStub && !opts.overwrite) continue
    }
    await mkdir(dirname(dest), { recursive: true })
    await copyFile(j.cache, dest)
    written.push(j.dest)
  }
  if (written.length) {
    const notice = join(root, 'drivers', 'CMSIS', 'README.txt')
    if (!(await exists(notice))) {
      await writeFile(notice, 'Файлы CMSIS получены AVR IDE из репозиториев STMicroelectronics (cmsis_core, cmsis-device-*) и проверены по git-SHA-1.\nЛицензия — Apache-2.0 (© STMicroelectronics, © Arm Limited), тексты лицензий и SPDX-заголовки сохранены в файлах.\n', 'utf8')
    }
  }
  return written
}

/** Полный путь «скачать (если нужно) и подставить в проект». Вызывается только после подтверждения пользователя. */
export async function installSupport(root: string, project: ProProject, h: SupportHooks, fetchImpl?: typeof fetch): Promise<string[]> {
  const rec = chipRecordForProject(project)
  if (!rec) throw new Error('Для этого кристалла нет пакета поддержки: добавьте файлы CMSIS в проект вручную.')
  const plan = supportPlanFor(rec, project.startupFile)
  if (!plan) throw new Error('Для этого кристалла нет пакета поддержки: добавьте файлы CMSIS в проект вручную.')
  await fetchToCache(plan.jobs, h, fetchImpl)
  h.progress('Копирование в проект', null)
  const written = await copyIntoProject(root, plan.jobs)
  h.log(`В проект добавлено файлов: ${written.length}\n`)
  return written
}

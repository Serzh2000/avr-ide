// Настройки приложения и список недавних проектов (JSON в userData).
import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { basename, join } from 'path'
import { isFqbn } from './sketchyaml'
import type { RecentItem } from './types'

interface Persisted {
  cliPath: string | null
  sketchbookDir: string | null
  recent: RecentItem[]
}

let data: Persisted | null = null
const file = (): string => join(app.getPath('userData'), 'settings.json')

function load(): Persisted {
  if (data) return data
  data = { cliPath: null, sketchbookDir: null, recent: [] }
  try {
    const j = JSON.parse(readFileSync(file(), 'utf8')) as Partial<Persisted>
    if (typeof j.cliPath === 'string') data.cliPath = j.cliPath
    if (typeof j.sketchbookDir === 'string') data.sketchbookDir = j.sketchbookDir
    if (Array.isArray(j.recent)) {
      data.recent = j.recent
        .filter((r) => r && typeof r.path === 'string' && typeof r.lastOpened === 'number')
        .map((r) => ({ path: r.path, name: basename(r.path), lastOpened: r.lastOpened, ...(typeof r.fqbn === 'string' && isFqbn(r.fqbn) ? { fqbn: r.fqbn } : {}) }))
        .slice(0, 20)
    }
  } catch { /* нет файла или он повреждён — работаем с настройками по умолчанию */ }
  return data
}

function save(): void {
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(file(), JSON.stringify(load(), null, 2), 'utf8')
  } catch { /* не критично */ }
}

export const getCliPath = (): string | null => load().cliPath
export function setCliPath(p: string | null): void { load().cliPath = p; save() }

export const defaultSketchbook = (): string => join(app.getPath('documents'), 'Arduino')
export const getSketchbook = (): string => load().sketchbookDir ?? defaultSketchbook()
export function setSketchbook(p: string): void { load().sketchbookDir = p; save() }

export function getRecent(): RecentItem[] {
  return load().recent.filter((r) => existsSync(r.path))
}
/** Добавляет проект в начало списка; плата: переданная, иначе прежняя запись. */
export function addRecent(path: string, fqbn?: string | null): void {
  const d = load()
  const prev = d.recent.find((r) => r.path === path)
  const board = fqbn ?? prev?.fqbn
  d.recent = [{ path, name: basename(path), lastOpened: Date.now(), ...(board ? { fqbn: board } : {}) }, ...d.recent.filter((r) => r.path !== path)].slice(0, 20)
  save()
}
/** Запоминает плату проекта, не меняя порядок списка. */
export function setRecentBoard(path: string, fqbn: string): void {
  const r = load().recent.find((x) => x.path === path)
  if (r) { r.fqbn = fqbn; save() }
}
export function removeRecent(path: string): void {
  const d = load()
  d.recent = d.recent.filter((r) => r.path !== path)
  save()
}

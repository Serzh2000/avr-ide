// Встроенный проверенный каталог источников плат (data/boardsources/sources.json, собирается вместе с приложением)
// и пользовательские источники (userData/boardsources/custom.json).
import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import data from '../../../data/boardsources/sources.json'
import { sameUrl } from './core'
import type { CatalogSource, CustomSource } from './types'

export const catalog: CatalogSource[] = (data as unknown as { sources: CatalogSource[] }).sources

const dir = (): string => join(app.getPath('userData'), 'boardsources')
const file = (): string => join(dir(), 'custom.json')

let custom: CustomSource[] | null = null

export function getCustom(): CustomSource[] {
  if (custom) return custom
  custom = []
  try {
    const j = JSON.parse(readFileSync(file(), 'utf8')) as unknown
    if (Array.isArray(j)) {
      for (const c of j as Partial<CustomSource>[]) {
        if (c && typeof c.url === 'string' && typeof c.name === 'string' && Array.isArray(c.platforms)) {
          custom.push({
            url: c.url, https: !!c.https, name: c.name, maintainers: Array.isArray(c.maintainers) ? c.maintainers.filter((m): m is string => typeof m === 'string') : [],
            platforms: c.platforms.filter((p) => p && typeof p.id === 'string').map((p) => ({ id: p.id, name: String(p.name ?? p.id), latest: String(p.latest ?? '') })),
            addedAt: typeof c.addedAt === 'string' ? c.addedAt : ''
          })
        }
      }
    }
  } catch { /* файла нет — список пуст */ }
  return custom
}

function save(): void {
  try {
    mkdirSync(dir(), { recursive: true })
    writeFileSync(file(), JSON.stringify(getCustom(), null, 2), 'utf8')
  } catch { /* не критично */ }
}

export function rememberCustom(c: CustomSource): void {
  const list = getCustom()
  const i = list.findIndex((x) => sameUrl(x.url, c.url))
  if (i >= 0) list[i] = c
  else list.push(c)
  save()
}

export function forgetCustom(url: string): void {
  const before = getCustom()
  custom = before.filter((x) => !sameUrl(x.url, url))
  if (custom.length !== before.length) save()
}

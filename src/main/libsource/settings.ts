// Настройки источника GitHub: согласие на небезопасную установку, токен, свой список репозиториев.
// Хранится в userData/libsource/settings.json. Токен шифруется средствами ОС (safeStorage), если доступно.
import { app, safeStorage } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { repoId } from './repo'
import type { RepoId } from './types'

interface Persisted {
  consent: boolean
  /** «enc:<base64>» (safeStorage) или «raw:<текст>» */
  token: string | null
  custom: string[]
}

let data: Persisted | null = null

export const libsourceDir = (): string => join(app.getPath('userData'), 'libsource')
const file = (): string => join(libsourceDir(), 'settings.json')

function load(): Persisted {
  if (data) return data
  data = { consent: false, token: null, custom: [] }
  try {
    const j = JSON.parse(readFileSync(file(), 'utf8')) as Partial<Persisted>
    if (j.consent === true) data.consent = true
    if (typeof j.token === 'string') data.token = j.token
    if (Array.isArray(j.custom)) data.custom = j.custom.filter((s): s is string => typeof s === 'string').slice(0, 500)
  } catch { /* нет файла — значения по умолчанию */ }
  return data
}

function save(): void {
  try {
    mkdirSync(libsourceDir(), { recursive: true })
    writeFileSync(file(), JSON.stringify(load(), null, 2), 'utf8')
  } catch { /* не критично */ }
}

export const getConsent = (): boolean => load().consent
export function setConsent(v: boolean): void { load().consent = v; save() }

export const hasToken = (): boolean => !!load().token

/** Токен в открытом виде — только для заголовка запроса к api.github.com. Не логировать. */
export function getToken(): string | null {
  const t = load().token
  if (!t) return null
  try {
    if (t.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(t.slice(4), 'base64'))
    if (t.startsWith('raw:')) return t.slice(4)
  } catch { /* не удалось расшифровать */ }
  return null
}

export function setToken(token: string | null): void {
  const d = load()
  if (!token) d.token = null
  else if (safeStorage.isEncryptionAvailable()) d.token = 'enc:' + safeStorage.encryptString(token).toString('base64')
  else d.token = 'raw:' + token
  save()
}

export function getCustom(): RepoId[] {
  const out: RepoId[] = []
  for (const s of load().custom) {
    const [o, r] = s.split('/')
    const id = repoId(o, r)
    if (id) out.push(id)
  }
  return out
}

export function addCustom(id: RepoId): void {
  const d = load()
  const s = `${id.owner}/${id.repo}`
  if (!d.custom.some((x) => x.toLowerCase() === id.key)) d.custom.push(s)
  save()
}

export function removeCustom(id: RepoId): void {
  const d = load()
  d.custom = d.custom.filter((x) => x.toLowerCase() !== id.key)
  save()
}

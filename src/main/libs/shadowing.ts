// Старые копии сетевых библиотек (AsyncTCP 1.x от me-no-dev/dvarrel, ESPAsyncTCP 1.x и т. п.) перехватывают
// #include у актуальных версий ESP32Async: arduino-cli отдаёт приоритет библиотеке, чья папка совпадает
// с именем заголовка («AsyncTCP» для AsyncTCP.h), а актуальная лежит в «Async_TCP».
// Итог — ESP Async WebServer 3.x собирается со старым транспортом и падает с
// «passing 'const AsyncServer' as 'this' argument discards qualifiers».
// Здесь находим такие пары; при сборке актуальная версия передаётся через --library (у неё высший приоритет).
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

/** Заголовок → библиотека, которую IDE ставит сама (пакет встроенных библиотек). */
export const PREFERRED_PROVIDERS: Readonly<Record<string, string>> = {
  'AsyncTCP.h': 'Async TCP',
  'ESPAsyncTCP.h': 'ESP Async TCP',
  'ESPAsyncWebServer.h': 'ESP Async WebServer',
  'RPAsyncTCP.h': 'RPAsyncTCP'
}

export interface InstalledProvider { name: string; version: string; dir: string }
export interface ShadowedLibrary {
  header: string
  /** Актуальная библиотека, которую нужно использовать. */
  preferred: InstalledProvider
  /** Другие установленные библиотеки с тем же заголовком (обычно старые несовместимые версии). */
  others: InstalledProvider[]
}

const isFile = async (p: string): Promise<boolean> => !!(await stat(p).catch(() => null))?.isFile()

function props(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const m = /^\s*([\w.]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (m && !line.trimStart().startsWith('#')) out[m[1]] = m[2]
  }
  return out
}

/** Пары «актуальная + конкурирующие» среди пользовательских библиотек (папка libraries каталога Arduino). */
export async function findShadowedLibraries(userLibrariesDir: string): Promise<ShadowedLibrary[]> {
  const headers = Object.keys(PREFERRED_PROVIDERS)
  const providers = new Map<string, InstalledProvider[]>(headers.map((h) => [h, []]))
  let dirs: string[] = []
  try {
    dirs = (await readdir(userLibrariesDir, { withFileTypes: true })).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name)
  } catch {
    return []
  }
  for (const folder of dirs.slice(0, 2000)) {
    const dir = join(userLibrariesDir, folder)
    let p: Record<string, string> = {}
    try { p = props(await readFile(join(dir, 'library.properties'), 'utf8')) } catch { /* старый формат без library.properties */ }
    for (const h of headers) {
      if (!(await isFile(join(dir, 'src', h))) && !(await isFile(join(dir, h)))) continue
      providers.get(h)!.push({ name: p['name'] || folder, version: p['version'] || '', dir })
    }
  }
  const out: ShadowedLibrary[] = []
  for (const h of headers) {
    const list = providers.get(h)!
    const want = PREFERRED_PROVIDERS[h].toLowerCase()
    const preferred = list.find((l) => l.name.toLowerCase() === want)
    const others = list.filter((l) => l !== preferred)
    if (preferred && others.length) out.push({ header: h, preferred, others })
  }
  return out
}

/** Аргументы arduino-cli compile, которые закрепляют актуальные версии при конфликте. */
export function pinArgs(shadowed: ShadowedLibrary[]): string[] {
  return shadowed.flatMap((s) => ['--library', s.preferred.dir])
}

/** Строка для журнала сборки: что перекрыто и какой версией. */
export function shadowNote(shadowed: ShadowedLibrary[]): string {
  return shadowed.map((s) => `${s.header}: используется ${s.preferred.name} ${s.preferred.version}; старые копии не используются: ${s.others.map((o) => `${o.name}${o.version ? ' ' + o.version : ''}`).join(', ')}`).join('\n')
}

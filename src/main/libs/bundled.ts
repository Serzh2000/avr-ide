import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isLibName } from '../cli/validate'
import type { DependencyLibrary } from './dependencies'

export interface BundledLibrary extends DependencyLibrary { file: string; sha256: string; depends: string[] }

async function bundleDir(): Promise<string | undefined> {
  // electron подключается лениво: модуль используют и тесты вне Electron
  const appPath = await import('electron').then((m) => m.app?.getAppPath?.(), () => undefined)
  const candidates = [
    process.env.AVRIDE_LIBS_DIR,
    join(process.resourcesPath ?? '', 'libs'),
    appPath ? join(appPath, 'build', 'libs-bundle') : undefined
  ]
  return candidates.find((dir): dir is string => !!dir && existsSync(join(dir, 'manifest.json')))
}

/** Библиотеки, встроенные в установщик (scripts/build-lib-pack.mjs). Без пакета возвращает null. */
export async function bundledLibraries(): Promise<{ dir: string; libraries: BundledLibrary[] } | null> {
  const dir = await bundleDir()
  if (!dir) return null
  try {
    const list = (JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as { libraries?: unknown }).libraries
    if (!Array.isArray(list)) return null
    const libraries = list.flatMap((lib): BundledLibrary[] => {
      if (!lib || !isLibName(lib.name) || typeof lib.version !== 'string' || !/^[\w.+-]+\.zip$/.test(lib.file ?? '') ||
          !/^[0-9a-f]{64}$/.test(lib.sha256 ?? '') || !Array.isArray(lib.architectures)) return []
      return [{
        name: lib.name, version: lib.version, file: lib.file, sha256: lib.sha256,
        depends: Array.isArray(lib.depends) ? lib.depends.filter((d: unknown): d is string => typeof d === 'string' && isLibName(d)) : [],
        architectures: lib.architectures.filter((a: unknown): a is string => typeof a === 'string'),
        providesIncludes: Array.isArray(lib.providesIncludes) ? lib.providesIncludes.filter((h: unknown): h is string => typeof h === 'string') : undefined
      }]
    })
    return { dir, libraries }
  } catch { return null }
}

/** Путь к проверенному архиву встроенной библиотеки или null, если такой версии нет или файл повреждён. */
export async function bundledArchive(name: string, version: string | undefined): Promise<string | null> {
  const pack = await bundledLibraries()
  const lib = pack?.libraries.find((l) => l.name.toLowerCase() === name.toLowerCase() && l.version === version)
  if (!pack || !lib) return null
  const path = join(pack.dir, lib.file)
  try {
    return createHash('sha256').update(await readFile(path)).digest('hex') === lib.sha256 ? path : null
  } catch { return null }
}

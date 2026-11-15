import { app } from 'electron'
import { existsSync, statSync } from 'fs'
import { delimiter, join } from 'path'
import type { CliStatus } from './types'
import { getCliPath } from '../files/store'

const EXE = process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli'

export const INSTALL_HELP =
  'arduino-cli не найден. Сам IDE ничего не скачивает. Установите вручную одним из способов:\n' +
  '  1) скачайте архив с https://arduino.github.io/arduino-cli/latest/installation/ и положите ' +
  `${EXE} в папку resources рядом с приложением;\n` +
  '  2) либо установите arduino-cli так, чтобы он был доступен в PATH ' +
  '(Windows: winget install ArduinoSA.CLI; macOS: brew install arduino-cli).\n' +
  'После этого перезапустите IDE.'

function isFile(p: string): boolean {
  try {
    return existsSync(p) && statSync(p).isFile()
  } catch {
    return false
  }
}

/** Ищет бинарник: сначала resources рядом с приложением, затем PATH. */
export function findCli(): { path: string; source: 'bundled' | 'path' | 'custom' } | null {
  const custom = getCliPath()
  if (custom && isFile(custom)) return { path: custom, source: 'custom' }
  const bundled = [
    join(process.resourcesPath ?? '', EXE),
    join(process.resourcesPath ?? '', 'resources', EXE),
    join(app.getAppPath(), 'resources', EXE),
    join(process.cwd(), 'resources', EXE)
  ]
  for (const p of bundled) if (isFile(p)) return { path: p, source: 'bundled' }

  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue
    const p = join(dir.replace(/^"|"$/g, ''), EXE)
    if (isFile(p)) return { path: p, source: 'path' }
  }
  return null
}

export function statusFromPath(found: ReturnType<typeof findCli>, version?: string): CliStatus {
  if (!found) return { found: false, help: INSTALL_HELP }
  return { found: true, path: found.path, source: found.source, version }
}

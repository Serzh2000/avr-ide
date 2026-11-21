// Пути к внешним программам Pro-режима, заданные пользователем (общая настройка для этапов B и C): userData/pro-tools.json.
import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { findTool } from './find'
import type { FoundTool } from './find'

const file = (): string => join(app.getPath('userData'), 'pro-tools.json')
export const toolsDir = (): string => join(app.getPath('userData'), 'pro-tools')

export function readToolPaths(): Record<string, string> {
  try {
    const j = JSON.parse(readFileSync(file(), 'utf8')) as unknown
    if (j && typeof j === 'object') return Object.fromEntries(Object.entries(j).filter(([, v]) => typeof v === 'string')) as Record<string, string>
  } catch { /* файла нет */ }
  return {}
}

export function setToolPath(tool: string, path: string | null): void {
  const all = readToolPaths()
  if (path) all[tool] = path
  else delete all[tool]
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(file(), JSON.stringify(all, null, 2), 'utf8')
}

/** Единая точка поиска программы: locateTool('openocd'), locateTool('arm-none-eabi-gdb'), locateTool('arm-none-eabi-gcc'). */
export function locateTool(tool: string): FoundTool | null {
  return findTool(tool, { custom: readToolPaths()[tool], userDataDir: app.getPath('userData') })
}

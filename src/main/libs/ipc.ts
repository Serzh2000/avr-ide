import { ipcMain } from 'electron'
import type { CliResult } from '../cli/types'
import type { LibsForSketchOptions, ProjectLibrary } from './types'

// ЗАГЛУШКА: реализацию пишет агент парсера библиотек (файлы main/libs/**).
// Контракт каналов: libs:for-sketch (code, options) → ProjectLibrary[]

export function registerLibsIpc(): void {
  ipcMain.handle(
    'libs:for-sketch',
    async (_e, _code: string, _options?: LibsForSketchOptions): Promise<CliResult<ProjectLibrary[]>> => ({ ok: true, data: [] })
  )
}

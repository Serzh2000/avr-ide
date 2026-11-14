import type { FuncEntry, PlatformId } from './types'
import { functions } from './data'
import { lookupIn, search as searchIn } from './search'

export type { FuncEntry, BoardEntry, PinInfo, FuncParam, PlatformId } from './types'
export { PLATFORM_LABELS, ALL_PLATFORMS } from './types'
export { functions, boards } from './data'
export { tokenize, scoreEntry } from './search'

/** Поиск по справочнику. */
export function search(query: string, platform?: PlatformId | 'all'): FuncEntry[] {
  return searchIn(functions, query, platform)
}

/** Для F1 в редакторе: запись по слову под курсором (undefined, если не найдено). */
export function lookup(word: string, platform?: PlatformId | string): FuncEntry | undefined {
  return lookupIn(functions, word, platform)
}

export { default as ReferencePanel } from './ReferencePanel'

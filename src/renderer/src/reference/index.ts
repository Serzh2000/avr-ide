import type { FuncEntry, PlatformId } from './types'
import { functions } from './data'
import { lookupIn, search as searchIn } from './search'
import { getLibIndex } from '../libs/store'
import { libEntriesFor, lookupLibEntry } from './libEntries'

export type { FuncEntry, BoardEntry, PinInfo, FuncParam, PlatformId } from './types'
export { PLATFORM_LABELS, ALL_PLATFORMS } from './types'
export { functions, boards } from './data'
export { tokenize, scoreEntry } from './search'
export { refToEntry, libEntriesFor, lookupLibEntry } from './libEntries'

/**
 * Поиск по справочнику. К встроенным записям добавляются символы библиотек, подключённых в проекте
 * (запись помечена полем source; без запроса библиотеки не примешиваются).
 */
export function search(query: string, platform?: PlatformId | 'all'): FuncEntry[] {
  return [...searchIn(functions, query, platform), ...libEntriesFor(getLibIndex(), query)]
}

/** Для F1 в редакторе: запись по слову под курсором (undefined, если не найдено); затем символы библиотек проекта. */
export function lookup(word: string, platform?: PlatformId | string): FuncEntry | undefined {
  return lookupIn(functions, word, platform) ?? lookupLibEntry(getLibIndex(), word)
}

export { default as ReferencePanel } from './ReferencePanel'

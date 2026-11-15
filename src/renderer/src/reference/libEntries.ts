// Символы библиотек проекта → записи справочника (для общего поиска и lookup). Чистая логика.
import type { ProjectLibrary } from '../contracts'
import { ALL_PLATFORMS, type FuncEntry } from './types'
import { buildIndex, kindLabel, lookupRef, refName, searchRefs, shortSignature, type LibIndex, type LibRef } from '../libs/model'

export function refToEntry(r: LibRef): FuncEntry {
  const s = r.sym
  return {
    name: refName(s),
    category: `Библиотека: ${r.lib.name}`,
    signature: shortSignature(s),
    description: s.doc?.split('\n')[0] ?? `${kindLabel(s.kind)} из заголовка ${s.header}`,
    params: (s.params ?? []).map((p) => ({ name: p.name || '…', type: p.type + (p.defaultValue !== undefined ? ` = ${p.defaultValue}` : ''), desc: paramDoc(s.doc, p.name) })),
    returns: s.returns ?? '',
    example: '',
    platforms: [...ALL_PLATFORMS],
    source: { lib: r.lib.name, version: r.lib.version, header: s.header, line: s.line, kind: s.kind }
  }
}

function paramDoc(doc: string | undefined, name: string): string {
  if (!doc || !name) return ''
  const m = new RegExp(`^${name}\s+—\s+(.+)$`, 'm').exec(doc)
  return m ? m[1] : ''
}

/** Записи для поиска по запросу (пусто, если запрос пустой — в обычном списке библиотек нет). */
export function libEntriesFor(index: LibIndex, query: string, limit = 120): FuncEntry[] {
  if (!query.trim()) return []
  return searchRefs(index, query, limit).map(refToEntry)
}

export function libEntriesOf(libs: ProjectLibrary[]): FuncEntry[] {
  return buildIndex(libs).all.map(refToEntry)
}

/** Для lookup: запись по слову/«Класс.метод» среди символов библиотек. */
export function lookupLibEntry(index: LibIndex, word: string): FuncEntry | undefined {
  const r = lookupRef(index, word)
  return r ? refToEntry(r) : undefined
}

// Типы обмена между редактором (renderer) и службой индекса символов (main). Только данные.
import type { SymKind } from '../../../shared/pro/cindex/types'

export type { SymKind }

export interface SymLoc { path: string; line: number; col: number }

export interface SymDto extends SymLoc {
  name: string
  kind: SymKind
  /** Объявление одной строкой */
  detail?: string
  doc?: string
  /** Владелец (тип поля, enum перечислителя) */
  parent?: string
  /** Файл проекта (не CMSIS/HAL) */
  own: boolean
}

export interface IndexStatus {
  /** Папка проекта, для которой собран индекс */
  root: string
  ready: boolean
  building: boolean
  files: number
  symbols: number
  /** Сколько файлов разобрано заново и сколько взято из кэша при последней сборке */
  parsed: number
  cached: number
  ms: number
  error?: string
}

export interface CompletionItemDto {
  label: string
  kind: SymKind | 'file' | 'keyword'
  detail?: string
  doc?: string
  /** Порядок: меньше — выше */
  sort: number
  own: boolean
  /** Что вставить, если отличается от label */
  insert?: string
}

export interface CompletionDto { items: CompletionItemDto[]; incomplete: boolean; context: 'member' | 'plain' | 'include' | 'none' }

export interface HoverDto {
  /** Границы слова в строке (0-based) */
  start: number
  end: number
  code: string
  doc?: string
  facts: string[]
  where?: SymLoc & { own: boolean }
}

export interface SignatureDto {
  signatures: { label: string; doc?: string; params: string[] }[]
  active: number
  activeParam: number
}

export interface RefMatch { path: string; line: number; col: number; text: string; len: number }

export interface RenameFile { path: string; count: number; matches: RefMatch[]; newText: string }
export type RenamePlan =
  | { ok: true; name: string; newName: string; kind: SymKind; files: RenameFile[]; warning?: string }
  | { ok: false; error: string }

export interface CursorReq {
  path: string
  /** Строка (с 1) и столбец (с 1) курсора */
  line: number
  col: number
  lineText: string
  /** Текст файла от начала до курсора (для локальных переменных и контекста) */
  before: string
}

export interface FormatResult { ok: boolean; text?: string; error?: string }

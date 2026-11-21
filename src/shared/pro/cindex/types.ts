// Индекс символов C/C++ для Pro-режима: типы. Чистые данные (JSON-совместимы: хранятся в кэше на диске).

export type SymKind = 'macro' | 'function' | 'variable' | 'struct' | 'union' | 'enum' | 'class' | 'typedef' | 'enumerator' | 'field' | 'label'

/** Символ. Короткие ключи: десятки тысяч макросов CMSIS хранятся в кэше и в памяти. */
export interface Sym {
  /** имя */
  n: string
  k: SymKind
  /** строка (с 1) и столбец (с 1) имени */
  l: number
  c: number
  /** индекс файла в проекте (заполняется при сборке индекса, в кэше файла не хранится) */
  f?: number
  /** объявление одной строкой (для hover и списка) */
  s?: string
  /** макрос: значение; перечисление: выражение значения */
  v?: string
  /** doc-комментарий */
  d?: string
  /** тип (для переменной, поля, typedef — на что указывает; для tag-имени — typedef-имя) без const/volatile/указателей */
  t?: string
  /** владелец: тип, которому принадлежит поле, перечислитель или метод */
  p?: string
  /** параметры функции или функционального макроса */
  a?: string[]
  /** тип результата функции */
  r?: string
  /** размеры массива («5», «2*3») */
  arr?: string
  /** битовое поле: ширина */
  bits?: number
  /** указатель */
  ptr?: 1
  /** у функции есть тело (определение) */
  b?: 1
  /** static */
  st?: 1
}

export interface IncludeRef { name: string; sys: boolean; line: number }

export interface FileIndex {
  includes: IncludeRef[]
  syms: Sym[]
  lines: number
  /** Внешние макросы, от которых зависят условия файла: имя → значение при разборе (null — не было). Нужны для проверки кэша. */
  free: [string, string | null][]
}

export const EMPTY_INDEX: FileIndex = { includes: [], syms: [], lines: 0, free: [] }

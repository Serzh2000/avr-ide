// Типы источника библиотек «GitHub» (используются в main и, как типы, в renderer).

export type RefKind = 'tag' | 'branch' | 'default'

export interface RepoId {
  owner: string
  repo: string
  /** Ключ для сопоставления: «owner/repo» в нижнем регистре */
  key: string
}

/** Строка каталога. */
export interface CatalogEntry {
  /** «owner/repo» в том регистре, как в реестре */
  id: string
  owner: string
  repo: string
  /** Имя для показа: название из индекса Arduino либо «owner/repo» */
  name: string
  author?: string
  sentence?: string
  category?: string
  /** Версия из индекса Arduino (самая новая) */
  latest?: string
  /** Есть запись в library_index.json (т.е. библиотека проверена Arduino) */
  inIndex: boolean
  /** Репозиторий из пользовательского списка */
  custom?: boolean
}

export interface SearchResult {
  total: number
  offset: number
  items: CatalogEntry[]
}

export interface CatalogStatus {
  /** Каталог когда-либо загружался (есть кэш) */
  loaded: boolean
  /** Время обновления списка репозиториев и индекса (мс, 0 — нет) */
  registryAt: number
  indexAt: number
  total: number
  inIndex: number
  custom: number
  /** Пользователь согласился на установку «небезопасных» zip-архивов */
  consent: boolean
  hasToken: boolean
  /** Идёт загрузка каталога */
  refreshing: boolean
}

export interface RefList {
  tags: string[]
  defaultBranch?: string
  /** Откуда получен список */
  source: 'git' | 'api' | 'none'
  /** Пояснение для пользователя (например, про лимит API) */
  note?: string
}

export interface DependInfo {
  name: string
  constraint?: string
  installed: boolean
}

/** Результат установки (отправляется событием libsource:result перед cli:done). */
export interface InstallResult {
  opId: number
  owner: string
  repo: string
  ok: boolean
  name?: string
  version?: string
  depends: DependInfo[]
  /** Предупреждения (нет library.properties и т.п.) */
  warnings: string[]
}

export interface RefreshProgress {
  text: string
}

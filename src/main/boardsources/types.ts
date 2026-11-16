// Типы каталога «Источников плат» (адреса пакетов Boards Manager). Используются в main, preload и renderer — только как типы.

/** Ядро (платформа) из индекса источника. */
export interface SourceCore {
  /** vendor:arch, как в arduino-cli */
  id: string
  name: string
  latest: string
  releases: number
  boardExamples: string[]
  /** Названия плат из последнего релиза (для поиска в мастере) */
  boards: string[]
}

/** Проверенный источник из data/boardsources/sources.json. */
export interface CatalogSource {
  id: string
  name: string
  maintainer: string
  url: string
  architectures: string[]
  description: string
  tags: string
  cores: SourceCore[]
  verifiedAt: string
  platformsCount: number
  releasesCount: number
  https: boolean
}

/** Платформа из проверки произвольного адреса. */
export interface IndexPlatform {
  id: string
  name: string
  latest: string
  releases: number
  boards: string[]
}

export interface IndexSummary {
  platforms: IndexPlatform[]
  maintainers: string[]
}

/** Результат проверки адреса (показывается пользователю ДО добавления). */
export interface UrlCheck {
  url: string
  https: boolean
  /** Размер скачанного индекса, байт */
  size: number
  summary: IndexSummary
  /** Адрес уже есть в конфигурации arduino-cli */
  alreadyConnected: boolean
  /** Адрес из проверенного каталога (id источника) */
  catalogId?: string
}

/** Источник, добавленный пользователем вручную (хранится в настройках приложения). */
export interface CustomSource {
  url: string
  https: boolean
  name: string
  maintainers: string[]
  platforms: { id: string; name: string; latest: string }[]
  addedAt: string
}

/** Источник, как его видит панель: каталожный, пользовательский или «чужой» адрес из конфига. */
export interface SourceView {
  kind: 'catalog' | 'custom' | 'other'
  id: string
  name: string
  maintainer: string
  url: string
  https: boolean
  description: string
  platformsCount: number
  connected: boolean
  verifiedAt?: string
  cores: { id: string; name: string; latest: string }[]
}

export interface SourcesState {
  sources: SourceView[]
  /** Все адреса из board_manager.additional_urls */
  configured: string[]
  /** Путь к конфигу arduino-cli, если удалось определить */
  configPath?: string
}

/** Найденное ядро в группе поиска. */
export interface FoundCore {
  id: string
  name: string
  latest?: string
  installed?: string
}

export interface CoreGroup {
  /** id источника или '_arduino' / '_unknown' */
  sourceId: string
  title: string
  /** Адрес источника, если он известен */
  url?: string
  cores: FoundCore[]
}

/** Источник из каталога, который подходит к запросу, но ещё не подключён. */
export interface CatalogHit {
  source: SourceView
  /** Что именно подошло: ядра или платы (для показа) */
  matches: string[]
  /** id подошедших ядер — их и предлагаем установить */
  coreIds: string[]
}

export interface CoreSearchResult {
  groups: CoreGroup[]
  hits: CatalogHit[]
}

export type { CliResult } from '../cli/types'

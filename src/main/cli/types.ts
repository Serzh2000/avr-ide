// Общие типы IPC-контракта arduino-cli (используются и в main, и в renderer — только как типы).

export type CliResult<T> = { ok: true; data: T } | { ok: false; error: string; notFound?: boolean }

export interface CliStatus {
  found: boolean
  path?: string
  version?: string
  source?: 'bundled' | 'path' | 'custom'
  /** Инструкция по установке, если бинарник не найден */
  help?: string
}

export interface PortInfo {
  address: string
  label: string
  protocol: string
  boards: { name: string; fqbn?: string }[]
}

export interface BoardEntry {
  name: string
  fqbn: string
  /** id платформы, например esp32:esp32 */
  platform: string
}

/** Один выпадающий параметр платы (например, «Способ загрузки») из `arduino-cli board details`. */
export interface BoardOption {
  /** Идентификатор для FQBN: upload_method */
  id: string
  label: string
  values: { value: string; label: string; selected: boolean }[]
}

export interface BoardDetails {
  fqbn: string
  name: string
  options: BoardOption[]
}

export interface EspUrlsStatus {
  esp8266: boolean
  esp32: boolean
}

export interface CoreInfo {
  id: string
  name: string
  installed?: string
  latest?: string
}

export interface LibInfo {
  name: string
  version?: string
  latest?: string
  sentence?: string
  /** Папка установленной библиотеки */
  installDir?: string
}

export type OpKind = 'compile' | 'upload' | 'core-install' | 'lib-install' | 'index-update' | 'config'

export interface LogEvent {
  opId: number
  stream: 'stdout' | 'stderr' | 'info'
  text: string
}

export interface DoneEvent {
  opId: number
  kind: OpKind
  code: number | null
  cancelled: boolean
}

export interface MonitorDataEvent {
  text: string
  stream: 'stdout' | 'stderr'
}

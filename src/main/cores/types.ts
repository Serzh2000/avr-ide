// Типы IPC «пакетов ядер» (используются и в main, и в renderer — только как типы).

export type PackUiStatus = 'ready' | 'installed' | 'upgrade' | 'newer' | 'invalid' | 'archive'

export interface PackInfo {
  /** Непрозрачный ключ: по нему main находит пакет заново, пути из renderer не принимаются */
  key: string
  /** id пакета: avr / esp8266 / esp32 */
  id: string
  title: string
  /** vendor:arch, например esp32:esp32 */
  coreId: string
  version: string
  origin: 'bundled' | 'external'
  /** Где лежит (для встроенных — пусто) */
  where: string
  /** Размер архивов в пакете, байт */
  bytes: number
  /** Сколько места нужно на диске при установке, байт (оценка) */
  diskNeed: number
  status: PackUiStatus
  installedVersion?: string
  /** Что не так (для invalid) или подсказка (для archive) */
  error?: string
}

export interface PacksState {
  packs: PackInfo[]
  /** Папки, где искали внешние пакеты (для подсказки в интерфейсе) */
  searched: string[]
  /** Папки, добавленные пользователем */
  custom: string[]
}

export interface PackProgressEvent { opId: number; label: string; pct: number | null }

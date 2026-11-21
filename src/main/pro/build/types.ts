// Типы IPC сборки Pro-режима (используются и в main, и в renderer — только как типы).
import type { SizeReport, MapReport } from '../interfaces'
import type { BlockCode } from './provider'
import type { RegionUsage } from './mapParse'
import type { SupportStatus } from '../support/support'
import type { ToolchainSource } from './toolchain'

export interface ToolchainPackageInfo {
  title: string
  /** Размер скачивания и места на диске после распаковки, байт */
  downloadBytes: number
  diskBytes: number
  /** Откуда скачивается (хост) и полный адрес */
  host: string
  url: string
  sha256: string
  license: string
  sources: string
  homepage: string
  /** Установка доступна на этой ОС */
  supported: boolean
}

export interface ToolchainStatus {
  found: boolean
  bin?: string
  version?: string
  source?: ToolchainSource
  sourceLabel?: string
  /** Путь, который пользователь указал в настройках, и он не подошёл */
  settingPath?: string
  settingBad: boolean
  tried: string[]
  /** Компилятор, установленный самим приложением, есть на диске */
  appInstalled: boolean
  pkg: ToolchainPackageInfo
}

export type PreflightResult = { ok: true } | { ok: false; code: BlockCode; message: string }

export interface BuildReportDto {
  configuration: string
  at: number
  size: SizeReport
  regions: RegionUsage[]
  map: MapReport
  artifacts: { elf: string; bin?: string; hex?: string; map?: string }
}

export interface ProProgressEvent { opId: number; label: string; pct: number | null }
export type { SupportStatus, BlockCode }

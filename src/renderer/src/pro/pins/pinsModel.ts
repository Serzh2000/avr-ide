// Производные данные конфигуратора: корпус, занятость выводов, проблемы, частоты. Считаются из рабочей копии конфигурации.
import { useMemo } from 'react'
import type { ChipPackage, ChipRecord } from '../../../../shared/pro/chipdb'
import { clockProfile, computeClock } from '../../../../shared/pro/pinconfig/clock'
import type { ClockProfile, ClockResult } from '../../../../shared/pro/pinconfig/clock'
import { genFamily } from '../../../../shared/pro/pinconfig/gen/support'
import { peripheralsIn, pinGuards, pinUsage } from '../../../../shared/pro/pinconfig/model'
import type { PeriphInfo, PinGuard, Usage } from '../../../../shared/pro/pinconfig/model'
import { checkConfig, conflictPins } from '../../../../shared/pro/pinconfig/validate'
import type { PinIssue, PinsConfig } from '../../../../shared/pro/pinconfig/types'

export interface PinsModel {
  chip: ChipRecord
  pkg: ChipPackage
  usage: Map<string, Usage[]>
  guards: Map<string, PinGuard[]>
  issues: PinIssue[]
  conflicts: Set<string>
  periphs: PeriphInfo[]
  profile: ClockProfile
  clock: ClockResult
  family: ReturnType<typeof genFamily>
}

export function buildModel(chip: ChipRecord, cfg: PinsConfig): PinsModel {
  const pkg = chip.packages.find((p) => p.name === cfg.package) ?? chip.packages[0]
  const issues = checkConfig(cfg)
  return {
    chip, pkg, usage: pinUsage(cfg, pkg), guards: pinGuards(pkg), issues, conflicts: conflictPins(issues),
    periphs: peripheralsIn(pkg), profile: clockProfile(chip), clock: computeClock(chip, cfg.clock), family: genFamily(chip)
  }
}

export function usePinsModel(chip: ChipRecord | undefined, cfg: PinsConfig | null): PinsModel | null {
  return useMemo(() => (chip && cfg ? buildModel(chip, cfg) : null), [chip, cfg])
}

export const fmtHz = (hz: number): string => {
  if (!hz) return '—'
  if (hz >= 1e6) return `${+(hz / 1e6).toFixed(3)} МГц`
  if (hz >= 1e3) return `${+(hz / 1e3).toFixed(2)} кГц`
  return `${hz} Гц`
}

// Список плат для мастера «Новый проект» (Pro-режим). Данные кристалла (память, макрос устройства, startup, файл OpenOCD, ядро, FPU) берутся из базы чипов
// (src/shared/pro/chipdb.ts), если кристалл в ней есть; значения в записях ниже — запасные (для кристаллов вне базы, например L432KC).
// Светодиоды плат — из заголовков вариантов ядра STM32duino (src/shared/pro/boardFacts.ts).
import { getChip } from '../../../shared/pro/chipdb'
import type { ChipRecord } from '../../../shared/pro/chipdb'
import { defaultFpu } from '../build/flags'
import { SCHEMA_VERSION } from './types'
import type { BuildConfiguration, CoreKind, FloatAbi, FpuKind, NamedMemoryRegion, ProProject } from './types'

export type LedLevel = 'low' | 'high'
export interface ProPreset {
  /** Идентификатор платы в справочнике (reference/data/*): по нему мастер подтягивает рисунок и название */
  boardId: string
  board: string
  chip: string
  family: string
  /** CMSIS-заголовок устройства */
  header: string
  /** Макрос устройства для компилятора (из stm32xxxx.h), например STM32F103xB */
  deviceDefine: string
  /** Имя startup-файла из CMSIS-пакета ST */
  startup: string
  core: CoreKind
  fpu?: FpuKind
  floatAbi?: FloatAbi
  hseHz?: number
  sysclkHz: number
  flashBytes: number
  ramBytes: number
  extraRam?: NamedMemoryRegion[]
  /** Целевой файл OpenOCD */
  openocdTarget: string
  /** Светодиод платы для шаблона «Мигание»: порт, номер, уровень включения */
  led: { port: 'A' | 'B' | 'C'; pin: number; on: LedLevel; name: string }
  /** Серия для генерации кода регистров */
  series: 'F1' | 'F3' | 'F4' | 'G4' | 'L1' | 'L4'
  /** Начало Flash и основной RAM, если не стандартные 0x08000000 / 0x20000000 (из базы чипов) */
  flashOrigin?: string
  ramOrigin?: string
}

const K = 1024

const BASE_PRESETS: ProPreset[] = [
  { boardId: 'bluepill', board: 'Blue Pill', chip: 'STM32F103C8T6', family: 'STM32F1', header: 'stm32f1xx.h', deviceDefine: 'STM32F103xB', startup: 'startup_stm32f103xb.s',
    core: 'cortex-m3', hseHz: 8_000_000, sysclkHz: 72_000_000, flashBytes: 64 * K, ramBytes: 20 * K, openocdTarget: 'target/stm32f1x.cfg', led: { port: 'C', pin: 13, on: 'low', name: 'PC13' }, series: 'F1' },
  { boardId: 'blackpill-f411', board: 'Black Pill', chip: 'STM32F411CEU6', family: 'STM32F4', header: 'stm32f4xx.h', deviceDefine: 'STM32F411xE', startup: 'startup_stm32f411xe.s',
    core: 'cortex-m4', fpu: 'fpv4-sp-d16', floatAbi: 'hard', hseHz: 25_000_000, sysclkHz: 100_000_000, flashBytes: 512 * K, ramBytes: 128 * K, openocdTarget: 'target/stm32f4x.cfg', led: { port: 'C', pin: 13, on: 'low', name: 'PC13' }, series: 'F4' },
  { boardId: 'nucleo-f401re', board: 'NUCLEO-F401RE', chip: 'STM32F401RET6', family: 'STM32F4', header: 'stm32f4xx.h', deviceDefine: 'STM32F401xE', startup: 'startup_stm32f401xe.s',
    core: 'cortex-m4', fpu: 'fpv4-sp-d16', floatAbi: 'hard', hseHz: 8_000_000, sysclkHz: 84_000_000, flashBytes: 512 * K, ramBytes: 96 * K, openocdTarget: 'target/stm32f4x.cfg', led: { port: 'A', pin: 5, on: 'high', name: 'PA5 (LD2)' }, series: 'F4' },
  { boardId: 'nucleo-f411re', board: 'NUCLEO-F411RE', chip: 'STM32F411RET6', family: 'STM32F4', header: 'stm32f4xx.h', deviceDefine: 'STM32F411xE', startup: 'startup_stm32f411xe.s',
    core: 'cortex-m4', fpu: 'fpv4-sp-d16', floatAbi: 'hard', hseHz: 8_000_000, sysclkHz: 100_000_000, flashBytes: 512 * K, ramBytes: 128 * K, openocdTarget: 'target/stm32f4x.cfg', led: { port: 'A', pin: 5, on: 'high', name: 'PA5 (LD2)' }, series: 'F4' },
  { boardId: 'nucleo-f446re', board: 'NUCLEO-F446RE', chip: 'STM32F446RET6', family: 'STM32F4', header: 'stm32f4xx.h', deviceDefine: 'STM32F446xx', startup: 'startup_stm32f446xx.s',
    core: 'cortex-m4', fpu: 'fpv4-sp-d16', floatAbi: 'hard', hseHz: 8_000_000, sysclkHz: 180_000_000, flashBytes: 512 * K, ramBytes: 128 * K, openocdTarget: 'target/stm32f4x.cfg', led: { port: 'A', pin: 5, on: 'high', name: 'PA5 (LD2)' }, series: 'F4' },
  { boardId: 'nucleo-f103rb', board: 'NUCLEO-F103RB', chip: 'STM32F103RBT6', family: 'STM32F1', header: 'stm32f1xx.h', deviceDefine: 'STM32F103xB', startup: 'startup_stm32f103xb.s',
    core: 'cortex-m3', hseHz: 8_000_000, sysclkHz: 72_000_000, flashBytes: 128 * K, ramBytes: 20 * K, openocdTarget: 'target/stm32f1x.cfg', led: { port: 'A', pin: 5, on: 'high', name: 'PA5 (LD2)' }, series: 'F1' },
  { boardId: 'nucleo-l432kc', board: 'NUCLEO-L432KC', chip: 'STM32L432KCU6', family: 'STM32L4', header: 'stm32l4xx.h', deviceDefine: 'STM32L432xx', startup: 'startup_stm32l432xx.s',
    core: 'cortex-m4', fpu: 'fpv4-sp-d16', floatAbi: 'hard', sysclkHz: 80_000_000, flashBytes: 256 * K, ramBytes: 48 * K, extraRam: [{ name: 'SRAM2', origin: '0x10000000', size: 16 * K }], openocdTarget: 'target/stm32l4x.cfg', led: { port: 'B', pin: 3, on: 'high', name: 'PB3 (LD3)' }, series: 'L4' }
]

const num = (n: number): string => '0x' + n.toString(16).toUpperCase().padStart(8, '0')

const coreOfDb = (c: string): CoreKind => (c.toLowerCase().replace('+', 'plus') as CoreKind)

interface MergedRegion { name: string; origin: number; size: number }
const mergeContiguous = (list: MergedRegion[]): MergedRegion[] => {
  const out: MergedRegion[] = []
  for (const r of [...list].sort((a, b) => a.origin - b.origin)) {
    const last = out[out.length - 1]
    if (last && last.origin + last.size === r.origin) last.size += r.size
    else out.push({ ...r })
  }
  return out
}

/** Память проекта по базе чипов: соседние области Flash и RAM сливаются (SRAM1+SRAM2, банки Flash); основная RAM — самая большая, остальное — дополнительные области. */
export function memoryFromChip(c: ChipRecord): ProProject['target']['memory'] {
  const flash = mergeContiguous(c.regions.filter((r) => r[3] === 'flash').map(([name, origin, size]) => ({ name, origin, size })))
  const ram = mergeContiguous(c.regions.filter((r) => r[3] === 'ram').map(([name, origin, size]) => ({ name, origin, size })))
  const mainFlash = flash.find((r) => r.origin === 0x08000000) ?? flash[0]
  const mainRam = [...ram].sort((a, b) => b.size - a.size)[0]
  const extra = ram.filter((r) => r !== mainRam).map((r) => ({ name: r.name, origin: num(r.origin), size: r.size }))
  return { flash: { origin: num(mainFlash.origin), size: mainFlash.size }, ram: { origin: num(mainRam.origin), size: mainRam.size }, ...(extra.length ? { extra } : {}) }
}

/** Запись для кристалла из базы: данные берутся оттуда, а остальное (плата, светодиод) — из описания. */
function applyChip(p: ProPreset, c: ChipRecord): ProPreset {
  const mem = memoryFromChip(c)
  const core = coreOfDb(c.core)
  const fpu = c.fpu ? defaultFpu(core) : undefined
  return {
    ...p, family: c.family, header: c.files.header.replace(/^(stm32[a-z]\d).*/, '$1xx.h'), deviceDefine: c.files.define, startup: c.files.startup,
    core, fpu, floatAbi: fpu ? 'hard' : undefined, flashBytes: mem.flash.size, ramBytes: mem.ram.size, extraRam: mem.extra,
    flashOrigin: mem.flash.origin, ramOrigin: mem.ram.origin, openocdTarget: 'target/' + c.files.openocd
  }
}

const dbChip = (name: string): ChipRecord | undefined => getChip(name.toLowerCase().replace(/[a-z]\d$/, ''))

/** Новые платы на кристаллах базы. Светодиоды: variant_*.h ядра STM32duino (G474RE, L476RG, F303RE, L152RE — LED_GREEN = PA5; G431KB — PB8). */
const DB_BOARDS: Pick<ProPreset, 'boardId' | 'board' | 'chip' | 'led' | 'series'>[] = [
  { boardId: 'nucleo-g474re', board: 'NUCLEO-G474RE', chip: 'STM32G474RET6', series: 'G4', led: { port: 'A', pin: 5, on: 'high', name: 'PA5 (LD2)' } },
  { boardId: 'nucleo-l476rg', board: 'NUCLEO-L476RG', chip: 'STM32L476RGT6', series: 'L4', led: { port: 'A', pin: 5, on: 'high', name: 'PA5 (LD2)' } },
  { boardId: 'nucleo-f303re', board: 'NUCLEO-F303RE', chip: 'STM32F303RET6', series: 'F3', led: { port: 'A', pin: 5, on: 'high', name: 'PA5 (LD2)' } },
  { boardId: 'nucleo-l152re', board: 'NUCLEO-L152RE', chip: 'STM32L152RET6', series: 'L1', led: { port: 'A', pin: 5, on: 'high', name: 'PA5 (LD2)' } },
  { boardId: 'nucleo-g431kb', board: 'NUCLEO-G431KB', chip: 'STM32G431KBT6', series: 'G4', led: { port: 'B', pin: 8, on: 'high', name: 'PB8 (LD2)' } }
]

const fromDb = (b: (typeof DB_BOARDS)[number]): ProPreset | null => {
  const c = dbChip(b.chip)
  if (!c) return null
  const base: ProPreset = { ...b, family: c.family, header: '', deviceDefine: '', startup: '', core: 'cortex-m4', sysclkHz: c.maxMHz * 1_000_000, flashBytes: 0, ramBytes: 0, openocdTarget: '' }
  return applyChip(base, c)
}

export const PRO_PRESETS: readonly ProPreset[] = [
  ...BASE_PRESETS.map((p) => { const c = dbChip(p.chip); return c ? applyChip(p, c) : p }),
  ...DB_BOARDS.map(fromDb).filter((p): p is ProPreset => !!p)
]

export const presetByChip = (chip: string): ProPreset | undefined => PRO_PRESETS.find((p) => p.chip === chip)

const hex =(n: number): string => '0x' + n.toString(16).toUpperCase().padStart(8, '0')

export const DEFAULT_CONFIGURATIONS: ProProject['configurations'] = {
  Debug: { optimization: 'Og', debugLevel: 'g3', defines: ['DEBUG'], extraFlags: [] } satisfies BuildConfiguration,
  Release: { optimization: 'Os', debugLevel: 'none', defines: ['NDEBUG'], extraFlags: [] } satisfies BuildConfiguration
}

/** Папка CMSIS-файлов устройства в проекте: drivers/CMSIS/Device/ST/STM32F1xx */
export const deviceDir = (p: ProPreset): string => `drivers/CMSIS/Device/ST/${p.header.replace(/\.h$/, '').replace(/^stm32/, 'STM32')}`

export const startupPathOf = (p: ProPreset): string => `startup/${p.startup}`
export const linkerPathOf = (p: ProPreset): string => `linker/${p.chip}_FLASH.ld`

/** Проект по умолчанию для выбранного кристалла: пути соответствуют структуре, которую создаёт мастер. */
export function defaultProject(name: string, p: ProPreset): ProProject {
  return {
    schemaVersion: SCHEMA_VERSION,
    name,
    target: {
      vendor: 'st', family: p.family, chip: p.chip, board: p.board, core: p.core,
      ...(p.fpu ? { fpu: p.fpu } : {}), ...(p.floatAbi ? { floatAbi: p.floatAbi } : {}),
      clock: { ...(p.hseHz ? { hseHz: p.hseHz } : {}), sysclkHz: p.sysclkHz },
      memory: {
        flash: { origin: p.flashOrigin ?? '0x08000000', size: p.flashBytes },
        ram: { origin: p.ramOrigin ?? '0x20000000', size: p.ramBytes },
        ...(p.extraRam ? { extra: p.extraRam } : {})
      }
    },
    sources: ['src', `${deviceDir(p)}/Source`],
    includes: ['include', 'drivers/CMSIS/Include', `${deviceDir(p)}/Include`],
    defines: [p.deviceDefine],
    linkerScript: linkerPathOf(p),
    startupFile: startupPathOf(p),
    configurations: JSON.parse(JSON.stringify(DEFAULT_CONFIGURATIONS)) as ProProject['configurations'],
    toolchain: { kind: 'arm-none-eabi-gcc' },
    programmer: { kind: 'stlink', interface: 'swd', openocdTarget: p.openocdTarget }
  }
}

export { hex as formatAddress }

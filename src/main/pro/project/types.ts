// Модель Pro-проекта (файл avride.project.json, схема версии 1). Чистые типы: без Electron и Node API.

/** Имя файла проекта в корне папки. По его наличию IDE узнаёт Pro-проект. */
export const PROJECT_FILE = 'avride.project.json'
export const SCHEMA_VERSION = 1

export type Vendor = 'st'
export type CoreKind = 'cortex-m0' | 'cortex-m0plus' | 'cortex-m3' | 'cortex-m4' | 'cortex-m7' | 'cortex-m33'
export type FpuKind = 'fpv4-sp-d16' | 'fpv5-d16' | 'fpv5-sp-d16'
export type FloatAbi = 'soft' | 'softfp' | 'hard'
export type Optimization = 'O0' | 'O1' | 'O2' | 'O3' | 'Os' | 'Og' | 'Oz'
export type DebugLevel = 'none' | 'g1' | 'g2' | 'g3'
export type ProgrammerKind = 'stlink' | 'jlink' | 'cmsis-dap'

export const CORE_KINDS: readonly CoreKind[] = ['cortex-m0', 'cortex-m0plus', 'cortex-m3', 'cortex-m4', 'cortex-m7', 'cortex-m33']
export const FPU_KINDS: readonly FpuKind[] = ['fpv4-sp-d16', 'fpv5-d16', 'fpv5-sp-d16']
export const FLOAT_ABIS: readonly FloatAbi[] = ['soft', 'softfp', 'hard']
export const OPTIMIZATIONS: readonly Optimization[] = ['O0', 'O1', 'O2', 'O3', 'Os', 'Og', 'Oz']
export const DEBUG_LEVELS: readonly DebugLevel[] = ['none', 'g1', 'g2', 'g3']
export const PROGRAMMER_KINDS: readonly ProgrammerKind[] = ['stlink', 'jlink', 'cmsis-dap']

/** Область памяти: начало (hex-строка «0x08000000») и размер в байтах. */
export interface MemoryRegion { origin: string; size: number }
export interface NamedMemoryRegion extends MemoryRegion { name: string }

export interface ProTarget {
  vendor: Vendor
  /** Семейство, например «STM32F1» */
  family: string
  /** Полное обозначение кристалла, например «STM32F103C8T6» */
  chip: string
  /** Плата (необязательно), например «Blue Pill» */
  board?: string
  core: CoreKind
  fpu?: FpuKind
  floatAbi?: FloatAbi
  /** hseHz — частота внешнего кварца, Гц; sysclkHz — целевая частота ядра, Гц */
  clock?: { hseHz?: number; sysclkHz?: number }
  memory: {
    flash: MemoryRegion
    ram: MemoryRegion
    /** Дополнительные области (CCM, SRAM2 и т. п.) */
    extra?: NamedMemoryRegion[]
  }
}

export interface BuildConfiguration {
  optimization: Optimization
  debugLevel: DebugLevel
  defines: string[]
  /** Дополнительные ключи компилятора/компоновщика, по одному аргументу на элемент */
  extraFlags: string[]
}

export interface ProToolchain { kind: 'arm-none-eabi-gcc'; version?: string }
export interface ProProgrammer { kind: ProgrammerKind; interface: 'swd'; openocdTarget?: string }

export interface ProProject {
  schemaVersion: typeof SCHEMA_VERSION
  name: string
  target: ProTarget
  /** Файлы и папки с исходниками (папки обходятся рекурсивно), пути относительно корня проекта, через «/» */
  sources: string[]
  includes: string[]
  defines: string[]
  linkerScript: string
  startupFile: string
  svd?: string
  /** Обязательны Debug и Release; можно добавлять свои */
  configurations: { Debug: BuildConfiguration; Release: BuildConfiguration } & Record<string, BuildConfiguration>
  toolchain: ProToolchain
  programmer: ProProgrammer
}

export interface Issue { path: string; message: string }

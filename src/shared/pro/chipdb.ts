// База чипов STM32 для «Профессионального режима»: типы и чистые функции запросов (без Electron и DOM —
// годятся и для main, и для renderer). Данные — src/shared/pro/chips/*.ts, СГЕНЕРИРОВАНЫ scripts/build-chipdb.mjs
// из первоисточников (см. CHIP_SOURCES и licenses/THIRD_PARTY.md). Вручную данные не правим.
import type { ChipDatabase, ChipInfo, ChipQuery, ChipSummary, MemoryMap, PinFunctionMap } from '../../main/pro/interfaces'
import { CHIPS } from './chips/index'

/** Вид вывода корпуса (поле Type из open-pin-data). */
export type PinType = 'io' | 'power' | 'reset' | 'boot' | 'mono'
/** Функция вывода: [сигнал, номер AF (-1 — нет номера: аналоговая/системная функция), ремап AFIO (только F1/L1)]. */
export type FuncRow = [signal: string, af: number, remap?: string]
/** Строка таблицы выводов корпуса: [номер/шарик, имя порта или питания, тип, доп. имя («WKUP», «OSC_IN», «BOOT0»), функции]. */
export type PinRow = [pos: string, name: string, type: PinType, alias: string, funcs: FuncRow[]]

export interface ChipPackage {
  /** «LQFP48», «UFQFPN48», «WLCSP49» */
  name: string
  /** Код в open-pin-data: «STM32F103C8Tx» */
  part: string
  pins: PinRow[]
}

export type RegionKind = 'flash' | 'ram' | 'other'
/** Область памяти: [имя, адрес, размер в байтах, вид, откуда адрес/размер] */
export type RegionRow = [name: string, origin: number, size: number, kind: RegionKind, src: string]

export interface ChipFiles {
  /** Заголовок CMSIS: «stm32f103xb.h» */
  header: string
  /** Макрос устройства: «STM32F103xB» */
  define: string
  /** Файл запуска GCC: «startup_stm32f103xb.s» */
  startup: string
  /** Репозиторий CMSIS-device, где они лежат: «cmsis-device-f1» */
  cmsisRepo: string
  /** Файл SVD (из modm-io/cmsis-svd-stm32): «stm32f1/STM32F103.svd» */
  svd: string
  /** Целевой файл OpenOCD: «stm32f1x.cfg» */
  openocd: string
  /** Имя скрипта компоновщика из примеров STM32Cube; null — подтверждённого имени нет (генерировать по карте памяти) */
  linker: string | null
}

export interface ChipRecord {
  /** Нижний регистр: «stm32f103c8» */
  id: string
  /** Обозначение для людей: «STM32F103C8T6» */
  name: string
  family: string
  /** Линейка: «STM32F103», «STM32F4x1» */
  line: string
  /** «Cortex-M3» */
  core: string
  /** В заголовке CMSIS __FPU_PRESENT = 1 */
  fpu: boolean
  maxMHz: number
  /** DIEnnn из open-pin-data (идентификатор кристалла, DBGMCU_IDCODE.DEV_ID = nnn в hex) */
  dieId: string
  flashKB: number
  /** Вся ОЗУ, КБ, как в open-pin-data (без CCM/ITCM — они в regions) */
  ramKB: number
  voltage: [min: number, max: number]
  tempC: [min: number, max: number]
  regions: RegionRow[]
  packages: ChipPackage[]
  /** Экземпляры периферии («USART1», «TIM2», «ADC1») */
  peripherals: string[]
  files: ChipFiles
  /** Идентификаторы источников (ключи CHIP_SOURCES) по блокам данных */
  src: Record<string, string>
  /** Оговорки: что не подтверждено источниками */
  notes: string[]
}

export interface ChipSource { url: string; license: string; what: string }
export const CHIP_SOURCES: Record<string, ChipSource> = {
  pins: { url: 'https://github.com/STMicroelectronics/STM32_open_pin_data', license: 'BSD-3-Clause (© STMicroelectronics)', what: 'корпуса, номера и имена выводов, сигналы, AF, ядро, частота, объёмы Flash/RAM, периферия' },
  cmsis: { url: 'https://github.com/STMicroelectronics/cmsis-device-f1 (и -f0/-f3/-f4/-g4/-h7/-l0/-l1/-l4)', license: 'Apache-2.0 (© STMicroelectronics)', what: 'заголовки устройств: адреса памяти, FPU, макросы устройств, файлы startup' },
  svd: { url: 'https://github.com/modm-io/cmsis-svd-stm32', license: 'Apache-2.0 (SVD файлы ST, собраны проектом modm)', what: 'имена файлов SVD' },
  openocd: { url: 'https://github.com/openocd-org/openocd/tree/master/tcl/target', license: 'GPL-2.0+ (используются только имена файлов)', what: 'имена целевых файлов OpenOCD' },
  cube: { url: 'https://github.com/STMicroelectronics/STM32CubeF1 (и F0/F3/F4/G4/H7)', license: 'BSD-3-Clause / Apache-2.0 (по файлам)', what: 'имена скриптов компоновщика из примеров' }
}

// ---------- запросы ----------

const byId = new Map(CHIPS.map((c) => [c.id, c]))

export function listChips(): ChipRecord[] { return CHIPS }

export function getChip(id: string): ChipRecord | undefined { return byId.get(id.toLowerCase()) }

/** Корпус по имени; без имени — первый. */
export function getPackage(chip: ChipRecord, name?: string): ChipPackage {
  return (name ? chip.packages.find((p) => p.name === name) : undefined) ?? chip.packages[0]
}

/** Функции вывода порта («PA9») в корпусе; пусто, если вывода нет. */
export function pinFunctions(chip: ChipRecord | string, pin: string, pkg?: string): FuncRow[] {
  const c = typeof chip === 'string' ? getChip(chip) : chip
  if (!c) return []
  const p = getPackage(c, pkg).pins.find((r) => r[1] === pin)
  return p ? p[4] : []
}

export function memoryMap(chip: ChipRecord | string): RegionRow[] {
  const c = typeof chip === 'string' ? getChip(chip) : chip
  return c ? c.regions : []
}

/** Поиск по названию, семейству, ядру, корпусу и обозначению линейки. Слова — через пробел, все должны найтись. */
export function searchChips(query: string): ChipRecord[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return CHIPS
  return CHIPS.filter((c) => {
    const hay = [c.id, c.name, c.family, c.line, c.core, ...c.packages.flatMap((p) => [p.name, p.part])].join(' ').toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

/** Платы, у которых mcu начинается с обозначения чипа («STM32F103C8T6» → чип stm32f103c8). boards — список справочника плат. */
export function boardsForChip<B extends { mcu?: string }>(chip: ChipRecord, boards: B[]): B[] {
  const prefix = chip.id.toUpperCase()
  return boards.filter((b) => (b.mcu ?? '').toUpperCase().startsWith(prefix))
}

export function packageFor(chip: ChipRecord, part?: string): ChipPackage { return getPackage(chip, part) }

/** Особые выводы: BOOT0, NRST, генераторы, SWD/JTAG, питание, VCAP/VBAT/VREF. */
export interface SpecialPin { role: string; pos: string; name: string }
export function specialPins(pkg: ChipPackage): SpecialPin[] {
  const out: SpecialPin[] = []
  for (const [pos, name, type, alias, funcs] of pkg.pins) {
    const tag = (role: string): void => { out.push({ role, pos, name: alias && type === 'io' ? `${name} (${alias})` : name }) }
    if (type === 'boot' || alias === 'BOOT0') tag('BOOT0')
    if (type === 'reset' || alias === 'NRST') tag('NRST')
    if (type === 'mono') tag(name.replace('+', ''))
    if (/^VCAP/.test(name)) tag('VCAP')
    if (/^VBAT$/.test(name)) tag('VBAT')
    if (/^VDDA$|^VREF/.test(name)) tag('VDDA')
    for (const [s] of funcs) {
      if (s === 'RCC_OSC_IN') tag('OSC_IN')
      else if (s === 'RCC_OSC_OUT') tag('OSC_OUT')
      else if (s === 'RCC_OSC32_IN') tag('OSC32_IN')
      else if (s === 'RCC_OSC32_OUT') tag('OSC32_OUT')
      else if (/SWDIO/.test(s)) tag('SWDIO')
      else if (/SWCLK/.test(s)) tag('SWCLK')
      else if (/SWO/.test(s)) tag('SWO')
    }
  }
  return out
}

/** Аналоговые каналы корпуса: выводы с сигналами ADCn_INx / DAC / COMP / OPAMP. */
export interface AnalogChannel { pin: string; signal: string }
export function analogChannels(pkg: ChipPackage): AnalogChannel[] {
  const out: AnalogChannel[] = []
  for (const [, name, type, , funcs] of pkg.pins) {
    if (type !== 'io') continue
    for (const [s] of funcs) if (/^(ADC\d*_IN|DAC\d*_OUT|COMP\d*_IN|OPAMP\d*_V)/.test(s)) out.push({ pin: name, signal: s })
  }
  return out
}

/** Все выводы корпуса с данным сигналом (подстрока или префикс без учёта регистра: «USART1_TX», «I2C1», «ADC»). */
export function pinsBySignal(pkg: ChipPackage, signal: string): { pin: string; pos: string; func: FuncRow }[] {
  const q = signal.toLowerCase()
  const out: { pin: string; pos: string; func: FuncRow }[] = []
  for (const [pos, name, type, , funcs] of pkg.pins) {
    if (type !== 'io') continue
    for (const f of funcs) if (f[0].toLowerCase().includes(q)) out.push({ pin: name, pos, func: f })
  }
  return out
}

// ---------- адаптер к интерфейсу ChipDatabase (src/main/pro/interfaces.ts) ----------

const toSummary = (c: ChipRecord): ChipSummary => ({ id: c.id, name: c.name, family: c.family, core: c.core, flashBytes: c.flashKB * 1024, ramBytes: c.ramKB * 1024, package: c.packages[0]?.name })
const toMemory = (c: ChipRecord): MemoryMap => ({ regions: c.regions.map(([name, origin, size, kind]) => ({ name, origin, size, kind })) })

export const chipDatabase: ChipDatabase = {
  id: 'chips-open-pin-data',
  implemented: true,
  async getChip(id: string): Promise<ChipInfo | null> {
    const c = getChip(id)
    if (!c) return null
    return { ...toSummary(c), deviceDefine: c.files.define, startupFile: c.files.startup, svdFile: c.files.svd, openocdTarget: c.files.openocd, memory: toMemory(c), sources: Object.values(c.src).filter((v, i, a) => a.indexOf(v) === i).map((k) => CHIP_SOURCES[k]?.url ?? k) }
  },
  async listChips(query?: ChipQuery): Promise<ChipSummary[]> {
    let l = query?.text ? searchChips(query.text) : CHIPS
    if (query?.family) l = l.filter((c) => c.family === query.family)
    return l.map(toSummary)
  },
  async pinFunctions(chipId: string): Promise<PinFunctionMap> {
    const c = getChip(chipId)
    const m: PinFunctionMap = {}
    if (!c) return m
    for (const [, name, type, , funcs] of c.packages[0].pins) {
      if (type !== 'io') continue
      m[name] = [{ signal: 'GPIO' }, ...funcs.map(([signal, af]) => (af >= 0 ? { signal, af } : { signal }))]
    }
    return m
  },
  async memoryMap(chipId: string): Promise<MemoryMap> {
    const c = getChip(chipId)
    return c ? toMemory(c) : { regions: [] }
  }
}

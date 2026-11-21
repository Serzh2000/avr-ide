// Работа с выводами чипа по базе (chipdb): имена, функции, защищённые выводы, периферия, занятость выводов конфигурацией.
import { getChip, getPackage, listChips, type ChipPackage, type ChipRecord, type FuncRow, type PinRow } from '../chipdb'
import type { GpioRole, PinsConfig } from './types'

/** Чип проекта по обозначению кристалла («STM32F103C8T6»), иначе по имени файла запуска. */
export function chipForTarget(chipName: string, startupFile?: string): ChipRecord | undefined {
  const name = chipName.toLowerCase()
  const all = listChips()
  return all.find((c) => c.name.toLowerCase() === name) ?? all.find((c) => name.startsWith(c.id))
    ?? (startupFile ? all.find((c) => startupFile.split('/').pop() === c.files.startup) : undefined)
}

export const chipById = (id: string): ChipRecord | undefined => getChip(id)

export function pkgOf(chip: ChipRecord, name?: string): ChipPackage { return getPackage(chip, name) }

/** «PA9» → { port: 'A', num: 9 } */
export function parsePin(name: string): { port: string; num: number } | null {
  const m = /^P([A-Z])(\d{1,2})$/.exec(name)
  return m ? { port: m[1], num: Number(m[2]) } : null
}

/** Сравнение имён выводов: PA2 < PA10 < PB0. */
export function comparePins(a: string, b: string): number {
  const x = parsePin(a), y = parsePin(b)
  if (!x || !y) return a.localeCompare(b)
  return x.port === y.port ? x.num - y.num : x.port.localeCompare(y.port)
}

export const ioPins = (pkg: ChipPackage): PinRow[] => pkg.pins.filter((r) => r[2] === 'io')
export const findPin = (pkg: ChipPackage, name: string): PinRow | undefined => pkg.pins.find((r) => r[1] === name && r[2] === 'io')

/** Сигналы, которые не назначаются как «функция вывода» в конфигураторе: системные, часы реального времени, служебные. */
const SKIP_SIGNAL = /^(SYS_|RCC_OSC|RTC_|GPIO|[A-Z0-9]+_EXTI\d+$|TRACE|DEBUG)/
const ANALOG_SIGNAL = /^(ADC\d*_IN|DAC\d*_OUT|COMP\d*_IN|OPAMP\d*_V)/

export const isAnalogSignal = (s: string): boolean => ANALOG_SIGNAL.test(s)

/** Назначаемые функции вывода (периферийные сигналы). */
export function assignable(row: PinRow): FuncRow[] { return row[4].filter((f) => !SKIP_SIGNAL.test(f[0])) }

/** «USART1_TX» → «USART1»; «CAN_RX» → «CAN»; «USB_OTG_FS_DM» → «USB». */
export function periphOf(signal: string): string {
  const i = signal.indexOf('_')
  const head = i < 0 ? signal : signal.slice(0, i)
  return head
}

/** «USART1_TX» → «TX» */
export function signalPart(signal: string): string { const i = signal.indexOf('_'); return i < 0 ? signal : signal.slice(i + 1) }

export interface PeriphInfo { name: string; signals: string[] }

/** Периферия корпуса: экземпляры с хотя бы одним назначаемым сигналом, в порядке «тип, номер». */
export function peripheralsIn(pkg: ChipPackage): PeriphInfo[] {
  const m = new Map<string, Set<string>>()
  for (const r of ioPins(pkg)) for (const f of assignable(r)) {
    const p = periphOf(f[0])
    if (!m.has(p)) m.set(p, new Set())
    m.get(p)!.add(f[0])
  }
  const key = (n: string): [string, number] => [n.replace(/\d+$/, ''), Number(/\d+$/.exec(n)?.[0] ?? 0)]
  return [...m.entries()]
    .map(([name, s]) => ({ name, signals: [...s].sort() }))
    .sort((a, b) => { const x = key(a.name), y = key(b.name); return x[0] === y[0] ? x[1] - y[1] : x[0].localeCompare(y[0]) })
}

export interface SignalPin { pin: string; pos: string; af: number; remap?: string }
/** Выводы корпуса, на которых есть сигнал. */
export function signalPins(pkg: ChipPackage, signal: string): SignalPin[] {
  const out: SignalPin[] = []
  for (const r of ioPins(pkg)) for (const f of r[4]) if (f[0] === signal) out.push({ pin: r[1], pos: r[0], af: f[1], remap: f[2] })
  return out
}

/** Обязательные сигналы при включении периферии из дерева (остальное — по желанию). */
export function defaultSignals(periph: string, all: string[]): string[] {
  const has = (s: string): boolean => all.includes(`${periph}_${s}`)
  const pick = (...names: string[]): string[] => names.filter(has).map((s) => `${periph}_${s}`)
  if (/^U?S?ART\d+$|^UART\d+$/.test(periph)) return pick('TX', 'RX')
  if (/^I2C\d/.test(periph)) return pick('SCL', 'SDA')
  if (/^SPI\d/.test(periph)) return pick('SCK', 'MISO', 'MOSI')
  if (/^TIM\d/.test(periph)) return pick('CH1')
  if (periph === 'CAN' || /^FDCAN/.test(periph)) return pick('RX', 'TX')
  if (periph === 'USB') return pick('DM', 'DP')
  return all.slice(0, 1)
}

// ---------- защищённые выводы ----------

export type GuardKind = 'swd' | 'jtag' | 'osc' | 'osc32' | 'boot' | 'usb'
export interface PinGuard { kind: GuardKind; text: string }

/** Выводы, которые нельзя занимать «случайно»: отладка SWD/JTAG, генераторы, BOOT0. */
export function pinGuards(pkg: ChipPackage): Map<string, PinGuard[]> {
  const m = new Map<string, PinGuard[]>()
  const add = (pin: string, g: PinGuard): void => { m.set(pin, [...(m.get(pin) ?? []), g]) }
  for (const [, name, type, alias, funcs] of pkg.pins) {
    if (type === 'boot' || (type === 'io' && alias === 'BOOT0')) add(name, { kind: 'boot', text: 'BOOT0: определяет, откуда стартует микроконтроллер' })
    if (type !== 'io') continue
    for (const [s] of funcs) {
      if (/SWDIO/.test(s)) add(name, { kind: 'swd', text: 'SWDIO отладки: после занятия программатор не сможет подключиться' })
      else if (/SWCLK/.test(s)) add(name, { kind: 'swd', text: 'SWCLK отладки: после занятия программатор не сможет подключиться' })
      else if (/JTDI|NJTRST/.test(s)) add(name, { kind: 'jtag', text: 'JTAG (по умолчанию включён после сброса)' })
      else if (/JTDO|TRACESWO/.test(s)) add(name, { kind: 'jtag', text: 'JTDO/SWO: используется отладкой, пока JTAG не отключён' })
      else if (s === 'RCC_OSC_IN' || s === 'RCC_OSC_OUT') add(name, { kind: 'osc', text: 'Вывод внешнего кварца HSE' })
      else if (s === 'RCC_OSC32_IN' || s === 'RCC_OSC32_OUT') add(name, { kind: 'osc32', text: 'Вывод часового кварца LSE' })
    }
  }
  return m
}

export const GUARD_LABEL: Record<GuardKind, string> = { swd: 'SWD', jtag: 'JTAG', osc: 'HSE', osc32: 'LSE', boot: 'BOOT0', usb: 'USB' }

// ---------- занятость выводов ----------

export type Usage =
  | { kind: 'gpio'; role: GpioRole }
  | { kind: 'af'; periph: string; signal: string }
  | { kind: 'osc'; signal: string }

export const usageText = (u: Usage): string => u.kind === 'gpio' ? `GPIO ${ROLE_LABEL[u.role]}` : u.kind === 'af' ? u.signal : `${u.signal} (внешний генератор)`
export const ROLE_LABEL: Record<GpioRole, string> = { input: 'вход', output: 'выход', analog: 'аналог', exti: 'внешнее прерывание' }

/** Какие роли занимает каждый вывод: GPIO, функции включённой периферии, генератор HSE. Больше одной роли — конфликт. */
export function pinUsage(cfg: PinsConfig, pkg: ChipPackage): Map<string, Usage[]> {
  const m = new Map<string, Usage[]>()
  const add = (pin: string, u: Usage): void => { m.set(pin, [...(m.get(pin) ?? []), u]) }
  for (const [pin, p] of Object.entries(cfg.pins)) if (p.role) add(pin, { kind: 'gpio', role: p.role })
  for (const [name, per] of Object.entries(cfg.peripherals)) {
    if (!per.enabled) continue
    for (const [signal, pin] of Object.entries(per.signals)) add(pin, { kind: 'af', periph: name, signal })
  }
  if (cfg.clock.source !== 'hsi' && (cfg.clock.source === 'hse' || cfg.clock.pllSource === 'hse')) {
    for (const [, name, type, , funcs] of pkg.pins) {
      if (type !== 'io') continue
      for (const [s] of funcs) {
        if (s === 'RCC_OSC_IN') add(name, { kind: 'osc', signal: 'OSC_IN' })
        if (s === 'RCC_OSC_OUT' && !cfg.clock.hseBypass) add(name, { kind: 'osc', signal: 'OSC_OUT' })
      }
    }
  }
  return m
}

// ---------- ремап AFIO (F1) ----------

/** Допустимые значения ремапа для функции F1: поле «remap» содержит варианты через «|»; пусто — без ремапа. */
export const remapChoices = (f: Pick<SignalPin, 'remap'>): string[] => (f.remap ? f.remap.split('|') : [''])

/** Общий ремап периферии: единственное значение, подходящее всем её выводам; null — выводы несовместимы. */
export function commonRemap(choices: string[][]): string | null {
  if (choices.length === 0) return ''
  let common = new Set(choices[0])
  for (const c of choices.slice(1)) common = new Set(c.filter((x) => common.has(x)))
  if (common.size === 0) return null
  return [...common].sort()[0]
}

// ---------- метки ----------

/** Метка → идентификатор C (LED, BTN_USER): латиница, цифры, «_»; не с цифры. */
export const labelIdent = (label: string): string | null => {
  const s = label.trim()
  return /^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(s) ? s.toUpperCase() : null
}

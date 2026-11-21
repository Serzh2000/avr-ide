// План настройки выводов для генераторов: что делать с каждым выводом (вход, выход, альтернативная функция, аналог) и откуда взялся номер AF.
import type { ChipRecord } from '../../chipdb'
import { comparePins, findPin, isAnalogSignal, labelIdent, parsePin, periphOf } from '../model'
import type { GenNote } from './support'
import { genFamily } from './support'
import type { GenFamily } from './support'
import { planRemap } from './remap'
import type { RemapPlan } from './remap'
import type { Level, OType, PinsConfig, Pull, Speed } from '../types'
import { pkgFor } from '../ops'
import { guardedJtag } from '../validate'
import { pinGuards } from '../model'

export type PinMode = 'in' | 'out' | 'af' | 'analog'
/** Направление альтернативной функции для F1 (там вход и выход настраиваются по-разному) */
export type AfDir = 'in' | 'out' | 'od' | 'skip'

export interface PinPlan {
  pin: string
  port: string
  num: number
  mode: PinMode
  pull: Pull
  otype: OType
  speed: Speed
  initial?: Level
  af?: number
  signal?: string
  dir?: AfDir
  label?: string
  /** Краткое описание для комментария в коде */
  note: string
}

/**
 * Направление сигнала F1 по имени: у F1 нет номеров AF, режим вывода зависит от направления.
 * Таблица покрывает USART, SPI (мастер), I2C, таймеры, CAN; остальное — «skip» (настройка вручную).
 */
export function f1Direction(signal: string): AfDir {
  if (/^(U?S?ART\d)_(TX|CK|RTS)$/.test(signal)) return 'out'
  if (/^(U?S?ART\d)_(RX|CTS)$/.test(signal)) return 'in'
  if (/^SPI\d_(SCK|MOSI|NSS)$/.test(signal)) return 'out'
  if (/^SPI\d_MISO$/.test(signal)) return 'in'
  if (/^I2C\d_(SCL|SDA)$/.test(signal)) return 'od'
  if (/^TIM\d+_CH\dN?$/.test(signal)) return 'out'
  if (/^TIM\d+_(ETR|BKIN)$/.test(signal)) return 'in'
  if (signal === 'CAN_TX') return 'out'
  if (signal === 'CAN_RX') return 'in'
  if (signal === 'RCC_MCO') return 'out'
  return 'skip'
}

export interface PinsPlan {
  fam: GenFamily
  pins: PinPlan[]
  remap: RemapPlan | null
  /** F1: используются выводы JTAG — его нужно отключить */
  jtagOff: boolean
  ports: string[]
  notes: GenNote[]
}

/** Строит план по конфигурации. Вызывать только для поддержанного семейства. */
export function planPins(cfg: PinsConfig, chip: ChipRecord): PinsPlan {
  const fam = genFamily(chip)!
  const pkg = pkgFor(chip, cfg)
  const notes: GenNote[] = []
  const pins: PinPlan[] = []
  const labelOf = (pin: string): string | undefined => { const l = cfg.pins[pin]?.label; return l ? labelIdent(l) ?? undefined : undefined }
  const add = (p: PinPlan): void => { pins.push(p) }
  for (const [pin, c] of Object.entries(cfg.pins)) {
    if (!c.role) continue
    const pp = parsePin(pin)
    if (!pp || !findPin(pkg, pin)) continue
    const base = { pin, port: pp.port, num: pp.num, label: labelOf(pin), pull: c.pull ?? 'none', otype: c.otype ?? 'pp', speed: c.speed ?? 'low' } as const
    if (c.role === 'output') add({ ...base, mode: 'out', initial: c.initial ?? 'low', note: `выход${c.otype === 'od' ? ' (открытый сток)' : ''}` })
    else if (c.role === 'analog') add({ ...base, mode: 'analog', pull: 'none', note: 'аналоговый вход' })
    else {
      add({ ...base, mode: 'in', note: c.role === 'exti' ? 'вход (внешнее прерывание: EXTI/NVIC генерация не поддерживается)' : 'вход' })
      if (c.role === 'exti') notes.push({ severity: 'warning', text: `${pin}: прерывание EXTI не генерируется — вывод настроен как вход, SYSCFG/EXTI и NVIC настройте в блоках USER CODE.` })
    }
  }
  for (const [name, per] of Object.entries(cfg.peripherals)) {
    if (!per.enabled) continue
    for (const [signal, pin] of Object.entries(per.signals)) {
      const pp = parsePin(pin)
      const row = findPin(pkg, pin)
      if (!pp || !row) continue
      const f = row[4].find((x) => x[0] === signal)
      if (!f) continue
      const own = cfg.pins[pin]
      const label = labelOf(pin)
      if (isAnalogSignal(signal)) { add({ pin, port: pp.port, num: pp.num, mode: 'analog', pull: 'none', otype: 'pp', speed: 'low', signal, label, note: signal }); continue }
      const isOd = /^I2C/.test(periphOf(signal))
      const pull = own?.pull ?? 'none'
      const otype = own?.otype ?? (isOd ? 'od' : 'pp')
      const speed = own?.speed ?? 'high'
      if (fam === 'f1') {
        const dir = f1Direction(signal)
        if (dir === 'skip') {
          notes.push({ severity: 'warning', text: `${pin}: направление сигнала ${signal} для F1 неизвестно генератору — режим вывода не настроен, сделайте это в блоке USER CODE.` })
          continue
        }
        add({ pin, port: pp.port, num: pp.num, mode: 'af', pull, otype: dir === 'od' ? 'od' : 'pp', speed, signal, dir, label, note: signal })
      } else {
        if (f[1] < 0) { notes.push({ severity: 'warning', text: `${pin}: у сигнала ${signal} нет номера AF в базе — вывод не настроен.` }); continue }
        add({ pin, port: pp.port, num: pp.num, mode: 'af', pull, otype, speed, af: f[1], signal, label, note: signal })
      }
    }
  }
  pins.sort((a, b) => comparePins(a.pin, b.pin))
  const ports = [...new Set(pins.map((p) => p.port))].sort()
  let remap: RemapPlan | null = null
  let jtagOff = false
  if (fam === 'f1') {
    remap = planRemap(cfg, pkg)
    jtagOff = Object.keys(guardedJtag(cfg, pinGuards(pkg))).length > 0
    for (const t of remap.unknown) notes.push({ severity: 'warning', text: `Ремап ${t} не поддерживается генерацией — настройте AFIO->MAPR вручную.` })
  }
  return { fam, pins, remap, jtagOff, ports, notes }
}

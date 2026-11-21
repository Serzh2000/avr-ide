// Операции правки конфигурации (чистые функции: возвращают новую конфигурацию). Их использует интерфейс и тесты.
import type { ChipPackage, ChipRecord } from '../chipdb'
import { defaultSignals, findPin, peripheralsIn, periphOf, pinGuards, pinUsage, remapChoices, signalPins } from './model'
import type { SignalPin } from './model'
import { genFamily, isUsartName } from './gen/support'
import type { ClockCfg, GpioRole, PeriphCfg, PinCfg, PinsConfig } from './types'

const clone = (c: PinsConfig): PinsConfig => structuredClone(c)

export function pkgFor(chip: ChipRecord, cfg: PinsConfig): ChipPackage {
  return chip.packages.find((p) => p.name === cfg.package) ?? chip.packages[0]
}

/** Убирает вывод из всех ролей: GPIO и функции периферии. Метка и подтверждение остаются, если keepMeta. */
export function clearPin(cfg: PinsConfig, pin: string, keepMeta = false): PinsConfig {
  const c = clone(cfg)
  const meta = c.pins[pin]
  delete c.pins[pin]
  if (keepMeta && meta?.label) c.pins[pin] = { label: meta.label, ...(meta.confirmed ? { confirmed: true } : {}) }
  for (const per of Object.values(c.peripherals)) for (const [s, p] of Object.entries(per.signals)) if (p === pin) delete per.signals[s]
  return c
}

/** Роль GPIO для вывода (заменяет остальные роли вывода). Метка и подтверждение сохраняются. */
export function setGpioRole(cfg: PinsConfig, pin: string, role: GpioRole, patch: Partial<PinCfg> = {}): PinsConfig {
  const c = clearPin(cfg, pin, true)
  const old = cfg.pins[pin]
  const base: PinCfg = { ...(c.pins[pin] ?? {}), role }
  if (old?.pull && old.role) base.pull = old.pull
  c.pins[pin] = { ...base, ...patch, role }
  if (role === 'output' && !c.pins[pin].initial) c.pins[pin].initial = 'low'
  if (role === 'exti' && !c.pins[pin].edge) c.pins[pin].edge = 'falling'
  return c
}

export function patchPin(cfg: PinsConfig, pin: string, patch: Partial<PinCfg>): PinsConfig {
  const c = clone(cfg)
  c.pins[pin] = { ...(c.pins[pin] ?? {}), ...patch }
  for (const k of Object.keys(c.pins[pin]) as (keyof PinCfg)[]) if (c.pins[pin][k] === undefined || c.pins[pin][k] === '') delete c.pins[pin][k]
  if (Object.keys(c.pins[pin]).length === 0) delete c.pins[pin]
  return c
}

const ensurePeriph = (c: PinsConfig, name: string): PeriphCfg => (c.peripherals[name] ??= { enabled: true, signals: {} })

/** Назначает сигнал выводу по выбору пользователя: прежние роли вывода и прежний вывод этого сигнала освобождаются, периферия включается. */
export function assignSignal(cfg: PinsConfig, pin: string, signal: string): PinsConfig {
  const periph = periphOf(signal)
  let c = clearPin(cfg, pin, true)
  const per = ensurePeriph(c, periph)
  per.enabled = true
  per.signals[signal] = pin
  c = withDefaultParams(c, periph)
  return c
}

function withDefaultParams(c: PinsConfig, periph: string): PinsConfig {
  const per = c.peripherals[periph]
  if (isUsartName(periph) && !per.baud) per.baud = 115200
  return c
}

/** Освобождает сигнал периферии. */
export function unassignSignal(cfg: PinsConfig, periph: string, signal: string): PinsConfig {
  const c = clone(cfg)
  if (c.peripherals[periph]) delete c.peripherals[periph].signals[signal]
  return c
}

interface PlaceOpts { onlyFree?: boolean }

/** Подбор выводов для сигналов периферии: без ремапа первыми, защищённые — в конце; для F1 — общий вариант ремапа. */
function pickPins(cfg: PinsConfig, chip: ChipRecord, periph: string, signals: string[], opts: PlaceOpts): Record<string, string> | null {
  const pkg = pkgFor(chip, cfg)
  const guards = pinGuards(pkg)
  const probe = clone(cfg)
  if (probe.peripherals[periph]) probe.peripherals[periph].signals = {}
  const usage = pinUsage(probe, pkg)
  const taken = new Set<string>()
  const cands = signals.map((s) => signalPins(pkg, s))
  if (cands.some((l) => l.length === 0)) return null
  const rank = (sp: SignalPin): number => (guards.has(sp.pin) ? 2 : 0) + (sp.remap ? 1 : 0)
  const isF1 = genFamily(chip) === 'f1' || chip.id.startsWith('stm32f1')
  const remapOptions: string[] = isF1 ? [...new Set(cands.flatMap((l) => l.flatMap(remapChoices)))].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b))) : ['']
  for (const rm of remapOptions) {
    const res: Record<string, string> = {}
    let ok = true
    taken.clear()
    for (const [i, s] of signals.entries()) {
      const list = cands[i].filter((sp) => (!isF1 || remapChoices(sp).includes(rm)) && !taken.has(sp.pin) && (!opts.onlyFree || !usage.has(sp.pin)) && !(guards.get(sp.pin) ?? []).some((g) => g.kind !== 'jtag'))
      const pick = [...list].sort((a, b) => rank(a) - rank(b))[0]
      if (!pick) { ok = false; break }
      res[s] = pick.pin
      taken.add(pick.pin)
    }
    if (ok) return res
  }
  return null
}

/**
 * Включает периферию из дерева: обязательные сигналы назначаются первым подходящим выводам (как в STM32CubeMX).
 * Если вывод уже занят другой ролью, назначение всё равно записывается — конфликт виден явно, а «Подобрать свободные выводы» его решает.
 */
export function enablePeripheral(cfg: PinsConfig, chip: ChipRecord, periph: string): PinsConfig {
  const c = clone(cfg)
  const pkg = pkgFor(chip, c)
  const info = peripheralsIn(pkg).find((p) => p.name === periph)
  if (!info) return c
  const per = ensurePeriph(c, periph)
  per.enabled = true
  const want = defaultSignals(periph, info.signals).filter((s) => !per.signals[s])
  const picked = pickPins(c, chip, periph, [...Object.keys(per.signals), ...want], {})
  if (picked) for (const s of want) per.signals[s] = picked[s]
  else {
    // нет общего варианта — по одному
    for (const s of want) { const p = pickPins(c, chip, periph, [s], {}); if (p) per.signals[s] = p[s] }
  }
  return withDefaultParams(c, periph)
}

/** Переносит сигналы периферии на свободные выводы (решение конфликта). null — свободных нет. */
export function autoPlace(cfg: PinsConfig, chip: ChipRecord, periph: string): PinsConfig | null {
  const c = clone(cfg)
  const per = c.peripherals[periph]
  if (!per) return null
  const signals = Object.keys(per.signals)
  if (signals.length === 0) return c
  const p = pickPins(c, chip, periph, signals, { onlyFree: true })
  if (!p) return null
  per.signals = p
  return c
}

export function disablePeripheral(cfg: PinsConfig, periph: string, keepPins = false): PinsConfig {
  const c = clone(cfg)
  const per = c.peripherals[periph]
  if (!per) return c
  if (keepPins) per.enabled = false
  else delete c.peripherals[periph]
  return c
}

export function setPeriphParam(cfg: PinsConfig, periph: string, patch: Partial<PeriphCfg>): PinsConfig {
  const c = clone(cfg)
  c.peripherals[periph] = { ...ensurePeriph(c, periph), ...patch }
  return c
}

export function setClock(cfg: PinsConfig, patch: Partial<ClockCfg>): PinsConfig {
  const c = clone(cfg)
  c.clock = { ...c.clock, ...patch, pll: { ...c.clock.pll, ...(patch.pll ?? {}) } }
  return c
}

/** Вывод существует в корпусе и пригоден для назначения. */
export const pinExists = (chip: ChipRecord, cfg: PinsConfig, pin: string): boolean => !!findPin(pkgFor(chip, cfg), pin)


// Проверка конфигурации выводов и тактирования: существование выводов и сигналов в выбранном корпусе, конфликты ролей, защищённые выводы,
// ремап F1, метки, частоты и пределы. Возвращает список проблем; «ошибка» мешает генерации, «предупреждение» — нет.
import { getChip } from '../chipdb'
import { computeClock, clockProfile, usartBrr } from './clock'
import { genFamily, usartInfo } from './gen/support'
import { planRemap } from './gen/remap'
import { GUARD_LABEL, findPin, labelIdent, periphOf, pinGuards, pinUsage, usageText, signalPins, comparePins } from './model'
import type { PinIssue, PinsConfig } from './types'

const err = (code: string, message: string, extra: Partial<PinIssue> = {}): PinIssue => ({ severity: 'error', code, message, ...extra })
const warn = (code: string, message: string, extra: Partial<PinIssue> = {}): PinIssue => ({ severity: 'warning', code, message, ...extra })
const info = (code: string, message: string, extra: Partial<PinIssue> = {}): PinIssue => ({ severity: 'info', code, message, ...extra })

/** Частоты шин для расчёта USART. */
export function busClock(cfg: PinsConfig, bus: 'apb1' | 'apb2'): number {
  const chip = getChip(cfg.chip)
  if (!chip) return 0
  const r = computeClock(chip, cfg.clock)
  return bus === 'apb1' ? r.pclk1 : r.pclk2
}

export function checkConfig(cfg: PinsConfig): PinIssue[] {
  const out: PinIssue[] = []
  const chip = getChip(cfg.chip)
  if (!chip) return [err('chip', `Чип «${cfg.chip}» нет в базе.`)]
  const pkg = chip.packages.find((p) => p.name === cfg.package) ?? (cfg.package ? undefined : chip.packages[0])
  if (!pkg) return [err('package', `Корпуса «${cfg.package}» у ${chip.name} нет в базе (есть: ${chip.packages.map((p) => p.name).join(', ')}).`)]
  const guards = pinGuards(pkg)
  const fam = genFamily(chip)

  // выводы
  for (const pin of Object.keys(cfg.pins)) {
    if (!findPin(pkg, pin)) out.push(err('pin-missing', `Вывода ${pin} нет в корпусе ${pkg.name}.`, { pin }))
  }
  // периферия и сигналы
  for (const [name, per] of Object.entries(cfg.peripherals)) {
    const sigs = Object.entries(per.signals)
    if (!per.enabled) {
      if (sigs.length) out.push(warn('periph-off', `${name} выключена, но выводам назначены её сигналы (${sigs.map(([s]) => s).join(', ')}): они не будут настроены.`, { periph: name }))
      continue
    }
    const exists = pkg.pins.some((r) => r[2] === 'io' && r[4].some((f) => periphOf(f[0]) === name))
    if (!exists) out.push(err('periph-missing', `Периферии ${name} нет в корпусе ${pkg.name} (${chip.name}).`, { periph: name }))
    for (const [signal, pin] of sigs) {
      if (periphOf(signal) !== name) { out.push(err('signal-periph', `Сигнал ${signal} не относится к ${name}.`, { periph: name, pin })); continue }
      const row = findPin(pkg, pin)
      if (!row) { out.push(err('pin-missing', `${signal}: вывода ${pin} нет в корпусе ${pkg.name}.`, { periph: name, pin })); continue }
      if (!row[4].some((f) => f[0] === signal)) {
        const onPins = signalPins(pkg, signal).map((s) => s.pin)
        out.push(err('af-missing', `Сигнала ${signal} на выводе ${pin} нет${onPins.length ? ` (есть на: ${onPins.join(', ')})` : ' ни на одном выводе этого корпуса'}.`, { periph: name, pin }))
      }
    }
    if (sigs.length === 0) out.push(warn('periph-nopins', `${name} включена, но выводы не назначены.`, { periph: name }))
    if (/^USART\d$/.test(name)) {
      const info2 = usartInfo(chip, name)
      if (info2 && per.baud) {
        const fck = busClock(cfg, info2.bus)
        if (fck > 0) {
          const b = usartBrr(fck, per.baud)
          if (!b) out.push(err('baud-range', `${name}: скорость ${per.baud} бод недостижима при частоте шины ${+(fck / 1e6).toFixed(3)} МГц.`, { periph: name }))
          else if (Math.abs(b.errorPct) > 2) out.push(warn('baud-error', `${name}: фактическая скорость ${Math.round(b.actualBaud)} бод, ошибка ${b.errorPct.toFixed(2)} % (рекомендуется меньше 2 %).`, { periph: name }))
        }
      } else if (info2 && !per.baud) out.push(warn('baud-missing', `${name}: не задана скорость (бод).`, { periph: name }))
    }
    if (fam && !(/^USART\d$/.test(name) && usartInfo(chip, name))) out.push(info('gen-unsupported', `${name}: инициализацию периферии генерация не поддерживает — настройте вручную; выводы (режим альтернативной функции) настроены.`, { periph: name }))
  }

  // занятость выводов: несколько ролей = конфликт
  const usage = pinUsage(cfg, pkg)
  for (const [pin, list] of [...usage.entries()].sort((a, b) => comparePins(a[0], b[0]))) {
    if (!findPin(pkg, pin)) continue
    const g = guards.get(pin)?.filter((x) => x.kind !== 'jtag')
    const confirmed = cfg.pins[pin]?.confirmed === true
    if (list.length > 1) out.push(err('pin-busy', `${pin} занят несколькими ролями: ${list.map(usageText).join(' и ')}.`, { pin }))
    if (g && g.length) {
      const own = list.some((u) => u.kind === 'osc')
      const names = [...new Set(g.map((x) => GUARD_LABEL[x.kind]))].join('/')
      if (!confirmed && !own) out.push(err('pin-reserved', `${pin} — вывод ${names}: ${g[0].text}. Занять его можно только осознанно (подтвердите в инспекторе).`, { pin }))
      else if (confirmed) out.push(warn('pin-reserved-ok', `${pin} — вывод ${names}, занят по вашему подтверждению: ${g[0].text}.`, { pin }))
    }
  }
  // F1: ремап
  if (fam === 'f1') {
    const rp = planRemap(cfg, pkg)
    for (const [periph, r] of Object.entries(rp.byPeriph)) {
      if (r === null) out.push(err('remap-mismatch', `${periph}: выводы требуют разных вариантов ремапа AFIO — все выводы периферии должны быть из одного варианта (см. таблицу функций выводов).`, { periph }))
    }
    for (const t of rp.unknown) out.push(warn('remap-unsupported', `Ремап ${t} генерация не поддерживает — AFIO->MAPR настройте вручную.`))
    const jt = Object.keys(guardedJtag(cfg, guards)).length
    if (jt) out.push(info('jtag-off', 'Выводы JTAG (PA15, PB3, PB4) заняты: в код добавлено отключение JTAG (SWD остаётся).'))
  }
  // метки
  const seen = new Map<string, string>()
  for (const [pin, p] of Object.entries(cfg.pins)) {
    if (!p.label) continue
    const id = labelIdent(p.label)
    if (!id) { out.push(err('label', `Метка «${p.label}» у ${pin}: допустимы латиница, цифры и «_», не с цифры, до 32 знаков.`, { pin })); continue }
    const prev = seen.get(id)
    if (prev) out.push(err('label-dup', `Метка ${id} уже у ${prev}: имена в gpio.h должны быть разными.`, { pin }))
    else seen.set(id, pin)
  }
  // тактирование
  const prof = clockProfile(chip)
  const ck = computeClock(chip, cfg.clock)
  out.push(...ck.issues)
  if (!prof.kind && !ck.issues.length) out.push(info('clock-manual', prof.note ?? 'Тактирование пока вручную.'))
  if (genFamily(chip) === null) out.push(warn('gen-family', `Генерация кода для ${chip.family} не поддерживается: файл конфигурации сохраняется, код — пока вручную.`))
  return out
}

/** Выводы F1, которые после сброса заняты JTAG (PA15, PB3, PB4) и используются конфигурацией. */
export function guardedJtag(cfg: PinsConfig, guards: ReturnType<typeof pinGuards>): Record<string, true> {
  const r: Record<string, true> = {}
  const chip = getChip(cfg.chip)
  if (!chip) return r
  const pkg = chip.packages.find((p) => p.name === cfg.package) ?? chip.packages[0]
  const use = pinUsage(cfg, pkg)
  for (const [pin, g] of guards) if (g.some((x) => x.kind === 'jtag') && !g.some((x) => x.kind === 'swd') && use.has(pin)) r[pin] = true
  return r
}

export const hasErrors = (l: PinIssue[]): boolean => l.some((i) => i.severity === 'error')

/** Выводы с конфликтами (для подсветки). */
export function conflictPins(issues: PinIssue[]): Set<string> {
  return new Set(issues.filter((i) => i.pin && (i.code === 'pin-busy' || i.code === 'pin-reserved' || i.code === 'af-missing' || i.code === 'pin-missing')).map((i) => i.pin!))
}

// Файл avride.pins.json: значения по умолчанию, чтение с проверкой и миграцией, запись в каноническом виде.
import { getChip } from '../chipdb'
import { defaultClock, AHB_DIVS, APB_DIVS } from './clock'
import { comparePins } from './model'
import { EDGES, GPIO_ROLES, OTYPES, PINS_SCHEMA, PULLS, SPEEDS } from './types'
import type { ClockCfg, PeriphCfg, PinCfg, PinsConfig } from './types'

export interface SchemaIssue { path: string; message: string }

export function defaultPinsConfig(chipId: string, pkg?: string): PinsConfig {
  const chip = getChip(chipId)
  return {
    schemaVersion: PINS_SCHEMA, chip: chipId.toLowerCase(), ...(pkg ? { package: pkg } : {}), mode: 'cmsis', pins: {}, peripherals: {},
    clock: chip ? defaultClock(chip) : { source: 'hsi', pllSource: 'hsi', hseHz: 8_000_000, hseBypass: false, pll: {}, ahbDiv: 1, apb1Div: 1, apb2Div: 1 }
  }
}

export type ParsePinsResult =
  | { ok: true; config: PinsConfig; warnings: SchemaIssue[]; migratedFrom: number | null }
  | { ok: false; errors: SchemaIssue[] }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const oneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => typeof v === 'string' && (list as readonly string[]).includes(v)

/** Миграция старых версий схемы на текущую. Версии до 1 не существовало (файл без schemaVersion): поля, которых нет, заполняются значениями по умолчанию. */
function migrate(raw: Record<string, unknown>, warnings: SchemaIssue[]): { raw: Record<string, unknown>; from: number | null } {
  const v = raw['schemaVersion']
  if (v === undefined) {
    warnings.push({ path: 'schemaVersion', message: 'Нет поля schemaVersion — файл считается схемой 1 и будет записан с этим полем.' })
    return { raw: { ...raw, schemaVersion: PINS_SCHEMA }, from: 0 }
  }
  return { raw, from: null }
}

function parseClock(raw: unknown, base: ClockCfg, errors: SchemaIssue[]): ClockCfg {
  if (raw === undefined) return base
  if (!isObj(raw)) { errors.push({ path: 'clock', message: 'Ожидается объект.' }); return base }
  const c: ClockCfg = { ...base, pll: { ...base.pll } }
  if (raw['source'] !== undefined) { if (oneOf(raw['source'], ['hsi', 'hse', 'pll'] as const)) c.source = raw['source']; else errors.push({ path: 'clock.source', message: 'Допустимо: hsi, hse, pll.' }) }
  if (raw['pllSource'] !== undefined) { if (oneOf(raw['pllSource'], ['hsi', 'hse'] as const)) c.pllSource = raw['pllSource']; else errors.push({ path: 'clock.pllSource', message: 'Допустимо: hsi, hse.' }) }
  if (raw['hseHz'] !== undefined) { if (typeof raw['hseHz'] === 'number' && Number.isFinite(raw['hseHz']) && raw['hseHz'] > 0) c.hseHz = raw['hseHz']; else errors.push({ path: 'clock.hseHz', message: 'Частота HSE — положительное число в герцах.' }) }
  if (raw['hseBypass'] !== undefined) { if (typeof raw['hseBypass'] === 'boolean') c.hseBypass = raw['hseBypass']; else errors.push({ path: 'clock.hseBypass', message: 'Ожидается true или false.' }) }
  for (const [k, list] of [['ahbDiv', AHB_DIVS], ['apb1Div', APB_DIVS], ['apb2Div', APB_DIVS]] as const) {
    if (raw[k] === undefined) continue
    if (typeof raw[k] === 'number' && list.includes(raw[k] as number)) c[k] = raw[k] as number
    else errors.push({ path: `clock.${k}`, message: `Допустимо: ${list.join(', ')}.` })
  }
  if (raw['pll'] !== undefined) {
    if (!isObj(raw['pll'])) errors.push({ path: 'clock.pll', message: 'Ожидается объект.' })
    else {
      for (const k of ['m', 'n', 'p', 'q', 'r', 'mul'] as const) {
        const x = (raw['pll'] as Record<string, unknown>)[k]
        if (x === undefined) continue
        if (typeof x === 'number' && Number.isInteger(x) && x > 0) c.pll[k] = x
        else errors.push({ path: `clock.pll.${k}`, message: 'Ожидается целое положительное число.' })
      }
      const d = (raw['pll'] as Record<string, unknown>)['hseDiv2']
      if (d !== undefined) { if (typeof d === 'boolean') c.pll.hseDiv2 = d; else errors.push({ path: 'clock.pll.hseDiv2', message: 'Ожидается true или false.' }) }
    }
  }
  return c
}

/** Разбор текста avride.pins.json: структура и типы (не конфликты выводов — их ищет checkConfig). */
export function parsePinsText(text: string): ParsePinsResult {
  let raw: unknown
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch (e) {
    const location = /line (\d+) column (\d+)/.exec((e as Error).message)
    const where = location ? ` (строка ${location[1]}, столбец ${location[2]})` : ''
    return { ok: false, errors: [{ path: '', message: `Ошибка синтаксиса JSON${where}. Проверьте кавычки, запятые и закрывающие скобки.` }] }
  }
  if (!isObj(raw)) return { ok: false, errors: [{ path: '', message: 'Ожидается объект JSON.' }] }
  const warnings: SchemaIssue[] = []
  const errors: SchemaIssue[] = []
  const m = migrate(raw, warnings)
  const r = m.raw
  if (typeof r['schemaVersion'] !== 'number' || !Number.isInteger(r['schemaVersion'])) return { ok: false, errors: [{ path: 'schemaVersion', message: 'Версия схемы — целое число.' }] }
  if (r['schemaVersion'] > PINS_SCHEMA) return { ok: false, errors: [{ path: 'schemaVersion', message: `Файл создан более новой версией AVR IDE (схема ${r['schemaVersion']}, поддерживается ${PINS_SCHEMA}).` }] }
  if (typeof r['chip'] !== 'string' || !getChip(r['chip'])) return { ok: false, errors: [{ path: 'chip', message: `Чип «${String(r['chip'])}» нет в базе чипов.` }] }
  const cfg = defaultPinsConfig(r['chip'])
  if (r['package'] !== undefined) { if (typeof r['package'] === 'string') cfg.package = r['package']; else errors.push({ path: 'package', message: 'Ожидается строка.' }) }
  if (r['mode'] !== undefined) { if (oneOf(r['mode'], ['cmsis', 'hal'] as const)) cfg.mode = r['mode']; else errors.push({ path: 'mode', message: 'Допустимо: cmsis, hal.' }) }
  if (r['pins'] !== undefined) {
    if (!isObj(r['pins'])) errors.push({ path: 'pins', message: 'Ожидается объект «вывод → настройки».' })
    else for (const [pin, v] of Object.entries(r['pins'])) {
      if (!/^P[A-Z]\d{1,2}$/.test(pin)) { errors.push({ path: `pins.${pin}`, message: 'Имя вывода — вида PA9.' }); continue }
      if (!isObj(v)) { errors.push({ path: `pins.${pin}`, message: 'Ожидается объект.' }); continue }
      const p: PinCfg = {}
      const at = `pins.${pin}`
      if (v['role'] !== undefined) { if (oneOf(v['role'], GPIO_ROLES)) p.role = v['role']; else errors.push({ path: `${at}.role`, message: `Допустимо: ${GPIO_ROLES.join(', ')}.` }) }
      if (v['pull'] !== undefined) { if (oneOf(v['pull'], PULLS)) p.pull = v['pull']; else errors.push({ path: `${at}.pull`, message: `Допустимо: ${PULLS.join(', ')}.` }) }
      if (v['speed'] !== undefined) { if (oneOf(v['speed'], SPEEDS)) p.speed = v['speed']; else errors.push({ path: `${at}.speed`, message: `Допустимо: ${SPEEDS.join(', ')}.` }) }
      if (v['otype'] !== undefined) { if (oneOf(v['otype'], OTYPES)) p.otype = v['otype']; else errors.push({ path: `${at}.otype`, message: `Допустимо: ${OTYPES.join(', ')}.` }) }
      if (v['initial'] !== undefined) { if (oneOf(v['initial'], ['low', 'high'] as const)) p.initial = v['initial']; else errors.push({ path: `${at}.initial`, message: 'Допустимо: low, high.' }) }
      if (v['edge'] !== undefined) { if (oneOf(v['edge'], EDGES)) p.edge = v['edge']; else errors.push({ path: `${at}.edge`, message: `Допустимо: ${EDGES.join(', ')}.` }) }
      if (v['label'] !== undefined) { if (typeof v['label'] === 'string') p.label = v['label']; else errors.push({ path: `${at}.label`, message: 'Ожидается строка.' }) }
      if (v['confirmed'] !== undefined) { if (typeof v['confirmed'] === 'boolean') p.confirmed = v['confirmed']; else errors.push({ path: `${at}.confirmed`, message: 'Ожидается true или false.' }) }
      cfg.pins[pin] = p
    }
  }
  if (r['peripherals'] !== undefined) {
    if (!isObj(r['peripherals'])) errors.push({ path: 'peripherals', message: 'Ожидается объект «периферия → настройки».' })
    else for (const [name, v] of Object.entries(r['peripherals'])) {
      const at = `peripherals.${name}`
      if (!/^[A-Z][A-Z0-9]*$/.test(name)) { errors.push({ path: at, message: 'Имя периферии — вида USART1.' }); continue }
      if (!isObj(v)) { errors.push({ path: at, message: 'Ожидается объект.' }); continue }
      const per: PeriphCfg = { enabled: v['enabled'] === true, signals: {} }
      if (v['enabled'] !== undefined && typeof v['enabled'] !== 'boolean') errors.push({ path: `${at}.enabled`, message: 'Ожидается true или false.' })
      if (v['signals'] !== undefined) {
        if (!isObj(v['signals'])) errors.push({ path: `${at}.signals`, message: 'Ожидается объект «сигнал → вывод».' })
        else for (const [s, pin] of Object.entries(v['signals'])) {
          if (typeof pin === 'string' && /^P[A-Z]\d{1,2}$/.test(pin)) per.signals[s] = pin
          else errors.push({ path: `${at}.signals.${s}`, message: 'Вывод — вида PA9.' })
        }
      }
      if (v['baud'] !== undefined) { if (typeof v['baud'] === 'number' && Number.isInteger(v['baud']) && v['baud'] > 0) per.baud = v['baud']; else errors.push({ path: `${at}.baud`, message: 'Скорость — целое положительное число (бод).' }) }
      cfg.peripherals[name] = per
    }
  }
  cfg.clock = parseClock(r['clock'], cfg.clock, errors)
  if (errors.length) return { ok: false, errors }
  return { ok: true, config: cfg, warnings, migratedFrom: m.from }
}

export const formatSchemaIssues = (l: SchemaIssue[]): string => l.map((i) => (i.path ? `${i.path}: ` : '') + i.message).join('; ')

const PIN_KEYS: (keyof PinCfg)[] = ['role', 'pull', 'speed', 'otype', 'initial', 'edge', 'label', 'confirmed']

const sortKeys = <T,>(o: Record<string, T>, cmp: (a: string, b: string) => number): Record<string, T> => Object.fromEntries(Object.keys(o).sort(cmp).map((k) => [k, o[k]]))

/** Канонический текст файла: вывод по порядку портов, периферия по алфавиту, пустые записи опущены; перенос строки в конце. */
export function serializePins(cfg: PinsConfig): string {
  const pins: Record<string, PinCfg> = {}
  for (const [k, v] of Object.entries(cfg.pins)) {
    const e = Object.fromEntries(PIN_KEYS.filter((f) => v[f] !== undefined && v[f] !== false && v[f] !== '').map((f) => [f, v[f]])) as PinCfg
    if (Object.keys(e).length) pins[k] = e
  }
  const out = { schemaVersion: PINS_SCHEMA, chip: cfg.chip, ...(cfg.package ? { package: cfg.package } : {}), mode: cfg.mode, pins: sortKeys(pins, comparePins), peripherals: sortKeys(cfg.peripherals, (a, b) => a.localeCompare(b, 'en', { numeric: true })), clock: cfg.clock }
  return JSON.stringify(out, null, 2) + '\n'
}

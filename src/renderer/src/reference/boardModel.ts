// Модель схемы платы без React: разбор токенов гребёнок, координаты выводов, категории и теги функций.
import type { BoardComp, BoardEntry, BoardHeader, BoardLayout, PinInfo } from './types'
import { boardArt } from './data/boardArt'

export type Cat =
  | 'power' | 'gnd' | 'reset' | 'ref' | 'nc'
  | 'digital' | 'analog' | 'pwm' | 'i2c' | 'spi' | 'uart' | 'touch' | 'dac' | 'int'
  | 'strap' | 'flash' | 'inonly' | 'usb' | 'can' | 'swd'

export const CAT_LABEL: Record<Cat, string> = {
  power: 'питание',
  gnd: 'земля (GND)',
  reset: 'сброс / EN',
  ref: 'опорное напряжение',
  nc: 'не подключён',
  digital: 'цифровой GPIO',
  analog: 'аналоговый вход (ADC)',
  pwm: 'ШИМ',
  i2c: 'I2C',
  spi: 'SPI',
  uart: 'UART',
  touch: 'сенсорный',
  dac: 'ЦАП (DAC)',
  int: 'прерывание',
  strap: 'strapping / осторожно',
  flash: 'flash — не использовать',
  inonly: 'только вход',
  usb: 'USB',
  can: 'CAN',
  swd: 'SWD (отладка)'
}

export const CAT_ORDER: Cat[] = ['power', 'gnd', 'reset', 'ref', 'digital', 'analog', 'pwm', 'i2c', 'spi', 'uart', 'touch', 'dac', 'int', 'strap', 'flash', 'inonly', 'usb', 'can', 'swd', 'nc']

export const PITCH = 2.54

export interface Tag { text: string; cat: Cat }

/** «label|надпись» → пара; без «|» надпись равна имени. */
export function parseToken(tok: string): { label: string; silk: string } {
  const i = tok.lastIndexOf('|')
  return i < 0 ? { label: tok, silk: tok } : { label: tok.slice(0, i), silk: tok.slice(i + 1) }
}

export interface PlacedPin {
  /** Уникальный ключ вывода на плате (индекс в гребёнке) */
  key: string
  label: string
  silk: string
  /** Центр площадки, мм */
  x: number
  y: number
  side: BoardHeader['labels']
  bare: boolean
}

/** Все выводы платы с координатами (мм). Числа в списке — зазоры. */
export function placePins(layout: BoardLayout): PlacedPin[] {
  const out: PlacedPin[] = []
  layout.headers.forEach((h, hi) => {
    if (h.pts) {
      h.pins.forEach((tok, i) => {
        const { label, silk } = parseToken(String(tok))
        out.push({ key: `${hi}:${i}`, label, silk, x: h.pts![i][0], y: h.pts![i][1], side: h.labels, bare: !!h.bare })
      })
      return
    }
    let off = 0
    h.pins.forEach((tok, i) => {
      if (typeof tok === 'number') { off += tok; return }
      const { label, silk } = parseToken(tok)
      out.push({
        key: `${hi}:${i}`, label, silk,
        x: h.dir === 'right' ? h.x + off : h.x,
        y: h.dir === 'down' ? h.y + off : h.y,
        side: h.labels,
        bare: !!h.bare
      })
      off += PITCH
    })
  })
  return out
}

/** Теги функций пина (ADC, PWM, SDA…) — из текстовых функций справочника. */
export function pinTags(p: PinInfo): Tag[] {
  const tags: Tag[] = []
  const add = (text: string, cat: Cat): void => { if (!tags.some((t) => t.text === text)) tags.push({ text, cat }) }
  if (p.special === 'strapping' || p.special === 'warning') add(p.special === 'strapping' ? 'strap' : '!', 'strap')
  if (p.special === 'flash') add('flash', 'flash')
  if (p.special === 'input-only') add('только IN', 'inonly')
  if (p.special === 'usb') add('USB', 'usb')
  for (const f of p.functions) {
    let m: RegExpMatchArray | null
    if ((m = f.match(/^ADC\d_IN(\d+)/))) add('ADC' + m[1], 'analog')
    else if (/^TIM\d+_CH|^PWM\d+ [AB]/.test(f)) add('PWM', 'pwm')
    else if ((m = f.match(/^I2C(\d) (SDA|SCL)/))) add(m[2] + m[1], 'i2c')
    else if ((m = f.match(/^SPI(\d) (SS|CS|MOSI|MISO|SCK)/))) add(m[2] + m[1], 'spi')
    else if ((m = f.match(/^U?S?ART(\d) (RX|TX)/))) add(m[2] + m[1], 'uart')
    else if (/^CAN\d? (RX|TX)/.test(f)) add('CAN', 'can')
    else if (/^USB_/.test(f)) add('USB', 'usb')
    else if (/^(SWDIO|SWCLK|SWO)/.test(f)) add(f.split(' ')[0], 'swd')
    else if (/^BOOT\d/.test(f)) add(f.split(' ')[0], 'strap')
    else if ((m = f.match(/^ADC \((A\d+)\)/))) add('ADC ' + m[1], 'analog')
    else if ((m = f.match(/^ADC[\d_]*/))) add(m[0], 'analog')
    else if (/^ADC/.test(f)) add('ADC', 'analog')
    else if ((m = f.match(/^Touch(\d+)/))) add('T' + m[1], 'touch')
    else if ((m = f.match(/^DAC(\d)/))) add('DAC' + m[1], 'dac')
    else if (f === 'PWM') add('PWM', 'pwm')
    else if ((m = f.match(/I2C (SDA|SCL)/))) add(m[1], 'i2c')
    else if ((m = f.match(/SPI (SS|CS|MOSI|MISO|SCK)/))) add(m[1], 'spi')
    else if ((m = f.match(/^(RX|TX)(\d)?(?!\w)/))) add(m[1] + (m[2] ?? ''), 'uart')
    else if ((m = f.match(/^UART(\d) (RX|TX)/))) add(m[2] + m[1], 'uart')
    else if ((m = f.match(/^(RX|TX)D(\d)/))) add(m[1] + m[2], 'uart')
    else if ((m = f.match(/^INT(\d)/))) add('INT' + m[1], 'int')
    else if (/^LED/.test(f)) add('LED', 'digital')
    else if (/BOOT button|FLASH button/.test(f)) add(f.startsWith('BOOT') ? 'BOOT' : 'FLASH', 'strap')
  }
  return tags
}

/** Основная категория вывода — по ней красится площадка. */
export function pinCat(p: PinInfo): Cat {
  if (p.kind) return p.kind
  if (p.special === 'flash') return 'flash'
  if (p.special === 'strapping' || p.special === 'warning') return 'strap'
  if (p.special === 'input-only') return 'inonly'
  if (p.special === 'usb') return 'usb'
  const cats = pinTags(p).map((t) => t.cat)
  if (p.plain) return cats.includes('analog') ? 'analog' : 'digital'
  for (const c of ['swd', 'can', 'i2c', 'spi', 'uart', 'analog', 'dac', 'touch', 'pwm'] as Cat[]) if (cats.includes(c)) return c
  return 'digital'
}

/** Размер скетча-вывода: число, которое пишут в код (pinMode(N, …)), либо метка вроде A0. */
export function codeName(board: BoardEntry, p: PinInfo): string | null {
  if (p.code) return p.code
  if (p.gpio === null) return null
  if (board.platform === 'avr' && /^A\d+$/.test(p.label)) return p.label
  return String(p.gpio)
}

export interface ChipSpec { text: string; cat: Cat; kind: 'silk' | 'gpio' | 'tag' }

/** Содержимое подписи вывода: надпись на плате, номер GPIO (если отличается), теги функций. */
export function pinChips(pin: PinInfo, silk: string, maxTags: number, withGpio: boolean): ChipSpec[] {
  const cat = pinCat(pin)
  const out: ChipSpec[] = [{ text: silk, cat, kind: 'silk' }]
  if (withGpio && /^GPIO\d+$/.test(pin.label) && pin.label !== silk) out.push({ text: pin.label, cat: 'digital', kind: 'gpio' })
  if (pin.functions.length > 0) {
    for (const t of pinTags(pin).slice(0, maxTags)) {
      if (t.text === silk) continue
      out.push({ text: t.text, cat: t.cat, kind: 'tag' })
    }
  }
  return out
}

// ---------- геометрия подписей (единицы viewBox: 10 на мм) ----------

export const S = 10
export const CH = 18
export const CW = 7.3
export const GAP = 3
export const PAD_R = 9

export const chipW = (c: ChipSpec, k = 1): number => Math.max(17 * k, c.text.length * CW * k + 10 * k)
/** Длина ряда подписей от центра площадки (с отступом 12 от центра, без хвостового зазора). */
export const rowExtent = (chips: ChipSpec[], k = 1): number => chips.reduce((s, c) => s + chipW(c, k) + GAP, 12) - GAP

export interface Box { x0: number; y0: number; x1: number; y1: number }
export interface LabelRow { pp: PlacedPin; pin: PinInfo | undefined; chips: ChipSpec[]; box: Box; /** ширины колонок-слотов подписей (общие для гребёнки) */ ws: number[]; /** длина ряда от центра площадки */ ext: number; /** длина самого длинного ряда гребёнки (для общей выноски) */ hext: number }

/** Ряды подписей всех выводов с ограничивающими прямоугольниками (в единицах viewBox, начало — угол платы).
 *  Колонки подписей выровнены по гребёнке: i-я подпись у всех выводов одной гребёнки имеет одну ширину и одно смещение. */
export function labelRows(board: BoardEntry, layout: BoardLayout, compact: boolean, k = 1): LabelRow[] {
  const byLabel = new Map(board.pins.map((p) => [p.label, p]))
  const maxTags = compact ? 0 : 3
  const base = placePins(layout).map((pp) => {
    const pin = byLabel.get(pp.label)
    const chips: ChipSpec[] = pin ? pinChips(pin, pp.silk, pp.bare ? 0 : (board.platform === 'stm32' && (pp.side === 't' || pp.side === 'b') ? Math.min(maxTags, 2) : maxTags), !compact && !pp.bare) : [{ text: pp.silk, cat: 'digital', kind: 'silk' }]
    return { pp, pin, chips, hi: pp.key.split(':')[0] }
  })
  const slots = new Map<string, number[]>()
  for (const r of base) {
    const w = slots.get(r.hi) ?? []
    r.chips.forEach((c, i) => { w[i] = Math.max(w[i] ?? 0, chipW(c, k)) })
    slots.set(r.hi, w)
  }
  const rows: LabelRow[] = base.map(({ pp, pin, chips, hi }) => {
    // колонки выравниваем только в гребёнках, где есть теги; одиночные надписи остаются своей ширины
    const ws = chips.length > 1 || (slots.get(hi)!.length > 1) ? slots.get(hi)! : chips.map((c) => chipW(c, k))
    const e = chips.reduce((sum, _c, i) => sum + ws[i] + GAP, 12) - GAP
    const px = pp.x * S, py = pp.y * S
    const h = (CH * k) / 2
    const box: Box =
      pp.side === 'l' ? { x0: px - e, x1: px - 12, y0: py - h, y1: py + h }
      : pp.side === 'r' ? { x0: px + 12, x1: px + e, y0: py - h, y1: py + h }
      : pp.side === 't' ? { x0: px - h, x1: px + h, y0: py - e, y1: py - 12 }
      : { x0: px - h, x1: px + h, y0: py + 12, y1: py + e }
    return { pp, pin, chips, box, ws, ext: e, hext: 0 }
  })
  const hmax = new Map<string, number>()
  for (const r of rows) { const hi = r.pp.key.split(':')[0]; hmax.set(hi, Math.max(hmax.get(hi) ?? 0, r.ext)) }
  for (const r of rows) r.hext = hmax.get(r.pp.key.split(':')[0])!
  return rows
}

/** Прямоугольник детали платы (в единицах viewBox) — для проверки наложений с подписями. */
export function compBox(c: BoardComp): Box | null {
  if (c.t === 'text') { const w = c.text.length * (c.size ?? 2) * S * 0.62 + 4, h = (c.size ?? 2) * S * 0.8; return { x0: c.x * S - w / 2, x1: c.x * S + w / 2, y0: c.y * S - h / 2, y1: c.y * S + h / 2 } }
  if (c.t === 'btn' && c.label) { const b = { x0: (c.x - 1.9) * S, y0: (c.y - 1.9) * S, x1: (c.x + 1.9) * S, y1: (c.y + 1.9) * S }; const lw = c.label.length * 8.4 + 4, lp = c.lp ?? 'r'; if (lp === 't') return { ...b, x0: Math.min(b.x0, c.x * S - lw / 2), x1: Math.max(b.x1, c.x * S + lw / 2), y0: b.y0 - 18 }; if (lp === 'b') return { ...b, x0: Math.min(b.x0, c.x * S - lw / 2), x1: Math.max(b.x1, c.x * S + lw / 2), y1: b.y1 + 18 }; if (lp === 'l') return { ...b, x0: b.x0 - lw - 5 }; return { ...b, x1: b.x1 + lw + 5 } }
  if (c.t === 'btn') return { x0: (c.x - 1.9) * S, y0: (c.y - 1.9) * S, x1: (c.x + 1.9) * S, y1: (c.y + 1.9) * S }
  if (c.t === 'led') return { x0: c.x * S - 8, y0: c.y * S - 4.5, x1: c.x * S + 8, y1: c.y * S + 4.5 }
  if (c.t === 'icsp') { const cols = c.vertical ? 2 : 3, rows = c.vertical ? 3 : 2; return { x0: c.x * S, y0: c.y * S, x1: c.x * S + cols * PITCH * S, y1: c.y * S + rows * PITCH * S } }
  return { x0: c.x * S, y0: c.y * S, x1: (c.x + c.w) * S, y1: (c.y + c.h) * S }
}

export const boxesOverlap = (a: Box, b: Box, tol = 0): boolean => a.x0 < b.x1 - tol && a.x1 > b.x0 + tol && a.y0 < b.y1 - tol && a.y1 > b.y0 + tol

// ---------- размеры холста и подгонка под ширину панели ----------

export interface Measure { rows: LabelRow[]; x0: number; y0: number; W: number; H: number; m: { l: number; r: number; t: number; b: number }; compact: boolean; k: number }

/** Границы схемы: плата + рисунок + выступающие детали + запас под подписи. Единицы viewBox. */
export function measure(board: BoardEntry, layout: BoardLayout, compact: boolean, k: number): Measure {
  const rows = labelRows(board, layout, compact, k)
  let x0 = 0, y0 = 0, x1 = layout.w, y1 = layout.h
  const art = layout.art ? boardArt[layout.art] : null
  if (art) { x0 = Math.min(x0, art.x); y0 = Math.min(y0, art.y); x1 = Math.max(x1, art.x + art.w); y1 = Math.max(y1, art.y + art.h) }
  for (const c of layout.comps) {
    const w = 'w' in c ? c.w : 0, h = 'h' in c ? c.h : 0
    x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x + w); y1 = Math.max(y1, c.y + h)
  }
  const m = { l: 18, r: 18, t: 22, b: 22 }
  for (const r of rows) m[r.pp.side] = Math.max(m[r.pp.side], r.ext + 4)
  return { rows, x0, y0, m, W: (x1 - x0) * S + m.l + m.r, H: (y1 - y0) * S + m.t + m.b, compact, k }
}

export const TARGET_FONT_PX = 10.5
export const BASE_FONT = 12.5
export const MAX_K = 1.3

/** Режим подписей под ширину панели P (px): полный с тегами, а если мелко — только надписи на плате, крупнее. */
export function fitMode(board: BoardEntry, layout: BoardLayout, P: number): Measure {
  const full = measure(board, layout, false, 1)
  if ((P / full.W) * BASE_FONT >= TARGET_FONT_PX) return full
  const c1 = measure(board, layout, true, 1)
  let k = Math.min(MAX_K, Math.max(1, TARGET_FONT_PX / ((P / c1.W) * BASE_FONT)))
  let c = measure(board, layout, true, k)
  // ширина выросла вместе с подписями — один раз уточняем
  k = Math.min(MAX_K, Math.max(1, TARGET_FONT_PX / ((P / c.W) * BASE_FONT)))
  c = measure(board, layout, true, k)
  return c
}

/** Вывод с цифровым вводом-выводом (есть номер GPIO либо имя порта STM32). */
export const isIo = (p: PinInfo): boolean => p.gpio !== null || !!p.code

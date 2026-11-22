// Схема корпуса чипа (SVG) по таблице выводов из базы чипов: LQFP/UFQFPN — выводы по четырём сторонам, TSSOP — по двум, WLCSP — сетка шариков.
// Цвет вывода — по роли: GPIO, функция периферии, аналог, питание, особые, конфликт. Клик — выбор вывода, наведение — подсказка.
import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ChipPackage, PinRow } from '../../../../shared/pro/chipdb'
import { isAnalogSignal, ROLE_LABEL, usageText } from '../../../../shared/pro/pinconfig/model'
import type { PinGuard, Usage } from '../../../../shared/pro/pinconfig/model'
import type { PinsConfig } from '../../../../shared/pro/pinconfig/types'

export type PinState = 'free' | 'gpio' | 'af' | 'analog' | 'power' | 'special' | 'protected' | 'conflict'

export const STATE_LABEL: Record<PinState, string> = {
  free: 'Свободен', gpio: 'GPIO', af: 'Функция периферии', analog: 'Аналог', power: 'Питание, земля', special: 'Особый (NRST, BOOT0, HSE)', protected: 'Защищён (SWD, кварц, BOOT0)', conflict: 'Конфликт'
}

export interface PinVisual { state: PinState; text: string }

/** Роль вывода для цвета и подсказки. */
export function visualOf(row: PinRow, cfg: PinsConfig, usage: Usage[] | undefined, guards: PinGuard[] | undefined, conflicts: Set<string>): PinVisual {
  const [, name, type, alias] = row
  if (type === 'power' || type === 'mono') return { state: 'power', text: 'Питание или земля' }
  if (type === 'reset') return { state: 'special', text: 'Сброс (NRST)' }
  if (type === 'boot') return { state: 'special', text: 'BOOT0: выбор источника запуска' }
  const label = cfg.pins[name]?.label
  const guardText = guards?.filter((g) => g.kind !== 'jtag')[0]?.text
  if (conflicts.has(name)) return { state: 'conflict', text: `Конфликт: ${(usage ?? []).map(usageText).join(' и ') || 'вывод занят'}` }
  const u = usage?.[0]
  if (u) {
    if (u.kind === 'osc') return { state: 'special', text: `${usageText(u)}` }
    if (u.kind === 'gpio') return { state: u.role === 'analog' ? 'analog' : 'gpio', text: `GPIO: ${ROLE_LABEL[u.role]}${label ? `, метка ${label}` : ''}` }
    return { state: isAnalogSignal(u.signal) ? 'analog' : 'af', text: `${u.signal}${label ? `, метка ${label}` : ''}` }
  }
  if (guardText) return { state: 'protected', text: guardText }
  void alias
  return { state: 'free', text: label ? `Свободен, метка ${label}` : 'Свободен' }
}

interface Cell { row: PinRow; x: number; y: number; w: number; h: number; side: 'L' | 'R' | 'T' | 'B' | 'G'; cx: number; cy: number }
interface Layout { /** подпись чипа: центр корпуса или полоса под сеткой */ label: { x: number; y: number }; w: number; h: number; body: { x: number; y: number; w: number; h: number }; cells: Cell[]; round: boolean }

const STUB = 15
const MARGIN = 6

function layoutOf(pkg: ChipPackage): Layout {
  const pins = pkg.pins
  const n = pins.length
  const grid = pins.every((p) => /^[A-Z]{1,2}\d{1,2}$/.test(p[0]))
  if (grid) {
    const rows = [...new Set(pins.map((p) => /^[A-Z]+/.exec(p[0])![0]))].sort((a, b) => (a.length === b.length ? a.localeCompare(b) : a.length - b.length))
    const cols = [...new Set(pins.map((p) => Number(/\d+/.exec(p[0])![0])))].sort((a, b) => a - b)
    const pitch = 46, pad = 26
    const cells: Cell[] = pins.map((p) => {
      const r = rows.indexOf(/^[A-Z]+/.exec(p[0])![0]), c = cols.indexOf(Number(/\d+/.exec(p[0])![0]))
      const cx = pad + 12 + c * pitch, cy = pad + 12 + r * pitch
      return { row: p, x: cx - 13, y: cy - 13, w: 26, h: 26, side: 'G', cx, cy }
    })
    const w = pad * 2 + 24 + (cols.length - 1) * pitch, h0 = pad * 2 + 24 + (rows.length - 1) * pitch
    return { w, h: h0 + 34, label: { x: w / 2, y: h0 + 14 }, body: { x: 6, y: 6, w: w - 12, h: h0 - 12 }, cells, round: true }
  }
  const dual = /^(TSSOP|SO|DIP)/i.test(pkg.name) || n <= 24 && !/QFN|LQFP/i.test(pkg.name)
  if (dual) {
    const per = Math.ceil(n / 2)
    const pitch = 24
    const bodyW = 150, bodyH = per * pitch + 20
    const cells: Cell[] = pins.map((p, i) => {
      const left = i < per
      const k = left ? i : n - 1 - i
      const y = 10 + k * pitch + (pitch - (pitch - 4)) / 2
      return left
        ? { row: p, x: MARGIN, y: MARGIN + y, w: STUB, h: pitch - 4, side: 'L', cx: MARGIN + STUB / 2, cy: MARGIN + y + (pitch - 4) / 2 }
        : { row: p, x: MARGIN + STUB + bodyW, y: MARGIN + y, w: STUB, h: pitch - 4, side: 'R', cx: MARGIN + STUB + bodyW + STUB / 2, cy: MARGIN + y + (pitch - 4) / 2 }
    })
    return { w: bodyW + 2 * STUB + 2 * MARGIN, h: bodyH + 2 * MARGIN, label: { x: MARGIN + STUB + bodyW / 2, y: MARGIN + bodyH / 2 }, body: { x: MARGIN + STUB, y: MARGIN, w: bodyW, h: bodyH }, cells, round: false }
  }
  // четыре стороны: 1 — слева сверху, дальше против часовой: слева вниз, снизу слева направо, справа снизу вверх, сверху справа налево
  const base = Math.floor(n / 4)
  const extra = n % 4
  const counts = [base + (extra > 0 ? 1 : 0), base + (extra > 1 ? 1 : 0), base + (extra > 2 ? 1 : 0), base]
  const maxPer = Math.max(...counts)
  const pitch = maxPer >= 30 ? 13 : maxPer >= 20 ? 15 : maxPer >= 14 ? 18 : 22
  const inner = maxPer * pitch + 16
  const bodyW = inner + 70, bodyH = inner + 70
  const ox = MARGIN + STUB, oy = MARGIN + STUB
  const cells: Cell[] = []
  let idx = 0
  const thick = pitch - 3
  for (let s = 0; s < 4; s++) {
    for (let k = 0; k < counts[s]; k++, idx++) {
      const p = pins[idx]
      const off = (inner - counts[s] * pitch) / 2 + 35 + k * pitch + (pitch - thick) / 2
      if (s === 0) cells.push({ row: p, x: MARGIN, y: oy + off, w: STUB, h: thick, side: 'L', cx: MARGIN + STUB / 2, cy: oy + off + thick / 2 })
      else if (s === 1) cells.push({ row: p, x: ox + off, y: oy + bodyH, w: thick, h: STUB, side: 'B', cx: ox + off + thick / 2, cy: oy + bodyH + STUB / 2 })
      else if (s === 2) cells.push({ row: p, x: ox + bodyW, y: oy + bodyH - off - thick, w: STUB, h: thick, side: 'R', cx: ox + bodyW + STUB / 2, cy: oy + bodyH - off - thick / 2 })
      else cells.push({ row: p, x: ox + bodyW - off - thick, y: MARGIN, w: thick, h: STUB, side: 'T', cx: ox + bodyW - off - thick / 2, cy: MARGIN + STUB / 2 })
    }
  }
  return { w: bodyW + 2 * (STUB + MARGIN), h: bodyH + 2 * (STUB + MARGIN), label: { x: ox + bodyW / 2, y: oy + bodyH / 2 }, body: { x: ox, y: oy, w: bodyW, h: bodyH }, cells, round: false }
}

/** Область нажатия: контактная площадка вместе с подписью внутри корпуса. */
function hit(c: Cell): { x: number; y: number; w: number; h: number } {
  const L = 52
  if (c.side === 'L') return { x: c.x, y: c.y, w: c.w + L, h: c.h }
  if (c.side === 'R') return { x: c.x - L, y: c.y, w: c.w + L, h: c.h }
  if (c.side === 'T') return { x: c.x, y: c.y, w: c.w, h: c.h + L }
  return { x: c.x, y: c.y - L, w: c.w, h: c.h + L }
}

export default function PackageView({ pkg, cfg, usage, guards, conflicts, selected, highlight, onSelect, chipName }: {
  pkg: ChipPackage
  cfg: PinsConfig
  usage: Map<string, Usage[]>
  guards: Map<string, PinGuard[]>
  conflicts: Set<string>
  selected: string | null
  highlight: Set<string>
  onSelect: (pin: string, row: PinRow) => void
  chipName: string
}): ReactNode {
  const L = useMemo(() => layoutOf(pkg), [pkg])
  const box = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ row: PinRow; x: number; y: number } | null>(null)
  const grid = L.cells[0]?.side === 'G'
  const fontPx = grid ? 8 : L.cells.length > 90 ? 8 : L.cells.length > 60 ? 8.5 : 9.5

  const vis = (row: PinRow): PinVisual => visualOf(row, cfg, usage.get(row[1]), guards.get(row[1]), conflicts)
  const tipVis = tip ? vis(tip.row) : null

  return (
    <div className="pk" ref={box} data-testid="pins-package" data-package={pkg.name}>
      <svg className="pk-svg" viewBox={`0 0 ${L.w} ${L.h}`} role="group" aria-label={`Корпус ${pkg.name}`} preserveAspectRatio="xMidYMid meet">
        <rect className="pk-body" x={L.body.x} y={L.body.y} width={L.body.w} height={L.body.h} rx={grid ? 10 : 6} />
        {!grid && <circle className="pk-mark" cx={L.body.x + 14} cy={L.body.y + 14} r={4} />}
        <text className="pk-chip" x={L.label.x} y={L.label.y} textAnchor="middle" dominantBaseline="middle" transform={!grid && L.body.h > L.body.w * 1.2 ? `rotate(-90 ${L.label.x} ${L.label.y})` : undefined}>
          <tspan x={L.label.x} dy={grid ? '0' : '-0.6em'}>{chipName}</tspan>
          <tspan x={L.label.x} dy="1.4em" className="pk-chip-sub">{pkg.name}</tspan>
        </text>
        {L.cells.map((c) => {
          const [pos, name, type] = c.row
          const v = vis(c.row)
          const io = type === 'io'
          const sel = selected === name
          const hl = highlight.has(name)
          const cls = `pk-pin s-${v.state}${sel ? ' sel' : ''}${hl ? ' hl' : ''}${io ? ' io' : ''}`
          let label: ReactNode
          if (grid) label = <text className="pk-lbl" x={c.cx} y={c.cy + 4} textAnchor="middle" dominantBaseline="central" fontSize={name.length > 7 ? 7 : fontPx}>{name}</text>
          else if (c.side === 'L') label = <text className="pk-lbl" x={L.body.x + 5} y={c.cy} dominantBaseline="central" fontSize={fontPx}>{name}</text>
          else if (c.side === 'R') label = <text className="pk-lbl" x={L.body.x + L.body.w - 5} y={c.cy} textAnchor="end" dominantBaseline="central" fontSize={fontPx}>{name}</text>
          else if (c.side === 'B') label = <text className="pk-lbl" transform={`translate(${c.cx} ${L.body.y + L.body.h - 5}) rotate(-90)`} dominantBaseline="central" fontSize={fontPx}>{name}</text>
          else label = <text className="pk-lbl" transform={`translate(${c.cx} ${L.body.y + 5}) rotate(90)`} dominantBaseline="central" fontSize={fontPx}>{name}</text>
          return (
            <g key={pos} className={cls} data-testid="pin" data-pin={name} data-pos={pos} data-state={v.state} role={io ? 'button' : undefined} tabIndex={io ? 0 : -1}
              aria-label={`${name}, вывод ${pos}: ${v.text}`} aria-pressed={io ? sel : undefined}
              onClick={() => onSelect(name, c.row)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(name, c.row) } }}
              onMouseMove={(e) => { const r = box.current!.getBoundingClientRect(); setTip({ row: c.row, x: e.clientX - r.left, y: e.clientY - r.top }) }}
              onMouseLeave={() => setTip(null)}>
              {grid ? <circle className="pk-pad" cx={c.cx} cy={c.cy} r={18} /> : (
                <>
                  <rect className="pk-hit" x={hit(c).x} y={hit(c).y} width={hit(c).w} height={hit(c).h} />
                  <rect className="pk-pad" x={c.x} y={c.y} width={c.w} height={c.h} rx={1.5} />
                </>
              )}
              <text className="pk-pos" x={c.cx} y={grid ? c.cy - 5 : c.cy} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(7, fontPx - 1.5)}>{pos}</text>
              {label}
            </g>
          )
        })}
      </svg>
      {tip && tipVis && (
        <div className="pk-tip" role="tooltip" data-testid="pin-tip" style={{ left: Math.min(tip.x + 14, (box.current?.clientWidth ?? 400) - 210), top: tip.y + 14 }}>
          <div><b>{tip.row[1]}</b><span className="dim"> · вывод {tip.row[0]}{tip.row[3] ? ` · ${tip.row[3]}` : ''}</span></div>
          <div>{tipVis.text}</div>
          {tip.row[2] === 'io' && <div className="dim">Доступно функций: {tip.row[4].length}. Щёлкните, чтобы настроить.</div>}
        </div>
      )}
    </div>
  )
}

export function Legend(): ReactNode {
  const items: PinState[] = ['gpio', 'af', 'analog', 'power', 'special', 'protected', 'conflict']
  return (
    <ul className="pk-legend" aria-label="Обозначения цветов выводов">
      {items.map((s) => <li key={s}><i className={'pk-sw s-' + s} aria-hidden="true" />{STATE_LABEL[s]}</li>)}
    </ul>
  )
}

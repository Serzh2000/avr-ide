import type { ReactElement } from 'react'
import type { BoardEntry, PinInfo } from './types'

export const SPECIAL_LABEL: Record<NonNullable<PinInfo['special']>, string> = {
  strapping: 'strapping',
  flash: 'flash',
  'input-only': 'только вход',
  usb: 'USB',
  warning: 'осторожно'
}

/** ADC2 на ESP32 недоступен при работающем WiFi — подсвечиваем такие пины. */
export function hasAdc2(board: BoardEntry, p: PinInfo): boolean {
  return board.platform.startsWith('esp32') && p.functions.some((f) => /ADC2/i.test(f))
}

export function pinMatches(p: PinInfo, q: string): boolean {
  if (!q) return true
  const hay = [p.label, String(p.gpio ?? ''), ...p.functions, p.notes ?? '', p.special ? SPECIAL_LABEL[p.special] : ''].join(' ').toLowerCase()
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t))
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

interface Props {
  board: BoardEntry
  query: string
  selected: string | null
  onSelect: (label: string | null) => void
  /** Узкая панель: без текста функций рядом с пинами. */
  compact: boolean
}

const ROW = 26
const TOP = 44

/** Условная схема платы: пины в два столбца, цвет — по особенностям. Порядок как в списке, не физическая раскладка. */
export default function Pinout({ board, query, selected, onSelect, compact }: Props) {
  const pins = board.pins
  const half = Math.ceil(pins.length / 2)
  const left = pins.slice(0, half)
  const right = pins.slice(half)
  const W = compact ? 440 : 760
  const bodyW = compact ? 120 : 150
  const cx = W / 2
  const bx = cx - bodyW / 2
  const H = TOP + half * ROW + 24
  const labelMax = compact ? 12 : 12
  const fnMax = compact ? 0 : 30

  const renderPin = (p: PinInfo, i: number, side: 'l' | 'r'): ReactElement => {
    const y = TOP + i * ROW + ROW / 2
    const dotX = side === 'l' ? bx : bx + bodyW
    const dir = side === 'l' ? -1 : 1
    const anchor = side === 'l' ? 'end' : 'start'
    const match = pinMatches(p, query)
    const adc2 = hasAdc2(board, p)
    const cls = ['pin', p.special ? 'sp-' + p.special : '', selected === p.label ? 'sel' : '', match ? '' : 'dim'].join(' ')
    const fn = fnMax ? clip(p.functions.join(' · '), fnMax) : ''
    const tip = `${p.label}${p.gpio !== null ? ` (GPIO${p.gpio})` : ''}\n${p.functions.join(', ')}${p.special ? `\n[${SPECIAL_LABEL[p.special]}]` : ''}${adc2 ? '\nADC2: недоступен при работающем WiFi' : ''}${p.notes ? '\n' + p.notes : ''}`
    const lx = dotX + dir * 16
    return (
      <g key={p.label} className={cls} onClick={() => onSelect(selected === p.label ? null : p.label)} role="button" tabIndex={0} aria-label={p.label} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(selected === p.label ? null : p.label) } }}>
        <title>{tip}</title>
        <rect className="pin-hit" x={side === 'l' ? 0 : bx + bodyW - 4} y={y - ROW / 2} width={side === 'l' ? bx + 4 : W - (bx + bodyW) + 4} height={ROW} />
        <line className="pin-stem" x1={dotX} y1={y} x2={dotX + dir * 12} y2={y} />
        <circle className="pin-dot" cx={dotX} cy={y} r={6} />
        <text className="pin-label" x={lx} y={y + 4} textAnchor={anchor}>{clip(p.label, labelMax)}</text>
        {fn && (
          <text className="pin-fn" x={lx + dir * (compact ? 0 : 72)} y={y + 4} textAnchor={anchor}>{fn}</text>
        )}
        {adc2 && <circle className="pin-ring" cx={dotX} cy={y} r={10} />}
      </g>
    )
  }

  return (
    <svg className="ref-pinout" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Схема платы ${board.name}`} preserveAspectRatio="xMidYMin meet">
      <rect className="pcb" x={bx} y={TOP - 14} width={bodyW} height={half * ROW + 28} rx={10} />
      <rect className="usb" x={cx - 22} y={TOP - 26} width={44} height={16} rx={3} />
      <text className="pcb-text" x={cx - 8} y={TOP - 14 + (half * ROW + 28) / 2} textAnchor="middle" transform={`rotate(-90 ${cx - 8} ${TOP - 14 + (half * ROW + 28) / 2})`}>{clip(board.name.replace(/\s*\(.*$/, ''), 30)}</text>
      <text className="pcb-mcu" x={cx + 10} y={TOP - 14 + (half * ROW + 28) / 2} textAnchor="middle" transform={`rotate(-90 ${cx + 10} ${TOP - 14 + (half * ROW + 28) / 2})`}>{board.mcu}</text>
      {left.map((p, i) => renderPin(p, i, 'l'))}
      {right.map((p, i) => renderPin(p, i, 'r'))}
    </svg>
  )
}

export function Legend({ board }: { board: BoardEntry }) {
  const used = new Set(board.pins.map((p) => p.special).filter(Boolean))
  const items: { cls: string; label: string; show: boolean }[] = [
    { cls: '', label: 'обычный пин', show: true },
    { cls: 'sp-strapping', label: 'strapping — влияет на загрузку', show: used.has('strapping') },
    { cls: 'sp-input-only', label: 'только вход', show: used.has('input-only') },
    { cls: 'sp-flash', label: 'flash — не использовать', show: used.has('flash') },
    { cls: 'sp-usb', label: 'USB', show: used.has('usb') },
    { cls: 'sp-warning', label: 'осторожно', show: used.has('warning') },
    { cls: 'adc2', label: 'ADC2 — конфликт с WiFi', show: board.platform.startsWith('esp32') && board.pins.some((p) => hasAdc2(board, p)) }
  ]
  return (
    <ul className="ref-legend">
      {items.filter((i) => i.show).map((i) => (
        <li key={i.label}><span className={'lg-dot ' + i.cls} />{i.label}</li>
      ))}
    </ul>
  )
}

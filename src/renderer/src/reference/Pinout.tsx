import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { BoardComp, BoardEntry, BoardLayout, PinInfo } from './types'
import { boardArt } from './data/boardArt'
import { BASE_FONT, CAT_LABEL, CAT_ORDER, CH, GAP, PITCH, S, chipW, fitMode, pinCat, pinChips, type Cat } from './boardModel'

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

interface Props {
  board: BoardEntry
  layout: BoardLayout
  query: string
  selected: string | null
  onSelect: (label: string | null) => void
  /** Узкая панель: меньше подписей у выводов. */
  compact: boolean
  /** Подсвеченная категория из легенды: остальные выводы приглушены. */
  highlight?: Cat | null
  /** Масштаб относительно «вписать по ширине» (1 — без прокрутки) */
  zoom?: number
}

interface Hover { label: string; x: number; y: number }

/** Вид платы сверху: плата в натуральных пропорциях, гребёнки в реальном порядке, подписи и цвета по функциям. */
export default function Pinout({ board, layout, query, selected, onSelect, compact: forceCompact, highlight = null, zoom = 1 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const [P, setP] = useState(900)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    setP(el.clientWidth || 900)
    const ro = new ResizeObserver((es) => setP(Math.round(es[0].contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const view = useMemo(() => fitMode(board, layout, Math.max(240, P * zoom)), [board, layout, P, zoom])
  const { rows: items, m, k, compact } = view
  void forceCompact
  const { W, H } = view
  // если даже крупные подписи мельче 10 px, увеличиваем схему (прокрутка только внутри рамки схемы)
  const px = BASE_FONT * k * ((P * zoom) / W)
  const auto = px < 10 ? Math.min(3, 10.4 / px) : 1
  const total = zoom * auto
  const ox = m.l - view.x0 * S
  const oy = m.t - view.y0 * S

  const sel = (label: string): void => onSelect(selected === label ? null : label)

  const renderPin = ({ pp, pin, chips }: (typeof items)[number]): ReactElement => {
    const px = pp.x * S, py = pp.y * S
    const cat = pin ? pinCat(pin) : 'digital'
    const hl = !highlight || (pin ? pinCat(pin) === highlight || pinChips(pin, 'x', 9, false).some((c) => c.cat === highlight) : false)
    const match = (pin ? pinMatches(pin, query) : true) && hl
    const adc2 = pin ? hasAdc2(board, pin) : false
    const isSel = selected === pp.label
    const angle = pp.side === 't' ? -90 : pp.side === 'b' ? 90 : 0
    // позиции подписей вдоль наружного направления
    let cur = 12
    const rects: ReactElement[] = []
    chips.forEach((c, i) => {
      const w = chipW(c, k)
      const x = pp.side === 'l' ? -(cur + w) : cur
      rects.push(
        <g key={i} className={`chip cat-${c.cat} k-${c.kind}`}>
          <rect x={x} y={(-CH * k) / 2} width={w} height={CH * k} rx={3.5 * k} />
          <text x={x + w / 2} y={0.5} textAnchor="middle" dominantBaseline="central" style={{ fontSize: (c.kind === 'silk' ? 13 : BASE_FONT) * k }}>{c.text}</text>
        </g>
      )
      cur += w + GAP
    })
    const hitX = pp.side === 'l' ? -cur : -10
    const cls = ['pin', 'cat-' + cat, isSel ? 'sel' : '', match ? '' : 'dim'].join(' ')
    const onEnter = (e: React.MouseEvent<SVGGElement>): void => {
      const wrap = wrapRef.current
      if (!wrap) return
      const a = (e.currentTarget.querySelector('.pad') as SVGGraphicsElement).getBoundingClientRect()
      const b = wrap.getBoundingClientRect()
      setHover({ label: pp.label, x: a.left - b.left + a.width / 2 + wrap.scrollLeft, y: a.top - b.top + a.height / 2 + wrap.scrollTop })
    }
    return (
      <g key={pp.key} className={cls} transform={`translate(${px} ${py}) rotate(${angle})`} role="button" tabIndex={0} aria-label={pp.silk === pp.label ? pp.label : `${pp.silk} (${pp.label})`}
        onClick={() => sel(pp.label)} onMouseEnter={onEnter} onMouseLeave={() => setHover(null)} onFocus={(e) => { onEnter(e as unknown as React.MouseEvent<SVGGElement>) }} onBlur={() => setHover(null)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sel(pp.label) } }}>
        <rect className="pin-hit" x={hitX} y={(-CH * k) / 2 - 1} width={cur + 10} height={CH * k + 2} rx={4} />
        <g className="pad">
          {isSel && <circle className="pad-sel" r={14} />}
          <circle className="pad-ring" r={9} />
          <circle className="pad-hole" r={3.4} />
          {adc2 && <circle className="pad-adc2" r={12.5} />}
        </g>
        {rects}
      </g>
    )
  }

  const hoverPin = hover ? board.pins.find((p) => p.label === hover.label) : undefined

  return (
    <div className="board-wrap" ref={wrapRef}>
      <svg className="board-svg" viewBox={`0 0 ${W} ${H}`} style={{ width: total > 1 ? `${Math.round(total * 100)}%` : '100%', maxWidth: total > 1 ? undefined : Math.round(W * 1.25) }} role="group" aria-label={`Схема платы ${board.name}, вид сверху`}>
        <defs>
          <linearGradient id="bd-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e4e7ea" /><stop offset="1" stopColor="#a9aeb5" />
          </linearGradient>
          <linearGradient id="bd-metal-dk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c7ccd1" /><stop offset="1" stopColor="#8c929a" />
          </linearGradient>
        </defs>
        <g transform={`translate(${ox} ${oy})`}>
          <BoardBody layout={layout} />
          {items.map(renderPin)}
        </g>
      </svg>
      {auto > 1 && <div className="board-scroll-note">Плата крупная: схема увеличена до читаемого размера, прокрутите её по горизонтали.</div>}
      {hover && hoverPin && <PinTip board={board} pin={hoverPin} x={hover.x} y={hover.y} />}
    </div>
  )
}

/** Всплывающая подсказка: функции, ограничения, логический уровень. */
function PinTip({ board, pin, x, y }: { board: BoardEntry; pin: PinInfo; x: number; y: number }) {
  const cat = pinCat(pin)
  const note = pin.notes ? (pin.notes.length > 180 ? pin.notes.slice(0, 178) + '…' : pin.notes) : ''
  return (
    <div className="board-tip" style={{ left: x, top: y }} role="tooltip">
      <div className="board-tip-head"><b>{pin.label}</b>{pin.gpio !== null && <span> · GPIO{pin.gpio}</span>}<span className={'board-tip-cat cat-' + cat}>{CAT_LABEL[cat]}</span></div>
      {pin.functions.length > 0 && <div className="board-tip-fn">{pin.functions.join(', ')}</div>}
      {hasAdc2(board, pin) && <div className="board-tip-warn">ADC2: недоступен при работающем WiFi</div>}
      {note && <div className="board-tip-note">{note}</div>}
      {pin.gpio !== null && board.electrical && <div className="board-tip-el">{board.electrical.logic.split(';')[0]}</div>}
    </div>
  )
}

// ---------- рисование платы ----------

function BoardBody({ layout }: { layout: BoardLayout }) {
  const art = layout.art ? boardArt[layout.art] : null
  const href = useMemo(() => (art ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(art.svg) : ''), [art])
  if (art) return <image className="board-art" href={href} x={art.x * S} y={art.y * S} width={art.w * S} height={art.h * S} />
  const { w, h } = layout
  const r = (layout.corner ?? 1.2) * S
  const dark = isDark(layout.pcb)
  return (
    <g className="board-body">
      <rect x={1.2} y={2.4} width={w * S} height={h * S} rx={r} className="board-shadow" />
      <rect x={0} y={0} width={w * S} height={h * S} rx={r} fill={layout.pcb} className="board-pcb" stroke={dark ? '#ffffff' : '#000000'} strokeOpacity={0.25} strokeWidth={1.5} />
      <rect x={4} y={4} width={w * S - 8} height={h * S - 8} rx={Math.max(2, r - 3)} fill="none" stroke={dark ? '#ffffff' : '#000000'} strokeOpacity={0.12} strokeWidth={1} />
      {(layout.holes ?? []).map((hp, i) => <g key={i}><circle cx={hp[0] * S} cy={hp[1] * S} r={17} fill="#d8c27a" /><circle cx={hp[0] * S} cy={hp[1] * S} r={11} fill="#0b0c0e" /></g>)}
      {layout.comps.map((c, i) => <Comp key={i} c={c} />)}
    </g>
  )
}

function isDark(hex: string): boolean {
  const v = parseInt(hex.slice(1), 16)
  return ((v >> 16) & 255) * 0.3 + ((v >> 8) & 255) * 0.59 + (v & 255) * 0.11 < 90
}

const SILK = '#f4f1e6'

function Comp({ c }: { c: BoardComp }): ReactElement | null {
  switch (c.t) {
    case 'rect':
      return <rect x={c.x * S} y={c.y * S} width={c.w * S} height={c.h * S} rx={(c.r ?? 0.3) * S} fill={c.fill ?? '#222'} stroke="#000" strokeOpacity={0.4} />
    case 'usb': {
      const x = c.x * S, y = c.y * S, w = c.w * S, h = c.h * S
      const horiz = c.side === 'l' || c.side === 'r'
      const slotLong = (horiz ? h : w) * (c.kind === 'b' ? 0.7 : 0.6)
      const slotShort = (horiz ? w : h) * 0.42
      const cx = x + w / 2, cy = y + h / 2
      return (
        <g className="usb">
          <rect x={x} y={y} width={w} height={h} rx={c.kind === 'micro' || c.kind === 'c' ? 6 : 3} fill="url(#bd-metal)" stroke="#6b7078" strokeWidth={1.2} />
          <rect x={cx - (horiz ? slotShort : slotLong) / 2} y={cy - (horiz ? slotLong : slotShort) / 2} width={horiz ? slotShort : slotLong} height={horiz ? slotLong : slotShort} rx={c.kind === 'c' ? 5 : 2} fill="#14161a" />
          <rect x={cx - (horiz ? slotShort * 0.35 : slotLong * 0.8) / 2} y={cy - (horiz ? slotLong * 0.8 : slotShort * 0.35) / 2} width={horiz ? slotShort * 0.35 : slotLong * 0.8} height={horiz ? slotLong * 0.8 : slotShort * 0.35} fill="#3b3f46" />
        </g>
      )
    }
    case 'jack': {
      const x = c.x * S, y = c.y * S, w = c.w * S, h = c.h * S
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={3} fill="#17181a" stroke="#000" />
          <rect x={x + 4} y={y + 4} width={w - 8} height={h - 8} rx={3} fill="#25272b" />
          <circle cx={x + w * 0.5} cy={y + h / 2} r={h * 0.3} fill="#0b0c0d" stroke="#3a3d42" strokeWidth={2} />
          <circle cx={x + w * 0.5} cy={y + h / 2} r={h * 0.09} fill="#8a8e95" />
        </g>
      )
    }
    case 'xtal':
      return <g><rect x={c.x * S} y={c.y * S} width={c.w * S} height={c.h * S} rx={c.h * S * 0.45} fill="url(#bd-metal-dk)" stroke="#5b6068" strokeWidth={1} /></g>
    case 'btn': {
      const x = c.x * S, y = c.y * S, s = 3.8 * S
      const lp = c.lp ?? 'r'
      const lx = lp === 'l' ? x - s / 2 - 5 : lp === 'r' ? x + s / 2 + 5 : x
      const ly = lp === 't' ? y - s / 2 - 5 : lp === 'b' ? y + s / 2 + 9 : y
      return (
        <g>
          <rect x={x - s / 2} y={y - s / 2} width={s} height={s} rx={5} fill="url(#bd-metal)" stroke="#5b6068" strokeWidth={1.2} />
          <circle cx={x} cy={y} r={s * 0.32} fill="#2d3036" stroke="#000" strokeOpacity={0.5} />
          {c.label && <text x={lx} y={ly} textAnchor={lp === 'l' ? 'end' : lp === 'r' ? 'start' : 'middle'} dominantBaseline="central" className="silk" fill={SILK}>{c.label}</text>}
        </g>
      )
    }
    case 'led': {
      const x = c.x * S, y = c.y * S
      return (
        <g>
          <circle cx={x} cy={y} r={11} fill={c.color} opacity={0.22} />
          <rect x={x - 8} y={y - 4.5} width={16} height={9} rx={1.5} fill={c.color} stroke="#000" strokeOpacity={0.45} />
          {c.label && <text x={x} y={y + 17} textAnchor="middle" className="silk small" fill={SILK}>{c.label}</text>}
        </g>
      )
    }
    case 'chip': {
      const x = c.x * S, y = c.y * S, w = c.w * S, h = c.h * S
      const leads = c.leads ?? 'none'
      const fs = c.text ? Math.min(1.7 * S, ((w - 6) / (c.text.length * 0.62))) : 0
      return (
        <g>
          {leads === 'qfp' && <rect x={x - 6} y={y - 6} width={w + 12} height={h + 12} fill="none" stroke="#b9bec5" strokeWidth={7} strokeDasharray="3 3.2" />}
          {leads === 'dip' && <>
            <line x1={x + 3} y1={y - 4} x2={x + w - 3} y2={y - 4} stroke="#aeb3ba" strokeWidth={8} strokeDasharray="9 16.4" />
            <line x1={x + 3} y1={y + h + 4} x2={x + w - 3} y2={y + h + 4} stroke="#aeb3ba" strokeWidth={8} strokeDasharray="9 16.4" />
          </>}
          {leads === 'sop' && <>
            <line x1={x - 4} y1={y + 3} x2={x - 4} y2={y + h - 3} stroke="#aeb3ba" strokeWidth={7} strokeDasharray="4 4.5" />
            <line x1={x + w + 4} y1={y + 3} x2={x + w + 4} y2={y + h - 3} stroke="#aeb3ba" strokeWidth={7} strokeDasharray="4 4.5" />
          </>}
          <rect x={x} y={y} width={w} height={h} rx={3} fill="#181a1d" stroke="#000" />
          <circle cx={x + 7} cy={y + 7} r={2.6} fill="#555a62" />
          {c.text && w >= 45 && <text x={x + w / 2} y={y + h / 2 + 1} textAnchor="middle" dominantBaseline="central" fill="#8b9199" fontSize={fs} fontWeight={600}>{c.text}</text>}
        </g>
      )
    }
    case 'module': {
      const x = c.x * S, y = c.y * S, w = c.w * S, h = c.h * S, a = c.ant * S
      const top = c.antSide === 't'
      const shY = top ? y + a : y, shH = h - a
      const antY = top ? y : y + shH
      // меандр антенны
      const steps = 6
      let d = ''
      for (let i = 0; i <= steps; i++) {
        const yy = antY + 6 + (i * (a - 12)) / steps
        d += `${i === 0 ? 'M' : 'L'}${x + 8} ${yy} L${x + w - 8} ${yy} `
        if (i < steps) d += `L${x + w - 8} ${yy + (a - 12) / steps / 2} L${x + 8} ${yy + (a - 12) / steps / 2} `
      }
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={3} fill="#20242b" stroke="#000" strokeOpacity={0.6} />
          <rect x={x + 3} y={antY + 3} width={w - 6} height={a - 6} fill="#0e1013" />
          <path d={d} fill="none" stroke="#c9a43a" strokeWidth={2.4} strokeLinejoin="round" opacity={0.9} />
          <rect x={x + 4} y={shY + 2} width={w - 8} height={shH - 6} rx={3} fill="url(#bd-metal)" stroke="#6b7078" strokeWidth={1.2} />
          <rect x={x + 10} y={shY + 8} width={w - 20} height={shH - 18} rx={2} fill="none" stroke="#7b8088" strokeWidth={0.8} strokeOpacity={0.6} />
          <text x={x + w / 2} y={shY + shH / 2 - 2} textAnchor="middle" dominantBaseline="central" fill="#2b2f36" fontSize={Math.min(1.9 * S, (w - 20) / (c.text.length * 0.62))} fontWeight={700}>{c.text}</text>
        </g>
      )
    }
    case 'icsp': {
      const x = c.x * S, y = c.y * S
      const cols = c.vertical ? 2 : 3, rows = c.vertical ? 3 : 2
      const pads: ReactElement[] = []
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) pads.push(<circle key={`${i}${j}`} cx={x + 12.7 + i * PITCH * S} cy={y + 12.7 + j * PITCH * S} r={5.5} fill="#d8c27a" stroke="#000" strokeOpacity={0.4} />)
      return (
        <g>
          <rect x={x} y={y} width={cols * PITCH * S} height={rows * PITCH * S} rx={2} fill="#17181a" stroke="#000" />
          {pads}
        </g>
      )
    }
    case 'text':
      return <text x={c.x * S} y={c.y * S} textAnchor="middle" dominantBaseline="central" className="silk" fill={SILK} fontSize={(c.size ?? 2) * S} fontWeight={c.bold ? 700 : 500} transform={c.rot ? `rotate(${c.rot} ${c.x * S} ${c.y * S})` : undefined} letterSpacing={0.5}>{c.text}</text>
    default:
      return null
  }
}

export function Legend({ board, active, onToggle }: { board: BoardEntry; active?: Cat | null; onToggle?: (c: Cat | null) => void }) {
  const used = new Set<Cat>(board.pins.map((p) => pinCat(p)))
  // функции, которые есть в тегах, но не основная категория, тоже показываем
  for (const p of board.pins) for (const c of ['pwm', 'analog', 'i2c', 'spi', 'uart', 'touch', 'dac'] as Cat[]) {
    if (pinChips(p, 'x', 9, false).some((ch) => ch.cat === c)) used.add(c)
  }
  const adc2 = board.platform.startsWith('esp32') && board.pins.some((p) => hasAdc2(board, p))
  return (
    <ul className="ref-legend" aria-label="Легенда: нажмите, чтобы подсветить категорию">
      {CAT_ORDER.filter((c) => used.has(c)).map((c) => (
        <li key={c}>
          <button type="button" className={'lg-btn' + (active === c ? ' on' : '')} aria-pressed={active === c} onClick={() => onToggle?.(active === c ? null : c)}>
            <span className={'lg-chip cat-' + c} />{CAT_LABEL[c]}
          </button>
        </li>
      ))}
      {adc2 && <li><span className="lg-dot adc2" />ADC2 — конфликт с WiFi</li>}
    </ul>
  )
}

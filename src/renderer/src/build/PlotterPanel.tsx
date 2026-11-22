// Серийный плоттер: график значений из порта в реальном времени (canvas, без зависимостей).
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../shell/icons'
import { useUi } from '../shell/ui'
import { PortControls } from './MonitorPanel'
import { WINDOWS, plot, useMonitor } from './monitorStore'
import { computeRange, formatTick, niceTicks } from './plotter'
import { Select } from '../shell/kit'

const COLORS = 8
const M = { l: 46, r: 12, t: 10, b: 20 }

const lastFinite = (rows: number[][], k: number): number => {
  for (let i = rows.length - 1; i >= 0; i--) if (Number.isFinite(rows[i][k])) return rows[i][k]
  return NaN
}

export default function PlotterPanel(): ReactNode {
  const version = useMonitor((s) => s.plotVersion)
  const pausedAt = useMonitor((s) => s.pausedAt)
  const windowN = useMonitor((s) => s.windowN)
  const auto = useMonitor((s) => s.auto)
  const running = useMonitor((s) => s.running)
  const togglePause = useMonitor((s) => s.togglePause)
  const clearPlot = useMonitor((s) => s.clearPlot)
  const setWindowN = useMonitor((s) => s.setWindowN)
  const setAuto = useMonitor((s) => s.setAuto)
  const theme = useUi((s) => s.settings.theme)
  const [hidden, setHidden] = useState<Set<number>>(new Set())
  const [hover, setHover] = useState<number | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const locked = useRef<{ min: number; max: number } | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // plot — изменяемый буфер вне React: пересчёт по plotVersion
  /* eslint-disable react-hooks/exhaustive-deps */
  const view = useMemo(() => plot.window(windowN, pausedAt ?? undefined), [version, windowN, pausedAt])
  const names = plot.names
  const visible = useMemo(() => plot.names.map((_, k) => !hidden.has(k)), [version, hidden])
  /* eslint-enable react-hooks/exhaustive-deps */

  const range = useMemo(() => {
    if (auto) { const r = computeRange(view.rows, visible); locked.current = r; return r }
    return locked.current ?? computeRange(view.rows, visible)
  }, [view, visible, auto])

  useEffect(() => {
    const c = canvas.current
    if (!c || size.w < 40 || size.h < 40) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(size.w * dpr)
    c.height = Math.round(size.h * dpr)
    const g = c.getContext('2d')
    if (!g) return
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const cs = getComputedStyle(document.documentElement)
    const tok = (n: string): string => cs.getPropertyValue(n).trim()
    const W = size.w - M.l - M.r
    const H = size.h - M.t - M.b
    g.clearRect(0, 0, size.w, size.h)
    g.font = '11px ' + (tok('--mono') || 'monospace')
    g.textBaseline = 'middle'
    const y = (v: number): number => M.t + H - ((v - range.min) / (range.max - range.min)) * H
    const n = view.rows.length
    const x = (i: number): number => M.l + ((n >= windowN ? i : i + (windowN - n)) / Math.max(1, windowN - 1)) * W
    // сетка и подписи оси Y
    g.lineWidth = 1
    g.textAlign = 'right'
    for (const t of niceTicks(range.min, range.max, Math.max(2, Math.floor(H / 40)))) {
      const yy = Math.round(y(t)) + 0.5
      g.strokeStyle = tok('--border')
      g.beginPath(); g.moveTo(M.l, yy); g.lineTo(M.l + W, yy); g.stroke()
      g.fillStyle = tok('--fg-dim')
      g.fillText(formatTick(t), M.l - 6, yy)
    }
    g.strokeStyle = tok('--border-strong')
    g.strokeRect(M.l + 0.5, M.t + 0.5, W, H)
    // подписи оси X — номера точек
    g.fillStyle = tok('--fg-faint'); g.textBaseline = 'alphabetic'
    if (n) {
      g.textAlign = 'left'
      g.fillText(String(view.start), M.l, size.h - 5)
      g.textAlign = 'right'
      g.fillText(String(view.start + n - 1), M.l + W, size.h - 5)
    }
    // линии
    g.lineJoin = 'round'
    names.forEach((_, k) => {
      if (!visible[k]) return
      g.strokeStyle = tok(`--plot-${(k % COLORS) + 1}`)
      g.lineWidth = 1.6
      g.beginPath()
      let pen = false
      view.rows.forEach((r, i) => {
        const v = r[k]
        if (!Number.isFinite(v)) { pen = false; return }
        if (!pen) { g.moveTo(x(i), y(v)); pen = true } else g.lineTo(x(i), y(v))
      })
      g.stroke()
    })
    // перекрестие под курсором
    if (hover !== null && hover < n) {
      const xx = Math.round(x(hover)) + 0.5
      g.strokeStyle = tok('--fg-faint'); g.lineWidth = 1
      g.beginPath(); g.moveTo(xx, M.t); g.lineTo(xx, M.t + H); g.stroke()
      names.forEach((_, k) => {
        const v = view.rows[hover][k]
        if (!visible[k] || !Number.isFinite(v)) return
        g.fillStyle = tok(`--plot-${(k % COLORS) + 1}`)
        g.beginPath(); g.arc(x(hover), y(v), 3.2, 0, Math.PI * 2); g.fill()
      })
    }
  }, [view, visible, range, size, theme, hover, windowN, names])

  const onMove = (e: React.MouseEvent): void => {
    const c = canvas.current
    if (!c) return
    const n = view.rows.length
    if (!n) { setHover(null); return }
    const px = e.clientX - c.getBoundingClientRect().left - M.l
    const W = size.w - M.l - M.r
    const slot = Math.round((px / W) * (windowN - 1)) - (n >= windowN ? 0 : windowN - n)
    setHover(slot >= 0 && slot < n ? slot : null)
  }

  const row = hover !== null ? view.rows[hover] : null
  const hasData = names.length > 0
  return (
    <div className="panel-body plotter">
      <div className="panel-actions plot-actions">
        <div className="plot-action-group" role="group" aria-label="Подключение к порту">
          <PortControls />
        </div>
        <div className="plot-action-group plot-chart-actions" role="group" aria-label="Управление графиком">
          <button className={'btn small' + (pausedAt !== null ? ' primary' : '')} onClick={togglePause} disabled={!running && pausedAt === null}
            title={pausedAt !== null ? 'Продолжить обновление графика' : 'Остановить график на месте (данные продолжают приходить)'}>
            <Icon name={pausedAt !== null ? 'arrow' : 'stop'} size={12} fill={pausedAt === null} /> {pausedAt !== null ? 'Продолжить' : 'Пауза'}
          </button>
          <label className="inline-field" title="Сколько последних точек показывать на графике">Точек
            <Select className="small" value={windowN} onChange={(e) => setWindowN(Number(e.target.value))}>
              {WINDOWS.map((w) => <option key={w} value={w}>{w}</option>)}
            </Select>
          </label>
          <label className="inline-field check" title="Шкала по вертикали подстраивается под значения; выключите, чтобы зафиксировать её">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Автошкала
          </label>
          <button className="icon-btn" title="Очистить график" aria-label="Очистить график" disabled={plot.total === 0} onClick={() => { clearPlot(); setHidden(new Set()); locked.current = null }}><Icon name="trash" size={14} /></button>
        </div>
      </div>
      {hasData && (
        <div className="plot-legend" role="group" aria-label="Линии графика">
          {names.map((nm, k) => (
            <button key={nm} aria-label={nm} aria-pressed={!hidden.has(k)} className={'plot-key' + (hidden.has(k) ? ' off' : '')} title={hidden.has(k) ? 'Показать линию' : 'Скрыть линию'}
              onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n })}>
              <span className="plot-dot" style={{ background: `var(--plot-${(k % COLORS) + 1})` }} />
              <span className="plot-name">{nm}</span>
              <span className="plot-val">{formatTick(row ? row[k] : lastFinite(view.rows, k))}</span>
            </button>
          ))}
        </div>
      )}
      <div className="plot-wrap" ref={wrap} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <canvas ref={canvas} style={{ width: size.w, height: size.h }} aria-label="График значений из порта" />
        {!hasData && (
          <div className="plot-empty">
            <b>{running ? 'Жду числа от платы…' : 'График появится, когда плата начнёт присылать числа'}</b>
            <span>График рисует числа, которые плата печатает через Serial.println(). Нажмите «Запустить» в строке выше.</span>
            <span>Одна линия: <code>Serial.println(x);</code></span>
            <span>Несколько линий с названиями в легенде: <code>t:23.5,h:40</code></span>
          </div>
        )}
      </div>
    </div>
  )
}

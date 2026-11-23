import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as RMouseEvent, ReactNode } from 'react'
import { PAGE_TEMPLATES, WIDGETS, findPageTemplate } from '../core/index'
import type { UiElement, WidgetType } from '../core/index'
import { buildPreviewSrcdoc } from '../preview/srcdoc'
import frameUrl from '../preview/frame.html?url'
import { useUiBuilder } from '../store'
import { Icon, WidgetIcon } from './icons'
import { BINDING_ISSUE, bindInfo, canBind } from './bindinfo'
import { findElement, useBuilder } from './ctx'
import { DND_WIDGET } from './Palette'
import { widgetTitle } from './paletteData'
import { Select } from '../../shell/kit'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}
interface CardRect extends Rect {
  label?: Rect
}
interface Layout {
  cards: Record<string, CardRect>
  tabs: Record<string, Rect>
  nav: Rect | null
  height: number
  activeTab: string | null
}
interface Frame {
  key: string
  html: string
  ready: boolean
}
interface SimMsg {
  vars: Record<string, string>
  events: string[]
}

const DEVICES: Array<{ id: string; title: string; px: number | null }> = [
  { id: 'full', title: 'Во всю ширину', px: null },
  { id: 'phone', title: 'Телефон · 390', px: 390 },
  { id: 'tablet', title: 'Планшет · 768', px: 768 }
]
const ZOOMS = [0.75, 1, 1.25]

function hashKey(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return `${s.length}:${h}`
}

function rectDist(r: Rect, x: number, y: number): number {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w))
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h))
  return Math.hypot(dx, dy)
}

interface DropTarget {
  kind: 'index' | 'tab'
  index: number
  tabId: string
  /** Линия-вставка в координатах холста. */
  line: Rect | null
}

/** Куда попадёт элемент, если отпустить в точке (x, y) холста. */
function dropTargetAt(x: number, y: number, ids: string[], layout: Layout | null, activeTab: string, tabIdsHit: string | null): DropTarget {
  if (tabIdsHit) return { kind: 'tab', index: -1, tabId: tabIdsHit, line: null }
  const rects = ids.map((id) => ({ id, r: layout?.cards[id] })).filter((c): c is { id: string; r: CardRect } => !!c.r)
  if (!rects.length) return { kind: 'index', index: ids.length, tabId: activeTab, line: null }
  let best = rects[0]
  let bd = Infinity
  for (const c of rects) {
    const d = rectDist(c.r, x, y)
    if (d < bd) {
      bd = d
      best = c
    }
  }
  const r = best.r
  const idx = ids.indexOf(best.id)
  const rowWide = r.w > 420 || r.w > (layout?.cards ? Math.max(...rects.map((c) => c.r.x + c.r.w)) : 0) * 0.7
  const after = rowWide ? y > r.y + r.h / 2 : x > r.x + r.w / 2
  const line: Rect = rowWide ? { x: r.x, y: after ? r.y + r.h + 3 : r.y - 6, w: r.w, h: 3 } : { x: after ? r.x + r.w + 3 : r.x - 6, y: r.y, w: 3, h: r.h }
  return { kind: 'index', index: idx + (after ? 1 : 0), tabId: activeTab, line }
}

export function CanvasView(): ReactNode {
  const ctx = useBuilder()
  const { effective, issues } = ctx
  const project = useUiBuilder((s) => s.project)
  const mode = useUiBuilder((s) => s.mode)
  const activeTab = useUiBuilder((s) => s.activeTab)
  const selected = useUiBuilder((s) => s.selected)
  const flash = useUiBuilder((s) => s.flash)
  const toast = useUiBuilder((s) => s.toast)
  const st = useUiBuilder.getState

  const [frames, setFrames] = useState<Frame[]>([])
  const [layouts, setLayouts] = useState<Record<string, Layout>>({})
  const [device, setDevice] = useState('full')
  const zoomPref = useUiBuilder((s) => s.zoom)
  const [sim, setSim] = useState<SimMsg>({ vars: {}, events: [] })
  const [drop, setDrop] = useState<DropTarget | null>(null)
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null)
  const [editing, setEditing] = useState<{ kind: 'label'; id: string } | { kind: 'tab'; id: string } | null>(null)
  const [flashing, setFlashing] = useState<string | null>(null)
  const [buildError, setBuildError] = useState<string | null>(null)
  const [width, setWidth] = useState(800)
  const [height, setHeight] = useState(400)
  const [resetNonce, setResetNonce] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const frameEls = useRef<Map<string, HTMLIFrameElement>>(new Map())
  const projectRef = useRef(effective)
  projectRef.current = effective
  const activeRef = useRef(activeTab)
  activeRef.current = activeTab
  const pendingScroll = useRef<string | null>(null)

  const tab = effective.tabs.find((t) => t.id === activeTab) ?? effective.tabs[0]
  const rawTab = project.tabs.find((t) => t.id === tab.id)
  const ids = tab.elements.map((e) => e.id)
  const multi = effective.tabs.length > 1
  const total = effective.tabs.reduce((n, t) => n + t.elements.length, 0)

  // ---- ширина области ----
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setWidth(el.clientWidth)
      setHeight(el.clientHeight)
    })
    ro.observe(el)
    setWidth(el.clientWidth)
    setHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  // ---- сборка документа (с «дребезгом», только при реальном изменении содержимого) ----
  const sig = useMemo(() => JSON.stringify(effective) + '|' + mode + '|' + resetNonce, [effective, mode, resetNonce])
  const firstBuild = useRef(true)
  useEffect(() => {
    const t = setTimeout(
      () => {
        try {
          const html = buildPreviewSrcdoc(projectRef.current, { mode, activeTab: activeRef.current })
          setBuildError(null)
          const key = hashKey(html) + ':' + resetNonce
          setFrames((fs) => {
            if (fs.length && fs[fs.length - 1].key === key) return fs
            return [...fs.filter((f) => f.ready).slice(-1), { key, html, ready: false }]
          })
        } catch (e) {
          setBuildError(e instanceof Error ? e.message : String(e))
        }
      },
      firstBuild.current ? 0 : 140
    )
    firstBuild.current = false
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  // ---- сообщения от iframe ----
  const frameOf = (src: MessageEventSource | null): string | null => {
    for (const [k, el] of frameEls.current) if (el.contentWindow === src) return k
    return null
  }
  useEffect(() => {
    const onMsg = (e: MessageEvent): void => {
      const d = e.data as { espuiPreview?: boolean; kind?: string; text?: string } & Partial<Layout> & { tab?: string | null }
      if (!d || d.espuiPreview !== true) return
      const key = frameOf(e.source)
      if (!key) return
      if (d.kind === 'ready') {
        const f = framesRef.current.find((x) => x.key === key)
        if (f) (e.source as Window).postMessage({ espuiDoc: f.html }, '*')
        return
      }
      if (d.kind === 'layout') {
        setLayouts((l) => ({ ...l, [key]: { cards: d.cards ?? {}, tabs: d.tabs ?? {}, nav: d.nav ?? null, height: d.height ?? 0, activeTab: d.activeTab ?? null } }))
        return
      }
      if (d.kind === 'rendered') {
        setFrames((fs) => {
          const i = fs.findIndex((f) => f.key === key)
          if (i < 0) return fs
          return fs.slice(i).map((f) => (f.key === key ? { ...f, ready: true } : f))
        })
        return
      }
      if (d.kind === 'tab' && d.tab) {
        if (d.tab !== activeRef.current && modeRef.current === 'test') useUiBuilder.setState({ activeTab: d.tab })
        return
      }
      if (d.kind === 'vars') {
        try {
          setSim((s) => ({ ...s, vars: JSON.parse(String(d.text)) as Record<string, string> }))
        } catch {
          /* ignore */
        }
        return
      }
      if (d.kind === 'event' && modeRef.current === 'test')
        setSim((s) => ({ ...s, events: [...s.events.slice(-4), String(d.text ?? '').slice(0, 200)] }))
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])
  const framesRef = useRef(frames)
  framesRef.current = frames
  const modeRef = useRef(mode)
  modeRef.current = mode

  // чистка раскладок отброшенных кадров
  useEffect(() => {
    const keys = new Set(frames.map((f) => f.key))
    setLayouts((l) => {
      const n: Record<string, Layout> = {}
      for (const k of Object.keys(l)) if (keys.has(k)) n[k] = l[k]
      return Object.keys(n).length === Object.keys(l).length ? l : n
    })
    for (const k of [...frameEls.current.keys()]) if (!keys.has(k)) frameEls.current.delete(k)
  }, [frames])
  useEffect(() => {
    if (mode === 'test') setSim({ vars: {}, events: [] })
  }, [mode, frames.length])

  // видимый кадр — последний готовый (или единственный)
  const visible = [...frames].reverse().find((f) => f.ready) ?? frames[0] ?? null
  const layout = visible ? (layouts[visible.key] ?? null) : null
  const devPx = DEVICES.find((d) => d.id === device)?.px ?? null
  // «Вписать»: для телефона/планшета масштаб подбирается по ширине и высоте области (не мельче 50%); во всю ширину — 100%.
  const zoom =
    zoomPref === 'fit'
      ? devPx
        ? Math.max(0.5, Math.min(1, (width - 32) / devPx, (height - 32) / Math.max(240, layout?.height ?? 600)))
        : 1
      : zoomPref

  // переключение вкладки в iframe при смене активной вкладки
  useEffect(() => {
    if (!visible || !multi) return
    const el = frameEls.current.get(visible.key)
    el?.contentWindow?.postMessage({ espuiCmd: 'tab', tab: activeTab }, '*')
  }, [activeTab, visible?.key, multi, visible?.ready])

  // подсветка и прокрутка к новому элементу
  useEffect(() => {
    if (!flash) return
    setFlashing(flash.id)
    pendingScroll.current = flash.id
    const t = setTimeout(() => setFlashing(null), 1400)
    return () => clearTimeout(t)
  }, [flash])
  useEffect(() => {
    const id = pendingScroll.current
    if (!id || !layout || !scrollRef.current) return
    const r = layout.cards[id]
    if (!r) return
    pendingScroll.current = null
    const sc = scrollRef.current
    const top = r.y * zoom
    const bottom = (r.y + r.h) * zoom
    if (top < sc.scrollTop + 8 || bottom > sc.scrollTop + sc.clientHeight - 40) sc.scrollTo({ top: Math.max(0, top - 80), behavior: 'smooth' })
  }, [layout, zoom])

  // ---- геометрия ----
  const stageW = Math.max(280, devPx ?? Math.floor((width - 18) / zoom))
  const contentH = Math.max(layout?.height ?? 200, 240, Math.floor((height - 18) / zoom))
  const toLocal = useCallback(
    (cx: number, cy: number) => {
      const r = stageRef.current?.getBoundingClientRect()
      if (!r) return { x: 0, y: 0 }
      return { x: (cx - r.left) / zoom, y: (cy - r.top) / zoom }
    },
    [zoom]
  )

  // ---- перетаскивание элементов (указателем) ----
  const dragRef = useRef<{ id: string; sx: number; sy: number; active: boolean } | null>(null)
  const startDrag = (e: React.PointerEvent, id: string): void => {
    if (e.button !== 0 || mode !== 'edit') return
    dragRef.current = { id, sx: e.clientX, sy: e.clientY, active: false }
  }
  useEffect(() => {
    const move = (e: PointerEvent): void => {
      const d = dragRef.current
      if (!d) return
      if (!d.active && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return
      d.active = true
      const p = toLocal(e.clientX, e.clientY)
      setDrag({ id: d.id, x: e.clientX, y: e.clientY })
      setDrop(dropTargetAt(p.x, p.y, ids.filter((i) => i !== d.id), layout, tab.id, tabHit(e.clientX, e.clientY)))
    }
    const up = (e: PointerEvent): void => {
      const d = dragRef.current
      dragRef.current = null
      if (!d || !d.active) {
        setDrag(null)
        setDrop(null)
        return
      }
      const p = toLocal(e.clientX, e.clientY)
      const others = ids.filter((i) => i !== d.id)
      const t = dropTargetAt(p.x, p.y, others, layout, tab.id, tabHit(e.clientX, e.clientY))
      setDrag(null)
      setDrop(null)
      if (t.kind === 'tab') {
        if (t.tabId !== tab.id) {
          st().moveElementToTab(d.id, t.tabId)
          st().showToast(`Элемент перенесён во вкладку «${effective.tabs.find((x) => x.id === t.tabId)?.title ?? t.tabId}»`)
        }
      } else st().moveElement(d.id, tab.id, t.index)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, tab.id, ids.join('|'), toLocal])

  /** Вкладка под курсором: чипы над холстом или вкладки самого ESPUI. */
  function tabHit(cx: number, cy: number): string | null {
    const els = document.elementsFromPoint(cx, cy)
    for (const el of els) {
      const t = (el as HTMLElement).dataset?.tabChip
      if (t) return t
    }
    return null
  }

  // ---- перетаскивание из палитры ----
  const onDragOver = (e: React.DragEvent): void => {
    if (!e.dataTransfer.types.includes(DND_WIDGET)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const p = toLocal(e.clientX, e.clientY)
    setDrop(dropTargetAt(p.x, p.y, ids, layout, tab.id, null))
  }
  const onDropWidget = (e: React.DragEvent): void => {
    const type = e.dataTransfer.getData(DND_WIDGET)
    if (!type || !(type in WIDGETS)) return
    e.preventDefault()
    const p = toLocal(e.clientX, e.clientY)
    const t = dropTargetAt(p.x, p.y, ids, layout, tab.id, null)
    setDrop(null)
    st().addElement(type as WidgetType, tab.id, t.index)
  }

  // ---- вспомогательное ----
  const elIssues = (id: string): typeof issues => issues.filter((i) => i.elementId === id)
  const openMenu = (e: RMouseEvent, id: string): void => {
    e.preventDefault()
    e.stopPropagation()
    st().select(id)
    setMenu({ x: e.clientX, y: e.clientY, id })
  }
  useEffect(() => {
    if (!menu) return
    const close = (): void => setMenu(null)
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('blur', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('keydown', esc)
    }
  }, [menu])

  const invisibleEls = tab.elements.filter((e) => !layout?.cards[e.id] && layout !== null)

  return (
    <section className="uib-canvas-wrap" aria-label="Холст страницы">
      <div className="uib-canvas-bar">
        <div className="uib-tabstrip" role="tablist" aria-label="Вкладки страницы">
          {project.tabs.map((t, i) => {
            const isActive = t.id === tab.id
            return (
              <div
                key={t.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                data-tab-chip={t.id}
                className={`uib-tabchip${isActive ? ' active' : ''}${drop?.kind === 'tab' && drop.tabId === t.id ? ' drop' : ''}`}
                onClick={() => st().setActiveTab(t.id)}
                onDoubleClick={() => mode === 'edit' && setEditing({ kind: 'tab', id: t.id })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') st().setActiveTab(t.id)
                  if (e.key === 'F2') setEditing({ kind: 'tab', id: t.id })
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes(DND_WIDGET)) {
                    e.preventDefault()
                    setDrop({ kind: 'tab', index: -1, tabId: t.id, line: null })
                  }
                }}
                onDragLeave={() => setDrop((d) => (d?.kind === 'tab' ? null : d))}
                onDrop={(e) => {
                  const type = e.dataTransfer.getData(DND_WIDGET)
                  if (type && type in WIDGETS) {
                    e.preventDefault()
                    setDrop(null)
                    st().addElement(type as WidgetType, t.id)
                  }
                }}
                title={`Вкладка «${t.title || t.id}». Двойной щелчок — переименовать. Перетащите сюда элемент, чтобы перенести его в эту вкладку.`}
              >
                {editing?.kind === 'tab' && editing.id === t.id ? (
                  <InlineInput
                    value={t.title}
                    onDone={(v) => {
                      setEditing(null)
                      if (v !== null && v !== t.title) st().patchTab(t.id, { title: v })
                    }}
                  />
                ) : (
                  <span>{t.title || t.id}</span>
                )}
                {isActive && project.tabs.length > 1 && i >= 0 && (
                  <span className="uib-tabchip-tools">
                    <button className="uib-icon-btn" title="Сдвинуть вкладку влево" disabled={i === 0} onClick={(e) => { e.stopPropagation(); st().moveTab(t.id, -1) }}>
                      <Icon name="left" size={12} />
                    </button>
                    <button className="uib-icon-btn" title="Сдвинуть вкладку вправо" disabled={i === project.tabs.length - 1} onClick={(e) => { e.stopPropagation(); st().moveTab(t.id, 1) }}>
                      <Icon name="right" size={12} />
                    </button>
                    <button
                      className="uib-icon-btn"
                      title="Удалить вкладку"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (t.elements.length === 0 || window.confirm(`Удалить вкладку «${t.title}» вместе с ${t.elements.length} элементами?`)) st().removeTab(t.id)
                      }}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </span>
                )}
              </div>
            )
          })}
          <button className="uib-tabchip add" onClick={() => st().addTab()} title="Добавить вкладку (в ESPUI это отдельная страница с переключателем вверху)">
            <Icon name="plus" size={13} /> Вкладка
          </button>
        </div>
        <div className="uib-spacer" />
        <Select className="uib-select compact" value={device} onChange={(e) => setDevice(e.target.value)} aria-label="Ширина страницы" title="Ширина страницы: как она выглядит на телефоне и планшете">
          {DEVICES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </Select>
        <div className="uib-zoom" role="group" aria-label="Масштаб">
          <button className={`uib-zoom-btn${zoomPref === 'fit' ? ' active' : ''}`} onClick={() => st().setZoom('fit')} title="Вписать страницу в доступное место">
            Вписать
          </button>
          {ZOOMS.map((z) => (
            <button key={z} className={`uib-zoom-btn${zoomPref === z ? ' active' : ''}`} onClick={() => st().setZoom(z)} title={`Масштаб ${Math.round(z * 100)}%`}>
              {Math.round(z * 100)}%
            </button>
          ))}
        </div>
      </div>

      <div
        className={`uib-scroll mode-${mode}`}
        ref={scrollRef}
        onPointerDown={(e) => {
          if (mode === 'edit' && e.target === e.currentTarget) st().select(null)
        }}
      >
        <div className="uib-stage-outer" style={{ width: stageW * zoom, height: contentH * zoom }}>
          <div ref={stageRef} className="uib-stage" style={{ width: stageW, height: contentH, transform: `scale(${zoom})` }}>
            {frames.map((f) => (
              <iframe
                key={f.key}
                ref={(el) => {
                  if (el) frameEls.current.set(f.key, el)
                }}
                className={`uib-frame${f === visible ? '' : ' hidden'}`}
                title={mode === 'edit' ? 'Страница ESPUI (редактирование)' : 'Страница ESPUI (тест)'}
                sandbox="allow-scripts"
                src={frameUrl}
                style={{ width: stageW, height: contentH }}
                tabIndex={-1}
              />
            ))}

            {mode === 'edit' && (
              <div
                className={`uib-overlay${drop?.kind === 'index' && tab.elements.length === 0 ? ' drop-empty' : ''}`}
                onDragOver={onDragOver}
                onDragLeave={(e) => {
                  if (e.currentTarget === e.target) setDrop(null)
                }}
                onDrop={onDropWidget}
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget) st().select(null)
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                {/* вкладки самого ESPUI: клик и приём перетаскиваемых элементов */}
                {multi &&
                  Object.entries(layout?.tabs ?? {}).map(([id, r]) => (
                    <div
                      key={id}
                      className={`uib-tabhit${drop?.kind === 'tab' && drop.tabId === id ? ' drop' : ''}`}
                      style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
                      data-tab-chip={id}
                      title="Вкладка страницы. Двойной щелчок — переименовать."
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        st().setActiveTab(id)
                      }}
                      onDoubleClick={() => setEditing({ kind: 'tab', id })}
                      onDragOver={(e) => {
                        if (e.dataTransfer.types.includes(DND_WIDGET)) {
                          e.preventDefault()
                          e.stopPropagation()
                          setDrop({ kind: 'tab', index: -1, tabId: id, line: null })
                        }
                      }}
                      onDrop={(e) => {
                        const type = e.dataTransfer.getData(DND_WIDGET)
                        if (type && type in WIDGETS) {
                          e.preventDefault()
                          e.stopPropagation()
                          setDrop(null)
                          st().addElement(type as WidgetType, id)
                        }
                      }}
                    />
                  ))}

                {tab.elements.map((el) => {
                  const r = layout?.cards[el.id]
                  if (!r) return null
                  return (
                    <CardOverlay
                      key={el.id}
                      el={el}
                      r={r}
                      selected={selected === el.id}
                      flashing={flashing === el.id}
                      dragging={drag?.id === el.id}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        st().select(el.id)
                        startDrag(e, el.id)
                      }}
                      onDoubleClick={() => setEditing({ kind: 'label', id: el.id })}
                      onContextMenu={(e) => openMenu(e, el.id)}
                    />
                  )
                })}

                {/* быстрая правка подписи */}
                {editing?.kind === 'label' &&
                  (() => {
                    const r = layout?.cards[editing.id]
                    const el = findElement(project, editing.id)
                    if (!r || !el) return null
                    return (
                      <div className="uib-inline-edit" style={{ left: r.x + 6, top: r.label ? r.label.y - 4 : r.y + 6, width: r.w - 12 }}>
                        <InlineInput
                          value={el.label}
                          big
                          onDone={(v) => {
                            setEditing(null)
                            if (v !== null && v !== el.label) st().patchElement(el.id, { label: v })
                          }}
                        />
                      </div>
                    )
                  })()}
                {editing?.kind === 'tab' &&
                  (() => {
                    const r = layout?.tabs[editing.id]
                    const t = project.tabs.find((x) => x.id === editing.id)
                    if (!r || !t || !multi) return null
                    return (
                      <div className="uib-inline-edit" style={{ left: r.x, top: r.y, width: Math.max(r.w, 120) }}>
                        <InlineInput
                          value={t.title}
                          big
                          onDone={(v) => {
                            setEditing(null)
                            if (v !== null && v !== t.title) st().patchTab(t.id, { title: v })
                          }}
                        />
                      </div>
                    )
                  })()}

                {drop?.kind === 'index' && drop.line && (
                  <div className="uib-dropline" style={{ left: drop.line.x, top: drop.line.y, width: drop.line.w, height: drop.line.h }} />
                )}

                {total > 0 && tab.elements.length === 0 && (
                  <div className="uib-tab-empty">
                    <strong>Эта вкладка пока пуста</strong>
                    <span>Кликните элемент слева или перетащите его сюда</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {mode === 'edit' && total === 0 && <Onboarding />}
        {buildError && <div className="uib-build-error">Не удалось собрать страницу для холста: {buildError}</div>}
      </div>

      {mode === 'edit' && invisibleEls.length > 0 && (
        <div className="uib-invisible-bar">
          <Icon name="eyeoff" size={14} /> Без панели на странице:
          {invisibleEls.map((e) => (
            <button key={e.id} className={`uib-chip${selected === e.id ? ' active' : ''}`} onClick={() => st().select(e.id)} title="Этот элемент ESPUI ничего не рисует на странице (работает в фоне)">
              <WidgetIcon type={e.type} size={13} /> {e.label || e.id}
            </button>
          ))}
        </div>
      )}

      {mode === 'test' && <TestBar sim={sim} onReset={() => setResetNonce((n) => n + 1)} />}

      {mode === 'edit' && multi === false && total > 0 && (
        <div className="uib-canvas-note">Одна вкладка: панель вкладок на странице ESPUI не показывается. Добавьте вторую вкладку — и она появится.</div>
      )}

      {toast && <Toast key={toast.nonce} text={toast.text} />}

      {drag && (
        <div className="uib-drag-ghost" style={{ left: drag.x + 12, top: drag.y + 12 }}>
          {findElement(project, drag.id)?.label ?? ''}
        </div>
      )}

      {menu && rawTab && <ContextMenu x={menu.x} y={menu.y} id={menu.id} onClose={() => setMenu(null)} />}
    </section>
  )
}

function Toast({ text }: { text: string }): ReactNode {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 3200)
    return () => clearTimeout(t)
  }, [])
  return show ? (
    <div className="uib-toast" role="status">
      {text}
    </div>
  ) : null
}

function InlineInput({ value, onDone, big }: { value: string; onDone: (v: string | null) => void; big?: boolean }): ReactNode {
  const [v, setV] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const finish = (val: string | null): void => {
    if (done.current) return
    done.current = true
    onDone(val)
  }
  return (
    <input
      ref={ref}
      className={`uib-inline-input${big ? ' big' : ''}`}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => finish(v)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(v)
        if (e.key === 'Escape') finish(null)
      }}
    />
  )
}

function CardOverlay({
  el,
  r,
  selected,
  flashing,
  dragging,
  onPointerDown,
  onDoubleClick,
  onContextMenu
}: {
  el: UiElement
  r: Rect
  selected: boolean
  flashing: boolean
  dragging: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onDoubleClick: () => void
  onContextMenu: (e: RMouseEvent) => void
}): ReactNode {
  const ctx = useBuilder()
  const st = useUiBuilder.getState
  const mine = ctx.issues.filter((i) => i.elementId === el.id)
  const hasErr = mine.some((i) => i.severity === 'error')
  const info = bindInfo(el, ctx.effective, ctx.sketch, ctx.issues)
  const nonBinding = mine.filter((i) => !BINDING_ISSUE.test(i.code))
  const wideRef = useRef<{ sx: number; done: boolean } | null>(null)
  const toolsAbove = r.y > 44

  return (
    <div
      className={`uib-hit${selected ? ' selected' : ''}${flashing ? ' flash' : ''}${dragging ? ' dragging' : ''}${hasErr ? ' has-error' : mine.length ? ' has-warn' : ''}`}
      style={{ left: r.x - 3, top: r.y - 3, width: r.w + 6, height: r.h + 6 }}
      data-el={el.id}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      title={`${el.label || el.id} — ${widgetTitle(el.type)}. Двойной щелчок — переименовать, перетащите — переставить.`}
    >
      {selected && (
        <>
          <i className="uib-handle tl" />
          <i className="uib-handle tr" />
          <i className="uib-handle bl" />
          <i className="uib-handle br" />
          {el.type !== 'separator' && (
            <i
              className="uib-handle mr"
              title={el.props.wide ? 'Потяните влево, чтобы вернуть обычную ширину' : 'Потяните вправо, чтобы растянуть на всю ширину'}
              onPointerDown={(e) => {
                e.stopPropagation()
                wideRef.current = { sx: e.clientX, done: false }
                ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
              }}
              onPointerMove={(e) => {
                const w = wideRef.current
                if (!w || w.done) return
                const dx = e.clientX - w.sx
                if (dx > 40 && !el.props.wide) {
                  w.done = true
                  st().patchProps(el.id, { wide: true })
                } else if (dx < -40 && el.props.wide) {
                  w.done = true
                  st().patchProps(el.id, { wide: false })
                }
              }}
              onPointerUp={() => (wideRef.current = null)}
            />
          )}
          <div className={`uib-sel-tools ${toolsAbove ? 'above' : 'below'}`} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
            <span className="uib-sel-title">
              <WidgetIcon type={el.type} size={13} /> {widgetTitle(el.type)}
            </span>
            <button className="uib-icon-btn" title="Сдвинуть назад (Alt+←)" onClick={() => st().moveElementBy(el.id, -1)}>
              <Icon name="left" size={13} />
            </button>
            <button className="uib-icon-btn" title="Сдвинуть вперёд (Alt+→)" onClick={() => st().moveElementBy(el.id, 1)}>
              <Icon name="right" size={13} />
            </button>
            <button className="uib-icon-btn" title="Дублировать (Ctrl+D)" onClick={() => st().duplicateElement(el.id)}>
              <Icon name="copy" size={13} />
            </button>
            <button className="uib-icon-btn danger" title="Удалить (Delete)" onClick={() => st().removeElement(el.id)}>
              <Icon name="trash" size={13} />
            </button>
          </div>
        </>
      )}
      {info.text && (
        <button
          type="button"
          className={`uib-badge ${info.state}`}
          title={`${info.text}${info.detail ? '\n' + info.detail : ''}\nНажмите, чтобы изменить связь`}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            st().select(el.id)
            st().requestFocus('binding')
          }}
        >
          <Icon name={info.icon} size={12} />
          <span>{info.text}</span>
        </button>
      )}
      {nonBinding.length > 0 && !info.text.includes('Выберите') && (
        <span className={`uib-corner-flag ${nonBinding.some((i) => i.severity === 'error') ? 'err' : 'warn'}`} title={nonBinding.map((i) => i.message).join('\n')}>
          <Icon name={nonBinding.some((i) => i.severity === 'error') ? 'error' : 'warn'} size={14} />
        </span>
      )}
    </div>
  )
}

function ContextMenu({ x, y, id, onClose }: { x: number; y: number; id: string; onClose: () => void }): ReactNode {
  const project = useUiBuilder((s) => s.project)
  const ctx = useBuilder()
  const st = useUiBuilder.getState
  const el = findElement(project, id)
  const [sub, setSub] = useState(false)
  if (!el) return null
  const tabOfEl = project.tabs.find((t) => t.elements.some((e) => e.id === id))
  const act = (fn: () => void) => (): void => {
    fn()
    onClose()
  }
  const hasCode = ctx.code.length > 0
  return (
    <div className="uib-menu" style={{ left: Math.min(x, window.innerWidth - 230), top: Math.min(y, window.innerHeight - 320) }} onPointerDown={(e) => e.stopPropagation()} role="menu">
      <div className="uib-menu-title">
        <WidgetIcon type={el.type} size={14} /> {el.label || el.id}
      </div>
      {canBind(el.type) && (
        <button role="menuitem" onClick={act(() => { st().select(id); st().requestFocus('binding') })}>
          <Icon name="link" size={14} /> Связь с кодом…
        </button>
      )}
      <button role="menuitem" onClick={act(() => st().requestFocus('label'))}>
        <Icon name="edit" size={14} /> Изменить подпись <kbd>F2</kbd>
      </button>
      <button role="menuitem" onClick={act(() => st().duplicateElement(id))}>
        <Icon name="copy" size={14} /> Дублировать <kbd>Ctrl+D</kbd>
      </button>
      <div className="uib-menu-sep" />
      <button role="menuitem" onClick={act(() => st().moveElementBy(id, -1))}>
        <Icon name="left" size={14} /> Сдвинуть назад <kbd>Alt+←</kbd>
      </button>
      <button role="menuitem" onClick={act(() => st().moveElementBy(id, 1))}>
        <Icon name="right" size={14} /> Сдвинуть вперёд <kbd>Alt+→</kbd>
      </button>
      <button role="menuitem" onClick={act(() => st().moveElementBy(id, -999))}>
        <Icon name="up" size={14} /> В начало вкладки
      </button>
      <button role="menuitem" onClick={act(() => st().moveElementBy(id, 999))}>
        <Icon name="down" size={14} /> В конец вкладки
      </button>
      {project.tabs.length > 1 && (
        <>
          <button role="menuitem" onClick={() => setSub(!sub)}>
            <Icon name="tab" size={14} /> Перенести во вкладку <Icon name="chevronRight" size={12} className="push" />
          </button>
          {sub &&
            project.tabs
              .filter((t) => t.id !== tabOfEl?.id)
              .map((t) => (
                <button key={t.id} role="menuitem" className="sub" onClick={act(() => st().moveElementToTab(id, t.id))}>
                  {t.title || t.id}
                </button>
              ))}
        </>
      )}
      {hasCode && (
        <button role="menuitem" onClick={act(() => { st().select(id); st().setView('code') })}>
          <Icon name="code" size={14} /> Показать в коде
        </button>
      )}
      <div className="uib-menu-sep" />
      <button role="menuitem" className="danger" onClick={act(() => st().removeElement(id))}>
        <Icon name="trash" size={14} /> Удалить <kbd>Del</kbd>
      </button>
    </div>
  )
}

function TestBar({ sim, onReset }: { sim: SimMsg; onReset: () => void }): ReactNode {
  const names = Object.keys(sim.vars)
  return (
    <div className="uib-testbar">
      <div className="uib-testbar-head">
        <Icon name="play" size={13} /> <strong>Тест</strong> — страница работает как на устройстве, «устройство» — симуляция
        <button className="uib-btn small" onClick={onReset} title="Начать симуляцию заново">
          Сбросить
        </button>
      </div>
      <div className="uib-testbar-body">
        <div className="uib-sim-vars">
          {names.length === 0 && <span className="uib-dim">Здесь появятся значения переменных и пинов</span>}
          {names.map((n) => (
            <span key={n} className="uib-sim-var">
              <code>{n}</code> = <b>{sim.vars[n]}</b>
            </span>
          ))}
        </div>
        <div className="uib-sim-events">
          {sim.events.length === 0 ? <span className="uib-dim">Нажмите кнопку или подвигайте ползунок — увидите, что получит скетч</span> : sim.events.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      </div>
    </div>
  )
}

function Onboarding(): ReactNode {
  const ctx = useBuilder()
  const st = useUiBuilder.getState
  return (
    <div className="uib-onboard">
      <h2>Соберите страницу за три шага</h2>
      <ol className="uib-steps">
        <li>
          <span className="n">1</span>
          <div>
            <strong>Добавьте элемент</strong>
            <span>Кликните элемент в списке слева или перетащите его сюда.</span>
          </div>
        </li>
        <li>
          <span className="n">2</span>
          <div>
            <strong>Свяжите с переменной</strong>
            <span>Выберите элемент и ответьте «Что должно происходить?» — переменные из вашего скетча найдутся сами.</span>
          </div>
        </li>
        <li>
          <span className="n">3</span>
          <div>
            <strong>Вставьте в скетч</strong>
            <span>Кнопка «Вставить в скетч» сверху сама добавит нужные строки.</span>
          </div>
        </li>
      </ol>
      <div className="uib-onboard-or">или начните с готовой страницы</div>
      <div className="uib-templates">
        {PAGE_TEMPLATES.map((t) => {
          const full = findPageTemplate(t.id)
          const has = ctx.sketch ? t.variables.filter((v) => ctx.sketch?.vars.some((s) => s.name === v.name && s.type === v.type)) : []
          return (
            <button key={t.id} className="uib-template" title={`Нужны переменные: ${full?.variables.map((v) => `${v.name} (${v.type})`).join(", ")}`} onClick={() => st().newFromTemplate(t.id, ctx.sketch)}>
              <strong>{t.title}</strong>
              <span>{t.description}</span>
              <span className="uib-template-vars">
                Нужны переменные: {full?.variables.map((v) => `${v.name} (${v.type})`).join(', ')}
              </span>
              {has.length > 0 && <span className="uib-template-found">В вашем скетче уже есть: {has.map((v) => v.name).join(', ')} — они подключатся сами</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

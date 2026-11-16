import { useMemo, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent, ReactNode } from 'react'
import { MiniIcon } from '../../shell/MiniIcon'
import { useUiBuilder } from '../store'
import { Icon, WidgetIcon } from './icons'
import { useBuilder } from './ctx'
import { widgetTitle } from './paletteData'

type Pos = 'before' | 'after' | 'inside'
interface Row {
  kind: 'tab' | 'el'
  id: string
  tabId: string
  index: number
}

/** Вкладка «Структура»: вкладки страницы и их элементы деревом — как в веб-дизайнере. Перетаскивание меняет порядок и переносит между вкладками. */
export function StructureTree(): ReactNode {
  const ctx = useBuilder()
  const project = useUiBuilder((s) => s.project)
  const selected = useUiBuilder((s) => s.selected)
  const activeTab = useUiBuilder((s) => s.activeTab)
  const { reveal, setActiveTab, moveElement, moveElementBy, duplicateElement, removeElement } = useUiBuilder.getState()
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [drag, setDrag] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ key: string; pos: Pos } | null>(null)
  const box = useRef<HTMLDivElement>(null)

  const sevOf = useMemo(() => {
    const m = new Map<string, 'error' | 'warning'>()
    for (const i of ctx.issues) {
      if (!i.elementId) continue
      if (i.severity === 'error') m.set(i.elementId, 'error')
      else if (!m.has(i.elementId)) m.set(i.elementId, 'warning')
    }
    return m
  }, [ctx.issues])

  const rows = useMemo(() => {
    const out: Row[] = []
    for (const t of project.tabs) {
      out.push({ kind: 'tab', id: t.id, tabId: t.id, index: -1 })
      if (!collapsed.has(t.id)) t.elements.forEach((e, i) => out.push({ kind: 'el', id: e.id, tabId: t.id, index: i }))
    }
    return out
  }, [project, collapsed])
  const total = project.tabs.reduce((n, t) => n + t.elements.length, 0)

  const toggle = (id: string): void => setCollapsed((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const pickRow = (r: Row): void => {
    if (r.kind === 'tab') setActiveTab(r.id)
    else reveal(r.id)
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    const i = rows.findIndex((r) => (r.kind === 'el' ? r.id === selected : r.id === activeTab && !selected))
    const go = (n: number): void => { const r = rows[Math.max(0, Math.min(rows.length - 1, n))]; if (r) pickRow(r) }
    if (e.altKey && selected && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveElementBy(selected, e.key === 'ArrowUp' ? -1 : 1); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); go(i + 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); go(i - 1) }
    else if (e.key === 'Home') { e.preventDefault(); go(0) }
    else if (e.key === 'End') { e.preventDefault(); go(rows.length - 1) }
    else if (e.key === 'ArrowLeft' && rows[i]?.kind === 'tab' && !collapsed.has(rows[i].id)) { e.preventDefault(); toggle(rows[i].id) }
    else if (e.key === 'ArrowRight' && rows[i]?.kind === 'tab' && collapsed.has(rows[i].id)) { e.preventDefault(); toggle(rows[i].id) }
  }

  // ----- перетаскивание: элемент можно положить до/после другого элемента или внутрь вкладки (в конец) -----
  const posFor = (e: DragEvent<HTMLElement>, r: Row): Pos => {
    if (r.kind === 'tab') return 'inside'
    const b = e.currentTarget.getBoundingClientRect()
    return (e.clientY - b.top) / b.height < 0.5 ? 'before' : 'after'
  }
  const onDragOver = (e: DragEvent<HTMLElement>, r: Row): void => {
    if (!drag || (r.kind === 'el' && r.id === drag)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const pos = posFor(e, r)
    if (drop?.key !== r.id || drop.pos !== pos) setDrop({ key: r.id, pos })
  }
  const doDrop = (e: DragEvent<HTMLElement>, r: Row): void => {
    e.preventDefault()
    const d = drag
    const pos = posFor(e, r)
    setDrag(null)
    setDrop(null)
    if (!d) return
    if (r.kind === 'tab') {
      const t = project.tabs.find((x) => x.id === r.id)
      moveElement(d, r.id, t ? t.elements.filter((x) => x.id !== d).length : 0)
      setCollapsed((c) => { const n = new Set(c); n.delete(r.id); return n })
      return
    }
    const t = project.tabs.find((x) => x.id === r.tabId)
    if (!t) return
    const list = t.elements.filter((x) => x.id !== d)
    moveElement(d, r.tabId, list.findIndex((x) => x.id === r.id) + (pos === 'after' ? 1 : 0))
  }

  return (
    <div className="uib-structure">
      <div className="pn-bar">
        <span className="dim small grow">{total ? `Элементов: ${total}` : 'Страница пуста'}</span>
        <button className="pn-ibtn" onClick={() => setCollapsed(new Set(project.tabs.map((t) => t.id)))} title="Свернуть все вкладки" aria-label="Свернуть все вкладки"><MiniIcon name="collapse" /></button>
        <button className="pn-ibtn" onClick={() => setCollapsed(new Set())} title="Развернуть все вкладки" aria-label="Развернуть все вкладки"><MiniIcon name="expand" /></button>
      </div>
      <div className="pn-scroll" ref={box} role="tree" aria-label="Структура страницы" tabIndex={0} onKeyDown={onKey} data-testid="uib-tree">
        {total === 0 && project.tabs.length <= 1 && <div className="pn-empty dim small">Пока пусто. Откройте вкладку «Элементы» и добавьте первый.</div>}
        {rows.map((r) => {
          const isTab = r.kind === 'tab'
          const tab = project.tabs.find((t) => t.id === r.tabId)
          const el = isTab ? null : tab?.elements[r.index]
          if (!tab || (!isTab && !el)) return null
          const isSel = isTab ? !selected && activeTab === r.id : selected === r.id
          const open = !collapsed.has(r.id)
          const s = el ? sevOf.get(el.id) : undefined
          const title = isTab ? tab.title : el!.label || widgetTitle(el!.type)
          const dropCls = drop?.key === r.id ? ` drop-${drop.pos}` : ''
          return (
            <div
              key={r.kind + r.id}
              role="treeitem"
              aria-level={isTab ? 1 : 2}
              aria-selected={isSel}
              aria-expanded={isTab ? open : undefined}
              data-testid={isTab ? 'uib-tree-tab' : 'uib-tree-el'}
              data-id={r.id}
              className={`pn-row${isSel ? ' sel' : ''}${drag === r.id ? ' dragging' : ''}${dropCls}`}
              title={isTab ? `Вкладка «${tab.title}»` : `${widgetTitle(el!.type)} · ${el!.id}${s ? '\nЕсть замечания (см. «Проблемы»)' : ''}`}
              draggable={!isTab}
              onClick={() => pickRow(r)}
              onDoubleClick={() => isTab && toggle(r.id)}
              onDragStart={isTab ? undefined : (e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', r.id); setDrag(r.id) }}
              onDragEnd={() => { setDrag(null); setDrop(null) }}
              onDragOver={(e) => onDragOver(e, r)}
              onDragLeave={() => setDrop((d) => (d?.key === r.id ? null : d))}
              onDrop={(e) => doDrop(e, r)}
            >
              <span className="pn-guides" aria-hidden="true">{!isTab && <i className="pn-guide" />}</span>
              {isTab ? (
                <button className={`pn-chev${open ? ' open' : ''}`} onClick={(e) => { e.stopPropagation(); toggle(r.id) }} aria-label={open ? 'Свернуть' : 'Развернуть'} tabIndex={-1}>
                  <MiniIcon name="chev" />
                </button>
              ) : <span className="pn-chev-sp" />}
              <span className="pn-ic">{isTab ? <Icon name="tab" size={16} /> : <WidgetIcon type={el!.type} size={16} />}</span>
              <span className="pn-name">{title}</span>
              <span className="pn-id">{isTab ? tab.elements.length : el!.id}</span>
              {s && <span className={`pn-flag ${s}`} aria-label={s === 'error' ? 'Ошибка' : 'Предупреждение'}>●</span>}
              {!isTab && (
                <span className="pn-tools" onClick={(e) => e.stopPropagation()}>
                  <button className="pn-mini" title="Выше (Alt+↑)" aria-label="Выше" onClick={() => moveElementBy(el!.id, -1)}><MiniIcon name="up" /></button>
                  <button className="pn-mini" title="Ниже (Alt+↓)" aria-label="Ниже" onClick={() => moveElementBy(el!.id, 1)}><MiniIcon name="down" /></button>
                  <button className="pn-mini" title="Дублировать" aria-label="Дублировать" onClick={() => duplicateElement(el!.id)}><MiniIcon name="copy" /></button>
                  <button className="pn-mini danger" title="Удалить" aria-label="Удалить" onClick={() => removeElement(el!.id)}><MiniIcon name="trash" /></button>
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

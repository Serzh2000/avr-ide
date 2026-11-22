import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent, ReactNode } from 'react'
import { BLOCKS, BLOCK_ORDER, GROUP_TITLES, canContain, findBlock, findParent, isInside, moveBlock, walk } from './core/index'
import type { Block, BlockType, Issue, WdProject } from './core/index'
import { BlockIcon, MiniIcon } from './blockIcons'
import { useWebDesigner } from './store'
import type { LeftTab } from './store'
import { useWdSketch } from './sketchCtx'

// ---------- вкладка «Блоки»: палитра ----------

export function Palette(): ReactNode {
  const addBlock = useWebDesigner((s) => s.addBlock)
  const { standalone } = useWdSketch()
  const available = standalone ? BLOCK_ORDER.filter((type) => type !== 'wifisetup' && type !== 'ota') : BLOCK_ORDER
  const [q, setQ] = useState('')
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const query = q.trim().toLowerCase()
  const item = (t: BlockType): ReactNode => (
    <button key={t} className="wd-pal-item" onClick={() => addBlock(t)} title={`Добавить: ${BLOCKS[t].title}`}>
      <span className="wd-pal-ic"><BlockIcon type={t} /></span>
      <span className="wd-pal-t">{BLOCKS[t].title}</span>
    </button>
  )
  const found = query ? available.filter((t) => BLOCKS[t].title.toLowerCase().includes(query) || t.includes(query)) : []
  return (
    <div className="wd-palette">
      <div className="wd-pal-search">
        <MiniIcon name="search" />
        <input className="wd-search-input" placeholder="Найти блок…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск блоков" />
        {q && <button className="wd-ibtn" onClick={() => setQ('')} title="Очистить" aria-label="Очистить поиск"><MiniIcon name="x" /></button>}
      </div>
      {query ? (
        <div className="wd-palette-grid">{found.length ? found.map(item) : <div className="wd-hint">Ничего не найдено</div>}</div>
      ) : (
        (Object.keys(GROUP_TITLES) as Array<keyof typeof GROUP_TITLES>).map((g) => {
          const blocks = available.filter((type) => BLOCKS[type].group === g)
          if (!blocks.length) return null
          const isClosed = !!closed[g]
          return (
            <div key={g} className="wd-pal-group">
              <button className="wd-group" aria-expanded={!isClosed} onClick={() => setClosed({ ...closed, [g]: !isClosed })}>
                <span className={`wd-chev${isClosed ? '' : ' open'}`}><MiniIcon name="chev" /></span>
                {GROUP_TITLES[g]}
              </button>
              {!isClosed && <div className="wd-palette-grid">{blocks.map(item)}</div>}
            </div>
          )
        })
      )}
    </div>
  )
}

// ---------- вкладка «Структура»: дерево блоков ----------

type Pos = 'before' | 'after' | 'inside'
interface Row {
  b: Block
  depth: number
  hasKids: boolean
}

/** Можно ли положить блок dragId рядом с target (before/after) или внутрь него. */
function dropLegal(p: WdProject, dragId: string, targetId: string, pos: Pos): boolean {
  if (dragId === targetId) return false
  const d = findBlock(p, dragId)
  const t = findBlock(p, targetId)
  if (!d || !t) return false
  if (isInside(p, dragId, targetId)) return false
  if (pos === 'inside') return canContain(t.type, d.type)
  const par = findParent(p, targetId)
  return par ? canContain(par.type, d.type) : d.type !== 'panel'
}

function contentHint(b: Block): string {
  const pr = b.props as Record<string, unknown>
  for (const k of ['label', 'text', 'brand', 'title']) {
    const v = pr[k]
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 60)
  }
  return ''
}

export function Tree({ issues }: { issues: Issue[] }): ReactNode {
  const project = useWebDesigner((s) => s.project)
  const selected = useWebDesigner((s) => s.selected)
  const { select, shift, removeBlock, duplicateBlock, mutate } = useWebDesigner.getState()
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [q, setQ] = useState('')
  const [drag, setDrag] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ id: string; pos: Pos } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const query = q.trim().toLowerCase()

  const sevOf = useMemo(() => {
    const m = new Map<string, 'error' | 'warning'>()
    for (const i of issues) {
      if (!i.blockId) continue
      if (i.severity === 'error') m.set(i.blockId, 'error')
      else if (!m.has(i.blockId)) m.set(i.blockId, 'warning')
    }
    return m
  }, [issues])

  const { rows, total } = useMemo(() => {
    const out: Row[] = []
    let n = 0
    const matches = (b: Block): boolean => {
      const hay = `${BLOCKS[b.type]?.title ?? b.type} ${b.id} ${contentHint(b)}`.toLowerCase()
      return hay.includes(query)
    }
    const visit = (b: Block, depth: number): boolean => {
      n++
      const mark = out.length
      out.push({ b, depth, hasKids: b.children.length > 0 })
      let kidHit = false
      if (query || !collapsed.has(b.id)) {
        for (const c of b.children) if (visit(c, depth + 1)) kidHit = true
      } else {
        for (const c of b.children) walk([c], () => { n++ })
      }
      const self = !query || matches(b)
      if (!self && !kidHit) {
        out.length = mark
        return false
      }
      return true
    }
    for (const b of project.blocks) visit(b, 0)
    return { rows: out, total: n }
  }, [project, collapsed, query])

  // выбранный блок показывается раскрытым и прокручивается в видимую область (в т.ч. при выборе из превью)
  useEffect(() => {
    if (!selected) return
    let cur = findParent(project, selected)
    const need: string[] = []
    while (cur) {
      if (collapsed.has(cur.id)) need.push(cur.id)
      cur = findParent(project, cur.id)
    }
    if (need.length) setCollapsed((c) => { const n = new Set(c); need.forEach((i) => n.delete(i)); return n })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])
  useEffect(() => {
    if (!selected) return
    box.current?.querySelector<HTMLElement>('.wd-tree-row.sel')?.scrollIntoView({ block: 'nearest' })
  }, [selected, rows.length])

  const toggle = (id: string): void => setCollapsed((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allParents = (): string[] => { const ids: string[] = []; walk(project.blocks, (b) => { if (b.children.length) ids.push(b.id) }); return ids }

  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return
    const i = rows.findIndex((r) => r.b.id === selected)
    const cur = i >= 0 ? rows[i] : null
    if (e.altKey && cur && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); shift(cur.b.id, e.key === 'ArrowUp' ? -1 : 1); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); const r = rows[Math.min(rows.length - 1, i + 1)]; if (r) select(r.b.id) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const r = rows[Math.max(0, i - 1)]; if (r) select(r.b.id) }
    else if (e.key === 'Home') { e.preventDefault(); if (rows[0]) select(rows[0].b.id) }
    else if (e.key === 'End') { e.preventDefault(); const r = rows[rows.length - 1]; if (r) select(r.b.id) }
    else if (e.key === 'ArrowRight' && cur?.hasKids) {
      e.preventDefault()
      if (collapsed.has(cur.b.id)) toggle(cur.b.id)
      else select(cur.b.children[0].id)
    } else if (e.key === 'ArrowLeft' && cur) {
      e.preventDefault()
      if (cur.hasKids && !collapsed.has(cur.b.id)) toggle(cur.b.id)
      else { const par = findParent(project, cur.b.id); if (par) select(par.id) }
    }
  }

  // ----- перетаскивание -----
  const posFor = (e: DragEvent<HTMLElement>, target: Block): Pos => {
    const r = e.currentTarget.getBoundingClientRect()
    const f = (e.clientY - r.top) / r.height
    const container = BLOCKS[target.type]?.container === true
    if (container && f > 0.28 && f < 0.72) return 'inside'
    return f < 0.5 ? 'before' : 'after'
  }
  const onDragOver = (e: DragEvent<HTMLElement>, target: Block): void => {
    if (!drag) return
    let pos = posFor(e, target)
    if (!dropLegal(project, drag, target.id, pos)) {
      // запасной вариант: если «внутрь» нельзя, пробуем рядом
      const alt: Pos = pos === 'inside' ? ((e.clientY - e.currentTarget.getBoundingClientRect().top) / e.currentTarget.getBoundingClientRect().height < 0.5 ? 'before' : 'after') : pos
      if (alt === pos || !dropLegal(project, drag, target.id, alt)) { setDrop(null); return }
      pos = alt
    }
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (drop?.id !== target.id || drop.pos !== pos) setDrop({ id: target.id, pos })
  }
  const doDrop = (e: DragEvent<HTMLElement>): void => {
    e.preventDefault()
    const d = drag
    const t = drop
    setDrag(null)
    setDrop(null)
    if (!d || !t) return
    mutate((p) => {
      if (t.pos === 'inside') { moveBlock(p, d, t.id); return }
      const par = findParent(p, t.id)
      const list = par ? par.children : p.blocks
      let idx = list.findIndex((x) => x.id === t.id) + (t.pos === 'after' ? 1 : 0)
      const di = list.findIndex((x) => x.id === d)
      if (di >= 0 && di < idx) idx--
      moveBlock(p, d, par ? par.id : null, idx)
    })
    if (t.pos === 'inside') setCollapsed((c) => { const n = new Set(c); n.delete(t.id); return n })
  }

  return (
    <div className="wd-tree">
      <div className="wd-tree-bar">
        <div className="wd-pal-search">
          <MiniIcon name="search" />
          <input className="wd-search-input" placeholder="Фильтр: имя, id, текст" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Фильтр структуры" />
          {q && <button className="wd-ibtn" onClick={() => setQ('')} title="Очистить" aria-label="Очистить фильтр"><MiniIcon name="x" /></button>}
        </div>
        <button className="wd-ibtn" onClick={() => setCollapsed(new Set(allParents()))} title="Свернуть все узлы" aria-label="Свернуть все узлы"><MiniIcon name="collapse" /></button>
        <button className="wd-ibtn" onClick={() => setCollapsed(new Set())} title="Развернуть все узлы" aria-label="Развернуть все узлы"><MiniIcon name="expand" /></button>
      </div>
      <div className="wd-tree-scroll" ref={box} role="tree" aria-label="Структура страницы" tabIndex={0} onKeyDown={onKey}>
        {total === 0 && <div className="wd-hint wd-tree-empty">Пусто. Откройте вкладку «Блоки» и добавьте секцию.</div>}
        {total > 0 && rows.length === 0 && <div className="wd-hint wd-tree-empty">Ничего не найдено по запросу «{q}».</div>}
        {rows.map(({ b, depth, hasKids }) => {
          const s = sevOf.get(b.id)
          const isSel = selected === b.id
          const title = BLOCKS[b.type]?.title ?? b.type
          const hint = contentHint(b)
          const open = !collapsed.has(b.id) || !!query
          const dropCls = drop?.id === b.id ? ` drop-${drop.pos}` : ''
          return (
            <div
              key={b.id}
              role="treeitem"
              aria-level={depth + 1}
              aria-selected={isSel}
              aria-expanded={hasKids ? open : undefined}
              className={`wd-tree-row${isSel ? ' sel' : ''}${drag === b.id ? ' dragging' : ''}${dropCls}`}
              title={`${title} · ${b.id}${hint ? `\n«${hint}»` : ''}${s ? '\nЕсть замечания (см. «Проблемы»)' : ''}`}
              draggable
              onClick={() => select(b.id)}
              onDoubleClick={() => hasKids && toggle(b.id)}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', b.id); setDrag(b.id) }}
              onDragEnd={() => { setDrag(null); setDrop(null) }}
              onDragOver={(e) => onDragOver(e, b)}
              onDragLeave={() => setDrop((d) => (d?.id === b.id ? null : d))}
              onDrop={doDrop}
            >
              <span className="wd-guides" aria-hidden="true">
                {Array.from({ length: depth }, (_, i) => <i key={i} className="wd-guide" />)}
              </span>
              {hasKids ? (
                <button className={`wd-chev${open ? ' open' : ''}`} onClick={(e) => { e.stopPropagation(); toggle(b.id) }} aria-label={open ? 'Свернуть' : 'Развернуть'} tabIndex={-1}>
                  <MiniIcon name="chev" />
                </button>
              ) : <span className="wd-chev-sp" />}
              <span className="wd-tree-ic"><BlockIcon type={b.type} /></span>
              <span className="wd-tree-name">{title}</span>
              <span className="wd-tree-id">{b.id}</span>
              {s && <span className={`wd-flag ${s}`} aria-label={s === 'error' ? 'Ошибка' : 'Предупреждение'}>●</span>}
              <span className="wd-tree-tools" onClick={(e) => e.stopPropagation()}>
                <button className="wd-mini" title="Выше (Alt+↑)" aria-label="Выше" onClick={() => shift(b.id, -1)}><MiniIcon name="up" /></button>
                <button className="wd-mini" title="Ниже (Alt+↓)" aria-label="Ниже" onClick={() => shift(b.id, 1)}><MiniIcon name="down" /></button>
                <button className="wd-mini" title="Дублировать" aria-label="Дублировать" onClick={() => duplicateBlock(b.id)}><MiniIcon name="copy" /></button>
                <button className="wd-mini danger" title="Удалить" aria-label="Удалить" onClick={() => removeBlock(b.id)}><MiniIcon name="trash" /></button>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- левая панель целиком: вкладки «Блоки | Структура» ----------

export function LeftPanel({ issues, count }: { issues: Issue[]; count: number }): ReactNode {
  const tab = useWebDesigner((s) => s.leftTab)
  const collapsed = useWebDesigner((s) => s.leftCollapsed)
  const { setLeftTab, setLeftCollapsed } = useWebDesigner.getState()
  // Узкое окно: панель выезжает поверх превью (drawer), слева остаётся полоса с кнопками «Блоки» и «Структура»
  const drawer = useWebDesigner((s) => s.leftDrawer)
  const setDrawer = useWebDesigner.getState().setLeftDrawer
  const tabs: Array<{ id: LeftTab; title: string }> = [
    { id: 'blocks', title: 'Блоки' },
    { id: 'tree', title: 'Структура' }
  ]
  const openTab = (t: LeftTab): void => { setLeftTab(t); setDrawer(true) }
  return (
    <>
      <aside className={`wd-left-strip${collapsed ? ' collapsed' : ''}`} aria-label="Блоки и структура (свёрнуто)">
        <button className="wd-ibtn wd-strip-expand" onClick={() => setLeftCollapsed(false)} title="Развернуть панель" aria-label="Развернуть панель"><MiniIcon name="expand" /></button>
        <button className="wd-ibtn" data-testid="wd-strip-blocks" onClick={() => openTab('blocks')} title="Блоки" aria-label="Блоки"><BlockIcon type="grid" /></button>
        <button className="wd-ibtn" data-testid="wd-strip-tree" onClick={() => openTab('tree')} title="Структура" aria-label="Структура"><BlockIcon type="list" /></button>
      </aside>
      {drawer && <div className="wd-left-scrim" onPointerDown={() => setDrawer(false)} />}
      <aside className={`wd-left${collapsed ? ' is-collapsed' : ''}${drawer ? ' open' : ''}`} aria-label="Блоки и структура" onKeyDown={(e) => { if (e.key === 'Escape' && drawer) { e.stopPropagation(); setDrawer(false) } }}>
        <div className="wd-left-head" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={`wd-ltab${tab === t.id ? ' active' : ''}`} onClick={() => setLeftTab(t.id)}>
              {t.title}
              {t.id === 'tree' && <span className="wd-count">{count}</span>}
            </button>
          ))}
          <span className="wd-spacer" />
          <button className="wd-ibtn wd-left-collapse" onClick={() => setLeftCollapsed(true)} title="Свернуть панель" aria-label="Свернуть панель"><MiniIcon name="collapse" /></button>
          <button className="wd-ibtn wd-left-close" onClick={() => setDrawer(false)} title="Закрыть панель" aria-label="Закрыть панель" data-testid="wd-left-close"><MiniIcon name="x" /></button>
        </div>
        <div className={`wd-pane wd-pane-blocks${tab === 'blocks' ? '' : ' off'}`}><Palette /></div>
        <div className={`wd-pane wd-pane-tree${tab === 'tree' ? '' : ' off'}`}><Tree issues={issues} /></div>
      </aside>
    </>
  )
}

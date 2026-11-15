import { useState } from 'react'
import type { ReactNode } from 'react'
import { BLOCKS, BLOCK_ORDER, GROUP_TITLES, walk } from './core/index'
import type { Block, BlockType, Issue } from './core/index'
import { useWebDesigner } from './store'

const GLYPH: Record<BlockType, string> = {
  section: '▭', grid: '▦', flex: '↔', card: '▢', heading: 'H', text: '¶', icon: '★', image: '▣', divider: '―',
  button: '◉', switch: '⏻', slider: '⎯', input: '⌨', color: '◐', sensor: '°', indicator: '●', gauge: '◔', progress: '▰', chart: '∿'
}

export function Palette(): ReactNode {
  const addBlock = useWebDesigner((s) => s.addBlock)
  const [q, setQ] = useState('')
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const query = q.trim().toLowerCase()
  const item = (t: BlockType): ReactNode => (
    <button key={t} className="wd-pal-item" onClick={() => addBlock(t)} title={`Добавить: ${BLOCKS[t].title}`}>
      <span className="wd-pal-ic" aria-hidden="true">{GLYPH[t]}</span>
      <span className="wd-pal-t">{BLOCKS[t].title}</span>
    </button>
  )
  const found = query ? BLOCK_ORDER.filter((t) => BLOCKS[t].title.toLowerCase().includes(query) || t.includes(query)) : []
  return (
    <div className="wd-palette">
      <input className="wd-input wd-search" placeholder="Поиск блоков…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск блоков" />
      {query ? (
        <div className="wd-palette-grid">{found.length ? found.map(item) : <div className="wd-hint">Ничего не найдено</div>}</div>
      ) : (
        (Object.keys(GROUP_TITLES) as Array<keyof typeof GROUP_TITLES>).map((g) => {
          const isClosed = !!closed[g]
          return (
            <div key={g}>
              <button className="wd-group" aria-expanded={!isClosed} onClick={() => setClosed({ ...closed, [g]: !isClosed })}>
                <span>{isClosed ? '▸' : '▾'}</span> {GROUP_TITLES[g]}
              </button>
              {!isClosed && <div className="wd-palette-grid">{BLOCK_ORDER.filter((t) => BLOCKS[t].group === g).map(item)}</div>}
            </div>
          )
        })
      )}
    </div>
  )
}

export function Tree({ issues }: { issues: Issue[] }): ReactNode {
  const project = useWebDesigner((s) => s.project)
  const selected = useWebDesigner((s) => s.selected)
  const { select, shift, removeBlock, duplicateBlock } = useWebDesigner.getState()
  const rows: Array<{ b: Block; depth: number }> = []
  walk(project.blocks, (b, _p, depth) => rows.push({ b, depth }))
  const sev = (id: string): 'error' | 'warning' | null => {
    const mine = issues.filter((i) => i.blockId === id)
    return mine.some((i) => i.severity === 'error') ? 'error' : mine.length ? 'warning' : null
  }
  return (
    <div className="wd-tree">
      <div className="wd-h">Структура</div>
      {rows.length === 0 && <div className="wd-hint">Пусто. Добавьте секцию.</div>}
      {rows.map(({ b, depth }) => {
        const s = sev(b.id)
        return (
          <div
            key={b.id}
            className={`wd-tree-row${selected === b.id ? ' sel' : ''}`}
            style={{ paddingLeft: 6 + depth * 12 }}
            onClick={() => select(b.id)}
          >
            <span className="wd-tree-name">
              {BLOCKS[b.type]?.title ?? b.type} <code>{b.id}</code>
              {s && <span className={`wd-flag ${s}`}>●</span>}
            </span>
            {selected === b.id && (
              <span className="wd-tree-tools" onClick={(e) => e.stopPropagation()}>
                <button className="wd-mini" title="Вверх" onClick={() => shift(b.id, -1)}>↑</button>
                <button className="wd-mini" title="Вниз" onClick={() => shift(b.id, 1)}>↓</button>
                <button className="wd-mini" title="Дублировать" onClick={() => duplicateBlock(b.id)}>⎘</button>
                <button className="wd-mini danger" title="Удалить" onClick={() => removeBlock(b.id)}>✕</button>
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

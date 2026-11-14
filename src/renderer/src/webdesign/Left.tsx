import type { ReactNode } from 'react'
import { BLOCKS, BLOCK_ORDER, GROUP_TITLES, walk } from './core/index'
import type { Block, Issue } from './core/index'
import { useWebDesigner } from './store'

export function Palette(): ReactNode {
  const addBlock = useWebDesigner((s) => s.addBlock)
  const groups = (Object.keys(GROUP_TITLES) as Array<keyof typeof GROUP_TITLES>).map((g) => ({
    g,
    items: BLOCK_ORDER.filter((t) => BLOCKS[t].group === g)
  }))
  return (
    <div className="wd-palette">
      <div className="wd-hint">Клик — добавить блок в выбранный контейнер (или после выбранного блока).</div>
      {groups.map(({ g, items }) => (
        <div key={g}>
          <div className="wd-h">{GROUP_TITLES[g]}</div>
          <div className="wd-palette-grid">
            {items.map((t) => (
              <button key={t} className="wd-pal-item" onClick={() => addBlock(t)} title={`Добавить: ${BLOCKS[t].title}`}>
                {BLOCKS[t].title}
              </button>
            ))}
          </div>
        </div>
      ))}
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

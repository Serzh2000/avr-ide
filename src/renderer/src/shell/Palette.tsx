// Командная палитра: Ctrl+Shift+P — команды, Ctrl+P — быстрый переход к файлу.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { TreeNode } from '../../../main/files/types'
import { getCommands } from './commands'
import { FileIcon } from './icons'
import { useProject } from './project'
import { useUi } from './ui'

interface Item { key: string; label: string; detail?: string; keys?: string; file?: string; run: () => void }

function flatten(nodes: TreeNode[], root: string, out: { path: string; rel: string; name: string }[] = []): typeof out {
  for (const n of nodes) {
    if (n.dir) flatten(n.children ?? [], root, out)
    else out.push({ path: n.path, name: n.name, rel: n.path.slice(root.length + 1).replace(/\\/g, '/') })
  }
  return out
}

export default function Palette(): ReactNode {
  const mode = useUi((s) => s.palette)
  const close = (): void => useUi.getState().setPalette(null)
  const tree = useProject((s) => s.tree)
  const root = useProject((s) => s.root)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => { if (mode) { setQ(mode === 'commands' ? '>' : ''); setSel(0) } }, [mode])

  const cmdMode = q.startsWith('>')
  const text = (cmdMode ? q.slice(1) : q).trim().toLowerCase()
  const tokens = text.split(/\s+/).filter(Boolean)

  const items = useMemo<Item[]>(() => {
    if (!mode) return []
    if (cmdMode) {
      return getCommands()
        .filter((c) => !c.enabled || c.enabled())
        .filter((c) => tokens.every((t) => (c.category + ' ' + c.title).toLowerCase().includes(t)))
        .map((c) => ({ key: c.id, label: c.title, detail: c.category, keys: c.keys, run: () => void c.run() }))
    }
    if (!root) return []
    return flatten(tree, root)
      .filter((f) => tokens.every((t) => f.rel.toLowerCase().includes(t)))
      .slice(0, 60)
      .map((f) => ({ key: f.path, label: f.name, detail: f.rel, file: f.name, run: () => void useProject.getState().openFile(f.path) }))
  }, [mode, cmdMode, text, tree, root]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSel(0) }, [text, cmdMode])
  useEffect(() => { list.current?.querySelector('.pal-item.sel')?.scrollIntoView({ block: 'nearest' }) }, [sel])

  if (!mode) return null
  const exec = (it: Item | undefined): void => { if (!it) return; close(); setTimeout(it.run, 0) }

  return (
    <div className="pal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="pal" role="dialog" aria-label="Командная палитра">
        <input autoFocus className="pal-input" value={q} spellCheck={false}
          placeholder={cmdMode ? 'Введите команду…' : 'Имя файла (или «>» для команд)…'}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
            else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)) }
            else if (e.key === 'Enter') exec(items[sel])
          }} />
        <div className="pal-list" ref={list} role="listbox">
          {items.map((it, i) => (
            <div key={it.key} role="option" aria-selected={i === sel} className={'pal-item' + (i === sel ? ' sel' : '')}
              onMouseMove={() => setSel(i)} onClick={() => exec(it)}>
              {it.file && <FileIcon name={it.file} />}
              <span className="pal-label">{it.label}</span>
              {it.detail && <span className="pal-detail">{it.detail}</span>}
              {it.keys && <kbd>{it.keys}</kbd>}
            </div>
          ))}
          {items.length === 0 && (
            <div className="pal-empty">{cmdMode ? 'Команды не найдены' : root ? 'Файлы не найдены' : 'Откройте проект, чтобы искать файлы. Введите «>» для команд.'}</div>
          )}
        </div>
      </div>
    </div>
  )
}

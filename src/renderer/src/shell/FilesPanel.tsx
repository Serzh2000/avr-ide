// Боковая панель «Проводник»: дерево файлов проекта с контекстным меню.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { TreeNode } from '../../../main/files/types'
import { confirmDialog } from './dialogs'
import { Icon, FileIcon } from './icons'
import { ContextMenu, EmptyState } from './kit'
import type { MenuItem } from './kit'
import { baseName, samePath } from './problems'
import { isDirty, useProject } from './project'
import { useUi } from './ui'

type Edit = { mode: 'rename'; path: string } | { mode: 'new-file' | 'new-dir'; parent: string }
interface Row { node: TreeNode; depth: number }

const sep = (p: string): string => (p.includes('\\') ? '\\' : '/')
const dirOf = (p: string): string => p.slice(0, Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/')))

function InlineInput({ initial, onDone, depth, dir }: { initial: string; onDone: (v: string | null) => void; depth: number; dir: boolean }): ReactNode {
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    const dot = initial.lastIndexOf('.')
    el.setSelectionRange(0, dot > 0 ? dot : initial.length)
  }, [initial])
  const finish = (v: string | null): void => { if (done.current) return; done.current = true; onDone(v) }
  return (
    <div className="tree-row editing" style={{ paddingLeft: 8 + depth * 14 }}>
      <span className="tree-chev" />
      {dir ? <Icon name="folder" size={14} /> : <FileIcon name={initial || 'x'} />}
      <input ref={ref} className="tree-input" defaultValue={initial} spellCheck={false}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') finish(e.currentTarget.value.trim() || null)
          if (e.key === 'Escape') finish(null)
        }}
        onBlur={(e) => finish(e.currentTarget.value.trim() && e.currentTarget.value !== initial ? e.currentTarget.value.trim() : null)} />
    </div>
  )
}

export default function FilesPanel(): ReactNode {
  const root = useProject((s) => s.root)
  const name = useProject((s) => s.name)
  const tree = useProject((s) => s.tree)
  const docs = useProject((s) => s.docs)
  const mainFile = useProject((s) => s.mainFile)
  const activeId = useProject((s) => s.activeId)
  const st = useProject
  const setNewSketch = useUi((s) => s.setNewSketch)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(null)
  const [edit, setEdit] = useState<Edit | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)

  // Сбрасываем раскрытые папки при смене проекта
  useEffect(() => { setExpanded(new Set()); setSelected(null); setEdit(null) }, [root])

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    const walk = (nodes: TreeNode[], depth: number): void => {
      for (const n of nodes) {
        out.push({ node: n, depth })
        if (n.dir && expanded.has(n.path) && n.children) walk(n.children, depth + 1)
      }
    }
    walk(tree, 0)
    return out
  }, [tree, expanded])

  const nodeAt = (p: string | null): TreeNode | null => (p ? rows.find((r) => r.node.path === p)?.node ?? null : null)

  const targetDir = (): string => {
    const n = nodeAt(selected)
    if (!n) return root!
    return n.dir ? n.path : dirOf(n.path)
  }

  const startNew = (mode: 'new-file' | 'new-dir', parent = targetDir()): void => {
    if (parent !== root) setExpanded((s) => new Set(s).add(parent))
    setEdit({ mode, parent })
  }

  const commit = async (v: string | null): Promise<void> => {
    const e = edit
    setEdit(null)
    if (!e || !v) return
    if (e.mode === 'rename') await st.getState().renameEntry(e.path, v)
    else await st.getState().createEntry(e.parent, v, e.mode === 'new-dir' ? 'dir' : 'file')
  }

  const remove = async (n: TreeNode): Promise<void> => {
    const a = await confirmDialog({
      title: `Удалить «${n.name}»?`,
      message: n.dir ? 'Папка со всем содержимым будет перемещена в корзину.' : 'Файл будет перемещён в корзину.',
      buttons: [{ id: 'del', label: 'В корзину', kind: 'danger' }, { id: 'cancel', label: 'Отмена' }]
    })
    if (a === 'del') await st.getState().deleteEntry(n.path)
  }

  const open = (n: TreeNode): void => {
    setSelected(n.path)
    if (n.dir) setExpanded((s) => { const x = new Set(s); if (x.has(n.path)) x.delete(n.path); else x.add(n.path); return x })
    else void st.getState().openFile(n.path)
  }

  const ctx = (e: React.MouseEvent, n: TreeNode | null): void => {
    e.preventDefault()
    e.stopPropagation()
    if (n) setSelected(n.path)
    const parent = n ? (n.dir ? n.path : dirOf(n.path)) : root!
    const items: MenuItem[] = [
      { label: 'Новый файл', icon: 'filePlus', onClick: () => startNew('new-file', parent) },
      { label: 'Новая папка', icon: 'folderPlus', onClick: () => startNew('new-dir', parent) }
    ]
    if (n) {
      items.push(
        { separator: true },
        { label: 'Переименовать', icon: 'edit', hint: 'F2', onClick: () => setEdit({ mode: 'rename', path: n.path }) },
        { label: 'Удалить', icon: 'trash', danger: true, hint: 'Del', onClick: () => void remove(n) },
        { separator: true },
        { label: 'Копировать путь', icon: 'copy', onClick: () => { void navigator.clipboard?.writeText(n.path); useUi.getState().notify('Путь скопирован') } }
      )
    }
    items.push({ label: 'Показать в проводнике', icon: 'external', onClick: () => void window.api.fs.reveal(n ? n.path : root!) })
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  if (!root) {
    return (
      <EmptyState icon="folderOpen" title="Проект не открыт" hint="Откройте папку со скетчем или создайте новый — файлы появятся здесь.">
        <button className="btn primary" onClick={() => setNewSketch({})}>Новый скетч</button>
        <button className="btn" onClick={() => void st.getState().pickOpen()}>Открыть папку…</button>
      </EmptyState>
    )
  }

  const rowEls: ReactNode[] = []
  const insertAt = edit && edit.mode !== 'rename' ? edit.parent : null
  if (insertAt === root) rowEls.push(<InlineInput key="new-root" initial="" depth={0} dir={edit!.mode === 'new-dir'} onDone={(v) => void commit(v)} />)
  for (const { node: n, depth } of rows) {
    const renaming = edit?.mode === 'rename' && samePath(edit.path, n.path)
    if (renaming) {
      rowEls.push(<InlineInput key={n.path} initial={n.name} depth={depth} dir={n.dir} onDone={(v) => void commit(v)} />)
    } else {
      const open_ = n.dir && expanded.has(n.path)
      rowEls.push(
        <div key={n.path} className={'tree-row' + (selected === n.path ? ' selected' : '') + (activeId === n.path ? ' current' : '') + (n.path === mainFile ? ' main' : '')}
          style={{ paddingLeft: 8 + depth * 14 }} onClick={() => open(n)} onContextMenu={(e) => ctx(e, n)}
          title={n.path === mainFile ? `${n.name} — главный файл скетча` : n.path}>
          <span className="tree-chev">{n.dir && <Icon name={open_ ? 'chevD' : 'chevR'} size={12} />}</span>
          {n.dir ? <Icon name={open_ ? 'folderOpen' : 'folder'} size={14} /> : <FileIcon name={n.name} />}
          <span className="tree-name">{n.name}</span>
          {!n.dir && isDirty(docs[n.path]) && <span className="dirty-dot" title="Есть несохранённые изменения" />}
        </div>
      )
    }
    if (n.dir && insertAt === n.path) rowEls.push(<InlineInput key={'new-' + n.path} initial="" depth={depth + 1} dir={edit!.mode === 'new-dir'} onDone={(v) => void commit(v)} />)
  }

  return (
    <div className="files-panel">
      <div className="side-title">
        <span className="grow" title={root}>{name}</span>
        <button className="icon-btn" title="Новый файл" onClick={() => startNew('new-file')}><Icon name="filePlus" size={15} /></button>
        <button className="icon-btn" title="Новая папка" onClick={() => startNew('new-dir')}><Icon name="folderPlus" size={15} /></button>
        <button className="icon-btn" title="Обновить дерево" onClick={() => void st.getState().refreshTree()}><Icon name="refresh" size={15} /></button>
        <button className="icon-btn" title="Свернуть все папки" onClick={() => setExpanded(new Set())}><Icon name="collapse" size={15} /></button>
      </div>
      <div className="tree" tabIndex={0} role="tree" aria-label="Файлы проекта" onContextMenu={(e) => ctx(e, null)}
        onClick={(e) => { if (e.target === e.currentTarget) setSelected(null) }}
        onKeyDown={(e) => {
          const n = nodeAt(selected)
          if (e.key === 'F2' && n) setEdit({ mode: 'rename', path: n.path })
          else if (e.key === 'Delete' && n) void remove(n)
          else if (e.key === 'Enter' && n) open(n)
        }}>
        {rowEls}
        {tree.length === 0 && !edit && <div className="tree-empty">Папка пуста. Нажмите «+» вверху, чтобы создать файл.</div>}
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  )
}

export { baseName }

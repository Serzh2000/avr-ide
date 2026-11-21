// Переходы редактора Pro между файлами: файл проекта открывается как обычно, заголовок CMSIS/HAL вне папки проекта — во вкладке «только чтение».
// Применение переименования: запись файлов на диск и обновление открытых вкладок.
import { create } from 'zustand'
import { useProject } from '../../shell/project'
import { normPath, samePath } from '../../shell/problems'
import { useUi } from '../../shell/ui'
import { sym } from './proClient'

/** Пути вкладок, открытых только для чтения (заголовки вне папки проекта). */
export const useExternal = create<{ paths: Record<string, true> }>(() => ({ paths: {} }))

const sepOf = (root: string): string => (root.includes('\\') ? '\\' : '/')

export async function openLocation(loc: { path: string; line: number; column?: number }): Promise<void> {
  const st = useProject.getState()
  const at = { line: loc.line, column: loc.column }
  // уже открытый документ
  const known = Object.keys(st.docs).find((k) => samePath(k, loc.path))
  if (known) { await st.openFile(known, at); return }
  const root = st.root
  if (root) {
    const r = normPath(root).replace(/\/$/, '') + '/'
    if (normPath(loc.path).startsWith(r)) {
      const rel = loc.path.replace(/\\/g, '/').slice(r.length)
      await st.openFile(root.replace(/[\\/]+$/, '') + sepOf(root) + rel.split('/').join(sepOf(root)), at)
      return
    }
  }
  // заголовок вне проекта: читаем через индекс (только файлы, которые в нём есть)
  const res = await sym<{ text: string }>('read', { path: loc.path })
  if (!res) { useUi.getState().notify('Не удалось открыть заголовок: он не входит в индекс проекта.'); return }
  useExternal.setState((s) => ({ paths: { ...s.paths, [loc.path]: true } }))
  useProject.setState((s) => ({
    docs: { ...s.docs, [loc.path]: { content: res.text, saved: res.text, mtime: 0 } },
    tabs: s.tabs.some((t) => t.id === loc.path) ? s.tabs : [...s.tabs, { id: loc.path, kind: 'file', path: loc.path }],
    activeId: loc.path,
    reveal: { path: loc.path, line: loc.line, column: loc.column, nonce: Date.now() }
  }))
}

/** Записывает изменённые тексты (переименование): на диск и в открытые документы. */
export async function applyEdits(files: { path: string; text: string }[]): Promise<void> {
  const st = useProject.getState()
  for (const f of files) {
    const key = Object.keys(st.docs).find((k) => samePath(k, f.path))
    let native = key
    if (!native && st.root) {
      const r = normPath(st.root).replace(/\/$/, '') + '/'
      const rel = f.path.replace(/\\/g, '/').slice(r.length)
      native = st.root.replace(/[\\/]+$/, '') + sepOf(st.root) + rel.split('/').join(sepOf(st.root))
    }
    if (!native) continue
    const w = await window.api.fs.write(native, f.text)
    if (!w.ok) { useUi.getState().notify(`Не удалось записать ${native}: ${w.error}`); continue }
    const mtime = w.data.mtime
    if (key) useProject.setState((s) => ({ docs: { ...s.docs, [key]: { content: f.text, saved: f.text, mtime } } }))
  }
  void useProject.getState().refreshTree()
  useUi.getState().notify(`Переименовано: изменено файлов — ${files.length}.`)
}

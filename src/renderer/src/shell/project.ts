// Проект: открытая папка, дерево файлов, открытые документы и вкладки.
import { create } from 'zustand'
import type { ProjectInfo, RecentItem, TemplateInfo, TreeNode } from '../../../main/files/types'
import { confirmDialog } from './dialogs'
import { lsGet, lsSet, useUi } from './ui'
import { baseName, normPath, samePath } from './problems'

export type TabKind = 'file' | 'ref' | 'ui' | 'web' | 'settings' | 'welcome'
export interface Tab { id: string; kind: TabKind; path?: string }
export interface Doc { content: string; saved: string; mtime: number }
export interface Reveal { path: string; line: number; column?: number; nonce: number }

const SESSION_KEY = 'avride.session.v1'

interface ProjectStore {
  root: string | null
  name: string
  mainFile: string | null
  tree: TreeNode[]
  docs: Record<string, Doc>
  tabs: Tab[]
  activeId: string | null
  recent: RecentItem[]
  templates: TemplateInfo[]
  refQuery: string
  reveal: Reveal | null
  ready: boolean

  init: () => Promise<void>
  refreshRecent: () => Promise<void>
  pickOpen: () => Promise<void>
  pickOpenFile: () => Promise<void>
  openRecent: (path: string) => Promise<void>
  createSketch: (template: string, name: string, parent?: string) => Promise<string | null>
  closeProject: () => Promise<void>
  refreshTree: () => Promise<void>

  openFile: (path: string, at?: { line: number; column?: number }) => Promise<void>
  openPanel: (kind: Exclude<TabKind, 'file'>, query?: string) => void
  activate: (id: string) => void
  closeTab: (id: string) => Promise<boolean>
  closeMany: (ids: string[]) => Promise<void>
  cycleTab: (dir: 1 | -1) => void

  setContent: (path: string, content: string) => void
  saveFile: (path: string) => Promise<boolean>
  saveAll: () => Promise<boolean>
  hasDirty: () => boolean
  confirmDiscard: () => Promise<boolean>

  createEntry: (dir: string, name: string, kind: 'file' | 'dir') => Promise<boolean>
  renameEntry: (path: string, newName: string) => Promise<boolean>
  deleteEntry: (path: string) => Promise<boolean>
  syncFromDisk: () => Promise<void>
}

const fail = (text: string): void => useUi.getState().notify(text)

export const isDirty = (d: Doc | undefined): boolean => !!d && d.content !== d.saved

export const useProject = create<ProjectStore>((set, get) => {
  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

  /** Сбрасывает всё, связанное с прежним проектом. */
  const reset = (): void => {
    saveTimers.forEach((t) => clearTimeout(t))
    saveTimers.clear()
    set((s) => ({
      root: null, name: '', mainFile: null, tree: [], docs: {},
      tabs: s.tabs.filter((t) => t.kind !== 'file'),
      activeId: s.tabs.some((t) => t.id === s.activeId && t.kind !== 'file') ? s.activeId : null
    }))
  }

  const loadDoc = async (path: string): Promise<boolean> => {
    const r = await window.api.fs.read(path)
    if (!r.ok) { fail(r.error); return false }
    set((s) => ({ docs: { ...s.docs, [path]: { content: r.data.content, saved: r.data.content, mtime: r.data.mtime } } }))
    return true
  }

  const applyProject = async (info: ProjectInfo, openPath?: string | null): Promise<void> => {
    reset()
    set({ root: info.root, name: info.name, mainFile: info.mainFile })
    await get().refreshTree()
    if (info.mainFile) await loadDoc(info.mainFile)
    const first = openPath ?? info.mainFile
    if (first) await get().openFile(first)
    void get().refreshRecent()
  }

  return {
    root: null, name: '', mainFile: null, tree: [], docs: {}, tabs: [], activeId: null,
    recent: [], templates: [], refQuery: '', reveal: null, ready: false,

    init: async () => {
      const t = await window.api.project.templates()
      if (t.ok) set({ templates: t.data })
      await get().refreshRecent()
      // Восстановление прошлой сессии: проект и открытые вкладки
      try {
        const raw = lsGet(SESSION_KEY)
        if (raw) {
          const s = JSON.parse(raw) as { root: string | null; tabs: Tab[]; active: string | null }
          if (s.root) {
            const r = await window.api.project.open(s.root)
            if (r.ok) {
              reset()
              set({ root: r.data.root, name: r.data.name, mainFile: r.data.mainFile })
              await get().refreshTree()
              if (r.data.mainFile) await loadDoc(r.data.mainFile)
              const wanted = (s.tabs ?? []).filter((x) => x && typeof x.id === 'string')
              const tabs: Tab[] = []
              for (const tab of wanted) {
                if (tab.kind === 'file') {
                  if (tab.path && (get().docs[tab.path] || (await loadDoc(tab.path)))) tabs.push(tab)
                } else tabs.push({ id: tab.kind, kind: tab.kind })
              }
              set({ tabs, activeId: tabs.some((x) => x.id === s.active) ? s.active : tabs[0]?.id ?? null })
            }
          } else {
            const tabs = (s.tabs ?? []).filter((x) => x.kind !== 'file' && x.kind !== 'welcome').map((x) => ({ id: x.kind, kind: x.kind }))
            set({ tabs, activeId: tabs.some((x) => x.id === s.active) ? s.active : tabs[0]?.id ?? null })
          }
        }
      } catch { /* повреждённая сессия — начинаем с чистого листа */ }
      set({ ready: true })
    },

    refreshRecent: async () => {
      const r = await window.api.project.recent()
      if (r.ok) set({ recent: r.data })
    },

    pickOpen: async () => {
      if (!(await get().confirmDiscard())) return
      const r = await window.api.project.pickOpen()
      if (!r.ok) return fail(r.error)
      if (r.data) await applyProject(r.data)
    },

    pickOpenFile: async () => {
      if (!(await get().confirmDiscard())) return
      const r = await window.api.project.pickFile()
      if (!r.ok) return fail(r.error)
      if (r.data) await applyProject(r.data.project, r.data.file)
    },

    openRecent: async (path) => {
      if (get().root && samePath(get().root!, path)) return
      if (!(await get().confirmDiscard())) return
      const r = await window.api.project.open(path)
      if (!r.ok) {
        fail(r.error)
        await window.api.project.removeRecent(path)
        return get().refreshRecent()
      }
      await applyProject(r.data)
    },

    createSketch: async (template, name, parent) => {
      if (!(await get().confirmDiscard())) return null
      const r = await window.api.project.create(template, name, parent)
      if (!r.ok) return r.error
      await applyProject(r.data)
      return null
    },

    closeProject: async () => {
      if (!(await get().confirmDiscard())) return
      await window.api.project.close()
      reset()
    },

    refreshTree: async () => {
      if (!get().root) return
      const r = await window.api.project.tree()
      if (r.ok) set({ tree: r.data })
    },

    openFile: async (path, at) => {
      if (!get().docs[path] && !(await loadDoc(path))) return
      set((s) => ({
        tabs: s.tabs.some((t) => t.id === path) ? s.tabs : [...s.tabs, { id: path, kind: 'file', path }],
        activeId: path,
        reveal: at ? { path, line: at.line, column: at.column, nonce: Date.now() } : s.reveal
      }))
    },

    openPanel: (kind, query) => {
      set((s) => ({
        tabs: s.tabs.some((t) => t.id === kind) ? s.tabs : [...s.tabs, { id: kind, kind }],
        activeId: kind,
        refQuery: kind === 'ref' && query !== undefined ? query : s.refQuery
      }))
    },

    activate: (id) => set({ activeId: id }),

    closeTab: async (id) => {
      const tab = get().tabs.find((t) => t.id === id)
      if (!tab) return true
      if (tab.kind === 'file' && tab.path) {
        const d = get().docs[tab.path]
        if (isDirty(d)) {
          const a = await confirmDialog({
            title: `Сохранить изменения в «${baseName(tab.path)}»?`,
            message: 'Если не сохранить, изменения будут потеряны.',
            buttons: [{ id: 'save', label: 'Сохранить', kind: 'primary' }, { id: 'discard', label: 'Не сохранять', kind: 'danger' }, { id: 'cancel', label: 'Отмена' }]
          })
          if (a === null || a === 'cancel') return false
          if (a === 'save' && !(await get().saveFile(tab.path))) return false
        }
      }
      set((s) => {
        const tabs = s.tabs.filter((t) => t.id !== id)
        let activeId = s.activeId
        if (activeId === id) {
          const i = s.tabs.findIndex((t) => t.id === id)
          activeId = tabs[Math.min(i, tabs.length - 1)]?.id ?? null
        }
        const docs = { ...s.docs }
        if (tab.path && tab.path !== s.mainFile) delete docs[tab.path]
        else if (tab.path && docs[tab.path]) docs[tab.path] = { ...docs[tab.path], content: docs[tab.path].saved }
        return { tabs, activeId, docs }
      })
      return true
    },

    closeMany: async (ids) => {
      for (const id of ids) if (!(await get().closeTab(id))) return
    },

    cycleTab: (dir) => {
      const { tabs, activeId } = get()
      if (tabs.length < 2) return
      const i = tabs.findIndex((t) => t.id === activeId)
      set({ activeId: tabs[(i + dir + tabs.length) % tabs.length].id })
    },

    setContent: (path, content) => {
      const d = get().docs[path]
      if (!d || d.content === content) return
      set((s) => ({ docs: { ...s.docs, [path]: { ...d, content } } }))
      if (useUi.getState().settings.autosave) {
        clearTimeout(saveTimers.get(path))
        saveTimers.set(path, setTimeout(() => { void get().saveFile(path) }, 1000))
      }
    },

    saveFile: async (path) => {
      const d = get().docs[path]
      if (!d) return false
      const content = d.content
      const r = await window.api.fs.write(path, content)
      if (!r.ok) { fail(r.error); return false }
      set((s) => (s.docs[path] ? { docs: { ...s.docs, [path]: { ...s.docs[path], saved: content, mtime: r.data.mtime } } } : {}))
      return true
    },

    saveAll: async () => {
      let allOk = true
      for (const [p, d] of Object.entries(get().docs)) if (isDirty(d) && !(await get().saveFile(p))) allOk = false
      return allOk
    },

    hasDirty: () => Object.values(get().docs).some(isDirty),

    /** Перед закрытием проекта/приложения: предлагает сохранить. false — пользователь отменил. */
    confirmDiscard: async () => {
      const dirty = Object.entries(get().docs).filter(([, d]) => isDirty(d)).map(([p]) => baseName(p))
      if (!dirty.length) return true
      const a = await confirmDialog({
        title: 'Есть несохранённые изменения',
        message: `Не сохранены: ${dirty.join(', ')}.`,
        buttons: [{ id: 'save', label: 'Сохранить всё', kind: 'primary' }, { id: 'discard', label: 'Не сохранять', kind: 'danger' }, { id: 'cancel', label: 'Отмена' }]
      })
      if (a === null || a === 'cancel') return false
      if (a === 'save') return get().saveAll()
      return true
    },

    createEntry: async (dir, name, kind) => {
      const path = dir.replace(/[\\/]+$/, '') + (dir.includes('\\') ? '\\' : '/') + name
      const r = await window.api.fs.create(path, kind)
      if (!r.ok) { fail(r.error); return false }
      await get().refreshTree()
      if (kind === 'file') await get().openFile(r.data)
      return true
    },

    renameEntry: async (path, newName) => {
      const r = await window.api.fs.rename(path, newName)
      if (!r.ok) { fail(r.error); return false }
      const to = r.data
      const from = normPath(path)
      const remap = (p: string): string => {
        const n = normPath(p)
        return n === from ? to : n.startsWith(from + '/') ? to + p.slice(path.length) : p
      }
      set((s) => {
        const docs: Record<string, Doc> = {}
        for (const [p, d] of Object.entries(s.docs)) docs[remap(p)] = d
        const tabs = s.tabs.map((t) => (t.path ? { ...t, id: remap(t.path), path: remap(t.path) } : t))
        return { docs, tabs, activeId: s.activeId ? remap(s.activeId) : null, mainFile: s.mainFile ? remap(s.mainFile) : null }
      })
      await get().refreshTree()
      return true
    },

    deleteEntry: async (path) => {
      const r = await window.api.fs.trash(path)
      if (!r.ok) { fail(r.error); return false }
      const from = normPath(path)
      const gone = (p: string): boolean => { const n = normPath(p); return n === from || n.startsWith(from + '/') }
      set((s) => {
        const docs = Object.fromEntries(Object.entries(s.docs).filter(([p]) => !gone(p)))
        const tabs = s.tabs.filter((t) => !(t.path && gone(t.path)))
        const activeId = tabs.some((t) => t.id === s.activeId) ? s.activeId : tabs[tabs.length - 1]?.id ?? null
        return { docs, tabs, activeId, mainFile: s.mainFile && gone(s.mainFile) ? null : s.mainFile }
      })
      await get().refreshTree()
      return true
    },

    /** При возврате в окно: подхватываем изменения на диске (несохранённые правки не трогаем). */
    syncFromDisk: async () => {
      if (!get().root) return
      await get().refreshTree()
      const docs = get().docs
      const paths = Object.keys(docs)
      if (!paths.length) return
      const r = await window.api.fs.mtimes(paths)
      if (!r.ok) return
      for (const p of paths) {
        const m = r.data[p]
        const d = get().docs[p]
        if (!d || m == null || m === d.mtime || isDirty(d)) continue
        await loadDoc(p)
      }
    }
  }
})

// Сохранение сессии (проект и вкладки)
let sessTimer: ReturnType<typeof setTimeout> | undefined
useProject.subscribe((s) => {
  if (!s.ready) return
  clearTimeout(sessTimer)
  sessTimer = setTimeout(() => {
    lsSet(SESSION_KEY, JSON.stringify({ root: s.root, tabs: s.tabs, active: s.activeId }))
  }, 300)
})

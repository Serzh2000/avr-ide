import { create } from 'zustand'
import {
  TEMPLATES, addBlock, allIds, cloneBlock, createBlock, createDefaultProject, findBlock, findParent, isContainer,
  moveBlock, parseProject, removeBlock, serializeProject, shiftBlock, uniqueId
} from './core/index'
import type { Binding, Block, BlockProps, BlockStyle, BlockType, Platform, ResponsiveOverride, WdProject } from './core/index'

const STORAGE_KEY = 'avride.webdesign.project.v1'

export type BottomTab = 'vars' | 'theme' | 'page' | 'html' | 'css' | 'js' | 'cpp' | 'issues' | 'json'
export type RightTab = 'props' | 'style' | 'bind'
export type DeviceView = 'desktop' | 'tablet' | 'mobile'
export type ThemeView = 'auto' | 'light' | 'dark'

function loadInitial(): WdProject {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const r = parseProject(raw)
      if (r.ok) return r.project
    }
  } catch {
    /* localStorage недоступен — работаем без сохранения */
  }
  return TEMPLATES[0].build('esp32')
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
function persist(p: WdProject): void {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serializeProject(p))
    } catch {
      /* квота/запрет — не критично */
    }
  }, 400)
}

interface State {
  project: WdProject
  selected: string | null
  bottom: BottomTab
  right: RightTab
  device: DeviceView
  themeView: ThemeView
  interactive: boolean

  setBottom: (t: BottomTab) => void
  setRight: (t: RightTab) => void
  setDevice: (d: DeviceView) => void
  setThemeView: (t: ThemeView) => void
  setInteractive: (v: boolean) => void
  select: (id: string | null) => void

  mutate: (fn: (p: WdProject) => void) => void
  setPlatform: (p: Platform) => void
  addBlock: (type: BlockType) => void
  removeBlock: (id: string) => void
  duplicateBlock: (id: string) => void
  shift: (id: string, delta: number) => void
  moveInto: (id: string, parentId: string | null) => void
  patchBlock: (id: string, fn: (b: Block) => void) => void
  patchProps: (id: string, patch: Partial<BlockProps>) => void
  patchStyle: (id: string, patch: Partial<BlockStyle>) => void
  patchResponsive: (id: string, bp: 'tablet' | 'mobile', patch: Partial<ResponsiveOverride>) => void
  setBinding: (id: string, b: Binding) => void
  renameBlock: (id: string, newId: string) => void
  loadTemplate: (id: string) => void
  newProject: () => void
  importJson: (text: string) => string | null
}

/** Удаляет ключи со значением undefined (в JSON они не нужны). */
function assignDefined<T extends object>(target: T, patch: Partial<T>): void {
  for (const k of Object.keys(patch) as Array<keyof T>) {
    if (patch[k] === undefined) delete target[k]
    else target[k] = patch[k] as T[keyof T]
  }
}

export const useWebDesigner = create<State>((set, get) => {
  const apply = (fn: (p: WdProject) => void, keepSelection = true): void => {
    const p = JSON.parse(JSON.stringify(get().project)) as WdProject
    fn(p)
    persist(p)
    const sel = get().selected
    set({ project: p, selected: keepSelection && sel && findBlock(p, sel) ? sel : null })
  }
  return {
    project: loadInitial(),
    selected: null,
    bottom: 'vars',
    right: 'props',
    device: 'desktop',
    themeView: 'auto',
    interactive: false,

    setBottom: (bottom) => set({ bottom }),
    setRight: (right) => set({ right }),
    setDevice: (device) => set({ device }),
    setThemeView: (themeView) => set({ themeView }),
    setInteractive: (interactive) => set({ interactive }),
    select: (selected) => set({ selected }),

    mutate: (fn) => apply(fn),
    setPlatform: (platform) => apply((p) => { p.platform = platform }),

    addBlock: (type) => {
      const sel = get().selected
      apply((p) => {
        const id = uniqueId(p, type)
        const b = createBlock(type, id)
        let parentId: string | null = null
        let index: number | undefined
        const cur = sel ? findBlock(p, sel) : null
        if (type === 'section') {
          // секции — только верхний уровень, после выбранной секции
          let top = cur
          while (top && findParent(p, top.id)) top = findParent(p, top.id)
          index = top ? p.blocks.findIndex((x) => x.id === top!.id) + 1 : undefined
        } else if (cur && isContainer(cur.type)) parentId = cur.id
        else if (cur) {
          const par = findParent(p, cur.id)
          parentId = par ? par.id : null
          const list = par ? par.children : p.blocks
          index = list.findIndex((x) => x.id === cur.id) + 1
        } else {
          const last = p.blocks[p.blocks.length - 1]
          parentId = last ? last.id : null
        }
        addBlock(p, b, parentId, index)
        set({ selected: id })
      })
    },
    removeBlock: (id) => apply((p) => { removeBlock(p, id) }),
    duplicateBlock: (id) => {
      let newId: string | null = null
      apply((p) => {
        const b = findBlock(p, id)
        if (!b) return
        const copy = cloneBlock(p, b)
        newId = copy.id
        const par = findParent(p, id)
        const list = par ? par.children : p.blocks
        list.splice(list.findIndex((x) => x.id === id) + 1, 0, copy)
      })
      if (newId) set({ selected: newId })
    },
    shift: (id, delta) => apply((p) => shiftBlock(p, id, delta)),
    moveInto: (id, parentId) => apply((p) => { moveBlock(p, id, parentId) }),
    patchBlock: (id, fn) => apply((p) => { const b = findBlock(p, id); if (b) fn(b) }),
    patchProps: (id, patch) => apply((p) => { const b = findBlock(p, id); if (b) assignDefined(b.props, patch) }),
    patchStyle: (id, patch) => apply((p) => { const b = findBlock(p, id); if (b) assignDefined(b.style, patch) }),
    patchResponsive: (id, bp, patch) =>
      apply((p) => {
        const b = findBlock(p, id)
        if (!b) return
        b.responsive = b.responsive ?? {}
        const cur = (b.responsive[bp] = b.responsive[bp] ?? {})
        assignDefined(cur, patch)
      }),
    setBinding: (id, binding) => apply((p) => { const b = findBlock(p, id); if (b) b.binding = binding }),
    renameBlock: (id, newId) => {
      if (!newId || newId === id) return
      let ok = false
      apply((p) => {
        if (allIds(p).has(newId)) return
        const b = findBlock(p, id)
        if (b) { b.id = newId; ok = true }
      })
      if (ok) set({ selected: newId })
    },
    loadTemplate: (id) => {
      const t = TEMPLATES.find((x) => x.id === id)
      if (!t) return
      const p = t.build(get().project.platform)
      persist(p)
      set({ project: p, selected: null })
    },
    newProject: () => {
      const p = createDefaultProject(get().project.platform)
      persist(p)
      set({ project: p, selected: null })
    },
    importJson: (text) => {
      const r = parseProject(text)
      if (!r.ok) return r.error
      persist(r.project)
      set({ project: r.project, selected: null })
      return null
    }
  }
})

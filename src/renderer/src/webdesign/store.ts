import { create } from 'zustand'
import {
  TEMPLATES, addBlock, allIds, canContain, cloneBlock, createBlockTree, createDefaultProject, findBlock, findParent,
  moveBlock, parseProject, removeBlock, serializeProject, shiftBlock, uniqueId
} from './core/index'
import type { Binding, Block, BlockProps, BlockStyle, BlockType, Platform, ResponsiveOverride, WdProject } from './core/index'

const STORAGE_KEY = 'avride.webdesign.project.v1'
const UI_KEY = 'avride.webdesign.ui.v1'

interface UiPrefs {
  open: boolean
  height: number
  bottom: string
}
function loadPrefs(): UiPrefs {
  try {
    const r = JSON.parse(localStorage.getItem(UI_KEY) ?? '{}') as Partial<UiPrefs>
    return {
      open: r.open === true,
      height: typeof r.height === 'number' && r.height >= 120 && r.height <= 2000 ? r.height : 320,
      bottom: typeof r.bottom === 'string' ? r.bottom : 'vars'
    }
  } catch {
    return { open: false, height: 320, bottom: 'vars' }
  }
}
function savePrefs(p: UiPrefs): void {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(p))
  } catch {
    /* не критично */
  }
}
const prefs0 = loadPrefs()

/** Раскладка боковых панелей (ширины, вкладка и свёрнутость левой панели) — отдельный ключ, чтобы не трогать прочие настройки. */
const LAYOUT_KEY = 'avride.webdesign.layout.v1'
export type LeftTab = 'blocks' | 'tree'
interface LayoutPrefs {
  leftWidth: number
  rightWidth: number
  leftCollapsed: boolean
  leftTab: LeftTab
}
const LAYOUT_DEFAULT: LayoutPrefs = { leftWidth: 264, rightWidth: 330, leftCollapsed: false, leftTab: 'blocks' }
export const LEFT_RANGE = { min: 200, max: 480 }
export const RIGHT_RANGE = { min: 280, max: 560 }
const clampN = (n: number, a: number, b: number): number => Math.min(b, Math.max(a, Math.round(n)))
function loadLayout(): LayoutPrefs {
  try {
    const r = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '{}') as Partial<LayoutPrefs>
    return {
      leftWidth: typeof r.leftWidth === 'number' ? clampN(r.leftWidth, LEFT_RANGE.min, LEFT_RANGE.max) : LAYOUT_DEFAULT.leftWidth,
      rightWidth: typeof r.rightWidth === 'number' ? clampN(r.rightWidth, RIGHT_RANGE.min, RIGHT_RANGE.max) : LAYOUT_DEFAULT.rightWidth,
      leftCollapsed: r.leftCollapsed === true,
      leftTab: r.leftTab === 'tree' ? 'tree' : 'blocks'
    }
  } catch {
    return LAYOUT_DEFAULT
  }
}
function saveLayout(l: LayoutPrefs): void {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(l))
  } catch {
    /* не критично */
  }
}
const layout0 = loadLayout()

export type BottomTab = 'vars' | 'theme' | 'page' | 'html' | 'css' | 'js' | 'cpp' | 'issues' | 'json'
export type RightTab = 'content' | 'look' | 'layout' | 'bind' | 'fx'
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

const pickLayout = (s: LayoutPrefs): LayoutPrefs => ({ leftWidth: s.leftWidth, rightWidth: s.rightWidth, leftCollapsed: s.leftCollapsed, leftTab: s.leftTab })

interface State {
  project: WdProject
  selected: string | null
  bottom: BottomTab
  /** Нижний выдвижной ящик: открыт ли и его высота, px. */
  drawerOpen: boolean
  drawerHeight: number
  right: RightTab
  /** Ширины боковых панелей, px; левая панель может быть свёрнута в узкую полосу. */
  leftWidth: number
  rightWidth: number
  leftCollapsed: boolean
  leftTab: LeftTab
  setLeftWidth: (w: number) => void
  setRightWidth: (w: number) => void
  setLeftCollapsed: (v: boolean) => void
  setLeftTab: (t: LeftTab) => void
  /** Узкое окно: инспектор выдвигается поверх превью. */
  inspectorOpen: boolean
  setInspectorOpen: (v: boolean) => void
  /** Страница сайта, показанная в превью (пусто — первая). */
  currentPage: string
  /** Поле инспектора, найденное поиском (подсвечивается). */
  highlight: { fid: string; n: number } | null
  device: DeviceView
  themeView: ThemeView
  interactive: boolean

  setBottom: (t: BottomTab) => void
  /** Клик по вкладке ящика: открыть её; повторный клик по активной — свернуть. */
  toggleDrawer: (t: BottomTab) => void
  setDrawerHeight: (h: number) => void
  closeDrawer: () => void
  setRight: (t: RightTab) => void
  setCurrentPage: (id: string) => void
  setHighlight: (fid: string | null) => void
  addPage: () => void
  patchPage: (id: string, patch: { id?: string; title?: string }) => void
  removePage: (id: string) => void
  setBlockPage: (id: string, page: string | undefined) => void
  /** Переместить блок в соседний контейнер (prev — предыдущий сосед) или вынести на уровень выше. */
  nest: (id: string, dir: 'into' | 'out') => void
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
    bottom: prefs0.bottom as BottomTab,
    drawerOpen: prefs0.open,
    drawerHeight: prefs0.height,
    right: 'content',
    ...layout0,
    setLeftWidth: (w) => { set({ leftWidth: clampN(w, LEFT_RANGE.min, LEFT_RANGE.max) }); saveLayout(pickLayout(get())) },
    setRightWidth: (w) => { set({ rightWidth: clampN(w, RIGHT_RANGE.min, RIGHT_RANGE.max) }); saveLayout(pickLayout(get())) },
    setLeftCollapsed: (leftCollapsed) => { set({ leftCollapsed }); saveLayout(pickLayout(get())) },
    setLeftTab: (leftTab) => { set({ leftTab, leftCollapsed: false }); saveLayout(pickLayout(get())) },
    inspectorOpen: false,
    setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
    currentPage: '',
    highlight: null,
    device: 'desktop',
    themeView: 'auto',
    interactive: false,

    setBottom: (bottom) => {
      set({ bottom, drawerOpen: true })
      savePrefs({ open: true, height: get().drawerHeight, bottom })
    },
    toggleDrawer: (t) => {
      const s = get()
      const open = !(s.drawerOpen && s.bottom === t)
      set({ bottom: t, drawerOpen: open })
      savePrefs({ open, height: s.drawerHeight, bottom: t })
    },
    setDrawerHeight: (h) => {
      const height = Math.max(120, Math.min(1200, Math.round(h)))
      set({ drawerHeight: height })
      savePrefs({ open: get().drawerOpen, height, bottom: get().bottom })
    },
    closeDrawer: () => {
      set({ drawerOpen: false })
      savePrefs({ open: false, height: get().drawerHeight, bottom: get().bottom })
    },
    setRight: (right) => set({ right }),
    setCurrentPage: (currentPage) => set({ currentPage }),
    setHighlight: (fid) => set({ highlight: fid ? { fid, n: Date.now() } : null }),
    addPage: () => {
      let n = 1
      apply((p) => {
        while (p.pages.some((x) => x.id === `page${n}`)) n++
        p.pages.push({ id: `page${n}`, title: `Страница ${p.pages.length + 1}` })
      })
      set({ currentPage: `page${n}` })
    },
    patchPage: (id, patch) =>
      apply((p) => {
        const pg = p.pages.find((x) => x.id === id)
        if (!pg) return
        if (patch.title !== undefined) pg.title = patch.title
        if (patch.id !== undefined && patch.id !== id && patch.id && !p.pages.some((x) => x.id === patch.id)) {
          const nid = patch.id
          pg.id = nid
          for (const b of p.blocks) if (b.page === id) b.page = nid
          const rec = (l: Block[]): void => { for (const b of l) { if (b.props.page === id) b.props.page = nid; rec(b.children) } }
          rec(p.blocks)
        }
      }),
    removePage: (id) =>
      apply((p) => {
        if (p.pages.length < 2) return
        p.pages = p.pages.filter((x) => x.id !== id)
        for (const b of p.blocks) if (b.page === id) delete b.page
      }),
    setBlockPage: (id, page) =>
      apply((p) => {
        const b = p.blocks.find((x) => x.id === id)
        if (!b) return
        if (page === undefined) delete b.page
        else b.page = page
      }),
    nest: (id, dir) =>
      apply((p) => {
        const par = findParent(p, id)
        const list = par ? par.children : p.blocks
        const i = list.findIndex((x) => x.id === id)
        const me = list[i]
        if (!me) return
        if (dir === 'into') {
          for (let k = i - 1; k >= 0; k--) {
            if (canContain(list[k].type, me.type)) {
              moveBlock(p, id, list[k].id)
              return
            }
          }
        } else if (par) {
          const gp = findParent(p, par.id)
          const gl = gp ? gp.children : p.blocks
          if (gp ? canContain(gp.type, me.type) : me.type !== 'panel') {
            const idx = gl.findIndex((x) => x.id === par.id) + 1
            moveBlock(p, id, gp ? gp.id : null, idx)
          }
        }
      }),
    setDevice: (device) => set({ device }),
    setThemeView: (themeView) => set({ themeView }),
    setInteractive: (interactive) => set({ interactive }),
    select: (selected) => set({ selected, ...(selected ? { inspectorOpen: true } : {}) }),

    mutate: (fn) => apply(fn),
    setPlatform: (platform) => apply((p) => { p.platform = platform }),

    addBlock: (type) => {
      const sel = get().selected
      let newId: string | null = null
      apply((p) => {
        const b = createBlockTree(p, type)
        let parentId: string | null = null
        let index: number | undefined
        const cur = sel ? findBlock(p, sel) : null
        if (type === 'section') {
          let top = cur
          while (top && findParent(p, top.id)) top = findParent(p, top.id)
          index = top ? p.blocks.findIndex((x) => x.id === top!.id) + 1 : undefined
        } else {
          // ближайший подходящий контейнер: сам выбранный блок или его предок; иначе — последняя секция
          let host: Block | null = cur
          while (host && !canContain(host.type, type)) host = findParent(p, host.id)
          if (host) {
            parentId = host.id
            if (host !== cur && cur) {
              // вставить после ветки, в которой лежит выбранный блок
              let branch: Block = cur
              while (findParent(p, branch.id) && findParent(p, branch.id)!.id !== host.id) branch = findParent(p, branch.id) as Block
              index = host.children.findIndex((x) => x.id === branch.id) + 1
            }
          } else if (type === 'panel') {
            return
          } else {
            const last = p.blocks.filter((x) => x.type === 'section').pop()
            parentId = last ? last.id : null
          }
        }
        if (parentId === null && type !== 'section' && p.blocks.length === 0 && type !== 'navbar' && type !== 'footer') {
          const sec = createBlockTree(p, 'section')
          addBlock(p, sec, null)
          parentId = sec.id
          b.id = uniqueId(p, type)
        }
        const target = parentId ? findBlock(p, parentId) : null
        if (target && target.type === 'section' && !target.page && p.pages.length > 1 && get().currentPage) target.page = get().currentPage
        if (!parentId && p.pages.length > 1 && get().currentPage && b.type !== 'navbar' && b.type !== 'footer') b.page = get().currentPage
        addBlock(p, b, parentId, index)
        newId = b.id
      })
      if (newId) set({ selected: newId })
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

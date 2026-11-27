import { create } from 'zustand'
import {
  TEMPLATES, addBlock, allIds, canContain, cloneBlock, createBlockTree, createDefaultProject, findBlock, findParent,
  moveBlock, parseProject, removeBlock, serializeProject, shiftBlock, uniqueId
} from './core/index'
import type { Binding, Block, BlockProps, BlockStyle, BlockType, Platform, ResponsiveOverride, WdProject } from './core/index'

const STORAGE_KEY = 'avride.webdesign.project.v1'
let projectScoped = false
/** Раскладка боковых панелей (ширины, вкладка и свёрнутость левой панели) — отдельный ключ, чтобы не трогать прочие настройки. */
const LAYOUT_KEY = 'avride.webdesign.layout.v1'
export type LeftTab = 'blocks' | 'tree'
interface LayoutPrefs {
  leftWidth: number
  rightWidth: number
  leftCollapsed: boolean
  leftTab: LeftTab
}
const LAYOUT_DEFAULT: LayoutPrefs = { leftWidth: 272, rightWidth: 360, leftCollapsed: false, leftTab: 'blocks' }
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

export type DesignerView = 'design' | 'vars' | 'theme' | 'page' | 'html' | 'css' | 'js' | 'cpp' | 'issues' | 'json'
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
  if (projectScoped) return
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
  view: DesignerView
  setView: (view: DesignerView) => void
  /** Нижний выдвижной ящик: открыт ли и его высота, px. */
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
  /** Узкое окно: левая панель выехала поверх превью. Одновременно с инспектором не открывается. */
  leftDrawer: boolean
  setLeftDrawer: (v: boolean) => void
  setInspectorOpen: (v: boolean) => void
  /** Страница сайта, показанная в превью (пусто — первая). */
  currentPage: string
  /** Поле инспектора, найденное поиском (подсвечивается). */
  highlight: { fid: string; n: number } | null
  device: DeviceView
  themeView: ThemeView
  interactive: boolean

  /** Клик по вкладке ящика: открыть её; повторный клик по активной — свернуть. */
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
  /** Заменить проект целиком (мастер «Страница для устройства»). */
  replaceProject: (p: WdProject) => void
  newProject: () => void
  importJson: (text: string) => string | null
  hydrateProject: (text: string | null, platform: Platform | null) => string | null
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
    { const ns = keepSelection && sel && findBlock(p, sel) ? sel : null; set(ns ? { project: p, selected: ns } : { project: p, selected: null, inspectorOpen: false }) }
  }
  return {
    project: loadInitial(),
    selected: null,
    view: 'design',
    right: 'content',
    ...layout0,
    setLeftWidth: (w) => { set({ leftWidth: clampN(w, LEFT_RANGE.min, LEFT_RANGE.max) }); saveLayout(pickLayout(get())) },
    setRightWidth: (w) => { set({ rightWidth: clampN(w, RIGHT_RANGE.min, RIGHT_RANGE.max) }); saveLayout(pickLayout(get())) },
    setLeftCollapsed: (leftCollapsed) => { set({ leftCollapsed }); saveLayout(pickLayout(get())) },
    setLeftTab: (leftTab) => { set({ leftTab, leftCollapsed: false }); saveLayout(pickLayout(get())) },
    inspectorOpen: false,
    leftDrawer: false,
    setLeftDrawer: (leftDrawer) => set(leftDrawer ? { leftDrawer, inspectorOpen: false } : { leftDrawer }),
    setInspectorOpen: (inspectorOpen) => set(inspectorOpen ? { inspectorOpen, leftDrawer: false } : { inspectorOpen }),
    currentPage: '',
    highlight: null,
    device: 'desktop',
    themeView: 'auto',
    interactive: false,

    setView: (view) => set({ view, leftDrawer: false }),
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
    select: (selected) => set({ selected, ...(selected ? { view: 'design', inspectorOpen: true, leftDrawer: false } : { inspectorOpen: false }) }),

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
      if (newId) set({ selected: newId, inspectorOpen: true, leftDrawer: false })
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
      if (newId) set({ selected: newId, inspectorOpen: true, leftDrawer: false })
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
      if (ok) set({ selected: newId, inspectorOpen: true, leftDrawer: false })
    },
    loadTemplate: (id) => {
      const t = TEMPLATES.find((x) => x.id === id)
      if (!t) return
      const p = t.build(get().project.platform)
      persist(p)
      set({ project: p, selected: null, inspectorOpen: false })
    },
    replaceProject: (p) => {
      persist(p)
      set({ project: p, selected: null, inspectorOpen: false })
    },
    newProject: () => {
      const p = createDefaultProject(get().project.platform)
      persist(p)
      set({ project: p, selected: null, inspectorOpen: false })
    },
    importJson: (text) => {
      const r = parseProject(text)
      if (!r.ok) return r.error
      persist(r.project)
      set({ project: r.project, selected: null, inspectorOpen: false })
      return null
    },
    hydrateProject: (text, platform) => {
      projectScoped = true
      const parsed = text === null ? null : parseProject(text)
      const project = parsed?.ok ? parsed.project : createDefaultProject(platform ?? 'esp32')
      if (platform) project.platform = platform
      set({
        project, selected: null, inspectorOpen: false, leftDrawer: false,
        view: 'design', right: 'content', currentPage: '', highlight: null, interactive: false
      })
      return parsed && !parsed.ok ? parsed.error : null
    }
  }
})

// Для e2e и снимков экранов (как у остальных хранилищ).
;(window as unknown as { __avrStores?: Record<string, unknown> }).__avrStores = { ...((window as unknown as { __avrStores?: Record<string, unknown> }).__avrStores ?? {}), useWebDesigner }

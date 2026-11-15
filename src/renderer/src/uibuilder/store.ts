import { create } from 'zustand'
import {
  allIds,
  applyPageTemplate,
  createProjectFromTemplate,
  duplicateTab as duplicateTabModel,
  createDefaultProject,
  createElement,
  createTab,
  parseProject,
  serializeProject,
  validate,
  generateWithIssues,
  WIDGETS
} from './core/index'
import type {
  Binding,
  ElementProps,
  Issue,
  Platform,
  StyleSpec,
  ThemeVars,
  UiElement,
  UiProject,
  UiSettings,
  UiVariable,
  WidgetType,
  WifiSettings
} from './core/index'
import type { SketchInfo } from './sketch/parse'

const STORAGE_KEY = 'avride.uibuilder.project.v1'
const PREFS_KEY = 'avride.uibuilder.prefs.v1'
export interface Prefs {
  bottomOpen: boolean
  bottomHeight: number
  paletteCollapsed: boolean
  /** 'fit' — вписать в доступное место, иначе масштаб числом. */
  zoom: 'fit' | number
}
function loadPrefs(): Prefs {
  const d: Prefs = { bottomOpen: false, bottomHeight: 220, paletteCollapsed: false, zoom: 'fit' }
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return { ...d, ...(JSON.parse(raw) as Partial<Prefs>) }
  } catch {
    /* нет localStorage */
  }
  return d
}
function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}
const HISTORY_LIMIT = 100
/** Правки одного ключа чаще этого интервала (мс) сливаются в один шаг отмены (набор текста, движение ползунка). */
const COALESCE_MS = 800

export type BottomTab = 'links' | 'code' | 'issues' | 'variables' | 'project' | 'theme' | 'json'
export type CanvasMode = 'edit' | 'test'
export type FocusSection = 'binding' | 'label' | 'layout'

function loadInitial(): { project: UiProject; ledcApi: 'v2' | 'v3' } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { project?: unknown; ledcApi?: string }
      const r = parseProject(JSON.stringify(parsed.project ?? {}))
      if (r.ok) return { project: r.project, ledcApi: parsed.ledcApi === 'v2' ? 'v2' : 'v3' }
    }
  } catch {
    /* localStorage недоступен — работаем без сохранения */
  }
  return { project: createDefaultProject('esp32'), ledcApi: 'v3' }
}

interface State {
  project: UiProject
  ledcApi: 'v2' | 'v3'
  activeTab: string
  selected: string | null
  bottom: BottomTab
  bottomOpen: boolean
  bottomHeight: number
  paletteCollapsed: boolean
  zoom: 'fit' | number
  setBottomHeight: (h: number) => void
  setPaletteCollapsed: (c: boolean) => void
  setZoom: (z: 'fit' | number) => void
  mode: CanvasMode
  /** Что сделала миграция при последнем импорте (для показа пользователю). */
  importNotes: string[]
  past: UiProject[]
  future: UiProject[]
  /** Запрос инспектору: прокрутить к разделу и сфокусировать (nonce меняется при каждом запросе). */
  focus: { section: FocusSection; nonce: number } | null
  /** Короткое сообщение внизу холста. */
  toast: { text: string; nonce: number } | null
  /** Элемент, который нужно подсветить на холсте (например, после перехода из панели «Связи»). */
  flash: { id: string; nonce: number } | null

  setBottom: (t: BottomTab) => void
  setBottomOpen: (open: boolean) => void
  setMode: (m: CanvasMode) => void
  setActiveTab: (id: string) => void
  select: (id: string | null) => void
  /** Выбрать элемент, переключив вкладку на ту, где он лежит. */
  reveal: (id: string) => void
  requestFocus: (section: FocusSection) => void
  showToast: (text: string) => void
  setPlatform: (p: Platform) => void
  setLedcApi: (v: 'v2' | 'v3') => void
  undo: () => void
  redo: () => void

  addElement: (type: WidgetType, tabId?: string, index?: number) => void
  /** Добавить после выбранного элемента (если он на открытой вкладке), иначе в конец открытой вкладки. */
  addElementSmart: (type: WidgetType) => void
  moveElement: (id: string, tabId: string, index: number) => void
  moveElementBy: (id: string, delta: number) => void
  removeElement: (id: string) => void
  duplicateElement: (id: string) => void
  patchElement: (id: string, patch: Partial<Pick<UiElement, 'label'>>) => void
  patchProps: (id: string, patch: Partial<ElementProps>) => void
  renameElement: (id: string, newId: string) => void
  setBinding: (id: string, b: Binding) => void
  /** Привязать к переменной: при необходимости добавляет её в модель (из скетча — external). */
  bindVariable: (id: string, v: UiVariable, direction: 'toUi' | 'fromUi' | 'both') => void
  /** Переменную, созданную конструктором, считать переменной из скетча (если она там есть). */
  markExternal: (name: string) => void

  addVariable: () => void
  patchVariable: (index: number, patch: Partial<UiVariable>) => void
  removeVariable: (index: number) => void

  addTab: () => void
  patchTab: (id: string, patch: { title?: string; id?: string }) => void
  removeTab: (id: string) => void
  moveTab: (id: string, delta: number) => void
  duplicateTab: (id: string) => void
  moveElementToTab: (id: string, tabId: string) => void
  setGroup: (id: string, group: string) => void
  patchStyle: (id: string, which: 'panelStyle' | 'elementStyle', key: keyof StyleSpec, value: string) => void
  setTheme: (preset: string) => void
  patchTheme: (patch: Partial<Omit<ThemeVars, 'colors'>>) => void
  patchThemeColor: (color: string, value: string) => void
  addPageTemplate: (templateId: string, sketch?: SketchInfo | null) => void
  newFromTemplate: (templateId: string, sketch?: SketchInfo | null) => void

  patchWifi: (patch: Partial<WifiSettings>) => void
  patchSettings: (patch: Partial<UiSettings>) => void

  importJson: (text: string) => string | null
  reset: () => void
}

function findEl(p: UiProject, id: string): UiElement | undefined {
  for (const t of p.tabs) for (const e of t.elements) if (e.id === id) return e
  return undefined
}

/** Убирает переменные из скетча, на которые больше никто не ссылается (список «Переменные» не засоряется). */
function pruneExternals(p: UiProject): void {
  const used = new Set<string>()
  for (const t of p.tabs) for (const e of t.elements) if (e.binding.kind === 'var') used.add(e.binding.variable)
  p.variables = p.variables.filter((v) => !v.external || used.has(v.name))
}

/** Переменные шаблона, которые уже есть в скетче (по имени и подходящему типу), заменяются переменными скетча. */
function linkTemplateToSketch(p: UiProject, sketch: SketchInfo | null | undefined, names: Set<string>): number {
  if (!sketch) return 0
  let n = 0
  for (const v of p.variables) {
    if (v.external || !names.has(v.name)) continue
    const s = sketch.vars.find((x) => x.name === v.name)
    if (s && s.type === v.type && !s.isArray) {
      v.external = true
      v.init = s.initValue
      n++
    }
  }
  return n
}

export const useUiBuilder = create<State>((set, get) => {
  const init = loadInitial()
  const prefs = loadPrefs()
  const persist = (): void => {
    const st = get()
    savePrefs({ bottomOpen: st.bottomOpen, bottomHeight: st.bottomHeight, paletteCollapsed: st.paletteCollapsed, zoom: st.zoom })
  }
  let lastKey = ''
  let lastAt = 0

  /** Фиксирует новую версию проекта в истории. */
  const commit = (next: UiProject, key?: string): void => {
    const cur = get().project
    const now = Date.now()
    const coalesce = !!key && key === lastKey && now - lastAt < COALESCE_MS && get().past.length > 0
    lastKey = key ?? ''
    lastAt = now
    const past = coalesce ? get().past : [...get().past, cur].slice(-HISTORY_LIMIT)
    set({ project: next, past, future: [] })
  }
  /** Применяет изменение к копии проекта. */
  const mutate = (fn: (p: UiProject) => void, key?: string): void => {
    const p = structuredClone(get().project)
    fn(p)
    pruneExternals(p)
    commit(p, key)
  }
  const restore = (project: UiProject, past: UiProject[], future: UiProject[]): void => {
    const st = get()
    const ids = new Set<string>()
    for (const t of project.tabs) for (const e of t.elements) ids.add(e.id)
    const tabOk = project.tabs.some((t) => t.id === st.activeTab)
    lastKey = ''
    set({
      project,
      past,
      future,
      selected: st.selected && ids.has(st.selected) ? st.selected : null,
      activeTab: tabOk ? st.activeTab : project.tabs[0].id
    })
  }

  return {
    project: init.project,
    ledcApi: init.ledcApi,
    activeTab: init.project.tabs[0].id,
    selected: null,
    bottom: 'links',
    bottomOpen: prefs.bottomOpen,
    bottomHeight: prefs.bottomHeight,
    paletteCollapsed: prefs.paletteCollapsed,
    zoom: prefs.zoom,
    mode: 'edit',
    importNotes: [],
    past: [],
    future: [],
    focus: null,
    toast: null,
    flash: null,

    setBottom: (bottom) => {
      set({ bottom, bottomOpen: true })
      persist()
    },
    setBottomOpen: (bottomOpen) => {
      set({ bottomOpen })
      persist()
    },
    setBottomHeight: (bottomHeight) => {
      set({ bottomHeight })
      persist()
    },
    setPaletteCollapsed: (paletteCollapsed) => {
      set({ paletteCollapsed })
      persist()
    },
    setZoom: (zoom) => {
      set({ zoom })
      persist()
    },
    setMode: (mode) => set({ mode, selected: mode === 'test' ? null : get().selected }),
    setActiveTab: (activeTab) => set({ activeTab, selected: null }),
    select: (selected) => set({ selected }),
    reveal: (id) => {
      const p = get().project
      const tab = p.tabs.find((t) => t.elements.some((e) => e.id === id))
      if (!tab) return
      set({ activeTab: tab.id, selected: id, mode: 'edit', flash: { id, nonce: Date.now() } })
    },
    requestFocus: (section) => set({ focus: { section, nonce: Date.now() } }),
    showToast: (text) => set({ toast: { text, nonce: Date.now() } }),
    setPlatform: (platform) => mutate((p) => void (p.platform = platform)),
    setLedcApi: (ledcApi) => set({ ledcApi }),
    undo: () => {
      const { past, project, future } = get()
      if (!past.length) return
      restore(past[past.length - 1], past.slice(0, -1), [project, ...future].slice(0, HISTORY_LIMIT))
    },
    redo: () => {
      const { past, project, future } = get()
      if (!future.length) return
      restore(future[0], [...past, project].slice(-HISTORY_LIMIT), future.slice(1))
    },

    addElement: (type, tabId, index) => {
      let newId = ''
      let target = ''
      mutate((p) => {
        const tab = p.tabs.find((t) => t.id === (tabId ?? get().activeTab)) ?? p.tabs[0]
        target = tab.id
        const el = createElement(type, p)
        newId = el.id
        if (index === undefined || index < 0 || index > tab.elements.length) tab.elements.push(el)
        else tab.elements.splice(index, 0, el)
      })
      set({ selected: newId, activeTab: target, flash: { id: newId, nonce: Date.now() } })
    },
    addElementSmart: (type) => {
      const { project, selected, activeTab } = get()
      const tab = project.tabs.find((t) => t.id === activeTab) ?? project.tabs[0]
      const at = selected ? tab.elements.findIndex((e) => e.id === selected) : -1
      get().addElement(type, tab.id, at >= 0 ? at + 1 : undefined)
    },
    moveElement: (id, tabId, index) =>
      mutate((p) => {
        let moved: UiElement | undefined
        for (const t of p.tabs) {
          const i = t.elements.findIndex((e) => e.id === id)
          if (i >= 0) {
            ;[moved] = t.elements.splice(i, 1)
            break
          }
        }
        const dest = p.tabs.find((t) => t.id === tabId)
        if (!moved || !dest) return
        dest.elements.splice(Math.max(0, Math.min(index, dest.elements.length)), 0, moved)
      }),
    moveElementBy: (id, delta) =>
      mutate((p) => {
        for (const t of p.tabs) {
          const i = t.elements.findIndex((e) => e.id === id)
          if (i < 0) continue
          const j = Math.max(0, Math.min(t.elements.length - 1, i + delta))
          if (j === i) return
          const [el] = t.elements.splice(i, 1)
          t.elements.splice(j, 0, el)
          return
        }
      }),
    removeElement: (id) => {
      mutate((p) => {
        for (const t of p.tabs) t.elements = t.elements.filter((e) => e.id !== id)
      })
      if (get().selected === id) set({ selected: null })
    },
    duplicateElement: (id) => {
      let newId = ''
      mutate((p) => {
        for (const t of p.tabs) {
          const i = t.elements.findIndex((e) => e.id === id)
          if (i < 0) continue
          const copy = structuredClone(t.elements[i])
          const prefix = WIDGETS[copy.type].idPrefix
          const taken = allIds(p)
          let n = 1
          while (taken.has(`${prefix}${n}`)) n++
          copy.id = `${prefix}${n}`
          newId = copy.id
          t.elements.splice(i + 1, 0, copy)
          break
        }
      })
      if (newId) set({ selected: newId, flash: { id: newId, nonce: Date.now() } })
    },
    patchElement: (id, patch) =>
      mutate((p) => {
        const e = findEl(p, id)
        if (e) Object.assign(e, patch)
      }, `el:${id}:${Object.keys(patch).join(',')}`),
    patchProps: (id, patch) =>
      mutate((p) => {
        const e = findEl(p, id)
        if (e) e.props = { ...e.props, ...patch }
      }, `props:${id}:${Object.keys(patch).join(',')}`),
    renameElement: (id, newId) => {
      mutate((p) => {
        const e = findEl(p, id)
        if (e) e.id = newId
      })
      if (get().selected === id) set({ selected: newId })
    },
    setBinding: (id, b) =>
      mutate((p) => {
        const e = findEl(p, id)
        if (e) e.binding = b
      }),
    bindVariable: (id, v, direction) =>
      mutate((p) => {
        const e = findEl(p, id)
        if (!e) return
        const existing = p.variables.find((x) => x.name === v.name)
        if (!existing) p.variables.push({ ...v })
        else if (v.external && !existing.external) existing.external = true
        e.binding = { kind: 'var', variable: v.name, direction }
      }),
    markExternal: (name) =>
      mutate((p) => {
        const v = p.variables.find((x) => x.name === name)
        if (v) v.external = true
      }),

    addVariable: () =>
      mutate((p) => {
        const taken = allIds(p)
        let n = 1
        while (taken.has(`var${n}`)) n++
        p.variables.push({ name: `var${n}`, type: 'int', init: '0' })
      }),
    patchVariable: (index, patch) =>
      mutate((p) => {
        const v = p.variables[index]
        if (!v) return
        const old = v.name
        Object.assign(v, patch)
        // переименование переменной обновляет привязки
        if (patch.name !== undefined && patch.name !== old)
          for (const t of p.tabs)
            for (const e of t.elements)
              if (e.binding.kind === 'var' && e.binding.variable === old) e.binding.variable = patch.name
      }, `var:${index}`),
    removeVariable: (index) =>
      mutate((p) => {
        const [v] = p.variables.splice(index, 1)
        if (!v) return
        for (const t of p.tabs)
          for (const e of t.elements)
            if (e.binding.kind === 'var' && e.binding.variable === v.name) e.binding.variable = ''
      }),

    addTab: () => {
      let id = ''
      mutate((p) => {
        const t = createTab(p)
        id = t.id
        p.tabs.push(t)
      })
      set({ activeTab: id, selected: null })
    },
    patchTab: (id, patch) => {
      mutate((p) => {
        const t = p.tabs.find((x) => x.id === id)
        if (!t) return
        if (patch.title !== undefined) t.title = patch.title
        if (patch.id !== undefined) t.id = patch.id
      }, `tab:${id}`)
      if (patch.id !== undefined && get().activeTab === id) set({ activeTab: patch.id })
    },
    removeTab: (id) => {
      if (get().project.tabs.length <= 1) return
      mutate((p) => void (p.tabs = p.tabs.filter((t) => t.id !== id)))
      if (get().activeTab === id) set({ activeTab: get().project.tabs[0].id, selected: null })
    },

    moveTab: (id, delta) =>
      mutate((p) => {
        const i = p.tabs.findIndex((t) => t.id === id)
        const j = i + delta
        if (i < 0 || j < 0 || j >= p.tabs.length) return
        const [t] = p.tabs.splice(i, 1)
        p.tabs.splice(j, 0, t)
      }),
    duplicateTab: (id) => {
      let newId: string | null = null
      mutate((p) => void (newId = duplicateTabModel(p, id)))
      if (newId) set({ activeTab: newId, selected: null })
    },
    moveElementToTab: (id, tabId) =>
      mutate((p) => {
        let moved: UiElement | undefined
        for (const t of p.tabs) {
          const i = t.elements.findIndex((e) => e.id === id)
          if (i >= 0) {
            if (t.id === tabId) return
            ;[moved] = t.elements.splice(i, 1)
            break
          }
        }
        const dest = p.tabs.find((t) => t.id === tabId)
        if (moved && dest) dest.elements.push(moved)
      }),
    setGroup: (id, group) =>
      mutate((p) => {
        const e = findEl(p, id)
        if (!e) return
        if (group.trim()) e.group = group
        else delete e.group
      }, `group:${id}`),
    patchStyle: (id, which, key, value) =>
      mutate((p) => {
        const e = findEl(p, id)
        if (!e) return
        const spec: StyleSpec = { ...(e.props[which] ?? {}) }
        if (value === '') delete spec[key]
        else spec[key] = value
        if (Object.keys(spec).length) e.props[which] = spec
        else delete e.props[which]
      }, `style:${id}:${which}:${key}`),
    setTheme: (preset) => mutate((p) => void (p.theme = { preset, vars: {} })),
    patchTheme: (patch) =>
      mutate((p) => {
        const vars: ThemeVars = { ...p.theme.vars }
        for (const k of Object.keys(patch) as Array<keyof typeof patch>) {
          const v = patch[k]
          if (v === undefined || v === '') delete vars[k]
          else vars[k] = v
        }
        p.theme = { ...p.theme, vars }
      }, 'theme'),
    patchThemeColor: (color, value) =>
      mutate((p) => {
        const colors = { ...(p.theme.vars.colors ?? {}) } as Record<string, string>
        if (value === '') delete colors[color]
        else colors[color] = value
        const vars: ThemeVars = { ...p.theme.vars }
        if (Object.keys(colors).length) vars.colors = colors
        else delete vars.colors
        p.theme = { ...p.theme, vars }
      }, `themeColor:${color}`),
    addPageTemplate: (templateId, sketch) => {
      let tab: string | null = null
      mutate((p) => {
        const before = new Set(p.variables.map((v) => v.name))
        tab = applyPageTemplate(p, templateId)
        const added = new Set(p.variables.map((v) => v.name).filter((n) => !before.has(n)))
        linkTemplateToSketch(p, sketch, added)
      })
      if (tab) set({ activeTab: tab, selected: null })
    },
    newFromTemplate: (templateId, sketch) => {
      const p = createProjectFromTemplate(templateId, get().project.platform)
      linkTemplateToSketch(p, sketch, new Set(p.variables.map((v) => v.name)))
      pruneExternals(p)
      commit(p)
      set({ activeTab: p.tabs[0].id, selected: null, importNotes: [] })
    },

    patchWifi: (patch) => mutate((p) => void Object.assign(p.wifi, patch), `wifi:${Object.keys(patch).join(',')}`),
    patchSettings: (patch) => mutate((p) => void Object.assign(p.settings, patch), `settings:${Object.keys(patch).join(',')}`),

    importJson: (text) => {
      const r = parseProject(text)
      if (!r.ok) return r.error
      commit(r.project)
      set({ activeTab: r.project.tabs[0].id, selected: null, importNotes: r.notes })
      return null
    },
    reset: () => {
      const p = createDefaultProject(get().project.platform)
      commit(p)
      set({ activeTab: p.tabs[0].id, selected: null })
    }
  }
})

// Автосохранение (удобство; источник истины — ui.json проекта, который подключит оболочка IDE).
useUiBuilder.subscribe((s, prev) => {
  if (s.project === prev.project && s.ledcApi === prev.ledcApi) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ project: JSON.parse(serializeProject(s.project)), ledcApi: s.ledcApi }))
  } catch {
    /* ignore */
  }
})

// ---- Производные данные ----
export function computeOutput(project: UiProject, ledcApi: 'v2' | 'v3'): ReturnType<typeof generateWithIssues> {
  return generateWithIssues(project, project.platform, { ledcApi })
}

export function computeIssues(project: UiProject, ledcApi: 'v2' | 'v3'): Issue[] {
  return validate(project, project.platform, { ledcApi })
}

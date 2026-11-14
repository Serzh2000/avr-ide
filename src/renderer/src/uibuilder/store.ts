import { create } from 'zustand'
import {
  allIds,
  applyPageTemplate,
  createProjectFromTemplate,
  duplicateTab as duplicateTabModel,
  createDefaultProject,
  createElement,
  createTab,
  defaultBinding,
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

const STORAGE_KEY = 'avride.uibuilder.project.v1'

export type BottomTab = 'variables' | 'project' | 'theme' | 'code' | 'issues' | 'json'

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
  /** Что сделала миграция при последнем импорте (для показа пользователю). */
  importNotes: string[]

  setBottom: (t: BottomTab) => void
  setActiveTab: (id: string) => void
  select: (id: string | null) => void
  setPlatform: (p: Platform) => void
  setLedcApi: (v: 'v2' | 'v3') => void

  addElement: (type: WidgetType, tabId?: string, index?: number) => void
  moveElement: (id: string, tabId: string, index: number) => void
  removeElement: (id: string) => void
  duplicateElement: (id: string) => void
  patchElement: (id: string, patch: Partial<Pick<UiElement, 'label'>>) => void
  patchProps: (id: string, patch: Partial<ElementProps>) => void
  renameElement: (id: string, newId: string) => void
  setBinding: (id: string, b: Binding) => void

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
  addPageTemplate: (templateId: string) => void
  newFromTemplate: (templateId: string) => void

  patchWifi: (patch: Partial<WifiSettings>) => void
  patchSettings: (patch: Partial<UiSettings>) => void

  importJson: (text: string) => string | null
  reset: () => void
}

function findEl(p: UiProject, id: string): UiElement | undefined {
  for (const t of p.tabs) for (const e of t.elements) if (e.id === id) return e
  return undefined
}

export const useUiBuilder = create<State>((set, get) => {
  const init = loadInitial()
  /** Применяет изменение к копии проекта. */
  const mutate = (fn: (p: UiProject) => void): void => {
    const p = structuredClone(get().project)
    fn(p)
    set({ project: p })
  }
  return {
    project: init.project,
    ledcApi: init.ledcApi,
    activeTab: init.project.tabs[0].id,
    selected: null,
    bottom: 'variables',
    importNotes: [],

    setBottom: (bottom) => set({ bottom }),
    setActiveTab: (activeTab) => set({ activeTab, selected: null }),
    select: (selected) => set({ selected }),
    setPlatform: (platform) => mutate((p) => void (p.platform = platform)),
    setLedcApi: (ledcApi) => set({ ledcApi }),

    addElement: (type, tabId, index) => {
      let newId = ''
      mutate((p) => {
        const tab = p.tabs.find((t) => t.id === (tabId ?? get().activeTab)) ?? p.tabs[0]
        const el = createElement(type, p)
        newId = el.id
        if (index === undefined || index < 0 || index > tab.elements.length) tab.elements.push(el)
        else tab.elements.splice(index, 0, el)
      })
      set({ selected: newId })
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
      if (newId) set({ selected: newId })
    },
    patchElement: (id, patch) =>
      mutate((p) => {
        const e = findEl(p, id)
        if (e) Object.assign(e, patch)
      }),
    patchProps: (id, patch) =>
      mutate((p) => {
        const e = findEl(p, id)
        if (e) e.props = { ...e.props, ...patch }
      }),
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
      }),
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
      })
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
      }),
    patchStyle: (id, which, key, value) =>
      mutate((p) => {
        const e = findEl(p, id)
        if (!e) return
        const spec: StyleSpec = { ...(e.props[which] ?? {}) }
        if (value === '') delete spec[key]
        else spec[key] = value
        if (Object.keys(spec).length) e.props[which] = spec
        else delete e.props[which]
      }),
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
      }),
    patchThemeColor: (color, value) =>
      mutate((p) => {
        const colors = { ...(p.theme.vars.colors ?? {}) } as Record<string, string>
        if (value === '') delete colors[color]
        else colors[color] = value
        const vars: ThemeVars = { ...p.theme.vars }
        if (Object.keys(colors).length) vars.colors = colors
        else delete vars.colors
        p.theme = { ...p.theme, vars }
      }),
    addPageTemplate: (templateId) => {
      let tab: string | null = null
      mutate((p) => void (tab = applyPageTemplate(p, templateId)))
      if (tab) set({ activeTab: tab, selected: null })
    },
    newFromTemplate: (templateId) => {
      const p = createProjectFromTemplate(templateId, get().project.platform)
      set({ project: p, activeTab: p.tabs[0].id, selected: null, importNotes: [] })
    },

    patchWifi: (patch) => mutate((p) => void Object.assign(p.wifi, patch)),
    patchSettings: (patch) => mutate((p) => void Object.assign(p.settings, patch)),

    importJson: (text) => {
      const r = parseProject(text)
      if (!r.ok) return r.error
      set({ project: r.project, activeTab: r.project.tabs[0].id, selected: null, importNotes: r.notes })
      return null
    },
    reset: () => {
      const p = createDefaultProject(get().project.platform)
      set({ project: p, activeTab: p.tabs[0].id, selected: null })
    }
  }
})

// Автосохранение (удобство; источник истины — ui.json проекта, который подключит оболочка IDE).
useUiBuilder.subscribe((s) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ project: JSON.parse(serializeProject(s.project)), ledcApi: s.ledcApi }))
  } catch {
    /* ignore */
  }
})

// ---- Производные данные ----
export function computeOutput(project: UiProject, ledcApi: 'v2' | 'v3'): { code: string; issues: Issue[] } {
  return generateWithIssues(project, project.platform, { ledcApi })
}

export function computeIssues(project: UiProject, ledcApi: 'v2' | 'v3'): Issue[] {
  return validate(project, project.platform, { ledcApi })
}

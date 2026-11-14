// Фабрики: новый проект, новый элемент, уникальные идентификаторы.
import type { UiElement, UiProject, UiTab, WidgetType, Platform } from './types'
import { UI_JSON_VERSION } from './types'
import { WIDGETS } from './widgets'
import { defaultTheme } from './themes'

export function createDefaultProject(platform: Platform = 'esp32'): UiProject {
  return {
    version: UI_JSON_VERSION,
    platform,
    wifi: {
      mode: 'sta',
      ssid: '',
      password: '',
      apSsid: 'ESPUI-AP',
      apPassword: '',
      hostname: 'espui'
    },
    settings: {
      title: 'ESPUI',
      authUser: '',
      authPass: '',
      updateMs: 500,
      sliderContinuous: false,
      serialLog: true,
      pwmFreq: 5000,
      pwmBits: 8,
      dnsCaptive: false
    },
    theme: defaultTheme(),
    variables: [],
    tabs: [{ id: 'tab1', title: 'Главная', elements: [] }]
  }
}

export function allIds(p: UiProject): Set<string> {
  const s = new Set<string>()
  for (const v of p.variables) s.add(v.name)
  for (const t of p.tabs) {
    s.add(t.id)
    for (const e of t.elements) s.add(e.id)
  }
  return s
}

export function uniqueId(prefix: string, taken: Set<string>): string {
  let i = 1
  while (taken.has(`${prefix}${i}`)) i++
  return `${prefix}${i}`
}

export function createElement(type: WidgetType, p: UiProject): UiElement {
  const def = WIDGETS[type]
  return {
    id: uniqueId(def.idPrefix, allIds(p)),
    type,
    label: def.defaultLabel,
    props: structuredClone(def.defaultProps),
    binding: { kind: 'none' }
  }
}

export function createTab(p: UiProject): UiTab {
  return { id: uniqueId('tab', allIds(p)), title: `Вкладка ${p.tabs.length + 1}`, elements: [] }
}

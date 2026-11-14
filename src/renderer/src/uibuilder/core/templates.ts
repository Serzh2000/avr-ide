// Шаблоны страниц и проектов. Шаблоны не используют пины и функции пользователя — сгенерированный код компилируется «как есть»:
// всё управление идёт через переменные, которые скетч читает и пишет сам.
import { createDefaultProject, uniqueId, allIds } from './factory'
import type { Binding, ElementProps, Platform, UiElement, UiProject, UiTab, UiVariable, WidgetType } from './types'

export interface TemplateTab {
  /** Базовое имя C++ идентификатора вкладки. */
  id: string
  title: string
  elements: UiElement[]
}

export interface PageTemplate {
  id: string
  title: string
  description: string
  /** Тема, которую выбирает шаблон проекта (для вставки страницы не меняется). */
  theme: string
  pageTitle: string
  variables: UiVariable[]
  tabs: TemplateTab[]
}

function el(
  type: WidgetType,
  id: string,
  label: string,
  props: ElementProps,
  binding: Binding = { kind: 'none' },
  group?: string
): UiElement {
  const e: UiElement = { id, type, label, props, binding }
  if (group) e.group = group
  return e
}
const toUi = (variable: string): Binding => ({ kind: 'var', variable, direction: 'toUi' })
const fromUi = (variable: string): Binding => ({ kind: 'var', variable, direction: 'fromUi' })
const both = (variable: string): Binding => ({ kind: 'var', variable, direction: 'both' })

/** Крупное значение по центру для Label (setElementStyle гарантирован для Label). */
const bigValue = { fontSize: '28px', fontWeight: 'bold', textAlign: 'center' } as const

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: 'remote',
    title: 'Пульт управления',
    description: 'Питание, скорость, режим и джойстик; все значения — в переменных скетча',
    theme: 'dark',
    pageTitle: 'Пульт',
    variables: [
      { name: 'power', type: 'bool', init: 'false' },
      { name: 'speed', type: 'int', init: '50' },
      { name: 'mode', type: 'int', init: '1' },
      { name: 'padEvent', type: 'int', init: '0' },
      { name: 'status', type: 'String', init: 'Готов' }
    ],
    tabs: [
      {
        id: 'tabRemote',
        title: 'Пульт',
        elements: [
          el('label', 'lblStatus', 'Состояние', { color: 'Wetasphalt', wide: true, elementStyle: bigValue }, toUi('status'), 'Состояние'),
          el('switcher', 'swPower', 'Питание', { color: 'Alizarin' }, both('power'), 'Состояние'),
          el('select', 'selMode', 'Режим', {
            color: 'Sunflower',
            options: [
              { label: 'Авто', value: '1' },
              { label: 'Ручной', value: '2' },
              { label: 'Экономный', value: '3' }
            ]
          }, fromUi('mode'), 'Состояние'),
          el('slider', 'sldSpeed', 'Скорость', { color: 'Peterriver', min: 0, max: 100, step: 5, wide: true }, both('speed'), 'Движение'),
          el('padCenter', 'padMove', 'Джойстик', { color: 'Carrot' }, fromUi('padEvent'), 'Движение')
        ]
      }
    ]
  },
  {
    id: 'weather',
    title: 'Метеостанция',
    description: 'Температура, влажность, давление и графики; значения задаёт скетч',
    theme: 'light',
    pageTitle: 'Метеостанция',
    variables: [
      { name: 'temp', type: 'float', init: '21.5' },
      { name: 'hum', type: 'float', init: '45' },
      { name: 'pressure', type: 'int', init: '1013' }
    ],
    tabs: [
      {
        id: 'tabNow',
        title: 'Сейчас',
        elements: [
          el('label', 'lblTemp', 'Температура', { color: 'Alizarin', suffix: ' °C', decimals: 1, elementStyle: bigValue }, toUi('temp'), 'Сейчас'),
          el('label', 'lblHum', 'Влажность', { color: 'Peterriver', suffix: ' %', decimals: 0, elementStyle: bigValue }, toUi('hum'), 'Сейчас'),
          el('label', 'lblPress', 'Давление', { color: 'Wetasphalt', suffix: ' гПа', elementStyle: bigValue }, toUi('pressure'), 'Сейчас')
        ]
      },
      {
        id: 'tabGraphs',
        title: 'Графики',
        elements: [
          el('graph', 'grTemp', 'Температура, °C ×10', { color: 'Alizarin', scale: 10, graphMs: 5000, wide: true }, toUi('temp')),
          el('graph', 'grHum', 'Влажность, % ×10', { color: 'Peterriver', scale: 10, graphMs: 5000, wide: true }, toUi('hum'))
        ]
      }
    ]
  },
  {
    id: 'home',
    title: 'Умный дом',
    description: 'Свет, климат и режимы на трёх вкладках, с часами от браузера',
    theme: 'dark',
    pageTitle: 'Умный дом',
    variables: [
      { name: 'lightLiving', type: 'bool', init: 'false' },
      { name: 'lightKitchen', type: 'bool', init: 'false' },
      { name: 'brightness', type: 'int', init: '80' },
      { name: 'curTemp', type: 'float', init: '21.5' },
      { name: 'targetTemp', type: 'float', init: '22' },
      { name: 'heating', type: 'bool', init: 'false' },
      { name: 'scene', type: 'int', init: '1' },
      { name: 'clock', type: 'String', init: '' }
    ],
    tabs: [
      {
        id: 'tabLight',
        title: 'Свет',
        elements: [
          el('switcher', 'swLiving', 'Гостиная', { color: 'Sunflower' }, both('lightLiving'), 'Комнаты'),
          el('switcher', 'swKitchen', 'Кухня', { color: 'Sunflower' }, both('lightKitchen'), 'Комнаты'),
          el('slider', 'sldBright', 'Яркость, %', { color: 'Carrot', min: 0, max: 100, wide: true }, both('brightness'), 'Яркость')
        ]
      },
      {
        id: 'tabClimate',
        title: 'Климат',
        elements: [
          el('label', 'lblCur', 'Сейчас', { color: 'Turquoise', suffix: ' °C', decimals: 1, elementStyle: bigValue }, toUi('curTemp')),
          el('number', 'numTarget', 'Желаемая', { color: 'Emerald', min: 10, max: 30, step: 0.5, decimals: 1 }, both('targetTemp')),
          el('switcher', 'swHeat', 'Отопление', { color: 'Alizarin' }, both('heating'))
        ]
      },
      {
        id: 'tabScenes',
        title: 'Режимы',
        elements: [
          el('select', 'selScene', 'Сцена', {
            color: 'Peterriver',
            options: [
              { label: 'Дома', value: '1' },
              { label: 'Ушёл', value: '2' },
              { label: 'Ночь', value: '3' }
            ]
          }, both('scene')),
          el('time', 'tmClock', 'Часы браузера', { color: 'Wetasphalt', pollSec: 60 }, fromUi('clock')),
          el('label', 'lblClock', 'Время', { color: 'Dark' }, toUi('clock'))
        ]
      }
    ]
  }
]

export function findPageTemplate(id: string): PageTemplate | undefined {
  return PAGE_TEMPLATES.find((t) => t.id === id)
}

function uniq(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    taken.add(base)
    return base
  }
  const id = uniqueId(base, taken)
  taken.add(id)
  return id
}

/**
 * Вставляет шаблон в проект (мутирует p): переменные и идентификаторы переименовываются, если заняты.
 * Возвращает id первой добавленной вкладки (или null, если шаблона нет).
 */
export function applyPageTemplate(p: UiProject, templateId: string): string | null {
  const tpl = findPageTemplate(templateId)
  if (!tpl) return null
  const taken = allIds(p)
  const varMap = new Map<string, string>()
  for (const v of tpl.variables) {
    // переменная с тем же именем и типом уже есть — используем её, иначе заводим новую
    const same = p.variables.find((x) => x.name === v.name && x.type === v.type)
    if (same) {
      varMap.set(v.name, v.name)
      continue
    }
    const name = uniq(v.name, taken)
    varMap.set(v.name, name)
    p.variables.push({ ...v, name })
  }
  let first: string | null = null
  for (const tt of tpl.tabs) {
    const tab: UiTab = { id: uniq(tt.id, taken), title: tt.title, elements: [] }
    for (const e of tt.elements) {
      const copy = structuredClone(e)
      copy.id = uniq(e.id, taken)
      if (copy.binding.kind === 'var') copy.binding.variable = varMap.get(copy.binding.variable) ?? copy.binding.variable
      tab.elements.push(copy)
    }
    p.tabs.push(tab)
    if (first === null) first = tab.id
  }
  return first
}

export interface ProjectTemplate {
  id: string
  title: string
  description: string
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  { id: 'empty', title: 'Пустой проект', description: 'Одна пустая вкладка' },
  ...PAGE_TEMPLATES.map((t) => ({ id: t.id, title: t.title, description: t.description }))
]

/** Новый проект из шаблона (с темой и заголовком шаблона). 'empty' — как createDefaultProject. */
export function createProjectFromTemplate(templateId: string, platform: Platform = 'esp32'): UiProject {
  const p = createDefaultProject(platform)
  const tpl = findPageTemplate(templateId)
  if (!tpl) return p
  p.tabs = []
  applyPageTemplate(p, templateId)
  p.settings.title = tpl.pageTitle
  p.theme = { preset: tpl.theme, vars: {} }
  return p
}

/** Дублирует вкладку (мутирует p): новые идентификаторы элементов, привязки сохраняются. Возвращает id копии. */
export function duplicateTab(p: UiProject, tabId: string): string | null {
  const i = p.tabs.findIndex((t) => t.id === tabId)
  if (i < 0) return null
  const src = p.tabs[i]
  const taken = allIds(p)
  const tab: UiTab = { id: uniq(src.id.replace(/\d+$/, '') || 'tab', taken), title: `${src.title} (копия)`, elements: [] }
  for (const e of src.elements) {
    const copy = structuredClone(e)
    copy.id = uniq(e.id.replace(/\d+$/, '') || e.id, taken)
    tab.elements.push(copy)
  }
  p.tabs.splice(i + 1, 0, tab)
  return tab.id
}

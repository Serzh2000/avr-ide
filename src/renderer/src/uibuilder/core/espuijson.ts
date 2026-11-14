// Точка интеграции для «живого превью с настоящим ESPUI-фронтом»: строит JSON-описание страницы в том виде,
// как ESPUI (ESPUIclient.cpp / ESPUIcontrol.cpp, ветка master) шлёт его фронтенду по WebSocket в сообщении InitialGui.
// Формат и степень подтверждённости описаны в data/espui/API_NOTES.md, п.8. Порции (chunking) и фрагменты значений не эмулируются.
import { COLOR_NUMBER, CONTROL_TYPE, MESSAGE_TYPE } from './espui-api'
import { compileStyle, classProblem } from './css'
import { themeCss } from './themes'
import type { UiElement, UiProject } from './types'
import { findVariable } from './validate'
import { WIDGETS, isWidgetType } from './widgets'

/** Один контрол в JSON страницы (ключи как в ESPUIcontrol.cpp::MarshalControl). */
export interface EspuiControlJson {
  id: number
  type: number
  label: string
  value: string
  visible: boolean
  color: number
  enabled: boolean
  panelStyle?: string
  panelClass?: string
  elementStyle?: string
  inputType?: string
  wide?: boolean
  vertical?: boolean
  /** Строка с id родителя (в ESPUI — String(parentControl)). */
  parentControl?: string
  /** Только у Option. */
  selected?: string
}

export interface EspuiPageMessage {
  type: number
  sliderContinuous: boolean
  startindex: number
  totalcontrols: number
  /** Первый элемент — всегда заголовок {type:0,label}. */
  controls: Array<{ type: number; label: string } | EspuiControlJson>
}

export interface EspuiPage {
  message: EspuiPageMessage
  /** id элемента конструктора (C++-имя) → числовой id контрола ESPUI. */
  ids: Record<string, number>
  /** Содержимое /css/custom.css (тема), пусто если тема 'default'. */
  customCss: string
  /** Содержимое /js/custom.js (пока не используется конструктором). */
  customJs: string
}

/** Статическое начальное значение (то, что устройство отправило бы при старте, исходя из init переменных). */
export function staticInitialValue(p: UiProject, el: UiElement): string {
  const pr = el.props
  const b = el.binding
  const v = b.kind === 'var' ? findVariable(p, b.variable) : undefined
  const isTrue = (s: string): boolean => s.trim() === 'true' || s.trim() === '1'
  switch (el.type) {
    case 'label': {
      let core = pr.initial ?? ''
      if (v) {
        if (v.type === 'bool') core = isTrue(v.init) ? 'ON' : 'OFF'
        else if (v.type === 'float') core = (Number(v.init) || 0).toFixed(pr.decimals ?? 2)
        else if (v.type === 'int') core = String(parseInt(v.init, 10) || 0)
        else core = v.init
      } else if (b.kind === 'pin') core = b.mode === 'analog' ? '0' : 'OFF'
      return `${pr.prefix ?? ''}${core}${pr.suffix ?? ''}`
    }
    case 'button':
      return pr.text ?? el.label
    case 'switcher':
      if (v) return isTrue(v.init) ? '1' : '0'
      if (b.kind === 'pin' && b.direction === 'fromPin') return '0'
      return pr.on ? '1' : '0'
    case 'slider':
    case 'number': {
      if (v && v.type === 'float' && el.type === 'number') return (Number(v.init) || 0).toFixed(pr.decimals ?? 1)
      if (v) return String(Math.round(Number(v.init) || 0))
      if (b.kind === 'pin' && b.direction === 'fromPin') return '0'
      return String(pr.min ?? 0)
    }
    case 'text':
      return v ? v.init : (pr.initial ?? '')
    case 'select': {
      if (v) return v.init
      const opts = pr.options ?? []
      return pr.initial !== undefined && opts.some((o) => o.value === pr.initial) ? pr.initial : (opts[0]?.value ?? '')
    }
    case 'fileDisplay':
      return pr.file ?? ''
    default:
      return ''
  }
}

/** Строит страницу в формате ESPUI. Порядок контролов и id совпадают с порядком addControl в сгенерированном коде. */
export function buildEspuiPage(p: UiProject): EspuiPage {
  const controls: EspuiPageMessage['controls'] = [{ type: CONTROL_TYPE.Title, label: p.settings.title }]
  const ids: Record<string, number> = {}
  let next = 0 // в ESPUI id = ++idCounter; начальное значение счётчика в прочитанных файлах не видно (API_NOTES.md п.8)
  const multi = p.tabs.length > 1

  const push = (c: Omit<EspuiControlJson, 'id'>): number => {
    const id = ++next
    controls.push({ id, ...c })
    return id
  }
  const base = (type: number, label: string, value: string, color: number, parent?: number): Omit<EspuiControlJson, 'id'> => {
    const c: Omit<EspuiControlJson, 'id'> = { type, label, value, visible: true, color, enabled: true }
    if (parent !== undefined) c.parentControl = String(parent)
    return c
  }

  const tabIds: Record<string, number> = {}
  if (multi) for (const t of p.tabs) tabIds[t.id] = push(base(CONTROL_TYPE.Tab, t.title, t.title, COLOR_NUMBER.None))

  for (const t of p.tabs) {
    const parent = multi ? tabIds[t.id] : undefined
    let prevGroup = ''
    for (const el of t.elements) {
      if (!isWidgetType(el.type)) continue
      const def = WIDGETS[el.type]
      const pr = el.props
      const group = el.group?.trim() ?? ''
      if (group && group !== prevGroup) push(base(CONTROL_TYPE.Separator, group, '', COLOR_NUMBER.None, parent))
      prevGroup = group
      const color = COLOR_NUMBER[pr.color ?? (el.type === 'separator' ? 'None' : 'Turquoise')]
      const isPwd = el.type === 'password'
      const type = isPwd ? CONTROL_TYPE.Text : CONTROL_TYPE[def.espuiType]
      const c = base(type, el.label, isPwd ? '--------' : staticInitialValue(p, el), color, parent)
      if (pr.hidden) c.visible = false
      if (pr.disabled) c.enabled = false
      const ps = compileStyle(pr.panelStyle)
      if (ps) c.panelStyle = ps
      const pc = pr.panelClass?.trim() ?? ''
      if (pc && !classProblem(pc)) c.panelClass = pc
      const es = compileStyle(pr.elementStyle)
      if (es) c.elementStyle = es
      if (el.type === 'text' && pr.inputType && pr.inputType !== 'text') c.inputType = pr.inputType
      if (pr.wide) c.wide = true
      if (pr.vertical && (el.type === 'slider' || el.type === 'switcher')) c.vertical = true
      const id = push(c)
      ids[el.id] = id
      const child = (type2: number, label: string, value: string, selected?: string): void => {
        const cc = base(type2, label, value, COLOR_NUMBER.None, id)
        if (selected !== undefined) cc.selected = selected
        push(cc)
      }
      if (el.type === 'slider' || el.type === 'number') {
        child(CONTROL_TYPE.Min, '', String(pr.min ?? 0))
        child(CONTROL_TYPE.Max, '', String(pr.max ?? 100))
        if (pr.step !== undefined) child(CONTROL_TYPE.Step, '', String(pr.step))
      }
      if (el.type === 'text' && pr.maxLength !== undefined && pr.maxLength > 0) child(CONTROL_TYPE.Max, '', String(pr.maxLength))
      if (el.type === 'select') {
        const cur = c.value
        for (const o of pr.options ?? []) child(CONTROL_TYPE.Option, o.label, o.value, o.value === cur ? 'selected' : '')
      }
    }
  }

  return {
    message: {
      type: MESSAGE_TYPE.InitialGui,
      sliderContinuous: p.settings.sliderContinuous,
      startindex: 0,
      totalcontrols: 65535,
      controls
    },
    ids,
    customCss: themeCss(p.theme),
    customJs: ''
  }
}

// Краткое описание привязки элемента для значков на холсте и таблицы «Связи».
import { WIDGETS } from '../core/index'
import type { Issue, UiElement, UiProject, WidgetType } from '../core/index'
import { boardPinLabel } from '../sketch/boardpins'
import type { SketchInfo } from '../sketch/parse'

/** Название элемента в роли источника значения («← ползунок»). */
export const NOUN: Record<WidgetType, string> = {
  label: 'надпись',
  button: 'кнопка',
  switcher: 'переключатель',
  slider: 'ползунок',
  number: 'поле',
  text: 'поле',
  select: 'список',
  graph: 'график',
  separator: 'разделитель',
  pad: 'крестовина',
  padCenter: 'крестовина',
  password: 'пароль',
  time: 'время',
  fileDisplay: 'файл',
  accel: 'акселерометр'
}

export type BindState = 'none' | 'ok' | 'broken' | 'unbindable'

export interface BindInfo {
  state: BindState
  icon: 'link' | 'pin' | 'func' | 'warn'
  /** Источник: имя переменной / пина / функции. */
  source: string
  /** Куда идут данные: «→ показывает», «← ползунок», «⇄ переключатель». */
  arrow: string
  /** Готовый текст значка. */
  text: string
  /** Тип и строка для подсказки («float · строка 12»). */
  detail: string
  /** Направление для таблицы. */
  dir: 'toUi' | 'fromUi' | 'both' | 'none'
}

export const BINDING_ISSUE = /^(bind-|sketch-|fn-)/

export function canBind(type: WidgetType): boolean {
  const w = WIDGETS[type]
  return w.varToUi.length > 0 || w.varFromUi.length > 0 || w.pinToPin.length > 0 || w.pinFromPin.length > 0 || w.callback
}

export function bindInfo(el: UiElement, p: UiProject, sketch: SketchInfo | null, issues: Issue[]): BindInfo {
  const b = el.binding
  const noun = NOUN[el.type]
  const broken = issues.some((i) => i.elementId === el.id && i.severity === 'error' && BINDING_ISSUE.test(i.code))
  const mk = (x: Omit<BindInfo, 'state'> & { state?: BindState }): BindInfo => ({ ...x, state: broken ? 'broken' : (x.state ?? 'ok') })
  if (b.kind === 'none')
    return {
      state: canBind(el.type) ? 'none' : 'unbindable',
      icon: 'link',
      source: '',
      arrow: '',
      text: canBind(el.type) ? 'Не связано с кодом' : '',
      detail: '',
      dir: 'none'
    }
  if (b.kind === 'var') {
    if (!b.variable) return { state: 'broken', icon: 'warn', source: '', arrow: '', text: 'Выберите переменную', detail: '', dir: b.direction }
    const v = p.variables.find((x) => x.name === b.variable)
    const sv = sketch?.vars.find((x) => x.name === b.variable)
    const arrow = b.direction === 'toUi' ? '→ показывает' : b.direction === 'fromUi' ? `← ${noun}` : `⇄ ${noun}`
    const detail = sv ? `${sv.ctype} · строка ${sv.line}` : v ? `${v.type} · создана конструктором` : ''
    return mk({ icon: broken ? 'warn' : 'link', source: b.variable, arrow, text: `${b.variable} ${arrow}`, detail, dir: b.direction })
  }
  if (b.kind === 'pin') {
    if (!(b.pin >= 0)) return { state: 'broken', icon: 'warn', source: '', arrow: '', text: 'Выберите пин', detail: '', dir: 'none' }
    const label = b.pinName ? b.pinName : boardPinLabel(p.platform, b.pin)
    const arrow = b.direction === 'toPin' ? `← ${noun}` : '→ показывает'
    return mk({
      icon: broken ? 'warn' : 'pin',
      source: label,
      arrow,
      text: `${label} ${arrow}`,
      detail: b.pinName ? `GPIO${b.pin} · из скетча` : 'пин платы',
      dir: b.direction === 'toPin' ? 'fromUi' : 'toUi'
    })
  }
  if (!b.fn) return { state: 'broken', icon: 'warn', source: '', arrow: '', text: 'Выберите функцию', detail: '', dir: 'fromUi' }
  const f = sketch?.funcs.find((x) => x.name === b.fn)
  return mk({
    icon: broken ? 'warn' : 'func',
    source: `${b.fn}()`,
    arrow: `← ${noun}`,
    text: `${b.fn}() ← ${noun}`,
    detail: f ? `ваша функция · строка ${f.line}` : 'ваша функция',
    dir: 'fromUi'
  })
}

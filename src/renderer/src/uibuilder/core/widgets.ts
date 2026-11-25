// Каталог виджетов: свойства, допустимые привязки, соответствие ControlType ESPUI.
import type { Binding, ElementProps, VarType, WidgetType } from './types'

export type PropKind = 'color' | 'bool' | 'text' | 'int' | 'number' | 'options' | 'choice'

export interface PropDef {
  key: keyof ElementProps
  kind: PropKind
  title: string
  /** Для kind='choice': допустимые значения. */
  choices?: Array<{ value: string; title: string }>
}

export interface WidgetDef {
  type: WidgetType
  /** Название в палитре. */
  title: string
  description: string
  /** Префикс автоматически создаваемого идентификатора. */
  idPrefix: string
  defaultLabel: string
  defaultProps: ElementProps
  props: PropDef[]
  /** ControlType в ESPUI (enum ControlType из ESPUIcontrol.h). */
  espuiType: string
  /** События callback'а (константы ESPUI), если виджет их порождает. */
  events: string[]
  /** Типы переменных, которые виджет может показывать (device→UI). */
  varToUi: VarType[]
  /** Типы переменных, в которые виджет может писать (UI→device). */
  varFromUi: VarType[]
  /** UI→pin: допустимые режимы. */
  pinToPin: Array<'digital' | 'analog'>
  /** pin→UI: допустимые режимы. */
  pinFromPin: Array<'digital' | 'analog'>
  /** Допустима привязка «callback» (функция пользователя). */
  callback: boolean
  /** Экспериментальный/неполный во фронтенде ESPUI (предупреждение в валидаторе). */
  experimental?: boolean
  /** Палитра: группа. */
  group: 'show' | 'input' | 'control' | 'layout'
}

const common: PropDef[] = [
  { key: 'color', kind: 'color', title: 'Цвет' },
  { key: 'wide', kind: 'bool', title: 'На всю ширину' },
  { key: 'disabled', kind: 'bool', title: 'Отключён (setEnabled)' },
  { key: 'hidden', kind: 'bool', title: 'Скрыт (updateVisibility)' }
]

export const INPUT_TYPES: Array<{ value: string; title: string }> = [
  { value: 'text', title: 'Текст' },
  { value: 'date', title: 'Дата' },
  { value: 'time', title: 'Время' },
  { value: 'datetime-local', title: 'Дата и время' },
  { value: 'color', title: 'Цвет' },
  { value: 'email', title: 'E-mail' },
  { value: 'tel', title: 'Телефон' },
  { value: 'url', title: 'URL' },
  { value: 'number', title: 'Число' }
]

export const WIDGETS: Record<WidgetType, WidgetDef> = {
  label: {
    type: 'label',
    title: 'Label',
    description: 'Текстовая метка: показывает значение переменной или пина',
    idPrefix: 'lbl',
    defaultLabel: 'Значение',
    defaultProps: { color: 'Wetasphalt', initial: '', prefix: '', suffix: '', decimals: 2 },
    props: [
      ...common,
      { key: 'initial', kind: 'text', title: 'Начальный текст' },
      { key: 'prefix', kind: 'text', title: 'Префикс' },
      { key: 'suffix', kind: 'text', title: 'Суффикс' },
      { key: 'decimals', kind: 'int', title: 'Знаков после запятой (float)' }
    ],
    espuiType: 'Label',
    events: [],
    varToUi: ['bool', 'int', 'float', 'String'],
    varFromUi: [],
    pinToPin: [],
    pinFromPin: ['digital', 'analog'],
    callback: false,
    group: 'show'
  },
  button: {
    type: 'button',
    title: 'Button',
    description: 'Кнопка: нажатие/отпускание (B_DOWN / B_UP)',
    idPrefix: 'btn',
    defaultLabel: 'Кнопка',
    defaultProps: { color: 'Wetasphalt', text: 'Нажать' },
    props: [
      ...common,
      { key: 'text', kind: 'text', title: 'Текст на кнопке' },
      {
        key: 'action',
        kind: 'choice',
        title: 'Действие',
        choices: [
          { value: 'hold', title: 'Пока нажата' },
          { value: 'toggle', title: 'Переключать по нажатию' }
        ]
      }
    ],
    espuiType: 'Button',
    events: ['B_DOWN', 'B_UP'],
    varToUi: [],
    varFromUi: ['bool', 'int'],
    pinToPin: ['digital'],
    pinFromPin: [],
    callback: true,
    group: 'control'
  },
  switcher: {
    type: 'switcher',
    title: 'Switcher',
    description: 'Переключатель вкл/выкл (S_ACTIVE / S_INACTIVE)',
    idPrefix: 'sw',
    defaultLabel: 'Переключатель',
    defaultProps: { color: 'Wetasphalt', on: false },
    props: [
      ...common,
      { key: 'on', kind: 'bool', title: 'Включён по умолчанию' },
      { key: 'vertical', kind: 'bool', title: 'Вертикальный' }
    ],
    espuiType: 'Switcher',
    events: ['S_ACTIVE', 'S_INACTIVE'],
    varToUi: ['bool', 'int'],
    varFromUi: ['bool', 'int'],
    pinToPin: ['digital'],
    pinFromPin: ['digital'],
    callback: true,
    group: 'control'
  },
  slider: {
    type: 'slider',
    title: 'Slider',
    description: 'Ползунок (SL_VALUE), значение приходит строкой в sender->value',
    idPrefix: 'sld',
    defaultLabel: 'Ползунок',
    defaultProps: { color: 'Wetasphalt', min: 0, max: 100 },
    props: [
      ...common,
      { key: 'min', kind: 'number', title: 'Минимум' },
      { key: 'max', kind: 'number', title: 'Максимум' },
      { key: 'step', kind: 'number', title: 'Шаг' },
      { key: 'vertical', kind: 'bool', title: 'Вертикальный' }
    ],
    espuiType: 'Slider',
    events: ['SL_VALUE'],
    varToUi: ['int', 'float'],
    varFromUi: ['int', 'float'],
    pinToPin: ['analog'],
    pinFromPin: ['analog'],
    callback: true,
    group: 'control'
  },
  number: {
    type: 'number',
    title: 'Number',
    description: 'Числовое поле (N_VALUE) с min/max/step',
    idPrefix: 'num',
    defaultLabel: 'Число',
    defaultProps: { color: 'Wetasphalt', min: 0, max: 100, step: 1, decimals: 1 },
    props: [
      ...common,
      { key: 'min', kind: 'number', title: 'Минимум' },
      { key: 'max', kind: 'number', title: 'Максимум' },
      { key: 'step', kind: 'number', title: 'Шаг' },
      { key: 'decimals', kind: 'int', title: 'Знаков после запятой (float)' }
    ],
    espuiType: 'Number',
    events: ['N_VALUE'],
    varToUi: ['int', 'float'],
    varFromUi: ['int', 'float'],
    pinToPin: ['analog'],
    pinFromPin: ['analog', 'digital'],
    callback: true,
    group: 'input'
  },
  text: {
    type: 'text',
    title: 'Text',
    description: 'Поле ввода (T_VALUE); тип поля — setInputType: дата, время, цвет и др.',
    idPrefix: 'txt',
    defaultLabel: 'Текст',
    defaultProps: { color: 'Wetasphalt', initial: '' },
    props: [
      ...common,
      { key: 'initial', kind: 'text', title: 'Начальный текст' },
      { key: 'inputType', kind: 'choice', title: 'Тип поля', choices: INPUT_TYPES },
      { key: 'maxLength', kind: 'int', title: 'Макс. длина (maxlength)' }
    ],
    espuiType: 'Text',
    events: ['T_VALUE'],
    varToUi: ['String'],
    varFromUi: ['String'],
    pinToPin: [],
    pinFromPin: [],
    callback: true,
    group: 'input'
  },
  password: {
    type: 'password',
    title: 'Password',
    description: 'Поле пароля (ControlType::Password): в браузер уходит «--------», значение приходит в callback (T_VALUE)',
    idPrefix: 'pwd',
    defaultLabel: 'Пароль',
    defaultProps: { color: 'Wetasphalt' },
    props: [...common],
    espuiType: 'Password',
    events: ['T_VALUE'],
    varToUi: [],
    varFromUi: ['String'],
    pinToPin: [],
    pinFromPin: [],
    callback: true,
    group: 'input'
  },
  select: {
    type: 'select',
    title: 'Select',
    description: 'Выпадающий список (S_VALUE); значение — value выбранного Option',
    idPrefix: 'sel',
    defaultLabel: 'Выбор',
    defaultProps: {
      color: 'Wetasphalt',
      options: [
        { label: 'Вариант 1', value: '1' },
        { label: 'Вариант 2', value: '2' }
      ]
    },
    props: [
      ...common,
      { key: 'options', kind: 'options', title: 'Варианты' },
      { key: 'initial', kind: 'text', title: 'Выбран по умолчанию (value)' }
    ],
    espuiType: 'Select',
    events: ['S_VALUE'],
    varToUi: ['String', 'int'],
    varFromUi: ['String', 'int'],
    pinToPin: [],
    pinFromPin: [],
    callback: true,
    group: 'input'
  },
  pad: {
    type: 'pad',
    title: 'Pad',
    description: 'Крестовина из 4 стрелок: события P_FOR/P_BACK/P_LEFT/P_RIGHT _DOWN/_UP (отрицательные — нажатие)',
    idPrefix: 'pad',
    defaultLabel: 'Джойстик',
    defaultProps: { color: 'Wetasphalt' },
    props: [...common],
    espuiType: 'Pad',
    events: ['P_FOR_DOWN', 'P_FOR_UP', 'P_BACK_DOWN', 'P_BACK_UP', 'P_LEFT_DOWN', 'P_LEFT_UP', 'P_RIGHT_DOWN', 'P_RIGHT_UP'],
    varToUi: [],
    varFromUi: ['int'],
    pinToPin: [],
    pinFromPin: [],
    callback: true,
    group: 'control'
  },
  padCenter: {
    type: 'padCenter',
    title: 'Pad + центр',
    description: 'Крестовина с центральной кнопкой (PadWithCenter): добавляются P_CENTER_DOWN / P_CENTER_UP',
    idPrefix: 'padc',
    defaultLabel: 'Джойстик с центром',
    defaultProps: { color: 'Wetasphalt' },
    props: [...common],
    espuiType: 'PadWithCenter',
    events: [
      'P_FOR_DOWN', 'P_FOR_UP', 'P_BACK_DOWN', 'P_BACK_UP', 'P_LEFT_DOWN', 'P_LEFT_UP',
      'P_RIGHT_DOWN', 'P_RIGHT_UP', 'P_CENTER_DOWN', 'P_CENTER_UP'
    ],
    varToUi: [],
    varFromUi: ['int'],
    pinToPin: [],
    pinFromPin: [],
    callback: true,
    group: 'control'
  },
  graph: {
    type: 'graph',
    title: 'Graph',
    description: 'График (экспериментальный в ESPUI): точка добавляется каждый период обновления',
    idPrefix: 'gr',
    defaultLabel: 'График',
    defaultProps: { color: 'Wetasphalt', scale: 1 },
    props: [
      ...common,
      { key: 'scale', kind: 'number', title: 'Множитель (значение → int)' },
      { key: 'graphMs', kind: 'int', title: 'Период точек, мс (пусто — как у UI)' },
      { key: 'clearOnStart', kind: 'bool', title: 'Очищать при старте (clearGraph)' }
    ],
    espuiType: 'Graph',
    events: [],
    varToUi: ['bool', 'int', 'float'],
    varFromUi: [],
    pinToPin: [],
    pinFromPin: ['analog', 'digital'],
    callback: false,
    experimental: true,
    group: 'show'
  },
  time: {
    type: 'time',
    title: 'Time',
    description: 'Запрос времени у браузера (ControlType::Time): updateTime(id) → callback TM_VALUE со строкой времени',
    idPrefix: 'tm',
    defaultLabel: 'Время браузера',
    defaultProps: { color: 'Wetasphalt', pollSec: 60 },
    props: [...common, { key: 'pollSec', kind: 'int', title: 'Запрашивать каждые, сек (0 — не запрашивать)' }],
    espuiType: 'Time',
    events: ['TM_VALUE'],
    varToUi: [],
    varFromUi: ['String'],
    pinToPin: [],
    pinFromPin: [],
    callback: true,
    group: 'input'
  },
  fileDisplay: {
    type: 'fileDisplay',
    title: 'FileDisplay',
    description: 'Окно с текстом файла, который браузер подгружает по URL (например лог)',
    idPrefix: 'fd',
    defaultLabel: 'Файл',
    defaultProps: { color: 'Dark', file: '/log.txt' },
    props: [...common, { key: 'file', kind: 'text', title: 'Путь к файлу (URL)' }],
    espuiType: 'FileDisplay',
    events: [],
    varToUi: [],
    varFromUi: [],
    pinToPin: [],
    pinFromPin: [],
    callback: false,
    experimental: true,
    group: 'show'
  },
  accel: {
    type: 'accel',
    title: 'Accel',
    description: 'Акселерометр телефона (ControlType::Accel); во фронтенде ESPUI не завершён, формат callback не подтверждён',
    idPrefix: 'acc',
    defaultLabel: 'Акселерометр',
    defaultProps: { color: 'Wetasphalt' },
    props: [...common],
    espuiType: 'Accel',
    events: [],
    varToUi: [],
    varFromUi: [],
    pinToPin: [],
    pinFromPin: [],
    callback: true,
    experimental: true,
    group: 'input'
  },
  separator: {
    type: 'separator',
    title: 'Separator',
    description: 'Разделитель: следующие элементы начинаются с новой строки',
    idPrefix: 'sep',
    defaultLabel: '',
    defaultProps: {},
    props: [],
    espuiType: 'Separator',
    events: [],
    varToUi: [],
    varFromUi: [],
    pinToPin: [],
    pinFromPin: [],
    callback: false,
    group: 'layout'
  }
}

/** Порядок в палитре: прежние девять — без изменений, новые — следом. */
export const WIDGET_ORDER: WidgetType[] = [
  'label',
  'button',
  'switcher',
  'slider',
  'number',
  'text',
  'select',
  'graph',
  'separator',
  'pad',
  'padCenter',
  'password',
  'time',
  'fileDisplay',
  'accel'
]

export const WIDGET_GROUPS: Array<{ id: WidgetDef['group']; title: string }> = [
  { id: 'show', title: 'Показ' },
  { id: 'control', title: 'Управление' },
  { id: 'input', title: 'Ввод' },
  { id: 'layout', title: 'Структура' }
]

export function isWidgetType(s: unknown): s is WidgetType {
  return typeof s === 'string' && Object.prototype.hasOwnProperty.call(WIDGETS, s)
}

/** Типы привязок, доступные виджету. */
export function bindingKindsFor(type: WidgetType): Array<'none' | 'var' | 'pin' | 'callback'> {
  const w = WIDGETS[type]
  const out: Array<'none' | 'var' | 'pin' | 'callback'> = ['none']
  if (w.varToUi.length || w.varFromUi.length) out.push('var')
  if (w.pinToPin.length || w.pinFromPin.length) out.push('pin')
  if (w.callback) out.push('callback')
  return out
}

/** Допустимые направления привязки к переменной (с учётом типа, если известен). */
export function varDirectionsFor(
  type: WidgetType,
  varType?: VarType
): Array<'toUi' | 'fromUi' | 'both'> {
  const w = WIDGETS[type]
  const ok = (list: VarType[]): boolean => (varType ? list.includes(varType) : list.length > 0)
  const out: Array<'toUi' | 'fromUi' | 'both'> = []
  if (ok(w.varToUi)) out.push('toUi')
  if (ok(w.varFromUi)) out.push('fromUi')
  if (varType ? w.varToUi.includes(varType) && w.varFromUi.includes(varType) : w.varToUi.length && w.varFromUi.length)
    out.push('both')
  return out
}

/** Имя функции-обработчика по умолчанию: lblTemp → onLblTemp. */
export function defaultCallbackName(elementId?: string): string {
  if (!elementId) return 'onEvent'
  return 'on' + elementId.charAt(0).toUpperCase() + elementId.slice(1)
}

export function defaultBinding(type: WidgetType, kind: 'none' | 'var' | 'pin' | 'callback', elementId?: string): Binding {
  const w = WIDGETS[type]
  if (kind === 'var') {
    const dirs = varDirectionsFor(type)
    return { kind: 'var', variable: '', direction: dirs[0] ?? 'toUi' }
  }
  if (kind === 'pin') {
    if (w.pinToPin.length) return { kind: 'pin', pin: 2, direction: 'toPin', mode: w.pinToPin[0] }
    return { kind: 'pin', pin: 2, direction: 'fromPin', mode: w.pinFromPin[0] ?? 'digital' }
  }
  if (kind === 'callback') return { kind: 'callback', fn: defaultCallbackName(elementId) }
  return { kind: 'none' }
}

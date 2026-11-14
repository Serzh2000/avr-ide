// Описание типов блоков: подписи, контейнеры, правила привязок, значения по умолчанию.
import type { BlockProps, BlockStyle, BlockType, VarType } from './types'

export type BindDir = 'toUi' | 'fromUi' | 'both'

export interface PinRule {
  direction: 'toPin' | 'fromPin'
  modes: Array<'digital' | 'analog'>
}

export interface BindRule {
  vars: VarType[]
  dirs: BindDir[]
  pins: PinRule[]
}

export interface BlockDef {
  type: BlockType
  title: string
  group: 'layout' | 'content' | 'control' | 'display'
  container: boolean
  /** Нет правила — привязка невозможна. */
  bind?: BindRule
  props: BlockProps
  style: BlockStyle
}

const ANY: VarType[] = ['bool', 'int', 'float', 'String']
const NUM: VarType[] = ['int', 'float']

export const BLOCKS: Record<BlockType, BlockDef> = {
  section: {
    type: 'section', title: 'Секция', group: 'layout', container: true,
    props: {}, style: { padding: 32 }
  },
  grid: {
    type: 'grid', title: 'Сетка', group: 'layout', container: true,
    props: { columns: 3 }, style: { gap: 16 }
  },
  flex: {
    type: 'flex', title: 'Flex-ряд', group: 'layout', container: true,
    props: { direction: 'row', wrap: true, justify: 'start', alignItems: 'center' }, style: { gap: 12 }
  },
  card: {
    type: 'card', title: 'Карточка', group: 'layout', container: true,
    props: { label: 'Карточка' },
    style: { bg: 'surface', padding: 20, radius: 16, borderWidth: 1, borderColor: 'border', shadow: 'sm', gap: 12, anim: 'slide-up' }
  },
  heading: {
    type: 'heading', title: 'Заголовок', group: 'content', container: false,
    props: { text: 'Заголовок', level: 2 }, style: {},
    bind: { vars: ANY, dirs: ['toUi'], pins: [] }
  },
  text: {
    type: 'text', title: 'Текст', group: 'content', container: false,
    props: { text: 'Текст абзаца' }, style: {},
    bind: { vars: ANY, dirs: ['toUi'], pins: [] }
  },
  button: {
    type: 'button', title: 'Кнопка', group: 'control', container: false,
    props: { text: 'Кнопка', action: 'momentary' }, style: {},
    bind: { vars: ANY, dirs: ['fromUi'], pins: [{ direction: 'toPin', modes: ['digital'] }] }
  },
  switch: {
    type: 'switch', title: 'Переключатель', group: 'control', container: false,
    props: { label: 'Включить' }, style: {},
    bind: { vars: ['bool'], dirs: ['fromUi', 'both'], pins: [{ direction: 'toPin', modes: ['digital'] }] }
  },
  slider: {
    type: 'slider', title: 'Ползунок', group: 'control', container: false,
    props: { label: 'Значение', min: 0, max: 100, step: 1, unit: '' }, style: {},
    bind: { vars: NUM, dirs: ['fromUi', 'both'], pins: [{ direction: 'toPin', modes: ['analog'] }] }
  },
  input: {
    type: 'input', title: 'Поле ввода', group: 'control', container: false,
    props: { label: 'Поле', inputType: 'text', placeholder: '' }, style: {},
    bind: { vars: ['int', 'float', 'String'], dirs: ['fromUi', 'both'], pins: [] }
  },
  color: {
    type: 'color', title: 'Выбор цвета', group: 'control', container: false,
    props: { label: 'Цвет' }, style: {},
    bind: { vars: ['String'], dirs: ['fromUi', 'both'], pins: [] }
  },
  sensor: {
    type: 'sensor', title: 'Датчик', group: 'display', container: false,
    props: { label: 'Датчик', unit: '', decimals: 1, icon: 'thermometer', min: 0, max: 100 },
    style: {},
    bind: {
      vars: ANY, dirs: ['toUi'],
      pins: [{ direction: 'fromPin', modes: ['analog', 'digital'] }]
    }
  },
  indicator: {
    type: 'indicator', title: 'Индикатор', group: 'display', container: false,
    props: { label: 'Состояние', onText: 'Вкл', offText: 'Выкл' }, style: {},
    bind: { vars: ['bool', 'int'], dirs: ['toUi'], pins: [{ direction: 'fromPin', modes: ['digital'] }] }
  },
  gauge: {
    type: 'gauge', title: 'Gauge (SVG)', group: 'display', container: false,
    props: { label: 'Значение', min: 0, max: 100, unit: '', decimals: 0 }, style: {},
    bind: { vars: NUM, dirs: ['toUi'], pins: [{ direction: 'fromPin', modes: ['analog'] }] }
  },
  progress: {
    type: 'progress', title: 'Прогресс', group: 'display', container: false,
    props: { label: 'Заряд', min: 0, max: 100, unit: '%', decimals: 0 }, style: {},
    bind: { vars: NUM, dirs: ['toUi'], pins: [{ direction: 'fromPin', modes: ['analog'] }] }
  },
  chart: {
    type: 'chart', title: 'График (canvas)', group: 'display', container: false,
    props: { label: 'График', points: 60, min: 0, max: 100, fill: true, decimals: 1, unit: '' }, style: { minHeight: 160 },
    bind: { vars: NUM, dirs: ['toUi'], pins: [{ direction: 'fromPin', modes: ['analog'] }] }
  },
  image: {
    type: 'image', title: 'Изображение', group: 'content', container: false,
    props: { src: '', alt: '' }, style: { radius: 12 }
  },
  icon: {
    type: 'icon', title: 'Иконка', group: 'content', container: false,
    props: { icon: 'bulb', iconSize: 32 }, style: { color: 'primary' }
  },
  divider: {
    type: 'divider', title: 'Разделитель', group: 'layout', container: false,
    props: {}, style: { margin: 8 }
  }
}

export const BLOCK_ORDER: BlockType[] = [
  'section', 'grid', 'flex', 'card', 'heading', 'text', 'icon', 'image', 'divider',
  'button', 'switch', 'slider', 'input', 'color',
  'sensor', 'indicator', 'gauge', 'progress', 'chart'
]

export const GROUP_TITLES: Record<BlockDef['group'], string> = {
  layout: 'Раскладка',
  content: 'Содержимое',
  control: 'Управление',
  display: 'Показ данных'
}

export function isContainer(t: BlockType): boolean {
  return Object.prototype.hasOwnProperty.call(BLOCKS, t) && BLOCKS[t].container === true
}

/** Направления привязки, поддерживаемые блоком. */
export function bindRule(t: BlockType): BindRule | undefined {
  return Object.prototype.hasOwnProperty.call(BLOCKS, t) ? BLOCKS[t].bind : undefined
}

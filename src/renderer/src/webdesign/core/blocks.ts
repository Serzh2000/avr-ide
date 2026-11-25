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
  group: 'layout' | 'content' | 'control' | 'display' | 'site'
  container: boolean
  /** Нет правила — привязка невозможна. */
  bind?: BindRule
  props: BlockProps
  style: BlockStyle
  /** Дочерние блоки, создаваемые вместе с блоком. */
  defaultChildren?: Array<{ type: BlockType; props?: BlockProps }>
  /** Допустимые типы детей (если ограничено). */
  childTypes?: BlockType[]
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
    type: 'flex', title: 'Ряд', group: 'layout', container: true,
    props: { direction: 'row', wrap: true, justify: 'start', alignItems: 'center' }, style: { gap: 12 }
  },
  card: {
    type: 'card', title: 'Карточка', group: 'layout', container: true,
    props: { label: 'Карточка' },
    style: { bg: 'surface', padding: 20, radius: 12, borderWidth: 1, borderColor: 'border', shadow: 'none', gap: 12 }
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
    type: 'gauge', title: 'Круговой индикатор', group: 'display', container: false,
    props: { label: 'Значение', min: 0, max: 100, unit: '', decimals: 0 }, style: {},
    bind: { vars: NUM, dirs: ['toUi'], pins: [{ direction: 'fromPin', modes: ['analog'] }] }
  },
  progress: {
    type: 'progress', title: 'Прогресс', group: 'display', container: false,
    props: { label: 'Заряд', min: 0, max: 100, unit: '%', decimals: 0 }, style: {},
    bind: { vars: NUM, dirs: ['toUi'], pins: [{ direction: 'fromPin', modes: ['analog'] }] }
  },
  chart: {
    type: 'chart', title: 'График', group: 'display', container: false,
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
  },
  select: {
    type: 'select', title: 'Выпадающий список', group: 'control', container: false,
    props: { label: 'Выбор', options: 'a|Вариант A\nb|Вариант B\nc|Вариант C' }, style: {},
    bind: { vars: ['int', 'float', 'String'], dirs: ['fromUi', 'both'], pins: [] }
  },
  checkbox: {
    type: 'checkbox', title: 'Флажок', group: 'control', container: false,
    props: { label: 'Включено' }, style: {},
    bind: { vars: ['bool'], dirs: ['fromUi', 'both'], pins: [{ direction: 'toPin', modes: ['digital'] }] }
  },
  radio: {
    type: 'radio', title: 'Радио-группа', group: 'control', container: false,
    props: { label: 'Режим', options: '0|Авто\n1|Ручной\n2|Ночной' }, style: {},
    bind: { vars: ['int', 'float', 'String'], dirs: ['fromUi', 'both'], pins: [] }
  },
  textarea: {
    type: 'textarea', title: 'Многострочное поле', group: 'control', container: false,
    props: { label: 'Текст', lines: 4, placeholder: '' }, style: {},
    bind: { vars: ['String'], dirs: ['fromUi', 'both'], pins: [] }
  },
  log: {
    type: 'log', title: 'Консоль логов', group: 'display', container: false,
    props: { label: 'Журнал', lines: 100 }, style: { minHeight: 160 },
    bind: { vars: ['String'], dirs: ['toUi'], pins: [] }
  },
  navbar: {
    type: 'navbar', title: 'Навигация (navbar)', group: 'site', container: true,
    props: { brand: 'Моё устройство', icon: 'home', sticky: true },
    style: { bg: 'surface', padding: 12, borderWidth: 1, borderColor: 'border', shadow: 'sm' },
    defaultChildren: [{ type: 'link', props: { text: 'Главная', href: '#' } }, { type: 'link', props: { text: 'О проекте', href: '#' } }]
  },
  footer: {
    type: 'footer', title: 'Подвал (footer)', group: 'site', container: true,
    props: { text: '© 2026 Моё устройство' }, style: { padding: 24, align: 'center', color: 'muted' }
  },
  tabs: {
    type: 'tabs', title: 'Вкладки', group: 'site', container: true,
    props: {}, style: {}, childTypes: ['panel'],
    defaultChildren: [{ type: 'panel', props: { label: 'Вкладка 1' } }, { type: 'panel', props: { label: 'Вкладка 2' } }]
  },
  accordion: {
    type: 'accordion', title: 'Аккордеон', group: 'site', container: true,
    props: {}, style: {}, childTypes: ['panel'],
    defaultChildren: [{ type: 'panel', props: { label: 'Раздел 1' } }, { type: 'panel', props: { label: 'Раздел 2' } }]
  },
  panel: {
    type: 'panel', title: 'Панель вкладки', group: 'site', container: true,
    props: { label: 'Панель' }, style: { gap: 12, padding: 12 }
  },
  table: {
    type: 'table', title: 'Таблица', group: 'display', container: false,
    props: { label: '', rows: 'Параметр|Значение\nТемпература|{temp} °C\nВлажность|{hum} %' }, style: {}
  },
  list: {
    type: 'list', title: 'Список', group: 'content', container: false,
    props: { rows: 'Первый пункт\nВторой пункт\nТретий пункт' }, style: {}
  },
  link: {
    type: 'link', title: 'Ссылка', group: 'site', container: false,
    props: { text: 'Ссылка', href: '#', variant: 'link' }, style: {}
  },
  badge: {
    type: 'badge', title: 'Бейдж', group: 'display', container: false,
    props: { text: 'Новое', soft: true }, style: {},
    bind: { vars: ANY, dirs: ['toUi'], pins: [] }
  },
  modal: {
    type: 'modal', title: 'Модальное окно', group: 'site', container: true,
    props: { text: 'Открыть', label: 'Заголовок окна' }, style: { gap: 12 }
  },
  pad: {
    type: 'pad', title: 'Джойстик / крестовина', group: 'control', container: false,
    props: { label: 'Управление', padMode: 'dpad' }, style: {},
    bind: { vars: ['String'], dirs: ['fromUi'], pins: [] }
  },
  clock: {
    type: 'clock', title: 'Часы / таймер', group: 'display', container: false,
    props: { label: 'Время', clockMode: 'browser', showSeconds: true, showDate: true }, style: {},
    bind: { vars: NUM, dirs: ['toUi'], pins: [] }
  },
  custom: {
    type: 'custom', title: 'Свой HTML/CSS', group: 'site', container: false,
    props: { html: '<p>Свой <b>HTML</b></p>', css: '' }, style: {}
  },
  wifisetup: {
    type: 'wifisetup', title: 'Настройка WiFi', group: 'site', container: false,
    props: { label: 'Настройка WiFi', text: 'Сохранить' }, style: {}
  },
  ota: {
    type: 'ota', title: 'Обновление прошивки (OTA)', group: 'site', container: false,
    props: { label: 'Обновление прошивки', path: '/update', text: 'Загрузить' }, style: {}
  }
}

export const BLOCK_ORDER: BlockType[] = [
  'section', 'grid', 'flex', 'card', 'heading', 'text', 'icon', 'image', 'divider',
  'button', 'switch', 'slider', 'input', 'color',
  'sensor', 'indicator', 'gauge', 'progress', 'chart',
  'select', 'checkbox', 'radio', 'textarea', 'pad', 'log', 'table', 'list', 'badge', 'clock',
  'navbar', 'footer', 'tabs', 'accordion', 'panel', 'link', 'modal', 'custom', 'wifisetup', 'ota'
]

export const GROUP_TITLES: Record<BlockDef['group'], string> = {
  layout: 'Раскладка',
  content: 'Содержимое',
  control: 'Управление',
  display: 'Показ данных',
  site: 'Сайт и навигация'
}

export function isContainer(t: BlockType): boolean {
  return Object.prototype.hasOwnProperty.call(BLOCKS, t) && BLOCKS[t].container === true
}

/** Направления привязки, поддерживаемые блоком. */
export function bindRule(t: BlockType): BindRule | undefined {
  return Object.prototype.hasOwnProperty.call(BLOCKS, t) ? BLOCKS[t].bind : undefined
}

/** Можно ли положить блок child в контейнер parent. */
export function canContain(parent: BlockType, child: BlockType): boolean {
  if (!isContainer(parent)) return false
  if (child === 'section') return false
  const only = BLOCKS[parent].childTypes
  if (only) return only.includes(child)
  if (child === 'panel') return false
  return true
}

// Готовые шаблоны сайтов.
import { createBlock, createProject } from './factory'
import { MORE_TEMPLATES } from './templates_more'
import type { Binding, Block, BlockProps, BlockStyle, BlockType, Platform, WdProject } from './types'

interface Opts {
  props?: BlockProps
  style?: BlockStyle
  binding?: Binding
  children?: Block[]
  responsive?: Block['responsive']
}

function B(type: BlockType, id: string, o: Opts = {}): Block {
  const b = createBlock(type, id)
  b.props = { ...b.props, ...o.props }
  b.style = { ...b.style, ...o.style }
  if (o.binding) b.binding = o.binding
  if (o.children) b.children = o.children
  if (o.responsive) b.responsive = o.responsive
  return b
}

const v = (variable: string, direction: 'toUi' | 'fromUi' | 'both'): Binding => ({ kind: 'var', variable, direction })
const pin = (n: number, direction: 'toPin' | 'fromPin', mode: 'digital' | 'analog', invert = false): Binding => ({
  kind: 'pin', pin: n, direction, mode, invert: invert || undefined
})

function hero(id: string, title: string, sub: string, _from?: string, _to?: string): Block {
  // Спокойная шапка страницы: плоский фон поверхности, заголовок слева, без градиента и анимаций.
  return B('section', id, {
    style: { bg: 'surface', color: 'text', align: 'left', padding: 28, gap: 4, borderWidth: 1, borderColor: 'border', radius: 12 },
    responsive: { mobile: { padding: 20 } },
    children: [
      B('heading', `${id}_h`, { props: { text: title, level: 1 } }),
      B('text', `${id}_t`, { props: { text: sub }, style: { color: 'muted' } })
    ]
  })
}

const HOVER = { shadow: 'sm' as const }

export type TemplateCategory = 'home' | 'garden' | 'safety' | 'control' | 'service'

/** Категории для группировки в списке шаблонов (порядок = порядок показа). */
export const TEMPLATE_CATEGORIES: Array<{ id: TemplateCategory; title: string }> = [
  { id: 'home', title: 'Дом и свет' },
  { id: 'garden', title: 'Климат, сад и вода' },
  { id: 'safety', title: 'Энергия и безопасность' },
  { id: 'control', title: 'Управление и роботы' },
  { id: 'service', title: 'Сервис и сайты' }
]

export interface Template {
  id: string
  category: TemplateCategory
  title: string
  description: string
  /** Короткие теги для поиска и подсказки (блоки, тема, особенности). */
  tags: string[]
  build: (platform: Platform) => WdProject
}

function relayPanel(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Панель реле'
  const pins = platform === 'esp32' ? [16, 17, 18, 19] : [5, 4, 14, 12]
  p.variables = [
    { name: 'uptime', type: 'int', init: '0' },
    { name: 'rssi', type: 'int', init: '-60' }
  ]
  const relayCard = (i: number, name: string, icon: 'bulb' | 'fan' | 'power' | 'bolt'): Block =>
    B('card', `relay${i}`, {
      props: { label: '' },
      style: { hover: HOVER, transitionMs: 200 },
      children: [
        B('flex', `relay${i}_row`, {
          props: { justify: 'between' },
          children: [
            B('icon', `relay${i}_ic`, { props: { icon, iconSize: 34 } }),
            B('switch', `relay${i}_sw`, { props: { label: name }, binding: pin(pins[i - 1], 'toPin', 'digital', true) })
          ]
        })
      ]
    })
  p.blocks = [
    hero('hero', 'Панель реле', 'Управляйте нагрузкой с любого устройства в вашей сети', '#4f6df5', '#8b5cf6'),
    B('section', 'relays', {
      children: [
        B('grid', 'relay_grid', {
          props: { columns: 2 },
          children: [relayCard(1, 'Свет в комнате', 'bulb'), relayCard(2, 'Вентилятор', 'fan'), relayCard(3, 'Розетка', 'power'), relayCard(4, 'Насос', 'bolt')]
        })
      ]
    }),
    B('section', 'info', {
      style: { padding: 24 },
      children: [
        B('grid', 'info_grid', {
          props: { columns: 2 },
          children: [
            B('card', 'c_up', { props: { label: '' }, children: [B('sensor', 'up', { props: { label: 'Аптайм', unit: 'с', decimals: 0, icon: 'gauge' }, binding: v('uptime', 'toUi') })] }),
            B('card', 'c_rssi', { props: { label: '' }, children: [B('sensor', 'rssi_s', { props: { label: 'Сигнал WiFi', unit: 'дБм', decimals: 0, icon: 'wifi', min: -90, max: -30 }, binding: v('rssi', 'toUi') })] })
          ]
        })
      ]
    })
  ]
  return p
}

function weather(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Метеостанция'
  p.page.theme.radius = 18
  p.variables = [
    { name: 'temp', type: 'float', init: '22.5' },
    { name: 'hum', type: 'float', init: '45' },
    { name: 'pres', type: 'float', init: '1013' },
    { name: 'lux', type: 'int', init: '300' },
    { name: 'rain', type: 'bool', init: 'false' }
  ]
  const gaugeCard = (id: string, label: string, variable: string, min: number, max: number, unit: string, d: number): Block =>
    B('card', `${id}_c`, {
      props: { label: '' },
      style: { hover: HOVER, transitionMs: 200 },
      children: [B('gauge', id, { props: { label, min, max, unit, decimals: d }, binding: v(variable, 'toUi') })]
    })
  p.blocks = [
    hero('hero', 'Метеостанция', 'Данные датчиков в реальном времени', '#0ea5e9', '#4f6df5'),
    B('section', 'now', {
      children: [
        B('grid', 'g', {
          props: { columns: 3 },
          children: [
            gaugeCard('g_t', 'Температура', 'temp', -20, 50, '°C', 1),
            gaugeCard('g_h', 'Влажность', 'hum', 0, 100, '%', 0),
            B('card', 'c_p', {
              props: { label: '' },
              style: { hover: HOVER, transitionMs: 200 },
              children: [
                B('sensor', 's_p', { props: { label: 'Давление', unit: 'гПа', decimals: 0, icon: 'cloud', min: 950, max: 1050 }, binding: v('pres', 'toUi') }),
                B('divider', 'd1'),
                B('sensor', 's_l', { props: { label: 'Освещённость', unit: 'лк', decimals: 0, icon: 'sun' }, binding: v('lux', 'toUi') })
              ]
            })
          ]
        }),
        B('card', 'c_chart', {
          props: { label: 'Температура за последнюю минуту' },
          children: [B('chart', 'ch', { props: { label: 'Температура', min: 0, max: 40, unit: '°C', points: 60 }, binding: v('temp', 'toUi') })]
        }),
        B('card', 'c_rain', {
          props: { label: '' },
          children: [B('indicator', 'rain_i', { props: { label: 'Дождь', onText: 'идёт', offText: 'нет' }, binding: v('rain', 'toUi') })]
        })
      ]
    })
  ]
  return p
}

function smartHome(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Умный дом'
  p.page.theme.font = 'rounded'
  p.page.theme.radius = 20
  p.variables = [
    { name: 'light_living', type: 'bool', init: 'false' },
    { name: 'light_kitchen', type: 'bool', init: 'false' },
    { name: 'fan', type: 'bool', init: 'false' },
    { name: 'target', type: 'int', init: '22' },
    { name: 'temp', type: 'float', init: '21.5' },
    { name: 'door', type: 'bool', init: 'false' },
    { name: 'motion', type: 'bool', init: 'false' },
    { name: 'scene', type: 'String', init: 'home' }
  ]
  const scene = (id: string, text: string, value: string): Block =>
    B('button', id, { props: { text, action: 'send', value }, binding: v('scene', 'fromUi'), style: { hover: { scale: 1.05 }, transitionMs: 150 } })
  p.blocks = [
    hero('hero', 'Добро пожаловать домой', 'Свет, климат и безопасность — в одном месте', '#f97316', '#db2777'),
    B('section', 'scenes', {
      style: { padding: 20 },
      children: [
        B('flex', 'scene_row', {
          props: { justify: 'center' },
          children: [scene('sc_home', 'Дома', 'home'), scene('sc_away', 'Ушёл', 'away'), scene('sc_night', 'Ночь', 'night')]
        })
      ]
    }),
    B('section', 'rooms', {
      children: [
        B('grid', 'rg', {
          props: { columns: 3 },
          children: [
            B('card', 'k_living', {
              props: { label: 'Гостиная' },
              style: { hover: HOVER, transitionMs: 200 },
              children: [
                B('icon', 'i_l', { props: { icon: 'bulb', iconSize: 36 }, style: { color: 'warning' } }),
                B('switch', 'sw_l', { props: { label: 'Свет' }, binding: v('light_living', 'both') })
              ]
            }),
            B('card', 'k_kitchen', {
              props: { label: 'Кухня' },
              style: { hover: HOVER, transitionMs: 200 },
              children: [
                B('switch', 'sw_k', { props: { label: 'Свет' }, binding: v('light_kitchen', 'both') }),
                B('switch', 'sw_f', { props: { label: 'Вытяжка' }, binding: v('fan', 'both') })
              ]
            }),
            B('card', 'k_climate', {
              props: { label: 'Климат' },
              style: { hover: HOVER, transitionMs: 200 },
              children: [
                B('sensor', 's_t', { props: { label: 'Сейчас', unit: '°C', decimals: 1, icon: 'thermometer' }, binding: v('temp', 'toUi') }),
                B('slider', 'sl_t', { props: { label: 'Желаемая', min: 16, max: 30, step: 1, unit: '°C' }, binding: v('target', 'both') })
              ]
            })
          ]
        }),
        B('card', 'k_sec', {
          props: { label: 'Безопасность' },
          children: [
            B('flex', 'sec_row', {
              props: { justify: 'start' },
              style: { gap: 28 },
              children: [
                B('indicator', 'in_door', { props: { label: 'Дверь', onText: 'открыта', offText: 'закрыта' }, binding: v('door', 'toUi') }),
                B('indicator', 'in_motion', { props: { label: 'Движение', onText: 'есть', offText: 'нет' }, binding: v('motion', 'toUi') })
              ]
            })
          ]
        })
      ]
    })
  ]
  return p
}

function rgbStrip(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'RGB-лента'
  p.page.theme.mode = 'dark'
  p.page.theme.font = 'rounded'
  p.page.theme.dark = {
    bg: '#0f1117', surface: '#171a22', text: '#eceef4', muted: '#9aa1b2', primary: '#8b93ff',
    accent: '#a5b4fc', success: '#4ade80', warning: '#facc15', danger: '#fb7185', border: '#2a2f3b'
  }
  p.variables = [
    { name: 'power', type: 'bool', init: 'true' },
    { name: 'color', type: 'String', init: '#8b93ff' },
    { name: 'brightness', type: 'int', init: '180' },
    { name: 'speed', type: 'int', init: '50' },
    { name: 'effect', type: 'String', init: 'static' }
  ]
  const fx = (id: string, text: string, value: string): Block =>
    B('button', id, {
      props: { text, action: 'send', value },
      binding: v('effect', 'fromUi'),
      style: { bg: 'primary', color: '#ffffff', hover: { shadow: 'sm' }, transitionMs: 160 }
    })
  p.blocks = [
    hero('hero', 'RGB-лента', 'Цвет, яркость и эффекты', '#7c3aed', '#06b6d4'),
    B('section', 'ctl', {
      children: [
        B('grid', 'cg', {
          props: { columns: 2 },
          children: [
            B('card', 'c_main', {
              props: { label: 'Основное' },
              children: [
                B('switch', 'sw_pw', { props: { label: 'Питание' }, binding: v('power', 'both') }),
                B('color', 'col', { props: { label: 'Цвет' }, binding: v('color', 'both') }),
                B('slider', 'sl_br', { props: { label: 'Яркость', min: 0, max: 255, step: 1 }, binding: v('brightness', 'both') })
              ]
            }),
            B('card', 'c_fx', {
              props: { label: 'Эффекты' },
              children: [
                B('flex', 'fx_row', { children: [fx('fx_st', 'Статика', 'static'), fx('fx_rb', 'Радуга', 'rainbow'), fx('fx_br', 'Дыхание', 'breath'), fx('fx_fl', 'Огонь', 'fire')] }),
                B('slider', 'sl_sp', { props: { label: 'Скорость', min: 1, max: 100, step: 1, unit: '%' }, binding: v('speed', 'both') })
              ]
            })
          ]
        })
      ]
    })
  ]
  return p
}


function siteTemplate(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Сайт устройства'
  p.pages = [{ id: 'home', title: 'Главная' }, { id: 'settings', title: 'Настройки' }]
  p.variables = [
    { name: 'temp', type: 'float', init: '22.5' },
    { name: 'hum', type: 'float', init: '45' },
    { name: 'uptime', type: 'int', init: '0' },
    { name: 'mode', type: 'String', init: '0' },
    { name: 'logline', type: 'String', init: '' },
    { name: 'wifi_ssid', type: 'String', init: '' },
    { name: 'wifi_pass', type: 'String', init: '' },
    { name: 'wifi_save', type: 'bool', init: 'false' }
  ]
  const panel = (id: string, label: string, kids: Block[]): Block => B('panel', id, { props: { label }, children: kids })
  const nav = B('navbar', 'nav', {
    props: { brand: 'Умная теплица', icon: 'home', sticky: true },
    children: [
      B('link', 'nav_home', { props: { text: 'Главная', page: 'home' } }),
      B('link', 'nav_set', { props: { text: 'Настройки', page: 'settings' } })
    ]
  })
  nav.page = '*'
  const home = B('section', 'home_s', {
    children: [
      B('heading', 'h_home', { props: { text: 'Состояние теплицы', level: 1 } }),
      B('flex', 'badges', { children: [
        B('badge', 'bd_mode', { props: { text: 'Режим', soft: true }, binding: v('mode', 'toUi') }),
        B('badge', 'bd_new', { props: { text: 'Онлайн', soft: false }, style: { bg: 'success' } })
      ] }),
      B('grid', 'cards', { props: { columns: 3 }, children: [
        B('card', 'c_t', { props: { label: '' }, style: { hover: HOVER, transitionMs: 200 }, children: [B('gauge', 'g_t', { props: { label: 'Температура', min: -10, max: 50, unit: '°C', decimals: 1 }, binding: v('temp', 'toUi') })] }),
        B('card', 'c_h', { props: { label: '' }, style: { hover: HOVER, transitionMs: 200 }, children: [B('sensor', 's_h', { props: { label: 'Влажность', unit: '%', decimals: 0, icon: 'droplet' }, binding: v('hum', 'toUi') })] }),
        B('card', 'c_u', { props: { label: '' }, style: { hover: HOVER, transitionMs: 200 }, children: [B('clock', 'clk', { props: { label: 'Аптайм', clockMode: 'uptime' }, binding: v('uptime', 'toUi') })] })
      ] }),
      B('card', 'c_tabs', { props: { label: '' }, children: [
        B('tabs', 'tb', { children: [
          panel('tb_data', 'Данные', [B('table', 'tbl', { props: { label: '', rows: 'Параметр|Значение\nТемпература|{temp} °C\nВлажность|{hum} %\nАптайм|{uptime} с' } })]),
          panel('tb_log', 'Журнал', [B('log', 'lg', { props: { label: 'События', lines: 50 }, binding: v('logline', 'toUi') })])
        ] })
      ] }),
      B('accordion', 'faq', { children: [
        panel('faq1', 'Как это работает?', [B('text', 'faq1_t', { props: { text: 'Страница лежит во флеше ESP и общается с прошивкой по WebSocket.' } })]),
        panel('faq2', 'Что умеет блок «Таблица»?', [B('list', 'faq2_l', { props: { rows: 'Подставляет {temp} из переменных\nОбновляется сама' } })])
      ] }),
      B('modal', 'about', { props: { text: 'О проекте', label: 'О проекте' }, children: [B('text', 'about_t', { props: { text: 'Сайт собран в веб-конструкторе AVR IDE.' } })] })
    ]
  })
  home.page = 'home'
  const settings = B('section', 'set_s', {
    children: [
      B('heading', 'h_set', { props: { text: 'Настройки', level: 1 } }),
      B('grid', 'set_g', { props: { columns: 2 }, children: [
        B('card', 'c_w', { props: { label: '' }, children: [B('wifisetup', 'wf', { props: { label: 'Подключение к WiFi', text: 'Сохранить', varSsid: 'wifi_ssid', varPass: 'wifi_pass', varSave: 'wifi_save' } })] }),
        B('card', 'c_o', { props: { label: '' }, children: [B('ota', 'ota1', { props: { label: 'Обновление прошивки', path: '/update', text: 'Загрузить' } })] })
      ] })
    ]
  })
  settings.page = 'settings'
  const foot = B('footer', 'foot', { props: { text: '© 2026 Умная теплица' } })
  foot.page = '*'
  p.blocks = [nav, home, settings, foot]
  return p
}

function remote(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Пульт робота'
  p.page.theme.font = 'rounded'
  p.variables = [
    { name: 'drive', type: 'String', init: 'stop' },
    { name: 'speed_mode', type: 'int', init: '1' },
    { name: 'program', type: 'String', init: 'manual' },
    { name: 'lights', type: 'bool', init: 'false' },
    { name: 'note', type: 'String', init: '' },
    { name: 'robot_log', type: 'String', init: '' },
    { name: 'steer', type: 'String', init: '0,0' }
  ]
  p.blocks = [
    hero('hero', 'Пульт робота', 'Крестовина, режимы и журнал событий', '#0ea5e9', '#7c3aed'),
    B('section', 'ctl', {
      children: [
        B('grid', 'cg', { props: { columns: 2 }, children: [
          B('card', 'c_pad', { props: { label: 'Движение' }, children: [
            B('pad', 'pad1', { props: { label: '', padMode: 'dpad', releaseValue: 'stop' }, binding: v('drive', 'fromUi') }),
            B('pad', 'pad2', { props: { label: 'Джойстик', padMode: 'joystick' }, binding: v('steer', 'fromUi') }),
            B('radio', 'speed', { props: { label: 'Скорость', options: '0|Медленно\n1|Средне\n2|Быстро' }, binding: v('speed_mode', 'both') })
          ] }),
          B('card', 'c_set', { props: { label: 'Режимы' }, children: [
            B('select', 'prog', { props: { label: 'Программа', options: 'manual|Ручной\nline|Следование по линии\npatrol|Патруль' }, binding: v('program', 'both') }),
            B('checkbox', 'cb_l', { props: { label: 'Фары' }, binding: v('lights', 'both') }),
            B('textarea', 'ta', { props: { label: 'Заметка', lines: 3 }, binding: v('note', 'fromUi') }),
            B('clock', 'clk', { props: { label: 'Время', clockMode: 'browser', showSeconds: true, showDate: true } })
          ] })
        ] }),
        B('card', 'c_log', { props: { label: '' }, children: [B('log', 'lg', { props: { label: 'Журнал робота', lines: 100 }, binding: v('robot_log', 'toUi') })] })
      ]
    })
  ]
  return p
}

const BASE_TEMPLATES: Template[] = [
  { id: 'relays', category: 'home', title: 'Панель реле', description: '4 реле на пинах, аптайм и уровень WiFi', tags: ['реле', 'пины'], build: relayPanel },
  { id: 'weather', category: 'garden', title: 'Метеостанция', description: 'Gauge, график, датчики и индикатор дождя', tags: ['gauge', 'график'], build: weather },
  { id: 'smarthome', category: 'home', title: 'Умный дом', description: 'Сцены, комнаты, климат и безопасность', tags: ['сцены', 'климат'], build: smartHome },
  { id: 'rgb', category: 'home', title: 'RGB-лента', description: 'Цвет, яркость, эффекты — тёмная тема', tags: ['цвет', 'тёмная'], build: rgbStrip },
  { id: 'site', category: 'service', title: 'Сайт устройства (2 страницы)', description: 'Навигация, вкладки, таблица, аккордеон, модальное окно, WiFi и OTA', tags: ['мультистраничный', 'OTA'], build: siteTemplate },
  { id: 'remote', category: 'control', title: 'Пульт робота', description: 'Крестовина, радио-группа, список, флажок, журнал', tags: ['джойстик', 'журнал'], build: remote }
]

export const TEMPLATES: Template[] = [...BASE_TEMPLATES, ...MORE_TEMPLATES]

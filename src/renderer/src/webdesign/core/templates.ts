// Готовые шаблоны сайтов.
import { createBlock, createProject } from './factory'
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

function hero(id: string, title: string, sub: string, from: string, to: string): Block {
  return B('section', id, {
    style: { gradient: { from, to, angle: 135 }, color: '#ffffff', align: 'center', padding: 56, anim: 'fade', gap: 8 },
    responsive: { mobile: { padding: 32 } },
    children: [
      B('heading', `${id}_h`, { props: { text: title, level: 1 }, style: { anim: 'slide-up' } }),
      B('text', `${id}_t`, { props: { text: sub }, style: { opacity: 0.9, anim: 'slide-up', animDelay: 120 } })
    ]
  })
}

const HOVER = { lift: true, shadow: 'md' as const }

export interface Template {
  id: string
  title: string
  description: string
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
      style: { hover: HOVER, transitionMs: 200, animDelay: i * 80 },
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
                B('icon', 'i_l', { props: { icon: 'bulb', iconSize: 36 }, style: { color: 'warning', anim: 'glow' } }),
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
    bg: '#0a0614', surface: '#150d2b', text: '#f3eeff', muted: '#9a8dc4', primary: '#c026d3',
    accent: '#22d3ee', success: '#4ade80', warning: '#facc15', danger: '#fb7185', border: '#2d1f52'
  }
  p.variables = [
    { name: 'power', type: 'bool', init: 'true' },
    { name: 'color', type: 'String', init: '#c026d3' },
    { name: 'brightness', type: 'int', init: '180' },
    { name: 'speed', type: 'int', init: '50' },
    { name: 'effect', type: 'String', init: 'static' }
  ]
  const fx = (id: string, text: string, value: string): Block =>
    B('button', id, {
      props: { text, action: 'send', value },
      binding: v('effect', 'fromUi'),
      style: { gradient: { from: 'primary', to: 'accent', angle: 120 }, hover: { lift: true, scale: 1.04 }, transitionMs: 160 }
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

export const TEMPLATES: Template[] = [
  { id: 'relays', title: 'Панель реле', description: '4 реле на пинах, аптайм и уровень WiFi', build: relayPanel },
  { id: 'weather', title: 'Метеостанция', description: 'Gauge, график, датчики и индикатор дождя', build: weather },
  { id: 'smarthome', title: 'Умный дом', description: 'Сцены, комнаты, климат и безопасность', build: smartHome },
  { id: 'rgb', title: 'RGB-лента', description: 'Цвет, яркость, эффекты — тёмная неоновая тема', build: rgbStrip }
]

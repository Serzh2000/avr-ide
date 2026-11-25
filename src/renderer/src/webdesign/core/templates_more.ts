// Дополнительные готовые шаблоны веб-дизайнера (теплица, розетки, энергия, термостат, охрана и т.д.).
// Пины подбираются под платформу: на ESP8266 используются только «чистые» GPIO 4, 5, 12, 13, 14 (и A0 для АЦП).
import { createBlock, createProject } from './factory'
import type { Template } from './templates'
import type { Binding, Block, BlockProps, BlockStyle, BlockType, Palette, Platform, WdProject } from './types'

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
const pinOut = (n: number, mode: 'digital' | 'analog' = 'digital', invert = false): Binding => ({
  kind: 'pin', pin: n, direction: 'toPin', mode, invert: invert || undefined
})
const pinIn = (n: number, mode: 'digital' | 'analog' = 'digital', pull?: 'up'): Binding => ({
  kind: 'pin', pin: n, direction: 'fromPin', mode, pull
})
/** Выбор номера пина по платформе. */
const pn = (platform: Platform, esp32: number, esp8266: number): number => (platform === 'esp32' ? esp32 : esp8266)

const HOVER = { lift: true, shadow: 'md' as const }

const pal = (c: string[]): Palette => ({
  bg: c[0], surface: c[1], text: c[2], muted: c[3], primary: c[4], accent: c[5], success: c[6], warning: c[7], danger: c[8], border: c[9]
})

function hero(id: string, title: string, sub: string, from: string, to: string, padding = 48): Block {
  return B('section', id, {
    style: { gradient: { from, to, angle: 135 }, color: '#ffffff', align: 'center', padding, anim: 'fade', gap: 8 },
    responsive: { mobile: { padding: 28 } },
    children: [
      B('heading', `${id}_h`, { props: { text: title, level: 1 }, style: { anim: 'slide-up' } }),
      B('text', `${id}_t`, { props: { text: sub }, style: { opacity: 0.9, anim: 'slide-up', animDelay: 120 } })
    ]
  })
}

const sec = (id: string, kids: Block[], style?: BlockStyle): Block => B('section', id, { style, children: kids })
const grid = (id: string, columns: number, kids: Block[]): Block => B('grid', id, { props: { columns }, children: kids })
const card = (id: string, label: string, kids: Block[], style?: BlockStyle): Block =>
  B('card', id, { props: { label }, style: { hover: HOVER, transitionMs: 200, ...style }, children: kids })
const row = (id: string, kids: Block[], justify: 'start' | 'center' | 'end' | 'between' = 'start', gap?: number): Block =>
  B('flex', id, { props: { justify }, style: gap ? { gap } : undefined, children: kids })
const panel = (id: string, label: string, kids: Block[]): Block => B('panel', id, { props: { label }, children: kids })
const gaugeCard = (id: string, label: string, variable: string, min: number, max: number, unit: string, decimals = 0): Block =>
  card(`${id}_c`, '', [B('gauge', id, { props: { label, min, max, unit, decimals }, binding: v(variable, 'toUi') })])
const statCard = (id: string, label: string, variable: string, unit: string, icon: BlockProps['icon'], decimals = 0, min = 0, max = 100): Block =>
  card(`${id}_c`, '', [B('sensor', id, { props: { label, unit, decimals, icon, min, max }, binding: v(variable, 'toUi') })])
const sensorOf = (id: string, label: string, variable: string, unit: string, icon: BlockProps['icon'], decimals = 0): Block =>
  B('sensor', id, { props: { label, unit, decimals, icon }, binding: v(variable, 'toUi') })
const progressOf = (id: string, label: string, variable: string, min: number, max: number, unit: string): Block =>
  B('progress', id, { props: { label, min, max, unit, decimals: 0 }, binding: v(variable, 'toUi') })
const btn = (id: string, text: string, variable: string, value: string, style?: BlockStyle): Block =>
  B('button', id, { props: { text, action: 'send', value }, binding: v(variable, 'fromUi'), style: { transitionMs: 150, hover: { scale: 1.04 }, ...style } })

// ------------------------------------------------------------------ Умная теплица

function greenhouse(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Умная теплица'
  p.page.description = 'Микроклимат, полив и досветка'
  p.wifi.hostname = 'greenhouse'
  p.page.theme.font = 'rounded'
  p.page.theme.radius = 18
  p.page.theme.light = pal(['#eef6ee', '#ffffff', '#1c2b1e', '#5f7463', '#16a34a', '#0d9488', '#15803d', '#d97706', '#dc2626', '#d8e6d9'])
  p.page.theme.dark = pal(['#0d1710', '#14231a', '#e4f2e6', '#8aa68e', '#4ade80', '#2dd4bf', '#4ade80', '#fbbf24', '#f87171', '#25402c'])
  const adc = platform === 'esp32' ? 4095 : 1023
  p.variables = [
    { name: 'air_t', type: 'float', init: '24.5' },
    { name: 'air_h', type: 'float', init: '62' },
    { name: 'lux', type: 'int', init: '12000' },
    { name: 'co2', type: 'int', init: '650' },
    { name: 'target_t', type: 'int', init: '26' },
    { name: 'mode', type: 'String', init: 'auto' },
    { name: 'gh_log', type: 'String', init: '' }
  ]
  p.blocks = [
    hero('hero', 'Умная теплица', 'Климат, полив и досветка под контролем', '#16a34a', '#0d9488'),
    sec('now', [
      row('st', [
        B('badge', 'bd_mode', { props: { text: 'Режим', soft: true }, binding: v('mode', 'toUi') }),
        B('badge', 'bd_on', { props: { text: 'Онлайн', soft: false }, style: { bg: 'success' } })
      ]),
      grid('g1', 3, [
        gaugeCard('g_t', 'Воздух', 'air_t', 0, 50, '°C', 1),
        gaugeCard('g_h', 'Влажность воздуха', 'air_h', 0, 100, '%'),
        card('c_soil', 'Почва', [
          B('progress', 'pr_soil', { props: { label: 'Влажность почвы (АЦП)', min: 0, max: adc, unit: '', decimals: 0 }, binding: pinIn(platform === 'pico-w' ? 26 : pn(platform, 34, 17), 'analog') }),
          B('divider', 'd1'),
          sensorOf('s_lux', 'Освещённость', 'lux', 'лк', 'sun'),
          sensorOf('s_co2', 'CO₂', 'co2', 'ppm', 'cloud')
        ])
      ]),
      grid('g2', 2, [
        card('c_ctl', 'Управление', [
          B('select', 'sel_mode', { props: { label: 'Режим', options: 'auto|Автоматический\nmanual|Ручной\nnight|Ночной' }, binding: v('mode', 'both') }),
          B('slider', 'sl_t', { props: { label: 'Целевая температура', min: 15, max: 35, step: 1, unit: '°C' }, binding: v('target_t', 'both') }),
          B('divider', 'd2'),
          B('switch', 'sw_pump', { props: { label: 'Насос полива' }, binding: pinOut(pn(platform, 16, 5), 'digital', true) }),
          B('switch', 'sw_fan', { props: { label: 'Вентиляция' }, binding: pinOut(pn(platform, 17, 4), 'digital', true) }),
          B('switch', 'sw_light', { props: { label: 'Досветка' }, binding: pinOut(pn(platform, 18, 14), 'digital', true) })
        ]),
        card('c_hist', 'Динамика', [
          B('tabs', 'tb', {
            children: [
              panel('tb_t', 'Температура', [B('chart', 'ch_t', { props: { label: 'Воздух', min: 10, max: 40, unit: '°C', points: 60 }, binding: v('air_t', 'toUi') })]),
              panel('tb_c', 'CO₂', [B('chart', 'ch_c', { props: { label: 'CO₂', min: 300, max: 1500, unit: 'ppm', points: 60, decimals: 0 }, binding: v('co2', 'toUi') })]),
              panel('tb_l', 'Журнал', [B('log', 'lg', { props: { label: 'События', lines: 60 }, binding: v('gh_log', 'toUi') })])
            ]
          })
        ])
      ])
    ])
  ]
  return p
}

// ------------------------------------------------------------------ Умные розетки

function smartPlug(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Умные розетки'
  p.wifi.hostname = 'smart-plug'
  p.page.theme.radius = 16
  p.page.theme.maxWidth = 900
  p.variables = [
    { name: 'pw1', type: 'float', init: '120' },
    { name: 'pw2', type: 'float', init: '45' },
    { name: 'timer1', type: 'String', init: 'off' },
    { name: 'timer2', type: 'String', init: 'off' },
    { name: 'protect', type: 'bool', init: 'true' },
    { name: 'overload', type: 'bool', init: 'false' },
    { name: 'kwh', type: 'float', init: '3.4' }
  ]
  const socket = (i: number, name: string, ic: BlockProps['icon']): Block =>
    card(`sock${i}`, name, [
      row(`sock${i}_r`, [
        B('icon', `sock${i}_ic`, { props: { icon: ic, iconSize: 36 }, style: { anim: 'glow' } }),
        B('switch', `sock${i}_sw`, { props: { label: 'Питание' }, binding: pinOut(pn(platform, i === 1 ? 16 : 17, i === 1 ? 5 : 4), 'digital', true) })
      ], 'between'),
      B('gauge', `sock${i}_g`, { props: { label: 'Мощность', min: 0, max: 2300, unit: 'Вт', decimals: 0 }, binding: v(`pw${i}`, 'toUi') }),
      B('select', `sock${i}_tm`, { props: { label: 'Выключить через', options: 'off|Не выключать\n15|15 минут\n60|1 час\n240|4 часа' }, binding: v(`timer${i}`, 'both') })
    ])
  p.blocks = [
    hero('hero', 'Умные розетки', 'Включайте технику, считайте мощность и ставьте таймер', '#6366f1', '#ec4899'),
    sec('main', [
      grid('sg', 2, [socket(1, 'Розетка 1 — обогреватель', 'bolt'), socket(2, 'Розетка 2 — лампа', 'bulb')]),
      grid('sg2', 2, [
        card('c_prot', 'Защита', [
          B('checkbox', 'cb_prot', { props: { label: 'Отключать при перегрузке' }, binding: v('protect', 'both') }),
          B('indicator', 'in_alarm', { props: { label: 'Перегрузка', onText: 'ТРЕВОГА', offText: 'норма' }, binding: v('overload', 'toUi') })
        ]),
        card('c_en', 'Потребление', [
          sensorOf('s_kwh', 'Энергия за сутки', 'kwh', 'кВт·ч', 'bolt', 2),
          B('table', 'tb_en', { props: { label: '', rows: 'Розетка|Мощность\n№1|{pw1} Вт\n№2|{pw2} Вт' } })
        ])
      ])
    ])
  ]
  return p
}

// ------------------------------------------------------------------ Монитор энергопотребления

function energyMonitor(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Монитор энергии'
  p.wifi.hostname = 'energy-mon'
  p.page.theme.mode = 'dark'
  p.page.theme.font = 'mono'
  p.page.theme.radius = 10
  p.page.theme.dark = pal(['#0b0e14', '#141923', '#e9edf5', '#8590a6', '#facc15', '#38bdf8', '#4ade80', '#fb923c', '#f87171', '#252d3d'])
  p.variables = [
    { name: 'volt', type: 'float', init: '229' },
    { name: 'amp', type: 'float', init: '3.2' },
    { name: 'watt', type: 'float', init: '730' },
    { name: 'freq', type: 'float', init: '50' },
    { name: 'pf', type: 'float', init: '0.95' },
    { name: 'kwh_today', type: 'float', init: '6.8' },
    { name: 'kwh_month', type: 'float', init: '182' },
    { name: 'limit_kwh', type: 'int', init: '15' },
    { name: 'tariff', type: 'String', init: 'day' },
    { name: 'notify', type: 'bool', init: 'true' },
    { name: 'energy_cmd', type: 'String', init: '' },
    { name: 'uptime', type: 'int', init: '0' }
  ]
  p.blocks = [
    hero('hero', 'Монитор энергии', 'Напряжение, ток, мощность и расход в реальном времени', '#ca8a04', '#0284c7', 36),
    sec('main', [
      grid('top', 3, [
        gaugeCard('g_w', 'Мощность', 'watt', 0, 3500, 'Вт'),
        gaugeCard('g_v', 'Напряжение', 'volt', 180, 260, 'В', 1),
        card('c_sm', '', [
          sensorOf('s_a', 'Ток', 'amp', 'А', 'bolt', 2),
          sensorOf('s_f', 'Частота', 'freq', 'Гц', 'gauge', 1),
          sensorOf('s_pf', 'cos φ', 'pf', '', 'gauge', 2)
        ])
      ]),
      card('c_tabs', '', [
        B('tabs', 'tb', {
          children: [
            panel('tb_now', 'Сейчас', [
              B('chart', 'ch_w', { props: { label: 'Мощность', min: 0, max: 3500, unit: 'Вт', points: 90, decimals: 0 }, binding: v('watt', 'toUi') }),
              progressOf('pr_lim', 'Лимит суток (кВт·ч)', 'kwh_today', 0, 15, '')
            ]),
            panel('tb_stat', 'Статистика', [
              B('table', 'tbl', { props: { label: '', rows: 'Период|Расход\nСегодня|{kwh_today} кВт·ч\nМесяц|{kwh_month} кВт·ч\nАптайм|{uptime} с' } }),
              B('clock', 'clk', { props: { label: 'Аптайм счётчика', clockMode: 'uptime' }, binding: v('uptime', 'toUi') })
            ]),
            panel('tb_set', 'Настройки', [
              B('input', 'in_lim', { props: { label: 'Лимит в сутки, кВт·ч', inputType: 'number' }, binding: v('limit_kwh', 'both') }),
              B('radio', 'rd_tar', { props: { label: 'Тариф', options: 'day|Однотарифный\nnight|День/ночь' }, binding: v('tariff', 'both') }),
              B('checkbox', 'cb_n', { props: { label: 'Уведомлять о превышении' }, binding: v('notify', 'both') }),
              btn('b_reset', 'Сбросить счётчик', 'energy_cmd', 'reset', { bg: 'danger', color: '#ffffff' })
            ])
          ]
        })
      ])
    ])
  ]
  return p
}

// ------------------------------------------------------------------ Освещение по комнатам (светлая тема)

function roomLights(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Освещение'
  p.wifi.hostname = 'lights'
  p.page.theme.mode = 'light'
  p.page.theme.font = 'rounded'
  p.page.theme.radius = 22
  p.page.theme.light = pal(['#fff8ee', '#ffffff', '#33261a', '#8a7560', '#f59e0b', '#ea580c', '#65a30d', '#d97706', '#dc2626', '#f1e3cc'])
  const max = platform === 'esp8266' ? 1023 : 255
  p.variables = [
    { name: 'cct', type: 'String', init: 'warm' },
    { name: 'night', type: 'bool', init: 'false' },
    { name: 'accent_color', type: 'String', init: '#f59e0b' },
    { name: 'scene', type: 'String', init: 'evening' }
  ]
  const room = (i: number, name: string, ic: BlockProps['icon'], e32: number, e8266: number): Block =>
    card(`room${i}`, name, [
      B('icon', `room${i}_ic`, { props: { icon: ic, iconSize: 36 }, style: { color: 'warning', anim: 'glow' } }),
      B('slider', `room${i}_sl`, { props: { label: 'Яркость', min: 0, max, step: 1 }, binding: pinOut(pn(platform, e32, e8266), 'analog') })
    ])
  p.blocks = [
    hero('hero', 'Освещение', 'Яркость по комнатам, сцены и цветовая температура', '#f59e0b', '#ea580c'),
    sec('scenes', [
      row('sc_row', [
        btn('sc_m', 'Утро', 'scene', 'morning', { gradient: { from: 'warning', to: 'accent', angle: 120 } }),
        btn('sc_d', 'День', 'scene', 'day', { gradient: { from: 'warning', to: 'accent', angle: 120 } }),
        btn('sc_e', 'Вечер', 'scene', 'evening', { gradient: { from: 'warning', to: 'accent', angle: 120 } }),
        btn('sc_n', 'Кино', 'scene', 'movie', { gradient: { from: 'warning', to: 'accent', angle: 120 } })
      ], 'center')
    ], { padding: 20 }),
    sec('rooms', [
      grid('rg', 3, [
        room(1, 'Гостиная', 'bulb', 16, 5),
        room(2, 'Спальня', 'moon', 17, 4),
        room(3, 'Кухня', 'sun', 18, 14)
      ]),
      grid('rg2', 2, [
        card('c_cct', 'Оттенок', [
          B('radio', 'rd_cct', { props: { label: 'Цветовая температура', options: 'warm|Тёплый 2700K\nneutral|Нейтральный 4000K\ncold|Холодный 6500K' }, binding: v('cct', 'both') }),
          B('color', 'col', { props: { label: 'Цвет акцентной лампы' }, binding: v('accent_color', 'both') })
        ]),
        card('c_night', 'Режим', [
          B('switch', 'sw_night', { props: { label: 'Ночной режим' }, binding: v('night', 'both') }),
          B('switch', 'sw_hall', { props: { label: 'Прихожая (реле)' }, binding: pinOut(pn(platform, 19, 12), 'digital', true) }),
          B('clock', 'clk', { props: { label: 'Время', clockMode: 'browser', showSeconds: false, showDate: true } })
        ])
      ])
    ])
  ]
  return p
}

// ------------------------------------------------------------------ Шторы и ворота

function curtainsGates(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Шторы и ворота'
  p.wifi.hostname = 'gates'
  p.page.theme.radius = 14
  p.variables = [
    { name: 'curtain_pos', type: 'int', init: '40' },
    { name: 'curtain_target', type: 'int', init: '40' },
    { name: 'gate_cmd', type: 'String', init: '' },
    { name: 'gate_state', type: 'String', init: 'закрыты' },
    { name: 'gate_open', type: 'bool', init: 'false' },
    { name: 'auto_close', type: 'bool', init: 'true' },
    { name: 'auto_min', type: 'int', init: '5' },
    { name: 'gate_log', type: 'String', init: '' }
  ]
  p.blocks = [
    hero('hero', 'Шторы и ворота', 'Приводы с концевыми выключателями', '#0891b2', '#4f46e5'),
    sec('main', [
      grid('g', 2, [
        card('c_cur', 'Шторы в гостиной', [
          progressOf('pr_pos', 'Открыто', 'curtain_pos', 0, 100, '%'),
          B('slider', 'sl_pos', { props: { label: 'Положение', min: 0, max: 100, step: 5, unit: '%' }, binding: v('curtain_target', 'both') }),
          row('cur_btns', [
            B('button', 'b_open', { props: { text: 'Открыть', action: 'momentary' }, binding: pinOut(pn(platform, 25, 5), 'digital', true) }),
            B('button', 'b_close', { props: { text: 'Закрыть', action: 'momentary' }, binding: pinOut(pn(platform, 26, 4), 'digital', true) })
          ], 'center'),
          row('cur_lim', [
            B('indicator', 'in_lo', { props: { label: 'Концевик «открыто»', onText: 'сработал', offText: '—' }, binding: pinIn(pn(platform, 32, 13), 'digital', 'up') }),
            B('indicator', 'in_lc', { props: { label: 'Концевик «закрыто»', onText: 'сработал', offText: '—' }, binding: pinIn(pn(platform, 33, 12), 'digital', 'up') })
          ], 'between')
        ]),
        card('c_gate', 'Гаражные ворота', [
          row('gate_st', [
            B('icon', 'gate_ic', { props: { icon: 'lock', iconSize: 32 } }),
            B('badge', 'gate_bd', { props: { text: 'Ворота', soft: true }, binding: v('gate_state', 'toUi') }),
            B('indicator', 'in_go', { props: { label: 'Створка', onText: 'открыта', offText: 'закрыта' }, binding: v('gate_open', 'toUi') })
          ], 'between'),
          row('gate_btns', [btn('gb_o', 'Открыть', 'gate_cmd', 'open'), btn('gb_s', 'Стоп', 'gate_cmd', 'stop', { bg: 'warning', color: '#ffffff' }), btn('gb_c', 'Закрыть', 'gate_cmd', 'close')], 'center'),
          B('checkbox', 'cb_ac', { props: { label: 'Закрывать автоматически' }, binding: v('auto_close', 'both') }),
          B('input', 'in_am', { props: { label: 'Через, минут', inputType: 'number' }, binding: v('auto_min', 'both') }),
          B('log', 'lg', { props: { label: 'Журнал', lines: 40 }, binding: v('gate_log', 'toUi') })
        ])
      ])
    ])
  ]
  return p
}

// ------------------------------------------------------------------ Термостат

function thermostat(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Термостат'
  p.wifi.hostname = 'thermostat'
  p.page.theme.radius = 20
  p.page.theme.font = 'rounded'
  p.page.theme.maxWidth = 960
  p.page.theme.light = pal(['#fdf3ec', '#ffffff', '#2c1d17', '#8c6f62', '#ea580c', '#e11d48', '#16a34a', '#d97706', '#dc2626', '#f1ddd0'])
  p.variables = [
    { name: 'temp', type: 'float', init: '21.4' },
    { name: 'target', type: 'float', init: '22' },
    { name: 'hmode', type: 'String', init: 'auto' },
    { name: 'heating', type: 'bool', init: 'false' },
    { name: 'hyst', type: 'float', init: '0.5' },
    { name: 'hum', type: 'float', init: '41' },
    { name: 'uptime', type: 'int', init: '0' }
  ]
  p.blocks = [
    hero('hero', 'Термостат', 'Поддерживаем комфортную температуру', '#ea580c', '#e11d48', 40),
    sec('main', [
      grid('g', 2, [
        card('c_now', 'Сейчас', [
          B('gauge', 'g_t', { props: { label: 'Температура', min: 5, max: 35, unit: '°C', decimals: 1 }, binding: v('temp', 'toUi') }),
          row('now_r', [
            B('indicator', 'in_heat', { props: { label: 'Нагрев', onText: 'включён', offText: 'выключен' }, binding: v('heating', 'toUi') }),
            sensorOf('s_h', 'Влажность', 'hum', '%', 'droplet')
          ], 'between')
        ]),
        card('c_set', 'Уставка', [
          B('slider', 'sl_tg', { props: { label: 'Желаемая температура', min: 10, max: 30, step: 0.5, unit: '°C' }, binding: v('target', 'both') }),
          B('radio', 'rd_m', { props: { label: 'Режим', options: 'off|Выключен\nauto|Авто\nmanual|Ручной' }, binding: v('hmode', 'both') }),
          B('switch', 'sw_rel', { props: { label: 'Реле котла (ручное)' }, binding: pinOut(pn(platform, 16, 5), 'digital', true) }),
          B('input', 'in_h', { props: { label: 'Гистерезис, °C', inputType: 'number' }, binding: v('hyst', 'both') })
        ])
      ]),
      card('c_tabs', '', [
        B('tabs', 'tb', {
          children: [
            panel('tb_ch', 'График', [B('chart', 'ch', { props: { label: 'Температура', min: 10, max: 30, unit: '°C', points: 120 }, binding: v('temp', 'toUi') })]),
            panel('tb_sch', 'Расписание', [
              B('table', 'tbl', { props: { label: '', rows: 'Время|Уставка\n06:00|22 °C\n09:00|18 °C\n17:00|22 °C\n23:00|19 °C' } }),
              B('list', 'tx', { props: { rows: 'Сейчас: {temp} °C\nУставка: {target} °C' } })
            ]),
            panel('tb_inf', 'Система', [B('clock', 'clk', { props: { label: 'Время работы', clockMode: 'uptime' }, binding: v('uptime', 'toUi') })])
          ]
        })
      ])
    ])
  ]
  return p
}

// ------------------------------------------------------------------ Робот-машинка

function robotCar(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Робот-машинка'
  p.wifi.hostname = 'robot-car'
  p.wifi.mode = 'ap'
  p.wifi.apSsid = 'RobotCar'
  p.page.theme.mode = 'dark'
  p.page.theme.radius = 16
  p.page.theme.maxWidth = 760
  p.page.theme.dark = pal(['#070d0a', '#0f1a14', '#e6fff0', '#7fa890', '#22c55e', '#06b6d4', '#4ade80', '#facc15', '#f43f5e', '#1c3326'])
  p.variables = [
    { name: 'drive', type: 'String', init: 'stop' },
    { name: 'steer', type: 'String', init: '0,0' },
    { name: 'speed', type: 'int', init: '60' },
    { name: 'batt', type: 'int', init: '82' },
    { name: 'dist', type: 'int', init: '120' },
    { name: 'obstacle', type: 'bool', init: 'false' },
    { name: 'drive_mode', type: 'String', init: 'manual' },
    { name: 'car_log', type: 'String', init: '' }
  ]
  p.blocks = [
    hero('hero', 'Робот-машинка', 'Джойстик, фары, сигнал и датчики препятствий', '#16a34a', '#0891b2', 28),
    sec('main', [
      row('st', [
        B('badge', 'bd_mode', { props: { text: 'Режим', soft: true }, binding: v('drive_mode', 'toUi') }),
        B('indicator', 'in_obs', { props: { label: 'Препятствие', onText: 'рядом!', offText: 'нет' }, binding: v('obstacle', 'toUi') })
      ], 'between'),
      card('c_pad', 'Управление', [
        grid('pads', 2, [
          B('pad', 'pad_stick', { props: { label: 'Джойстик', padMode: 'joystick' }, binding: v('steer', 'fromUi') }),
          B('pad', 'pad_dir', { props: { label: 'Крестовина', padMode: 'dpad', releaseValue: 'stop' }, binding: v('drive', 'fromUi') })
        ]),
        B('slider', 'sl_sp', { props: { label: 'Скорость', min: 0, max: 100, step: 5, unit: '%' }, binding: v('speed', 'both') })
      ]),
      grid('g2', 2, [
        card('c_fx', 'Свет и звук', [
          B('switch', 'sw_head', { props: { label: 'Фары' }, binding: pinOut(pn(platform, 16, 5)) }),
          B('button', 'b_horn', { props: { text: 'Сигнал', action: 'momentary' }, binding: pinOut(pn(platform, 17, 4)), style: { gradient: { from: 'primary', to: 'accent', angle: 120 } } }),
          B('select', 'sel_mode', { props: { label: 'Режим езды', options: 'manual|Ручной\nline|По линии\navoid|Объезд препятствий' }, binding: v('drive_mode', 'both') })
        ]),
        card('c_sens', 'Датчики', [
          progressOf('pr_b', 'Аккумулятор', 'batt', 0, 100, '%'),
          B('sensor', 's_d', { props: { label: 'До препятствия', unit: 'см', decimals: 0, icon: 'gauge', min: 0, max: 200 }, binding: v('dist', 'toUi') })
        ])
      ]),
      card('c_log', '', [B('log', 'lg', { props: { label: 'Бортовой журнал', lines: 60 }, binding: v('car_log', 'toUi') })])
    ])
  ]
  return p
}

// ------------------------------------------------------------------ Охранная панель

function security(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Охрана'
  p.wifi.hostname = 'security'
  p.page.theme.mode = 'dark'
  p.page.theme.radius = 12
  p.page.theme.dark = pal(['#120b0d', '#1e1316', '#fbeaec', '#a98a90', '#f43f5e', '#fb923c', '#4ade80', '#fbbf24', '#ef4444', '#3a2228'])
  p.variables = [
    { name: 'armed', type: 'bool', init: 'false' },
    { name: 'sec_state', type: 'String', init: 'Снято с охраны' },
    { name: 'pin_code', type: 'String', init: '' },
    { name: 'sec_cmd', type: 'String', init: '' },
    { name: 'alarm_log', type: 'String', init: '' },
    { name: 'zones_open', type: 'int', init: '0' }
  ]
  p.blocks = [
    hero('hero', 'Охранная панель', 'Двери, окна и датчики движения', '#be123c', '#c2410c', 36),
    sec('main', [
      grid('top', 2, [
        card('c_arm', 'Состояние', [
          B('icon', 'ic', { props: { icon: 'lock', iconSize: 44 }, style: { anim: 'pulse' } }),
          B('badge', 'bd', { props: { text: 'Статус', soft: true }, binding: v('sec_state', 'toUi') }),
          B('switch', 'sw_arm', { props: { label: 'Поставить под охрану' }, binding: v('armed', 'both') }),
          B('input', 'in_code', { props: { label: 'Код доступа', inputType: 'text', placeholder: '••••' }, binding: v('pin_code', 'fromUi') }),
          row('arm_btns', [
            btn('b_reset', 'Сбросить тревогу', 'sec_cmd', 'reset', { bg: 'danger', color: '#ffffff' }),
            btn('b_test', 'Тест сирены', 'sec_cmd', 'test')
          ])
        ]),
        card('c_zones', 'Зоны', [
          B('indicator', 'in_door', { props: { label: 'Входная дверь', onText: 'открыта', offText: 'закрыта' }, binding: pinIn(pn(platform, 27, 13), 'digital', 'up') }),
          B('indicator', 'in_win', { props: { label: 'Окно', onText: 'открыто', offText: 'закрыто' }, binding: pinIn(pn(platform, 32, 12), 'digital', 'up') }),
          B('indicator', 'in_pir', { props: { label: 'Движение (PIR)', onText: 'есть', offText: 'нет' }, binding: pinIn(pn(platform, 33, 14)) }),
          B('divider', 'dz'),
          B('switch', 'sw_siren', { props: { label: 'Сирена (ручное включение)' }, binding: pinOut(pn(platform, 16, 5)) })
        ])
      ]),
      card('c_log', 'События', [
        B('sensor', 's_zo', { props: { label: 'Открытых зон', unit: '', decimals: 0, icon: 'bell', min: 0, max: 3 }, binding: v('zones_open', 'toUi') }),
        B('log', 'lg', { props: { label: 'Журнал тревог', lines: 80 }, binding: v('alarm_log', 'toUi') }),
        B('modal', 'help', { props: { text: 'Справка по зонам', label: 'Зоны охраны' }, children: [
          B('list', 'help_l', { props: { rows: 'Дверь и окно — герконы, замыкают пин на землю\nPIR — датчик движения, активный уровень HIGH\nСирена — реле на выходе, ограничено 30 секундами' } })
        ] })
      ]),
    ])
  ]
  return p
}

// ------------------------------------------------------------------ Аквариум

function aquarium(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Аквариум'
  p.wifi.hostname = 'aquarium'
  p.page.theme.font = 'rounded'
  p.page.theme.radius = 20
  p.page.theme.mode = 'dark'
  p.page.theme.dark = pal(['#06141c', '#0c2330', '#e0f6ff', '#7aa8b9', '#22d3ee', '#3b82f6', '#34d399', '#fbbf24', '#fb7185', '#18384a'])
  p.variables = [
    { name: 'water_t', type: 'float', init: '25.5' },
    { name: 'ph', type: 'float', init: '7.1' },
    { name: 'tds', type: 'int', init: '210' },
    { name: 'level', type: 'int', init: '88' },
    { name: 'heating', type: 'bool', init: 'false' },
    { name: 'light_prog', type: 'String', init: 'day' },
    { name: 'feed', type: 'String', init: '' },
    { name: 'fed_today', type: 'int', init: '1' }
  ]
  p.blocks = [
    hero('hero', 'Аквариум', 'Температура, pH, свет и кормление', '#0891b2', '#2563eb'),
    sec('main', [
      grid('top', 3, [
        gaugeCard('g_t', 'Вода', 'water_t', 18, 32, '°C', 1),
        gaugeCard('g_ph', 'pH', 'ph', 5, 9, '', 1),
        card('c_lv', '', [
          progressOf('pr_lv', 'Уровень воды', 'level', 0, 100, '%'),
          sensorOf('s_tds', 'Жёсткость TDS', 'tds', 'ppm', 'droplet'),
          B('indicator', 'in_h', { props: { label: 'Нагреватель', onText: 'греет', offText: 'ожидание' }, binding: v('heating', 'toUi') })
        ])
      ]),
      grid('g2', 2, [
        card('c_dev', 'Оборудование', [
          B('switch', 'sw_l', { props: { label: 'Освещение' }, binding: pinOut(pn(platform, 16, 5), 'digital', true) }),
          B('switch', 'sw_f', { props: { label: 'Фильтр' }, binding: pinOut(pn(platform, 17, 4), 'digital', true) }),
          B('switch', 'sw_a', { props: { label: 'Аэратор' }, binding: pinOut(pn(platform, 18, 14), 'digital', true) }),
          B('switch', 'sw_h', { props: { label: 'Обогрев вручную' }, binding: pinOut(pn(platform, 19, 12), 'digital', true) })
        ]),
        card('c_feed', 'Кормление и свет', [
          row('fr', [btn('b_feed', 'Покормить рыб', 'feed', 'now', { gradient: { from: 'primary', to: 'accent', angle: 120 } }), sensorOf('s_fed', 'Сегодня кормили', 'fed_today', 'раз', 'bell')], 'between'),
          B('select', 'sel_l', { props: { label: 'Программа света', options: 'day|День 10:00–20:00\nlong|Длинный день\nmoon|Лунный режим' }, binding: v('light_prog', 'both') })
        ])
      ]),
      card('c_ch', '', [B('chart', 'ch', { props: { label: 'Температура воды', min: 20, max: 30, unit: '°C', points: 90 }, binding: v('water_t', 'toUi') })])
    ])
  ]
  return p
}

// ------------------------------------------------------------------ Автополив

function irrigation(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Автополив'
  p.wifi.hostname = 'irrigation'
  p.page.theme.radius = 16
  p.page.theme.light = pal(['#f0f8f2', '#ffffff', '#16301f', '#5d7d66', '#059669', '#0ea5e9', '#16a34a', '#d97706', '#dc2626', '#d3e8d9'])
  p.variables = [
    { name: 'irr_mode', type: 'String', init: 'auto' },
    { name: 'skip_rain', type: 'bool', init: 'true' },
    { name: 'soil1', type: 'int', init: '45' },
    { name: 'soil2', type: 'int', init: '60' },
    { name: 'soil3', type: 'int', init: '30' },
    { name: 'soil4', type: 'int', init: '52' },
    { name: 'dur1', type: 'int', init: '10' },
    { name: 'dur2', type: 'int', init: '10' },
    { name: 'dur3', type: 'int', init: '15' },
    { name: 'dur4', type: 'int', init: '5' },
    { name: 'tank', type: 'int', init: '70' }
  ]
  const zone = (i: number, name: string): Block =>
    card(`z${i}`, name, [
      B('switch', `z${i}_sw`, { props: { label: 'Клапан' }, binding: pinOut(pn(platform, [16, 17, 18, 19][i - 1], [5, 4, 14, 12][i - 1]), 'digital', true) }),
      progressOf(`z${i}_pr`, 'Влажность почвы', `soil${i}`, 0, 100, '%'),
      B('slider', `z${i}_sl`, { props: { label: 'Полив', min: 1, max: 30, step: 1, unit: 'мин' }, binding: v(`dur${i}`, 'both') })
    ])
  p.blocks = [
    hero('hero', 'Автополив', 'Четыре зоны, датчик дождя и бак', '#059669', '#0ea5e9'),
    sec('main', [
      grid('top', 3, [
        card('c_mode', 'Режим', [
          B('radio', 'rd_mode', { props: { label: '', options: 'auto|Автоматически\nmanual|Вручную\noff|Выключен' }, binding: v('irr_mode', 'both') }),
          B('checkbox', 'cb_rain', { props: { label: 'Пропускать полив в дождь' }, binding: v('skip_rain', 'both') })
        ]),
        card('c_rain', 'Датчики', [
          B('indicator', 'in_rain', { props: { label: 'Дождь', onText: 'идёт', offText: 'нет' }, binding: pinIn(pn(platform, 33, 13), 'digital', 'up') }),
          progressOf('pr_tank', 'Бак с водой', 'tank', 0, 100, '%')
        ]),
        card('c_clk', 'Время', [B('clock', 'clk', { props: { label: 'Сейчас', clockMode: 'browser', showSeconds: true, showDate: true } })])
      ]),
      grid('zones', 2, [zone(1, 'Грядки'), zone(2, 'Газон'), zone(3, 'Теплица'), zone(4, 'Клумбы')]),
      card('c_sch', 'Расписание', [B('table', 'tbl', { props: { label: '', rows: 'Зона|Время|Длительность\nГрядки|06:00|{dur1} мин\nГазон|06:20|{dur2} мин\nТеплица|20:00|{dur3} мин\nКлумбы|20:20|{dur4} мин' } })])
    ])
  ]
  return p
}

// ------------------------------------------------------------------ Консоль отладки

function debugConsole(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Консоль отладки'
  p.wifi.hostname = 'esp-debug'
  p.page.theme.mode = 'dark'
  p.page.theme.font = 'mono'
  p.page.theme.radius = 6
  p.page.theme.maxWidth = 1000
  p.page.theme.dark = pal(['#0a0c10', '#12161d', '#d6e2f0', '#6b7a8c', '#4ade80', '#38bdf8', '#4ade80', '#fbbf24', '#f87171', '#222a35'])
  p.variables = [
    { name: 'log_line', type: 'String', init: '' },
    { name: 'cmd_text', type: 'String', init: '' },
    { name: 'cmd', type: 'String', init: '' },
    { name: 'loglevel', type: 'String', init: 'info' },
    { name: 'echo', type: 'bool', init: 'true' },
    { name: 'heap_free', type: 'int', init: '210' },
    { name: 'rssi', type: 'int', init: '-58' },
    { name: 'chip_temp', type: 'float', init: '42' },
    { name: 'uptime', type: 'int', init: '0' }
  ]
  const quick = (id: string, text: string, value: string): Block => btn(id, text, 'cmd', value, { bg: 'surface', color: 'primary', borderWidth: 1, borderColor: 'border' })
  p.blocks = [
    sec('top', [
      B('heading', 'h', { props: { text: 'Консоль отладки', level: 2 } }),
      grid('stats', 4, [
        statCard('s_heap', 'Свободно ОЗУ', 'heap_free', 'КБ', 'gauge', 0, 0, 320),
        statCard('s_rssi', 'WiFi', 'rssi', 'дБм', 'wifi', 0, -90, -30),
        statCard('s_t', 'Температура чипа', 'chip_temp', '°C', 'thermometer', 1, 20, 80),
        card('c_up', '', [B('clock', 'clk', { props: { label: 'Аптайм', clockMode: 'uptime' }, binding: v('uptime', 'toUi') })])
      ])
    ], { padding: 20 }),
    sec('main', [
      grid('g', 2, [
        card('c_log', 'Журнал', [
          B('log', 'lg', { props: { label: '', lines: 200 }, style: { minHeight: 260 }, binding: v('log_line', 'toUi') }),
          row('lr', [
            B('select', 'sel_lv', { props: { label: 'Уровень', options: 'debug|DEBUG\ninfo|INFO\nwarn|WARN\nerror|ERROR' }, binding: v('loglevel', 'both') }),
            B('checkbox', 'cb_echo', { props: { label: 'Дублировать в Serial' }, binding: v('echo', 'both') })
          ], 'between')
        ]),
        card('c_cmd', 'Команды', [
          B('textarea', 'ta', { props: { label: 'Своя команда', lines: 3, placeholder: 'например: gpio 4 1' }, binding: v('cmd_text', 'fromUi') }),
          btn('b_run', 'Выполнить', 'cmd', 'run', { gradient: { from: 'primary', to: 'accent', angle: 120 }, color: '#05140a' }),
          B('divider', 'dv'),
          row('qr', [quick('q_status', 'status', 'status'), quick('q_scan', 'wifi scan', 'scan'), quick('q_heap', 'heap', 'heap'), quick('q_reboot', 'reboot', 'reboot')])
        ])
      ]),
      card('c_chart', 'Свободная память', [B('chart', 'ch', { props: { label: 'heap', min: 0, max: 320, unit: 'КБ', points: 120, decimals: 0 }, binding: v('heap_free', 'toUi') })]),
      B('accordion', 'acc', { children: [
        panel('a_sys', 'Системные показатели', [B('table', 'tbl', { props: { label: '', rows: 'Параметр|Значение\nОЗУ свободно|{heap_free} КБ\nWiFi RSSI|{rssi} дБм\nТемпература|{chip_temp} °C\nАптайм|{uptime} с' } })]),
        panel('a_help', 'Справка', [B('list', 'hl', { props: { rows: 'Команда уходит в переменную cmd по WebSocket\nОбработчик команд пишется в loop() прошивки\nСтроки журнала приходят из переменной log_line' } })])
      ] })
    ])
  ]
  return p
}

// ------------------------------------------------------------------ Портал настройки WiFi

function wifiPortal(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Настройка устройства'
  p.wifi.mode = 'ap'
  p.wifi.apSsid = 'ESP-Setup'
  p.wifi.hostname = 'esp-setup'
  p.page.theme.maxWidth = 640
  p.page.theme.radius = 18
  p.page.theme.font = 'rounded'
  p.variables = [
    { name: 'wifi_ssid', type: 'String', init: '' },
    { name: 'wifi_pass', type: 'String', init: '' },
    { name: 'wifi_save', type: 'bool', init: 'false' },
    { name: 'dev_name', type: 'String', init: 'esp-device' },
    { name: 'dev_cmd', type: 'String', init: '' },
    { name: 'rssi', type: 'int', init: '-60' },
    { name: 'ip_addr', type: 'String', init: '192.168.4.1' },
    { name: 'uptime', type: 'int', init: '0' },
    { name: 'dhcp', type: 'bool', init: 'true' }
  ]
  p.blocks = [
    hero('hero', 'Первое включение', 'Подключите устройство к домашней сети WiFi', '#2563eb', '#7c3aed', 40),
    sec('main', [
      card('c_steps', 'Как настроить', [B('list', 'steps', { props: { rows: 'Выберите сеть и введите пароль\nНажмите «Сохранить» — устройство перезагрузится\nОткройте страницу устройства по новому адресу' } })]),
      card('c_wifi', '', [B('wifisetup', 'wf', { props: { label: 'Подключение к WiFi', text: 'Сохранить', varSsid: 'wifi_ssid', varPass: 'wifi_pass', varSave: 'wifi_save' } })]),
      card('c_dev', 'Устройство', [
        B('input', 'in_name', { props: { label: 'Имя устройства', placeholder: 'esp-device' }, binding: v('dev_name', 'both') }),
        B('checkbox', 'cb_dhcp', { props: { label: 'Получать адрес автоматически (DHCP)' }, binding: v('dhcp', 'both') }),
        B('table', 'tbl', { props: { label: '', rows: 'Параметр|Значение\nIP-адрес|{ip_addr}\nСигнал|{rssi} дБм\nАптайм|{uptime} с' } }),
        sensorOf('s_rssi', 'Сигнал WiFi', 'rssi', 'дБм', 'wifi'),
        row('dev_btns', [btn('b_reboot', 'Перезагрузить', 'dev_cmd', 'reboot'), btn('b_reset', 'Сбросить настройки', 'dev_cmd', 'factory', { bg: 'danger', color: '#ffffff' })], 'between')
      ]),
      card('c_ota', '', [B('ota', 'ota1', { props: { label: 'Обновление прошивки', path: '/update', text: 'Загрузить' } })]),
      B('modal', 'help', { props: { text: 'Не получается подключиться?', label: 'Подсказка' }, children: [
        B('text', 'help_t', { props: { text: 'Проверьте, что сеть работает на частоте 2,4 ГГц, а пароль введён без лишних пробелов. Для сброса удерживайте кнопку BOOT 10 секунд.' } })
      ] })
    ])
  ]
  return p
}

// ------------------------------------------------------------------ Лендинг устройства (4 страницы)

function landing(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Датчик воздуха'
  p.page.description = 'Лендинг устройства: возможности, характеристики, живая демонстрация'
  p.wifi.hostname = 'air-sensor'
  p.page.theme.radius = 16
  p.page.theme.font = 'rounded'
  p.page.theme.light = pal(['#f7f8ff', '#ffffff', '#1a1d33', '#6a6f8f', '#6366f1', '#ec4899', '#16a34a', '#d97706', '#dc2626', '#e4e6f7'])
  p.pages = [{ id: 'home', title: 'Главная' }, { id: 'features', title: 'Возможности' }, { id: 'specs', title: 'Характеристики' }, { id: 'demo', title: 'Демо' }]
  p.variables = [
    { name: 'temp', type: 'float', init: '23.4' },
    { name: 'hum', type: 'float', init: '48' },
    { name: 'co2', type: 'int', init: '620' }
  ]
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs>' +
    '<rect width="200" height="120" rx="14" fill="url(#g)"/><rect x="60" y="30" width="80" height="60" rx="8" fill="#fff" opacity=".92"/><circle cx="100" cy="60" r="16" fill="none" stroke="#6366f1" stroke-width="5"/><circle cx="100" cy="60" r="4" fill="#ec4899"/></svg>'
  const src = `data:image/svg+xml;base64,${btoa(svg)}`
  const nav = B('navbar', 'nav', {
    props: { brand: 'AirSense', icon: 'cloud', sticky: true },
    children: [
      B('link', 'n_home', { props: { text: 'Главная', page: 'home' } }),
      B('link', 'n_feat', { props: { text: 'Возможности', page: 'features' } }),
      B('link', 'n_spec', { props: { text: 'Характеристики', page: 'specs' } }),
      B('link', 'n_demo', { props: { text: 'Демо', page: 'demo', variant: 'button' } })
    ]
  })
  nav.page = '*'
  const feat = (id: string, ic: BlockProps['icon'], title: string, text: string): Block =>
    card(id, '', [B('icon', `${id}_i`, { props: { icon: ic, iconSize: 36 } }), B('heading', `${id}_h`, { props: { text: title, level: 3 } }), B('text', `${id}_t`, { props: { text }, style: { color: 'muted' } })])
  const home = [
    hero('hero', 'AirSense — чистый воздух под контролем', 'Компактный датчик температуры, влажности и CO₂ с красивой страницей прямо в устройстве', '#6366f1', '#ec4899', 72),
    sec('intro', [
      grid('ig', 2, [
        B('image', 'img', { props: { src, alt: 'Устройство AirSense' }, style: { radius: 16, shadow: 'md' } }),
        B('custom', 'cust', { props: {
          html: '<div class="pitch"><h2>Без облака и приложений</h2><p>Откройте адрес устройства в браузере — и сразу видите показания.</p><ul><li>Работает офлайн в вашей сети</li><li>Данные не покидают дом</li><li>Обновление прошивки по воздуху</li></ul></div>',
          css: '.pitch{padding:8px}.pitch h2{margin:0 0 8px}.pitch li{margin:4px 0}'
        } })
      ])
    ]),
    sec('cta', [row('cta_r', [
      B('link', 'cta_demo', { props: { text: 'Посмотреть демо', page: 'demo', variant: 'button' } }),
      B('link', 'cta_spec', { props: { text: 'Характеристики', page: 'specs' } })
    ], 'center')], { align: 'center' })
  ]
  // page ставится до responsive: порядок ключей совпадает с сериализатором (round-trip без изменений)
  const onHome = home.map((b): Block => { const { responsive, ...rest } = b; return { ...rest, page: 'home', ...(responsive ? { responsive } : {}) } })
  const features = sec('feat_s', [
    B('heading', 'feat_h', { props: { text: 'Возможности', level: 1 } }),
    grid('fg', 3, [
      feat('f1', 'thermometer', 'Точные измерения', 'Датчик SHT45 с точностью ±0,1 °C'),
      feat('f2', 'cloud', 'CO₂ и качество воздуха', 'NDIR-датчик, предупреждение при превышении 1000 ppm'),
      feat('f3', 'wifi', 'WiFi и WebSocket', 'Живые обновления без перезагрузки страницы'),
      feat('f4', 'bolt', 'Низкое потребление', 'До 6 месяцев от аккумулятора в спящем режиме'),
      feat('f5', 'lock', 'Безопасность', 'Локальная работа, без внешних серверов'),
      feat('f6', 'bell', 'Оповещения', 'Подсветка и сигнал при плохом воздухе')
    ])
  ])
  features.page = 'features'
  const specs = sec('spec_s', [
    B('heading', 'spec_h', { props: { text: 'Характеристики', level: 1 } }),
    card('c_spec', '', [B('table', 'tbl', { props: { label: '', rows: 'Параметр|Значение\nПитание|5 В, USB-C\nТемпература|от −20 до +60 °C\nВлажность|0–100 %\nCO₂|400–5000 ppm\nСвязь|WiFi 2,4 ГГц\nРазмеры|55 × 40 × 18 мм' } })]),
    B('accordion', 'faq', { children: [
      panel('q1', 'Нужен ли интернет?', [B('text', 'q1t', { props: { text: 'Нет. Устройство работает в локальной сети, страница хранится во флеш-памяти.' } })]),
      panel('q2', 'Как обновить прошивку?', [B('text', 'q2t', { props: { text: 'Через раздел OTA на странице устройства — загрузите файл .bin.' } })]),
      panel('q3', 'Есть ли гарантия?', [B('text', 'q3t', { props: { text: 'Гарантия 12 месяцев на электронику.' } })])
    ] })
  ])
  specs.page = 'specs'
  const demo = sec('demo_s', [
    B('heading', 'demo_h', { props: { text: 'Живая демонстрация', level: 1 } }),
    grid('dg', 3, [
      gaugeCard('d_t', 'Температура', 'temp', -10, 50, '°C', 1),
      gaugeCard('d_h', 'Влажность', 'hum', 0, 100, '%'),
      card('d_c', '', [
        B('sensor', 'd_co2', { props: { label: 'CO₂', unit: 'ppm', decimals: 0, icon: 'cloud', min: 400, max: 2000 }, binding: v('co2', 'toUi') }),
        B('switch', 'd_led', { props: { label: 'Подсветка' }, binding: pinOut(pn(platform, 16, 5)) })
      ])
    ]),
    B('chart', 'd_ch', { props: { label: 'CO₂ за последнюю минуту', min: 400, max: 2000, unit: 'ppm', points: 60, decimals: 0 }, binding: v('co2', 'toUi') }),
    B('modal', 'contact', { props: { text: 'Связаться с нами', label: 'Контакты' }, children: [B('text', 'ct', { props: { text: 'Напишите: hello@airsense.example' } })] })
  ])
  demo.page = 'demo'
  const foot = B('footer', 'foot', { props: { text: '© 2026 AirSense' } })
  foot.page = '*'
  p.blocks = [nav, ...onHome, features, specs, demo, foot]
  return p
}

// ------------------------------------------------------------------ Тёмный дашборд узла

function nodeDashboard(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'IoT-узел'
  p.wifi.hostname = 'iot-node'
  p.page.theme.mode = 'dark'
  p.page.theme.radius = 14
  p.page.theme.maxWidth = 1200
  p.page.theme.dark = pal(['#080b14', '#111729', '#e4e9fb', '#7d89b0', '#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#1f2845'])
  p.variables = [
    { name: 'temp', type: 'float', init: '23.1' },
    { name: 'hum', type: 'float', init: '47' },
    { name: 'pres', type: 'float', init: '1012' },
    { name: 'lux', type: 'int', init: '420' },
    { name: 'vbat', type: 'float', init: '3.9' },
    { name: 'rssi', type: 'int', init: '-61' },
    { name: 'heap', type: 'int', init: '190' },
    { name: 'status', type: 'String', init: 'OK' },
    { name: 'events', type: 'String', init: '' },
    { name: 'uptime', type: 'int', init: '0' }
  ]
  p.blocks = [
    sec('hd', [
      row('hd_r', [
        B('heading', 'hd_h', { props: { text: 'IoT-узел', level: 2 } }),
        row('hd_b', [
          B('badge', 'bd_st', { props: { text: 'Статус', soft: true }, binding: v('status', 'toUi') }),
          B('clock', 'clk', { props: { label: '', clockMode: 'browser', showSeconds: true, showDate: false } })
        ], 'end')
      ], 'between')
    ], { padding: 20 }),
    sec('tiles', [
      grid('tl', 4, [
        statCard('t_t', 'Температура', 'temp', '°C', 'thermometer', 1, -10, 50),
        statCard('t_h', 'Влажность', 'hum', '%', 'droplet', 0, 0, 100),
        statCard('t_p', 'Давление', 'pres', 'гПа', 'cloud', 0, 960, 1060),
        statCard('t_l', 'Свет', 'lux', 'лк', 'sun', 0, 0, 1000)
      ]),
      grid('mid', 3, [
        card('c_ch1', 'Температура', [B('chart', 'ch1', { props: { label: '', min: 10, max: 40, unit: '°C', points: 90 }, binding: v('temp', 'toUi') })], { span: 2 }),
        card('c_g', 'Питание', [
          B('gauge', 'g_v', { props: { label: 'Батарея', min: 3, max: 4.2, unit: 'В', decimals: 2 }, binding: v('vbat', 'toUi') }),
          progressOf('pr_h', 'Память (свободно)', 'heap', 0, 320, 'КБ')
        ])
      ]),
      grid('bot', 2, [
        card('c_ch2', 'Влажность', [B('chart', 'ch2', { props: { label: '', min: 0, max: 100, unit: '%', points: 90, decimals: 0 }, binding: v('hum', 'toUi') })]),
        card('c_ev', 'События', [B('log', 'lg', { props: { label: '', lines: 50 }, binding: v('events', 'toUi') })])
      ]),
      card('c_tb', 'Система', [B('table', 'tbl', { props: { label: '', rows: 'Параметр|Значение\nСигнал WiFi|{rssi} дБм\nСвободная память|{heap} КБ\nАптайм|{uptime} с' } })])
    ])
  ]
  return p
}

// ------------------------------------------------------------------ Минимальный датчик (светлый, лёгкий)

function sensorNode(platform: Platform): WdProject {
  const p = createProject(platform)
  p.page.title = 'Датчик'
  p.wifi.hostname = 'sensor'
  p.page.theme.mode = 'light'
  p.page.theme.toggle = false
  p.page.theme.font = 'serif'
  p.page.theme.radius = 8
  p.page.theme.maxWidth = 520
  p.page.theme.light = pal(['#ffffff', '#fafafa', '#111111', '#777777', '#111111', '#555555', '#2f855a', '#b7791f', '#c53030', '#e5e5e5'])
  p.variables = [
    { name: 'temp', type: 'float', init: '22.6' },
    { name: 'hum', type: 'float', init: '44' },
    { name: 'overload', type: 'bool', init: 'false' }
  ]
  p.blocks = [
    sec('main', [
      B('heading', 'h', { props: { text: 'Комната', level: 2 }, style: { align: 'center' } }),
      B('gauge', 'g', { props: { label: 'Температура', min: 0, max: 40, unit: '°C', decimals: 1 }, binding: v('temp', 'toUi') }),
      B('sensor', 's_h', { props: { label: 'Влажность', unit: '%', decimals: 0, icon: 'droplet' }, binding: v('hum', 'toUi') }),
      B('indicator', 'in', { props: { label: 'Перегрев', onText: 'да', offText: 'нет' }, binding: v('overload', 'toUi') }),
      B('chart', 'ch', { props: { label: 'Температура', min: 10, max: 35, unit: '°C', points: 60 }, binding: v('temp', 'toUi') })
    ], { gap: 16, padding: 24 })
  ]
  return p
}

export const MORE_TEMPLATES: Template[] = [
  { id: 'greenhouse', category: 'garden', title: 'Умная теплица', description: 'Климат, влажность почвы (АЦП), полив, вентиляция и досветка на пинах', tags: ['gauge', 'АЦП', 'реле', 'вкладки'], build: greenhouse },
  { id: 'irrigation', category: 'garden', title: 'Автополив (4 зоны)', description: 'Клапаны на пинах, длительность, датчик дождя, расписание', tags: ['клапаны', 'расписание', 'светлая'], build: irrigation },
  { id: 'aquarium', category: 'garden', title: 'Аквариум', description: 'Температура, pH, уровень, оборудование, кормление — тёмная морская тема', tags: ['gauge', 'реле', 'тёмная'], build: aquarium },
  { id: 'thermostat', category: 'garden', title: 'Термостат', description: 'Уставка, режимы, реле котла, график и расписание — тёплая тема', tags: ['слайдер', 'график', 'расписание'], build: thermostat },
  { id: 'sensor_node', category: 'garden', title: 'Минимальный датчик', description: 'Лёгкая светлая страница на одном экране — подходит для ESP8266', tags: ['минимал', 'светлая', 'лёгкий'], build: sensorNode },
  { id: 'smartplug', category: 'home', title: 'Умные розетки', description: '2 розетки на пинах, мощность, таймеры и защита от перегрузки', tags: ['реле', 'таймер', 'gauge'], build: smartPlug },
  { id: 'lights', category: 'home', title: 'Освещение по комнатам', description: 'PWM-яркость на пинах, сцены, цветовая температура — светлая тёплая тема', tags: ['PWM', 'сцены', 'светлая'], build: roomLights },
  { id: 'curtains', category: 'home', title: 'Шторы и ворота', description: 'Приводы на пинах, концевики, положение, автозакрытие и журнал', tags: ['кнопки', 'концевики', 'журнал'], build: curtainsGates },
  { id: 'energy', category: 'safety', title: 'Монитор энергии', description: 'Мощность, напряжение, ток, лимит суток, статистика — тёмная моно-тема', tags: ['график', 'вкладки', 'тёмная'], build: energyMonitor },
  { id: 'security', category: 'safety', title: 'Охранная панель', description: 'Постановка на охрану, зоны с датчиками на пинах, сирена и журнал тревог', tags: ['датчики', 'модальное окно', 'тёмная'], build: security },
  { id: 'robotcar', category: 'control', title: 'Робот-машинка', description: 'Джойстик и крестовина, фары и сигнал на пинах, батарея и дальномер, режим AP', tags: ['джойстик', 'AP', 'тёмная'], build: robotCar },
  { id: 'debug', category: 'service', title: 'Консоль отладки', description: 'Журнал, команды, уровень логов, память и RSSI — тёмная моно-тема', tags: ['журнал', 'команды', 'тёмная'], build: debugConsole },
  { id: 'wifiportal', category: 'service', title: 'Портал настройки WiFi', description: 'Режим точки доступа: сеть, имя устройства, перезагрузка, OTA', tags: ['WiFi', 'OTA', 'AP'], build: wifiPortal },
  { id: 'landing', category: 'service', title: 'Лендинг устройства (4 страницы)', description: 'Навигация, герой, карточки, характеристики, FAQ и живое демо', tags: ['мультистраничный', 'изображение', 'FAQ'], build: landing },
  { id: 'dashboard', category: 'service', title: 'Тёмный дашборд IoT-узла', description: 'Плитки датчиков, графики, батарея, память, журнал событий', tags: ['графики', 'таблица', 'тёмная'], build: nodeDashboard }
]

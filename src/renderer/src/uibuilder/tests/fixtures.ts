import { createDefaultProject } from '../core/factory'
import type { UiProject } from '../core/types'

/** Модель «все виджеты и все виды привязок» для golden-тестов. */
export function demoProject(platform: 'esp8266' | 'esp32'): UiProject {
  const p = createDefaultProject(platform)
  p.wifi.ssid = 'MyWiFi'
  p.wifi.password = 'secret123'
  p.wifi.apSsid = 'ESPUI-AP'
  p.wifi.apPassword = 'apsecret1'
  p.settings.title = 'Демо "ESPUI"'
  p.settings.sliderContinuous = true
  p.variables = [
    { name: 'ledOn', type: 'bool', init: 'false' },
    { name: 'speed', type: 'int', init: '50' },
    { name: 'temp', type: 'float', init: '21.5' },
    { name: 'status', type: 'String', init: 'ready' },
    { name: 'mode', type: 'int', init: '1' },
    { name: 'presses', type: 'int', init: '' }
  ]
  const analogIn = platform === 'esp8266' ? 17 : 34
  const pwmPin = platform === 'esp8266' ? 5 : 18
  const ledPin = platform === 'esp8266' ? 4 : 2
  p.tabs = [
    {
      id: 'tabMain',
      title: 'Главная',
      elements: [
        {
          id: 'lblTemp',
          type: 'label',
          label: 'Температура',
          props: { color: 'Alizarin', prefix: 'T = ', suffix: ' °C', decimals: 1 },
          binding: { kind: 'var', variable: 'temp', direction: 'toUi' }
        },
        {
          id: 'swLed',
          type: 'switcher',
          label: 'Светодиод',
          props: { color: 'Emerald', on: false },
          binding: { kind: 'var', variable: 'ledOn', direction: 'both' }
        },
        {
          id: 'swRelay',
          type: 'switcher',
          label: 'Реле',
          props: { color: 'Carrot', on: true },
          binding: { kind: 'pin', pin: ledPin, direction: 'toPin', mode: 'digital', invert: true }
        },
        {
          id: 'sldSpeed',
          type: 'slider',
          label: 'Скорость',
          props: { color: 'Peterriver', min: 0, max: 100, wide: true },
          binding: { kind: 'var', variable: 'speed', direction: 'both' }
        },
        {
          id: 'sldPwm',
          type: 'slider',
          label: 'Яркость',
          props: { color: 'Sunflower', min: 0, max: 255, vertical: true },
          binding: { kind: 'pin', pin: pwmPin, direction: 'toPin', mode: 'analog' }
        },
        {
          id: 'btnPress',
          type: 'button',
          label: 'Счётчик нажатий',
          props: { color: 'Dark', text: 'Жми' },
          binding: { kind: 'var', variable: 'presses', direction: 'fromUi' }
        },
        { id: 'sep1', type: 'separator', label: 'Датчики', props: {}, binding: { kind: 'none' } }
      ]
    },
    {
      id: 'tabSettings',
      title: 'Настройки',
      elements: [
        {
          id: 'numTemp',
          type: 'number',
          label: 'Уставка',
          props: { color: 'Turquoise', min: 10, max: 30, step: 0.5, decimals: 1 },
          binding: { kind: 'var', variable: 'temp', direction: 'fromUi' }
        },
        {
          id: 'txtStatus',
          type: 'text',
          label: 'Статус',
          props: { color: 'Wetasphalt' },
          binding: { kind: 'var', variable: 'status', direction: 'both' }
        },
        {
          id: 'selMode',
          type: 'select',
          label: 'Режим',
          props: {
            color: 'Sunflower',
            options: [
              { label: 'Авто', value: '1' },
              { label: 'Ручной "R"', value: '2' }
            ]
          },
          binding: { kind: 'var', variable: 'mode', direction: 'fromUi' }
        },
        {
          id: 'lblAdc',
          type: 'label',
          label: 'АЦП',
          props: { color: 'Turquoise' },
          binding: { kind: 'pin', pin: analogIn, direction: 'fromPin', mode: 'analog' }
        },
        {
          id: 'grAdc',
          type: 'graph',
          label: 'График АЦП',
          props: { color: 'Wetasphalt', scale: 1 },
          binding: { kind: 'pin', pin: analogIn, direction: 'fromPin', mode: 'analog' }
        },
        {
          id: 'grTemp',
          type: 'graph',
          label: 'График температуры',
          props: { color: 'Alizarin', scale: 10 },
          binding: { kind: 'var', variable: 'temp', direction: 'toUi' }
        }
      ]
    }
  ]
  return p
}

/** Модель «новые виджеты, стили, темы, группы, callback» для golden-тестов генератора v2. */
export function richProject(platform: 'esp8266' | 'esp32'): UiProject {
  const p = createDefaultProject(platform)
  p.wifi.mode = 'ap'
  p.wifi.apSsid = 'Rich-AP'
  p.wifi.apPassword = ''
  p.settings.title = 'Rich'
  p.settings.dnsCaptive = true
  p.theme = { preset: 'neon', vars: { cardRadius: '10px', colors: { Alizarin: '#ff0055' } } }
  p.variables = [
    { name: 'padEvent', type: 'int', init: '0' },
    { name: 'secret', type: 'String', init: '' },
    { name: 'clock', type: 'String', init: '' },
    { name: 'flag', type: 'bool', init: 'false' },
    { name: 'level', type: 'int', init: '3' },
    { name: 'temp', type: 'float', init: '20' }
  ]
  p.tabs = [
    {
      id: 'tabCtl',
      title: 'Управление',
      elements: [
        { id: 'padMove', type: 'padCenter', label: 'Движение', props: { color: 'Carrot' }, binding: { kind: 'var', variable: 'padEvent', direction: 'fromUi' }, group: 'Моторы' },
        { id: 'padCam', type: 'pad', label: 'Камера', props: { color: 'Sunflower', disabled: true }, binding: { kind: 'callback', fn: 'onCamera' }, group: 'Моторы' },
        {
          id: 'btnToggle', type: 'button', label: 'Реле', props: { color: 'Peterriver', text: 'Вкл/выкл', action: 'toggle', hidden: true },
          binding: { kind: 'pin', pin: 4, direction: 'toPin', mode: 'digital' }
        },
        { id: 'btnFlag', type: 'button', label: 'Флаг', props: { action: 'toggle' }, binding: { kind: 'var', variable: 'flag', direction: 'fromUi' } },
        {
          id: 'sldLevel', type: 'slider', label: 'Уровень', props: { color: 'Emerald', min: 0, max: 10, step: 2, wide: true,
            panelStyle: { background: '#102030', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,.4)' },
            elementStyle: { width: '90%' }, panelClass: 'big card2' },
          binding: { kind: 'var', variable: 'level', direction: 'both' }
        },
        { id: 'accGyro', type: 'accel', label: 'Наклон', props: {}, binding: { kind: 'callback', fn: 'onTilt' } }
      ]
    },
    {
      id: 'tabInfo',
      title: 'Инфо',
      elements: [
        { id: 'txtDate', type: 'text', label: 'Дата', props: { inputType: 'date', maxLength: 10 }, binding: { kind: 'none' } },
        { id: 'pwdKey', type: 'password', label: 'Ключ', props: {}, binding: { kind: 'var', variable: 'secret', direction: 'fromUi' } },
        { id: 'tmNow', type: 'time', label: 'Время', props: { pollSec: 30 }, binding: { kind: 'var', variable: 'clock', direction: 'fromUi' } },
        { id: 'fdLog', type: 'fileDisplay', label: 'Лог', props: { file: '/log.txt' }, binding: { kind: 'none' } },
        {
          id: 'selPick', type: 'select', label: 'Выбор', props: { options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }], initial: 'b' },
          binding: { kind: 'callback', fn: 'onPick' }
        },
        {
          id: 'grFast', type: 'graph', label: 'График', props: { scale: 10, graphMs: 1000, clearOnStart: true },
          binding: { kind: 'var', variable: 'temp', direction: 'toUi' }
        }
      ]
    }
  ]
  return p
}

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  GEN_BEGIN,
  GEN_END,
  createDefaultProject,
  createElement,
  generate,
  mergeGenerated,
  parseProject,
  serializeProject,
  validate,
  cppString,
  identProblem,
  WIDGETS,
  WIDGET_ORDER,
  UI_JSON_VERSION
} from '../core/index'
import type { Issue, UiProject } from '../core/types'
import { demoProject } from './fixtures'

import { buildSchema } from '../tools/schema'

const here = dirname(fileURLToPath(import.meta.url))
const normalize = (s: string): string => s.replace(/\r\n/g, '\n')

function golden(name: string, actual: string): void {
  const file = join(here, 'golden', name)
  if (process.env.UPDATE_GOLDEN === '1' || !existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, actual)
    return
  }
  assert.equal(actual, normalize(readFileSync(file, 'utf8')), `golden ${name} изменился (UPDATE_GOLDEN=1 обновит)`)
}

const errors = (is: Issue[]): string[] => is.filter((i) => i.severity === 'error').map((i) => i.code)
const has = (is: Issue[], code: string): boolean => is.some((i) => i.code === code)

/** Базовый корректный проект с одним label и переменной. */
function mini(): UiProject {
  const p = createDefaultProject('esp32')
  p.wifi.ssid = 'net'
  p.variables = [{ name: 'v1', type: 'int', init: '1' }]
  return p
}
function withEl(p: UiProject, el: UiProject['tabs'][0]['elements'][0]): UiProject {
  p.tabs[0].elements.push(el)
  return p
}

// ---------- golden ----------
test('golden: ESP32 (ядро 3.x, LEDC v3)', () => {
  const p = demoProject('esp32')
  const issues = validate(p, 'esp32')
  assert.deepEqual(errors(issues), [])
  golden('esp32_v3.h', generate(p, 'esp32', { ledcApi: 'v3' }))
})

test('golden: ESP32 (ядро 2.x, LEDC v2)', () => {
  golden('esp32_v2.h', generate(demoProject('esp32'), 'esp32', { ledcApi: 'v2' }))
})

test('golden: ESP8266', () => {
  const p = demoProject('esp8266')
  assert.deepEqual(errors(validate(p, 'esp8266')), [])
  golden('esp8266.h', generate(p, 'esp8266'))
})

test('генерация детерминирована', () => {
  const p = demoProject('esp32')
  assert.equal(generate(p, 'esp32'), generate(structuredClone(p), 'esp32'))
})

// ---------- содержимое ----------
test('ESP8266 использует ESPAsyncTCP, ESP32 — AsyncTCP', () => {
  const a = generate(demoProject('esp8266'), 'esp8266')
  const b = generate(demoProject('esp32'), 'esp32')
  assert.match(a, /#include <ESPAsyncTCP\.h>/)
  assert.match(a, /#include <ESP8266WiFi\.h>/)
  assert.doesNotMatch(a, /#include <AsyncTCP\.h>/)
  assert.match(b, /#include <AsyncTCP\.h>/)
  assert.match(b, /#include <WiFi\.h>/)
  assert.doesNotMatch(b, /ESPAsyncTCP/)
})

test('ledc: v3 → ledcAttach(pin), v2 → ledcSetup/ledcAttachPin + канал', () => {
  const p = demoProject('esp32')
  const v3 = generate(p, 'esp32', { ledcApi: 'v3' })
  const v2 = generate(p, 'esp32', { ledcApi: 'v2' })
  assert.match(v3, /ledcAttach\(18, 5000, 8\);/)
  assert.match(v3, /ledcWrite\(18, constrain\(val, 0, 255\)\);/)
  assert.doesNotMatch(v3, /ledcSetup|ledcAttachPin/)
  assert.match(v2, /ledcSetup\(0, 5000, 8\);/)
  assert.match(v2, /ledcAttachPin\(18, 0\);/)
  assert.match(v2, /ledcWrite\(0, constrain\(val, 0, 255\)\);/)
})

test('ESP8266: PWM через analogWrite, A0 для analogRead', () => {
  const g = generate(demoProject('esp8266'), 'esp8266')
  assert.match(g, /analogWrite\(5, constrain\(val, 0, 1023\)\);/)
  assert.match(g, /analogRead\(A0\)/)
  assert.doesNotMatch(g, /ledc/)
})

test('маркеры и структура', () => {
  const g = generate(demoProject('esp32'), 'esp32')
  assert.equal(g.split(GEN_BEGIN).length, 2)
  assert.equal(g.split(GEN_END).length, 2)
  assert.ok(g.indexOf(GEN_BEGIN) < g.indexOf('ESPUI.begin(') && g.indexOf('ESPUI.begin(') < g.indexOf(GEN_END))
  assert.match(g, /ESPUI\.sliderContinuous = true;/)
  assert.match(g, /ESPUI\.begin\(UI_TITLE\);/)
  assert.doesNotMatch(g, /#error/)
})

test('режим AP: нет STA-кода', () => {
  const p = demoProject('esp32')
  p.wifi.mode = 'ap'
  const g = generate(p, 'esp32')
  assert.doesNotMatch(g, /WiFi\.begin/)
  assert.match(g, /WiFi\.softAP\(UI_AP_SSID, UI_AP_PASS\);/)
})

test('одна вкладка → без Tab, parent = Control::noParent', () => {
  const p = withEl(mini(), {
    id: 'l1', type: 'label', label: 'L', props: {}, binding: { kind: 'var', variable: 'v1', direction: 'toUi' }
  })
  const g = generate(p, 'esp32')
  assert.doesNotMatch(g, /ControlType::Tab/)
  assert.match(g, /ControlColor::Turquoise, Control::noParent\)/)
})

test('несколько вкладок → Tab и parent', () => {
  const g = generate(demoProject('esp32'), 'esp32')
  assert.match(g, /tabMain = ESPUI\.addControl\(ControlType::Tab, "Главная", "Главная"\);/)
  assert.match(g, /ControlColor::Alizarin, tabMain\)/)
  assert.match(g, /ControlColor::Turquoise, tabSettings\)/)
})

test('both: callback запоминает значение (нет эха в UI)', () => {
  const g = generate(demoProject('esp32'), 'esp32')
  assert.match(g, /void cb_swLed\(Control\* sender, int type\) \{\n {2}\(void\)sender;\n {2}bool on = \(type == S_ACTIVE\);\n {2}ledOn = on;\n {2}ui_prev_swLed = ledOn \? 1 : 0;/)
  assert.match(g, /ESPUI\.updateSwitcher\(swLed, cur == 1\);/)
})

test('float: slider округляет, number шлёт строку через updateControlValue', () => {
  const p = mini()
  p.variables = [{ name: 'f', type: 'float', init: '1.5' }]
  withEl(p, { id: 's', type: 'slider', label: 'S', props: {}, binding: { kind: 'var', variable: 'f', direction: 'toUi' } })
  withEl(p, { id: 'n', type: 'number', label: 'N', props: { decimals: 2 }, binding: { kind: 'var', variable: 'f', direction: 'toUi' } })
  const g = generate(p, 'esp32')
  assert.match(g, /int cur = \(int\)lroundf\(f\);/)
  assert.match(g, /String cur = String\(f, 2\);/)
  assert.match(g, /ESPUI\.updateControlValue\(n, cur\);/)
})

test('ESPUI.updateControlValue и спецсимволы в строках экранируются', () => {
  assert.equal(cppString('a"b\\c\nd?'), '"a\\"b\\\\c\\nd\\?"')
  assert.equal(cppString('\x01z'), '"\\x01""z"')
  const g = generate(demoProject('esp32'), 'esp32')
  assert.match(g, /UI_TITLE\[\] = "Демо \\"ESPUI\\"";/)
})

test('ошибки модели → #error в коде', () => {
  const p = mini()
  p.variables.push({ name: 'int', type: 'int', init: '' })
  assert.match(generate(p, 'esp32'), /#error/)
})

test('mergeGenerated заменяет только блок между маркерами', () => {
  const gen = generate(demoProject('esp32'), 'esp32')
  const old = `// моё до\n${GEN_BEGIN}\nстарое\n${GEN_END}\n// моё после\n`
  const merged = mergeGenerated(old, gen)
  assert.ok(merged.startsWith('// моё до\n'))
  assert.ok(merged.endsWith('// моё после\n'))
  assert.ok(!merged.includes('старое'))
  assert.ok(merged.includes('ESPUI.begin('))
  assert.equal(mergeGenerated(null, gen), gen)
  assert.equal(mergeGenerated('без маркеров', gen), gen)
})

// ---------- валидатор ----------
test('валидатор: корректные проекты без ошибок', () => {
  assert.deepEqual(errors(validate(mini())), [])
  assert.deepEqual(errors(validate(demoProject('esp32'))), [])
})

test('валидатор: идентификаторы C++', () => {
  assert.ok(identProblem('1abc'))
  assert.ok(identProblem('a b'))
  assert.ok(identProblem('class'))
  assert.ok(identProblem('Serial'))
  assert.ok(identProblem('cb_x'))
  assert.ok(identProblem('a__b'))
  assert.ok(identProblem('имя'))
  assert.equal(identProblem('ledOn_2'), null)

  const p = mini()
  p.variables = [
    { name: 'dup', type: 'int', init: '' },
    { name: 'dup', type: 'int', init: '' },
    { name: 'bad name', type: 'int', init: '' }
  ]
  const is = validate(p)
  assert.ok(has(is, 'ident-dup'))
  assert.ok(has(is, 'ident'))
})

test('валидатор: id элемента не совпадает с переменной/вкладкой', () => {
  const p = withEl(mini(), { id: 'v1', type: 'label', label: 'x', props: {}, binding: { kind: 'none' } })
  assert.ok(has(validate(p), 'ident-dup'))
  const q = mini()
  q.tabs.push({ id: 'tab1', title: 'x', elements: [] })
  assert.ok(has(validate(q), 'ident-dup'))
})

test('валидатор: начальные значения переменных', () => {
  const p = mini()
  p.variables = [
    { name: 'a', type: 'int', init: '1.5' },
    { name: 'b', type: 'bool', init: 'yes' },
    { name: 'c', type: 'float', init: 'abc' },
    { name: 'd', type: 'String', init: 'any "text"' }
  ]
  const is = validate(p).filter((i) => i.code === 'var-init')
  assert.deepEqual(is.map((i) => i.variable), ['a', 'b', 'c'])
})

test('валидатор: несовместимые типы привязки', () => {
  const p = mini()
  p.variables = [
    { name: 's', type: 'String', init: '' },
    { name: 'i', type: 'int', init: '' },
    { name: 'b', type: 'bool', init: '' }
  ]
  withEl(p, { id: 'sl', type: 'slider', label: 'x', props: {}, binding: { kind: 'var', variable: 's', direction: 'fromUi' } })
  withEl(p, { id: 'tx', type: 'text', label: 'x', props: {}, binding: { kind: 'var', variable: 'i', direction: 'toUi' } })
  withEl(p, { id: 'bt', type: 'button', label: 'x', props: {}, binding: { kind: 'var', variable: 'b', direction: 'toUi' } })
  withEl(p, { id: 'sw', type: 'switcher', label: 'x', props: {}, binding: { kind: 'var', variable: 'b', direction: 'both' } })
  const bad = validate(p).filter((i) => i.code === 'bind-incompat').map((i) => i.elementId)
  assert.deepEqual(bad.sort(), ['bt', 'sl', 'tx'])
})

test('валидатор: переменная не объявлена / не выбрана', () => {
  const p = mini()
  withEl(p, { id: 'l1', type: 'label', label: 'x', props: {}, binding: { kind: 'var', variable: 'nope', direction: 'toUi' } })
  withEl(p, { id: 'l2', type: 'label', label: 'x', props: {}, binding: { kind: 'var', variable: '', direction: 'toUi' } })
  const is = validate(p)
  assert.ok(has(is, 'bind-var-unknown'))
  assert.ok(has(is, 'bind-var-missing'))
})

test('валидатор: пины ESP8266', () => {
  const mk = (pin: number, mode: 'digital' | 'analog', dir: 'toPin' | 'fromPin', type: 'switcher' | 'slider' | 'label'): UiProject => {
    const p = mini()
    p.platform = 'esp8266'
    withEl(p, { id: 'e1', type, label: 'x', props: {}, binding: { kind: 'pin', pin, direction: dir, mode } })
    return p
  }
  assert.ok(has(validate(mk(9, 'digital', 'toPin', 'switcher')), 'pin-flash'))
  assert.ok(has(validate(mk(7, 'digital', 'toPin', 'switcher')), 'pin-flash'))
  assert.ok(has(validate(mk(16, 'analog', 'toPin', 'slider')), 'pin-pwm'))
  assert.ok(has(validate(mk(5, 'analog', 'fromPin', 'label')), 'pin-adc'))
  assert.ok(has(validate(mk(17, 'digital', 'toPin', 'switcher')), 'pin-adc-digital'))
  assert.ok(has(validate(mk(99, 'digital', 'toPin', 'switcher')), 'pin-range'))
  assert.ok(has(validate(mk(-1, 'digital', 'toPin', 'switcher')), 'pin-invalid'))
  assert.deepEqual(errors(validate(mk(17, 'analog', 'fromPin', 'label'))), [])
  assert.ok(has(validate(mk(2, 'digital', 'toPin', 'switcher')), 'pin-strapping'))
})

test('валидатор: пины ESP32 (предупреждения и ошибки)', () => {
  const mk = (pin: number, dir: 'toPin' | 'fromPin', mode: 'digital' | 'analog', type: 'switcher' | 'label'): UiProject => {
    const p = mini()
    withEl(p, { id: 'e1', type, label: 'x', props: {}, binding: { kind: 'pin', pin, direction: dir, mode } })
    return p
  }
  assert.ok(has(validate(mk(35, 'toPin', 'digital', 'switcher')), 'pin-input-only'))
  assert.ok(has(validate(mk(25, 'fromPin', 'analog', 'label')), 'pin-adc2'))
  assert.ok(has(validate(mk(60, 'toPin', 'digital', 'switcher')), 'pin-range'))
  assert.deepEqual(errors(validate(mk(33, 'fromPin', 'analog', 'label'))), [])
})

test('валидатор: конфликты пинов и недопустимый режим', () => {
  const p = mini()
  withEl(p, { id: 'a', type: 'switcher', label: 'x', props: {}, binding: { kind: 'pin', pin: 4, direction: 'toPin', mode: 'digital' } })
  withEl(p, { id: 'b', type: 'switcher', label: 'x', props: {}, binding: { kind: 'pin', pin: 4, direction: 'toPin', mode: 'digital' } })
  withEl(p, { id: 'c', type: 'label', label: 'x', props: {}, binding: { kind: 'pin', pin: 5, direction: 'toPin', mode: 'digital' } })
  const is = validate(p)
  assert.ok(has(is, 'pin-conflict'))
  assert.equal(is.filter((i) => i.code === 'bind-incompat' && i.elementId === 'c').length, 1)
})

test('валидатор: PWM-диапазон, min/max, select, wifi', () => {
  const p = mini()
  withEl(p, { id: 'sl', type: 'slider', label: 'x', props: { min: 10, max: 5 }, binding: { kind: 'none' } })
  withEl(p, { id: 'pw', type: 'slider', label: 'x', props: { min: 0, max: 1000 }, binding: { kind: 'pin', pin: 18, direction: 'toPin', mode: 'analog' } })
  withEl(p, { id: 'se', type: 'select', label: 'x', props: { options: [] }, binding: { kind: 'none' } })
  p.wifi.ssid = ''
  p.wifi.apPassword = '123'
  p.settings.updateMs = 10
  const is = validate(p)
  assert.ok(has(is, 'el-range'))
  assert.ok(has(is, 'pwm-range'))
  assert.ok(has(is, 'sel-empty'))
  assert.ok(has(is, 'wifi-ssid'))
  assert.ok(has(is, 'wifi-ap-pass'))
  assert.ok(has(is, 'update-ms'))
})

test('валидатор: select + int-переменная требует целых значений', () => {
  const p = mini()
  withEl(p, {
    id: 'se', type: 'select', label: 'x',
    props: { options: [{ label: 'a', value: 'abc' }] },
    binding: { kind: 'var', variable: 'v1', direction: 'fromUi' }
  })
  assert.ok(has(validate(p), 'sel-int'))
})

// ---------- фабрика/каталог ----------
test('createElement даёт уникальные корректные id для всех виджетов', () => {
  const p = mini()
  for (const t of WIDGET_ORDER) p.tabs[0].elements.push(createElement(t, p))
  for (const t of WIDGET_ORDER) p.tabs[0].elements.push(createElement(t, p))
  assert.deepEqual(errors(validate(p)), [])
  assert.equal(new Set(p.tabs[0].elements.map((e) => e.id)).size, WIDGET_ORDER.length * 2)
  // генерация не падает на «пустых» виджетах
  assert.doesNotMatch(generate(p, 'esp32'), /#error/)
})

// ---------- сериализация ----------
test('ui.json: round-trip и поле version', () => {
  const p = demoProject('esp32')
  const text = serializeProject(p)
  assert.equal(JSON.parse(text).version, UI_JSON_VERSION)
  const r = parseProject(text)
  assert.ok(r.ok)
  if (r.ok) {
    // парсер дополняет props значениями по умолчанию; после этого round-trip стабилен
    const again = parseProject(serializeProject(r.project))
    assert.ok(again.ok)
    if (again.ok) assert.deepEqual(again.project, r.project)
    assert.deepEqual(r.project.variables, p.variables)
    assert.equal(r.project.tabs[0].elements[0].id, 'lblTemp')
  }
})

test('ui.json: ошибки чтения', () => {
  assert.equal(parseProject('{').ok, false)
  assert.equal(parseProject('[]').ok, false)
  assert.equal(parseProject('{}').ok, false)
  const future = parseProject(JSON.stringify({ version: 99 }))
  assert.equal(future.ok, false)
  const minimal = parseProject(JSON.stringify({ version: 2 }))
  assert.ok(minimal.ok)
  if (minimal.ok) assert.equal(minimal.project.tabs.length, 1)
})

test('каталог виджетов: у каждого есть ControlType и свойства', () => {
  for (const t of WIDGET_ORDER) {
    assert.ok(WIDGETS[t].espuiType)
    assert.equal(WIDGETS[t].type, t)
  }
})

test('data/espui/widgets.json синхронизирован с каталогом виджетов', () => {
  const file = resolve(here, '../../../../../data/espui/widgets.json')
  assert.ok(existsSync(file), 'нет data/espui/widgets.json — запустите tools/export-schema.ts')
  assert.equal(normalize(readFileSync(file, 'utf8')), buildSchema())
})

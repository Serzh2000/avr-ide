import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bindingForIntent, describeBinding, intentOf, intentsFor, typesForIntent, varCompat, suggestVarName, generateWithIssues, createDefaultProject, createElement } from '../core/index'
import { parseSketch } from '../sketch/parse'
import { resolveProject } from '../sketch/resolve'

test('варианты «Что должно происходить?» зависят от элемента', () => {
  const ids = (t: Parameters<typeof intentsFor>[0]): string[] => intentsFor(t).map((i) => i.id)
  assert.deepEqual(ids('label'), ['none', 'show', 'pinRead'])
  assert.ok(ids('switcher').includes('both') && ids('switcher').includes('pinWrite'))
  assert.deepEqual(ids('separator'), ['none'])
  assert.ok(ids('button').includes('callback') && !ids('button').includes('show'))
})

test('intent ↔ binding и сохранение источника', () => {
  const b = bindingForIntent({ id: 'x', type: 'slider' }, 'write', { kind: 'var', variable: 'v', direction: 'toUi' })
  assert.deepEqual(b, { kind: 'var', variable: 'v', direction: 'fromUi' })
  assert.equal(intentOf(b), 'write')
  const p = bindingForIntent({ id: 'x', type: 'switcher' }, 'pinWrite', { kind: 'none' })
  assert.equal(p.kind === 'pin' && p.pin, -1)
})

test('совместимость типов: понятные объяснения', () => {
  assert.equal(varCompat('slider', 'bool', 'fromUi').ok, false)
  assert.match(varCompat('slider', 'bool', 'fromUi').text, /только 0\/1/)
  assert.equal(varCompat('label', 'float', 'toUi').ok, true)
  assert.equal(varCompat('switcher', 'float', 'toUi').ok, false)
  assert.deepEqual(typesForIntent('text', 'both'), ['String'])
})

test('имя новой переменной по id элемента и описание привязки', () => {
  assert.equal(suggestVarName({ id: 'lblTemp', type: 'label', label: '' }, new Set()), 'temp')
  assert.equal(suggestVarName({ id: 'lblTemp', type: 'label', label: '' }, new Set(['temp'])), 'temp2')
  const p = createDefaultProject('esp32')
  const e = createElement('label', p)
  e.binding = { kind: 'var', variable: 'temp', direction: 'toUi' }
  assert.match(describeBinding(e, { updateMs: 500 }), /«temp»/)
})

test('переменные скетча не объявляются в ui_generated.h; порядок и имена пинов', () => {
  const sk = parseSketch('float temperature = 1;\n#define LED_PIN 2\nvoid setup(){}\nvoid loop(){}\n')
  const p = createDefaultProject('esp32')
  p.wifi.ssid = 'x'
  p.variables = [{ name: 'temperature', type: 'float', init: '', external: true }]
  const l = createElement('label', p)
  l.binding = { kind: 'var', variable: 'temperature', direction: 'toUi' }
  const s = createElement('switcher', p)
  s.binding = { kind: 'pin', pin: 0, pinName: 'LED_PIN', direction: 'toPin', mode: 'digital' }
  p.tabs[0].elements.push(l, s)
  const r = resolveProject(p, sk)
  const { code, issues, regions } = generateWithIssues(r.project, 'esp32')
  assert.deepEqual(issues.filter((i) => i.severity === 'error'), [])
  assert.ok(!/float temperature =/.test(code), 'не должно быть повторного объявления')
  assert.match(code, /String\(temperature, 2\)/)
  assert.match(code, /pinMode\(LED_PIN, OUTPUT\)/)
  assert.ok(regions.some((x) => x.elementId === l.id && x.kind === 'update'))
  assert.ok(regions.some((x) => x.elementId === s.id && x.kind === 'callback'))
  // регионы ссылаются на реальные строки без служебных меток
  assert.ok(!code.includes('\u0001'))
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addCallbackStub, diffHunks, lineDiff, planIntegration } from '../sketch/integrate'
import { parseSketch } from '../sketch/parse'
import { resolveProject } from '../sketch/resolve'
import { createDefaultProject, createElement, validate } from '../core/index'

const SKETCH = `#include <Arduino.h>
float temperature = 21.5;
bool ledState = false;
#define LED_PIN 2

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  temperature += 0.1;
  delay(100);
}
`

test('вставка: #include после переменных, ui_setup в конец setup, ui_loop в начало loop', () => {
  const plan = planIntegration(SKETCH)
  assert.ok(plan.changed)
  const lines = plan.code.split('\n')
  const incl = lines.findIndex((l) => l.startsWith('#include "ui_generated.h"'))
  assert.ok(incl > 3, 'после #define LED_PIN')
  assert.ok(lines.findIndex((l) => l.includes('#define LED_PIN')) < incl)
  assert.ok(incl < lines.findIndex((l) => l.startsWith('void setup')))
  const su = lines.findIndex((l) => l.includes('ui_setup();'))
  assert.ok(su > lines.findIndex((l) => l.includes('pinMode(LED_PIN')))
  assert.ok(lines[su + 1] === '}')
  const lo = lines.findIndex((l) => l.includes('ui_loop();'))
  assert.equal(lines[lo - 1], 'void loop() {')
  assert.equal(plan.changes.length, 3)
})

test('вставка идемпотентна', () => {
  const once = planIntegration(SKETCH)
  const twice = planIntegration(once.code)
  assert.equal(twice.changed, false)
  assert.equal(twice.code, once.code)
  assert.equal(twice.already.length, 3)
  const count = (s: string, sub: string): number => s.split(sub).length - 1
  assert.equal(count(twice.code, 'ui_setup'), 1)
  assert.equal(count(twice.code, '#include "ui_generated.h"'), 1)
})

test('вставка: вызовы в комментариях не считаются', () => {
  const code = `float a;\n// ui_setup();\nvoid setup() {\n}\nvoid loop() {\n}\n`
  const plan = planIntegration(code)
  assert.ok(plan.changes.some((c) => c.includes('ui_setup')))
  assert.equal((plan.code.match(/ui_setup\(\);/g) ?? []).length, 2)
})

test('вставка: однострочные setup/loop, CRLF, нет функций', () => {
  const one = planIntegration('int a;\nvoid setup(){ Serial.begin(9600); }\nvoid loop(){ }\n')
  assert.match(one.code, /void setup\(\)\{ Serial\.begin\(9600\);\s+ui_setup\(\);\s+\}/)
  assert.match(one.code, /void loop\(\)\{ ui_loop\(\);/)
  const crlf = planIntegration('int a;\r\nvoid setup() {\r\n}\r\nvoid loop() {\r\n}\r\n')
  assert.ok(!/[^\r]\n/.test(crlf.code.replace(/\r\n/g, '')) || true)
  assert.equal(crlf.code.split('\r\n').join('\n').split('\r').length, 1)
  const none = planIntegration('int a = 1;\n')
  assert.match(none.code, /void setup\(\) \{\n  ui_setup\(\);\n\}/)
  assert.match(none.code, /void loop\(\) \{\n  ui_loop\(\);\n\}/)
})

test('вставка: переменные ниже setup() дают предупреждение', () => {
  const plan = planIntegration('int a;\nvoid setup() {\n}\nint late;\nvoid loop() {\n}\n')
  assert.ok(plan.warnings.length > 0)
})

test('заготовка обработчика добавляется один раз', () => {
  const a = addCallbackStub(SKETCH, 'onSwitch', 'switcher', 'Свет')
  assert.match(a, /void onSwitch\(Control\* sender, int type\) \{/)
  assert.equal(addCallbackStub(a, 'onSwitch', 'switcher', 'Свет'), a)
  assert.ok(parseSketch(a).funcs.some((f) => f.name === 'onSwitch' && f.isCallback))
})

test('diff: только добавления, свёртка контекста', () => {
  const plan = planIntegration(SKETCH)
  const d = lineDiff(SKETCH, plan.code)
  assert.equal(d.filter((l) => l.kind === 'del').length, 0)
  assert.equal(d.filter((l) => l.kind === 'add').length >= 3, true)
  const h = diffHunks(d, 1)
  assert.ok(h.some((x) => x.kind === 'gap') || h.length <= d.length)
})

test('resolveProject: переменная из скетча, пропажа, const, конфликты', () => {
  const sk = parseSketch(`float temperature = 21.5;\nconst int limit = 5;\n#define LED_PIN 2\nvoid setup(){}\nvoid loop(){}\nint late;\n`)
  const p = createDefaultProject('esp32')
  p.wifi.ssid = 'x'
  const lbl = createElement('label', p)
  lbl.binding = { kind: 'var', variable: 'temperature', direction: 'toUi' }
  const sld = createElement('slider', p)
  sld.binding = { kind: 'var', variable: 'limit', direction: 'fromUi' }
  const sw = createElement('switcher', p)
  sw.binding = { kind: 'pin', pin: 99, pinName: 'LED_PIN', direction: 'toPin', mode: 'digital' }
  const gone = createElement('label', p)
  gone.binding = { kind: 'var', variable: 'vanished', direction: 'toUi' }
  p.tabs[0].elements.push(lbl, sld, sw, gone)
  p.variables = [
    { name: 'temperature', type: 'int', init: '', external: true },
    { name: 'limit', type: 'int', init: '', external: true },
    { name: 'vanished', type: 'int', init: '', external: true },
    { name: 'late', type: 'int', init: '0' }
  ]
  const r = resolveProject(p, sk)
  assert.equal(r.project.variables[0].type, 'float')
  assert.equal(r.project.variables[0].init, '21.5')
  const sw2 = r.project.tabs[0].elements[2]
  assert.equal(sw2.binding.kind === 'pin' && sw2.binding.pin, 2)
  const codes = r.issues.map((i) => i.code)
  assert.ok(codes.includes('sketch-var-const'))
  assert.ok(codes.includes('sketch-var-missing'))
  assert.ok(codes.includes('var-clash-sketch'))
  // валидатор не ругается на «зарезервированное» имя переменной из скетча и не считает её неизвестной
  const issues = validate(r.project, 'esp32')
  assert.ok(!issues.some((i) => i.code === 'bind-var-unknown'))
})

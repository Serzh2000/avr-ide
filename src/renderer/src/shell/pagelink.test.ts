import test from 'node:test'
import assert from 'node:assert/strict'
import { diffHunks, lineDiff, planDeclareVariable, planIntegration } from '../uibuilder/sketch/integrate'
import { parseSketch } from '../uibuilder/sketch/parse'
import { createDefaultProject, createElement, serializeProject as serializeUi } from '../uibuilder/core/index'
import { createBlock, createDefaultProject as createWebProject, generateCpp, serializeProject as serializeWeb } from '../webdesign/core/index'
import { resolveWdProject } from '../webdesign/core/sketchlink'
import { countPageItems, genPage, guardWebHeader, ledcApiFromHeader, pageLinkState, serializeUiPage, ledcApiFromJson } from './pageGen'
import { explainFailure, nextStep } from './guide'
import type { NextStepInput } from './guide'

const SKETCH = `#include <Arduino.h>
float temperature = 21.5;
bool relay = false;
#define LED_PIN 2

void setup() {
  Serial.begin(115200);
}

void loop() {
  temperature += 0.1;
}
`
const count = (s: string, sub: string): number => s.split(sub).length - 1

// ---------- планировщик: веб-дизайнер ----------

test('веб-дизайнер: include после переменных, wdBegin в конец setup, wdLoop в начало loop', () => {
  const plan = planIntegration(SKETCH, 'web')
  assert.ok(plan.changed)
  const lines = plan.code.split('\n')
  const incl = lines.findIndex((l) => l.startsWith('#include "web_generated.h"'))
  assert.ok(incl > lines.findIndex((l) => l.includes('#define LED_PIN')))
  assert.ok(incl < lines.findIndex((l) => l.startsWith('void setup')))
  const b = lines.findIndex((l) => l.includes('wdBegin();'))
  assert.ok(b > lines.findIndex((l) => l.includes('Serial.begin')))
  assert.equal(lines[b + 1], '}')
  const lp = lines.findIndex((l) => l.includes('wdLoop();'))
  assert.equal(lines[lp - 1], 'void loop() {')
  assert.equal(plan.changes.length, 3)
  assert.equal(plan.conflict, undefined)
})

test('веб-дизайнер: идемпотентность и переменные выше include', () => {
  const once = planIntegration(SKETCH, 'web')
  const twice = planIntegration(once.code, 'web')
  assert.equal(twice.changed, false)
  assert.equal(twice.code, once.code)
  assert.equal(twice.already.length, 3)
  assert.equal(count(twice.code, 'wdBegin'), 1)
  assert.equal(count(twice.code, '#include "web_generated.h"'), 1)
  // переменные не объявляются заново: исходные объявления остались единственными
  assert.equal(count(twice.code, 'float temperature'), 1)
  // include стоит ниже всех объявлений, которые были выше setup()
  const info = parseSketch(twice.code)
  const inc = info.includes.find((i) => i.header === 'web_generated.h')!
  for (const v of info.vars) assert.ok(v.offset < inc.offset, `${v.name} объявлена выше include`)
})

test('веб-дизайнер: переменная ниже setup() — предупреждение', () => {
  const plan = planIntegration('int a;\nvoid setup() {\n}\nint late;\nvoid loop() {\n}\n', 'web')
  assert.ok(plan.warnings.some((w) => w.includes('ниже setup()')))
})

test('CRLF и LF: окончания строк сохраняются', () => {
  for (const kind of ['ui', 'web'] as const) {
    const crlf = SKETCH.replace(/\n/g, '\r\n')
    const p = planIntegration(crlf, kind)
    assert.ok(p.changed)
    assert.equal(p.code.replace(/\r\n/g, '').includes('\n'), false, `${kind}: нет одиночных LF в CRLF-файле`)
    assert.equal(p.code.replace(/\r\n/g, '').includes('\r'), false, `${kind}: нет одиночных CR`)
    const lf = planIntegration(SKETCH, kind)
    assert.equal(lf.code.includes('\r'), false)
    assert.equal(planIntegration(p.code, kind).changed, false, `${kind}: CRLF идемпотентно`)
  }
})

test('скетч без setup()/loop() и однострочные функции', () => {
  const none = planIntegration('int a = 1;\n', 'web')
  assert.match(none.code, /void setup\(\) \{\n  wdBegin\(\);\n\}/)
  assert.match(none.code, /void loop\(\) \{\n  wdLoop\(\);\n\}/)
  const one = planIntegration('int a;\nvoid setup(){ Serial.begin(9600); }\nvoid loop(){ }\n', 'web')
  assert.match(one.code, /void setup\(\)\{ Serial\.begin\(9600\);\s+wdBegin\(\);\s+\}/)
  assert.match(one.code, /void loop\(\)\{ wdLoop\(\);/)
})

test('вызовы в комментариях и строках не считаются подключением', () => {
  const code = `float a;\n// wdBegin();\nconst char* s = "wdLoop();";\nvoid setup() {\n}\nvoid loop() {\n}\n`
  const plan = planIntegration(code, 'web')
  assert.ok(plan.changes.some((c) => c.includes('wdBegin')))
  assert.ok(plan.changes.some((c) => c.includes('wdLoop')))
})

// ---------- конфликт двух страниц ----------

test('конфликт: ESPUI уже подключён — веб-дизайнер предупреждает и не меняет скетч', () => {
  const ui = planIntegration(SKETCH, 'ui').code
  const plan = planIntegration(ui, 'web')
  assert.ok(plan.conflict)
  assert.equal(plan.conflict!.with, 'ui')
  assert.match(plan.conflict!.message, /порту 80/)
  assert.equal(plan.changed, false)
  assert.equal(plan.code, ui)
})

test('конфликт: замена ESPUI веб-дизайнером убирает ui_* и добавляет wd*', () => {
  const ui = planIntegration(SKETCH, 'ui').code
  const plan = planIntegration(ui, 'web', { replaceOther: true })
  assert.equal(plan.conflict, undefined)
  assert.ok(plan.changed)
  assert.equal(count(plan.code, 'ui_generated.h'), 0)
  assert.equal(count(plan.code, 'ui_setup'), 0)
  assert.equal(count(plan.code, 'ui_loop'), 0)
  assert.equal(count(plan.code, '#include "web_generated.h"'), 1)
  assert.equal(count(plan.code, 'wdBegin();'), 1)
  assert.equal(count(plan.code, 'wdLoop();'), 1)
  // после замены повторный запуск ничего не меняет и конфликта нет
  const again = planIntegration(plan.code, 'web')
  assert.equal(again.changed, false)
  assert.equal(again.conflict, undefined)
  // остальной код цел
  assert.ok(plan.code.includes('temperature += 0.1;'))
  assert.ok(plan.code.includes('Serial.begin(115200);'))
})

test('конфликт: обратная замена, CRLF и вызов в одной строке с другим кодом', () => {
  const web = planIntegration(SKETCH.replace(/\n/g, '\r\n'), 'web').code
  const plan = planIntegration(web, 'ui', { replaceOther: true })
  assert.equal(count(plan.code, 'wdBegin'), 0)
  assert.equal(count(plan.code, 'web_generated'), 0)
  assert.equal(count(plan.code, 'ui_setup();'), 1)
  assert.equal(plan.code.replace(/\r\n/g, '').includes('\n'), false)
  const inline = planIntegration('int a;\n#include "ui_generated.h"\nvoid setup(){ ui_setup(); Serial.begin(9600); }\nvoid loop(){ ui_loop(); }\n', 'web', { replaceOther: true })
  assert.equal(count(inline.code, 'ui_'), 0)
  assert.ok(inline.code.includes('Serial.begin(9600);'))
  assert.equal(count(inline.code, 'wdBegin();'), 1)
})

test('diff подключения веб-страницы содержит только добавления', () => {
  const plan = planIntegration(SKETCH, 'web')
  const d = lineDiff(SKETCH, plan.code)
  assert.equal(d.filter((l) => l.kind === 'del').length, 0)
  assert.ok(d.filter((l) => l.kind === 'add').length >= 3)
  assert.ok(diffHunks(d, 1).length > 0)
})

// ---------- «Создать переменную в скетче» ----------

test('объявление переменной встаёт выше include страницы и выше setup()', () => {
  const connected = planIntegration(SKETCH, 'web').code
  const plan = planDeclareVariable(connected, 'speed', 'int', '5')
  assert.ok(plan.changed)
  const info = parseSketch(plan.code)
  const v = info.vars.find((x) => x.name === 'speed')!
  assert.ok(v)
  assert.equal(v.type, 'int')
  const inc = info.includes.find((i) => i.header === 'web_generated.h')!
  assert.ok(v.offset < inc.offset, 'объявление выше include')
  assert.ok(v.offset < info.setup!.offset)
  assert.ok(plan.code.includes('int speed = 5;'))
})

test('объявление без include: после остальных объявлений, всех четырёх типов; занятое имя не трогает', () => {
  const t = (type: 'bool' | 'int' | 'float' | 'String', init: string, expect: string): void => {
    const p = planDeclareVariable(SKETCH, 'v', type, init)
    assert.ok(p.code.includes(expect), `${type}: ${expect}`)
    const info = parseSketch(p.code)
    assert.equal(info.vars.find((x) => x.name === 'v')?.type, type)
    assert.ok(info.vars.find((x) => x.name === 'v')!.offset < info.setup!.offset)
  }
  t('bool', '', 'bool v = false;')
  t('int', 'abc', 'int v = 0;')
  t('float', '1.5', 'float v = 1.5;')
  t('String', 'a"b', 'String v = "a\\"b";')
  const taken = planDeclareVariable(SKETCH, 'temperature', 'float')
  assert.equal(taken.changed, false)
  assert.ok(taken.already.length > 0)
  const clash = planDeclareVariable(SKETCH, 'LED_PIN', 'int')
  assert.equal(clash.changed, false)
  assert.ok(clash.warnings[0].includes('занято'))
  const crlf = planDeclareVariable(SKETCH.replace(/\n/g, '\r\n'), 'x', 'int')
  assert.equal(crlf.code.replace(/\r\n/g, '').includes('\n'), false)
  const empty = planDeclareVariable('', 'x', 'int')
  assert.equal(empty.code, 'int x = 0;\n')
})

// ---------- веб-дизайнер: переменные из скетча ----------

function webProject(vars: Array<{ name: string; type: 'bool' | 'int' | 'float' | 'String'; init: string; external?: boolean }>, bindings: Array<[string, 'toUi' | 'fromUi' | 'both']>) {
  const p = createWebProject('esp32')
  p.variables = vars
  bindings.forEach(([name, dir], i) => {
    const b = createBlock(dir === 'toUi' ? 'sensor' : 'slider', `b${i}`)
    b.binding = { kind: 'var', variable: name, direction: dir }
    p.blocks[0].children.push(b)
  })
  return p
}

test('генератор не объявляет внешние переменные, свои объявляет', () => {
  const p = webProject([{ name: 'temperature', type: 'float', init: '21.5', external: true }, { name: 'own', type: 'int', init: '3' }], [['temperature', 'toUi'], ['own', 'fromUi']])
  const h = generateCpp(p).header
  assert.equal(/^float temperature =/m.test(h), false)
  assert.ok(/^int own = 3;/m.test(h))
  assert.ok(h.includes('wd_prev_temperature'))
  assert.ok(h.includes('wd_send("temperature", temperature)'))
})

test('resolveWdProject: тип из скетча, пропавшая, const, двойное объявление, поздняя', () => {
  const sk = parseSketch(`float temperature = 21.5;\nconst int limit = 5;\nint dup;\nvoid setup(){}\nvoid loop(){}\nint late;\n`)
  const p = webProject(
    [
      { name: 'temperature', type: 'int', init: '', external: true },
      { name: 'limit', type: 'int', init: '', external: true },
      { name: 'vanished', type: 'int', init: '', external: true },
      { name: 'late', type: 'int', init: '', external: true },
      { name: 'dup', type: 'int', init: '0' }
    ],
    [['temperature', 'toUi'], ['limit', 'fromUi'], ['vanished', 'toUi'], ['late', 'toUi'], ['dup', 'toUi']]
  )
  const r = resolveWdProject(p, sk)
  assert.equal(r.project.variables[0].type, 'float')
  assert.equal(r.project.variables[0].init, '21.5')
  const codes = r.issues.map((i) => i.code)
  for (const c of ['sketch-var-const', 'sketch-var-missing', 'sketch-var-late', 'var-clash-sketch']) assert.ok(codes.includes(c), c)
  // проблема привязана к блоку, который использует переменную
  const missing = r.issues.find((i) => i.code === 'sketch-var-missing')!
  assert.equal(missing.blockId, 'b2')
  assert.match(missing.message, /удалили или переименовали/)
  // без скетча ничего не меняется
  assert.deepEqual(resolveWdProject(p, null).issues, [])
})

test('web_design.json: external переживает сохранение и чтение', () => {
  const p = webProject([{ name: 'temperature', type: 'float', init: '', external: true }, { name: 'own', type: 'int', init: '' }], [['temperature', 'toUi']])
  const json = serializeWeb(p)
  assert.ok(json.includes('"external": true'))
  assert.equal(countPageItems('web', json) > 0, true)
  const gen = genPage('web', { json, sketchCode: SKETCH })
  assert.ok(gen.ok)
})

// ---------- генерация из сохранённой страницы ----------

function uiJson(varName = 'temperature'): string {
  const p = createDefaultProject('esp32')
  p.wifi.ssid = 'net'
  p.wifi.password = '12345678'
  const lbl = createElement('label', p)
  lbl.binding = { kind: 'var', variable: varName, direction: 'toUi' }
  p.tabs[0].elements.push(lbl)
  p.variables = [{ name: varName, type: 'int', init: '', external: true }]
  return serializeUi(p)
}

test('genPage ESPUI: детерминирован, берёт тип из скетча, замечает пропажу переменной', () => {
  const a = genPage('ui', { json: uiJson(), sketchCode: SKETCH })
  const b = genPage('ui', { json: uiJson(), sketchCode: SKETCH })
  assert.ok(a.ok && b.ok)
  if (!a.ok || !b.ok) return
  assert.equal(a.header, b.header)
  assert.equal(a.errors.length, 0)
  assert.ok(a.items >= 1)
  assert.ok(a.header.includes('temperature'))
  // тип в скетче изменился — заголовок другой
  const c = genPage('ui', { json: uiJson(), sketchCode: SKETCH.replace('float temperature', 'int temperature') })
  assert.ok(c.ok && c.header !== a.header)
  // переменную удалили/переименовали в скетче: ошибка привязана к элементу
  const d = genPage('ui', { json: uiJson(), sketchCode: SKETCH.replace(/temperature/g, 'temp2') })
  assert.ok(d.ok)
  if (d.ok) {
    assert.ok(d.errors.some((e) => /удалили или переименовали/.test(e.message)))
    assert.ok(d.errors[0].targetId)
  }
})

test('genPage: ядро LEDC берётся из json, затем из прежнего заголовка', () => {
  const p = createDefaultProject('esp32')
  assert.equal(ledcApiFromJson(serializeUiPage(p, 'v2')), 'v2')
  assert.equal(ledcApiFromJson(serializeUiPage(p, 'v3')), null)
  assert.equal(ledcApiFromHeader('// Платформа: esp32, LEDC API v2'), 'v2')
  assert.equal(ledcApiFromHeader(null), 'v3')
  const g = genPage('ui', { json: serializeUiPage(p, 'v2'), sketchCode: SKETCH })
  assert.ok(g.ok && g.header.includes('LEDC API v2'))
  const g2 = genPage('ui', { json: serializeUi(p), sketchCode: SKETCH, existingHeader: '// LEDC API v2' })
  assert.ok(g2.ok && g2.header.includes('LEDC API v2'))
})

test('genPage: платформа платы переопределяет платформу страницы; повреждённый файл — ok:false', () => {
  const j = uiJson()
  const g = genPage('ui', { json: j, sketchCode: SKETCH, board: 'esp8266' })
  assert.ok(g.ok && /esp8266/i.test(g.header.split('\n')[1]))
  const bad = genPage('web', { json: '{oops', sketchCode: SKETCH })
  assert.equal(bad.ok, false)
  const avr = genPage('ui', { json: j, sketchCode: SKETCH, board: 'avr' })
  assert.ok(avr.ok && /esp32/.test(avr.header.split('\n')[1]))
})

test('genPage веб-дизайнер: ошибки модели дают #error, исправная модель — нет', () => {
  const good = webProject([{ name: 'temperature', type: 'float', init: '', external: true }], [['temperature', 'toUi']])
  const g = genPage('web', { json: serializeWeb(good), sketchCode: SKETCH })
  assert.ok(g.ok)
  if (g.ok) {
    assert.equal(g.errors.length, 0)
    assert.equal(g.header.includes('#error'), false)
  }
  // переменная исчезла из скетча
  const gone = genPage('web', { json: serializeWeb(good), sketchCode: SKETCH.replace(/temperature/g, 'temp2') })
  assert.ok(gone.ok)
  if (gone.ok) {
    assert.ok(gone.errors.length > 0)
    assert.ok(gone.header.includes('#error "web_generated.h'))
    assert.ok(gone.errors.some((e) => e.targetId === 'b0'))
  }
  assert.equal(guardWebHeader('#pragma once\nx', 0), '#pragma once\nx')
  assert.ok(guardWebHeader('#pragma once\nx', 2).startsWith('#pragma once\n#error'))
})

test('статус связи: не подключено / актуален / устарел', () => {
  assert.equal(pageLinkState(false, 'a', 'a'), 'off')
  assert.equal(pageLinkState(true, 'a', 'a'), 'ok')
  assert.equal(pageLinkState(true, 'a', 'b'), 'stale')
  assert.equal(pageLinkState(true, null, 'b'), 'stale')
  assert.equal(pageLinkState(true, 'a', null), 'stale')
})

test('countPageItems: пусто, битый файл, элементы', () => {
  assert.equal(countPageItems('ui', '{'), 0)
  assert.equal(countPageItems('web', '{'), 0)
  assert.equal(countPageItems('ui', serializeUi(createDefaultProject('esp32'))), 0)
  assert.equal(countPageItems('ui', uiJson()), 1)
})

// ---------- подсказки «Дальше» и объяснение ошибок ----------

const base: NextStepInput = { found: true, busy: false, fqbn: 'esp32:esp32:esp32', coreMissing: false, portProblem: false, result: null, errors: 0, dirty: false }

test('«Дальше»: страница не подключена к скетчу', () => {
  assert.equal(nextStep({ ...base, pageUnlinked: 'web' })?.action, 'linkWeb')
  assert.equal(nextStep({ ...base, pageUnlinked: 'ui' })?.action, 'linkUi')
  assert.match(nextStep({ ...base, pageUnlinked: 'ui' })!.text, /Страница не подключена/)
  assert.equal(nextStep({ ...base, pageUnlinked: null })?.action, 'verify')
  // плата и ядро важнее
  assert.equal(nextStep({ ...base, fqbn: '', pageUnlinked: 'ui' })?.action, 'pickBoard')
  assert.equal(nextStep({ ...base, busy: true, busyKind: 'compile', pageUnlinked: 'ui' })?.text, 'Идёт сборка…')
  // ошибки последней сборки важнее
  assert.equal(nextStep({ ...base, pageUnlinked: 'ui', result: { kind: 'compile', ok: false, cancelled: false }, errors: 1 })?.action, 'problems')
})

test('explainFailure: #error страницы и двойное объявление переменной', () => {
  const e1 = explainFailure(['web_generated.h:3:2: error: #error "web_generated.h: в модели страницы есть ошибки"'], '')
  assert.equal(e1?.action, 'openWeb')
  assert.equal(explainFailure([], 'ui_generated.h:5:2: error: #error "ui_generated.h: модель конструктора содержит ошибки"')?.action, 'openUi')
  const e2 = explainFailure(["web_generated.h:12:7: error: redeclaration of 'float temperature'"], '')
  assert.equal(e2?.action, 'openWeb')
  assert.match(e2!.text, /переменную из скетча/)
  // обычное переопределение без файла страницы — не наша тема
  assert.equal(explainFailure(["sketch.ino:3:5: error: redefinition of 'int a'"], '')?.action === 'openWeb', false)
})

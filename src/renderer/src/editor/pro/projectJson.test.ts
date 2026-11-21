// avride.project.json в редакторе: диагностика (синтаксис и validateProject с привязкой к строке), положение курсора для подсказок, описания полей.
import test from 'node:test'
import assert from 'node:assert/strict'
import { presetByChip } from '../../../../main/pro/project/presets'
import { scaffoldFiles } from '../../../../main/pro/project/scaffold'
import { FIELDS, cursorPath, childKeys, fieldAt, isProjectFile, normalizePath, parseTree, projectIssues } from './projectJson'

const OK = scaffoldFiles('EdPro', presetByChip('STM32F103C8T6')!, 'blink')['avride.project.json']

const lineOf = (text: string, offset: number): number => text.slice(0, offset).split('\n').length

test('isProjectFile: только avride.project.json', () => {
  assert.ok(isProjectFile('C:\\p\\avride.project.json'))
  assert.ok(isProjectFile('/p/avride.project.json'))
  assert.ok(!isProjectFile('/p/other.json'))
  assert.ok(!isProjectFile(null))
})

test('projectIssues: корректный файл без замечаний', () => {
  assert.deepEqual(projectIssues(OK), [])
})

test('projectIssues: неверное значение — маркер на строке этого значения', () => {
  const bad = OK.replace('"optimization": "Og"', '"optimization": "O9"')
  const issues = projectIssues(bad)
  assert.equal(issues.length, 1)
  assert.equal(issues[0].severity, 'error')
  assert.match(issues[0].message, /optimization/)
  assert.equal(lineOf(bad, issues[0].start), bad.split('\n').findIndex((l) => l.includes('O9')) + 1)
})

test('projectIssues: неизвестное поле — предупреждение на ключе; пропавшее обязательное — ошибка у родителя', () => {
  const warn = projectIssues(OK.replace('"name"', '"unknownKey": 1,\n  "name"'))
  assert.equal(warn.length, 1)
  assert.equal(warn[0].severity, 'warning')
  const bad = projectIssues(OK.replace(/"linkerScript": "[^"]*",?/, ''))
  assert.ok(bad.some((i) => i.severity === 'error' && /linkerScript/.test(i.message)))
})

test('projectIssues: синтаксис JSON — ошибка с позицией', () => {
  const broken = OK.replace('"name"', 'name"')
  const r = projectIssues(broken)
  assert.equal(r.length, 1)
  assert.match(r[0].message, /JSON/)
  assert.ok(r[0].start >= 0 && r[0].start < broken.length)
  assert.deepEqual(projectIssues('{ "a": '), r.length ? projectIssues('{ "a": ') : [])
})

test('parseTree и fieldAt: описание ключа под курсором', () => {
  const t = parseTree(OK)!
  assert.equal(t.kind, 'object')
  const at = OK.indexOf('"core"') + 2
  const f = fieldAt(OK, at)!
  assert.equal(f.key, 'target.core')
  assert.deepEqual(f.doc.values?.includes('cortex-m3'), true)
  const cfg = fieldAt(OK, OK.indexOf('"optimization"') + 3)!
  assert.equal(cfg.key, 'configurations.*.optimization')
  assert.equal(fieldAt(OK, OK.indexOf('"Debug"') + 2)?.key, 'configurations.*', 'имя конфигурации описывается как «конфигурация»')
})

test('cursorPath: ключ в объекте и значение на той же строке', () => {
  const text = '{\n  "target": {\n    "core": "cor\n  }\n}'
  const valueAt = text.lastIndexOf('cor') + 3
  const v = cursorPath(text, valueAt)!
  assert.deepEqual(v.path, ['target'])
  assert.equal(v.forKey, 'core')
  assert.equal(v.inKey, false)
  const keyText = '{\n  "target": {\n    "co\n  }\n}'
  const k = cursorPath(keyText, keyText.indexOf('"co') + 3)!
  assert.deepEqual(k.path, ['target'])
  assert.equal(k.inKey, true)
  const empty = cursorPath('{\n  \n}', 4)!
  assert.deepEqual(empty.path, [])
  assert.equal(empty.inKey, true)
})

test('childKeys и normalizePath: ключи по пути, конфигурации — через «*»', () => {
  assert.ok(childKeys(['target']).includes('memory'))
  assert.deepEqual(childKeys(['target', 'memory']).sort(), ['extra', 'flash', 'ram'])
  assert.ok(childKeys(['configurations', 'Debug']).includes('optimization'))
  assert.equal(normalizePath(['configurations', 'Debug', 'optimization']), 'configurations.*.optimization')
  assert.ok(childKeys([]).includes('configurations'))
})

test('FIELDS: у каждого поля есть описание, перечисления совпадают с валидатором', () => {
  for (const [k, v] of Object.entries(FIELDS)) assert.ok(v.desc.length > 10, k)
  assert.deepEqual([...(FIELDS['target.core'].values ?? [])], ['cortex-m0', 'cortex-m0plus', 'cortex-m3', 'cortex-m4', 'cortex-m7', 'cortex-m33'])
  assert.deepEqual([...(FIELDS['programmer.kind'].values ?? [])], ['stlink', 'jlink', 'cmsis-dap'])
})

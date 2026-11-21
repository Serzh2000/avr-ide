import test from 'node:test'
import assert from 'node:assert/strict'
import { migrateProject } from './migrate'
import { PRO_PRESETS, defaultProject, presetByChip } from './presets'
import { PRO_TEMPLATES, scaffoldFiles, templateSupported } from './scaffold'
import { parseProjectText, serializeProject } from './serialize'
import { SCHEMA_VERSION } from './types'
import { formatIssues, isProjectPath, validateProject } from './validate'

const blue = presetByChip('STM32F103C8T6')!
const good = (): Record<string, unknown> => JSON.parse(serializeProject(defaultProject('Blink', blue)))

test('валидатор: проект Blue Pill из мастера корректен', () => {
  const r = validateProject(good())
  assert.ok(r.ok, r.ok ? '' : formatIssues(r.errors))
  if (r.ok) {
    assert.equal(r.project.target.chip, 'STM32F103C8T6')
    assert.equal(r.project.target.core, 'cortex-m3')
    assert.equal(r.project.target.memory.flash.origin, '0x08000000')
    assert.equal(r.project.target.memory.flash.size, 65536)
    assert.equal(r.project.target.memory.ram.size, 20480)
    assert.equal(r.project.programmer.kind, 'stlink')
    assert.deepEqual(Object.keys(r.project.configurations), ['Debug', 'Release'])
    assert.equal(r.warnings.length, 0)
  }
})

test('валидатор: все пресеты мастера проходят проверку', () => {
  for (const p of PRO_PRESETS) {
    const r = validateProject(defaultProject('P', p))
    assert.ok(r.ok, p.chip + ': ' + (r.ok ? '' : formatIssues(r.errors)))
  }
})

test('валидатор: не объект, нет версии, лишние поля', () => {
  assert.equal(validateProject(null).ok, false)
  assert.equal(validateProject([]).ok, false)
  const j = good()
  delete j['schemaVersion']
  assert.equal(validateProject(j).ok, false)
  const w = good()
  w['mystery'] = 1
  const r = validateProject(w)
  assert.ok(r.ok)
  assert.equal(r.warnings[0].path, 'mystery')
})

test('валидатор: понятные ошибки с путём к полю', () => {
  const j = good() as { target: { core: string; memory: { flash: { origin: string; size: number } } }; sources: string[]; configurations: Record<string, unknown>; programmer: { kind: string } }
  j.target.core = 'cortex-z9'
  j.target.memory.flash.origin = '08000000'
  j.target.memory.flash.size = -1
  j.sources = ['../outside', 'C:/x.c']
  delete j.configurations['Release']
  j.programmer.kind = 'usbasp'
  const r = validateProject(j)
  assert.equal(r.ok, false)
  if (!r.ok) {
    const paths = r.errors.map((e) => e.path)
    for (const p of ['target.core', 'target.memory.flash.origin', 'target.memory.flash.size', 'sources[0]', 'sources[1]', 'configurations.Release', 'programmer.kind']) assert.ok(paths.includes(p), 'нет ошибки для ' + p + ': ' + paths.join(','))
    assert.match(formatIssues(r.errors, 2), /и ещё/)
  }
})

test('валидатор: пустой список исходников, область за пределами памяти, дополнительные области', () => {
  const j = good() as { sources: string[]; target: { memory: { ram: { origin: string; size: number }; extra?: unknown[] } } }
  j.sources = []
  assert.equal(validateProject(j).ok, false)
  const k = good() as { target: { memory: { ram: { origin: string; size: number }; extra?: unknown[] } } }
  k.target.memory.ram = { origin: '0xFFFFFF00', size: 4096 }
  assert.equal(validateProject(k).ok, false)
  const m = good() as { target: { memory: { extra?: unknown[] } } }
  m.target.memory.extra = [{ name: 'CCM', origin: '0x10000000', size: 65536 }]
  const r = validateProject(m)
  assert.ok(r.ok)
  m.target.memory.extra = [{ origin: '0x10000000', size: 65536 }]
  assert.equal(validateProject(m).ok, false)
})

test('isProjectPath', () => {
  for (const p of ['src', 'src/main.c', 'a/b/c.h']) assert.ok(isProjectPath(p), p)
  for (const p of ['', '/abs', 'C:/x', 'a\\b', '../x', 'a/../b', 'a//b', './a']) assert.ok(!isProjectPath(p), p)
})

test('сериализация: стабильный порядок полей и круговой обход', () => {
  const p = defaultProject('Blink', blue)
  const text = serializeProject(p)
  assert.ok(text.endsWith('}\n'))
  assert.ok(text.indexOf('"schemaVersion"') < text.indexOf('"name"'))
  assert.ok(text.indexOf('"name"') < text.indexOf('"target"'))
  assert.ok(text.indexOf('"Debug"') < text.indexOf('"Release"'))
  const back = parseProjectText(text)
  assert.ok(back.ok)
  if (back.ok) {
    assert.deepEqual(back.project, p)
    assert.equal(back.migratedFrom, null)
    assert.equal(serializeProject(back.project), text)
  }
})

test('разбор текста: BOM, битый JSON, будущая версия', () => {
  const text = serializeProject(defaultProject('Blink', blue))
  assert.ok(parseProjectText('\uFEFF' + text).ok)
  const bad = parseProjectText('{ не json')
  assert.equal(bad.ok, false)
  const future = JSON.parse(text) as Record<string, unknown>
  future['schemaVersion'] = SCHEMA_VERSION + 1
  const r = parseProjectText(JSON.stringify(future))
  assert.equal(r.ok, false)
  if (!r.ok) assert.match(r.errors[0].message, /новой версией/)
})

test('миграции: цепочка 1 → 2 → 3 по таблице, версия поднимается', () => {
  const table = {
    1: (r: Record<string, unknown>) => ({ ...r, step1: true }),
    2: (r: Record<string, unknown>) => ({ ...r, step2: true })
  }
  const m = migrateProject({ schemaVersion: 1, name: 'x' }, table, 3)
  assert.ok(m.ok)
  if (m.ok) {
    assert.equal(m.from, 1)
    assert.equal(m.to, 3)
    assert.deepEqual(m.raw, { schemaVersion: 3, name: 'x', step1: true, step2: true })
  }
  const miss = migrateProject({ schemaVersion: 1 }, { 1: (r) => r }, 3)
  assert.equal(miss.ok, false)
  assert.equal(migrateProject({ name: 'x' }).ok, false)
  assert.equal(migrateProject({ schemaVersion: 0 }).ok, false)
  assert.equal(migrateProject('x').ok, false)
  const same = migrateProject({ schemaVersion: 1 })
  assert.ok(same.ok && same.from === same.to)
})

test('шаблоны: файлы структуры и содержимое для Blue Pill', () => {
  const f = scaffoldFiles('Blink', blue, 'blink')
  for (const path of ['avride.project.json', 'src/main.c', 'include/README.txt', 'startup/startup_stm32f103xb.s', 'linker/STM32F103C8T6_FLASH.ld', '.gitignore', 'README.md']) assert.ok(path in f, path)
  assert.ok(parseProjectText(f['avride.project.json']).ok)
  assert.match(f['src/main.c'], /#include "stm32f1xx.h"/)
  assert.match(f['src/main.c'], /GPIOC->CRH/)
  assert.match(f['src/main.c'], /RCC_APB2ENR_IOPCEN/)
  assert.match(f['startup/startup_stm32f103xb.s'], /заготовка/)
})

test('шаблоны: пустой main и все пресеты × оба шаблона', () => {
  assert.doesNotMatch(scaffoldFiles('E', blue, 'empty')['src/main.c'], /GPIOC/)
  for (const p of PRO_PRESETS) for (const t of PRO_TEMPLATES) {
    if (!templateSupported(t.id, p)) { assert.throws(() => scaffoldFiles('Proj', p, t.id), /ITM/); continue }
    const f = scaffoldFiles('Proj', p, t.id)
    if (t.id === 'swo') assert.match(f['src/main.c'], /ITM_SendChar[\s\S]*_write|_write[\s\S]*ITM_SendChar/)
    assert.match(f['src/main.c'], new RegExp(`#include "${p.header}"`))
    if (t.id === 'blink') assert.match(f['src/main.c'], new RegExp(`GPIO${p.led.port}->`))
    assert.ok(parseProjectText(f['avride.project.json']).ok, p.chip)
    const paths = JSON.parse(f['avride.project.json']) as { startupFile: string; linkerScript: string }
    assert.ok(paths.startupFile in f && paths.linkerScript in f, 'файлы startup и linker созданы: ' + p.chip)
  }
})

test('программатор: kind jlink и cmsis-dap допустимы; старый файл без kind и interface читается как ST-Link/SWD', () => {
  for (const kind of ['stlink', 'jlink', 'cmsis-dap']) {
    const j = good(); j['programmer'] = { kind, interface: 'swd', openocdTarget: 'target/stm32f1x.cfg' }
    const r = validateProject(j)
    assert.ok(r.ok, kind)
    if (r.ok) assert.equal(r.project.programmer.kind, kind)
  }
  const old = good(); old['programmer'] = { openocdTarget: 'target/stm32f1x.cfg' }
  const r = validateProject(old)
  assert.ok(r.ok)
  if (r.ok) { assert.deepEqual([r.project.programmer.kind, r.project.programmer.interface], ['stlink', 'swd']); assert.equal(r.warnings.length, 2) }
  const bad = good(); bad['programmer'] = { kind: 'usbasp', interface: 'swd' }
  const rb = validateProject(bad)
  assert.equal(rb.ok, false)
  if (!rb.ok) assert.match(formatIssues(rb.errors), /programmer\.kind/)
})

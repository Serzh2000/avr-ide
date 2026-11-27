import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as wd from '../core/index'

const PLATFORMS: wd.Platform[] = ['esp32', 'esp8266', 'pico-w']

function starter(platform: wd.Platform, id: string): wd.WizardSpec {
  const spec = wd.defaultWizardSpec(platform)
  const st = wd.WIZ_STARTERS.find((s) => s.id === id)!
  spec.title = st.title2
  st.kinds.forEach((k, i) => spec.items.push(wd.newWizItem(platform, k, spec.items, st.labels?.[i])))
  return spec
}

test('мастер: каждый готовый набор даёт проект без ошибок на всех платах', () => {
  for (const platform of PLATFORMS) {
    for (const st of wd.WIZ_STARTERS.filter((s) => s.kinds.length)) {
      const spec = starter(platform, st.id)
      assert.deepEqual(wd.wizardProblems(spec), [], `${platform}/${st.id}`)
      const p = wd.buildFromWizard(spec, platform)
      const errs = wd.validate(p).filter((i) => i.severity === 'error')
      assert.deepEqual(errs.map((e) => e.message), [], `${platform}/${st.id}`)
      assert.equal(wd.allBlocks(p).filter((b) => b.binding.kind !== 'none').length, st.kinds.length)
    }
  }
})

test('мастер: пины по умолчанию разные, переменные — новые и из скетча', () => {
  const spec = starter('esp32', 'light')
  const pins = spec.items.map((i) => (i.link.kind === 'pin' ? i.link.pin : -1))
  assert.equal(new Set(pins).size, pins.length)
  spec.items[0].link = { kind: 'var', name: wd.suggestVarName('Свет на кухне', new Set()), existing: false }
  assert.equal(spec.items[0].link.name, 'svetNaKuhne')
  spec.items[1].link = { kind: 'var', name: 'relayOn', existing: true }
  const p = wd.buildFromWizard(spec, 'esp32')
  assert.deepEqual(p.variables, [
    { name: 'svetNaKuhne', type: 'bool', init: 'false' },
    { name: 'relayOn', type: 'bool', init: '', external: true }
  ])
})

test('мастер: ответы сохраняются в web_design.json и читаются обратно', () => {
  const spec = starter('esp8266', 'meteo')
  spec.accent = 'green'
  spec.theme = 'dark'
  const p = wd.buildFromWizard(spec, 'esp8266')
  const back = wd.parseProject(wd.serializeProject(p))
  assert.ok(back.ok)
  assert.deepEqual(back.ok && back.project.wizard, spec)
  assert.equal(back.ok && back.project.page.theme.light.primary, wd.WIZ_ACCENTS.green.light)
})

test('мастер: понятные проблемы — один пин дважды, пустая сеть, короткий пароль', () => {
  const spec = starter('esp32', 'light')
  spec.items[1].link = { ...spec.items[0].link }
  spec.wifi.apPassword = '123'
  const pr = wd.wizardProblems(spec)
  assert.ok(pr.some((p) => p.step === 'links' && /одному пину/.test(p.text)))
  assert.ok(pr.some((p) => p.step === 'wifi' && /8 символов/.test(p.text)))
  assert.deepEqual(wd.parseWizardSpec({ items: [{ kind: 'nope' }], accent: 'x' }, 'esp32')?.items, [])
})

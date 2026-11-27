// Справочник «Библиотеки проекта»: пример библиотеки открывается в предпросмотре. node scripts/e2e/check-lib-examples.mjs <папка>
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ensureBuilt, launch } from './lib/app.mjs'
import { openRecent } from './lib/kit.mjs'
import { sleep } from './lib/cdp.mjs'

const out = resolve(process.argv[2] ?? 'shots-libex')
ensureBuilt()
mkdirSync(out, { recursive: true })
const app = await launch({
  arduino: 'ard2',
  files: { 'LibEx/LibEx.ino': '#include <ESPUI.h>\nvoid setup() {}\nvoid loop() {}\n', 'LibEx/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['LibEx']
})
const { page } = app
try {
  await openRecent({ page }, 'LibEx')
  await page.click('[data-testid=act-ref]')
  await page.waitExists('.ref-search')
  await page.click({ sel: '.ref-tabs button', text: 'Библиотеки' })
  await page.waitExists('[data-testid=lib-example-open]', { timeout: 60000 })
  const n = await page.eval('document.querySelectorAll("[data-testid=lib-example]").length')
  console.log('примеров в списке:', n)
  await page.shot(join(out, 'libs.png'))
  await page.click('[data-testid=lib-example-open]')
  await page.waitFor('!!document.querySelector("[data-testid=ex-preview] .ex-pre-title") && !document.querySelector(".ex-pre-wait")', { timeout: 15000, what: 'предпросмотр примера' })
  const title = await page.eval('document.querySelector("[data-testid=ex-preview] .ex-pre-title").textContent')
  const err = await page.eval('document.querySelector("[data-testid=ex-preview] .ex-pre-err, [data-testid=ex-preview] .err")?.textContent ?? ""')
  const files = await page.eval('document.querySelectorAll("[data-testid=ex-preview] pre, [data-testid=ex-preview] .monaco-editor").length')
  console.log('открыт пример:', title, '| файлов в предпросмотре:', files, err ? '| ошибка: ' + err : '')
  await sleep(500)
  await page.shot(join(out, 'example.png'))
  if (!files) throw new Error('предпросмотр пустой')
  // «Все установленные»: библиотека, которой нет в скетче
  await page.click('[data-testid=act-ref]')
  await page.click('[data-testid=lib-mode-all]')
  await page.waitExists('[data-testid=lib-installed]', { timeout: 30000 })
  const names = await page.eval('[...document.querySelectorAll("[data-testid=lib-installed] .ref-card-name")].map((e) => e.textContent)')
  console.log('установлено библиотек:', names.length, '|', names.slice(0, 8).join(', '))
  const other = await page.eval('[...document.querySelectorAll("[data-testid=lib-installed]")].findIndex((e) => !/ESPUI/.test(e.textContent))')
  await page.clickExpr(`document.querySelectorAll("[data-testid=lib-installed]")[${other}]`)
  await page.waitFor('!!document.querySelector(".ref-detail .ref-title")', { timeout: 20000, what: 'описание библиотеки' })
  const info = await page.eval('({ t: document.querySelector(".ref-detail .ref-title").textContent, h: [...document.querySelectorAll(".ref-detail .lib-h")].map((e) => e.textContent) })')
  console.log('открыта:', info.t, '|', info.h.join(' · '))
  await sleep(400)
  await page.shot(join(out, 'all.png'))
  if (!info.h.length) throw new Error('у библиотеки пустое описание')
  console.log('OK')
} finally { await app.close?.() }

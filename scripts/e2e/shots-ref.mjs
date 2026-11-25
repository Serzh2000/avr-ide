// Снимки панели «Платы» и «Справочник» (вкладки Функции, Платы, Библиотеки): node scripts/e2e/shots-ref.mjs <папка>
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ensureBuilt, launch } from './lib/app.mjs'
import { openRecent } from './lib/kit.mjs'
import { sleep } from './lib/cdp.mjs'

const out = resolve(process.argv[2] ?? 'shots-ref')
ensureBuilt()
mkdirSync(out, { recursive: true })
const app = await launch({
  arduino: 'ard2',
  files: { 'Shot1/Shot1.ino': 'void setup() {}\nvoid loop() {}\n', 'Shot1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Shot1']
})
const { page } = app
const shot = async (name) => { await sleep(500); await page.shot(join(out, name + '.png')).catch((e) => console.log('! ' + name + ': ' + e.message)) }
try {
  await openRecent({ page }, 'Shot1')
  await page.click('[data-testid=act-boards]')
  await shot('boards-panel')
  await page.click('[data-testid=act-ref]')
  await page.waitExists('.ref-search')
  await shot('ref-functions')
  for (const [text, name] of [['Платы', 'ref-boards'], ['Библиотеки', 'ref-libs']]) {
    await page.click({ sel: '.ref-tabs button', text })
    await shot(name)
  }
} finally { await app.close?.() }

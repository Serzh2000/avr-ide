// Снимки стартового экрана и мастера «Создать проект»: node scripts/e2e/shots-start.mjs <папка>
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ensureBuilt, launch } from './lib/app.mjs'
import { sleep } from './lib/cdp.mjs'

const out = resolve(process.argv[2] ?? 'shots-start')
ensureBuilt()
mkdirSync(out, { recursive: true })
const app = await launch({
  arduino: 'ard2',
  files: { 'Blink/Blink.ino': 'void setup() {}\nvoid loop() {}\n', 'Blink/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n', 'Pico/Pico.ino': 'void setup() {}\nvoid loop() {}\n' },
  projects: ['Blink', 'Pico']
})
const { page } = app
const shot = async (name) => { await sleep(600); await page.shot(join(out, name + '.png')).catch((e) => console.log('! ' + name + ': ' + e.message)) }
try {
  await page.waitExists('[data-testid=start-screen]')
  await shot('start')
  await page.click('[data-testid=start-create]')
  await shot('kind')
  await page.click('[data-testid=project-kind-arduino]')
  await page.waitExists('[data-testid=wizard]')
  await shot('wizard-1')
} finally { await app.close?.() }

// Снимки встроенных шаблонов веб-дизайнера в светлой и тёмной теме: node scripts/e2e/shots-templates.mjs <папка> [id,id,…]
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ensureBuilt, launch } from './lib/app.mjs'
import { openRecent } from './lib/kit.mjs'
import { sleep } from './lib/cdp.mjs'

const out = resolve(process.argv[2] ?? 'shots-templates')
const only = (process.argv[3] ?? '').split(',').filter(Boolean)
ensureBuilt()
mkdirSync(out, { recursive: true })
const app = await launch({
  arduino: 'ard2',
  files: { 'T1/T1.ino': 'void setup() {}\nvoid loop() {}\n', 'T1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['T1']
})
const { page, cdp } = app
try {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false })
  await openRecent({ page }, 'T1')
  await page.click('[data-testid=act-web]')
  await page.waitExists('.wd-frame')
  const list = only.length ? only : ['relays', 'weather', 'smarthome', 'rgb', 'greenhouse', 'thermostat', 'security', 'debug', 'sensor_node']
  for (const id of list) {
    await page.eval(`window.__avrStores.useWebDesigner.getState().loadTemplate(${JSON.stringify(id)})`)
    for (const theme of ['light', 'dark']) {
      await page.eval(`window.__avrStores.useWebDesigner.getState().setThemeView?.(${JSON.stringify(theme)})`)
      await sleep(900)
      await page.shot(join(out, `${id}-${theme}.png`)).catch((e) => console.log('! ' + id + ': ' + e.message))
    }
  }
} finally { await app.close?.() }

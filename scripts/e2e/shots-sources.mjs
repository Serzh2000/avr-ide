// Снимки шапки и раздела «Платы → Источники»: node scripts/e2e/shots-sources.mjs <папка>
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ensureBuilt, launch } from './lib/app.mjs'
import { openRecent } from './lib/kit.mjs'
import { sleep } from './lib/cdp.mjs'

const out = resolve(process.argv[2] ?? 'shots-sources')
ensureBuilt()
mkdirSync(out, { recursive: true })
const app = await launch({
  arduino: 'ard2',
  files: { 'S1/S1.ino': 'void setup() {}\nvoid loop() {}\n', 'S1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32s3\n' },
  projects: ['S1']
})
const { page, cdp } = app
try {
  for (const theme of ['dark', 'light']) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    await openRecent({ page }, 'S1').catch(() => {})
    await page.eval(`window.__avrStores.useUi.getState().setSettings({ theme: '${theme}' })`)
    await page.click('[data-testid=act-boards]')
    await sleep(500)
    await page.click({ sel: '.seg-sub button', text: 'Источники' })
    await sleep(1500)
    await page.shot(join(out, `sources-${theme}.png`))
  }
} finally { await app.close?.() }

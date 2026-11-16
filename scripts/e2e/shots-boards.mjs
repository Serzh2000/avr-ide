// Снимки схем плат справочника в обеих темах: node scripts/e2e/shots-boards.mjs <папка> [--width 1280] [--only uno,nano]
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ensureBuilt, launch } from './lib/app.mjs'
import { openRecent } from './lib/kit.mjs'
import { sleep } from './lib/cdp.mjs'

const args = process.argv.slice(2)
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const out = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'shots-boards')
const width = Number(flag('--width', '1280'))
const only = flag('--only', '').split(',').filter(Boolean)
ensureBuilt()
mkdirSync(out, { recursive: true })
const app = await launch({
  arduino: 'ard2',
  files: { 'Shot1/Shot1.ino': 'void setup() {}\nvoid loop() {}\n', 'Shot1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Shot1']
})
const { page, cdp } = app
try {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: Number(flag('--height', '1500')), deviceScaleFactor: 1, mobile: false })
  await openRecent({ page }, 'Shot1')
  await page.click('[data-testid=act-ref]')
  await page.waitExists('.ref-search')
  await page.click({ sel: '.ref-tabs button', text: 'Платы' })
  await page.waitExists('.ref-boards')
  const setAll = `(() => { const s = document.querySelector('.ref-select[aria-label=\\"Платформа\\"]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 'all'); s.dispatchEvent(new Event('change', { bubbles: true })) })()`
  await page.eval(setAll)
  await sleep(300)
  const ids = await page.eval(`(() => { const sel = document.querySelector('.ref-board-list select'); return sel ? [...sel.options].map(o => o.textContent) : [...document.querySelectorAll('.ref-board-item')].map(b => b.textContent) })()`)
  console.log('платы:', ids.length)
  for (const theme of ['dark', 'light']) {
    if ((await page.eval('document.documentElement.dataset.theme')) !== theme) {
      await page.click('[data-testid=act-settings]')
      await page.click({ sel: '.view button', text: theme === 'light' ? 'Светлая' : 'Тёмная' })
      await page.waitFor(`document.documentElement.dataset.theme === '${theme}'`)
      await page.click('[data-testid=act-ref]')
      await page.click({ sel: '.ref-tabs button', text: 'Платы' })
      await page.waitExists('.ref-boards')
      await page.eval(setAll)
      await sleep(300)
    }
    for (let i = 0; i < ids.length; i++) {
      await page.eval(`(() => { const sel = document.querySelector('.ref-board-list select'); if (sel) { const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(sel, sel.options[${i}].value); sel.dispatchEvent(new Event('change', { bubbles: true })) } else document.querySelectorAll('.ref-board-item')[${i}].click() })()`)
      await sleep(900)
      const key = String(i + 1).padStart(2, '0')
      if (only.length && !only.includes(key)) continue
      await page.shot(join(out, `${theme}-${key}.png`))
    }
  }
} finally {
  await app.close()
}
console.log('Готово:', out)

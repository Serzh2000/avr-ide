// Зонд схем плат: на каждой ширине и плате — горизонтальная прокрутка и эффективный размер шрифта подписей.
//   node scripts/e2e/probe-boards.mjs [ширины через запятую]
import { ensureBuilt, launch } from './lib/app.mjs'
import { openRecent } from './lib/kit.mjs'
import { sleep } from './lib/cdp.mjs'
const widths = (process.argv[2] ?? '560,760,1280,1920').split(',').map(Number)
ensureBuilt()
const app = await launch({ arduino: 'ard2', files: { 'Shot1/Shot1.ino': 'void setup() {}\nvoid loop() {}\n', 'Shot1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' }, projects: ['Shot1'] })
const { page, cdp } = app
const setAll = `(() => { const s = document.querySelector('.ref-select[aria-label="Платформа"]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 'all'); s.dispatchEvent(new Event('change', { bubbles: true })) })()`
let bad = 0
try {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: widths[0], height: 1200, deviceScaleFactor: 1, mobile: false })
  await openRecent({ page }, 'Shot1')
  await page.click('[data-testid=act-ref]')
  await page.click({ sel: '.ref-tabs button', text: 'Платы' })
  await page.waitExists('.ref-boards')
  await page.eval(setAll)
  await sleep(300)
  const n = await page.eval(`(document.querySelector('.ref-board-list select')?.options.length) || document.querySelectorAll('.ref-board-item').length`)
  for (const w of widths) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: 1200, deviceScaleFactor: 1, mobile: false })
    await sleep(500)
    for (let i = 0; i < n; i++) {
      await page.eval(`(() => { const sel = document.querySelector('.ref-board-list select'); if (sel) { const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(sel, sel.options[${i}].value); sel.dispatchEvent(new Event('change', { bubbles: true })) } else document.querySelectorAll('.ref-board-item')[${i}].click() })()`)
      await sleep(450)
      const r = await page.eval(`(() => { const svg = document.querySelector('.board-svg'); const t = svg.querySelector('.chip text'); const sc = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width; return { name: document.querySelector('.ref-title').textContent, page: document.documentElement.scrollWidth - innerWidth, wrap: document.querySelector('.ref-pinout-wrap').scrollWidth - document.querySelector('.ref-pinout-wrap').clientWidth, px: +(parseFloat(getComputedStyle(t).fontSize) * sc).toFixed(1), panel: document.querySelector('.ref-pinout-wrap').clientWidth } })()`)
      const flag = r.page > 0 || r.px < 10 ? '  <-- ' : ''
      if (flag) bad++
      console.log(String(w).padStart(5), r.name.padEnd(36), 'панель', String(r.panel).padStart(5), 'шрифт', r.px + 'px', 'скролл страницы', r.page, 'скролл схемы', r.wrap + flag)
    }
  }
} finally { await app.close() }
console.log('замечаний:', bad)

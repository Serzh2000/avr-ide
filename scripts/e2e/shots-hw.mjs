// Снимки панелей «Прошивка» и «Отладка» (на имитаторах из сценария y) в обеих темах и на двух ширинах.
//   node scripts/e2e/shots-hw.mjs <папка-вывода> [--widths 760,1280] [--themes dark,light]
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ensureBuilt, launch } from './lib/app.mjs'
import { sleep } from './lib/cdp.mjs'
import y from './scenarios/y-pro-flash.mjs'

const args = process.argv.slice(2)
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const out = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'shots-hw')
const widths = flag('--widths', '760,1280').split(',').map(Number)
const themes = flag('--themes', 'dark,light').split(',')
ensureBuilt()
mkdirSync(out, { recursive: true })
const MODE = y.env.AVRIDE_FAKE_MODE_FILE

for (const w of widths) for (const theme of themes) {
  const app = await launch({ files: y.files, projects: y.projects, env: y.env })
  const { page, cdp } = app
  const shot = async (name) => { await sleep(400); await page.shot(join(out, `${w}-${theme}-${name}.png`)) }
  const tab = async (t) => { await page.click({ sel: '.dbg-tabs button', text: t }); await sleep(250) }
  try {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: w >= 1200 ? 800 : 760, deviceScaleFactor: 1, mobile: false })
    if (theme === 'light') { await page.click('.start-theme'); await page.waitFor(`document.documentElement.dataset.theme === 'light'`) }
    await page.click({ sel: '[data-testid=start-recent]', text: 'FlashTest' })
    await page.waitExists('[data-testid=header][data-mode=pro]', { timeout: 40000 })
    await page.click('[data-testid=act-project]')
    await page.click('[data-testid=pro-file][data-name="main.c"]')
    await page.waitFor(`!!document.querySelector('.monaco-editor .view-lines')`, { timeout: 20000 })
    writeFileSync(MODE, 'ok')
    await page.click('[data-testid=btab-hw]')
    await page.waitExists('[data-testid=hw-ready]')
    await shot('hw-ready')
    await page.click('[data-testid=pro-flash]')
    await page.waitExists('[data-testid=hw-progress]')
    await shot('hw-progress')
    await page.waitExists('[data-testid=hw-done]', { timeout: 15000 })
    await shot('hw-done')
    writeFileSync(MODE, 'nopower')
    await page.click('[data-testid=hw-flash]')
    await page.waitExists('[data-testid=hw-error]', { timeout: 15000 })
    await shot('hw-error-nopower')
    writeFileSync(MODE, 'nodriver')
    await page.click('[data-testid=hw-flash]')
    await page.waitExists('[data-testid=hw-error][data-kind=no-driver]', { timeout: 15000 })
    await shot('hw-error-nodriver')
    writeFileSync(MODE, 'ok')
    // отладка с двумя точками останова
    await page.click('.monaco-editor .view-lines')
    for (const n of [10, 12]) { await page.key('g', { ctrl: true }); await sleep(250); await page.insertText(String(n)); await page.key('Enter'); await sleep(250); await page.key('F9') }
    await page.key('F5')
    await page.waitFor(`document.querySelector('[data-testid=dbg-state]')?.getAttribute('data-state') === 'stopped'`, { timeout: 15000 })
    await shot('debug-vars-editor')
    await page.key('F5')
    await page.waitFor(`/точка останова/.test(document.querySelector('[data-testid=dbg-state]')?.innerText ?? '')`, { timeout: 15000 })
    await page.fill('[data-testid=dbg-watch-input]', 'counter')
    await page.click('[data-testid=dbg-watch-add]')
    await sleep(300)
    await shot('debug-vars')
    for (const [t, n] of [['Регистры', 'regs'], ['Стек', 'stack'], ['Точки останова', 'bps'], ['Дизассемблер', 'dis']]) { await tab(t); await shot('debug-' + n) }
    await tab('Память'); await page.click('[data-testid=dbg-mem-read]'); await shot('debug-mem')
    await tab('Периферия'); await shot('debug-svd-missing')
    await page.key('F5', { shift: true })
    await sleep(500)
    await page.click('[data-testid=btab-debug]')
    await shot('debug-off')
    console.log(`ширина ${w}, тема ${theme}: готово`)
  } finally { await app.close() }
}

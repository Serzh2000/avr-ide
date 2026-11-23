// Снимки панелей «Прошивка» (J-Link, CMSIS-DAP, ошибки драйвера) и «SWO» (на имитаторах из сценария ac) в обеих темах и на двух ширинах.
//   node scripts/e2e/shots-probes.mjs <папка-вывода> [--widths 760,1280] [--themes dark,light]
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ensureBuilt, launch } from './lib/app.mjs'
import { sleep } from './lib/cdp.mjs'
import ac from './scenarios/ac-pro-probes.mjs'
import { advanceFlashWizard, openWorkspaceTool } from './lib/kit.mjs'

const args = process.argv.slice(2)
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const out = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'shots-probes')
const widths = flag('--widths', '760,1280').split(',').map(Number)
const themes = flag('--themes', 'dark,light').split(',')
ensureBuilt()
mkdirSync(out, { recursive: true })
const MODE = ac.env.AVRIDE_FAKE_MODE_FILE

for (const w of widths) for (const theme of themes) {
  const app = await launch({ files: ac.files, projects: ac.projects, env: ac.env })
  const { page, cdp } = app
  const shot = async (name) => { await sleep(500); await page.shot(join(out, `${w}-${theme}-${name}.png`)) }
  const selectKind = async (kind) => {
    await page.eval(`(() => { const s = document.querySelector('[data-testid=hw-kind]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${JSON.stringify(kind)}); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
    await sleep(700)
  }
  try {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: w >= 1200 ? 800 : 760, deviceScaleFactor: 1, mobile: false })
    if (theme === 'light') { await page.click('.start-theme'); await page.waitFor(`document.documentElement.dataset.theme === 'light'`) }
    await page.click({ sel: '[data-testid=start-recent]', text: 'ProbeTest' })
    await page.waitExists('[data-testid=header][data-mode=pro]', { timeout: 40000 })
    writeFileSync(MODE, 'ok')
    await openWorkspaceTool(page, 'hw')
    await advanceFlashWizard(page)
    await page.waitExists('[data-testid=hw-others]')
    await shot('hw-no-stlink-others')
    await page.click('[data-testid=hw-use-other]')
    await advanceFlashWizard(page)
    await page.waitExists('[data-testid=hw-ready]')
    await shot('hw-jlink-ready')
    writeFileSync(MODE, 'nodriver')
    await page.click('[data-testid=hw-flash]')
    await page.waitExists('[data-testid=hw-error][data-kind=no-driver]', { timeout: 15000 })
    await shot('hw-jlink-nodriver')
    writeFileSync(MODE, 'ok')
    await page.click('[data-testid=hw-back]')
    await selectKind('cmsis-dap')
    await advanceFlashWizard(page)
    await page.click('[data-testid=hw-flash]')
    await page.waitExists('[data-testid=hw-done]', { timeout: 15000 })
    await shot('hw-cmsis-done')
    await page.key('Escape')
    await page.waitGone('[data-testid=hw-panel]')
    await openWorkspaceTool(page, 'swo')
    await page.waitExists('[data-testid=swo-panel]')
    await shot('swo-empty')
    await page.click('[data-testid=swo-start]')
    await page.waitFor(`/Привет из SWO/.test(document.querySelector('[data-testid=swo-console]')?.innerText ?? '')`, { timeout: 10000 })
    writeFileSync(MODE + '.swo', Array.from({ length: 12 }, (_, i) => `SWO работает: счётчик = ${i}\r\n`).join(''))
    await sleep(700)
    await shot('swo-running')
    await page.click('[data-testid=swo-stop]')
    writeFileSync(MODE, 'notpiu')
    await page.click('[data-testid=swo-start]')
    await page.waitExists('[data-testid=swo-panel] [data-testid=hw-error]', { timeout: 15000 })
    await shot('swo-error')
  } catch (e) {
    console.error(`${w}-${theme}:`, e.message)
    try { await page.shot(join(out, `${w}-${theme}-FAIL.png`)) } catch { /* окно недоступно */ }
  } finally { await app.close() }
}
console.log('Снимки:', out)

// Снимки Профессионального режима в обеих темах и на двух ширинах.
//   node scripts/e2e/shots-pro.mjs <папка-вывода> [--widths 760,1280] [--themes dark,light]
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ensureBuilt, launch } from './lib/app.mjs'
import { sleep } from './lib/cdp.mjs'

const args = process.argv.slice(2)
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const out = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'shots-pro')
const widths = flag('--widths', '760,1280').split(',').map(Number)
const themes = flag('--themes', 'dark,light').split(',')

ensureBuilt()
mkdirSync(out, { recursive: true })
const app = await launch({})
const { page, cdp } = app
const shot = async (w, theme, name) => { await sleep(350); await page.shot(join(out, `${w}-${theme}-${name}.png`)) }
const setTheme = async (t) => {
  if ((await page.eval('document.documentElement.dataset.theme')) === t) return
  if (await page.exists('[data-testid=start-screen]')) await page.click('.start-theme')
  else { await page.click('[data-testid=act-settings]'); await page.click({ sel: '.view button', text: t === 'light' ? 'Светлая' : 'Тёмная' }) }
  await page.waitFor(`document.documentElement.dataset.theme === '${t}'`)
}
try {
  await page.waitExists('[data-testid=start-screen]')
  await page.click('[data-testid=mode-pro]')
  let created = false
  for (const w of widths) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: w >= 1200 ? 800 : 760, deviceScaleFactor: 1, mobile: false })
    for (const theme of themes) {
      console.log(`ширина ${w}, тема ${theme}`)
      await setTheme(theme)
      if (!created) {
        await shot(w, theme, 'start')
        await page.click('[data-testid=start-create]')
        await page.waitExists('[data-testid=pro-wizard]')
        await page.waitFor(`document.querySelector('[data-testid=wz-name]').value.length > 0`)
        await shot(w, theme, 'wizard')
        await page.fill('[data-testid=wz-name]', 'BluePillBlink')
        await page.waitFor(`!document.querySelector('[data-testid=wz-create]').disabled`)
        await page.click('[data-testid=wz-create]')
        await page.waitExists('[data-testid=header][data-mode=pro]', { timeout: 15000 })
        await page.waitFor(`!!document.querySelector('.monaco-editor .view-lines')`, { timeout: 20000 })
        created = true
      }
      await page.click('[data-testid=act-files]')
      await shot(w, theme, 'editor-files')
      await page.click('[data-testid=act-project]')
      await shot(w, theme, 'project')
      await page.click('[data-testid=act-chips]')
      await shot(w, theme, 'chips')
      await page.click('[data-testid=act-settings]')
      await shot(w, theme, 'settings')
      await page.click('[data-testid=pro-build]')
      await shot(w, theme, 'build-toast')
    }
  }
  // Пустое состояние: папка без проекта в Pro-режиме
  await page.click('[data-testid=hdr-close-project]')
} finally {
  await app.close()
}
console.log('снимки:', out)

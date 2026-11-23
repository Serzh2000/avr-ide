// Снимки состояний «страница ↔ скетч» (плашка, окно вставки, конфликт, переменные из скетча, «Дальше», настройка).
//   node scripts/e2e/shots-link.mjs <папка-вывода> [--widths 760,1280] [--themes dark,light]
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ensureBuilt, launch } from './lib/app.mjs'
import { openRecent, selectOption } from './lib/kit.mjs'
import { sleep } from './lib/cdp.mjs'

const args = process.argv.slice(2)
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const out = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'shots-link')
const widths = flag('--widths', '1280,760').split(',').map(Number)
const themes = flag('--themes', 'dark,light').split(',')
const INO = 'float temperature = 21.5;\nbool relay = false;\n\nvoid setup() {\n}\n\nvoid loop() {\n}\n'
const setSizeOf = (w) => ({ width: w, height: w >= 1200 ? 800 : 760 })

ensureBuilt()
mkdirSync(out, { recursive: true })
const app = await launch({
  arduino: 'ard2',
  files: { 'Link1/Link1.ino': INO, 'Link1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Link1']
})
const { page, cdp } = app
const tryDo = (p) => Promise.race([Promise.resolve(p), new Promise((_, rej) => setTimeout(() => rej(new Error('таймаут шага')), 12000))]).catch((e) => console.log('  ! ' + String(e.message).slice(0, 140)))
const shot = async (w, theme, name) => {
  await sleep(450)
  await page.shot(join(out, `${w}-${theme}-${name}.png`)).catch((e) => console.log('  ! снимок ' + name + ': ' + e.message))
}
const setSize = async (w) => {
  const s = setSizeOf(w)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: s.width, height: s.height, deviceScaleFactor: 1, mobile: false })
  await sleep(300)
}
const setTheme = async (t) => {
  if ((await page.eval('document.documentElement.dataset.theme')) === t) return
  await page.click('[data-testid=act-settings]')
  await page.click({ sel: '.view button', text: t === 'light' ? 'Светлая' : 'Тёмная' })
  await page.waitFor(`document.documentElement.dataset.theme === '${t}'`)
}

try {
  await openRecent({ page }, 'Link1')
  // Подготовка: страница с датчиком, связанным с temperature
  await page.click('[data-testid=act-web]')
  await page.waitExists('.wd-pal-item')
  await page.click({ sel: '.wd-pal-item', text: 'Датчик' })
  await page.click({ sel: '.wd-ins-tabs [role=tab]', text: 'Связь' })
  await page.click({ sel: '.wd-segs button', text: 'Переменная' })
  await page.eval(`(() => { const s = document.querySelector('[data-testid=wd-bind-var]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 's:temperature'); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await sleep(300)
  let first = true
  for (const w of widths) {
    await setSize(w)
    for (const theme of themes) {
      console.log(`ширина ${w}, тема ${theme}`)
      await setTheme(theme)
      await page.click('[data-testid=act-web]')
      await page.waitExists('.wd')
      if (first) {
        await shot(w, theme, 'web-off')
        // «Дальше» предлагает подключить страницу
        await shot(w, theme, 'web-off-next')
      } else await shot(w, theme, 'web-off')
      await page.click('[data-testid=wd-insert]')
      await page.waitExists('[data-testid=wd-insert-confirm]')
      await shot(w, theme, 'web-insert-dialog')
      if (first) {
        await page.click('[data-testid=wd-insert-confirm]')
        await page.waitExists('[data-testid=wd-insert-result].ok')
        await shot(w, theme, 'web-insert-done')
        await page.click({ sel: '.uib-modal button', text: 'Закрыть' })
        first = false
      } else await page.key('Escape')
      await tryDo(page.waitFor(`document.querySelector('[data-testid=wd-link]')?.getAttribute('data-state') !== 'off'`))
      await shot(w, theme, 'web-ok')
      // переменные
      await selectOption(page, '[data-testid=wd-view]', 'vars')
      await shot(w, theme, 'web-vars')
      await tryDo(page.click('[data-testid=wd-declare-var]'))
      await shot(w, theme, 'web-declare-var')
      await page.key('Escape')
      await page.click('[data-testid=wd-return]')
      // устарел
      await tryDo(page.click({ sel: '.wd-pal-item', text: 'Заголовок' }))
      await shot(w, theme, 'web-stale')
      await tryDo(page.click('[data-testid=wd-link-update]'))
      // ESPUI: плашка и конфликт
      await page.click('[data-testid=act-ui]')
      await page.waitExists('[data-testid=uib]')
      await tryDo(page.click('[data-testid=uib-pal][data-type=label]'))
      await shot(w, theme, 'espui-link')
      await tryDo(page.click('[data-testid=uib-insert]'))
      await tryDo(page.waitExists('[data-testid=pl-conflict]'))
      await shot(w, theme, 'espui-conflict')
      await page.key('Escape')
    }
  }
  // Настройка
  await page.click('[data-testid=act-settings]')
  await sleep(300)
  await shot(widths[0], themes[0], 'settings')
} finally {
  await app.close()
}

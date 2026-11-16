// Снимки всех экранов приложения в обеих темах и на разных ширинах — для визуального аудита дизайна.
//   node scripts/e2e/shots.mjs <папка-вывода> [--widths 760,1280,1920] [--themes dark,light] [--only start,web]
// Запускает собранное приложение (как сценарии e2e), размер задаётся эмуляцией области просмотра.
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ensureBuilt, launch } from './lib/app.mjs'
import { assert, openRecent } from './lib/kit.mjs'
import { sleep } from './lib/cdp.mjs'

const args = process.argv.slice(2)
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const out = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'shots')
const widths = flag('--widths', '760,1280,1920').split(',').map(Number)
const themes = flag('--themes', 'dark,light').split(',')
const only = flag('--only', '').split(',').filter(Boolean)
const heightFor = (w) => (w >= 1900 ? 1080 : w >= 1200 ? 800 : 760)

ensureBuilt()
mkdirSync(out, { recursive: true })
const app = await launch({
  arduino: 'ard2',
  files: { 'Shot1/Shot1.ino': '// Мигание\nfloat temperature;\nvoid setup() {\n  pinMode(2, OUTPUT);\n  Serial.begin(115200);\n}\nvoid loop() {\n  digitalWrite(2, HIGH);\n  delay(500);\n  digitalWrite(2, LOW);\n  delay(500);\n}\n', 'Shot1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Shot1']
})
const { page, cdp } = app
// Любой шаг ограничен по времени: зависший клик не должен останавливать весь прогон
const within = (p, ms = 12000) => Promise.race([Promise.resolve(p), new Promise((_, rej) => setTimeout(() => rej(new Error('таймаут шага')), ms))])
const tryDo = (p) => within(p).catch((e) => console.log('  ! ' + String(e.message).slice(0, 120)))
const shot = async (w, theme, name) => {
  if (only.length && !only.some((o) => name.startsWith(o))) return
  await sleep(350)
  await within(page.shot(join(out, `${w}-${theme}-${name}.png`)), 20000).catch((e) => console.log('  ! снимок ' + name + ': ' + e.message))
}
const setSize = async (w) => {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: heightFor(w), deviceScaleFactor: 1, mobile: false })
  await sleep(300)
}
const themeNow = () => page.eval('document.documentElement.dataset.theme')
const setTheme = async (t) => {
  if ((await themeNow()) === t) return
  const onStart = await page.exists('[data-testid=start-screen]')
  if (onStart) await page.click('.start-theme')
  else {
    await page.click('[data-testid=act-settings]')
    await page.click({ sel: '.view button', text: t === 'light' ? 'Светлая' : 'Тёмная' })
  }
  await page.waitFor(`document.documentElement.dataset.theme === '${t}'`)
}

try {
  for (const w of widths) {
    await setSize(w)
    for (const theme of themes) {
      console.log(`ширина ${w}, тема ${theme}`)
      await setTheme(theme)
      await shot(w, theme, 'start')
      await page.click('[data-testid=start-create]')
      await page.waitExists('[data-testid=wz-board]', { timeout: 150000 })
      await shot(w, theme, 'wizard1')
      await page.click('[data-testid=wz-next]')
      await page.waitExists('[data-testid=wz-name]')
      await shot(w, theme, 'wizard2')
      await page.key('Escape')
      await page.waitGone('[data-testid=wizard]')
      await openRecent({ page }, 'Shot1')
      await shot(w, theme, 'editor')
      for (const [id, label] of [['search', 'search'], ['examples', 'examples'], ['boards', 'boards']]) {
        await page.click(`[data-testid=act-${id}]`)
        await sleep(500)
        await shot(w, theme, label)
      }
      // платы: «Источники» и «Комплект»; библиотеки: GitHub
      await tryDo(page.click({ sel: '.seg-sub button', text: 'Источники' }))
      await sleep(700)
      await shot(w, theme, 'boards-sources')
      await tryDo(page.click({ sel: '.seg-sub button', text: 'Ядра' }))
      await tryDo(page.click({ sel: '.seg button', text: 'Библиотеки' }))
      await tryDo(page.click({ sel: '.seg-sub button', text: 'GitHub' }))
      await sleep(700)
      await shot(w, theme, 'libs-github')
      await tryDo(page.click({ sel: '.seg button', text: 'Платы' }))
      await page.click('[data-testid=act-files]')
      for (const t of ['problems', 'monitor', 'plotter', 'output']) {
        await page.click(`[data-testid=btab-${t}]`)
        await shot(w, theme, 'bottom-' + t)
      }
      await page.click('[data-testid=hdr-board]')
      await page.waitExists('.board-pop')
      await shot(w, theme, 'boardpicker')
      await page.key('Escape')
      await page.key('p', { ctrl: true, shift: true })
      await page.waitExists('.palette, [role=dialog]')
      await shot(w, theme, 'cmdpalette')
      await page.key('Escape')
      await page.click('[data-testid=act-ref]')
      await page.waitExists('.ref-search')
      await shot(w, theme, 'reference')
      await page.click('[data-testid=act-ui]')
      await page.waitExists('[data-testid=uib]')
      await sleep(700)
      await shot(w, theme, 'espui')
      await tryDo(page.click('[data-testid=uib-ltab-tree]'))
      await shot(w, theme, 'espui-tree')
      await tryDo(page.click('[data-testid=uib-ltab-items]'))
      await tryDo(page.click('[data-testid=uib-insert]'))
      await sleep(400)
      await shot(w, theme, 'espui-insert')
      await page.key('Escape')
      await page.click('[data-testid=act-web]')
      await tryDo(page.click({ sel: '.wd-ltab', text: 'Блоки' }, { timeout: 2500 }))
      await page.waitExists('.wd')
      await page.eval(`(() => { window.confirm = () => true; const s = [...document.querySelectorAll('.wd select')][1]; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 'smarthome'); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
      await sleep(900)
      await shot(w, theme, 'web-blocks')
      const strip = await page.exists('[data-testid=wd-strip-tree]')
      if (strip) { await tryDo(page.click('[data-testid=wd-strip-blocks]')); await sleep(400); await shot(w, theme, 'web-drawer-blocks'); await tryDo(page.click('[data-testid=wd-left-close]')) ; await sleep(300); await tryDo(page.click('[data-testid=wd-strip-tree]')); await sleep(400) }
      await tryDo(page.click({ sel: '.wd-ltab', text: 'Структура' }, { timeout: 2500 }))
      await shot(w, theme, 'web-tree')
      if (strip) await tryDo(page.click('[data-testid=wd-left-close]'))
      await tryDo(page.click({ sel: '.wd-tree-row', text: 'k_living' }, { timeout: 2500 }))
      await sleep(400)
      await tryDo(page.click({ sel: '.wd-tab', text: 'Вид' }, { timeout: 2500 }))
      await shot(w, theme, 'web-inspector-look')
      for (const t of ['Макет', 'Содержимое']) {
        await tryDo(page.click({ sel: '.wd-tab', text: t }, { timeout: 2500 }))
        await shot(w, theme, 'web-inspector-' + (t === 'Макет' ? 'layout' : 'content'))
      }
      await tryDo(page.click({ sel: '.wd-tab', text: 'HTML' }, { timeout: 2500 }))
      await shot(w, theme, 'web-drawer')
      await tryDo(page.click({ sel: '.wd-drawer .wd-btn', text: 'Свернуть' }, { timeout: 2500 }))
      await page.click('[data-testid=act-settings]')
      await sleep(400)
      await shot(w, theme, 'settings')
      await page.click('[data-testid=hdr-close-project]')
      await page.waitExists('[data-testid=start-screen]')
    }
  }
  assert(true, '')
  console.log('Готово:', out)
} finally {
  await app.close()
}

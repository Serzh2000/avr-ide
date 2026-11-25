import { selectOption } from './lib/kit.mjs'
// Сквозные задачи новичка, часть 2: б (Uno без поддержки плат, комплект без интернета), г (ESPUI), д (веб-дизайнер), е (библиотеки).
//   node scripts/e2e/tasks2.mjs <папка-вывода> [б|г|д|е]
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ensureBuilt, launch } from './lib/app.mjs'
import { sleep } from './lib/cdp.mjs'

const out = resolve(process.argv[2] ?? 'task-shots')
const only = process.argv[3]
ensureBuilt()
mkdirSync(out, { recursive: true })

async function session(opts, fn) {
  const app = await launch(opts)
  const { page } = app
  let clicks = 0
  const realClick = page.click.bind(page)
  page.click = async (...a) => { clicks++; return realClick(...a) }
  const shot = async (n) => { await sleep(450); await page.shot(join(out, n + '.png')) }
  try { await fn({ page, app, shot, clicks: () => clicks, reset: () => { clicks = 0 } }) } finally { await app.close?.() }
}
const say = (s) => console.log(s)

if (!only || only === 'б') {
  say('\n== б: Arduino Uno в ПУСТОЙ среде, сеть перекрыта (только комплект)')
  await session({ arduino: 'empty', env: { ARDUINO_NETWORK_PROXY: 'http://127.0.0.1:1' } }, async ({ page, shot, clicks }) => {
    await page.waitExists('[data-testid=start-screen]')
    await page.click('[data-testid=start-create]')
    await page.click('[data-testid=project-kind-arduino]')
    await page.waitExists('[data-testid=wz-board]', { timeout: 120000 })
    await page.fill('[data-testid=wz-search]', 'arduino uno')
    await page.click('[data-testid=wz-board][data-fqbn="arduino:avr:uno"]')
    await page.waitFor(`document.querySelector('[data-testid=wz-core]')?.dataset.state === 'missing'`, { timeout: 30000 })
    await shot('b1-wizard-uno-missing-core')
    say('   карточка: ' + (await page.text('[data-testid=wz-core]')).replace(/\s+/g, ' ').slice(0, 260))
    await page.click('[data-testid=wz-install-pack]')
    const t0 = Date.now()
    for (;;) {
      const st = await page.eval(`document.querySelector('[data-testid=wz-core]')?.dataset.state`)
      if (st === 'installed') break
      if (st === 'failed' || Date.now() - t0 > 6 * 60 * 1000) throw new Error('установка из комплекта: ' + st)
      await sleep(1000)
    }
    await shot('b2-wizard-uno-installed')
    await page.click('[data-testid=wz-next]')
    await page.waitExists('[data-testid=wz-name]')
    await page.fill('[data-testid=wz-name]', 'UnoBlink')
    await page.waitFor(`!document.querySelector('[data-testid=wz-create]').disabled`)
    await page.click('[data-testid=wz-create]')
    await page.waitFor(`!!document.querySelector('.monaco-editor .view-lines')`, { timeout: 30000 })
    await shot('b3-project-created')
    say('   «Дальше»: ' + (await page.eval(`document.querySelector('[data-testid=next-step]')?.textContent ?? ''`)))
    say(`   кликов: ${clicks()} (создать проект, плата, установить из комплекта, далее, создать); установка заняла ${Math.round((Date.now() - t0) / 1000)} с без интернета`)
  })
}

if (!only || only === 'г') {
  say('\n== г: ESPUI — элементы, связь с переменной, вставка в скетч')
  await session({ arduino: 'ard2', files: { 'Ui1/Ui1.ino': 'float temperature;\nvoid setup() {\n}\nvoid loop() {\n}\n', 'Ui1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' }, projects: ['Ui1'] }, async ({ page, shot, clicks, reset }) => {
    await page.click({ sel: '[data-testid=start-recent]', text: 'Ui1' })
    await page.waitFor(`!!document.querySelector('.monaco-editor .view-lines')`, { timeout: 30000 })
    reset()
    await page.click('[data-testid=act-ui]')
    await page.waitExists('[data-testid=uib]')
    await shot('g1-espui-welcome')
    const pal = (t) => `[data-testid=uib-pal][data-type=${t}]`
    await page.click(pal('label'))
    await page.click(pal('slider'))
    await shot('g2-espui-elements-added')
    await selectOption(page, '[data-testid=uib-view]', 'links')
    await page.click({ sel: '.uib-linktable tbody tr', text: 'Надпись' })
    await shot('g3-espui-binding')
    await page.click({ sel: '[data-testid=uib-intent]', re: 'Показывать значение переменной' })
    await page.click('#uib-var-picker')
    await page.click({ sel: '.uib-popover [role=option]', text: 'temperature' })
    await shot('g4-espui-bound')
    say('   подсказка: ' + (await page.text('[data-testid=uib-next-hint], .ctx-hint')))
    await page.click('[data-testid=uib-insert]')
    await page.waitExists('[data-testid=uib-insert-confirm]')
    await shot('g5-espui-insert-dialog')
    await page.click('[data-testid=uib-insert-confirm]')
    await page.waitExists('[data-testid=uib-insert-result].ok')
    await shot('g6-espui-inserted')
    say(`   кликов: ${clicks()} (ESPUI, 2 элемента, «Связи», строка, назначение, список, переменная, «Вставить», «Подтвердить»)`)
  })
}

if (!only || only === 'д') {
  say('\n== д: веб-дизайнер — блоки, правка, экспорт')
  await session({ arduino: 'ard2', files: { 'Web1/Web1.ino': 'void setup() {\n}\nvoid loop() {\n}\n', 'Web1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' }, projects: ['Web1'] }, async ({ page, shot, clicks, reset }) => {
    await page.click({ sel: '[data-testid=start-recent]', text: 'Web1' })
    await page.waitFor(`!!document.querySelector('.monaco-editor .view-lines')`, { timeout: 30000 })
    reset()
    await page.click('[data-testid=act-web]')
    await page.waitExists('.wd-pal-item')
    await shot('d1-web-start')
    await page.click({ sel: '.wd-pal-item', text: 'Кнопка' })
    await page.click({ sel: '.wd-pal-item', text: 'Ползунок' })
    await shot('d2-web-blocks-added')
    say('   подсказка: ' + (await page.text('[data-testid=wd-next-hint]')))
    await page.click({ sel: '.wd-menu .wd-btn', text: 'Экспорт' })
    await page.waitExists('.wd-menu-list [role=menuitem]')
    await shot('d3-web-export-menu')
    say(`   кликов: ${clicks()} (Веб-сайт, 2 блока, «Экспорт»); пункты экспорта: ` + (await page.text('.wd-menu-list')).replace(/\s+/g, ' ').slice(0, 160))
    await page.key('Escape')
  })
}

if (!only || only === 'е') {
  say('\n== е: библиотеки — реестр Arduino и вкладка GitHub (сеть перекрыта)')
  await session({ arduino: 'ard2', env: { ARDUINO_NETWORK_PROXY: 'http://127.0.0.1:1' }, files: { 'Lib1/Lib1.ino': 'void setup() {\n}\nvoid loop() {\n}\n', 'Lib1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' }, projects: ['Lib1'] }, async ({ page, shot, clicks, reset }) => {
    await page.click({ sel: '[data-testid=start-recent]', text: 'Lib1' })
    await page.waitFor(`!!document.querySelector('.monaco-editor .view-lines')`, { timeout: 30000 })
    reset()
    await page.click('[data-testid=act-libs]')
    await page.waitExists('.side-search input')
    await shot('e1-libs-installed')
    await page.fill('.side-search input', 'DHT')
    await sleep(12000)
    await shot('e2-libs-search-dht')
    say('   поиск «DHT»: ' + (await page.text('.mgr-list')).replace(/\s+/g, ' ').slice(0, 200))
    await page.click({ sel: '.seg-sub button', text: 'GitHub' })
    await shot('e3-github-empty')
    await page.click({ sel: '.btn', text: 'Загрузить каталог' })
    await sleep(6000)
    await shot('e4-github-offline')
    say('   GitHub без сети: ' + (await page.text('.gh')).replace(/\s+/g, ' ').slice(0, 260))
    say(`   кликов: ${clicks()} (Библиотеки, вкладка GitHub, «Загрузить каталог»)`)
  })
}

if (!only || only === 'т') {
  say('\n== т: тур и Справка на 760 px и в светлой теме')
  const INO = 'void setup() {\n}\nvoid loop() {\n}\n'
  await session({ arduino: 'ard2', files: { 'Tour1/Tour1.ino': INO, 'Tour1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' }, projects: ['Tour1'] }, async ({ page, shot }) => {
    await page.click({ sel: '[data-testid=start-recent]', text: 'Tour1' })
    await page.waitFor(`!!document.querySelector('.monaco-editor .view-lines')`, { timeout: 30000 })
    for (const [w, theme] of [[760, 'dark'], [760, 'light'], [1280, 'light']]) {
      await page.eval(`window.__avrStores.useUi.getState().setSettings({ theme: '${theme}' })`)
      await page.setWindowSize(w, w === 760 ? 760 : 800)
      await sleep(500)
      for (let i = 0; i < 5; i++) {
        await page.eval(`window.__avrStores.useUi.getState().setTour(${i})`)
        await shot(`t-${w}-${theme}-step${i + 1}`)
      }
      await page.eval(`window.__avrStores.useUi.getState().setTour(null)`)
      await page.eval(`window.__avrStores.useUi.getState().setHelp(true)`)
      await shot(`t-${w}-${theme}-help`)
      await page.eval(`window.__avrStores.useUi.getState().setHelp(false)`)
    }
  })
}

if (only === 'п') {
  say('\n== п: предпросмотр примера в основной области, 1280 и 760, обе темы')
  const INO = 'void setup() {\n}\nvoid loop() {\n}\n'
  await session({ arduino: 'ard2', files: { 'Ex1/Ex1.ino': INO, 'Ex1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' }, projects: ['Ex1'] }, async ({ page, shot }) => {
    await page.click({ sel: '[data-testid=start-recent]', text: 'Ex1' })
    await page.waitFor(`!!document.querySelector('.monaco-editor .view-lines')`, { timeout: 30000 })
    await page.click('[data-testid=act-examples]')
    await page.waitExists('.examples-panel .ex-lib', { timeout: 30000 })
    await page.fill('.examples-panel input[aria-label="Поиск примеров"]', 'espui')
    await page.waitFor(`document.querySelectorAll('.examples-panel .ex-item').length > 0`)
    await page.click({ sel: '.examples-panel .ex-item', text: 'completeExample' })
    await page.waitExists('.ex-preview .ex-code')
    for (const [w, theme] of [[1280, 'dark'], [1280, 'light'], [760, 'dark'], [760, 'light']]) {
      await page.setWindowSize(w, w === 760 ? 760 : 800)
      await page.eval(`window.__avrStores.useUi.getState().setSettings({ theme: '${theme}' })`)
      await page.waitFor(`document.documentElement.dataset.theme === '${theme}'`)
      await page.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 700, y: 400 })
      await sleep(1200)
      await shot(`p-${w}-${theme}`)
    }
  })
}

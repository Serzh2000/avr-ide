// Снимки сборки Pro-режима: карточки установки, ход сборки, «Размер», конфигурации, настройки. Обе темы, две ширины.
//   node scripts/e2e/shots-pro-build.mjs <папка-вывода> [--gcc <папка bin компилятора>]
// Без --gcc снимаются только состояния без компилятора (карточка установки, пустые состояния).
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ensureBuilt, launch } from './lib/app.mjs'
import { sleep } from './lib/cdp.mjs'
import { openWorkspaceTool } from './lib/kit.mjs'

const args = process.argv.slice(2)
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const out = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'shots-pro-build')
const gcc = flag('--gcc', '')
ensureBuilt()
mkdirSync(out, { recursive: true })

async function session(env, body) {
  const app = await launch({ env })
  try { await body(app) } finally { await app.close() }
}

const create = async (page) => {
  await page.waitExists('[data-testid=start-screen]')
  await page.click('[data-testid=start-create]')
  await page.click('[data-testid=project-kind-stm32]')
  await page.waitExists('[data-testid=pro-wizard]')
  await page.fill('[data-testid=pro-wz-search]', 'G474')
  await page.click('[data-testid=pro-wz-chip][data-chip=STM32G474RET6]')
  await page.fill('[data-testid=wz-name]', 'NucleoG4')
  await page.waitFor(`!document.querySelector('[data-testid=wz-create]').disabled`)
  await page.click('[data-testid=wz-create]')
  await page.waitExists('[data-testid=header][data-mode=pro]', { timeout: 30000 })
  await page.waitExists('[data-testid=pb-support]', { timeout: 20000 })
}

const matrix = []
for (const w of [1280, 760]) for (const theme of ['dark', 'light']) matrix.push({ w, theme })

const apply = async (app, w, theme) => {
  await app.cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: w >= 1200 ? 800 : 760, deviceScaleFactor: 1, mobile: false })
  await app.page.eval(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}`)
  await sleep(300)
}
const shot = async (app, w, theme, name) => { await sleep(350); await app.page.shot(join(out, `${w}-${theme}-${name}.png`)) }

// 1. Без компилятора
await session({ AVRIDE_PRO_GCC: 'none' }, async (app) => {
  const { page } = app
  await create(page)
  for (const { w, theme } of matrix) { await apply(app, w, theme); await shot(app, w, theme, 'support-dialog') }
  await page.click('[data-testid=pb-later]')
  await page.click('[data-testid=pro-build]')
  await page.waitExists('[data-testid=pb-toolchain]')
  for (const { w, theme } of matrix) { await apply(app, w, theme); await shot(app, w, theme, 'toolchain-dialog') }
  await page.click('[data-testid=pb-later]')
  await openWorkspaceTool(page, 'size')
  for (const { w, theme } of matrix) { await apply(app, w, theme); await shot(app, w, theme, 'size-empty') }
  await page.click('[data-testid=act-settings]')
  await page.waitExists('[data-testid=settings-toolchain]')
  for (const { w, theme } of matrix) { await apply(app, w, theme); await shot(app, w, theme, 'settings-no-toolchain') }
})

// 2. С компилятором: настоящая сборка
if (gcc) {
  await session({ AVRIDE_PRO_GCC: gcc }, async (app) => {
    const { page } = app
    await create(page)
    await apply(app, 1280, 'dark')
    await page.click('[data-testid=pb-support-go]')
    await sleep(1500)
    await shot(app, 1280, 'dark', 'building')
    await page.waitFor(`/Собрано · Flash/.test(document.querySelector('[data-testid=statusbar]')?.innerText ?? '')`, { timeout: 120000 })
    // второй раз — на узком окне и в светлой теме: очистка и пересборка с нуля
    await apply(app, 760, 'light')
    await page.eval(`window.api.pro.clean('Debug')`)
    // много исходников, чтобы сборка шла несколько секунд и её можно было снять на ходу
    for (let i = 0; i < 500; i++) writeFileSync(join(app.sketchbook, 'NucleoG4', 'src', `gen${i}.c`), `int gen_fn_${i}(int a) { int s = 0; for (int k = 0; k < a; k++) { s += k * ${i}; } return s; }
int gen_fn2_${i}(int a) { return a ? gen_fn_${i}(a - 1) + 1 : 0; }
`)
    await page.eval(`window.api.project?.tree?.()`)
    await sleep(300)
    await page.click('[data-testid=pro-build]')
    await sleep(1200)
    await shot(app, 760, 'light', 'building')
    await apply(app, 1280, 'dark')
    await shot(app, 1280, 'dark', 'building-2')
    await page.waitFor(`!document.querySelector('[data-testid=pro-build]').hasAttribute('data-busy')`, { timeout: 120000 })
    for (const { w, theme } of matrix) { await apply(app, w, theme); await shot(app, w, theme, 'built-output') }
    await openWorkspaceTool(page, 'size')
    await page.waitExists('[data-testid=size-panel]')
    for (const { w, theme } of matrix) { await apply(app, w, theme); await shot(app, w, theme, 'size-regions') }
    await page.click({ sel: '[role=tab]', text: 'Секции' })
    for (const { w, theme } of matrix) { await apply(app, w, theme); await shot(app, w, theme, 'size-sections') }
    await page.click({ sel: '[role=tab]', text: 'Символы' })
    for (const { w, theme } of matrix) { await apply(app, w, theme); await shot(app, w, theme, 'size-symbols') }
    await page.click('[data-testid=act-project]')
    await page.waitExists('[data-testid=pro-build-group]')
    for (const { w, theme } of matrix) { await apply(app, w, theme); await shot(app, w, theme, 'project-panel') }
    await page.click('[data-testid=pro-cfg-edit]')
    await page.waitExists('[data-testid=pb-configs]')
    for (const { w, theme } of matrix) { await apply(app, w, theme); await shot(app, w, theme, 'configs-dialog') }
    await page.click({ sel: '.dlg button', text: 'Отмена' })
    await page.click('[data-testid=act-settings]')
    await page.waitExists('[data-testid=settings-toolchain]')
    await page.waitFor(`/Найден/.test(document.querySelector('[data-testid=toolchain-status]')?.innerText ?? '')`)
    for (const { w, theme } of matrix) { await apply(app, w, theme); await shot(app, w, theme, 'settings-toolchain') }
  })
}
console.log('снимки:', out)
process.exit(0)

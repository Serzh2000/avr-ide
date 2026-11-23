// Сквозные задачи новичка с подсчётом кликов и снимком на каждом шаге.
//   node scripts/e2e/tasks.mjs <папка-вывода>
// Задачи: a — первый проект под ESP32; c — распиновка в справочнике; g — монитор порта и плоттер; h — недавний проект, плата, тема.
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ensureBuilt, launch } from './lib/app.mjs'
import { createProjectViaWizard, openRecent, openWorkspaceTool } from './lib/kit.mjs'
import { sleep } from './lib/cdp.mjs'

const out = resolve(process.argv[2] ?? 'task-shots')
ensureBuilt()
mkdirSync(out, { recursive: true })
const app = await launch({
  arduino: 'ard2',
  files: { 'Old1/Old1.ino': 'void setup() {\n}\nvoid loop() {\n}\n', 'Old1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Old1']
})
const { page } = app
let clicks = 0
const realClick = page.click.bind(page)
page.click = async (...a) => { clicks++; return realClick(...a) }
const shot = async (name) => { await sleep(400); await page.shot(join(out, name + '.png')) }
const task = (name) => { console.log(`\n== ${name}`); clicks = 0 }
const done = (what) => console.log(`   кликов: ${clicks} — ${what}`)

try {
  // a. Первый запуск → проект под ESP32 → код мигания
  task('a: первый проект под ESP32')
  await page.waitExists('[data-testid=start-screen]')
  await shot('a1-start')
  await page.click('[data-testid=start-create]')
  await page.click('[data-testid=project-kind-arduino]')
  await page.waitExists('[data-testid=wz-board]', { timeout: 120000 })
  await shot('a2-wizard-board')
  await page.fill('[data-testid=wz-search]', 'esp32')
  await page.click('[data-testid=wz-board][data-fqbn="esp32:esp32:esp32"]')
  await page.click('[data-testid=wz-next]')
  await page.waitExists('[data-testid=wz-name]')
  await shot('a3-wizard-name')
  await page.fill('[data-testid=wz-name]', 'Blink1')
  await page.waitFor(`!document.querySelector('[data-testid=wz-create]').disabled`)
  await page.click('[data-testid=wz-create]')
  await page.waitFor(`!!document.querySelector('.monaco-editor .view-lines')`, { timeout: 20000 })
  await shot('a4-editor-after-create')
  console.log('   подсказка «Дальше»: ' + (await page.eval(`document.querySelector('[data-testid=next-step]')?.textContent ?? ''`)))
  done('создан проект, открыт редактор, плата выбрана; код мигания пользователь пишет сам или берёт из «Примеров»')

  // c. Распиновка своей платы
  task('c: распиновка и пин светодиода')
  await page.click('[data-testid=act-ref]')
  await shot('c1-reference-functions')
  await page.click({ sel: '.ref-tabs [role=tab]', text: 'Платы' })
  await sleep(600)
  await shot('c2-reference-boards')
  done('справочник → «Платы и распиновка»: схема платы и таблица пинов')

  // g. Монитор порта и плоттер
  task('g: монитор порта и плоттер')
  // из вкладки «Справочник» нижние панели скрыты — возвращаемся к коду (первая вкладка)
  await page.click('[data-testid=tab]')
  await openWorkspaceTool(page, 'monitor')
  await shot('g1-monitor-empty')
  await openWorkspaceTool(page, 'plotter')
  await shot('g2-plotter-empty')
  done('вкладки «Монитор порта» и «Плоттер» внизу; без порта предлагают «Выбрать порт»')

  // h. Недавний проект, смена платы, смена темы
  task('h: недавний проект, плата, тема')
  await page.click('[data-testid=hdr-close-project]')
  await page.waitExists('[data-testid=start-screen]')
  await shot('h1-start-recent')
  await page.click({ sel: '[data-testid=start-recent]', text: 'Old1' })
  await page.waitFor(`!!document.querySelector('.monaco-editor .view-lines')`, { timeout: 20000 })
  await page.click('[data-testid=hdr-board]')
  await shot('h2-board-picker')
  await page.key('Escape')
  await page.click('[data-testid=act-settings]')
  await shot('h3-settings')
  await page.click({ sel: '.view button', text: 'Светлая' })
  await shot('h4-light-theme')
  done('возврат на старт и открытие недавнего, окно выбора платы, настройки → тема')
} finally {
  await app.close?.()
}

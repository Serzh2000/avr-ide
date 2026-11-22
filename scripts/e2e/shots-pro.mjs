// Снимки экранов Профессионального режима (STM32) на имитаторах OpenOCD/GDB и ST-Link: обе темы, ширины 1280 и 760.
//   node scripts/e2e/shots-pro.mjs <папка-вывода> [--widths 1280,760] [--themes dark,light]
// Ни одна команда не касается железа; компилятора ARM в среде нет (AVRIDE_PRO_GCC=none) — карточка «Установить компилятор» показывается как есть.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureBuilt, launch } from './lib/app.mjs'
import { sleep } from './lib/cdp.mjs'

const args = process.argv.slice(2)
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const out = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'shots-pro')
const widths = flag('--widths', '1280,760').split(',').map(Number)
const themes = flag('--themes', 'dark,light').split(',')
const FAKES = resolve(dirname(fileURLToPath(import.meta.url)), 'fakes')
const WORK = mkdtempSync(join(tmpdir(), 'avride-shots-pro-'))
const MODE = join(WORK, 'mode.txt'); writeFileSync(MODE, 'ok')
const LOG = join(WORK, 'calls.jsonl'); writeFileSync(LOG, '')

const PROJECT = {
  schemaVersion: 1, name: 'ProShot',
  target: { vendor: 'st', family: 'STM32F1', chip: 'STM32F103C8T6', board: 'Blue Pill', core: 'cortex-m3', memory: { flash: { origin: '0x08000000', size: 65536 }, ram: { origin: '0x20000000', size: 20480 } } },
  sources: ['src'], includes: ['include'], defines: ['STM32F103xB'], linkerScript: 'linker/STM32F103C8T6_FLASH.ld', startupFile: 'startup/startup_stm32f103xb.s',
  configurations: { Debug: { optimization: 'Og', debugLevel: 'g3', defines: ['DEBUG'], extraFlags: [] }, Release: { optimization: 'Os', debugLevel: 'none', defines: ['NDEBUG'], extraFlags: [] } },
  toolchain: { kind: 'arm-none-eabi-gcc' }, programmer: { kind: 'stlink', interface: 'swd', openocdTarget: 'target/stm32f1x.cfg' }
}
const MAIN_C = '#include <stdint.h>\n\nstatic volatile uint32_t counter;\n\nstatic void delay_ms(uint32_t ms)\n{\n    for (uint32_t i = 0; i < ms * 1000; i++) {\n        counter++;\n    }\n}\n\nint main(void)\n{\n    while (1) {\n        delay_ms(500);\n    }\n}\n'

ensureBuilt()
mkdirSync(out, { recursive: true })
const app = await launch({
  arduino: 'ard2',
  files: {
    'ProShot/avride.project.json': JSON.stringify(PROJECT, null, 2),
    'ProShot/src/main.c': MAIN_C,
    'ProShot/include/README.txt': 'x',
    'ProShot/linker/STM32F103C8T6_FLASH.ld': '/* ld */',
    'ProShot/startup/startup_stm32f103xb.s': '/* s */',
    'ProShot/build/Debug/ProShot.elf': 'FAKE ELF',
    'Blinky/Blinky.ino': 'void setup() {}\nvoid loop() {}\n', 'Blinky/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n'
  },
  projects: ['ProShot'],
  env: {
    AVRIDE_PRO_GCC: 'none',
    AVRIDE_PRO_OPENOCD: join(FAKES, 'fake-openocd.mjs'),
    AVRIDE_PRO_GDB: join(FAKES, 'fake-gdb.mjs'),
    AVRIDE_PRO_PROBES: JSON.stringify([{ id: '066DFF485054877267163321', kind: 'stlink', name: 'ST-Link V2-1', serial: '066DFF485054877267163321', driver: 'ok', vcp: true }]),
    AVRIDE_FAKE_LOG: LOG,
    AVRIDE_FAKE_MODE_FILE: MODE
  }
})
const { page, cdp } = app
const within = (p, ms = 15000) => Promise.race([Promise.resolve(p), new Promise((_, rej) => setTimeout(() => rej(new Error('таймаут шага')), ms))])
const tryDo = (p) => within(p).catch((e) => console.log('  ! ' + String(e.message).slice(0, 140)))
const S = (code) => page.eval(`(() => { const st = window.__avrStores; ${code} })()`)
let W = 0, T = ''
const shot = async (name) => {
  await sleep(400)
  // captureScreenshot зависает, если окну не отдаются кадры — окно вперёд и повтор
  let lastErr = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { await page.cdp.send('Page.bringToFront').catch(() => {}); await within(page.shot(join(out, `pro-${W}-${T}-${name}.png`)), 8000); lastErr = null; break } catch (e) { lastErr = e; await sleep(500) }
  }
  if (lastErr) console.log('  ! снимок ' + name + ': ' + lastErr.message)
}
const setSize = async (w) => { await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: w >= 1200 ? 800 : 760, deviceScaleFactor: 1, mobile: false }); await sleep(300) }
const setTheme = async (t) => { await S(`st.useUi.getState().setSettings({ theme: '${t}' })`); await page.waitFor(`document.documentElement.dataset.theme === '${t}'`) }
const clear = async () => { for (let i = 0; i < 3 && (await page.exists('.modal-backdrop')); i++) { await page.key('Escape'); await sleep(300) } }
const bottom = async (id) => { await clear(); await tryDo(page.click(`[data-testid=btab-${id}]`)); await sleep(500) }

try {
  await page.waitExists('[data-testid=start-screen]')
  await page.click('[data-testid=mode-pro]')
  for (const w of widths) {
    W = w
    await setSize(w)
    for (const theme of themes) {
      T = theme
      console.log(`ширина ${w}, тема ${theme}`)
      await setTheme(theme)
      // старт и мастер (на старте, если уже в проекте — возвращаемся)
      if (!(await page.exists('[data-testid=start-screen]'))) { await tryDo(page.click('[data-testid=hdr-close-project]')); await page.waitExists('[data-testid=start-screen]') }
      await shot('start')
      await page.click('[data-testid=start-create]')
      await page.waitExists('[data-testid=pro-wizard]')
      await sleep(600)
      await shot('wizard1')
      await tryDo(page.fill('[data-testid=pro-wz-search]', 'F103'))
      await tryDo(page.click('[data-testid=pro-wz-chip][data-chip=STM32F103C8T6]'))
      await shot('wizard1-chip')
      await page.key('Escape')
      await page.waitGone('[data-testid=pro-wizard]')
      // проект
      await page.click({ sel: '[data-testid=start-recent]', text: 'ProShot' })
      await page.waitExists('[data-testid=header][data-mode=pro]', { timeout: 40000 })
      await page.waitExists('[data-testid=pb-support]', { timeout: 4000 }).catch(() => {}) // карточка «поддержка CMSIS» есть не всегда
      await tryDo(page.click('[data-testid=pro-build]')); await sleep(900); await clear() // диалог компилятора снимается ниже как build-no-compiler
      if (await page.exists('[data-testid=pb-later]')) await tryDo(page.click('[data-testid=pb-later]'))
      await tryDo(page.click('[data-testid=act-project]'))
      await tryDo(page.click('[data-testid=pro-file][data-name="main.c"]'))
      await page.waitFor(`!!document.querySelector('.monaco-editor .view-lines')`, { timeout: 20000 })
      await shot('editor-project')
      // «Ещё» в шапке (виден при ширине < 1100)
      if (await page.eval(`(() => { const b = document.querySelector('[data-testid=pro-more]'); return !!b && b.offsetParent !== null })()`)) {
        await tryDo(page.click('[data-testid=pro-more]')); await sleep(250); await shot('more-menu'); await page.key('Escape'); await sleep(200)
      }
      await tryDo(page.click('[data-testid=act-files]')); await shot('files')
      await tryDo(page.click('[data-testid=act-search]')); await shot('search')
      await tryDo(page.click('[data-testid=act-chips]')); await sleep(600); await shot('chips')
      await tryDo(page.click('[data-testid=pro-chip-item]')); await sleep(800); await shot('chips-wizard-from-chip'); await clear()
      await tryDo(page.click('[data-testid=act-settings]')); await sleep(500); await shot('settings')
      await tryDo(page.click('[data-testid=tab]')) // назад к коду
      // нижние вкладки
      for (const id of ['output', 'problems', 'monitor', 'hw', 'debug', 'size']) { await bottom(id); await shot('bottom-' + id) }
      // сборка: компилятора нет → карточка установки
      await tryDo(page.click('[data-testid=pro-build]')); await sleep(800); await shot('build-no-compiler')
      if (await page.exists('[data-testid=pb-later]')) await tryDo(page.click('[data-testid=pb-later]'))
      await clear()
      // состояния «идёт» в шапке и в нижней панели (имитация состоянием стора)
      await S(`st.useBuild.setState({ busy: true, kind: 'compile', startedAt: Date.now() - 42000, progress: { label: 'Компиляция', pct: 40 } })`)
      await bottom('output'); await shot('build-running')
      await S(`st.useBuild.setState({ busy: false, kind: null, startedAt: null, progress: null })`)
      // прошивка: ход и итог, ошибка
      await bottom('hw')
      await tryDo(page.click('[data-testid=pro-flash]')); await sleep(250); await shot('flash-running')
      await tryDo(within(page.waitExists('[data-testid=hw-done]', { timeout: 15000 }), 17000)); await shot('flash-done')
      writeFileSync(MODE, 'nopower'); await tryDo(page.click('[data-testid=hw-flash]'))
      await tryDo(within(page.waitExists('[data-testid=hw-error]', { timeout: 15000 }), 17000)); await shot('flash-error')
      writeFileSync(MODE, 'ok')
      // отладка
      await tryDo(page.click('[data-testid=pro-debug]'))
      await tryDo(within(page.waitFor(`document.querySelector('[data-testid=dbg-state]')?.getAttribute('data-state') === 'stopped'`, { timeout: 15000 }), 17000))
      await shot('debug-stopped')
      for (const tab of ['Переменные', 'Регистры', 'Память', 'Дизассемблер', 'Периферия']) { await tryDo(page.click({ sel: '.dbg-tabs button', text: tab })); await sleep(500); await shot('debug-' + tab) }
      await tryDo(page.click('[data-testid=dbg-stop]')); await sleep(800)
      // диалоги и подсказки
      await tryDo(page.click('[data-testid=act-project]')); await tryDo(page.click('[data-testid=pro-cfg-edit]')); await sleep(500); await shot('config-dialog')
      await page.key('Escape'); await sleep(300)
      await S(`st.useUi.getState().notify('Плата прошита: 2048 байт, проверка записи пройдена.', { kind: 'ok' })`); await shot('toast')
      await tryDo(page.click('[data-testid=hdr-help]')); await sleep(400); await shot('help')
      await page.key('Escape'); await sleep(200)
      await S(`st.useUi.getState().setTour(0)`); await shot('tour1')
      await S(`st.useUi.getState().setTour(3)`); await shot('tour4')
      await S(`st.useUi.getState().setTour(null)`)
      await page.key('p', { ctrl: true, shift: true }); await sleep(400); await shot('palette')
      await page.key('Escape'); await sleep(200)
      // Arduino-проект в Pro: возврат режима
      await tryDo(page.click('[data-testid=hdr-close-project]'))
      await tryDo(page.click({ sel: '[data-testid=mode-arduino]' })); await sleep(300)
      await shot('start-arduino-mode')
      await tryDo(page.click('[data-testid=mode-pro]'))
    }
  }
  console.log('Готово: ' + out)
} finally {
  await app.close?.()
}

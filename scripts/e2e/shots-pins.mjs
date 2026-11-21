// Снимки конфигуратора «Пины и тактирование» (Pro): обе темы, ширины 1280 и 760.
//   node scripts/e2e/shots-pins.mjs <папка-вывода> [--widths 1280,760] [--themes dark,light]
// Устройств и компилятора не нужно. Проекты — заготовки в папке скетчей временного профиля.
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ensureBuilt, launch } from './lib/app.mjs'
import { sleep } from './lib/cdp.mjs'

const args = process.argv.slice(2)
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const out = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'shots-pins')
const widths = flag('--widths', '1280,760').split(',').map(Number)
const themes = flag('--themes', 'dark,light').split(',')
// «Недавние» на старте показывают 6 проектов, поэтому снимки идут двумя запусками: --set a (по умолчанию) и --set b
const SET = flag('--set', 'a')
const SETS = { a: ['PinsEmpty', 'PinsBroken', 'PinsOk', 'PinsBad', 'PinsF411', 'PinsGrid'], b: ['PinsTssop', 'PinsL4'] }

const project = (name, chip, family, core, define, startup, flash, ram, extra = {}) => JSON.stringify({
  schemaVersion: 1, name,
  target: { vendor: 'st', family, chip, core, ...extra, memory: { flash: { origin: '0x08000000', size: flash }, ram: { origin: '0x20000000', size: ram } } },
  sources: ['src'], includes: ['include'], defines: [define], linkerScript: 'linker/x.ld', startupFile: `startup/${startup}`,
  configurations: { Debug: { optimization: 'Og', debugLevel: 'g3', defines: ['DEBUG'], extraFlags: [] }, Release: { optimization: 'Os', debugLevel: 'none', defines: ['NDEBUG'], extraFlags: [] } },
  toolchain: { kind: 'arm-none-eabi-gcc' }, programmer: { kind: 'stlink', interface: 'swd', openocdTarget: 'target/stm32f1x.cfg' }
}, null, 2)
const MAIN_C = '#include "stm32f1xx.h"\n\nint main(void)\n{\n    for (;;) {\n    }\n}\n'
const base = (name, pj, pins) => ({
  [`${name}/avride.project.json`]: pj, [`${name}/src/main.c`]: MAIN_C, [`${name}/include/README.txt`]: 'x', [`${name}/linker/x.ld`]: '/* ld */', [`${name}/startup/s.s`]: '/* s */',
  ...(pins ? { [`${name}/avride.pins.json`]: typeof pins === 'string' ? pins : JSON.stringify(pins, null, 2) } : {})
})
const clk = (o = {}) => ({ source: 'hsi', pllSource: 'hsi', hseHz: 8000000, hseBypass: false, pll: {}, ahbDiv: 1, apb1Div: 1, apb2Div: 1, ...o })
const PLL72 = clk({ source: 'pll', pllSource: 'hse', pll: { mul: 9, hseDiv2: false }, apb1Div: 2 })

const FILES = {
  ...base('PinsOk', project('PinsOk', 'STM32F103C8T6', 'STM32F1', 'cortex-m3', 'STM32F103xB', 's.s', 65536, 20480), {
    schemaVersion: 1, chip: 'stm32f103c8', mode: 'cmsis',
    pins: { PC13: { role: 'output', initial: 'high', label: 'LED' }, PA0: { role: 'input', pull: 'up', label: 'BTN' }, PA13: { label: 'SWDIO' } },
    peripherals: { USART1: { enabled: true, baud: 115200, signals: { USART1_TX: 'PA9', USART1_RX: 'PA10' } }, I2C1: { enabled: true, signals: { I2C1_SCL: 'PB6', I2C1_SDA: 'PB7' } }, ADC1: { enabled: true, signals: { ADC1_IN9: 'PB1' } } },
    clock: PLL72
  }),
  ...base('PinsBad', project('PinsBad', 'STM32F103C8T6', 'STM32F1', 'cortex-m3', 'STM32F103xB', 's.s', 65536, 20480), {
    schemaVersion: 1, chip: 'stm32f103c8', mode: 'cmsis',
    pins: { PC13: { role: 'output', label: 'LED' }, PA10: { role: 'input', label: 'BTN' }, PA13: { role: 'output', label: 'X' } },
    peripherals: { USART1: { enabled: true, baud: 115200, signals: { USART1_TX: 'PA9', USART1_RX: 'PA10' } }, SPI1: { enabled: true, signals: { SPI1_SCK: 'PA5', SPI1_MISO: 'PA6', SPI1_MOSI: 'PB3' } } },
    clock: clk({ source: 'pll', pllSource: 'hse', pll: { mul: 9 }, apb1Div: 1 })
  }),
  ...base('PinsEmpty', project('PinsEmpty', 'STM32F103C8T6', 'STM32F1', 'cortex-m3', 'STM32F103xB', 's.s', 65536, 20480), null),
  ...base('PinsBroken', project('PinsBroken', 'STM32F103C8T6', 'STM32F1', 'cortex-m3', 'STM32F103xB', 's.s', 65536, 20480), '{ "schemaVersion": 1, "chip": "stm32f103c8", "pins": { "PA9": { "role": "banana" } } }'),
  ...base('PinsF411', project('PinsF411', 'STM32F411RET6', 'STM32F4', 'cortex-m4', 'STM32F411xE', 's.s', 524288, 131072, { fpu: 'fpv4-sp-d16', floatAbi: 'hard' }), {
    schemaVersion: 1, chip: 'stm32f411re', mode: 'cmsis',
    pins: { PA5: { role: 'output', label: 'LED' }, PC13: { role: 'input', label: 'BTN' } },
    peripherals: { USART2: { enabled: true, baud: 115200, signals: { USART2_TX: 'PA2', USART2_RX: 'PA3' } }, SPI1: { enabled: true, signals: { SPI1_SCK: 'PB3' } }, TIM2: { enabled: true, signals: { TIM2_CH1: 'PA0' } } },
    clock: clk({ source: 'pll', pllSource: 'hse', pll: { m: 4, n: 100, p: 2, q: 4 }, apb1Div: 2 })
  }),
  ...base('PinsGrid', project('PinsGrid', 'STM32F411CEU6', 'STM32F4', 'cortex-m4', 'STM32F411xE', 's.s', 524288, 131072), {
    schemaVersion: 1, chip: 'stm32f411ce', package: 'WLCSP49', mode: 'cmsis', pins: { PC13: { role: 'output', label: 'LED' } }, peripherals: { USART1: { enabled: true, baud: 115200, signals: { USART1_TX: 'PA15', USART1_RX: 'PB3' } } }, clock: clk()
  }),
  ...base('PinsTssop', project('PinsTssop', 'STM32F030F4P6', 'STM32F0', 'cortex-m0', 'STM32F030x6', 's.s', 16384, 4096), { schemaVersion: 1, chip: 'stm32f030f4', mode: 'cmsis', pins: { PA4: { role: 'output', label: 'LED' } }, peripherals: {}, clock: clk() }),
  ...base('PinsL4', project('PinsL4', 'STM32L476RGT6', 'STM32L4', 'cortex-m4', 'STM32L476xx', 's.s', 1048576, 98304), {
    schemaVersion: 1, chip: 'stm32l476rg', mode: 'cmsis', pins: { PA5: { role: 'output', label: 'LED' } }, peripherals: { USART2: { enabled: true, baud: 115200, signals: { USART2_TX: 'PA2', USART2_RX: 'PA3' } } }, clock: clk()
  })
}

ensureBuilt()
mkdirSync(out, { recursive: true })
const app = await launch({ arduino: 'ard2', files: FILES, projects: SETS[SET], env: { AVRIDE_PRO_GCC: 'none' } })
const { page, cdp } = app
const within = (p, ms = 15000) => Promise.race([Promise.resolve(p), new Promise((_, rej) => setTimeout(() => rej(new Error('таймаут шага')), ms))])
const tryDo = (p) => within(p).catch((e) => console.log('  ! ' + String(e.message).slice(0, 160)))
const S = (code) => page.eval(`(() => { const st = window.__avrStores; ${code} })()`)
let W = 0, T = ''
const shot = async (name) => { await sleep(450); await within(page.shot(join(out, `pins-${W}-${T}-${name}.png`)), 20000).catch((e) => console.log('  ! снимок ' + name + ': ' + e.message)) }
const setSize = async (w) => { await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: w >= 1200 ? 800 : 760, deviceScaleFactor: 1, mobile: false }); await sleep(300) }
const setTheme = async (t) => { await S(`st.useUi.getState().setSettings({ theme: '${t}' })`); await page.waitFor(`document.documentElement.dataset.theme === '${t}'`) }
const clear = async () => { for (let i = 0; i < 3 && (await page.exists('.modal-backdrop')); i++) { await page.key('Escape'); await sleep(300) } }
const setSelect = (testid, value) => page.eval(`(() => { const s = document.querySelector('[data-testid=${testid}]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
const tab = (t) => tryDo(page.click({ sel: '[role=tab]', text: t, within: '.pc-tabs' }))
const hideBottom = () => S(`st.useUi.setState({ bottomVisible: false })`)

const open = async (name, waitState = 'ready') => {
  if (!(await page.exists('[data-testid=start-screen]'))) { await tryDo(page.click('[data-testid=hdr-close-project]')); await page.waitExists('[data-testid=start-screen]') }
  await page.click({ sel: '[data-testid=start-recent]', text: name })
  await page.waitExists('[data-testid=header][data-mode=pro]', { timeout: 40000 })
  await S(`st.useUi.getState().set({ sideVisible: true, sideView: 'project' })`)
  await tryDo(page.click('[data-testid=pro-open-pins]'))
  if (!(await page.exists('[data-testid=pins-view]'))) await shot('debug-' + name)
  await page.waitExists(`[data-testid=pins-view][data-state=${waitState}]`, { timeout: 15000 })
  await hideBottom()
  if (waitState === 'ready') await tryDo(page.click({ sel: '[role=tab]', text: 'Выводы', within: '.pc-tabs' }))
  await sleep(300)
}

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
      if (SET === 'a') {
      // пустое состояние
      await open('PinsEmpty', 'empty'); await shot('empty')
      await open('PinsBroken', 'broken'); await shot('broken')
      // F103C8: нормальная конфигурация
      await open('PinsOk')
      await shot('pinout')
      await tryDo(page.click('[data-testid=pin][data-pin=PA9]')); await shot('pin-inspector')
      await tryDo(page.click('[data-testid=pin][data-pin=PA13]')); await shot('pin-guarded')
      await tryDo(page.click('[data-testid=pins-periph][data-periph=I2C1] .pc-per-name')); await shot('periph-inspector')
      await tab('Тактирование'); await shot('clock')
      await tab('Таблица пинов'); await shot('table')
      await tab('Выводы')
      await tryDo(page.click('[data-testid=pins-generate]')); await page.waitExists('[data-testid=pins-gen-files]'); await shot('generate'); await clear()
      // конфликты
      await open('PinsBad')
      await shot('conflicts')
      await tab('Тактирование'); await shot('clock-error')
      await tab('Выводы')
      await tryDo(page.click('[data-testid=pins-generate]')); await page.waitExists('[data-testid=pins-gen-blocked]'); await shot('generate-blocked'); await clear()
      await open('PinsF411'); await shot('f411-lqfp64')
      await tab('Тактирование'); await shot('f411-clock')
      await open('PinsGrid'); await shot('wlcsp49')
      } else {
      await open('PinsTssop'); await shot('tssop20')
      await open('PinsL4'); await shot('l4-pinout')
      await tab('Тактирование'); await shot('l4-clock-manual')
      await tab('Выводы')
      await tryDo(page.click('[data-testid=pins-generate]')); await page.waitExists('[data-testid=pins-gen-blocked]'); await shot('l4-generate-blocked'); await clear()
      }
    }
  }
} finally {
  await app.close()
}
console.log('снимки:', out)

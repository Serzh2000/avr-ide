// Снимки «умного редактора» Pro (STM32): подсказки после «GPIOA->», hover, Ctrl+T, ссылки, переименование, ассемблер, скрипт компоновки,
// avride.project.json с ошибкой. Обе темы, ширины 1280 и 760.
//   node scripts/e2e/shots-pro-editor.mjs <папка-вывода> [--widths 1280,760] [--themes dark,light]
// Заголовки устройства: настоящий CMSIS, если задан AVRIDE_CMSIS_DIR (кэш пакетов поддержки), иначе имитация из scripts/e2e/fixtures.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureBuilt, launch } from './lib/app.mjs'
import { sleep } from './lib/cdp.mjs'

const args = process.argv.slice(2)
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const out = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'shots-pro-editor')
const widths = flag('--widths', '1280,760').split(',').map(Number)
const themes = flag('--themes', 'dark,light').split(',')
const HERE = dirname(fileURLToPath(import.meta.url))
const CMSIS = process.env.AVRIDE_CMSIS_DIR
const REAL = !!CMSIS && existsSync(join(CMSIS, 'cmsis-device-f1@v4.3.5', 'Include', 'stm32f103xb.h'))

const PROJECT = {
  schemaVersion: 1, name: 'EdShot',
  target: { vendor: 'st', family: 'STM32F1', chip: 'STM32F103C8T6', board: 'Blue Pill', core: 'cortex-m3', memory: { flash: { origin: '0x08000000', size: 65536 }, ram: { origin: '0x20000000', size: 20480 } } },
  sources: ['src'], includes: ['include', 'drivers/CMSIS/Include'], defines: ['STM32F103xB'], linkerScript: 'linker/STM32F103C8T6_FLASH.ld', startupFile: 'startup/startup_stm32f103xb.s',
  configurations: { Debug: { optimization: 'Og', debugLevel: 'g3', defines: ['DEBUG'], extraFlags: [] }, Release: { optimization: 'Os', debugLevel: 'none', defines: ['NDEBUG'], extraFlags: [] } },
  toolchain: { kind: 'arm-none-eabi-gcc' }, programmer: { kind: 'stlink', interface: 'swd', openocdTarget: 'target/stm32f1x.cfg' }
}
const MAIN_C = `#include "stm32f1xx.h"
#include "led.h"

static void delay_loop(volatile uint32_t n)
{
    while (n--) {
    }
}

int main(void)
{
    RCC->APB2ENR |= RCC_APB2ENR_IOPCEN;
    for (;;) {
        led_toggle(GPIOC, 13);
        delay_loop(400000u);
    }
}
`
const LED_H = '#ifndef LED_H\n#define LED_H\n#include "stm32f1xx.h"\n\n/** Переключить вывод порта */\nvoid led_toggle(GPIO_TypeDef *port, uint32_t pin);\n\n#endif\n'
const LED_C = '#include "led.h"\n\nvoid led_toggle(GPIO_TypeDef *port, uint32_t pin)\n{\n    port->ODR ^= (1u << pin);\n}\n'
const LD = `/* Скрипт компоновки STM32F103C8T6 */
ENTRY(Reset_Handler)
_estack = ORIGIN(RAM) + LENGTH(RAM);

MEMORY
{
  FLASH (rx) : ORIGIN = 0x08000000, LENGTH = 64K
  RAM (xrw)  : ORIGIN = 0x20000000, LENGTH = 20K
}

SECTIONS
{
  .isr_vector :
  {
    . = ALIGN(4);
    KEEP(*(.isr_vector))
    . = ALIGN(4);
  } >FLASH

  .text :
  {
    *(.text*)
    *(.rodata*)
    . = ALIGN(4);
  } >FLASH

  .data : AT(_sidata)
  {
    _sdata = .;
    *(.data*)
    _edata = .;
  } >RAM
}
`
const ASM = `.syntax unified
.cpu cortex-m3
.thumb

.global g_pfnVectors
.global Reset_Handler

.section .text.Reset_Handler
.weak Reset_Handler
.type Reset_Handler, %function
Reset_Handler:
  ldr   r0, =_estack
  mov   sp, r0          /* стек */
  movs  r1, #0
  b     LoopCopyDataInit

CopyDataInit:
  ldr   r3, =_sidata
  ldr   r3, [r3, r1]
  str   r3, [r0, r1]
  adds  r1, r1, #4

LoopCopyDataInit:
  ldr   r0, =_sdata
  cmp   r2, r3
  bcc   CopyDataInit
  bl    main
  bx    lr
.size Reset_Handler, .-Reset_Handler
`

const files = { 'EdShot/avride.project.json': JSON.stringify(PROJECT, null, 2), 'EdShot/src/main.c': MAIN_C, 'EdShot/src/led.c': LED_C, 'EdShot/include/led.h': LED_H, 'EdShot/linker/STM32F103C8T6_FLASH.ld': LD, 'EdShot/startup/startup_stm32f103xb.s': ASM }
if (!REAL) files['EdShot/drivers/CMSIS/Include/stm32f1xx.h'] = readFileSync(join(HERE, 'fixtures', 'stm32f1xx_mini.h'), 'utf8')

ensureBuilt()
mkdirSync(out, { recursive: true })
const app = await launch({ arduino: 'ard2', files, projects: ['EdShot'], env: { AVRIDE_PRO_GCC: 'none' } })
const { page, cdp, sketchbook } = app
if (REAL) {
  const dst = join(sketchbook, 'EdShot', 'drivers', 'CMSIS', 'Include')
  mkdirSync(dst, { recursive: true })
  for (const d of ['cmsis-device-f1@v4.3.5/Include', 'cmsis_core@v5.6.0_cm3/Core/Include']) for (const f of readdirSync(join(CMSIS, d))) cpSync(join(CMSIS, d, f), join(dst, f))
}

const within = (p, ms = 15000) => Promise.race([Promise.resolve(p), new Promise((_, rej) => setTimeout(() => rej(new Error('таймаут шага')), ms))])
const tryDo = (p) => within(p).catch((e) => console.log('  ! ' + String(e.message).slice(0, 160)))
const S = (code) => page.eval(`(() => { const st = window.__avrStores; ${code} })()`)
let W = 0, T = ''
const shot = async (name) => {
  await sleep(450)
  // captureScreenshot зависает, если окну не отдаются кадры — окно вперёд и повтор
  let lastErr = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { await page.cdp.send('Page.bringToFront').catch(() => {}); await within(page.shot(join(out, `ped-${W}-${T}-${name}.png`)), 8000); lastErr = null; break } catch (e) { lastErr = e; await sleep(500) }
  }
  if (lastErr) console.log('  ! снимок ' + name + ': ' + lastErr.message)
}
const setSize = async (w) => { await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: w >= 1200 ? 800 : 760, deviceScaleFactor: 1, mobile: false }); await sleep(300) }
const setTheme = async (t) => { await S(`st.useUi.getState().setSettings({ theme: '${t}' })`); await page.waitFor(`document.documentElement.dataset.theme === '${t}'`) }
const wordRect = async (word, nth = 0) => {
  const expr = `(() => {
    const spans = [...document.querySelectorAll('.view:not([hidden]) .monaco-editor .view-lines span')].filter((s) => s.children.length === 0 && s.textContent.replace(/\\u00a0/g, ' ').trim() === ${JSON.stringify(word)})
    const s = spans[${nth}]; if (!s) return null
    const tn = s.firstChild; const i = tn.textContent.indexOf(${JSON.stringify(word)})
    const r = document.createRange(); r.setStart(tn, i); r.setEnd(tn, i + ${word.length})
    const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }
  })()`
  await page.waitFor(expr, { timeout: 6000, what: 'слово ' + word })
  return page.settle(expr)
}
const clickWord = async (word, nth = 0) => {
  const r = await wordRect(word, nth)
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1, buttons: 1 })
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 })
  return r
}
const hover = async (word, nth = 0) => {
  const r = await wordRect(word, nth)
  await page.key('Escape')
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x + 300, y: r.y + 60 })
  await sleep(200)
  for (const dx of [-40, -20, -6, 0]) { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x + dx, y: r.y }); await sleep(120) }
  await sleep(900)
}
const openFile = async (name) => {
  // кнопка раздела сворачивает уже открытую панель — кликаем только если списка файлов проекта не видно
  if (!(await page.exists({ sel: '.tree-row', text: name }))) await tryDo(page.click('[data-testid=act-project]'))
  await page.waitExists({ sel: '.tree-row', text: name }, { timeout: 5000 }).catch(() => {})
  await tryDo(page.click({ sel: '.tree-row', text: name }))
  await tryDo(page.waitFor(`document.querySelector('[data-testid=tab][aria-selected=true]')?.innerText.toLowerCase().includes(${JSON.stringify(name.toLowerCase())})`, { timeout: 8000 }))
  console.log('  вкладки: ' + (await page.eval(`[...document.querySelectorAll('[data-testid=tab]')].map((t) => t.innerText.trim() + (t.getAttribute('aria-selected') === 'true' ? '*' : '')).join(' | ')`)))
  await sleep(500)
}
const typeIn = async (text) => { await page.click('.view:not([hidden]) .monaco-editor .view-lines'); await page.key('End', { ctrl: true }); await page.insertText(text) }

try {
  await page.waitExists('[data-testid=start-screen]')
  await page.click('[data-testid=mode-pro]')
  await page.click({ sel: '[data-testid=start-recent]', text: 'EdShot' })
  await page.waitExists('[data-testid=header][data-mode=pro]', { timeout: 40000 })
  await openFile('main.c')
  await page.waitFor(`!!document.querySelector('.monaco-editor .view-lines')`, { timeout: 20000 })
  await tryDo(page.waitFor(`window.api.pro.sym('status').then((r) => !!r.ok && r.data.ready && r.data.files >= 4)`, { timeout: 30000 }))
  const st = await page.eval(`window.api.pro.sym('status').then((r) => r.data)`)
  console.log(`индекс: ${st.files} файлов, ${st.symbols} символов, ${st.ms} мс; заголовки ${REAL ? 'настоящие CMSIS' : 'имитация'}`)
  for (const w of widths) {
    W = w
    await setSize(w)
    for (const theme of themes) {
      T = theme
      console.log(`ширина ${w}, тема ${theme}`)
      await setTheme(theme)
      // main.c в исходном виде
      await openFile('main.c')
      await shot('editor-plain')
      // подсказки после «GPIOA->»
      await typeIn('\nvoid probe(void)\n{\n    GPIOA->')
      await sleep(400); await page.key(' ', { ctrl: true })
      await tryDo(page.waitFor(`!!document.querySelector('.suggest-widget.visible')`, { timeout: 6000 }))
      await shot('complete-members')
      await page.key('Escape')
      await page.insertText('ODR |= GPIO_ODR_ODR1')
      await sleep(300); await page.key(' ', { ctrl: true })
      await tryDo(page.waitFor(`!!document.querySelector('.suggest-widget.visible')`, { timeout: 6000 }))
      await shot('complete-bits')
      await page.key('Escape')
      // вернуть исходный текст
      await page.key('a', { ctrl: true }); await page.insertText(MAIN_C); await sleep(500)
      // hover
      await hover('RCC'); await shot('hover-peripheral')
      await hover('RCC_APB2ENR_IOPCEN'); await shot('hover-macro')
      await hover('led_toggle'); await shot('hover-function')
      // подсказка параметров
      await page.click('.view:not([hidden]) .monaco-editor .view-lines')
      await page.key('End', { ctrl: true }); await page.insertText('\nvoid probe2(void)\n{\n    led_toggle(')
      await sleep(900); await shot('signature-help')
      await page.key('a', { ctrl: true }); await page.insertText(MAIN_C); await sleep(500)
      // Ctrl+T
      await page.click('.view:not([hidden]) .monaco-editor .view-lines')
      await page.key('t', { ctrl: true }); await page.waitExists('[data-testid=pro-symbols-input]'); await page.insertText('led'); await sleep(700); await shot('symbols-picker')
      await page.fill('[data-testid=pro-symbols-input]', 'GPIOC'); await sleep(700); await shot('symbols-picker-gpio')
      await page.key('Escape'); await sleep(200)
      // ссылки
      await clickWord('led_toggle')
      await page.key('F12', { shift: true }); await tryDo(page.waitExists('[data-testid=pro-refs]', { timeout: 6000 })); await shot('references')
      await page.key('Escape'); await sleep(200)
      // переименование
      await clickWord('delay_loop', 1)
      await page.key('F2'); await tryDo(page.waitExists('[data-testid=pro-rename-input]', { timeout: 6000 }))
      await page.fill('[data-testid=pro-rename-input]', 'wait_loop'); await page.key('Enter')
      await tryDo(page.waitExists('[data-testid=pro-rename-list]', { timeout: 6000 })); await shot('rename-preview')
      await page.key('Escape'); await sleep(200)
      await clickWord('GPIOC'); await page.key('F2'); await tryDo(page.waitExists('[data-testid=pro-rename-input]', { timeout: 6000 }))
      await page.fill('[data-testid=pro-rename-input]', 'PORTC'); await page.key('Enter'); await tryDo(page.waitExists('[data-testid=pro-rename-error]', { timeout: 6000 })); await shot('rename-vendor-error')
      await page.key('Escape'); await sleep(200)
      // F12 → заголовок
      await clickWord('GPIOC'); await page.key('F12')
      await tryDo(page.waitFor(`/stm32f1/.test(document.querySelector('[data-testid=tab][aria-selected=true]')?.innerText ?? '')`, { timeout: 8000 }))
      await sleep(600); await shot('definition-header')
      await tryDo(page.click('[data-testid=tab][aria-selected=true] .tab-close'))
      // ассемблер, ld, json
      await openFile('startup_stm32f103xb.s'); await shot('asm')
      if (!(await page.exists('.tree'))) await tryDo(page.click('[data-testid=act-files]'))
      if (!(await page.exists({ sel: '.tree-row', text: 'STM32F103C8T6_FLASH.ld' }))) await tryDo(page.click({ sel: '.tree-row', text: 'linker' }))
      await tryDo(page.click({ sel: '.tree-row', text: 'STM32F103C8T6_FLASH.ld' })); await sleep(600); await shot('ld')
      if (!(await page.exists('.tree'))) await tryDo(page.click('[data-testid=act-files]'))
      await tryDo(page.click({ sel: '.tree-row', text: 'avride.project.json' }))
      await sleep(500)
      const orig = readFileSync(join(sketchbook, 'EdShot', 'avride.project.json'), 'utf8')
      await page.eval(`(() => { const m = window.__avrMonaco; const model = m.editor.getModels().find((x) => /avride\\.project\\.json$/.test(x.uri.path)); model.setValue(${JSON.stringify(orig.replace('"optimization": "Og"', '"optimization": "O9"'))}) })()`)
      await sleep(700)
      await tryDo(page.click('.view:not([hidden]) .monaco-editor .view-lines'))
      await page.eval(`(() => { const e = window.__avrMonaco.editor.getEditors().find((x) => x.getModel() && /avride\\.project\\.json$/.test(x.getModel().uri.path)); const m = e.getModel(); const ln = m.getValue().split('\\n').findIndex((l) => l.includes('O9')) + 1; e.setPosition({ lineNumber: ln, column: 24 }); e.revealLineInCenter(ln) })()`)
      await sleep(600)
      await page.key('F8'); await sleep(900)
      await shot('project-json-error')
      await page.eval(`(() => { const model = window.__avrMonaco.editor.getModels().find((x) => /avride\\.project\\.json$/.test(x.uri.path)); model.setValue(${JSON.stringify(orig)}) })()`)
      await sleep(400)
      await tryDo(page.click('[data-testid=tab][aria-selected=true] .tab-close'))
    }
  }
} finally {
  await app.close()
}
console.log('снимки: ' + out)

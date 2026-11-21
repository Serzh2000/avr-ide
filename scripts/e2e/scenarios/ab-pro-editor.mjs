// Pro-режим, «умный редактор» C/C++: подсказки из заголовков (GPIOA-> → поля, биты регистра), hover, переход F12, Ctrl+T, ссылки, переименование,
// подсветка .s/.ld, диагностика avride.project.json, режим Arduino не затронут. Заголовок устройства — настоящий CMSIS (если задан AVRIDE_CMSIS_DIR
// с кэшем пакетов поддержки) или небольшой заголовок-имитация из scripts/e2e/fixtures.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assert, assertEq, assertIncludes, editorText, openRecent, readText } from '../lib/kit.mjs'
import { sleep } from '../lib/cdp.mjs'

const CMSIS = process.env.AVRIDE_CMSIS_DIR
const proDir = mkdtempSync(join(tmpdir(), 'avride-edpro-'))
if (CMSIS && existsSync(join(CMSIS, 'cmsis-device-f1@v4.3.5'))) {
  mkdirSync(join(proDir, 'pro', 'support'), { recursive: true })
  for (const d of ['cmsis-device-f1@v4.3.5', 'cmsis_core@v5.6.0_cm3']) if (existsSync(join(CMSIS, d))) cpSync(join(CMSIS, d), join(proDir, 'pro', 'support', d), { recursive: true })
}
const REAL = existsSync(join(proDir, 'pro', 'support', 'cmsis-device-f1@v4.3.5', 'Include', 'stm32f103xb.h'))
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'stm32f1xx_mini.h')

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
const LED_H = `#ifndef LED_H
#define LED_H
#include "stm32f1xx.h"

/** Переключить вывод порта */
void led_toggle(GPIO_TypeDef *port, uint32_t pin);

#endif
`
const LED_C = `#include "led.h"

void led_toggle(GPIO_TypeDef *port, uint32_t pin)
{
    port->ODR ^= (1u << pin);
}
`

const suggestText = (page) => page.eval(`(document.querySelector('.suggest-widget.visible')?.innerText ?? '')`)
const status = (page) => page.text('[data-testid=statusbar]')
const lineOf = async (page) => Number(/Стр (\d+)/.exec(await status(page))?.[1] ?? 0)
const cmd = (page, expr) => page.eval(expr)
const closeActiveTab = (page) => page.click('[data-testid=tab][aria-selected=true] .tab-close')
const activeTab = (page) => page.eval(`document.querySelector('[data-testid=tab][aria-selected=true]')?.innerText ?? ''`)

/** Координаты слова в отрисованном редакторе (центр токена с точным текстом); ждёт отрисовки. */
const wordRect = async (page, word, nth = 0) => {
  const expr = `(() => {
    const spans = [...document.querySelectorAll('.view:not([hidden]) .monaco-editor .view-lines span')].filter((s) => s.children.length === 0 && s.textContent.replace(/\u00a0/g, ' ').trim() === ${JSON.stringify(word)})
    const s = spans[${nth}]; if (!s) return null
    const tn = s.firstChild; const i = tn.textContent.indexOf(${JSON.stringify(word)})
    const r = document.createRange(); r.setStart(tn, i); r.setEnd(tn, i + ${word.length})
    const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }
  })()`
  await page.waitFor(expr, { timeout: 6000, what: 'слово ' + word + ' в редакторе' })
  return page.settle(expr, { what: 'положение слова ' + word })
}

const waitIndex = (page, files = 3) => page.waitFor(`window.api.pro.sym('status').then((r) => !!r.ok && r.data.ready && r.data.files >= ${files})`, { timeout: 30000, what: 'индекс символов готов' })
const ensure = (page) => page.eval(`window.api.pro.sym('ensure', { force: true }).then((r) => r.ok && r.data.ready)`)

export default {
  id: 'ab',
  timeout: 240000,
  title: 'Pro: умный редактор — подсказки из CMSIS, hover, F12, Ctrl+T, ссылки, переименование, .s/.ld, avride.project.json; Arduino не затронут',
  env: { AVRIDE_PRO_GCC: 'none', AVRIDE_PRO_DIR: proDir, AVRIDE_PRO_CLANG_FORMAT: join(dirname(fileURLToPath(import.meta.url)), '..', 'fakes', 'fake-clang-format.mjs') },
  files: { 'Blinky/Blinky.ino': 'void setup() {}\nvoid loop() {}\n', 'Blinky/sketch.yaml': 'default_fqbn: arduino:avr:uno\n' },
  projects: ['Blinky'],
  async run({ page, sketchbook, log }) {
    log(REAL ? 'заголовок устройства: настоящий CMSIS из кэша' : 'заголовок устройства: имитация из scripts/e2e/fixtures')
    // 1. Pro-проект F103C8
    await page.waitExists('[data-testid=start-screen]')
    await page.click('[data-testid=mode-pro]')
    await page.click('[data-testid=start-create]')
    await page.waitExists('[data-testid=pro-wizard]')
    await page.fill('[data-testid=pro-wz-search]', 'F103')
    await page.click('[data-testid=pro-wz-chip][data-chip=STM32F103C8T6]')
    await page.fill('[data-testid=wz-name]', 'EdPro')
    await page.waitFor(`!!document.querySelector('[data-testid=wz-create]') && !document.querySelector('[data-testid=wz-create]').disabled`, { what: 'кнопка «Создать»' })
    await page.click('[data-testid=wz-create]')
    await page.waitExists('[data-testid=header][data-mode=pro]', { timeout: 40000 })
    await page.waitFor(`document.querySelector('[data-testid=tab][aria-selected=true]')?.innerText.includes('main.c')`, { what: 'открыт main.c' })
    if (!REAL) {
      await page.waitExists('[data-testid=pb-support]', { timeout: 20000, what: 'карточка скачивания CMSIS' })
      await page.click('[data-testid=pb-later]')
    }
    const proj = join(sketchbook, 'EdPro')
    if (!REAL) {
      // как после установки CMSIS: заголовок устройства в drivers/CMSIS (сторонний код, переименование запрещено)
      mkdirSync(join(proj, 'drivers', 'CMSIS', 'Include'), { recursive: true })
      writeFileSync(join(proj, 'drivers', 'CMSIS', 'Include', 'stm32f1xx.h'), readFileSync(FIXTURE))
    }
    writeFileSync(join(proj, 'include', 'led.h'), LED_H)
    writeFileSync(join(proj, 'src', 'led.c'), LED_C)
    writeFileSync(join(proj, 'src', 'main.c'), MAIN_C)
    // файл main.c изменён на диске: подхватываем (возврат фокуса в окно) и пересобираем индекс
    await page.eval(`window.dispatchEvent(new Event('focus'))`)
    await sleep(400)
    assert(await ensure(page), 'индекс собран')
    await waitIndex(page, 4)
    const stat = await page.eval(`window.api.pro.sym('status').then((r) => r.data)`)
    log(`индекс: ${stat.files} файлов, ${stat.symbols} символов, ${stat.ms} мс (разобрано ${stat.parsed}, из кэша ${stat.cached})`)

    // main.c на диске заменён: окно подхватывает изменения при возврате фокуса
    await page.waitFor(`document.querySelector('.view:not([hidden]) .view-lines')?.textContent.includes('delay_loop')`, { what: 'новый main.c в редакторе' })

    // Язык модели — «avr-c» (не Arduino)
    const lang = await page.eval(`window.__avrMonaco.editor.getModels().filter((m) => /main\\.c$/.test(m.uri.path)).map((m) => m.getLanguageId())[0]`)
    assertEq(lang, 'avr-c', 'язык Pro-C')

    // 2. Автодополнение: GPIOA-> → поля GPIO_TypeDef
    await page.click('.view:not([hidden]) .monaco-editor .view-lines')
    await page.key('End', { ctrl: true })
    await page.insertText('\nvoid probe(void)\n{\n    GPIOA->')
    await sleep(400)
    await page.key(' ', { ctrl: true })
    await page.waitFor(`(() => { const w = document.querySelector('.suggest-widget.visible'); return !!w && /BSRR/.test(w.innerText) && /CRL/.test(w.innerText) })()`, { timeout: 10000, what: 'поля GPIO_TypeDef после GPIOA->' })
    const members = await suggestText(page)
    for (const f of ['CRL', 'CRH', 'IDR', 'ODR', 'BSRR', 'BRR', 'LCKR']) assertIncludes(members, f, 'поле ' + f)
    assert(!/digitalWrite|HIGH/.test(members), 'нет подсказок Arduino')
    await page.key('Escape')
    // после RCC-> — поля RCC_TypeDef, а не GPIO
    await page.insertText('ODR |= GPIO_ODR_ODR1;\n    RCC->')
    await sleep(300)
    await page.key(' ', { ctrl: true })
    await page.waitFor(`(() => { const w = document.querySelector('.suggest-widget.visible'); return !!w && /APB2ENR/.test(w.innerText) })()`, { timeout: 10000, what: 'поля RCC_TypeDef' })
    assert(!/BSRR/.test(await suggestText(page)), 'после RCC-> нет полей GPIO')
    await page.key('Escape')
    // локальная переменная: GPIO_TypeDef *g; g->
    await page.insertText('APB2ENR = 0;\n    GPIO_TypeDef *g = GPIOC;\n    g->')
    await sleep(300)
    await page.key(' ', { ctrl: true })
    await page.waitFor(`(() => { const w = document.querySelector('.suggest-widget.visible'); return !!w && /LCKR/.test(w.innerText) })()`, { timeout: 10000, what: 'поля через локальный указатель g->' })
    await page.key('Escape')
    // биты регистра: GPIOC->ODR |= GPIO_ODR_  → маски именно ODR
    await page.insertText('ODR |= GPIO_ODR_ODR1')
    await sleep(300)
    await page.key(' ', { ctrl: true })
    await page.waitFor(`(() => { const w = document.querySelector('.suggest-widget.visible'); return !!w && /GPIO_ODR_ODR13/.test(w.innerText) })()`, { timeout: 10000, what: 'маски GPIO_ODR_* из заголовка' })
    await page.key('Escape')
    // Pro без Arduino: digitalWrite не предлагается
    await page.insertText(';\n    digitalW')
    await sleep(300)
    await page.key(' ', { ctrl: true })
    await sleep(700)
    assert(!/digitalWrite/.test(await suggestText(page)), 'в Pro нет digitalWrite')
    await page.key('Escape')
    // регистровые сниппеты семейства: F1 → CRL/CRH
    await page.key('a', { ctrl: true })
    await page.insertText(MAIN_C + '\nvoid probe2(void)\n{\n    gpio_ou')
    await sleep(300)
    await page.key(' ', { ctrl: true })
    await page.waitFor(`(() => { const w = document.querySelector('.suggest-widget.visible'); return !!w && /gpio_out/.test(w.innerText) })()`, { timeout: 10000, what: 'сниппет gpio_out' })
    await page.key('Escape')
    // вернуть текст как был
    await page.key('a', { ctrl: true })
    await page.insertText(MAIN_C)
    await page.waitFor(`document.querySelector('.view:not([hidden]) .view-lines')?.textContent.includes('delay_loop')`)

    // 3. Hover: RCC → тип, адрес; led_toggle → doc из заголовка проекта
    const rcc = await wordRect(page, 'RCC')
    assert(rcc, 'слово RCC в редакторе')
    await page.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rcc.x, y: rcc.y })
    await page.waitFor(`(() => { const h = document.querySelector('.monaco-hover:not(.hidden)'); return !!h && /RCC_TypeDef/.test(h.innerText) && /0x40021000/.test(h.innerText) })()`, { timeout: 10000, what: 'hover по RCC: тип и базовый адрес' })
    const led = await wordRect(page, 'led_toggle')
    await page.key('Escape')
    await page.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: led.x + 300, y: led.y + 80 })
    await sleep(300)
    for (const dx of [-40, -20, -6, 0]) { await page.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: led.x + dx, y: led.y }); await sleep(120) }
    try { await page.waitFor(`(() => { const h = document.querySelector('.monaco-hover:not(.hidden)'); return !!h && /led_toggle/.test(h.innerText) && /Переключить вывод порта/.test(h.innerText) })()`, { timeout: 10000, what: 'hover по led_toggle с doc-комментарием' }) } catch (e) { log('hover: ' + (await page.eval(`[...document.querySelectorAll('.monaco-hover')].map((h) => h.className + ' => ' + h.innerText).join(' | ')`)) + ' | led=' + JSON.stringify(led) + ' ' + JSON.stringify(await page.eval(`window.api.pro.sym('hover', { path: 'x', line: 14, col: 12, lineText: '        led_toggle(GPIOC, 13);', before: '' })`))); throw e }
    await page.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 })

    // 4. F12 по GPIOC → определение в заголовке
    const gp = await wordRect(page, 'GPIOC')
    await page.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: gp.x, y: gp.y, button: 'left', clickCount: 1, buttons: 1 })
    await page.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: gp.x, y: gp.y, button: 'left', clickCount: 1 })
    await page.key('F12')
    await page.waitFor(`document.querySelector('[data-testid=tab][aria-selected=true]')?.innerText.includes('.h')`, { timeout: 10000, what: 'F12 открыл заголовок' })
    assertIncludes(await activeTab(page), REAL ? 'stm32f103xb.h' : 'stm32f1xx.h', 'заголовок с определением GPIOC')
    await page.waitFor(`/#define\\s+GPIOC\\s/.test(document.querySelector('.view:not([hidden]) .view-lines')?.textContent.replace(/\\u00a0/g, ' ') ?? '')`, { timeout: 10000, what: 'в редакторе строка #define GPIOC' })
    await closeActiveTab(page)
    await page.waitFor(`document.querySelector('[data-testid=tab][aria-selected=true]')?.innerText.includes('main.c')`, { what: 'вернулись в main.c' })

    // 5. Ctrl+T: поиск символа main
    await page.click('.view:not([hidden]) .monaco-editor .view-lines')
    await page.key('t', { ctrl: true })
    await page.waitExists('[data-testid=pro-symbols-input]')
    await page.insertText('main')
    await page.waitFor(`(() => { const f = document.querySelector('[data-testid=pro-symbols-item]'); return !!f && f.dataset.name === 'main' && f.dataset.kind === 'function' })()`, { timeout: 8000, what: 'main первым в Ctrl+T' })
    await page.key('Enter')
    await page.waitGone('[data-testid=pro-symbols]')
    await page.waitFor(`/Стр 1[0-9],/.test(document.querySelector('[data-testid=statusbar]')?.innerText ?? '')`, { what: 'курсор перешёл на main' })
    // поиск регистра и макроса
    await page.key('t', { ctrl: true })
    await page.insertText('GPIO_ODR_ODR13')
    await page.waitFor(`!![...document.querySelectorAll('[data-testid=pro-symbols-item]')].find((e) => e.dataset.name === 'GPIO_ODR_ODR13')`, { timeout: 8000, what: 'макрос из заголовка в Ctrl+T' })
    await page.key('Escape')

    // Ctrl+Shift+O: символы текущего файла (встроенное окно Monaco по провайдеру символов документа)
    await page.click('.view:not([hidden]) .monaco-editor .view-lines')
    await page.key('o', { ctrl: true, shift: true })
    await page.waitFor(`(() => { const w = [...document.querySelectorAll('.quick-input-widget')].find((e) => e.getBoundingClientRect().height > 0); return !!w && /main/.test(w.innerText) && /delay_loop/.test(w.innerText) })()`, { timeout: 8000, what: 'Ctrl+Shift+O: main и delay_loop в списке символов файла' })
    await page.key('Escape')

    // 6. Ссылки: led_toggle — три файла
    const lr = await wordRect(page, 'led_toggle')
    await page.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: lr.x, y: lr.y, button: 'left', clickCount: 1, buttons: 1 })
    await page.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: lr.x, y: lr.y, button: 'left', clickCount: 1 })
    await page.key('F12', { shift: true })
    await page.waitExists('[data-testid=pro-refs]')
    assert((await page.count('[data-testid=pro-refs-item]')) >= 3, 'ссылки на led_toggle: main.c, led.c (определение), led.h')
    const refsText = await page.text('[data-testid=pro-refs]')
    for (const f of ['main.c', 'led.c', 'led.h']) assertIncludes(refsText, f, 'ссылка в ' + f)
    await page.key('Escape')
    await page.waitGone('[data-testid=pro-refs]')

    // 7. Переименование локальной функции delay_loop (static): предпросмотр → применить
    const dl = await wordRect(page, 'delay_loop', 1)
    await page.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: dl.x, y: dl.y, button: 'left', clickCount: 1, buttons: 1 })
    await page.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dl.x, y: dl.y, button: 'left', clickCount: 1 })
    await page.key('F2')
    await page.waitExists('[data-testid=pro-rename-input]')
    await page.fill('[data-testid=pro-rename-input]', 'wait_loop')
    await page.key('Enter')
    await page.waitExists('[data-testid=pro-rename-list]', { timeout: 8000, what: 'предпросмотр замен' })
    assertIncludes(await page.text('[data-testid=pro-rename]'), '2 замены', 'в предпросмотре 2 замены')
    assertIncludes(await page.text('[data-testid=pro-rename]'), 'main.c', 'файл в предпросмотре')
    // до подтверждения файл не изменён
    assertIncludes(readText(join(proj, 'src', 'main.c')), 'delay_loop', 'до подтверждения диск не менялся')
    await page.click('[data-testid=pro-rename-apply]')
    await page.waitGone('[data-testid=pro-rename]')
    await page.waitFor(`document.querySelector('.view:not([hidden]) .view-lines')?.textContent.includes('wait_loop')`, { timeout: 8000, what: 'в редакторе новое имя' })
    const after = readText(join(proj, 'src', 'main.c'))
    assertIncludes(after, 'static void wait_loop(', 'на диске новое имя')
    assert(!/delay_loop/.test(after), 'старого имени нет')
    assertIncludes(after, 'led_toggle(GPIOC, 13)', 'остальной код цел')
    // переименование стороннего символа запрещено
    const gp2 = await wordRect(page, 'GPIOC')
    await page.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: gp2.x, y: gp2.y, button: 'left', clickCount: 1, buttons: 1 })
    await page.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: gp2.x, y: gp2.y, button: 'left', clickCount: 1 })
    await page.key('F2')
    await page.waitExists('[data-testid=pro-rename-input]')
    await page.fill('[data-testid=pro-rename-input]', 'PORTC')
    await page.key('Enter')
    await page.waitExists('[data-testid=pro-rename-error]', { timeout: 8000 })
    assertIncludes(await page.text('[data-testid=pro-rename-error]'), 'стороннем', 'CMSIS переименовывать нельзя')
    await page.key('Escape')

    // 7б. Форматирование через clang-format (имитатор): Shift+Alt+F заменяет табуляции пробелами
    await page.click('.view:not([hidden]) .monaco-editor .view-lines')
    await page.key('End', { ctrl: true })
    await page.insertText('\n\tint x = 1;   \n')
    await sleep(200)
    await page.key('f', { shift: true, alt: true })
    await page.waitFor(`window.__avrMonaco.editor.getModels().filter((m) => /main\.c$/.test(m.uri.path)).every((m) => m.getValue().includes('    int x = 1;') && !m.getValue().includes('\t'))`, { timeout: 10000, what: 'clang-format заменил табуляцию пробелами' })
    await page.key('s', { ctrl: true })
    await page.waitFor(`!document.querySelector('[data-testid=tab][aria-selected=true] .tab-close.dirty')`, { what: 'main.c сохранён' })
    assert(await page.eval(`window.api.pro.sym('formatter').then((r) => r.ok && r.data.available)`), 'clang-format найден')

    // 7в. Заголовок вне проекта (файлы CMSIS удалены из проекта, остались в кэше пакетов поддержки): F12 открывает его только для чтения
    if (REAL) {
      rmSync(join(proj, 'drivers'), { recursive: true, force: true })
      assert(await ensure(page), 'индекс пересобран без drivers/')
      const g3 = await wordRect(page, 'GPIOC')
      await page.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: g3.x, y: g3.y, button: 'left', clickCount: 1, buttons: 1 })
      await page.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: g3.x, y: g3.y, button: 'left', clickCount: 1 })
      await page.key('F12')
      await page.waitFor(`document.querySelector('[data-testid=tab][aria-selected=true]')?.innerText.includes('stm32f103xb.h')`, { timeout: 10000, what: 'F12 открыл заголовок из кэша пакетов поддержки' })
      await page.waitFor(`window.__avrMonaco.editor.getEditors().some((e) => e.getModel() && /stm32f103xb\.h$/.test(e.getModel().uri.path) && e.getOption(window.__avrMonaco.editor.EditorOption.readOnly))`, { timeout: 8000, what: 'заголовок вне проекта открыт только для чтения' })
      await closeActiveTab(page)
      await page.waitFor(`document.querySelector('[data-testid=tab][aria-selected=true]')?.innerText.includes('main.c')`, { what: 'вернулись в main.c' })
    }

    // 8. Ассемблер, скрипт компоновки и avride.project.json: язык и подсветка
    const langs = await page.eval(`(async () => {
      const m = window.__avrMonaco
      const mk = (name, text, lang) => { const u = m.Uri.parse('inmemory://t/' + name); return m.editor.getModel(u) ?? m.editor.createModel(text, lang, u) }
      const a = mk('a.s', '.syntax unified\\nReset_Handler:\\n  ldr r0, =_estack @ stack\\n  movs r1, #0x20\\n  bl main\\n', 'avr-asm')
      const l = mk('a.ld', 'ENTRY(Reset_Handler)\\nMEMORY { FLASH (rx) : ORIGIN = 0x08000000, LENGTH = 64K }\\n', 'avr-ld')
      const tok = (model) => m.editor.tokenize(model.getValue(), model.getLanguageId()).flat().map((t) => t.type)
      return { asm: [...new Set(tok(a))], ld: [...new Set(tok(l))] }
    })()`)
    for (const t of ['entity.label.asm', 'keyword.asm', 'variable.register.asm', 'comment.asm', 'keyword.mnemonic.asm', 'number.hex.asm']) assert(langs.asm.includes(t), `ассемблер: токен ${t} (есть: ${langs.asm.join(', ')})`)
    for (const t of ['keyword.ld', 'number.hex.ld']) assert(langs.ld.includes(t), `ld: токен ${t} (есть: ${langs.ld.join(', ')})`)

    // avride.project.json: диагностика по validateProject
    const jsonPath = join(proj, 'avride.project.json')
    const orig = readText(jsonPath)
    await page.click({ sel: '.tree-row', text: 'avride.project.json' })
    await page.waitFor(`document.querySelector('[data-testid=tab][aria-selected=true]')?.innerText.includes('avride.project.json')`, { timeout: 8000, what: 'открыт avride.project.json' })
    const bad = orig.replace('"optimization": "Og"', '"optimization": "O9"')
    assert(bad !== orig, 'в файле проекта есть Og')
    await page.eval(`(() => { const m = window.__avrMonaco; const model = m.editor.getModels().find((x) => /avride\\.project\\.json$/.test(x.uri.path)); model.setValue(${JSON.stringify(bad)}) })()`)
    await page.waitFor(`window.__avrMonaco.editor.getModelMarkers({}).some((k) => /optimization/.test(k.message) && k.severity === 8)`, { timeout: 8000, what: 'ошибка optimization в маркерах' })
    const mk = await page.eval(`window.__avrMonaco.editor.getModelMarkers({}).filter((k) => /optimization/.test(k.message)).map((k) => ({ line: k.startLineNumber, msg: k.message }))`)
    const lineNo = bad.split('\n').findIndex((l) => l.includes('O9')) + 1
    assertEq(mk[0].line, lineNo, 'маркер на строке с неверным значением')
    // ошибка синтаксиса
    await page.eval(`(() => { const model = window.__avrMonaco.editor.getModels().find((x) => /avride\\.project\\.json$/.test(x.uri.path)); model.setValue(${JSON.stringify(orig.replace('"name"', 'name"'))}) })()`)
    await page.waitFor(`window.__avrMonaco.editor.getModelMarkers({}).some((k) => /JSON/.test(k.message))`, { timeout: 8000, what: 'ошибка синтаксиса JSON' })
    await page.eval(`(() => { const model = window.__avrMonaco.editor.getModels().find((x) => /avride\\.project\\.json$/.test(x.uri.path)); model.setValue(${JSON.stringify(orig)}) })()`)
    await page.waitFor(`!window.__avrMonaco.editor.getModelMarkers({}).some((k) => /optimization|JSON/.test(k.message))`, { timeout: 8000, what: 'маркеры сняты после исправления' })

    // 9. Режим Arduino: digitalWrite подсказывается как раньше, язык модели arduino
    await page.click('[data-testid=hdr-close-project]')
    await page.waitExists('[data-testid=start-screen]')
    await page.click('[data-testid=mode-arduino]')
    await openRecent({ page }, 'Blinky')
    await page.waitFor(`!!document.querySelector('.view:not([hidden]) .monaco-editor')`)
    await page.click('.view:not([hidden]) .monaco-editor .view-lines')
    await page.key('End', { ctrl: true })
    await page.insertText('\nvoid f() { digitalW')
    await sleep(300)
    await page.key(' ', { ctrl: true })
    await page.waitFor(`(() => { const w = document.querySelector('.suggest-widget.visible'); return !!w && /digitalWrite/.test(w.innerText) })()`, { timeout: 8000, what: 'digitalWrite подсказывается в Arduino' })
    await page.key('Escape')
    const ardLang = await page.eval(`window.__avrMonaco.editor.getModels().filter((m) => /Blinky\\.ino$/.test(m.uri.path)).map((m) => m.getLanguageId())[0]`)
    assertEq(ardLang, 'arduino', 'в Arduino-режиме язык модели arduino')
    // Pro-панели в Arduino-режиме не появляются
    await page.key('t', { ctrl: true })
    await sleep(300)
    assertEq(await page.count('[data-testid=pro-symbols]'), 0, 'Ctrl+T в Arduino ничего не открывает')
  }
}

// Pro-режим: прошивка и отладка через ST-Link НА ИМИТАТОРАХ. Настоящих OpenOCD, GDB и устройств нет: переменные окружения подставляют
// scripts/e2e/fakes/fake-openocd.mjs и fake-gdb.mjs, список ST-Link задан AVRIDE_PRO_PROBES. Ни одна команда не касается железа.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assert, assertEq, assertIncludes } from '../lib/kit.mjs'
import { sleep } from '../lib/cdp.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const FAKES = resolve(HERE, '..', 'fakes')
const WORK = join(tmpdir(), 'avride-y-' + process.pid)
mkdirSync(WORK, { recursive: true })
const LOG = join(WORK, 'calls.jsonl')
const MODE = join(WORK, 'mode.txt')
writeFileSync(MODE, 'ok')
writeFileSync(LOG, '')

const PROJECT = {
  schemaVersion: 1, name: 'FlashTest',
  target: { vendor: 'st', family: 'STM32F1', chip: 'STM32F103C8T6', board: 'Blue Pill', core: 'cortex-m3', memory: { flash: { origin: '0x08000000', size: 65536 }, ram: { origin: '0x20000000', size: 20480 } } },
  sources: ['src'], includes: ['include'], defines: ['STM32F103xB'], linkerScript: 'linker/STM32F103C8T6_FLASH.ld', startupFile: 'startup/startup_stm32f103xb.s',
  configurations: { Debug: { optimization: 'Og', debugLevel: 'g3', defines: ['DEBUG'], extraFlags: [] }, Release: { optimization: 'Os', debugLevel: 'none', defines: ['NDEBUG'], extraFlags: [] } },
  toolchain: { kind: 'arm-none-eabi-gcc' }, programmer: { kind: 'stlink', interface: 'swd', openocdTarget: 'target/stm32f1x.cfg' }
}
const MAIN_C = Array.from({ length: 16 }, (_, i) => `/* строка ${i + 1} */ int line${i + 1}(void) { return ${i + 1}; }`).join('\n') + '\n'
const SVD = `<?xml version="1.0"?><device><name>STM32F103</name><peripherals>
<peripheral><name>GPIOA</name><description>General purpose I/O</description><baseAddress>0x40010800</baseAddress><registers>
<register><name>CRL</name><description>Port configuration register low</description><addressOffset>0x0</addressOffset><fields>
<field><name>MODE0</name><description>Port mode bits</description><bitOffset>0</bitOffset><bitWidth>2</bitWidth></field></fields></register>
<register><name>ODR</name><description>Output data register</description><addressOffset>0xC</addressOffset></register></registers></peripheral></device>`

const calls = () => readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
const ocdRuns = () => calls().filter((c) => c.tool === 'openocd')
const gdbCmds = () => calls().filter((c) => c.tool === 'gdb' && c.cmd).map((c) => c.cmd)
const setMode = (m) => writeFileSync(MODE, m)
const toast = (page) => page.text('[data-testid=toast]')

export default {
  id: 'y',
  timeout: 240000,
  title: 'Pro: прошивка и отладка через ST-Link на имитаторах (прогресс, ошибки, точки останова, шаги, регистры, SVD)',
  files: {
    'FlashTest/avride.project.json': JSON.stringify(PROJECT, null, 2),
    'FlashTest/src/main.c': MAIN_C,
    'FlashTest/include/README.txt': 'x',
    'FlashTest/linker/STM32F103C8T6_FLASH.ld': '/* ld */',
    'FlashTest/startup/startup_stm32f103xb.s': '/* s */',
    'FlashTest/build/Debug/FlashTest.elf': 'FAKE ELF (имитация, не исполняемый файл)'
  },
  projects: ['FlashTest'],
  env: {
    AVRIDE_PRO_OPENOCD: join(FAKES, 'fake-openocd.mjs'),
    AVRIDE_PRO_GDB: join(FAKES, 'fake-gdb.mjs'),
    AVRIDE_PRO_PROBES: JSON.stringify([{ id: '066DFF485054877267163321', kind: 'stlink', name: 'ST-Link V2-1', serial: '066DFF485054877267163321', driver: 'ok', vcp: true }]),
    AVRIDE_FAKE_LOG: LOG,
    AVRIDE_FAKE_MODE_FILE: MODE
  },
  async run({ page, app }) {
    const state = () => page.eval(`document.querySelector('[data-testid=dbg-state]')?.getAttribute('data-state')`)
    const waitState = (s) => page.waitFor(`document.querySelector('[data-testid=dbg-state]')?.getAttribute('data-state') === '${s}'`, { timeout: 15000, what: 'состояние отладки ' + s })
    const cursorToLine = async (n) => { await page.key('g', { ctrl: true }); await sleep(250); await page.insertText(String(n)); await page.key('Enter'); await sleep(250) }

    // 1. Открываем проект: шапка Pro, ST-Link найден, «Прошить» и «Отладка» доступны, «Дальше» ведёт к прошивке
    await page.click({ sel: '[data-testid=start-recent]', text: 'FlashTest' })
    await page.waitExists('[data-testid=header][data-mode=pro]', { timeout: 40000, what: 'шапка Pro' })
    await page.waitFor(`/ST-Link V2-1/.test(document.querySelector('[data-testid=pro-probe]')?.innerText ?? '')`, { what: 'ST-Link в шапке' })
    await page.waitFor(`document.querySelector('[data-testid=pro-flash]').getAttribute('aria-disabled') === 'false'`, { what: 'кнопка «Прошить» доступна' })
    assertEq(await page.eval(`document.querySelector('[data-testid=pro-debug]').getAttribute('aria-disabled')`), 'false', '«Отладка» доступна')
    await page.waitFor(`/Прошейте плату/.test(document.querySelector('[data-testid=pro-next-step]')?.innerText ?? '')`, { what: '«Дальше: прошейте плату»' })
    await page.click('[data-testid=act-project]')
    await page.click('[data-testid=pro-file][data-name="main.c"]')
    await page.waitFor(`!!document.querySelector('.monaco-editor .view-lines')`, { timeout: 20000, what: 'редактор Monaco' })

    // 2. Вкладка «Монитор порта» вернулась, с выбором порта
    assert(await page.exists('[data-testid=btab-monitor]'), 'в Pro есть «Монитор порта»')
    await page.click('[data-testid=btab-monitor]')
    await page.waitExists('[data-testid=pro-portbar]')
    assert(await page.exists('[data-testid=pro-port-select]'), 'выбор порта')
    assertEq(await page.count('[data-testid=btab-plotter]'), 0, 'плоттер Arduino скрыт')

    // 3. Прошивка: ход, итог, командная строка OpenOCD
    await page.click('[data-testid=btab-hw]')
    await page.waitExists('[data-testid=hw-panel]')
    await page.waitFor(`/найден/.test(document.querySelector('[data-testid=hw-openocd]')?.innerText ?? '')`, { what: 'OpenOCD найден' })
    assertEq(await page.count('[data-testid=hw-probe]'), 1, 'в списке один ST-Link')
    assertIncludes(await page.text('[data-testid=hw-panel]'), 'виртуальный COM', 'V2-1: упомянут виртуальный COM-порт')
    await page.click('[data-testid=pro-flash]')
    await page.waitExists('[data-testid=hw-progress]', { timeout: 10000, what: 'ход прошивки' })
    await page.waitExists('[data-testid=hw-done]', { timeout: 15000, what: 'успешный итог' })
    assertIncludes(await page.text('[data-testid=hw-done]'), '2048 байт', 'итог: число байт')
    assertIncludes(await page.text('[data-testid=hw-done]'), 'проверка записи пройдена', 'итог: проверка')
    await page.waitFor(`/Плата прошита/.test(document.querySelector('[data-testid=hw-done]')?.innerText ?? '')`, { what: 'итог прошивки виден в самой панели (отдельного всплывающего сообщения нет)' })
    assert(!/прошит/i.test(await page.eval(`document.querySelector('[data-testid=toast]')?.innerText ?? ''`)), 'сообщение о прошивке не дублирует плашку в открытой вкладке «Прошивка»')
    const run1 = ocdRuns().at(-1).args
    const cmdline = run1.join(' ')
    assertIncludes(cmdline, 'interface/stlink.cfg', 'интерфейс ST-Link')
    assertIncludes(cmdline, 'transport select hla_swd', 'SWD')
    assertIncludes(cmdline, 'adapter serial 066DFF485054877267163321', 'серийный номер')
    assertIncludes(cmdline, 'target/stm32f1x.cfg', 'цель')
    assertIncludes(cmdline, 'adapter speed 1800', 'скорость')
    assert(/program \{[^}]*FlashTest\.elf\} verify reset exit/.test(cmdline), 'команда program для elf: ' + cmdline)
    await page.waitFor(`/Начните отладку/.test(document.querySelector('[data-testid=pro-next-step]')?.innerText ?? '')`, { what: '«Дальше: начните отладку»' })

    // 4. Ошибки с понятными объяснениями и одним главным действием
    const cases = [['nopower', 'no-power', 'Нет питания цели'], ['nodriver', 'no-driver', 'нет драйвера'], ['noprobe', 'no-probe', 'ST-Link не найден'], ['wrongid', 'wrong-target', 'не подходит'], ['verifyfail', 'verify-failed', 'Проверка записи'], ['rdp', 'read-protected', 'защищён от чтения']]
    for (const [mode, kind, title] of cases) {
      setMode(mode)
      await page.click('[data-testid=hw-flash]')
      await page.waitExists(`[data-testid=hw-error][data-kind=${kind}]`, { timeout: 15000, what: 'ошибка ' + kind })
      assertIncludes(await page.text('[data-testid=hw-error]'), title, 'заголовок ошибки ' + kind)
      assertEq(await page.count('[data-testid=hw-error-action]'), 1, 'одно главное действие у ' + kind)
    }
    assertIncludes(await page.text('[data-testid=hw-error]'), 'Стереть всю память', 'при RDP главное действие — стирание')
    // стирание: подтверждение обязательно; отмена ничего не запускает
    const eraseBefore = ocdRuns().filter((c) => c.args.some((a) => /erase_sector/.test(a))).length
    await page.click('[data-testid=hw-erase]')
    await page.waitExists('.modal')
    await page.click({ sel: '.modal button', text: 'Отмена' })
    await page.waitGone('.modal')
    assertEq(ocdRuns().filter((c) => c.args.some((a) => /erase_sector/.test(a))).length, eraseBefore, 'после отмены стирание не запускалось')
    setMode('ok')
    await page.click('[data-testid=hw-erase]')
    await page.waitExists('.modal')
    assertIncludes(await page.text('.modal'), 'безвозвратно', 'в диалоге сказано про необратимость')
    await page.click({ sel: '.modal button', text: 'Стереть всё' })
    await page.waitFor(`/стёрта/.test(document.querySelector('[data-testid=hw-panel]')?.innerText ?? '')`, { what: 'память стёрта (имитация)' })
    assert(ocdRuns().some((c) => c.args.some((a) => /flash erase_sector 0 0 last/.test(a))), 'выполнена команда стирания')
    // параметры: «подключение при сбросе» попадает в командную строку
    await page.eval(`(() => { const s = document.querySelector('[data-testid=hw-resetmode]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 'under-reset'); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
    await page.click('[data-testid=hw-flash]')
    await page.waitExists('[data-testid=hw-done]', { timeout: 15000 })
    assertIncludes(ocdRuns().at(-1).args.join(' '), 'connect_assert_srst', 'режим подключения при сбросе')

    // 5. Точки останова до запуска: F9 на строке 10 и щелчок по полю на строке 12
    await page.click('.monaco-editor .view-lines')
    await cursorToLine(10)
    await page.key('F9')
    await page.waitFor(`document.querySelectorAll('.avr-bp-glyph').length === 1`, { what: 'точка на строке 10 (F9)' })
    const pos = await page.eval(`(() => { const c = [...document.querySelectorAll('.monaco-editor .margin-view-overlays .line-numbers')].find((e) => e.textContent.trim() === '12'); if (!c) return null; const r = c.getBoundingClientRect(); const m = document.querySelector('.monaco-editor .margin').getBoundingClientRect(); return { x: m.left + 10, y: r.top + r.height / 2 } })()`)
    assert(pos, 'нашли строку 12 в редакторе')
    await page.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
    await page.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
    await page.waitFor(`document.querySelectorAll('.avr-bp-glyph').length === 2`, { what: 'точка на строке 12 (щелчок по полю)' })

    // 6. Запуск отладки (F5): остановка в начале main, текущая строка подсвечена, запись в плату НЕ выполнялась
    const writesBefore = ocdRuns().filter((c) => c.args.some((a) => /^program /.test(a))).length
    await page.key('F5')
    await waitState('stopped')
    await page.waitExists('[data-testid=dbg-panel]')
    await page.waitFor(`document.querySelectorAll('.avr-debug-line').length === 1`, { what: 'подсвечена строка остановки' })
    assertEq(ocdRuns().filter((c) => c.args.some((a) => /^program /.test(a))).length, writesBefore, 'запуск отладки не вызывает program')
    const cmds = gdbCmds()
    assert(cmds.some((c) => /^-file-symbol-file/.test(c)), 'символы из ELF')
    assert(cmds.some((c) => /^-target-select extended-remote localhost:\d+/.test(c)), 'подключение к GDB-серверу')
    assert(!cmds.some((c) => /target-download/.test(c)), 'GDB load не вызывался')
    assert(!calls().some((c) => c.WROTE_FLASH), 'запись во Flash не выполнялась')
    assert(ocdRuns().at(-1).args.some((a) => /^gdb_port \d+/.test(a)), 'OpenOCD запущен как GDB-сервер')
    assertEq(await page.count('[data-testid=dbg-bp]'), 0, 'вкладка точек не открыта')
    await page.click({ sel: '.dbg-tabs button', text: 'Точки останова' })
    await page.waitFor(`document.querySelectorAll('[data-testid=dbg-bp]').length === 2`, { what: 'две точки применены в отладчике' })
    await page.click({ sel: '.dbg-tabs button', text: 'Стек' })
    await page.waitFor(`/main/.test(document.querySelector('[data-testid=dbg-stack]')?.innerText ?? '')`, { what: 'стек вызовов' })

    // 7. Продолжить → точка на строке 10; шаг (F10) → 12; шаг → 13 (другая функция)
    await page.key('F5')
    await page.waitFor(`document.querySelector('[data-testid=dbg-state]')?.getAttribute('data-state') === 'stopped' && /точка останова/.test(document.querySelector('[data-testid=dbg-state]').innerText)`, { timeout: 15000, what: 'остановка на точке' })
    await page.key('F10')
    await page.waitFor(`/:12\\b/.test(document.querySelector('[data-testid=dbg-state]')?.innerText ?? '')`, { timeout: 15000, what: 'шаг на строку 12' })
    await page.key('F11')
    await page.waitFor(`/:13\\b/.test(document.querySelector('[data-testid=dbg-state]')?.innerText ?? '')`, { timeout: 15000, what: 'шаг на строку 13' })

    // 8. Данные: стек, переменные и watch, регистры, память, дизассемблер
    assert(/delay_ms/.test(await page.text('[data-testid=dbg-stack]')), 'в стеке функция delay_ms')
    await page.click({ sel: '.dbg-tabs button', text: 'Переменные' })
    await page.waitExists('[data-testid=dbg-var][data-name=counter]')
    assertIncludes(await page.text('[data-testid=dbg-var][data-name=counter]'), '39', 'значение counter')
    await page.fill('[data-testid=dbg-watch-input]', 'counter')
    await page.click('[data-testid=dbg-watch-add]')
    await page.waitFor(`/39/.test(document.querySelector('[data-testid=dbg-watch][data-expr=counter]')?.innerText ?? '')`, { what: 'watch вычислен' })
    await page.fill('[data-testid=dbg-watch-input]', 'nosuch')
    await page.click('[data-testid=dbg-watch-add]')
    await page.waitFor(`/No symbol/.test(document.querySelector('[data-testid=dbg-watch][data-expr=nosuch]')?.innerText ?? '')`, { what: 'ошибка watch показана' })
    await page.click({ sel: '.dbg-tabs button', text: 'Регистры' })
    await page.waitExists('[data-testid=dbg-reg][data-name=pc]')
    assertIncludes(await page.text('[data-testid=dbg-reg][data-name=pc]'), '0x08000134', 'pc')
    assertIncludes(await page.text('[data-testid=dbg-reg][data-name=sp]'), '0x20004FF8', 'sp')
    assert(await page.exists('[data-testid=dbg-reg].changed'), 'изменившийся регистр подсвечен')
    await page.click({ sel: '.dbg-tabs button', text: 'Память' })
    await page.fill('[data-testid=dbg-mem-addr]', '20000000')
    await page.click('[data-testid=dbg-mem-read]')
    await page.waitFor(`document.querySelectorAll('[data-testid=dbg-memrow]').length === 16`, { what: '256 байт памяти' })
    await page.click({ sel: '.dbg-tabs button', text: 'Дизассемблер' })
    await page.waitFor(`document.querySelectorAll('[data-testid=dbg-dis-row]').length >= 4 && /push/.test(document.querySelector('[data-testid=dbg-dis]').innerText)`, { what: 'дизассемблер' })

    // 9. Периферия по SVD: сначала предложение скачать (с подтверждением), затем (файл положен рядом) дерево, чтение и запись только с подтверждением
    await page.click({ sel: '.dbg-tabs button', text: 'Периферия' })
    await page.waitExists('[data-testid=svd-download]', { what: 'предложение скачать SVD' })
    await page.click('[data-testid=svd-download]')
    await page.waitExists('.modal')
    assertIncludes(await page.text('.modal'), 'modm-io/cmsis-svd-stm32', 'в подтверждении назван источник')
    await page.click({ sel: '.modal button', text: 'Отмена' })
    await page.waitGone('.modal')
    mkdirSync(join(app.userData, 'pro-svd'), { recursive: true })
    writeFileSync(join(app.userData, 'pro-svd', 'STM32F103.svd'), SVD)
    await page.click({ sel: '.dbg-tabs button', text: 'Память' })
    await page.click({ sel: '.dbg-tabs button', text: 'Периферия' })
    await page.waitExists('[data-testid=svd-periph][data-name=GPIOA]', { what: 'дерево периферии' })
    await page.click('[data-testid=svd-periph][data-name=GPIOA]')
    await page.waitFor(`document.querySelectorAll('[data-testid=svd-reg]').length === 2`, { what: 'регистры GPIOA' })
    await page.waitFor(`/0x/.test(document.querySelector('[data-testid=svd-reg][data-name=CRL] [data-testid=svd-value]')?.innerText ?? '')`, { what: 'значение CRL прочитано' })
    await page.click({ sel: '[data-testid=svd-reg][data-name=CRL] button', text: 'Развернуть' })
    await page.waitExists('[data-testid=svd-field][data-name=MODE0]')
    const writesBeforeSvd = gdbCmds().filter((c) => /write-memory/.test(c)).length
    await page.click('[data-testid=svd-reg][data-name=CRL] [data-testid=svd-write]')
    await page.waitExists('#dlg-input')
    await page.fill('#dlg-input', '3')
    await page.click({ sel: '.modal button', text: 'Далее' })
    await page.waitFor(`/Записать значение в память/.test(document.querySelector('.modal')?.innerText ?? '')`, { what: 'подтверждение записи' })
    await page.click({ sel: '.modal button', text: 'Отмена' })
    await page.waitGone('.modal')
    assertEq(gdbCmds().filter((c) => /write-memory/.test(c)).length, writesBeforeSvd, 'без подтверждения запись не выполняется')
    await page.click('[data-testid=svd-reg][data-name=CRL] [data-testid=svd-write]')
    await page.waitExists('#dlg-input')
    await page.fill('#dlg-input', '3')
    await page.click({ sel: '.modal button', text: 'Далее' })
    await page.waitFor(`/Записать значение в память/.test(document.querySelector('.modal')?.innerText ?? '')`, { what: 'подтверждение записи (2)' })
    await page.click({ sel: '.modal button', text: 'Записать' })
    await page.waitFor(`document.querySelectorAll('.modal').length === 0`)
    await sleep(300)
    assertEq(gdbCmds().filter((c) => /write-memory/.test(c)).length, writesBeforeSvd + 1, 'после подтверждения запись выполнена один раз')

    // 10. «Загрузить программу в устройство» — только с подтверждением
    await page.click('[data-testid=dbg-load]')
    await page.waitExists('.modal')
    assertIncludes(await page.text('.modal'), 'заменит', 'диалог объясняет замену прошивки')
    await page.click({ sel: '.modal button', text: 'Отмена' })
    await page.waitGone('.modal')
    assert(!calls().some((c) => c.WROTE_FLASH), 'после отмены Flash не записывался')

    // 11. Снимаем точки, продолжаем (программа «работает»), пауза, остановка (Shift+F5)
    await page.click({ sel: '.dbg-tabs button', text: 'Точки останова' })
    await page.click('[data-testid=dbg-bp-remove]')
    await page.waitFor(`document.querySelectorAll('[data-testid=dbg-bp]').length === 1`)
    await page.click('[data-testid=dbg-bp-remove]')
    await page.waitFor(`document.querySelectorAll('.avr-bp-glyph').length === 0`, { what: 'точки сняты с поля редактора' })
    await page.key('F5')
    await waitState('running')
    await page.click('[data-testid=dbg-pause]')
    await waitState('stopped')
    await page.key('F5', { shift: true })
    await page.waitFor(`!document.querySelector('[data-testid=dbg-state]') || document.querySelector('[data-testid=dbg-state]').getAttribute('data-state') === 'off'`, { timeout: 10000, what: 'отладка остановлена' })
    await page.waitFor(`document.querySelectorAll('.avr-debug-line').length === 0`, { what: 'подсветка снята' })
    assert(gdbCmds().includes('-gdb-exit'), 'GDB закрыт корректно')
    assertEq(await page.eval(`document.documentElement.scrollWidth <= window.innerWidth + 1`), true, 'нет горизонтального скролла')
    assertEq(app.consoleErrors.length, 0, 'ошибок в консоли страницы нет: ' + app.consoleErrors.join(' | '))
    assert(existsSync(WORK), 'рабочая папка имитаторов')
  }
}

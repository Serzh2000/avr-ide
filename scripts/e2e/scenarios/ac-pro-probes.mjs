// Pro-режим: программаторы ST-Link / J-Link / CMSIS-DAP и вывод SWO НА ИМИТАТОРАХ. Настоящих OpenOCD и устройств нет: переменные окружения подставляют
// scripts/e2e/fakes/fake-openocd.mjs, список программаторов задан AVRIDE_PRO_PROBES. Ни одна команда не касается железа.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assert, assertEq, assertIncludes, openWorkspaceTool, advanceFlashWizard } from '../lib/kit.mjs'
import { sleep } from '../lib/cdp.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const FAKES = resolve(HERE, '..', 'fakes')
const WORK = join(tmpdir(), 'avride-ac-' + process.pid)
mkdirSync(WORK, { recursive: true })
const LOG = join(WORK, 'calls.jsonl')
const MODE = join(WORK, 'mode.txt')
const SAVED = join(WORK, 'swo-saved.txt')
writeFileSync(MODE, 'ok')
writeFileSync(LOG, '')
writeFileSync(MODE + '.swo', '')

const PROJECT = {
  schemaVersion: 1, name: 'ProbeTest',
  target: { vendor: 'st', family: 'STM32F1', chip: 'STM32F103C8T6', board: 'Blue Pill', core: 'cortex-m3', clock: { hseHz: 8000000, sysclkHz: 72000000 }, memory: { flash: { origin: '0x08000000', size: 65536 }, ram: { origin: '0x20000000', size: 20480 } } },
  sources: ['src'], includes: ['include'], defines: ['STM32F103xB'], linkerScript: 'linker/STM32F103C8T6_FLASH.ld', startupFile: 'startup/startup_stm32f103xb.s',
  configurations: { Debug: { optimization: 'Og', debugLevel: 'g3', defines: ['DEBUG'], extraFlags: [] }, Release: { optimization: 'Os', debugLevel: 'none', defines: ['NDEBUG'], extraFlags: [] } },
  toolchain: { kind: 'arm-none-eabi-gcc' }, programmer: { kind: 'stlink', interface: 'swd', openocdTarget: 'target/stm32f1x.cfg' }
}

// В списке нет ST-Link: проект просит ST-Link, а подключены только J-Link (два, у второго нет WinUSB) и DAPLink
const PROBES = [
  { id: '000601003266', kind: 'jlink', name: 'J-Link', serial: '000601003266', usbId: '1366:0101', driver: 'ok' },
  { id: '000601009999', kind: 'jlink', name: 'J-Link', serial: '000601009999', usbId: '1366:0101', driver: 'missing' },
  { id: '0240000032044E45', kind: 'cmsis-dap', name: 'DAPLink (CMSIS-DAP)', serial: '0240000032044E45', usbId: '0D28:0204', driver: 'ok' }
]

const calls = () => readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
const ocdRuns = () => calls().filter((c) => c.tool === 'openocd')
const setMode = (m) => writeFileSync(MODE, m)

export default {
  id: 'ac',
  timeout: 240000,
  title: 'Pro: программаторы ST-Link, J-Link, CMSIS-DAP (выбор, прошивка, ошибки) и вывод SWO на имитаторах',
  files: {
    'ProbeTest/avride.project.json': JSON.stringify(PROJECT, null, 2),
    'ProbeTest/src/main.c': 'int main(void) { return 0; }\n',
    'ProbeTest/include/README.txt': 'x',
    'ProbeTest/linker/STM32F103C8T6_FLASH.ld': '/* ld */',
    'ProbeTest/startup/startup_stm32f103xb.s': '/* s */',
    'ProbeTest/build/Debug/ProbeTest.elf': 'FAKE ELF (имитация, не исполняемый файл)'
  },
  projects: ['ProbeTest'],
  env: {
    AVRIDE_PRO_OPENOCD: join(FAKES, 'fake-openocd.mjs'),
    AVRIDE_PRO_GDB: join(FAKES, 'fake-gdb.mjs'),
    AVRIDE_PRO_PROBES: JSON.stringify(PROBES),
    AVRIDE_PRO_SWO_SAVE_PATH: SAVED,
    AVRIDE_FAKE_LOG: LOG,
    AVRIDE_FAKE_MODE_FILE: MODE
  },
  async run({ page, sketchbook }) {
    const projectFile = () => JSON.parse(readFileSync(join(sketchbook, 'ProbeTest', 'avride.project.json'), 'utf8'))
    const selectKind = async (kind) => {
      await page.eval(`(() => { const s = document.querySelector('[data-testid=hw-kind]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${JSON.stringify(kind)}); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
      await page.waitFor(`document.querySelector('[data-testid=hw-kind]').value === ${JSON.stringify(kind)}`, { what: 'выбран тип ' + kind })
    }
    const probeText = () => page.text('[data-testid=pro-probe]')

    // 1. Проект просит ST-Link, а его нет: карточка «ST-Link не найден», но найдены другие программаторы с кнопкой переключения
    await page.click({ sel: '[data-testid=start-recent]', text: 'ProbeTest' })
    await page.waitExists('[data-testid=header][data-mode=pro]', { timeout: 40000, what: 'шапка Pro' })
    await page.waitFor(`/не найден/.test(document.querySelector('[data-testid=pro-probe]')?.innerText ?? '') && /ST-Link/.test(document.querySelector('[data-testid=pro-probe]')?.innerText ?? '')`, { what: 'в шапке «ST-Link: не найден»' })
    await openWorkspaceTool(page, 'hw')
    await page.waitExists('[data-testid=hw-panel]')
    await advanceFlashWizard(page)
    await page.waitExists('[data-testid=hw-others]')
    assertIncludes(await page.text('[data-testid=hw-panel]'), 'ST-Link не обнаружен', 'заголовок для ST-Link')
    const opts = await page.eval(`[...document.querySelectorAll('[data-testid=hw-kind] option')].map((o) => o.value + ':' + o.textContent)`)
    assertEq(opts.join('|'), 'stlink:ST-Link|jlink:J-Link|cmsis-dap:CMSIS-DAP', 'три типа программатора в списке')
    assertIncludes(await page.text('[data-testid=hw-others]'), 'J-Link', 'подсказка про найденный J-Link')
    // прошивка без нужного программатора не подставляет чужой
    const before = ocdRuns().length
    assertEq(await page.eval("document.querySelector('[data-testid=hw-next]').disabled"), true, 'без нужного программатора нельзя перейти к записи')
    assertEq(ocdRuns().length, before, 'OpenOCD с чужим программатором не запускался')

    // 2. Переключение на J-Link кнопкой подсказки: тип записан в файл проекта, в списке два J-Link
    await page.click('[data-testid=hw-use-other]')
    await page.waitFor(`document.querySelector('[data-testid=hw-kind]').value === 'jlink'`, { what: 'тип J-Link' })
    assertEq(projectFile().programmer.kind, 'jlink', 'avride.project.json: programmer.kind = jlink')
    assertEq(projectFile().programmer.openocdTarget, 'target/stm32f1x.cfg', 'цель OpenOCD сохранена')
    await page.waitFor(`document.querySelectorAll('[data-testid=hw-probe]').length === 2`, { what: 'два J-Link в списке' })
    await page.waitFor(`/^J-Link/.test(document.querySelector('[data-testid=pro-probe]')?.innerText ?? '')`, { what: 'шапка: J-Link' })
    // Первый — WinUSB, второй — чужой драйвер.
    await advanceFlashWizard(page)

    // 3. Прошивка J-Link: interface/jlink.cfg, SWD, серийный номер
    await page.click('[data-testid=hw-flash]')
    await page.waitExists('[data-testid=hw-done]', { timeout: 20000, what: 'итог прошивки J-Link' })
    let cmd = ocdRuns().at(-1).args.join(' ')
    assertIncludes(cmd, 'interface/jlink.cfg', 'интерфейс J-Link')
    assertIncludes(cmd, 'transport select swd', 'SWD (не hla_swd)')
    assertIncludes(cmd, 'adapter serial 000601003266', 'серийный номер J-Link')
    assert(!/hla_swd|stlink\.cfg/.test(cmd), 'нет настроек ST-Link: ' + cmd)
    assert(/program \{[^}]*ProbeTest\.elf\} verify reset exit/.test(cmd), 'команда program: ' + cmd)

    // 4. Ошибки J-Link: нет устройства, не тот драйвер (по ответу OpenOCD)
    setMode('noprobe')
    await page.click('[data-testid=hw-flash]')
    await page.waitExists('[data-testid=hw-error][data-kind=no-probe]', { timeout: 15000 })
    assertIncludes(await page.text('[data-testid=hw-error]'), 'J-Link не найден', 'ошибка «нет J-Link»')
    setMode('nodriver')
    await page.click('[data-testid=hw-flash]')
    await page.waitExists('[data-testid=hw-error][data-kind=no-driver]', { timeout: 15000 })
    let t = await page.text('[data-testid=hw-error]')
    assertIncludes(t, 'не тот драйвер', 'заголовок про драйвер J-Link')
    assertIncludes(t, 'WinUSB', 'рекомендация про WinUSB')
    assertIncludes(await page.text('[data-testid=hw-driver-steps]'), 'Zadig', 'шаги: Zadig как рекомендация')
    assertIncludes(t, 'IDE ничего не устанавливает', 'драйверы не ставятся автоматически')
    setMode('ok')
    // Второй J-Link без WinUSB: ошибка сразу, OpenOCD не запускается.
    await page.click('[data-testid=hw-back]')
    await page.click({ sel: '[data-testid=hw-probe]', text: '0006010099' })
    await page.waitExists('[data-testid=hw-error][data-kind=no-driver]', { what: 'карточка драйвера для второго J-Link' })
    const n0 = ocdRuns().length
    assertEq(await page.eval("document.querySelector('[data-testid=hw-next]').disabled"), true, 'переход без драйвера недоступен')
    assertEq(ocdRuns().length, n0, 'для J-Link без WinUSB OpenOCD не запускался')
    await page.click({ sel: '[data-testid=hw-probe]', text: '0006010032' })

    // 5. CMSIS-DAP: интерфейс cmsis-dap, SWD, без VID/PID; ошибка «не найден»
    await selectKind('cmsis-dap')
    assertEq(projectFile().programmer.kind, 'cmsis-dap', 'в файле проекта cmsis-dap')
    await page.waitFor(`/DAPLink/.test(document.querySelector('[data-testid=pro-probe]')?.innerText ?? '')`, { what: 'в шапке DAPLink' })
    await advanceFlashWizard(page)
    await page.click('[data-testid=hw-flash]')
    await page.waitExists('[data-testid=hw-done]', { timeout: 20000, what: 'итог прошивки CMSIS-DAP' })
    cmd = ocdRuns().at(-1).args.join(' ')
    assertIncludes(cmd, 'interface/cmsis-dap.cfg', 'интерфейс CMSIS-DAP')
    assertIncludes(cmd, 'transport select swd', 'SWD')
    assertIncludes(cmd, 'adapter serial 0240000032044E45', 'серийный номер DAPLink')
    assert(!/vid_pid/.test(cmd), 'VID/PID не задаётся')
    setMode('noprobe')
    await page.click('[data-testid=hw-flash]')
    await page.waitExists('[data-testid=hw-error][data-kind=no-probe]', { timeout: 15000 })
    assertIncludes(await page.text('[data-testid=hw-error]'), 'CMSIS-DAP не найден', 'ошибка «нет CMSIS-DAP»')
    setMode('ok')

    await page.key('Escape')
    await page.waitGone('[data-testid=hw-panel]')

    // 6. Вкладка SWO: запуск, приём, автопрокрутка, очистка, сохранение, остановка
    await openWorkspaceTool(page, 'swo')
    await page.waitExists('[data-testid=swo-panel]')
    assertEq(await page.eval(`document.querySelector('[data-testid=swo-clock]').value`), '72', 'частота ядра подставлена из проекта (72 МГц)')
    assertEq(await page.eval(`document.querySelector('[data-testid=swo-speed]').value`), '2', 'скорость SWO по умолчанию 2 МГц')
    assertIncludes(await page.eval(`document.querySelector('.swo-help').textContent`), 'PB3', 'в подсказке про вывод SWO')
    await page.click('[data-testid=swo-start]')
    await page.waitFor(`document.querySelector('[data-testid=swo-state]')?.getAttribute('data-state') === 'running'`, { timeout: 15000, what: 'приём SWO запущен' })
    await page.waitFor(`/Привет из SWO/.test(document.querySelector('[data-testid=swo-console]')?.innerText ?? '')`, { timeout: 10000, what: 'текст порта 0 в консоли' })
    const swoCmd = ocdRuns().at(-1).args.join(' ')
    assertIncludes(swoCmd, 'interface/cmsis-dap.cfg', 'SWO идёт через выбранный программатор')
    assertIncludes(swoCmd, '-protocol uart -output :', 'tpiu configure: uart, вывод в TCP')
    assertIncludes(swoCmd, '-traceclk 72000000 -pin-freq 2000000', 'частоты ядра и SWO')
    assertIncludes(swoCmd, 'itm port 0 on', 'порт 0 ITM включён')
    assert(!/program |erase_sector|reset halt/.test(swoCmd), 'SWO ничего не прошивает и не стирает: ' + swoCmd)
    await page.waitFor(`/пакетах/.test(document.querySelector('[data-testid=swo-stats]')?.innerText ?? '') && /другие порты: 1:/.test(document.querySelector('[data-testid=swo-stats]')?.innerText ?? '')`, { what: 'статистика по портам' })
    assertIncludes(await page.text('[data-testid=swo-stats]'), 'переполнений: 1', 'переполнение показано')
    // строки, отправленные «платой» (имитатор забирает их из файла)
    const lines = Array.from({ length: 80 }, (_, i) => `строка ${i + 1}\r\n`).join('')
    writeFileSync(MODE + '.swo', lines)
    await page.waitFor(`/строка 80/.test(document.querySelector('[data-testid=swo-console]')?.innerText ?? '')`, { timeout: 10000, what: 'строки с платы' })
    assertEq(await page.eval(`(() => { const e = document.querySelector('[data-testid=swo-console]'); return e.scrollHeight - e.scrollTop - e.clientHeight < 4 })()`), true, 'автопрокрутка держит последнюю строку')
    assertEq(await page.eval(`document.documentElement.scrollWidth <= window.innerWidth + 1`), true, 'нет горизонтального скролла')
    // прошивка при работающем SWO запрещена понятным сообщением
    const n1 = ocdRuns().length
    await openWorkspaceTool(page, 'hw')
    await advanceFlashWizard(page)
    await advanceFlashWizard(page)
    assertIncludes(await page.text('[data-testid=hw-panel]'), 'приём SWO', 'сообщение об остановке приёма SWO')
    assertEq(await page.eval("document.querySelector('[data-testid=hw-flash]').disabled"), true, 'прошивка при SWO заблокирована')
    assertEq(ocdRuns().length, n1, 'прошивка при SWO не запускалась')
    await page.key('Escape')
    await page.waitGone('[data-testid=hw-panel]')
    // сохранение
    await page.click('[data-testid=swo-save]')
    await sleep(600)
    const saved = readFileSync(SAVED, 'utf8')
    assertIncludes(saved, 'Привет из SWO', 'в файле начало вывода')
    assertIncludes(saved, 'строка 80', 'в файле последняя строка')
    // очистка
    await page.click('[data-testid=swo-clear]')
    await page.waitFor(`!/строка 80/.test(document.querySelector('[data-testid=swo-console]')?.innerText ?? '') && /данных пока нет/.test(document.querySelector('[data-testid=swo-stats]')?.innerText ?? '')`, { what: 'консоль очищена' })
    // остановка
    await page.click('[data-testid=swo-stop]')
    await page.waitFor(`document.querySelector('[data-testid=swo-state]')?.getAttribute('data-state') === 'off'`, { timeout: 10000, what: 'SWO остановлен' })

    // 7. SWO: у цели нет TPIU — карточка с понятным заголовком, приём не запущен; смена частот попадает в командную строку
    setMode('notpiu')
    await page.fill('[data-testid=swo-clock]', '48')
    await page.key('Enter')
    await page.fill('[data-testid=swo-speed]', '1')
    await page.key('Enter')
    await page.click('[data-testid=swo-start]')
    await page.waitExists('[data-testid=swo-panel] [data-testid=hw-error]', { timeout: 15000, what: 'ошибка запуска SWO' })
    assertEq(await page.eval(`document.querySelector('[data-testid=swo-state]')?.getAttribute('data-state')`), 'off', 'приём не запущен')
    assertIncludes(ocdRuns().at(-1).args.join(' '), '-traceclk 48000000 -pin-freq 1000000', 'введённые частоты в командной строке')
    setMode('ok')

    // 8. Обратно на ST-Link через выбор типа: в проекте записан stlink, шапка снова «ST-Link: не найден»
    await openWorkspaceTool(page, 'hw')
    await advanceFlashWizard(page)
    await selectKind('stlink')
    assertEq(projectFile().programmer.kind, 'stlink', 'в файле проекта stlink')
    await page.waitFor(`/ST-Link: не найден/.test(document.querySelector('[data-testid=pro-probe]')?.innerText ?? '')`, { what: 'шапка: ST-Link не найден' })
    assertEq(await probeText(), 'ST-Link: не найден', 'шапка')
  }
}

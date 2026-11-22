// Pro-режим: конфигуратор «Пины и тактирование» на проекте STM32F103C8 (Blue Pill). Всё на диске и в интерфейсе, компилятор не нужен (сборку сгенерированного кода проверяют юнит-тесты compile.test.ts).
// Путь: открыть вкладку из панели «Проект» → создать avride.pins.json → PC13 как выход «LED» → PA10 как вход «BTN» → включить USART1 (PA9/PA10) → конфликт на PA10 →
// выбрать для PA10 функцию USART1_RX (конфликт снят) → тактирование: подбор PLL на 72 МГц, предел APB1 → «Сгенерировать код» с diff для main.c → файлы на диске →
// повторная генерация сохраняет пользовательский код в USER CODE → узкое окно без горизонтального скролла.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assert, assertEq, assertIncludes, readText } from '../lib/kit.mjs'

const PROJECT = {
  schemaVersion: 1, name: 'PinsProj',
  target: { vendor: 'st', family: 'STM32F1', chip: 'STM32F103C8T6', board: 'Blue Pill', core: 'cortex-m3', memory: { flash: { origin: '0x08000000', size: 65536 }, ram: { origin: '0x20000000', size: 20480 } } },
  sources: ['src'], includes: ['include'], defines: ['STM32F103xB'], linkerScript: 'linker/STM32F103C8T6_FLASH.ld', startupFile: 'startup/startup_stm32f103xb.s',
  configurations: { Debug: { optimization: 'Og', debugLevel: 'g3', defines: ['DEBUG'], extraFlags: [] }, Release: { optimization: 'Os', debugLevel: 'none', defines: ['NDEBUG'], extraFlags: [] } },
  toolchain: { kind: 'arm-none-eabi-gcc' }, programmer: { kind: 'stlink', interface: 'swd', openocdTarget: 'target/stm32f1x.cfg' }
}
const MAIN_C = '#include "stm32f1xx.h"\n#include <stdint.h>\n\nint main(void)\n{\n    for (;;) {\n    }\n}\n'

const setSelect = (page, testid, value) => page.eval(`(() => { const s = document.querySelector('[data-testid=${testid}]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
const pinState = (page, pin) => page.eval(`document.querySelector('[data-testid=pin][data-pin=${pin}]')?.getAttribute('data-state')`)
const savedAndGone = async (page) => page.waitFor(`/сохранено в avride/.test(document.querySelector('[data-testid=pins-saved]')?.innerText ?? '')`, { what: 'автосохранение avride.pins.json' })

export default {
  id: 'aa',
  timeout: 150000,
  title: 'Pro: конфигуратор «Пины и тактирование» — выводы, конфликт, тактирование, генерация кода (diff для main.c), пользовательские блоки',
  files: {
    'PinsProj/avride.project.json': JSON.stringify(PROJECT, null, 2),
    'PinsProj/src/main.c': MAIN_C,
    'PinsProj/include/README.txt': 'x',
    'PinsProj/linker/STM32F103C8T6_FLASH.ld': '/* ld */',
    'PinsProj/startup/startup_stm32f103xb.s': '/* s */'
  },
  projects: ['PinsProj'],
  env: { AVRIDE_PRO_GCC: 'none' },
  async run({ page, sketchbook, log }) {
    const proj = join(sketchbook, 'PinsProj')
    await page.waitExists('[data-testid=start-screen]')
    await page.click('[data-testid=mode-pro]')
    await page.click({ sel: '[data-testid=start-recent]', text: 'PinsProj' })
    await page.waitExists('[data-testid=header][data-mode=pro]', { timeout: 40000 })

    // Вход: кнопка в панели «Проект»
    await page.click('[data-testid=act-project]')
    await page.click('[data-testid=pro-open-pins]')
    await page.waitExists('[data-testid=pins-view][data-state=empty]', { what: 'пустое состояние: конфигурации ещё нет' })
    assert(!existsSync(join(proj, 'avride.pins.json')), 'файл не создаётся сам, пока нет команды')
    await page.click('[data-testid=pins-create]')
    await page.waitExists('[data-testid=pins-view][data-state=ready]', { what: 'конфигуратор открыт' })
    assertIncludes(await page.text('[data-testid=pins-chip]'), 'STM32F103C8T6', 'чип проекта')
    assertEq(await page.count('[data-testid=pin]'), 48, 'на схеме LQFP48 — 48 выводов из базы')
    assert(existsSync(join(proj, 'avride.pins.json')), 'avride.pins.json создан')
    assertEq(JSON.parse(readText(join(proj, 'avride.pins.json'))).chip, 'stm32f103c8', 'чип в файле')

    // PC13 — выход с меткой LED
    await page.click('[data-testid=pin][data-pin=PC13]')
    await page.waitExists('[data-testid=pins-inspector][data-pin=PC13]')
    await page.click('[data-testid=pins-func][data-func=gpio-output]')
    await page.fill('[data-testid=pins-label]', 'LED')
    await page.waitFor(`document.querySelector('[data-testid=pin][data-pin=PC13]').dataset.state === 'gpio'`, { what: 'PC13 окрашен как GPIO' })
    await setSelect(page, 'pins-initial', 'high')
    await savedAndGone(page)
    const p1 = JSON.parse(readText(join(proj, 'avride.pins.json')))
    assertEq(p1.pins.PC13.role, 'output', 'роль выхода записана')
    assertEq(p1.pins.PC13.label, 'LED', 'метка записана')
    assertEq(p1.pins.PC13.initial, 'high', 'начальный уровень записан')

    // PA10 — вход «BTN»; затем включаем USART1: PA10 нужен ему как RX → конфликт
    await page.click('[data-testid=pin][data-pin=PA10]')
    await page.click('[data-testid=pins-func][data-func=gpio-input]')
    await page.fill('[data-testid=pins-label]', 'BTN')
    assertEq(await pinState(page, 'PA10'), 'gpio', 'PA10 — GPIO')
    await page.click('[data-testid=pins-periph][data-periph=USART1] [data-testid=pins-periph-toggle]')
    await page.waitExists('[data-testid=pins-inspector][data-periph=USART1]')
    await page.waitFor(`document.querySelector('[data-testid=pin][data-pin=PA10]').dataset.state === 'conflict'`, { what: 'PA10 подсвечен как конфликт' })
    assertEq(await pinState(page, 'PA9'), 'af', 'PA9 — USART1_TX без конфликта')
    await page.waitExists({ sel: '[data-testid=pins-issue-row][data-code=pin-busy]', text: 'PA10' })
    const busy = await page.text('[data-testid=pins-issue-row][data-code=pin-busy]')
    assertIncludes(busy, 'USART1_RX', 'в сообщении названа вторая роль')
    assertIncludes(await page.text('[data-testid=pins-view]'), 'Ошибок: 1', 'счётчик ошибок в шапке')
    // подсказка при наведении
    await page.eval(`(() => { const g = document.querySelector('[data-testid=pin][data-pin=PA10]'); const r = g.getBoundingClientRect(); g.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.x + 4, clientY: r.y + 4 })) })()`)
    await page.waitExists('[data-testid=pin-tip]')
    assertIncludes(await page.text('[data-testid=pin-tip]'), 'Конфликт', 'подсказка к выводу с конфликтом')
    await page.eval(`document.querySelector('[data-testid=pin][data-pin=PA10]').dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))`)
    // генерация при конфликте невозможна и объясняет почему
    await page.click('[data-testid=pins-generate]')
    await page.waitExists('[data-testid=pins-gen-blocked]')
    assertIncludes(await page.text('[data-testid=pins-gen-blocked]'), 'ошибки', 'причина отказа')
    await page.key('Escape')
    await page.waitGone('[data-testid=pins-gen]')
    // решение: выбрать для PA10 функцию USART1_RX (роль GPIO снимается)
    await page.click('[data-testid=pin][data-pin=PA10]')
    await page.click('[data-testid=pins-func][data-func=USART1_RX]')
    await page.waitFor(`document.querySelector('[data-testid=pin][data-pin=PA10]').dataset.state === 'af'`, { what: 'конфликт снят' })
    assertIncludes(await page.text('[data-testid=pins-view]'), 'Без конфликтов', 'в шапке «Без конфликтов»')

    // защищённый вывод: SWDIO (PA13) — подтверждение
    await page.click('[data-testid=pin][data-pin=PA13]')
    await page.waitExists('[data-testid=pins-guard]')
    assertIncludes(await page.text('[data-testid=pins-guard]'), 'SWD', 'вывод SWD помечен')
    await page.click('[data-testid=pins-func][data-func=gpio-output]')
    await page.waitExists('[data-testid=dialog], .dlg', { what: 'диалог подтверждения' })
    assertIncludes(await page.text('.dlg'), 'защищённый вывод', 'вопрос о защищённом выводе')
    await page.click({ sel: '.dlg button', text: 'Отмена' })
    assertEq(await pinState(page, 'PA13'), 'protected', 'после отказа PA13 остался свободным и защищённым')

    // таблица пинов
    await page.click({ sel: '[role=tab]', text: 'Таблица выводов', within: '.pc-tabs' })
    await page.waitExists('[data-testid=pins-table]')
    const rowPc13 = await page.text('[data-testid=pins-row][data-pin=PC13]')
    assertIncludes(rowPc13, 'LED', 'в таблице метка LED')
    assertIncludes(await page.text('[data-testid=pins-row][data-pin=PA10]'), 'USART1_RX', 'в таблице функция PA10')
    assertIncludes(await page.text('[data-testid=pins-row][data-pin=PA9]'), 'USART1_TX', 'в таблице функция PA9')

    // тактирование: подбор PLL на 72 МГц от HSE 8 МГц
    await page.click({ sel: '[role=tab]', text: 'Тактирование', within: '.pc-tabs' })
    await page.waitExists('[data-testid=pins-clock]')
    assertIncludes(await page.text('[data-testid=ck-val-sys]'), '8 МГц', 'по умолчанию SYSCLK = HSI 8 МГц')
    await setSelect(page, 'ck-pllsrc', 'hse')
    await page.fill('[data-testid=ck-target]', '72')
    await page.click('[data-testid=ck-auto]')
    await page.waitFor(`document.querySelector('[data-testid=ck-val-sys]').innerText.includes('72')`, { what: 'SYSCLK = 72 МГц после подбора' })
    assertEq(await page.text('[data-testid=ck-latency]'), '2', 'wait states Flash = 2')
    assertIncludes(await page.text('[data-testid=ck-val-apb1]'), '36', 'PCLK1 = 36 МГц')
    assertIncludes(await page.text('[data-testid=ck-checks]'), 'в пределах', 'пределы соблюдены')
    // предел APB1 ≤ 36 МГц: делитель 1 → ошибка и подсвеченный блок
    await setSelect(page, 'ck-apb1', '1')
    await page.waitExists('[data-testid=ck-issue]')
    assertIncludes(await page.text('[data-testid=ck-checks]'), 'APB1', 'ошибка называет шину')
    assert(await page.exists('[data-testid=ck-node][data-node=apb1].bad'), 'блок APB1 подсвечен')
    await setSelect(page, 'ck-apb1', '2')
    await page.waitFor(`!document.querySelector('[data-testid=ck-issue]')`, { what: 'ошибка предела снята' })
    // предел частоты HSE
    await page.fill('[data-testid=ck-hse]', '30')
    await page.waitExists('[data-testid=ck-issue]')
    assertIncludes(await page.text('[data-testid=ck-checks]'), 'HSE', 'HSE 30 МГц вне допустимых 4–16')
    await page.fill('[data-testid=ck-hse]', '8')
    await page.waitFor(`!document.querySelector('[data-testid=ck-issue]')`, { what: 'частота HSE снова в пределах' })
    await savedAndGone(page)
    const clk = JSON.parse(readText(join(proj, 'avride.pins.json'))).clock
    assertEq(clk.source, 'pll', 'источник PLL записан')
    assertEq(clk.pll.mul, 9, 'множитель PLL = 9')
    assertEq(clk.apb1Div, 2, 'делитель APB1 = 2')

    // генерация кода
    await page.click('[data-testid=pins-generate]')
    await page.waitExists('[data-testid=pins-gen-files]', { what: 'план генерации' })
    assertEq(await page.count('[data-testid=pins-gen-file]'), 8, 'восемь файлов: board, clock, gpio, uart (.c и .h)')
    for (const f of ['src/gpio.c', 'include/gpio.h', 'src/clock.c', 'include/clock.h', 'src/uart.c', 'include/uart.h', 'src/board.c', 'include/board.h']) {
      assert(await page.exists(`[data-testid=pins-gen-file][data-path="${f}"][data-status=new]`), `в плане новый файл ${f}`)
    }
    await page.waitExists('[data-testid=pins-gen-diff]')
    const diff = await page.text('[data-testid=pins-gen-diff]')
    assertIncludes(diff, 'board_init();', 'diff main.c: вызов board_init()')
    assertIncludes(diff, '#include "board.h"', 'diff main.c: include')
    assert(!existsSync(join(proj, 'src', 'gpio.c')), 'до подтверждения файлы не записаны')
    assertEq(readText(join(proj, 'src', 'main.c')), MAIN_C, 'main.c до подтверждения не изменён')
    await page.click('[data-testid=pins-gen-confirm]')
    await page.waitExists('[data-testid=pins-gen-result]', { timeout: 20000 })
    assertIncludes(await page.text('[data-testid=pins-gen-result]'), 'Готово', 'итог генерации')

    const gpio = readText(join(proj, 'src', 'gpio.c'))
    assertIncludes(gpio, 'СГЕНЕРИРОВАНО AVR IDE', 'отметка «сгенерировано» в gpio.c')
    assertIncludes(gpio, 'GPIOC->BSRR', 'начальный уровень светодиода')
    assertIncludes(gpio, 'gpio_cfg(GPIOC, 13u, 0x2u)', 'PC13 — выход, 2 МГц')
    assertIncludes(gpio, 'gpio_cfg(GPIOA, 9u, 0xBu)', 'PA9 — USART1_TX')
    assertIncludes(gpio, 'gpio_cfg(GPIOA, 10u, 0x4u)', 'PA10 — USART1_RX')
    assertIncludes(readText(join(proj, 'include', 'gpio.h')), '#define LED_PORT  GPIOC', 'имя LED_PORT из метки')
    const clock = readText(join(proj, 'src', 'clock.c'))
    assertIncludes(clock, '(9u - 2u) << RCC_CFGR_PLLMULL_Pos', 'множитель PLL ×9')
    assertIncludes(clock, 'FLASH_ACR_PRFTBE | 2u', 'два такта ожидания Flash')
    assertIncludes(readText(join(proj, 'include', 'clock.h')), '#define CLOCK_SYSCLK_HZ  72000000u', 'частота SYSCLK')
    assertIncludes(readText(join(proj, 'src', 'uart.c')), 'USART1->BRR', 'USART1 настроен')
    assertIncludes(readText(join(proj, 'src', 'board.c')), 'SysTick_Config', 'SysTick')
    const main = readText(join(proj, 'src', 'main.c'))
    assertIncludes(main, '#include "board.h"', 'main.c: include board.h')
    assertIncludes(main, 'board_init();', 'main.c: вызов board_init()')
    assert(main.indexOf('board_init();') > main.indexOf('int main'), 'вызов внутри main')
    const pj = JSON.parse(readText(join(proj, 'avride.pins.json')))
    assertEq(pj.peripherals.USART1.signals.USART1_TX, 'PA9', 'файл: USART1_TX на PA9')
    assertEq(pj.peripherals.USART1.signals.USART1_RX, 'PA10', 'файл: USART1_RX на PA10')
    await page.key('Escape')
    await page.waitGone('[data-testid=pins-gen]')

    // пользовательский код в блоке сохраняется при повторной генерации и изменении конфигурации
    writeFileSync(join(proj, 'src', 'gpio.c'), gpio.replace('/* USER CODE BEGIN gpio_init_end */\n\n    /* USER CODE END gpio_init_end */', '/* USER CODE BEGIN gpio_init_end */\n    /* мой код после инициализации */\n    /* USER CODE END gpio_init_end */'), 'utf8')
    await page.eval(`window.dispatchEvent(new Event('focus'))`)
    await page.click({ sel: '[role=tab]', text: 'Выводы', within: '.pc-tabs' })
    await page.click('[data-testid=pin][data-pin=PC13]')
    await page.fill('[data-testid=pins-label]', 'STATUS')
    await savedAndGone(page)
    await page.click('[data-testid=pins-generate]')
    await page.waitExists('[data-testid=pins-gen-files]')
    assert(await page.exists('[data-testid=pins-gen-file][data-path="src/gpio.c"][data-status=changed]'), 'gpio.c обновится')
    assert(await page.exists('[data-testid=pins-gen-file][data-path="src/clock.c"][data-status=same]'), 'clock.c без изменений')
    assertIncludes(await page.text('[data-testid=pins-gen-file][data-path="src/gpio.c"]'), 'gpio_init_end', 'сохранён пользовательский блок')
    assert(await page.exists('[data-testid=pins-gen-main-same]'), 'main.c уже вызывает board_init() — менять не нужно')
    await page.click('[data-testid=pins-gen-confirm]')
    await page.waitExists('[data-testid=pins-gen-result]', { timeout: 20000 })
    const gpio2 = readText(join(proj, 'src', 'gpio.c'))
    assertIncludes(gpio2, '/* мой код после инициализации */', 'пользовательский код не затёрт')
    assertIncludes(readText(join(proj, 'include', 'gpio.h')), 'STATUS_PORT', 'новая метка в gpio.h')
    assert(!readText(join(proj, 'include', 'gpio.h')).includes('LED_PORT'), 'старой метки нет')
    await page.key('Escape')
    await page.waitGone('[data-testid=pins-gen]')

    // узкое окно: без горизонтального скролла, схема и инспектор доступны
    await page.setWindowSize(760, 700)
    await page.waitFor(`document.documentElement.scrollWidth <= window.innerWidth + 1`, { what: 'нет горизонтального скролла при 760 px' })
    assert(await page.exists('[data-testid=pins-package]'), 'схема корпуса видна при 760 px')
    await page.setWindowSize(1280, 800)
    log('конфигуратор: выводы, конфликт, тактирование, генерация и пользовательские блоки проверены')
  }
}

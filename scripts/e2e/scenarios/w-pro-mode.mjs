import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { assert, assertEq, assertIncludes, readText } from '../lib/kit.mjs'

export default {
  id: 'w',
  timeout: 120000,
  env: { AVRIDE_PRO_GCC: 'none' },
  title: 'Типы проектов: CircuitPython, создание STM32, открытие Arduino и STM32, повреждённый манифест',
  files: { 'Blinky/Blinky.ino': 'void setup() {}\nvoid loop() {}\n', 'Blinky/sketch.yaml': 'default_fqbn: arduino:avr:uno\n', 'Broken/avride.project.json': '{' },
  projects: ['Blinky', 'Broken'],
  async run({ page, sketchbook }) {
    // 1. Стартовый экран предлагает тип проекта и отдельный путь для одного Python-файла.
    await page.waitExists('[data-testid=start-screen]')
    assertEq(await page.count('[data-testid=mode-switch]'), 0, 'глобального переключателя нет')
    assertEq(await page.count('.start-actions button'), 2, 'на старте две кнопки проектов')
    await page.click('[data-testid=start-create]')
    await page.waitExists('[data-testid=project-kind-arduino]')
    await page.click('[data-testid=project-kind-circuitpython]')
    await page.waitExists('[data-testid=circuitpython]')
    await page.key('Escape')
    await page.waitGone('[data-testid=circuitpython]')

    // 2. Мастер: кристалл STM32F103C8T6 (Blue Pill), имя, создание
    await page.click('[data-testid=start-create]')
    await page.click('[data-testid=project-kind-stm32]')
    await page.waitExists('[data-testid=pro-wizard]')
    assertEq(await page.count('[data-testid=wz-board]'), 0, 'мастер Pro не показывает платы Arduino')
    await page.fill('[data-testid=pro-wz-search]', 'F103')
    await page.waitExists('[data-testid=pro-wz-chip][data-chip=STM32F103C8T6]')
    await page.click('[data-testid=pro-wz-chip][data-chip=STM32F103C8T6]')
    await page.fill('[data-testid=wz-name]', 'BluePillBlink')
    await page.waitFor(`!!document.querySelector('[data-testid=wz-create]') && !document.querySelector('[data-testid=wz-create]').disabled`, { what: 'кнопка «Создать» доступна' })
    await page.click('[data-testid=wz-create]')
    await page.waitExists('[data-testid=header][data-mode=pro]', { timeout: 40000, what: 'шапка Pro-режима' })
    await page.waitFor(`document.querySelector('[data-testid=tab][aria-selected=true]')?.innerText.includes('main.c')`, { what: 'во вкладке открыт main.c' })

    // Файлов CMSIS ещё нет: после создания проекта IDE предлагает их скачать (подтверждение пользователя); пока отказываемся
    await page.waitExists('[data-testid=pb-support]', { timeout: 20000, what: 'карточка скачивания файлов CMSIS' })
    await page.click('[data-testid=pb-later]')
    await page.waitGone('[data-testid=pb-support]')

    // 3. Структура на диске
    const proj = join(sketchbook, 'BluePillBlink')
    for (const rel of ['avride.project.json', 'src/main.c', 'include', 'startup/startup_stm32f103xb.s', 'linker/STM32F103C8T6_FLASH.ld', '.gitignore', 'README.md']) assert(existsSync(join(proj, rel)), 'создан ' + rel)
    const json = JSON.parse(readText(join(proj, 'avride.project.json')))
    assertEq(json.schemaVersion, 1, 'версия схемы')
    assertEq(json.target.chip, 'STM32F103C8T6', 'кристалл в файле проекта')
    assertEq(json.target.core, 'cortex-m3', 'ядро')
    assertEq(json.programmer.kind, 'stlink', 'программатор')
    assertIncludes(readText(join(proj, 'src/main.c')), 'stm32f1xx.h', 'main.c подключает CMSIS')

    // 4. Шапка: конфигурация, цель, программатор; кнопки «ещё не реализовано»; нет плат и портов Arduino
    await page.waitFor(`/STM32F103C8/.test(document.querySelector('[data-testid=pro-target]')?.innerText ?? '')`, { what: 'цель в шапке' })
    assertEq(await page.eval(`document.querySelector('[data-testid=pro-config]').value`), 'Debug', 'конфигурация по умолчанию')
    assertIncludes(await page.text('[data-testid=pro-programmer]'), 'ST-Link', 'программатор в шапке')
    assertEq(await page.count('[data-testid=hdr-board], [data-testid=hdr-port], [data-testid=hdr-verify], [data-testid=hdr-upload]'), 0, 'в шапке Pro нет плат и портов Arduino')
    await page.waitFor(`document.querySelector('[data-testid=pro-build]').getAttribute('aria-disabled') === 'false'`, { what: '«Собрать» доступна: провайдер сборки подключён' })
    await page.waitFor(`document.querySelector('[data-testid=pro-flash]').getAttribute('aria-disabled') === 'false'`, { what: '«Прошить» доступна: провайдер программатора подключён' })
    await page.click('[data-testid=pro-build]')
    await page.waitExists('[data-testid=pb-toolchain]', { what: 'карточка «Установить компилятор ARM» (компилятора в тестовой среде нет)' })
    await page.click('[data-testid=pb-later]')
    assertEq(await page.text('[data-testid=hdr-title]'), 'BluePillBlink', 'имя проекта в шапке')

    // 5. Боковая панель: Pro-разделы есть, Arduino-разделов нет
    for (const id of ['files', 'search', 'project', 'chips', 'settings']) assert(await page.exists(`[data-testid=act-${id}]`), 'есть раздел ' + id)
    for (const id of ['examples', 'boards', 'libs', 'ref', 'ui']) assertEq(await page.count(`[data-testid=act-${id}]`), 0, 'нет раздела Arduino ' + id)
    await page.click('[data-testid=act-project]')
    await page.waitExists('[data-testid=pro-project]')
    await page.waitExists('[data-testid=pro-file][data-name="main.c"]')
    for (const g of ['sources', 'includes', 'startup', 'linker', 'docs', 'configs', 'targets']) assert(await page.exists(`[data-testid=pro-${g}]`), 'группа ' + g)
    assertEq(await page.count('[data-testid=pro-cfg]'), 2, 'конфигурации Debug и Release')
    await page.click('[data-testid=pro-cfg][data-name=Release]')
    await page.waitFor(`document.querySelector('[data-testid=pro-config]').value === 'Release'`, { what: 'выбор конфигурации в панели меняет шапку' })
    await page.click('[data-testid=act-chips]')
    await page.waitFor(`document.querySelectorAll('[data-testid=pro-chip-item]').length >= 5`, { what: 'список чипов и плат' })
    await page.click('[data-testid=act-web]')
    await page.waitExists('[data-testid=wd-publish]', { what: 'веб-дизайнер доступен для STM32 в автономном режиме' })

    // 6. Старое сохранённое значение Pro не переключает интерфейс после перезапуска.
    await page.click('[data-testid=hdr-close-project]')
    await page.waitExists('[data-testid=start-screen]')
    await new Promise((r) => setTimeout(r, 500))
    await page.eval(`localStorage.setItem('avride.pro.v1', JSON.stringify({proMode:true, config:'Release'})); location.reload()`)
    await page.waitExists('[data-testid=start-screen]', { timeout: 20000 })
    await page.click('[data-testid=start-create]')
    await page.waitExists('[data-testid=project-kind-dialog]')
    await page.key('Escape')
    await page.waitGone('[data-testid=project-kind-dialog]')

    // 7. Arduino-скетч открывается в своей рабочей области.
    await page.click({ sel: '[data-testid=start-recent]', text: 'Blinky' })
    await page.waitExists('[data-testid=header]:not([data-mode=pro])', { timeout: 40000, what: 'шапка Arduino после открытия скетча' })
    assert(await page.exists('[data-testid=hdr-board]'), 'в шапке снова плата Arduino')
    assert(await page.exists('[data-testid=act-examples]'), 'вернулись разделы Arduino')
    assertEq(await page.count('[data-testid=act-project]'), 0, 'Pro-разделов нет')

    // 8. STM32 определяется по манифесту, настройки сборки доступны без переключателя.
    await page.click('[data-testid=hdr-close-project]')
    await page.waitExists('[data-testid=start-screen]')
    await page.click({ sel: '[data-testid=start-recent]', text: 'BluePillBlink' })
    await page.waitExists('[data-testid=header][data-mode=pro]', { timeout: 40000, what: 'шапка Pro после открытия проекта STM32' })
    await page.click('[data-testid=act-settings]')
    await page.waitExists('[data-testid=settings-toolchain]')
    assertEq(await page.count('[data-testid=mode-switch]'), 0, 'в настройках доступны инструменты без ручного переключения')
    assert(await page.eval(`document.documentElement.scrollWidth <= window.innerWidth + 1`), 'нет горизонтального скролла')

    // 9. Ошибка манифеста остаётся доступной в правильной оболочке.
    await page.click('[data-testid=hdr-close-project]')
    await page.waitExists('[data-testid=start-screen]')
    await page.click({ sel: '[data-testid=start-recent]', text: 'Broken' })
    await page.waitExists('[data-testid=header][data-mode=pro]')
    await page.waitFor(`document.querySelector('[data-testid=pro-noproject]')?.innerText === 'Файл проекта с ошибкой'`, { what: 'ошибка манифеста STM32' })
  }
}

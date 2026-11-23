// Pro-режим, сборка: состояния интерфейса БЕЗ реальной сборки (компилятор в тестовой среде «не установлен»: AVRIDE_PRO_GCC=none).
// Проверяется: карточка установки компилятора (размер, источник, SHA-256), отказ при несовпадении суммы на локальном сервере, настройки,
// вкладка «Размер», редактор конфигураций (запись в avride.project.json), экспорт Makefile/CMake (в том числе защита чужих файлов), создание скрипта компоновки.
// Реальную сборку на трёх чипах проверяет сценарий xf (full).
import { createServer } from 'node:http'
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assert, assertEq, assertIncludes, readText, openWorkspaceTool } from '../lib/kit.mjs'

// Локальный «сервер архива»: отдаёт мусор, SHA-256 которого не совпадёт с записанным в приложении
// Первый запрос — мусор целиком (проверка суммы), следующие — бесконечно медленная отдача (проверка отмены)
let hits = 0
const server = createServer((_req, res) => {
  if (hits++ === 0) { res.writeHead(200, { 'content-type': 'application/zip' }); res.end(Buffer.alloc(4096, 7)); return }
  res.writeHead(200, { 'content-type': 'application/zip', 'content-length': '100000000' })
  const t = setInterval(() => res.write(Buffer.alloc(64, 1)), 50)
  res.on('close', () => clearInterval(t))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
server.unref()

const setSelect = (page, testid, value) => page.eval(`(() => { const s = document.querySelector('[data-testid=${testid}]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
const noOverflow = (page) => page.eval(`document.documentElement.scrollWidth <= window.innerWidth + 1`)

export default {
  id: 'x',
  timeout: 180000,
  title: 'Pro: сборка без компилятора — карточка установки, настройки, «Размер», конфигурации, экспорт, скрипт компоновки',
  env: { AVRIDE_PRO_GCC: 'none', AVRIDE_PRO_TOOLCHAIN_URL: `http://127.0.0.1:${server.address().port}/arm.zip` },
  async run({ page, sketchbook, app, log }) {
    // Проект STM32F103C8 через мастер
    await page.waitExists('[data-testid=start-screen]')
    await page.click('[data-testid=start-create]')
    await page.click('[data-testid=project-kind-stm32]')
    await page.waitExists('[data-testid=pro-wizard]')
    await page.fill('[data-testid=pro-wz-search]', 'F103')
    await page.click('[data-testid=pro-wz-chip][data-chip=STM32F103C8T6]')
    await page.fill('[data-testid=wz-name]', 'BuildUi')
    await page.waitFor(`!!document.querySelector('[data-testid=wz-create]') && !document.querySelector('[data-testid=wz-create]').disabled`, { what: 'кнопка «Создать»' })
    await page.click('[data-testid=wz-create]')
    await page.waitExists('[data-testid=header][data-mode=pro]', { timeout: 40000 })
    const proj = join(sketchbook, 'BuildUi')

    // Файлов CMSIS ещё нет: сразу после создания предлагается скачать (с источником, размером и проверкой)
    await page.waitExists('[data-testid=pb-support]', { timeout: 20000, what: 'карточка скачивания файлов CMSIS после создания проекта' })
    const sf = await page.text('[data-testid=pb-support] [data-testid=pb-facts]')
    assertIncludes(sf, 'github.com/STMicroelectronics/cmsis-device-f1', 'источник — репозиторий ST')
    assertIncludes(sf, 'SHA-1', 'проверка по git SHA-1')
    assertIncludes(sf, 'Apache-2.0', 'лицензия')
    await page.click('[data-testid=pb-later]')
    await page.waitGone('[data-testid=pb-support]')

    // Мастер создал настоящий скрипт компоновки по карте памяти, а startup — заготовка до скачивания CMSIS
    const ld = readText(join(proj, 'linker/STM32F103C8T6_FLASH.ld'))
    assertIncludes(ld, 'ENTRY(Reset_Handler)', 'скрипт компоновки создан')
    assertIncludes(ld, 'LENGTH = 65536', 'размер Flash из базы чипов')
    assertIncludes(readText(join(proj, 'startup/startup_stm32f103xb.s')), 'AVRIDE-PLACEHOLDER', 'startup — заготовка до скачивания')
    const json0 = JSON.parse(readText(join(proj, 'avride.project.json')))
    assert(json0.includes.includes('drivers/CMSIS/Include'), 'в includes есть drivers/CMSIS/Include')
    assertEq(json0.defines[0], 'STM32F103xB', 'макрос устройства из базы чипов')

    // Нижняя панель «Размер» до первой сборки: пусто, одно главное действие
    await openWorkspaceTool(page, 'size')
    await page.waitExists('[data-testid=size-empty]')
    assert(await page.exists('[data-testid=size-build]'), 'в пустой вкладке «Размер» есть кнопка «Собрать»')
    await openWorkspaceTool(page, 'output')
    assert(await page.exists('[data-testid=output-build]'), 'в пустом «Выводе» есть кнопка «Собрать»')

    // Кнопка «Собрать»: компилятора нет → карточка установки с размером, источником и проверкой
    await page.click('[data-testid=pro-build]')
    await page.waitExists('[data-testid=pb-toolchain]', { what: 'карточка установки компилятора' })
    const facts = await page.text('[data-testid=pb-facts]')
    assertIncludes(facts, 'github.com', 'источник — GitHub')
    assertIncludes(facts, '308 МБ', 'размер скачивания')
    assertIncludes(facts, 'SHA-256', 'проверка SHA-256')
    assertIncludes(facts, 'GPL', 'лицензия')
    assert(await page.exists('[data-testid=pb-pick]'), 'можно указать папку с готовым компилятором')
    assert(await noOverflow(page), 'карточка без горизонтального скролла')
    // 760 px
    await page.setWindowSize(760, 700)
    const ov = await page.eval(`(() => { const w = innerWidth; return [...document.querySelectorAll('.dlg, .dlg *')].filter((e) => e.getBoundingClientRect().right > w + 1 && e.getBoundingClientRect().width > 0).slice(0, 5).map((e) => e.tagName + '.' + String(e.className).slice(0, 40) + ':' + Math.round(e.getBoundingClientRect().right)) })()`)
    assertEq(ov.length, 0, 'на узком окне ничего в карточке не выступает за край: ' + JSON.stringify(ov))
    const r760 = await page.rectOf('[data-testid=pb-toolchain]')
    assert(r760.x >= 0 && r760.x + r760.w <= 760, 'карточка помещается в 760 px')
    await page.setWindowSize(1280, 800)

    // «Скачать и установить» с локального сервера: сумма не совпала → ошибка, файл удалён, ничего не установлено
    await page.click('[data-testid=pb-install]')
    await page.waitExists('[data-testid=pb-error]', { timeout: 30000, what: 'ошибка контрольной суммы' })
    assertIncludes(await page.text('[data-testid=pb-error]'), 'Не удалось установить', 'понятное сообщение')
    await page.waitFor(`/Контрольная сумма SHA-256 архива не совпала/.test(document.querySelector('.log')?.innerText ?? '')`, { what: 'в «Выводе» причина: контрольная сумма' })
    const dl = join(app.userData, 'pro', 'downloads')
    assertEq(existsSync(dl) ? readdirSync(dl).filter((f) => /zip/.test(f)).length : 0, 0, 'архив с неверной суммой удалён')
    assertEq(existsSync(join(app.userData, 'pro-tools')) ? readdirSync(join(app.userData, 'pro-tools')).filter((f) => f.startsWith('xpack')).length : 0, 0, 'компилятор не установлен')
    // Повторная попытка зависает на медленном сервере: «Отменить» прерывает скачивание, недокачанный файл удаляется
    await page.click('[data-testid=pb-install]')
    await page.waitExists('[data-testid=pb-progress]', { what: 'ход скачивания' })
    assert(!(await page.eval(`document.querySelector('[data-testid=pb-later]') !== null`)), 'во время скачивания «Не сейчас» скрыта, есть только «Отменить»')
    await page.click('[data-testid=pb-cancel]')
    await page.waitFor(`/Установка отменена/.test(document.querySelector('[data-testid=pb-error]')?.innerText ?? '')`, { timeout: 20000, what: 'сообщение об отмене установки' })
    assertEq(existsSync(dl) ? readdirSync(dl).length : 0, 0, 'после отмены в папке загрузок ничего не осталось')
    await page.click('[data-testid=pb-later]')
    await page.waitGone('[data-testid=pb-toolchain]')

    // Настройки: компилятор не найден, есть «Выбрать папку…» и «Установить…»
    await page.click('[data-testid=act-settings]')
    await page.waitExists('[data-testid=settings-toolchain]')
    await page.waitFor(`/Не найден/.test(document.querySelector('[data-testid=toolchain-status]')?.innerText ?? '')`, { what: 'в настройках: компилятор не найден' })
    assert(await page.exists('[data-testid=toolchain-pick]') && await page.exists('[data-testid=toolchain-install]'), 'кнопки выбора папки и установки')
    await page.click('[data-testid=toolchain-install]')
    await page.waitExists('[data-testid=pb-toolchain]')
    await page.click('[data-testid=pb-later]')

    // Панель «Проект»: конфигурации и группа «Сборка»
    await page.click('[data-testid=act-project]')
    await page.waitExists('[data-testid=pro-build-group]')
    for (const id of ['pro-act-build', 'pro-act-clean', 'pro-act-export', 'pro-act-size']) assert(await page.exists(`[data-testid=${id}]`), 'кнопка ' + id)

    // Редактор конфигураций: Release → -O2, макрос, свой ключ; ошибка в макросе блокирует запись
    await page.click('[data-testid=pro-cfg-edit]')
    await page.waitExists('[data-testid=pb-configs]')
    await setSelect(page, 'pb-cfg-name', 'Release')
    await page.waitFor(`document.querySelector('[data-testid=pb-cfg-opt]').value === 'Os'`, { what: 'Release: оптимизация -Os' })
    await setSelect(page, 'pb-cfg-opt', 'O2')
    await page.fill('[data-testid=pb-cfg-defs]', 'NDEBUG MY_FLAG=1')
    await page.fill('[data-testid=pb-cfg-flags]', '-Wextra')
    await page.fill('[data-testid=pb-cfg-defs]', 'плохой макрос!')
    await page.click('[data-testid=pb-cfg-save]')
    await page.waitExists('[data-testid=pb-cfg-error]')
    assertEq(JSON.parse(readText(join(proj, 'avride.project.json'))).configurations.Release.optimization, 'Os', 'при ошибке файл не менялся')
    await page.fill('[data-testid=pb-cfg-defs]', 'NDEBUG MY_FLAG=1')
    await page.click('[data-testid=pb-cfg-save]')
    await page.waitGone('[data-testid=pb-configs]')
    const json1 = JSON.parse(readText(join(proj, 'avride.project.json')))
    assertEq(json1.configurations.Release.optimization, 'O2', 'оптимизация сохранена')
    assertEq(json1.configurations.Release.defines.join(' '), 'NDEBUG MY_FLAG=1', 'макросы сохранены')
    assertEq(json1.configurations.Release.extraFlags.join(' '), '-Wextra', 'ключи сохранены')
    assertEq(json1.configurations.Debug.optimization, 'Og', 'Debug не тронута')
    await page.waitFor(`/-O2/.test(document.querySelector('[data-testid=pro-cfg][data-name=Release]')?.innerText ?? '')`, { what: 'панель показывает -O2' })
    // Новая конфигурация (копия Debug)
    await page.click('[data-testid=pro-cfg-edit]')
    await page.waitExists('[data-testid=pb-configs]')
    await page.click('[data-testid=pb-cfg-add]')
    await page.waitExists('#dlg-input')
    await page.fill('#dlg-input', 'Test')
    await page.click({ sel: '.dlg button', text: 'Создать' })
    await page.waitFor(`document.querySelector('[data-testid=pb-cfg-name]')?.value === 'Test'`, { what: 'выбрана новая конфигурация' })
    await page.click('[data-testid=pb-cfg-save]')
    await page.waitGone('[data-testid=pb-configs]')
    await page.click({ sel: '[data-testid=tab]', text: 'main.c' })
    assertEq(await page.eval(`document.querySelectorAll('[data-testid=pro-config] option').length`), 3, 'в шапке три конфигурации')
    assert(Object.keys(JSON.parse(readText(join(proj, 'avride.project.json'))).configurations).includes('Test'), 'Test записана')

    // Экспорт сборки: Makefile и CMakeLists.txt; чужой Makefile не затирается без подтверждения
    writeFileSync(join(proj, 'Makefile'), 'all:\n\techo мой makefile\n')
    await page.click('[data-testid=pro-act-export]')
    await page.waitFor(`document.querySelector('.dlg[role=dialog]')?.innerText.includes('Заменить')`, { what: 'вопрос о замене чужого Makefile' })
    await page.click({ sel: '.dlg button', text: 'Отмена' })
    await new Promise((r) => setTimeout(r, 300))
    assertIncludes(readText(join(proj, 'Makefile')), 'мой makefile', 'чужой Makefile не изменён')
    await page.click('[data-testid=pro-act-export]')
    await page.waitFor(`document.querySelector('.dlg[role=dialog]')?.innerText.includes('Заменить')`)
    await page.click({ sel: '.dlg button', text: 'Заменить' })
    await page.waitFor(`/Экспорт сборки/.test(document.querySelector('[data-testid=toast]')?.innerText ?? '')`, { what: 'сообщение об экспорте' })
    const mk = readText(join(proj, 'Makefile'))
    for (const s of ['# Создан AVR IDE', 'TARGET  = BuildUi', 'ARCH    = -mcpu=cortex-m3 -mthumb -mfloat-abi=soft', '-DSTM32F103xB', 'OPT = -O2', 'startup/startup_stm32f103xb.s', 'LDSCRIPT = linker/STM32F103C8T6_FLASH.ld']) assertIncludes(mk, s, 'Makefile: ' + s)
    const cm = readText(join(proj, 'CMakeLists.txt'))
    for (const s of ['project(BuildUi C ASM)', 'arm-none-eabi-gcc', '$<$<CONFIG:Release>:-O2;-Wextra>', 'STM32F103xB']) assertIncludes(cm, s, 'CMakeLists: ' + s)
    // повторный экспорт своих файлов — без вопросов
    await page.click('[data-testid=pro-act-export]')
    await new Promise((r) => setTimeout(r, 500))
    assert(!(await page.exists('.dlg[role=dialog]')), 'свои файлы заменяются без вопроса')

    // Нет скрипта компоновки → карточка «Создать по карте памяти» → файл создан, дальше — карточка компилятора
    rmSync(join(proj, 'linker/STM32F103C8T6_FLASH.ld'))
    await page.click('[data-testid=pro-build]')
    await page.waitExists('[data-testid=pb-linker]', { what: 'карточка «Нет скрипта компоновки»' })
    await page.click('[data-testid=pb-linker-go]')
    await page.waitFor(`!!document.querySelector('[data-testid=pb-toolchain]')`, { what: 'после создания скрипта — снова проверка (нужен компилятор)' })
    assertIncludes(readFileSync(join(proj, 'linker/STM32F103C8T6_FLASH.ld'), 'utf8'), 'MEMORY', 'скрипт создан по карте памяти')
    await page.click('[data-testid=pb-later]')

    // Обе темы: карточка и «Размер» без переполнения, цвета берутся из токенов
    for (const theme of ['light', 'dark']) {
      await page.eval(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}`)
      await page.click('[data-testid=pro-build]')
      await page.waitExists('[data-testid=pb-toolchain]')
      assert(await noOverflow(page), 'тема ' + theme + ': карточка без горизонтального скролла')
      await page.click('[data-testid=pb-later]')
      await page.waitGone('[data-testid=pb-toolchain]')
    }
  }
}

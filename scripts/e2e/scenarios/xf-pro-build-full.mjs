// [full] Pro-режим, настоящая сборка на трёх чипах (F103C8 — Cortex-M3, F411RE — M4F, G474RE — M4F с CCM) и проверки результата.
// Нужен компилятор: путь к его папке bin в переменной AVRIDE_E2E_GCC (чтобы не качать 300 МБ при каждом прогоне), и интернет — для файлов CMSIS с GitHub.
// Без AVRIDE_E2E_GCC сценарий пропускается. Устройств и программаторов не нужно: прошивка не выполняется.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assert, assertEq, assertIncludes, readText } from '../lib/kit.mjs'

const GCC = process.env.AVRIDE_E2E_GCC

const CHIPS = [
  { name: 'BuildF103', search: 'F103C8', chip: 'STM32F103C8T6', flash: [0x08000000, 64 * 1024], ramEnd: 0x20000000 + 20 * 1024 },
  { name: 'BuildF411', search: 'F411RE', chip: 'STM32F411RET6', flash: [0x08000000, 512 * 1024], ramEnd: 0x20000000 + 128 * 1024 },
  { name: 'BuildG474', search: 'G474', chip: 'STM32G474RET6', flash: [0x08000000, 512 * 1024], ramEnd: 0x20000000 + 96 * 1024 }
]

async function createViaWizard(page, c) {
  await page.waitExists('[data-testid=start-screen]')
  await page.click('[data-testid=start-create]')
  await page.waitExists('[data-testid=pro-wizard]')
  await page.fill('[data-testid=pro-wz-search]', c.search)
  await page.click(`[data-testid=pro-wz-chip][data-chip=${c.chip}]`)
  await page.fill('[data-testid=wz-name]', c.name)
  await page.waitFor(`!!document.querySelector('[data-testid=wz-create]') && !document.querySelector('[data-testid=wz-create]').disabled`, { what: 'кнопка «Создать»' })
  await page.click('[data-testid=wz-create]')
  await page.waitExists('[data-testid=header][data-mode=pro]', { timeout: 40000 })
}

const idle = (page) => page.waitFor(`!document.querySelector('[data-testid=pro-build]').hasAttribute('data-busy')`, { what: 'сборка завершена (кнопка «Собрать» снова свободна)' })
const status = (page) => page.text('[data-testid=statusbar]')

export default {
  id: 'xf',
  full: true,
  timeout: 600000,
  title: '[full] Pro: настоящая сборка F103C8 / F411RE / G474RE — .elf/.bin/.hex, размеры, ошибки в «Проблемах», повторная сборка без работы',
  env: GCC ? { AVRIDE_PRO_GCC: GCC } : {},
  async run({ page, sketchbook, log }) {
    if (!GCC) { log('AVRIDE_E2E_GCC не задана (папка bin компилятора) — сценарий пропущен'); return }
    await page.waitExists('[data-testid=start-screen]')
    await page.click('[data-testid=mode-pro]')

    for (const [i, c] of CHIPS.entries()) {
      if (i > 0) {
        await page.click('[data-testid=hdr-close-project]')
        await page.waitExists('[data-testid=start-screen]')
      }
      await createViaWizard(page, c)
      const proj = join(sketchbook, c.name)
      // CMSIS: карточка → «Скачать и собрать» → сборка идёт сама
      await page.waitExists('[data-testid=pb-support]', { timeout: 20000, what: 'карточка скачивания CMSIS' })
      await page.click('[data-testid=pb-support-go]')
      await page.waitFor(`/Собрано · Flash/.test(document.querySelector('[data-testid=statusbar]')?.innerText ?? '')`, { timeout: 240000, what: `${c.chip}: «Собрано» в строке состояния` })
      const sb = await status(page)
      assert(/Flash [0-9.,]+ (КБ|Б) \([0-9]+%\)/.test(sb) && /RAM [0-9.,]+ (КБ|Б) \([0-9]+%\)/.test(sb), `${c.chip}: итог «Flash … RAM …» в строке состояния: ${sb}`)
      log(`${c.chip}: ${sb.replace(/\s+/g, ' ').match(/Собрано[^|]*/)?.[0]}`)

      // Файлы результата
      const out = join(proj, 'build', 'Debug')
      for (const f of [`${c.name}.elf`, `${c.name}.bin`, `${c.name}.hex`, `${c.name}.map`]) assert(existsSync(join(out, f)) && statSync(join(out, f)).size > 0, `${c.chip}: есть ${f}`)
      const bin = readFileSync(join(out, `${c.name}.bin`))
      const sp = bin.readUInt32LE(0)
      const reset = bin.readUInt32LE(4)
      assertEq(sp, c.ramEnd, `${c.chip}: начальный SP в таблице векторов = конец RAM`)
      assert((reset & 1) === 1 && reset >= c.flash[0] && reset < c.flash[0] + c.flash[1], `${c.chip}: вектор Reset (0x${reset.toString(16)}) в диапазоне Flash, бит Thumb установлен`)
      assert(bin.length < c.flash[1], `${c.chip}: образ помещается во Flash`)
      assert(bin.subarray(0, 0x40).some((b) => b !== 0), `${c.chip}: .isr_vector не нулевой`)
      const hex = readText(join(out, `${c.name}.hex`))
      assert(hex.startsWith(':02000004'), `${c.chip}: .hex начинается с адреса расширения`)
      // Файлы CMSIS положены в проект, startup настоящий
      assert(existsSync(join(proj, 'drivers/CMSIS/Include/cmsis_gcc.h')), `${c.chip}: заголовки CMSIS в проекте`)
      assert(!readText(join(proj, c.chip === 'STM32F103C8T6' ? 'startup/startup_stm32f103xb.s' : c.chip === 'STM32F411RET6' ? 'startup/startup_stm32f411xe.s' : 'startup/startup_stm32g474xx.s')).includes('AVRIDE-PLACEHOLDER'), `${c.chip}: startup заменён настоящим`)

      // Вывод: этапы и итог; вкладка «Размер»
      const logText = await page.text('.log')
      assertIncludes(logText, 'Готово:', `${c.chip}: «Готово» в выводе`)
      assertIncludes(logText, 'Memory region', `${c.chip}: таблица использования памяти компоновщика`)
      await page.click('[data-testid=btab-size]')
      await page.waitExists('[data-testid=size-panel]')
      assert((await page.count('[data-testid=size-region]')) >= 2, `${c.chip}: в «Размере» есть области FLASH и RAM`)
      assert(await page.exists('[data-testid=size-region][data-region=FLASH]'), `${c.chip}: область FLASH`)
      if (c.chip === 'STM32G474RET6') assert(await page.exists('[data-testid=size-region][data-region=CCMRAM]'), 'G474: область CCMRAM')
      await page.click({ sel: '[role=tab]', text: 'Символы' })
      await page.waitExists('[data-testid=size-symbols]')
      assertIncludes(await page.text('[data-testid=size-symbols]'), 'main', `${c.chip}: символ main в таблице`)
      await page.click({ sel: '[role=tab]', text: 'Секции' })
      assertIncludes(await page.text('[data-testid=size-sections]'), '.isr_vector', `${c.chip}: секция .isr_vector`)

      if (i === 0) {
        // Повторная сборка: ничего не компилируется
        await page.click('[data-testid=btab-output]')
        await idle(page)
        await page.click('[data-testid=pro-build]')
        await page.waitFor(`/всё актуально/.test(document.querySelector('.log')?.innerText ?? '') && /Компоновка не нужна/.test(document.querySelector('.log')?.innerText ?? '')`, { timeout: 30000, what: 'повторная сборка ничего не пересобирает' })
        // Release: свой каталог результатов
        await page.eval(`(() => { const s = document.querySelector('[data-testid=pro-config]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 'Release'); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
        await idle(page)
        await page.click('[data-testid=pro-build]')
        await page.waitFor(`/\\[Release\\]/.test(document.querySelector('.log')?.innerText ?? '') && /Готово: build\\/Release/.test(document.querySelector('.log')?.innerText ?? '')`, { timeout: 120000, what: 'сборка Release' })
        assert(existsSync(join(proj, 'build', 'Release', `${c.name}.elf`)), 'Release: свой .elf')
        const relSize = statSync(join(proj, 'build', 'Release', `${c.name}.bin`)).size
        const dbgSize = statSync(join(out, `${c.name}.bin`)).size
        assert(relSize <= dbgSize, `Release (-Os, без -g) не больше Debug: ${relSize} <= ${dbgSize}`)
        await page.eval(`(() => { const s = document.querySelector('[data-testid=pro-config]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 'Debug'); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)

        // Ошибка компиляции: «Проблемы» → строка → клик открывает файл на нужной строке
        const main = join(proj, 'src', 'main.c')
        const good = readFileSync(main, 'utf8')
        writeFileSync(main, '#include "stm32f1xx.h"\nint main(void)\n{\n    int a = nothere;\n    return a;\n}\n')
        await idle(page)
        await page.click('[data-testid=pro-build]')
        await page.waitFor(`document.querySelectorAll('[data-testid=problem]').length > 0`, { timeout: 60000, what: 'ошибки сборки в «Проблемах»' })
        const probs = await page.eval(`[...document.querySelectorAll('[data-testid=problem]')].map((p) => p.innerText.replace(/\\s+/g, ' '))`)
        assert(probs.some((p) => /nothere/.test(p) && /main\.c:4/.test(p)), 'ошибка про nothere с main.c:4: ' + JSON.stringify(probs))
        await idle(page)
        await page.click('[data-testid=pro-build]')
        await page.waitFor(`/Компиляция не удалась/.test(document.querySelector('.log')?.innerText ?? '')`, { timeout: 60000 })
        assert(/Ошибка сборки/.test(await status(page)), 'строка состояния: «Ошибка сборки»')
        await page.click({ sel: '[data-testid=problem]', text: 'nothere' })
        await page.waitFor(`document.querySelector('[data-testid=tab][aria-selected=true]')?.innerText.includes('main.c')`, { what: 'клик по проблеме открыл main.c' })
        writeFileSync(main, good)
        await idle(page)
        await page.click('[data-testid=pro-build]')
        await page.waitFor(`/Собрано · Flash/.test(document.querySelector('[data-testid=statusbar]')?.innerText ?? '')`, { timeout: 120000, what: 'после исправления собирается' })
      }
    }
  }
}

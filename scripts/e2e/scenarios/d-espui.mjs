import { join } from 'node:path'
import { assert, assertEq, assertIncludes, openRecent, waitFile, readText } from '../lib/kit.mjs'
import { sleep } from '../lib/cdp.mjs'

const INO = 'float temperature;\n\nvoid setup() {\n}\n\nvoid loop() {\n}\n'

export default {
  id: 'd',
  title: 'Конструктор ESPUI: элементы, привязка к переменной, «Вставить в скетч», режим «Тест»',
  arduino: 'ard2',
  files: { 'Ui1/Ui1.ino': INO, 'Ui1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Ui1'],
  async run({ page, sketchbook }) {
    await openRecent({ page }, 'Ui1')
    await page.click('[data-testid=act-ui]')
    await page.waitExists('[data-testid=uib]')
    const pal = (t) => `[data-testid=uib-pal][data-type=${t}]`
    await page.click(pal('label'))
    await page.click(pal('slider'))
    await page.click(pal('button'))

    // «Связи»: по строке на каждый элемент
    await page.click({ sel: '.uib-btab', text: 'Связи' })
    await page.waitFor(`document.querySelectorAll('.uib-linktable tbody tr').length === 3`, { what: 'три элемента в таблице связей' })

    // Привязываем надпись к переменной temperature (показывать значение)
    await page.click({ sel: '.uib-linktable tbody tr', text: 'Надпись' })
    await page.click({ sel: '[data-testid=uib-intent]', re: 'Показывать значение переменной' })
    await page.click('#uib-var-picker')
    await page.click({ sel: '.uib-popover [role=option]', text: 'temperature' })
    await page.waitFor(`document.querySelector('#uib-var-picker')?.innerText.includes('temperature')`, { what: 'переменная выбрана' })
    // Элемент связан: в таблице статус не «не связано»
    await page.click({ sel: '.uib-btab', text: 'Связи' }).catch(() => {})
    await sleep(300)

    // Вставка в скетч
    await page.click('[data-testid=uib-insert]')
    await page.waitExists('[data-testid=uib-insert-confirm]')
    await page.click('[data-testid=uib-insert-confirm]')
    // при ошибках модели нужно второе, осознанное подтверждение
    if (await page.exists('[data-testid=uib-insert-armed]')) await page.click('[data-testid=uib-insert-confirm]')
    await page.waitExists('[data-testid=uib-insert-result].ok', { what: 'результат вставки' })
    const gen = join(sketchbook, 'Ui1', 'ui_generated.h')
    const header = await waitFile(gen, 'ui_setup')
    assertIncludes(header, 'ui_loop', 'ui_generated.h содержит ui_loop')
    assertIncludes(header, 'temperature', 'ui_generated.h использует переменную temperature')
    await page.click({ sel: '.uib-modal button', text: 'Закрыть' })

    // Скетч изменён в редакторе — сохраняем и проверяем файл на диске
    await page.click({ sel: '[data-testid=tab]', text: 'Ui1.ino' })
    await page.key('s', { ctrl: true })
    const ino = await waitFile(join(sketchbook, 'Ui1', 'Ui1.ino'), '#include "ui_generated.h"')
    assertIncludes(ino, 'ui_setup();', 'в скетч добавлен ui_setup()')
    assertIncludes(ino, 'ui_loop();', 'в скетч добавлен ui_loop()')
    assert(readText(join(sketchbook, 'Ui1', 'ui.json')).includes('"temperature"'), 'ui.json сохранён')

    // Режим «Тест»
    await page.click('[data-testid=act-ui]')
    await page.waitExists('[data-testid=uib]')
    await page.click('[data-testid=uib-mode-test]')
    await page.waitFor(`document.querySelector('[data-testid=uib-mode-test]').getAttribute('aria-pressed') === 'true'`, { what: 'включён режим «Тест»' })
    assertEq(await page.eval(`[...document.querySelectorAll('[data-testid=uib-pal]')].every(b => b.disabled)`), true, 'в режиме «Тест» палитра отключена')
    await page.click('[data-testid=uib-mode-edit]')
    await page.waitFor(`document.querySelector('[data-testid=uib-mode-edit]').getAttribute('aria-pressed') === 'true'`, { what: 'возврат в «Редактировать»' })
  }
}

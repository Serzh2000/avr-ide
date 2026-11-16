import { join } from 'node:path'
import { assert, assertIncludes, openRecent, readText, waitFile } from '../lib/kit.mjs'

export default {
  id: 'h',
  title: 'Поиск по проекту: Ctrl+Shift+F, найти, «Заменить всё» с подтверждением',
  files: {
    'Srch1/Srch1.ino': '#include "helper.h"\nint oldValue = 1;\nvoid setup() {\n  oldValue = 2;\n}\nvoid loop() {\n}\n',
    'Srch1/helper.h': '// oldValue используется в скетче\nextern int oldValue;\n',
    'Srch1/sketch.yaml': 'default_fqbn: arduino:avr:uno\n'
  },
  projects: ['Srch1'],
  async run({ page, sketchbook }) {
    await openRecent({ page }, 'Srch1')
    await page.key('f', { ctrl: true, shift: true })
    await page.waitExists('.search-panel')
    await page.waitFor(`document.activeElement?.getAttribute('aria-label') === 'Что искать'`, { what: 'фокус в поле поиска' })
    await page.insertText('oldValue')
    await page.waitFor(`document.querySelectorAll('.srch-file').length === 2`, { what: 'совпадения найдены в двух файлах' })
    assertIncludes(await page.text('.srch-status'), '4', 'всего 4 совпадения')

    // Замена: показываем поле замены, вводим, подтверждаем
    await page.click('.srch-chev')
    await page.fill('input[aria-label="Чем заменить"]', 'newValue')
    await page.click({ sel: '.srch-note .btn', text: 'Заменить всё' })
    await page.waitExists('.modal[aria-label="Заменить?"]')
    // сначала проверим отмену: диск не должен измениться
    await page.click({ sel: '.modal .btn', text: 'Отмена' })
    await page.waitGone('.modal')
    assert(readText(join(sketchbook, 'Srch1', 'Srch1.ino')).includes('oldValue'), 'после отмены файл не изменён')

    await page.click({ sel: '.srch-note .btn', text: 'Заменить всё' })
    await page.waitExists('.modal[aria-label="Заменить?"]')
    await page.click({ sel: '.modal .btn', text: 'Заменить' })
    const ino = await waitFile(join(sketchbook, 'Srch1', 'Srch1.ino'), 'newValue')
    assert(!ino.includes('oldValue'), 'в .ino не осталось oldValue')
    const h = await waitFile(join(sketchbook, 'Srch1', 'helper.h'), 'newValue')
    assert(!h.includes('oldValue'), 'в helper.h не осталось oldValue')
    await page.waitFor(`/Ничего не найдено/.test(document.querySelector('.srch-status')?.innerText ?? '')`, { what: 'после замены ничего не найдено' })
    // редактор подхватил изменение с диска
    await page.click({ sel: '[data-testid=tab]', text: 'Srch1.ino' })
    await page.waitFor(`document.querySelector('.view:not([hidden]) .view-lines')?.textContent.includes('newValue')`, { what: 'редактор показывает новый текст' })
  }
}

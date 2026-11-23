// Справка и первый тур: в e2e-режиме тур сам не запускается; «Справка» открывается и закрывается по Esc, тур запускается из неё
// и проходится кнопками; команды есть в палитре. Диалоги закрываются по Esc, фокус не теряется.
import { assert, assertEq, assertIncludes, editorText, openRecent } from '../lib/kit.mjs'
import { join } from 'node:path'
import { sleep } from '../lib/cdp.mjs'

const shotDir = process.env.AVRIDE_E2E_SHOTS
const snap = async (page, n) => { if (shotDir) { await sleep(350); await page.shot(join(shotDir, n + '.png')) } }

export default {
  id: 's',
  title: 'Справка и тур: тур не мешает в e2e, Справка по Esc, тур по шагам, команды в палитре',
  arduino: 'ard2',
  files: { 'Help1/Help1.ino': 'void setup() {\n}\n\nvoid loop() {\n}\n', 'Help1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Help1'],
  async run({ page }) {
    // На стартовом экране есть кнопка «Справка»
    await page.waitExists('[data-testid=start-help]', { what: 'кнопка справки на старте' })
    await openRecent({ page }, 'Help1')
    await sleep(1600)
    assertEq(await page.count('[data-testid=tour]'), 0, 'в e2e-режиме тур сам не запускается')

    // Пустой скетч Generic ESP32: только открытие примеров.
    await page.waitExists('[data-testid=starter]', { what: 'подсказка над пустым скетчем' })
    assertEq(await page.count('[data-testid=starter-blink]'), 0, 'для Generic ESP32 нет быстрой вставки')
    await page.click('[data-testid=starter-examples]')
    await page.waitFor(`window.__avrStores.useUi.getState().sideView === 'examples'`, { what: 'открылась панель примеров' })
    assertEq(await page.count('[data-testid=starter]'), 1, 'открытие примеров не меняет пустой скетч')

    // Меняем только состояние платы и установленного ядра: проверяем реакцию баннера без установки ядра в тесте UI.
    await page.eval(`(() => {
      const { useUi, useBuild } = window.__avrStores
      useUi.setState({ fqbn: 'arduino:avr:uno' })
      useBuild.setState({ cores: [{ id: 'arduino:avr', name: 'Arduino AVR', installed: '1.8.7' }] })
    })()`)
    assertEq(await page.count('[data-testid=starter-blink]'), 0, 'непроверенная версия ядра не включает быструю вставку')
    await page.eval(`window.__avrStores.useBuild.setState({ cores: [{ id: 'arduino:avr', name: 'Arduino AVR', installed: '1.8.8' }] })`)
    await page.waitExists('[data-testid=starter-blink]', { what: 'быстрая вставка для Uno с проверенным ядром' })
    await page.click('[data-testid=starter-blink]')
    await page.waitFor(`!document.querySelector('[data-testid=starter]')`, { what: 'подсказка исчезла после вставки' })
    await page.waitFor(`/LED_BUILTIN/.test(document.querySelector('.view:not([hidden]) .monaco-editor')?.textContent ?? '')`, { what: 'в редакторе код мигания' })

    // Справка: открыть, увидеть разделы, Esc закрывает
    await page.click('[data-testid=hdr-help]')
    await page.waitExists('[data-testid=help-dialog]', { what: 'окно «Справка»' })
    await snap(page, 's1-help')
    const txt = (await page.text('[data-testid=help-dialog]')).toLowerCase()
    for (const w of ['Как начать', 'Где что находится', 'Горячие клавиши', 'Сообщить о проблеме']) assertIncludes(txt, w.toLowerCase(), 'в справке есть «' + w + '»')
    await page.key('Escape')
    await page.waitFor(`!document.querySelector('[data-testid=help-dialog]')`, { what: 'Esc закрыл справку' })

    // Тур из справки: 5 шагов, «Далее» ... «Готово»
    await page.click('[data-testid=hdr-help]')
    await page.click('[data-testid=help-tour]')
    await page.waitExists('[data-testid=tour]', { what: 'тур запущен' })
    assertIncludes((await page.text('[data-testid=tour]')).toLowerCase(), 'шаг 1 из 5', 'первый шаг')
    await snap(page, 's2-tour1')
    await page.click('[data-testid=tour-next]')
    await snap(page, 's3-tour2')
    for (let i = 0; i < 3; i++) await page.click('[data-testid=tour-next]')
    assertIncludes((await page.text('[data-testid=tour]')).toLowerCase(), 'шаг 5 из 5', 'последний шаг')
    assertIncludes(await page.text('[data-testid=tour-next]'), 'Готово', 'на последнем шаге кнопка «Готово»')
    await page.click('[data-testid=tour-next]')
    await page.waitFor(`!document.querySelector('[data-testid=tour]')`, { what: 'тур завершён' })
    assert(await page.eval(`localStorage.getItem('avride.tour.seen.v1') === '1'`), 'тур помечен как показанный')

    // Тур можно пропустить по Esc
    await page.eval(`window.__avrStores.useUi.getState().setTour(2)`)
    await page.waitExists('[data-testid=tour]', { what: 'тур снова запущен' })
    await page.key('Escape')
    await page.waitFor(`!document.querySelector('[data-testid=tour]')`, { what: 'Esc пропустил тур' })

    // Палитра команд знает про справку
    await page.key('p', { ctrl: true, shift: true })
    await page.fill('.pal-input', '>Справка')
    await page.waitFor(`/Справка/.test(document.querySelector('.pal-list')?.innerText ?? '')`, { what: 'команда «Справка» в палитре' })
    await page.key('Escape')
    await page.waitGone('.pal')
    // Отложенный возврат фокуса из выбора платы не должен перехватить фокус палитры.
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid=hdr-board]')
      await page.waitExists('.board-pop')
      await page.key('Escape')
      await page.key('p', { ctrl: true, shift: true })
      await page.waitFor(`document.activeElement?.matches('.pal-input')`, { what: 'фокус в поиске палитры' })
      await page.key('Escape')
      await page.waitGone('.pal')
    }
  }
}

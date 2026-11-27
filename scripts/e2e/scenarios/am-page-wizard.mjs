import { join } from 'node:path'
import { assert, assertIncludes, openRecent, waitFile } from '../lib/kit.mjs'
import { sleep } from '../lib/cdp.mjs'

const INO = 'void setup() {\n}\n\nvoid loop() {\n}\n'

export default {
  id: 'am',
  title: 'Мастер «Страница для устройства»: сам открывается, шаги с возвратом, подключение к скетчу',
  arduino: 'ard2',
  files: { 'Wiz1/Wiz1.ino': INO, 'Wiz1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Wiz1'],
  async run({ page, sketchbook, log }) {
    const shots = process.env.WZ_SHOTS
    const dir = join(sketchbook, 'Wiz1')
    const shot = async (name) => { if (shots) { await sleep(300); await page.shot(join(shots, `wizard-${name}.png`)).catch(() => {}) } }
    await openRecent({ page }, 'Wiz1')
    await page.eval(`localStorage.setItem('avride.e2e.wizard', '1')`)
    await page.click('[data-testid=act-web]')
    // Мастер открывается сам: страница ещё не подключена к скетчу
    await page.waitExists('[data-testid=wz]', { what: 'мастер открылся сам' })
    await page.waitExists('[data-testid=wz-page-start]')
    await shot('1-start')

    // Шаг 1: готовая идея «Мотор или сервопривод» → сразу шаг «Что на странице»
    await page.click('[data-testid=wz-starter-servo]')
    await page.waitExists('[data-testid=wz-page-items]')
    assert((await page.eval('document.querySelectorAll("[data-testid=wz-item]").length')) === 2, 'два элемента из набора')
    await page.click('[data-testid=wz-add-sensor]')
    assert((await page.eval('document.querySelectorAll("[data-testid=wz-item]").length')) === 3, 'добавлен датчик')
    await shot('2-items')

    // Шаг 3: подключение — у ползунка пин, у датчика переменная
    await page.click('[data-testid=wz-next]')
    await page.waitExists('[data-testid=wz-page-links]')
    const links = await page.text('[data-testid=wz-page-links]')
    assertIncludes(links, 'Пин платы', 'выбор «Пин платы»')
    assertIncludes(links, 'Страница сама объявит', 'у датчика — новая переменная')
    await shot('3-links')

    // Шаг 4: Wi‑Fi — своя сеть платы по умолчанию; домашняя сеть требует имя
    await page.click('[data-testid=wz-next]')
    await page.waitExists('[data-testid=wz-page-wifi]')
    await page.click('[data-testid=wz-wifi-sta]')
    await page.waitFor(`/Введите имя домашней сети/.test(document.querySelector('[data-testid=wz-page-wifi]')?.innerText ?? '')`, { what: 'подсказка про имя домашней сети' })
    await page.click('[data-testid=wz-wifi-ap]')
    await shot('4-wifi')

    // Шаг 5: оформление с превью
    await page.click('[data-testid=wz-next]')
    await page.waitExists('[data-testid=wz-page-look]')
    await page.waitExists('[data-testid=wz-preview]')
    await shot('5-look')

    // Возврат к любому шагу: из «Оформления» на «Начало», переименовать и обратно на «Готово»
    await page.click('[data-testid=wz-step-start]')
    await page.waitExists('[data-testid=wz-page-start]')
    await page.fill('[data-testid=wz-title]', 'Робот-рука')
    await page.click('[data-testid=wz-step-look]')
    await page.click('[data-testid=wz-next]')
    await page.waitExists('[data-testid=wz-page-done]')
    assertIncludes(await page.text('[data-testid=wz-page-done]'), 'Всё готово', 'без проблем')
    await shot('6-done')

    // Готово → подключение к скетчу (тот же диалог, что и в редакторе)
    await page.click('[data-testid=wz-finish]')
    await page.waitGone('[data-testid=wz]')
    await page.waitExists('[data-testid=wd-insert-confirm]', { what: 'диалог подключения к скетчу' })
    await page.click('[data-testid=wd-insert-confirm]')
    await page.waitExists('[data-testid=wd-insert-result].ok', { what: 'страница подключена' })
    const json = await waitFile(join(dir, 'web_design.json'), '"wizard"')
    assertIncludes(json, 'Робот-рука', 'название из мастера сохранено')
    const header = await waitFile(join(dir, 'web_generated.h'), 'wdBegin')
    assertIncludes(header, 'temperatura', 'переменная датчика объявлена страницей')
    await page.click({ sel: '.uib-modal button', text: 'Закрыть' })
    await shot('7-editor')

    // Повторное открытие: мастер начинает с «Готово» и помнит ответы
    await page.click('[data-testid=wd-wizard]')
    await page.waitExists('[data-testid=wz-page-done]')
    await page.click('[data-testid=wz-step-start]')
    assert((await page.eval('document.querySelector("[data-testid=wz-title]").value')) === 'Робот-рука', 'ответы мастера сохранились')
    await page.key('Escape')
    await page.waitGone('[data-testid=wz]')
    log('мастер: 6 шагов, возврат к шагу, подключение к скетчу, повторное открытие')
  }
}

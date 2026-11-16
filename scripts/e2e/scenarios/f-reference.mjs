import { assert, assertIncludes, openRecent } from '../lib/kit.mjs'

export default {
  id: 'f',
  title: 'Справочник: поиск Serial.begin, карточка, вкладка плат и распиновка',
  arduino: 'ard2',
  files: { 'Ref1/Ref1.ino': 'void setup() {\n}\nvoid loop() {\n}\n', 'Ref1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Ref1'],
  async run({ page }) {
    await openRecent({ page }, 'Ref1')
    await page.click('[data-testid=act-ref]')
    await page.waitExists('.ref-search')
    await page.fill('.ref-search', 'Serial.begin')
    await page.waitFor(`/Serial[.]begin/.test(document.querySelector('.ref-list-scroll')?.innerText ?? '')`, { what: 'в списке есть Serial.begin' })
    await page.click({ sel: '.ref-list-scroll button, .ref-list-scroll [role=option], .ref-list-scroll [class*=ref-item]', text: 'Serial.begin' })
    await page.waitExists('.ref-card')
    const card = await page.text('.ref-card')
    assertIncludes(card, 'Serial.begin', 'заголовок карточки')
    assert(card.length > 200, 'в карточке есть описание, параметры и пример')
    assert(await page.exists('.ref-sig'), 'в карточке есть сигнатура')

    // Платы и распиновка
    await page.click({ sel: '.ref-tabs [role=tab]', text: 'Платы' })
    await page.waitExists('.ref-board-main, .ref-board-list')
    await page.waitFor(`document.querySelector('.ref-board-main')?.innerText.includes('пинов') || document.querySelector('.ref-board-main')?.innerText.length > 50`, { what: 'показана плата' })
    // поиск общий для вкладок: очищаем, чтобы пины не были отфильтрованы
    await page.click('.ref-clear')
    // переключатель «схема / таблица»
    const seg = await page.eval(`[...document.querySelectorAll('.ref-seg [role=tab], .ref-seg button')].map(b => b.innerText.trim())`)
    assert(seg.length >= 2, 'у платы есть переключатель вида (схема/таблица): ' + JSON.stringify(seg))
    await page.click({ sel: '.ref-seg button, .ref-seg [role=tab]', text: seg[seg.length - 1] })
    await page.waitExists('.ref-pins')
    assert((await page.count('.ref-pins tbody tr')) > 5, 'таблица распиновки содержит строки')
    await page.click({ sel: '.ref-seg button, .ref-seg [role=tab]', text: seg[0] })
    await page.waitExists('.ref-pinout-wrap svg, .ref-pinout-wrap')
  }
}

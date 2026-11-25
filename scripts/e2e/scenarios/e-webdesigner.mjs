import { assert, assertIncludes, openRecent, selectOption } from '../lib/kit.mjs'

export default {
  id: 'e',
  title: 'Веб-дизайнер: блоки, ящик с HTML, меню «Экспорт»',
  arduino: 'ard2',
  files: { 'Web1/Web1.ino': 'void setup() {\n}\nvoid loop() {\n}\n', 'Web1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Web1'],
  async run({ page }) {
    await openRecent({ page }, 'Web1')
    await page.click('[data-testid=act-web]')
    await page.waitExists('.wd')
    await page.waitExists('.wd-pal-item')
    await page.click({ sel: '.wd-ltab', text: 'Структура' })
    const before = await page.count('.wd-tree-row')
    await page.click({ sel: '.wd-ltab', text: 'Блоки' })
    await page.click({ sel: '.wd-pal-item', text: 'Кнопка' })
    await page.click({ sel: '.wd-pal-item', text: 'Ползунок' })
    await page.click({ sel: '.wd-pal-item', text: 'Переключатель' })
    await page.click({ sel: '.wd-ltab', text: 'Структура' })
    const after = await page.count('.wd-tree-row')
    assert(after > before, `в дереве страницы появились блоки (было ${before}, стало ${after})`)

    // HTML и C++ открываются вместо предпросмотра.
    await selectOption(page, '[data-testid=wd-view]', 'html')
    await page.waitExists('[data-testid=wd-workspace]')
    assert(await page.eval("document.querySelector('.wd-main').hidden"), 'предпросмотр не делит высоту с кодом')
    await page.waitFor(`/<button/i.test(document.querySelector('[data-testid=wd-workspace]')?.innerText ?? '') || /<input/i.test(document.querySelector('[data-testid=wd-workspace]')?.innerText ?? '')`, { what: 'HTML страницы показан в рабочей области' })
    assertIncludes(await page.text('[data-testid=wd-workspace]'), '<', 'в рабочей области HTML-код')
    await selectOption(page, '[data-testid=wd-view]', 'cpp')
    await page.waitFor(`/WebServer|AsyncWebServer|WiFi/.test(document.querySelector('[data-testid=wd-workspace]')?.innerText ?? '')`, { what: 'C++ обвязка показана' })
    await page.click('[data-testid=wd-return]')
    await page.waitGone('[data-testid=wd-workspace]')
    assert(await page.eval("!document.querySelector('.wd-main').hidden"), 'возврат к предпросмотру')

    // Экспорт
    await page.click({ sel: '.wd-menu .wd-btn', text: 'Экспорт' })
    await page.waitExists('.wd-menu-list [role=menuitem]')
    assertIncludes(await page.text('.wd-menu-list'), 'index.html', 'в меню экспорта есть index.html')
    await page.key('Escape')
    await page.waitGone('.wd-menu-list')

    await page.setWindowSize(760, 620)
    await page.click('[data-testid=wd-strip-blocks]')
    await page.waitExists('.wd-left.open')
    await page.waitFor(`getComputedStyle(document.querySelector('.wd-left')).visibility === 'visible' && document.querySelector('.wd-left').getBoundingClientRect().left >= 0`, { what: 'выезжающая панель блоков открылась' })
    await page.click({ sel: '.wd-pal-item', text: 'Кнопка' })
    await page.waitExists('.wd-main.insp-open')
    await page.click('[data-testid=wd-mode-try]')
    await page.waitFor(`document.querySelector('[data-testid=wd-mode-try]')?.getAttribute('aria-pressed') === 'true'`)
    assert(!(await page.exists('.wd-main.insp-open')), 'переход в режим проверки освобождает холст от инспектора')
    await page.click('[data-testid=wd-mode-edit]')
  }
}

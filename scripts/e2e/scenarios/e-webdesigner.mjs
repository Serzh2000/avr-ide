import { assert, assertIncludes, openRecent } from '../lib/kit.mjs'

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
    const before = await page.count('.wd-tree-row, .wd-tree li, .wd-tree button')
    await page.click({ sel: '.wd-pal-item', text: 'Кнопка' })
    await page.click({ sel: '.wd-pal-item', text: 'Ползунок' })
    await page.click({ sel: '.wd-pal-item', text: 'Переключатель' })
    const after = await page.count('.wd-tree-row, .wd-tree li, .wd-tree button')
    assert(after > before, `в дереве страницы появились блоки (было ${before}, стало ${after})`)

    // Выдвижной ящик: вкладка HTML
    await page.click({ sel: '.wd-tab', text: 'HTML' })
    await page.waitExists('.wd-drawer')
    await page.waitFor(`/<button/i.test(document.querySelector('.wd-drawer')?.innerText ?? '') || /<input/i.test(document.querySelector('.wd-drawer')?.innerText ?? '')`, { what: 'HTML страницы показан в ящике' })
    assertIncludes(await page.text('.wd-drawer'), '<', 'в ящике HTML-код')
    await page.click({ sel: '.wd-tab', text: 'C++ обвязка' })
    await page.waitFor(`/WebServer|AsyncWebServer|WiFi/.test(document.querySelector('.wd-drawer')?.innerText ?? '')`, { what: 'C++ обвязка показана' })
    await page.click({ sel: '.wd-drawer .wd-btn', text: 'Свернуть' })
    await page.waitGone('.wd-drawer')

    // Экспорт
    await page.click({ sel: '.wd-menu .wd-btn', text: 'Экспорт' })
    await page.waitExists('.wd-menu-list [role=menuitem]')
    assertIncludes(await page.text('.wd-menu-list'), 'index.html', 'в меню экспорта есть index.html')
    await page.key('Escape')
    await page.waitGone('.wd-menu-list')
  }
}

import { join } from 'node:path'
import { assertIncludes, openRecent, readText } from '../lib/kit.mjs'

const INO = 'float temperature = 21.5;\n\nvoid setup() {\n}\n\nvoid loop() {\n}\n'

export default {
  id: 'u',
  title: '[full] Страница веб-дизайнера в скетче компилируется (ESP32, без платы): «Проверить страницу»',
  full: true,
  arduino: 'ard2',
  timeout: 20 * 60 * 1000,
  files: { 'Pc1/Pc1.ino': INO, 'Pc1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Pc1'],
  async run({ page, sketchbook, log }) {
    const dir = join(sketchbook, 'Pc1')
    await openRecent({ page }, 'Pc1')
    await page.click('[data-testid=act-web]')
    await page.waitExists('.wd-pal-item')
    await page.click({ sel: '.wd-pal-item', text: 'Датчик' })
    await page.click({ sel: '.wd-ins-tabs [role=tab]', text: 'Связь' })
    await page.click({ sel: '.wd-segs button', text: 'Переменная' })
    await page.eval(`(() => { const s = document.querySelector('[data-testid=wd-bind-var]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 's:temperature'); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
    await page.click('[data-testid=wd-insert]')
    await page.click('[data-testid=wd-insert-confirm]')
    await page.waitExists('[data-testid=wd-insert-result].ok')
    await page.click({ sel: '.uib-modal button', text: 'Закрыть' })
    await page.click('[data-testid=wd-link-check]')
    await page.waitFor(`/Собрано|Ошибка сборки/.test(document.querySelector('[data-testid=statusbar]')?.innerText ?? '')`, { timeout: 12 * 60 * 1000, interval: 1000, what: 'сборка завершилась' })
    const sb = await page.text('[data-testid=statusbar]')
    assertIncludes(sb, 'Собрано', 'страница вместе со скетчем собралась. Вывод: ' + (await page.eval(`document.querySelector('[data-testid=utility-output]')?.innerText.slice(-800) ?? ''`)))
    log('итог: ' + sb.split('\n').find((l) => l.includes('Собрано')))
    assertIncludes(readText(join(dir, 'Pc1.ino')), 'wdBegin();', 'скетч сохранён с wdBegin()')
  }
}

import { join } from 'node:path'
import { assert, assertIncludes, openRecent, selectOption, waitFile } from '../lib/kit.mjs'

const sketch = 'float temperature = 21.5f;\n\nvoid setup() {}\nvoid loop() {}\n'
const choices = [['SitePicoW', 'rpipicow'], ['SitePico2W', 'rpipico2w'], ['WiredPico', 'rpipico']]

export default {
  id: 'ai',
  title: 'Веб-дизайнер: Pico W и Pico 2 W подключают страницу к скетчу, Pico без Wi-Fi — только экспорт',
  arduino: 'ard2',
  files: Object.fromEntries(choices.flatMap(([name, id]) => [
    [`${name}/${name}.ino`, sketch],
    [`${name}/sketch.yaml`, `default_fqbn: rp2040:rp2040:${id}\n`]
  ])),
  projects: choices.map(([name]) => name),
  async run({ page, sketchbook }) {
    for (const [name] of choices.slice(0, 2)) {
      await openRecent({ page }, name)
      await page.click('[data-testid=act-ui]')
      await page.click({ sel: '[data-testid=not-esp-stub] button', text: 'Открыть веб-дизайнер' })
      await page.waitExists('[data-testid=wd-insert]')
      assertIncludes(await page.text('[data-testid=wd-context]'), 'Pico W / Pico 2 W', 'видна поддерживаемая платформа')
      await page.click({ sel: '.wd-pal-item', text: 'Датчик' })
      await page.click({ sel: '.wd-ins-tabs [role=tab]', text: 'Связь' })
      await page.click({ sel: '.wd-segs button', text: 'Переменная' })
      await selectOption(page, '[data-testid=wd-bind-var]', 's:temperature')
      await page.click('[data-testid=wd-insert]')
      await page.eval(`document.querySelectorAll('.uib-more-details').forEach((d) => { d.open = true })`)
      assertIncludes(await page.text('[data-testid=wd-insert-dialog]'), 'RPAsyncTCP', 'в диалоге названа библиотека для Pico')
      await page.click('[data-testid=wd-insert-confirm]')
      await page.waitExists('[data-testid=wd-insert-result].ok')
      const dir = join(sketchbook, name)
      const header = await waitFile(join(dir, 'web_generated.h'), '#include <RPAsyncTCP.h>')
      assertIncludes(header, 'wd_send("temperature", temperature)', 'страница читает переменную скетча')
      assertIncludes(await waitFile(join(dir, 'web_design.json'), '"pico-w"'), '"external": true', 'привязка сохранена')
      await page.click({ sel: '.uib-modal button', text: 'Закрыть' })
      await page.click({ sel: '[data-testid=tab]', text: `${name}.ino` })
      await page.key('s', { ctrl: true })
      const saved = await waitFile(join(dir, `${name}.ino`), 'wdBegin();')
      assertIncludes(saved, 'wdLoop();', 'обновление страницы подключено в loop()')
      await page.click('[data-testid=hdr-close-project]')
      await page.waitExists('[data-testid=start-screen]')
    }

    await openRecent({ page }, 'WiredPico')
    await page.click('[data-testid=act-web]')
    await page.waitExists('[data-testid=wd-publish]')
    assert(!(await page.exists('[data-testid=wd-insert]')), 'Pico без Wi-Fi не предлагает подключение')
    await page.click('[data-testid=wd-publish]')
    assertIncludes(await page.text('[data-testid=wd-publish-dialog]'), 'Это статический экспорт', 'граница возможностей названа явно')
  }
}

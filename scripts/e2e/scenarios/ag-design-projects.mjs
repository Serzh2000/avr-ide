import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assert, assertEq, openRecent, readText, selectOption } from '../lib/kit.mjs'

const sketch = 'void setup() {}\nvoid loop() {}\n'
const config = 'default_fqbn: esp32:esp32:esp32\n'

const openWeb = async (page) => {
  await page.click('[data-testid=act-web]')
  await page.waitExists('[data-testid=wd-view]')
}
const openEspUi = async (page) => {
  await page.click('[data-testid=act-ui]')
  await page.waitExists('[data-testid=uib-view]')
}
const closeProject = async (page) => {
  await page.click('[data-testid=hdr-close-project]')
  await page.waitExists('[data-testid=start-screen]')
}
const addedBlocks = (blocks) => blocks.flatMap((block) =>
  [...(block.type === 'section' || block.id === 'title' ? [] : [block.type]), ...addedBlocks(block.children)])
const jsonBlocks = (dir) => addedBlocks(JSON.parse(readText(join(dir, 'web_design.json'))).blocks).join(',')
const jsonElements = (dir) => JSON.parse(readText(join(dir, 'ui.json'))).tabs.flatMap((tab) => tab.elements)

export default {
  id: 'ag',
  title: 'Черновики конструкторов изолированы по проектам, внешние правки не затираются',
  arduino: 'ard2',
  files: {
    'DraftA/DraftA.ino': sketch, 'DraftA/sketch.yaml': config,
    'DraftB/DraftB.ino': sketch, 'DraftB/sketch.yaml': config
  },
  projects: ['DraftA', 'DraftB'],
  async run({ page, sketchbook }) {
    const a = join(sketchbook, 'DraftA')
    const b = join(sketchbook, 'DraftB')
    await page.eval('window.__avrStores.useUi.getState().setSettings({ autoRegenPage: false })')
    await openRecent({ page }, 'DraftA')
    await openWeb(page)
    await page.click({ sel: '.wd-pal-item', text: 'Заголовок' })
    await openEspUi(page)
    await page.click('[data-testid=uib-pal][data-type=label]')
    // Смена проекта сразу после правки, до обычного таймера автосохранения.
    await closeProject(page)
    assertEq(jsonBlocks(a), 'heading', 'в папке A сохранён веб-черновик')
    assertEq(jsonElements(a).map((element) => element.type).join(','), 'label', 'в папке A сохранён ESPUI-черновик')
    assert(!existsSync(join(a, 'web_generated.h')), 'автосохранение черновика не генерирует заголовок')
    assert(!existsSync(join(a, 'ui_generated.h')), 'автосохранение ESPUI не генерирует заголовок')

    await openRecent({ page }, 'DraftB')
    assert(!(await page.eval(`window.api.fs.writeSketchFile(${JSON.stringify(a)}, 'ui.json', '{}').then((result) => result.ok)`)),
      'IPC отклоняет файл прежней папки после смены проекта')
    await openWeb(page)
    await selectOption(page, '[data-testid=wd-view]', 'json')
    assert(!addedBlocks(JSON.parse(await page.text('[data-testid=wd-workspace] pre')).blocks).length, 'веб-модель B содержит только начальную страницу')
    await page.click('[data-testid=wd-return]')
    await page.click({ sel: '.wd-pal-item', text: 'Текст' })
    await openEspUi(page)
    await selectOption(page, '[data-testid=uib-view]', 'links')
    assertEq(await page.count('.uib-linktable tbody tr'), 0, 'модель ESPUI B пуста')
    await page.click('[data-testid=uib-return]')
    await page.click('[data-testid=uib-pal][data-type=slider]')
    await closeProject(page)
    assertEq(jsonBlocks(b), 'text', 'в папке B своя веб-модель')
    assertEq(jsonElements(b).map((element) => element.type).join(','), 'slider', 'в папке B своя модель ESPUI')

    await openRecent({ page }, 'DraftA')
    await openWeb(page)
    await selectOption(page, '[data-testid=wd-view]', 'json')
    assertEq(addedBlocks(JSON.parse(await page.text('[data-testid=wd-workspace] pre')).blocks).join(','),
      'heading', 'при повторном открытии восстановлена веб-модель A')
    await openEspUi(page)
    await selectOption(page, '[data-testid=uib-view]', 'links')
    assertEq(await page.count('.uib-linktable tbody tr'), 1, 'при повторном открытии восстановлена модель ESPUI A')

    // Меняем файл вне приложения, пока холст ещё показывает предыдущую версию.
    const webFile = join(a, 'web_design.json')
    const uiFile = join(a, 'ui.json')
    const web = JSON.parse(readText(webFile))
    const withoutHeading = (blocks) => blocks.filter((block) => block.type !== 'heading')
      .map((block) => ({ ...block, children: withoutHeading(block.children) }))
    web.blocks = withoutHeading(web.blocks)
    const externalWeb = JSON.stringify(web)
    writeFileSync(webFile, externalWeb)
    await page.eval('window.dispatchEvent(new Event("focus"))')
    await openWeb(page)
    await page.click('[data-testid=wd-return]')
    await page.click({ sel: '.wd-pal-item', text: 'Текст' })
    await page.waitFor(`document.querySelector('[data-testid=toast]')?.textContent.includes('web_design.json изменился вне конструктора')`)
    assertEq(readText(webFile), externalWeb, 'автосохранение не затирает внешнюю правку веб-страницы')
    await page.click('[data-testid=wd-insert]')
    const insert = '[data-testid=wd-insert-confirm]'
    await page.click(insert)
    if (!(await page.exists('[data-testid=wd-insert-result]'))) await page.click(insert)
    await page.waitExists('[data-testid=wd-insert-result]')
    assertEq(readText(webFile), externalWeb, 'подключение не затирает внешнюю правку')
    assert(!existsSync(join(a, 'web_generated.h')), 'при конфликте подключения заголовок не создан')
    await page.key('Escape')
    await page.click('[data-testid=hdr-close-project]')
    await page.click({ sel: '[role=dialog] button', text: 'Остаться в проекте' })
    await page.waitGone('[role=dialog]')
    await selectOption(page, '[data-testid=wd-view]', 'json')
    assertEq(addedBlocks(JSON.parse(await page.text('[data-testid=wd-workspace] pre')).blocks).join(','), 'heading,text',
      'отмена закрытия оставляет черновик для экспорта')
    await page.click('[data-testid=hdr-close-project]')
    await page.click({ sel: '[role=dialog] button', text: 'Продолжить без правок страницы' })
    await page.waitExists('[data-testid=start-screen]')
    await openRecent({ page }, 'DraftA')
    await openWeb(page)
    await selectOption(page, '[data-testid=wd-view]', 'json')
    assertEq(addedBlocks(JSON.parse(await page.text('[data-testid=wd-workspace] pre')).blocks).length, 0, 'после открытия холст читает внешнюю версию')

    await openEspUi(page)
    await selectOption(page, '[data-testid=uib-view]', 'design')
    const ui = JSON.parse(readText(uiFile))
    for (const tab of ui.tabs) tab.elements = []
    const externalUi = JSON.stringify(ui)
    writeFileSync(uiFile, externalUi)
    await page.click('[data-testid=uib-pal][data-type=slider]')
    await page.waitFor(`document.querySelector('[data-testid=toast]')?.textContent.includes('ui.json изменился вне конструктора')`)
    await page.click('[data-testid=hdr-close-project]')
    await page.click({ sel: '[role=dialog] button', text: 'Продолжить без правок страницы' })
    await page.waitExists('[data-testid=start-screen]')
    assertEq(readText(uiFile), externalUi, 'при закрытии внешняя правка ESPUI сохранена')
  }
}

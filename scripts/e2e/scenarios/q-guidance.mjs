// Подсказки без платы: «Дальше» после сборки/загрузки/ошибки, баннер FailHint, тост с действием, компактная панель.
// Состояния сборки подставляются в хранилище (window.__avrStores), снимки — в папку из AVRIDE_E2E_SHOTS (если задана).
import { join } from 'node:path'
import { assert, assertEq, assertIncludes, openRecent } from '../lib/kit.mjs'
import { sleep } from '../lib/cdp.mjs'

const shotDir = process.env.AVRIDE_E2E_SHOTS

export default {
  id: 'q',
  title: 'Подсказки: «Дальше» по состояниям, баннер ошибки с кнопкой, тост с действием, компактная панель',
  arduino: 'ard2',
  files: { 'Guide1/Guide1.ino': 'void setup() {\n}\n\nvoid loop() {\n}\n', 'Guide1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Guide1'],
  async run({ page }) {
    await openRecent({ page }, 'Guide1')
    const shot = async (n) => { if (shotDir) { await sleep(300); await page.shot(join(shotDir, n + '.png')) } }
    const next = () => page.eval(`document.querySelector('[data-testid=next-step]')?.textContent ?? ''`)
    const setBuild = (r, problems = [], log = '') => page.eval(`window.__avrStores.useBuild.setState({ result: ${JSON.stringify(r)}, problems: ${JSON.stringify(problems)}, log: ${JSON.stringify(log)} })`)

    // Сборка прошла, порт не выбран → «выберите порт»
    await page.eval(`window.__avrStores.useUi.setState({ port: '' })`)
    await setBuild({ kind: 'compile', ok: true, cancelled: false, size: null, at: 1 })
    await page.waitFor(`/порт/.test(document.querySelector('[data-testid=next-step]')?.textContent ?? '')`, { what: '«Дальше» просит порт' })
    await shot('q1-next-port')
    // Загрузка прошла → «монитор порта»
    await setBuild({ kind: 'upload', ok: true, cancelled: false, size: null, at: 2 })
    await page.waitFor(`/монитор/.test(document.querySelector('[data-testid=next-step]')?.textContent ?? '')`, { what: '«Дальше» предлагает монитор' })
    await page.click('[data-testid=next-step]')
    await page.waitFor(`document.querySelector('[data-testid=btab-monitor]')?.getAttribute('aria-selected') === 'true'`, { what: 'открыт монитор порта' })
    await shot('q2-next-monitor')

    // Ошибка: нет заголовка → баннер с кнопкой «Библиотеки»
    const msg = 'fatal error: DHT.h: No such file or directory'
    await setBuild({ kind: 'compile', ok: false, cancelled: false, size: null, at: 3 }, [{ severity: 'error', file: null, line: 1, column: 1, message: msg }], msg)
    await page.eval(`window.__avrStores.useUi.setState({ bottomVisible: true, bottomTab: 'problems' })`)
    await page.waitExists('[data-testid=fail-hint]', { what: 'баннер объяснения ошибки' })
    assertIncludes(await page.text('[data-testid=fail-hint]'), 'DHT.h', 'в баннере имя файла')
    assertIncludes(await next(), 'Исправьте', '«Дальше» после ошибки')
    await shot('q3-failhint')
    await page.click('[data-testid=fail-hint] button')
    await page.waitFor(`window.__avrStores.useUi.getState().sideView === 'libs'`, { what: 'кнопка баннера открыла «Библиотеки»' })

    // Тост с действием
    await page.eval(`window.__avrStores.useUi.getState().notify('Проверка тоста', { kind: 'ok', action: { label: 'Действие', run: () => { window.__toastRan = true } } })`)
    await page.waitExists('[data-testid=toast]', { what: 'тост' })
    await shot('q4-toast')
    await page.click('[data-testid=toast] .btn')
    assert(await page.eval('window.__toastRan === true'), 'действие тоста выполнено')
    await page.waitFor(`!document.querySelector('[data-testid=toast]')`, { what: 'тост закрылся' })

    // Единая подсказка: наведение на «Проверить» показывает текст и горячую клавишу
    const rc = await page.eval(`(() => { const r = document.querySelector('[data-testid=hdr-verify]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
    await page.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rc.x, y: rc.y })
    await page.waitFor(`/Проверить/.test(document.querySelector('[role=tooltip]')?.textContent ?? '') && /Ctrl[+]B/.test(document.querySelector('[role=tooltip] kbd')?.textContent ?? '')`, { what: 'подсказка с горячей клавишей' })
    await shot('q6-tooltip')
    await page.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 700 })

    // Клавиатура в поповере выбора платы: Esc закрывает и возвращает фокус на кнопку, стрелки двигают по пунктам
    await page.click('[data-testid=hdr-board]')
    await page.waitExists('.board-pop', { what: 'поповер платы' })
    await page.key('ArrowDown')
    assert(await page.eval(`document.activeElement?.classList.contains('pop-item')`), 'стрелка вниз перевела фокус на пункт списка')
    await page.key('Escape')
    await page.waitFor(`!document.querySelector('.board-pop')`, { what: 'Esc закрыл поповер' })
    await page.waitFor(`document.activeElement?.getAttribute('data-testid') === 'hdr-board'`, { what: 'фокус вернулся на кнопку платы' })

    // Компактная боковая панель
    const w = () => page.eval(`document.querySelector('[data-testid=activity]').getBoundingClientRect().width`)
    const full = await w()
    await page.eval(`window.__avrStores.useUi.getState().setSettings({ compactRail: true })`)
    await sleep(200)
    assertEq(await w(), 48, 'компактная панель 48 px')
    assert(full > 48, 'обычная панель шире компактной')
    await shot('q5-compact')
    await page.eval(`window.__avrStores.useUi.getState().setSettings({ compactRail: false })`)
  }
}

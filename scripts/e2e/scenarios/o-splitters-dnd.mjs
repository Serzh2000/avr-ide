import { assert, assertEq, openRecent } from '../lib/kit.mjs'
import { sleep } from '../lib/cdp.mjs'

// Мышью: сплиттеры боковых панелей обоих конструкторов (перетаскивание, запоминание, клавиатура, сброс),
// drag-and-drop узлов в деревьях «Структура», выезжающая панель веб-дизайнера в узком окне.
export default {
  id: 'o',
  title: 'Сплиттеры панелей и drag-and-drop в деревьях структуры (ESPUI и веб-дизайнер), панель-drawer в узком окне',
  arduino: 'ard2',
  timeout: 150000,
  files: { 'Dnd1/Dnd1.ino': 'float temperature;\nvoid setup() {\n}\nvoid loop() {\n}\n', 'Dnd1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Dnd1'],
  async run({ page, log }) {
    await page.setWindowSize(1344, 800)
    await openRecent({ page }, 'Dnd1')
    const widthOf = async (sel) => Math.round((await page.rectOf(sel)).w)
    const stored = (key) => page.eval(`localStorage.getItem(${JSON.stringify(key)})`)
    const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg} (ожидалось ≈${b}, получено ${a})`)

    // ---------- конструктор ESPUI ----------
    await page.click('[data-testid=act-ui]')
    await page.waitExists('[data-testid=uib]')
    await page.waitExists('[data-testid=uib-split-l]')
    await sleep(500)
    log('ESPUI: сплиттеры')
    const l0 = await widthOf('.uib-palette')
    await page.dragSplitter('[data-testid=uib-split-l]', 60)
    await sleep(150)
    near(await widthOf('.uib-palette'), l0 + 60, 3, 'левая панель стала шире на 60px')
    const lSaved = await stored('avride.uib.leftWidth')
    near(Number(lSaved), l0 + 60, 3, 'ширина левой панели запомнена в localStorage')
    await page.dragSplitter('[data-testid=uib-split-l]', -5000)
    await sleep(150)
    assert((await widthOf('.uib-palette')) >= 176, 'левая панель не уже минимума')
    // клавиатура и сброс по двойному клику
    await page.eval(`document.querySelector('[data-testid=uib-split-l]').focus()`)
    const l1 = await widthOf('.uib-palette')
    await page.key('ArrowRight')
    await sleep(100)
    near(await widthOf('.uib-palette'), l1 + 12, 2, 'стрелка вправо расширяет панель на шаг')
    await page.clickExpr(`document.querySelector('[data-testid=uib-split-l]')`, { clickCount: 2 })
    await sleep(150)
    near(await widthOf('.uib-palette'), 208, 2, 'двойной клик возвращает ширину по умолчанию')

    const r0 = await widthOf('.uib-inspector')
    await page.dragSplitter('[data-testid=uib-split-r]', -50)
    await sleep(150)
    near(await widthOf('.uib-inspector'), r0 + 50, 3, 'правая панель стала шире на 50px')
    near(Number(await stored('avride.uib.rightWidth')), r0 + 50, 3, 'ширина инспектора запомнена')
    await page.dragSplitter('[data-testid=uib-split-r]', 5000)
    await sleep(150)
    assert((await widthOf('.uib-inspector')) >= 260, 'инспектор не уже минимума')

    log('ESPUI: дерево структуры')
    for (const t of ['button', 'slider', 'switcher']) await page.click(`[data-testid=uib-pal][data-type=${t}]`)
    await page.click('[data-testid=uib-ltab-tree]')
    await page.waitFor(`document.querySelectorAll('[data-testid=uib-tree-el]').length >= 3`, { what: 'в дереве три элемента' })
    const order = () => page.eval(`[...document.querySelectorAll('[data-testid=uib-tree-el]')].map((e) => e.dataset.id)`)
    const before = await order()
    assert(before.length >= 3, 'в дереве не меньше трёх элементов')
    const first = before[0]
    const last = before[before.length - 1]
    await page.dragAndDrop(`[data-testid=uib-tree-el][data-id="${first}"]`, `[data-testid=uib-tree-el][data-id="${last}"]`, 'bottom')
    await page.waitFor(`document.querySelector('[data-testid=uib-tree-el]')?.dataset.id !== ${JSON.stringify(first)}`, { what: 'первый узел переехал' })
    const after = await order()
    assertEq(after[after.length - 1], first, 'перетащенный узел оказался последним')
    assertEq(after.length, before.length, 'число элементов не изменилось')
    // перенос «внутрь вкладки» — в конец
    await page.dragAndDrop(`[data-testid=uib-tree-el][data-id="${after[0]}"]`, '[data-testid=uib-tree-tab]', 'center')
    await sleep(200)
    const after2 = await order()
    assertEq(after2[after2.length - 1], after[0], 'узел, брошенный на вкладку, ушёл в конец')

    // ---------- веб-дизайнер ----------
    await page.click('[data-testid=act-web]')
    await page.waitExists('.wd')
    await page.waitExists('.wd-split-l .splitter')
    log('веб-дизайнер: сплиттеры')
    const wl0 = await widthOf('.wd-left')
    await page.dragSplitter('.wd-split-l .splitter', 50)
    await sleep(150)
    near(await widthOf('.wd-left'), wl0 + 50, 3, 'левая панель веб-дизайнера стала шире')
    assert(/"leftWidth":\d+/.test((await stored('avride.webdesign.layout.v1')) ?? ''), 'ширина запомнена (layout.v1)')
    const wr0 = await widthOf('.wd-inspector')
    await page.dragSplitter('.wd-split-r .splitter', -40)
    await sleep(150)
    near(await widthOf('.wd-inspector'), wr0 + 40, 3, 'инспектор веб-дизайнера стал шире')

    log('веб-дизайнер: дерево, drag-and-drop')
    for (const t of ['Кнопка', 'Ползунок', 'Переключатель']) await page.click({ sel: '.wd-pal-item', text: t })
    await page.click({ sel: '.wd-ltab', text: 'Структура' })
    // две соседние строки одного уровня (одного родителя), глубина ≥ 2
    const pair = await page.eval(`(() => {
      const rows = [...document.querySelectorAll('.wd-tree-row')]
      for (let i = 0; i + 1 < rows.length; i++) {
        const a = rows[i], b = rows[i + 1]
        if (a.getAttribute('aria-level') === b.getAttribute('aria-level') && Number(a.getAttribute('aria-level')) >= 2) {
          const id = (r) => r.querySelector('.wd-tree-id').textContent
          return { a: id(a), b: id(b) }
        }
      }
      return null
    })()`)
    assert(pair, 'в дереве есть два соседних блока одного уровня')
    const rowOf = (id) => ({ sel: '.wd-tree-row', text: id })
    const wdOrder = () => page.eval(`[...document.querySelectorAll('.wd-tree-row .wd-tree-id')].map((e) => e.textContent)`)
    const w0 = await wdOrder()
    await page.dragAndDrop(rowOf(pair.a), rowOf(pair.b), 'bottom')
    await page.waitFor(`(() => { const ids = [...document.querySelectorAll('.wd-tree-row .wd-tree-id')].map((e) => e.textContent); return ids.indexOf(${JSON.stringify(pair.a)}) > ids.indexOf(${JSON.stringify(pair.b)}) })()`, { what: 'блок переехал ниже соседа' })
    const w1 = await wdOrder()
    assertEq(w1.length, w0.length, 'число узлов в дереве не изменилось')

    // ---------- узкое окно: панель-drawer ----------
    log('веб-дизайнер: узкое окно')
    await page.setWindowSize(760, 760)
    await page.waitExists('[data-testid=wd-strip-tree]')
    await page.waitFor(`!document.querySelector('.wd-left.open')`, { what: 'панель закрыта по умолчанию' })
    await page.click('[data-testid=wd-strip-tree]')
    await page.waitExists('.wd-left.open .wd-tree-row')
    await sleep(400) // конец анимации выезда
    assert((await page.count('.wd-left.open .wd-tree-row')) >= 3, 'в выезжающей панели видно дерево структуры')
    await page.click({ sel: '.wd-left.open .wd-ltab', text: 'Блоки' })
    await page.waitExists('.wd-left.open .wd-pal-item')
    await page.key('Escape')
    await page.waitFor(`!document.querySelector('.wd-left.open')`, { what: 'Esc закрывает панель' })
    await page.click('[data-testid=wd-strip-blocks]')
    await page.waitExists('.wd-left.open .wd-pal-item')
    await sleep(400)
    await page.click('[data-testid=wd-left-close]')
    await page.waitFor(`!document.querySelector('.wd-left.open')`, { what: 'кнопка «Закрыть» закрывает панель' })
    await page.setWindowSize(1344, 800)
  }
}

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
    const PANEL_KEYS = ['avride.uib.leftWidth', 'avride.uib.rightWidth', 'avride.webdesign.layout.v1']
    const resetPrefs = () => page.eval(`${JSON.stringify(PANEL_KEYS)}.forEach((k) => localStorage.removeItem(k))`)
    await resetPrefs()
    await page.setWindowSize(1344, 800)
    assertEq(await page.eval('outerWidth'), 1344, 'ширина окна')
    await openRecent({ page }, 'Dnd1')
    // ширина после того, как layout устоялся (три опроса подряд одинаковы)
    const settled = (sel) => page.settle(`Math.round(document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect().width)`, { what: 'ширина ' + sel })
    // сдвиг не меньше 60% от запрошенного и в нужную сторону (точное значение зависит от clamp-ов и размера окна)
    const grew = (before, after, want, msg) => assert((after - before) * Math.sign(want) >= Math.abs(want) * 0.6, `${msg} (было ${before}, стало ${after}, просили ${want > 0 ? '+' : ''}${want})`)

    // ---------- конструктор ESPUI ----------
    await page.click('[data-testid=act-ui]')
    await page.waitExists('[data-testid=uib]')
    await page.waitExists('[data-testid=uib-split-l]')
    await resetPrefs()
    // значения по умолчанию и границы — из исходника (UiBuilder.tsx), а не магические числа
    const LEFT = { def: 208, min: 176, max: 420 }, RIGHT = { def: 300, min: 260, max: 560 }
    log('ESPUI: сплиттеры')
    const l0 = await settled('.uib-palette')
    await page.dragSplitter('[data-testid=uib-split-l]', 60)
    const l1a = await settled('.uib-palette')
    grew(l0, l1a, 60, 'левая панель стала шире')
    await page.waitFor(`Math.abs(Number(localStorage.getItem('avride.uib.leftWidth')) - ${l1a}) <= 2`, { what: 'ширина левой панели запомнена в localStorage' })
    await page.dragSplitter('[data-testid=uib-split-l]', -5000)
    const lMin = await settled('.uib-palette')
    assert(lMin >= LEFT.min && lMin < l1a, `левая панель сузилась, но не уже минимума (${lMin})`)
    // клавиатура и сброс по двойному клику
    await page.eval(`document.querySelector('[data-testid=uib-split-l]').focus()`)
    await page.key('ArrowRight')
    const lKey = await settled('.uib-palette')
    assert(Math.abs(lKey - (lMin + 12)) <= 2, `стрелка вправо расширяет панель на шаг (было ${lMin}, стало ${lKey})`)
    await page.clickExpr(`document.querySelector('[data-testid=uib-split-l]')`, { clickCount: 2 })
    await page.waitFor(`Math.abs(document.querySelector('.uib-palette').getBoundingClientRect().width - ${LEFT.def}) <= 2`, { what: 'двойной клик возвращает ширину по умолчанию ' + LEFT.def })
    // перетаскивание вправо упирается в максимум и не выходит за него
    await page.dragSplitter('[data-testid=uib-split-l]', 5000)
    const lMax = await settled('.uib-palette')
    assert(lMax > LEFT.def && lMax <= LEFT.max, `левая панель расширилась до максимума (${lMax})`)
    await page.clickExpr(`document.querySelector('[data-testid=uib-split-l]')`, { clickCount: 2 })
    await page.waitFor(`Math.abs(document.querySelector('.uib-palette').getBoundingClientRect().width - ${LEFT.def}) <= 2`, { what: 'повторный сброс до ' + LEFT.def })

    const r0 = await settled('.uib-inspector')
    await page.dragSplitter('[data-testid=uib-split-r]', -50)
    const r1 = await settled('.uib-inspector')
    grew(r0, r1, 50, 'правая панель стала шире')
    await page.waitFor(`Math.abs(Number(localStorage.getItem('avride.uib.rightWidth')) - ${r1}) <= 2`, { what: 'ширина инспектора запомнена' })
    await page.dragSplitter('[data-testid=uib-split-r]', 5000)
    const rMin = await settled('.uib-inspector')
    assert(rMin >= RIGHT.min && rMin < r1, `инспектор сузился, но не уже минимума (${rMin})`)

    log('ESPUI: дерево структуры')
    for (const t of ['button', 'slider', 'switcher']) await page.click(`[data-testid=uib-pal][data-type=${t}]`)
    await page.click('[data-testid=uib-ltab-tree]')
    await page.waitFor(`document.querySelectorAll('[data-testid=uib-tree-el]').length >= 3`, { what: 'в дереве три элемента' })
    await page.settle(`[...document.querySelectorAll('[data-testid=uib-tree-el]')].map((e) => Math.round(e.getBoundingClientRect().top))`, { what: 'строки дерева на месте' })
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
    await page.waitFor(`document.querySelector('[data-testid=uib-tree-el]')?.dataset.id !== ${JSON.stringify(after[0])}`, { what: 'узел переехал на вкладку' })
    const after2 = await order()
    assertEq(after2[after2.length - 1], after[0], 'узел, брошенный на вкладку, ушёл в конец')

    // ---------- веб-дизайнер ----------
    await page.click('[data-testid=act-web]')
    await page.waitExists('.wd')
    await page.waitExists('.wd-split-l .splitter')
    await page.eval(`localStorage.removeItem('avride.webdesign.layout.v1')`)
    log('веб-дизайнер: сплиттеры')
    const wl0 = await settled('.wd-left')
    await page.dragSplitter('.wd-split-l .splitter', 50)
    grew(wl0, await settled('.wd-left'), 50, 'левая панель веб-дизайнера стала шире')
    await page.waitFor(`/"leftWidth":\[0-9]+/.test(localStorage.getItem('avride.webdesign.layout.v1') ?? '')`, { what: 'ширина запомнена (layout.v1)' })
    const wr0 = await settled('.wd-inspector')
    await page.dragSplitter('.wd-split-r .splitter', -40)
    grew(wr0, await settled('.wd-inspector'), 40, 'инспектор веб-дизайнера стал шире')

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
    assertEq(await page.eval('outerWidth'), 760, 'ширина окна')
    await page.waitExists('[data-testid=wd-strip-tree]')
    await page.waitFor(`!document.querySelector('.wd-left.open')`, { what: 'панель закрыта по умолчанию' })
    await page.click('[data-testid=wd-strip-tree]')
    await page.waitExists('.wd-left.open .wd-tree-row')
    await page.settle(`Math.round(document.querySelector('.wd-left.open').getBoundingClientRect().left)`, { what: 'конец анимации выезда' })
    assert((await page.count('.wd-left.open .wd-tree-row')) >= 3, 'в выезжающей панели видно дерево структуры')
    await page.click({ sel: '.wd-left.open .wd-ltab', text: 'Блоки' })
    await page.waitExists('.wd-left.open .wd-pal-item')
    await page.key('Escape')
    await page.waitFor(`!document.querySelector('.wd-left.open')`, { what: 'Esc закрывает панель' })
    await page.click('[data-testid=wd-strip-blocks]')
    await page.waitExists('.wd-left.open .wd-pal-item')
    await page.settle(`Math.round(document.querySelector('.wd-left.open').getBoundingClientRect().left)`, { what: 'конец анимации выезда' })
    await page.click('[data-testid=wd-left-close]')
    await page.waitFor(`!document.querySelector('.wd-left.open')`, { what: 'кнопка «Закрыть» закрывает панель' })
    await page.setWindowSize(1344, 800)
  }
}

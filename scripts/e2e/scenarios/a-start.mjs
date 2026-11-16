import { assert, assertEq } from '../lib/kit.mjs'

export default {
  id: 'a',
  title: 'Старт: только две кнопки, нет панелей и строки состояния',
  async run({ page }) {
    await page.waitExists('[data-testid=start-screen]')
    assertEq(await page.text('[data-testid=start-create]').then((t) => t.split('\n')[0]), 'Создать проект', 'подпись первой кнопки')
    assertEq(await page.text('[data-testid=start-open]').then((t) => t.split('\n')[0]), 'Открыть проект', 'подпись второй кнопки')
    // крупные кнопки действий — ровно две; больше ничего нажимаемого, кроме смены темы
    assertEq(await page.count('.start-actions button'), 2, 'число больших кнопок')
    for (const sel of ['.activity', '.side', '.statusbar', '.header', '.tabbar', '.bottom', '.workbench', '.monaco-editor']) {
      assertEq(await page.count(sel), 0, `на старте не должно быть «${sel}»`)
    }
    assertEq(await page.count('[data-testid=recent], [data-testid=start-recent]'), 0, 'в чистой среде нет недавних проектов')
    // Горячие клавиши рабочей среды на старте не действуют (Ctrl+Shift+P — палитра, Ctrl+B — сборка)
    await page.key('p', { ctrl: true, shift: true })
    await page.key('b', { ctrl: true })
    await new Promise((r) => setTimeout(r, 300))
    assertEq(await page.count('.palette, [role=dialog]'), 0, 'палитра не открывается без проекта')
    assert(await page.eval(`document.documentElement.scrollWidth <= window.innerWidth + 1`), 'нет горизонтального скролла')
  }
}

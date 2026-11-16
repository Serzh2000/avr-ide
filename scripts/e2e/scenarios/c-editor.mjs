import { join } from 'node:path'
import { assert, assertIncludes, editorText, openRecent, waitFile } from '../lib/kit.mjs'
import { sleep } from '../lib/cdp.mjs'

const INO = 'void setup() {\n}\n\nvoid loop() {\n}\n'

export default {
  id: 'c',
  title: 'Редактор: ввод, Ctrl+S на диск, автодополнение, F1 → справочник',
  arduino: 'ard2',
  files: { 'Edit1/Edit1.ino': INO, 'Edit1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Edit1'],
  async run({ page, sketchbook }) {
    await openRecent({ page }, 'Edit1')
    const ino = join(sketchbook, 'Edit1', 'Edit1.ino')

    // Ввод: заменяем весь текст
    await page.click('.view:not([hidden]) .monaco-editor .view-lines')
    await page.key('a', { ctrl: true })
    await page.insertText('// e2e\nvoid setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n}\n')
    await page.waitFor(`document.querySelector('[data-testid=tab][aria-selected=true] .tab-close.dirty')`, { what: 'вкладка помечена изменённой' })
    assertIncludes(await editorText(page), '// e2e', 'текст появился в редакторе')
    await page.key('s', { ctrl: true })
    const saved = await waitFile(ino, '// e2e')
    assertIncludes(saved, 'Serial.begin(115200);', 'файл на диске')
    await page.waitFor(`!document.querySelector('[data-testid=tab][aria-selected=true] .tab-close.dirty')`, { what: 'пометка изменений снята' })

    // Автодополнение: набираем начало слова, затем Ctrl+Space
    await page.key('End', { ctrl: true })
    await page.insertText('\nvoid f() { pinM')
    await sleep(300)
    await page.key(' ', { ctrl: true })
    await page.waitFor(`(() => { const w = document.querySelector('.suggest-widget.visible'); return !!w && /pinMode/.test(w.innerText) })()`, { timeout: 8000, what: 'подсказка pinMode в списке автодополнения' })
    await page.key('Escape')

    // F1 на слове открывает справочник по этому слову
    await page.key('a', { ctrl: true })
    await page.insertText('void setup() {\n  Serial.begin(115200);\n}\nvoid loop() { digitalWrite(2, HIGH); }\n')
    await page.waitFor(`document.querySelector('.view:not([hidden]) .view-lines')?.textContent.includes('digitalWrite')`, { what: 'новый текст отрисован' })
    // курсор внутрь слова digitalWrite (строка 4), клавиатурой — надёжнее, чем клик по координатам
    await page.key('Home', { ctrl: true })
    for (let i = 0; i < 3; i++) await page.key('ArrowDown')
    await page.key('End')
    for (let i = 0; i < 16; i++) await page.key('ArrowLeft')
    await page.waitFor(`/Стр 4,/.test(document.querySelector('[data-testid=statusbar]')?.innerText ?? '')`, { what: 'курсор на строке 4' })
    await page.key('F1')
    await page.waitFor(`document.querySelector('[data-testid=tab][aria-selected=true]')?.innerText.includes('Справочник')`, { timeout: 8000, what: 'открылась вкладка «Справочник»' })
    const ref = await page.eval(`document.querySelector('.view:not([hidden])')?.innerText ?? ''`)
    assertIncludes(ref, 'digitalWrite', 'справочник показывает digitalWrite')
  }
}

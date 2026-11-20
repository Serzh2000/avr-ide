import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ARD2 } from '../lib/app.mjs'
import { assert, assertEq, assertIncludes } from '../lib/kit.mjs'
import { openRecent } from '../lib/kit.mjs'
const shotTo = process.env.AVRIDE_E2E_SHOTS

/** Слепок папки: путь → размер и время изменения (чтобы убедиться, что оригинал не тронут). */
function snapshot(dir) {
  const out = {}
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else { const s = statSync(p); out[p] = `${s.size}:${s.mtimeMs}` }
    }
  }
  if (existsSync(dir)) walk(dir)
  return out
}

export default {
  id: 'g',
  title: 'Примеры: панель, поиск, «Открыть как проект» (копия, оригинал не тронут)',
  arduino: 'ard2',
  files: { 'Ex1/Ex1.ino': 'void setup() {\n}\nvoid loop() {\n}\n', 'Ex1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Ex1'],
  async run({ page, sketchbook }) {
    const lib = join(ARD2, 'user', 'libraries', 'ESPUI')
    const before = snapshot(lib)
    assert(Object.keys(before).length > 0, 'в среде ard2 есть библиотека ESPUI с примерами')

    await openRecent({ page }, 'Ex1')
    await page.click('[data-testid=act-examples]')
    await page.waitExists('.examples-panel .ex-lib', { timeout: 30000, what: 'список примеров' })
    // поиск раскрывает библиотеки с совпадением
    await page.fill('.examples-panel input[aria-label="Поиск примеров"]', 'espui')
    await page.waitFor(`document.querySelectorAll('.examples-panel .ex-item').length > 0`, { what: 'найдены примеры ESPUI' })
    await page.click({ sel: '.examples-panel .ex-item', text: 'tabbedGui' })
    await page.waitExists('.ex-preview .ex-code')
    const code = await page.text('.ex-preview .ex-code')
    assertIncludes(code, 'setup', 'предпросмотр показывает код примера')

    // Предпросмотр — вкладка в основной области (не в боковой панели), список остаётся целиком
    assert(await page.eval(`!document.querySelector('.side .ex-preview') && !!document.querySelector('.editor-area .ex-preview')`), 'предпросмотр в основной области')
    assert(await page.eval(`document.querySelector('[data-testid=ex-open]').getBoundingClientRect().width > 120`), 'кнопка «Открыть как проект» заметная')
    shotTo && (await page.shot(join(shotTo, 'g1-preview.png')))

    // Многофайловый пример: вместо заглушки .ino по умолчанию показан содержательный .cpp
    await page.click({ sel: '.examples-panel .ex-item', text: 'completeExample' })
    await page.waitFor(`/основной код/.test(document.querySelector('.ex-files button.on')?.innerText ?? '')`, { what: 'по умолчанию выбран основной файл' })
    assertIncludes(await page.text('.ex-files button.on'), '.cpp', 'показан .cpp, а не заглушка .ino')
    assertIncludes(await page.text('.ex-files'), 'заглушка', 'заглушка .ino помечена')
    shotTo && (await page.shot(join(shotTo, 'g2-multifile.png')))

    // Enter на примере в списке — «Открыть как проект» (диалог имени), Esc отменяет
    await page.eval(`[...document.querySelectorAll('.examples-panel .ex-item')].find((b) => b.innerText.includes('tabbedGui')).focus()`)
    await page.key('Enter')
    await page.waitExists('#dlg-input', { what: 'Enter открыл диалог «Открыть как проект»' })
    await page.key('Escape')
    await page.waitGone('#dlg-input')
    await page.click({ sel: '.examples-panel .ex-item', text: 'tabbedGui' })

    // Открыть как проект: диалог ввода имени
    await page.click({ sel: '.ex-preview .btn', text: 'Открыть как проект' })
    await page.waitExists('#dlg-input')
    await page.fill('#dlg-input', 'ExCopy')
    await page.click({ sel: '.modal .btn.primary', text: 'Открыть' })
    await page.waitFor(`document.querySelector('[data-testid=hdr-title]')?.innerText === 'ExCopy'`, { timeout: 15000, what: 'открыт проект ExCopy' })
    assert(existsSync(join(sketchbook, 'ExCopy')), 'копия создана в папке скетчей')
    const files = readdirSync(join(sketchbook, 'ExCopy'))
    assert(files.some((f) => f.toLowerCase().endsWith('.ino')), 'в копии есть .ino: ' + files.join(', '))
    assertEq(JSON.stringify(snapshot(lib)), JSON.stringify(before), 'оригинальный пример в библиотеке не изменился')
    await page.waitFor(`!!document.querySelector('.monaco-editor .view-lines')`, { what: 'код примера открыт в редакторе' })
  }
}

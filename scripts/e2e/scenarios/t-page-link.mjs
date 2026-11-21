import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { assert, assertEq, assertIncludes, openRecent, waitFile, readText } from '../lib/kit.mjs'
import { sleep } from '../lib/cdp.mjs'

const INO = 'float temperature = 21.5;\nbool relay = false;\n\nvoid setup() {\n}\n\nvoid loop() {\n}\n'

export default {
  id: 't',
  title: 'Страница ↔ скетч: «Вставить в скетч» веб-дизайнера, переменные из скетча, автообновление кода перед «Проверить», конфликт с ESPUI',
  arduino: 'ard2',
  files: { 'Link1/Link1.ino': INO, 'Link1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Link1'],
  async run({ page, sketchbook, log }) {
    const dir = join(sketchbook, 'Link1')
    await openRecent({ page }, 'Link1')
    await page.click('[data-testid=act-web]')
    await page.waitExists('.wd')
    await page.waitExists('.wd-pal-item')

    // Состояние связи: не подключено; «Дальше» ещё не предлагает подключить (страницу не правили)
    await page.waitFor(`document.querySelector('[data-testid=wd-link]')?.getAttribute('data-state') === 'off'`, { what: 'плашка «Не подключено к скетчу»' })
    assertIncludes(await page.text('[data-testid=wd-link]'), 'Не подключено к скетчу', 'текст плашки')

    // Своя страница: «Датчик», привязанный к переменной скетча temperature (подхват из скетча без повторного объявления)
    await page.click({ sel: '.wd-pal-item', text: 'Датчик' })
    await page.click({ sel: '.wd-ins-tabs [role=tab]', text: 'Связь' })
    await page.click({ sel: '.wd-segs button', text: 'Переменная' })
    await page.waitExists('[data-testid=wd-bind-var]')
    await page.eval(`(() => { const s = document.querySelector('[data-testid=wd-bind-var]'); const o = [...s.options].find(o => o.value === 's:temperature'); if (!o) throw new Error('нет temperature в списке: ' + [...s.options].map(o => o.value).join()); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
    await page.waitFor(`document.querySelector('[data-testid=wd-bind-var]')?.value === 'temperature'`, { what: 'блок связан с temperature' })

    // Вкладка «Переменные»: temperature помечена «из скетча», relay предлагается подхватить
    await page.click({ sel: '.wd-tab', text: 'Переменные' })
    await page.waitFor(`/из скетча/.test(document.querySelector('[data-testid=wd-vars]')?.innerText ?? '')`, { what: 'переменная помечена «из скетча»' })
    await page.waitExists('[data-testid=wd-pick-sketch-var]')

    // «Вставить в скетч»
    await page.click('[data-testid=wd-insert]')
    await page.waitExists('[data-testid=wd-insert-confirm]')
    const diff = await page.text('.uib-diff')
    assertIncludes(diff, 'web_generated.h', 'в diff есть include')
    assertIncludes(diff, 'wdBegin();', 'в diff есть wdBegin()')
    await page.click('[data-testid=wd-insert-confirm]')
    await page.waitExists('[data-testid=wd-insert-result].ok', { what: 'результат вставки' })
    const header = await waitFile(join(dir, 'web_generated.h'), 'wdBegin')
    assertIncludes(header, 'wdLoop', 'web_generated.h содержит wdLoop')
    assertIncludes(header, 'wd_send("temperature", temperature)', 'страница показывает temperature')
    assert(!/^float temperature =/m.test(header), 'temperature не объявлена заново в web_generated.h')
    const json = await waitFile(join(dir, 'web_design.json'), 'temperature')
    assertIncludes(json, '"external": true', 'web_design.json помечает переменную «из скетча»')
    await page.click({ sel: '.uib-modal button', text: 'Закрыть' })

    // Скетч изменён в редакторе — сохраняем и проверяем файл на диске
    await page.click({ sel: '[data-testid=tab]', text: 'Link1.ino' })
    await page.key('s', { ctrl: true })
    const ino = await waitFile(join(dir, 'Link1.ino'), '#include "web_generated.h"')
    assertIncludes(ino, 'wdBegin();', 'в скетч добавлен wdBegin()')
    assertIncludes(ino, 'wdLoop();', 'в скетч добавлен wdLoop()')
    assertEq(ino.split('float temperature').length - 1, 1, 'temperature объявлена в скетче один раз')
    assert(ino.indexOf('bool relay') < ino.indexOf('#include "web_generated.h"'), 'include стоит ниже объявлений переменных')

    // Повторная вставка идемпотентна: «Что будет сделано» — всё уже на месте
    await page.click('[data-testid=act-web]')
    await page.waitExists('.wd')
    await page.waitFor(`document.querySelector('[data-testid=wd-link]')?.getAttribute('data-state') === 'ok'`, { what: 'плашка «Подключено, код актуален»' })
    await page.click('[data-testid=wd-insert]')
    await page.waitExists('[data-testid=wd-insert-confirm]')
    assertIncludes(await page.text('[data-testid=wd-insert-dialog]'), 'менять не нужно', 'повторная вставка ничего не меняет')
    await page.key('Escape')
    await page.waitGone('[data-testid=wd-insert-dialog]')

    // Меняем страницу: плашка «код устарел», страница сохраняется в web_design.json
    await page.click({ sel: '.wd-pal-item', text: 'Заголовок' })
    await page.waitFor(`document.querySelector('[data-testid=wd-link]')?.getAttribute('data-state') === 'stale'`, { what: 'плашка «Подключено, код устарел»' })
    await waitFile(join(dir, 'web_design.json'), 'Заголовок', 10000)
    const stale = readText(join(dir, 'web_generated.h'))

    // «Проверить»: перед сборкой код страницы обновляется молча, показывается короткий тост
    await page.click('[data-testid=hdr-verify]')
    await page.waitFor(`/Код страницы обновлён/.test(document.body.innerText)`, { timeout: 15000, what: 'тост «Код страницы обновлён»' })
    const fresh = readText(join(dir, 'web_generated.h'))
    assert(fresh !== stale, 'web_generated.h перегенерирован перед сборкой')
    assertIncludes(fresh, 'Заголовок', 'в обновлённом коде новый блок страницы')
    log('сборка запущена после обновления кода страницы')
    // Сборку не ждём (это делает сценарий u): останавливаем
    await page.click({ sel: '.hbtn.stop' }).catch(() => {})
    await page.waitFor(`!document.querySelector('.hbtn.stop')`, { timeout: 30000, what: 'сборка остановлена' })

    // Переменную переименовали в скетче: у блока проблема, прежний код не затирается, ведёт в конструктор
    await page.click({ sel: '[data-testid=tab]', text: 'Link1.ino' })
    await page.click('.view:not([hidden]) .monaco-editor .view-lines')
    await page.key('a', { ctrl: true })
    await page.insertText(readText(join(dir, 'Link1.ino')).replace(/float temperature = 21.5;/, 'float temp2 = 21.5;'))
    await page.key('s', { ctrl: true })
    await page.click('[data-testid=act-web]')
    await page.waitFor(`/удалили или переименовали/.test(document.querySelector('.wd-inspector, .wd')?.innerText ?? '')`, { what: 'у блока предупреждение о пропавшей переменной' })
    const before = readText(join(dir, 'web_generated.h'))
    await page.click('[data-testid=hdr-verify]')
    await page.waitFor(`/Открыть конструктор/.test(document.body.innerText)`, { timeout: 15000, what: 'сообщение с кнопкой «Открыть конструктор»' })
    assertEq(readText(join(dir, 'web_generated.h')), before, 'при ошибках страницы прежний web_generated.h не затирается')
    await page.click({ sel: '.hbtn.stop' }).catch(() => {})
    await page.waitFor(`!document.querySelector('.hbtn.stop')`, { timeout: 30000, what: 'сборка остановлена' })

    // Конфликт: подключаем ESPUI к тому же скетчу — предупреждение, замена по выбору
    await page.click('[data-testid=act-ui]')
    await page.waitExists('[data-testid=uib]')
    await page.click('[data-testid=uib-pal][data-type=label]')
    await page.click('[data-testid=uib-insert]')
    await page.waitExists('[data-testid=pl-conflict]', { what: 'предупреждение о конфликте двух страниц' })
    assertIncludes(await page.text('[data-testid=pl-conflict]'), 'порту 80', 'объяснение про порт 80')
    assert(!(await page.exists('[data-testid=uib-insert-confirm]')), 'без выбора вставка недоступна')
    await page.click('[data-testid=uib-insert-replace]')
    await page.waitExists('[data-testid=uib-insert-confirm]')
    await page.click('[data-testid=uib-insert-confirm]')
    if (await page.exists('[data-testid=uib-insert-armed]')) await page.click('[data-testid=uib-insert-confirm]')
    await page.waitExists('[data-testid=uib-insert-result].ok')
    await page.click({ sel: '.uib-modal button', text: 'Закрыть' })
    await page.click({ sel: '[data-testid=tab]', text: 'Link1.ino' })
    await page.key('s', { ctrl: true })
    const ino2 = await waitFile(join(dir, 'Link1.ino'), 'ui_setup();')
    assert(!ino2.includes('web_generated.h') && !ino2.includes('wdBegin'), 'подключение веб-дизайнера убрано: ' + ino2)
    assert(existsSync(join(dir, 'ui.json')), 'ui.json сохранён')
    void readFileSync
    await sleep(100)
  }
}

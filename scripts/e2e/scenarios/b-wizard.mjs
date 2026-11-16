import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { assert, assertEq, assertIncludes, readText } from '../lib/kit.mjs'

export default {
  id: 'b',
  title: 'Мастер: плата → имя (ошибки) → создание, sketch.yaml, плата сверху',
  arduino: 'ard2',
  async run({ page, sketchbook }) {
    await page.click('[data-testid=start-create]')
    await page.waitExists('[data-testid=wizard]')
    await page.waitExists('[data-testid=wz-board]', { timeout: 40000, what: 'список плат' })

    // Шаг 1: поиск и выбор платы с установленным ядром
    await page.fill('[data-testid=wz-search]', 'esp32')
    await page.waitExists('[data-testid=wz-board][data-fqbn="esp32:esp32:esp32"]')
    assert(await page.eval(`[...document.querySelectorAll('[data-testid=wz-board]')].every(b => (b.textContent + b.dataset.fqbn).toLowerCase().includes('esp32'))`), 'поиск оставляет только платы esp32')
    await page.click('[data-testid=wz-board][data-fqbn="esp32:esp32:esp32"]')
    await page.waitFor(`document.querySelector('[data-testid=wz-core]')?.dataset.state === 'installed'`, { what: 'ядро esp32 установлено (среда ard2)' })
    await page.click('[data-testid=wz-next]')

    // Шаг 2: имя
    await page.waitExists('[data-testid=wz-name]')
    await page.fill('[data-testid=wz-name]', 'Привет')
    await page.waitFor(`document.querySelector('[data-testid=wz-name-msg]').classList.contains('err')`, { what: 'ошибка для русского имени' })
    assertEq(await page.eval(`document.querySelector('[data-testid=wz-create]').disabled`), true, 'кнопка «Создать» отключена при ошибке')

    mkdirSync(join(sketchbook, 'Taken'))
    await page.fill('[data-testid=wz-name]', 'Taken')
    await page.waitFor(`document.querySelector('[data-testid=wz-name-msg]').classList.contains('err') && /существует|занят|есть/i.test(document.querySelector('[data-testid=wz-name-msg]').innerText)`, { what: 'ошибка занятой папки' })
    assertEq(await page.eval(`document.querySelector('[data-testid=wz-create]').disabled`), true, 'кнопка «Создать» отключена для занятой папки')

    await page.fill('[data-testid=wz-name]', 'MyBlink')
    await page.waitFor(`!document.querySelector('[data-testid=wz-name-msg]').classList.contains('err') && !document.querySelector('[data-testid=wz-create]').disabled`, { what: 'корректное имя принято' })
    await page.click('[data-testid=wz-create]')

    // Результат
    await page.waitExists('[data-testid=header]', { timeout: 15000, what: 'открыт проект' })
    await page.waitFor(`document.querySelector('[data-testid=tab][aria-selected=true]')?.innerText.includes('MyBlink.ino')`, { what: 'вкладка MyBlink.ino' })
    assertEq(await page.count('[data-testid=wizard]'), 0, 'мастер закрыт')
    const proj = join(sketchbook, 'MyBlink')
    assert(existsSync(join(proj, 'MyBlink.ino')), 'MyBlink.ino создан')
    assertIncludes(readText(join(proj, 'sketch.yaml')), 'default_fqbn: esp32:esp32:esp32', 'sketch.yaml')
    assertIncludes(await page.text('[data-testid=hdr-board]'), 'ESP32 Dev Module', 'плата сверху')
    assertEq(await page.text('[data-testid=hdr-title]'), 'MyBlink', 'имя проекта в шапке')
    await page.waitFor(`!!document.querySelector('.monaco-editor .view-lines')`, { what: 'редактор открыт' })
  }
}

// Общие помощники сценариев: проверки и типовые действия (создать проект через мастер и т. п.).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sleep } from './cdp.mjs'

export function assert(cond, msg) {
  if (!cond) throw new Error('Проверка не прошла: ' + msg)
}
export function assertEq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`Проверка не прошла: ${msg} (ожидалось ${JSON.stringify(expected)}, получено ${JSON.stringify(actual)})`)
}
export function assertIncludes(hay, needle, msg) {
  if (!String(hay).includes(needle)) throw new Error(`Проверка не прошла: ${msg} (нет «${needle}» в «${String(hay).slice(0, 200)}»)`)
}
export const readText = (p) => readFileSync(p, 'utf8')

/** Ждёт, пока файл на диске будет содержать подстроку. */
export async function waitFile(path, needle, timeout = 8000) {
  const t0 = Date.now()
  for (;;) {
    if (existsSync(path)) {
      const s = readText(path)
      if (!needle || s.includes(needle)) return s
    }
    if (Date.now() - t0 > timeout) throw new Error(`файл ${path} не содержит «${needle}» за ${timeout} мс`)
    await sleep(150)
  }
}

/** Открывает проект из «Недавних» стартового экрана и ждёт редактор. */
export async function openRecent({ page }, name) {
  await page.click({ sel: '[data-testid=start-recent]', text: name })
  await page.waitExists('[data-testid=header]', { timeout: 15000, what: 'открытие проекта ' + name })
  await page.waitFor(`!!document.querySelector('.monaco-editor .view-lines')`, { timeout: 20000, what: 'редактор Monaco' })
}

/**
 * Создаёт проект через мастер: плата esp32:esp32:esp32 (по умолчанию), имя name.
 * Возвращает путь к папке проекта. После этого открыт .ino во вкладке.
 */
export async function createProjectViaWizard({ page, sketchbook }, name, fqbn = 'esp32:esp32:esp32', search = 'esp32') {
  await page.click('[data-testid=start-create]')
  await page.waitExists('[data-testid=wizard]')
  await page.waitExists('[data-testid=wz-board]', { timeout: 120000, what: 'список плат в мастере' })
  await page.fill('[data-testid=wz-search]', search)
  await page.click(`[data-testid=wz-board][data-fqbn="${fqbn}"]`)
  await page.click('[data-testid=wz-next]')
  await page.waitExists('[data-testid=wz-name]')
  await page.fill('[data-testid=wz-name]', name)
  await page.waitFor(`document.querySelector('[data-testid=wz-create]') && !document.querySelector('[data-testid=wz-create]').disabled`, { what: 'кнопка «Создать» доступна' })
  await page.click('[data-testid=wz-create]')
  await page.waitExists('[data-testid=header]', { timeout: 15000, what: 'открытие проекта' })
  await page.waitFor(`!!document.querySelector('.monaco-editor')`, { timeout: 20000, what: 'редактор Monaco' })
  return join(sketchbook, name)
}

/** Видимый текст редактора Monaco (только отрисованные строки — для небольших файлов этого достаточно). */
export const editorText = (page) => page.eval(`[...document.querySelectorAll('.view:not([hidden]) .monaco-editor .view-lines .view-line')].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map((l) => l.textContent.replace(/\u00a0/g, ' ')).join('\\n')`)

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { assert, assertIncludes, openRecent } from '../lib/kit.mjs'

export default {
  id: 'ak',
  title: 'Автоустановка без сети: понятная ошибка, библиотека не считается установленной, доступен повтор',
  arduino: 'clean-libraries',
  env: { ARDUINO_NETWORK_PROXY: 'http://127.0.0.1:1' },
  files: { 'Offline/Offline.ino': '#include <WiFiEspAT.h>\nvoid setup() {} void loop() {}\n' },
  projects: ['Offline'],
  async run({ page, app }) {
    await openRecent({ page }, 'Offline')
    await page.click('[data-testid=act-libs]')
    const panel = '[data-testid=project-dependencies]'
    const error = `${panel} [role=alert]`
    await page.waitExists(error, { timeout: 45_000 })
    assertIncludes(await page.text(error), 'Не удалось восстановить библиотеки', 'показана ошибка установки')
    assert(!existsSync(join(app.ard.user, 'libraries', 'WiFiEspAT')), 'без сети библиотека не отмечена установленной')
    await page.waitFor(`[...document.querySelectorAll('${panel} button')].some(b => !b.disabled && b.textContent.includes('Установить найденные'))`)
  }
}

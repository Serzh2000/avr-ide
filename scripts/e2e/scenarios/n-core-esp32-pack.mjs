import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from '../lib/app.mjs'
import { assert, assertIncludes, readText } from '../lib/kit.mjs'
import { sleep } from '../lib/cdp.mjs'

/** Папка пакета ESP32, собранного npm run build:cores (release/AVR-IDE-core-esp32-<версия>) */
const release = join(ROOT, 'release')
const packDir = existsSync(release) ? readdirSync(release).filter((n) => /^AVR-IDE-core-esp32-/.test(n) && existsSync(join(release, n, 'manifest.json')))[0] : undefined

export default {
  id: 'n',
  title: '[full] ESP32 из ВНЕШНЕГО пакета (release/AVR-IDE-core-esp32-…) БЕЗ ИНТЕРНЕТА → проект → сборка (нужен собранный пакет, иначе пропуск)',
  full: true,
  arduino: 'empty',
  timeout: 45 * 60 * 1000,
  env: { ARDUINO_NETWORK_PROXY: 'http://127.0.0.1:1', AVRIDE_CORES_DIRS: release },
  async run({ page, sketchbook, app, log }) {
    if (!packDir) { log('пакет ESP32 не собран (npm run build:cores) — сценарий пропущен'); return }
    await page.click('[data-testid=start-create]')
    await page.click('[data-testid=project-kind-arduino]')
    await page.waitExists('[data-testid=wizard]')
    await page.waitExists('[data-testid=wz-board]', { timeout: 60000, what: 'список плат в мастере' })
    await page.fill('[data-testid=wz-search]', 'esp32')
    await page.click('[data-testid=wz-board][data-fqbn="esp32:esp32:esp32"]')
    await page.waitExists('[data-testid=wz-kit]', { timeout: 30000, what: 'внешний пакет ESP32 найден и предложен' })
    assertIncludes(await page.text('[data-testid=wz-kit]'), 'без интернета', 'текст про установку без интернета')
    await page.click('[data-testid=wz-install-pack]')

    const t0 = Date.now()
    let last = ''
    for (;;) {
      const st = await page.eval(`(() => { const c = document.querySelector('[data-testid=wz-core]'); return c ? { state: c.dataset.state, text: c.innerText.replace(/\\s+/g, ' ').slice(0, 220) } : null })()`)
      if (st && st.text !== last) { last = st.text; log(`${Math.round((Date.now() - t0) / 1000)} с: ${st.state}: ${st.text.slice(0, 140)}`) }
      if (st?.state === 'installed') break
      if (st?.state === 'failed') throw new Error('установка ESP32 из пакета не удалась: ' + st.text)
      if (Date.now() - t0 > 40 * 60 * 1000) throw new Error('установка не завершилась за 40 минут: ' + st?.text)
      await sleep(2000)
    }
    log(`ESP32 установлен из пакета за ${Math.round((Date.now() - t0) / 1000)} с`)
    assert(readdirSync(join(app.ard.data, 'packages', 'esp32', 'hardware', 'esp32')).length > 0, 'ядро esp32 установлено обычным образом')
    const leftovers = readdirSync(join(app.ard.dl, 'packages')).filter((f) => /esp|xtensa|riscv|openocd|mk(spiffs|littlefs)|dfu-util/i.test(f))
    assert(leftovers.length === 0, 'временные копии архивов удалены из staging: ' + leftovers.join(', '))

    await page.click('[data-testid=wz-next]')
    await page.waitExists('[data-testid=wz-name]')
    await page.fill('[data-testid=wz-name]', 'KitEsp32')
    await page.waitFor(`!document.querySelector('[data-testid=wz-create]').disabled`, { what: 'кнопка «Создать» доступна' })
    await page.click('[data-testid=wz-create]')
    await page.waitExists('[data-testid=header]', { timeout: 15000, what: 'открыт проект' })
    assertIncludes(readText(join(sketchbook, 'KitEsp32', 'sketch.yaml')), 'default_fqbn: esp32:esp32:esp32', 'sketch.yaml')
    await page.waitFor(`!document.querySelector('[data-testid=hdr-verify]')?.disabled`, { timeout: 30000, what: 'кнопка «Проверить» доступна' })
    await page.click('[data-testid=hdr-verify]')
    await page.waitFor(`/Собрано|Ошибка сборки/.test(document.querySelector('[data-testid=statusbar]')?.innerText ?? '')`, { timeout: 15 * 60 * 1000, interval: 2000, what: 'сборка для ESP32 завершилась' })
    assertIncludes(await page.text('[data-testid=statusbar]'), 'Собрано', 'сборка ESP32 без интернета успешна')
    log('ESP32: ' + (await page.text('[data-testid=statusbar]')).split('\n').find((l) => l.includes('Собрано')))
  }
}

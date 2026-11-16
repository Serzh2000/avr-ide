import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { assert, assertEq, assertIncludes, readText } from '../lib/kit.mjs'
import { sleep } from '../lib/cdp.mjs'

export default {
  id: 'l',
  title: '[full] Установка ядра из мастера в ПУСТОЙ среде: Arduino Uno → «Установить ядро» → проект (нужен интернет)',
  full: true,
  arduino: 'empty',
  timeout: 10 * 60 * 1000,
  async run({ page, sketchbook, app, log }) {
    await page.click('[data-testid=start-create]')
    await page.waitExists('[data-testid=wizard]')
    await page.waitExists('[data-testid=wz-board]', { timeout: 60000, what: 'список плат в мастере' })
    await page.fill('[data-testid=wz-search]', 'arduino uno')
    await page.click('[data-testid=wz-board][data-fqbn="arduino:avr:uno"]')
    await page.waitFor(`document.querySelector('[data-testid=wz-core]')?.dataset.state === 'missing'`, { what: 'в пустой среде для Uno предлагается установка ядра' })
    assertEq(await page.eval(`document.querySelector('[data-testid=wz-board][data-fqbn="arduino:avr:uno"]').dataset.installed`), 'false', 'плата помечена как «нужно установить ядро»')

    await page.click('[data-testid=wz-install-core]')
    await page.waitFor(`document.querySelector('[data-testid=wz-core]')?.dataset.state === 'installing'`, { what: 'пошла установка' })
    // Ждём завершения; по пути фиксируем, что показывает карточка (шаги, прогресс)
    const t0 = Date.now()
    let lastLabel = ''
    for (;;) {
      const st = await page.eval(`(() => { const c = document.querySelector('[data-testid=wz-core]'); return c ? { state: c.dataset.state, text: c.innerText } : null })()`)
      if (st) st.text = st.text.replace(/\s+/g, ' ').slice(0, 300)
      if (st && st.text !== lastLabel) { lastLabel = st.text; log(`${Math.round((Date.now() - t0) / 1000)} с: ${st.state}: ${st.text.slice(0, 160)}`) }
      if (st?.state === 'installed') break
      if (st?.state === 'failed') throw new Error('установка ядра завершилась ошибкой: ' + st.text)
      if (Date.now() - t0 > 9 * 60 * 1000) throw new Error('установка ядра не завершилась за 9 минут: ' + st?.text)
      await sleep(1500)
    }
    log(`ядро установлено за ${Math.round((Date.now() - t0) / 1000)} с`)
    // на диске появилось ядро arduino:avr
    const pk = join(app.ard.data, 'packages', 'arduino', 'hardware', 'avr')
    assert(existsSync(pk) && readdirSync(pk).length > 0, 'ядро arduino:avr лежит в изолированной папке данных: ' + pk)
    assertEq(await page.eval(`document.querySelector('[data-testid=wz-board][data-fqbn="arduino:avr:uno"]').dataset.installed`), 'true', 'плата теперь помечена как установленная')

    // Проект создаётся
    await page.click('[data-testid=wz-next]')
    await page.waitExists('[data-testid=wz-name]')
    await page.fill('[data-testid=wz-name]', 'UnoBlink')
    await page.waitFor(`!document.querySelector('[data-testid=wz-create]').disabled`, { what: 'кнопка «Создать» доступна' })
    await page.click('[data-testid=wz-create]')
    await page.waitExists('[data-testid=header]', { timeout: 15000, what: 'открыт проект' })
    assertIncludes(readText(join(sketchbook, 'UnoBlink', 'sketch.yaml')), 'default_fqbn: arduino:avr:uno', 'sketch.yaml')
    assertIncludes((await page.text('[data-testid=hdr-board]')).toLowerCase(), 'arduino uno', 'плата сверху')
    assertEq(await page.count('.chip-warn'), 0, 'нет предупреждения «ядро не установлено»')
    await page.waitFor(`/ядро 1[.]/.test(document.querySelector('[data-testid=statusbar]')?.innerText ?? '')`, { timeout: 20000, what: 'в строке состояния видно установленное ядро' })

    // Установленное ядро действительно собирает скетч
    await page.waitFor(`!document.querySelector('[data-testid=hdr-verify]')?.disabled`, { timeout: 20000, what: 'кнопка «Проверить» доступна' })
    await page.click('[data-testid=hdr-verify]')
    await page.waitFor(`/Собрано|Ошибка сборки/.test(document.querySelector('[data-testid=statusbar]')?.innerText ?? '')`, { timeout: 5 * 60 * 1000, interval: 1000, what: 'сборка для Uno завершилась' })
    assertIncludes(await page.text('[data-testid=statusbar]'), 'Собрано', 'сборка для Uno успешна')
  }
}

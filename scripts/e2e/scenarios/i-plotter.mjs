import { assert, assertIncludes, openRecent, openWorkspaceTool } from '../lib/kit.mjs'
import { sleep } from '../lib/cdp.mjs'

export default {
  id: 'i',
  title: 'Монитор и плоттер на имитации порта (AVRIDE_SIM_MONITOR=1): данные и линии',
  files: { 'Plot1/Plot1.ino': 'void setup() {\n}\nvoid loop() {\n}\n', 'Plot1/sketch.yaml': 'default_fqbn: arduino:avr:uno\ndefault_port: COM99\n' },
  projects: ['Plot1'],
  async run({ page }) {
    await openRecent({ page }, 'Plot1')

    // после загрузки проекта обработчики горячих клавиш и панель могут быть ещё не готовы (нагрузка на машину) — повторяем сочетание, пока монитор не откроется
    const monitorOpen = `document.querySelector('[data-tab=monitor]')?.getAttribute('aria-selected') === 'true'`
    await page.waitFor(`!!document.querySelector('[data-testid=act-ui]')`, { what: 'проект открыт' })
    const tm = Date.now()
    while (!(await page.eval(monitorOpen))) {
      if (Date.now() - tm > 30000) throw new Error('таймаут 30000 мс: открыт монитор порта')
      await page.key('l', { ctrl: true, shift: true })
      await sleep(700)
    }
    assertIncludes(await page.text('[data-testid=utility-monitor]'), 'COM99', 'порт COM99 выбран')
    await page.click({ sel: '[data-testid=utility-monitor] .btn.primary', text: 'Запустить' })
    await page.waitFor(`/temp:[0-9]+[.][0-9]+,hum:/.test(document.querySelector('[data-testid=utility-monitor] .log')?.innerText ?? '')`, { timeout: 20000, what: 'в мониторе появились строки temp:…,hum:…' })

    await openWorkspaceTool(page, 'plotter')
    await page.waitFor(`document.querySelectorAll('[data-testid=utility-plotter] .plot-key').length >= 3`, { timeout: 20000, what: 'в легенде плоттера три линии' })
    const names = await page.eval(`[...document.querySelectorAll('[data-testid=utility-plotter] .plot-name')].map(e => e.innerText).join(',')`)
    for (const n of ['temp', 'hum', 'pwm']) assertIncludes(names, n, 'линия в легенде')
    await sleep(1200)
    // на canvas нарисовано больше одного цвета линий (а не пустое поле)
    const colors = await page.eval(`(() => { const c = document.querySelector('[data-testid=utility-plotter] canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const set = new Set(); for (let i = 0; i < d.length; i += 4 * 7) set.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); return set.size })()`)
    assert(colors >= 4, `на графике нарисованы линии (различимых цветов: ${colors})`)
    assert(!(await page.exists('.plot-empty')), 'заглушка «нет данных» скрыта')

    // Пауза останавливает график, «Остановить» выключает порт
    await page.click({ sel: '[data-testid=utility-plotter] .btn', text: 'Остановить' })
    await page.waitFor(`!!([...document.querySelectorAll('[data-testid=utility-plotter] .btn')].find(b => b.innerText.includes('Запустить')))`, { what: 'порт остановлен' })
  }
}

// Аудит стыков карточек (зазоры, выравнивание, радиусы) на всех основных экранах в обеих темах и на 1280/760,
// включая состояния установки поддержки плат: «идёт», «ошибка», «готово». Состояния подставляются в хранилища (window.__avrStores).
// Снимки состояний — в папку AVRIDE_E2E_SHOTS, если задана.
import { join } from 'node:path'
import { assert, openRecent } from '../lib/kit.mjs'
import { sleep } from '../lib/cdp.mjs'
import { spacingAudit } from '../lib/spacing.mjs'

const shotDir = process.env.AVRIDE_E2E_SHOTS

export default {
  id: 'v',
  title: 'Стыки карточек: нет слипшихся/перекрытых блоков, края выровнены (экраны и состояния установки, обе темы, 1280 и 760)',
  arduino: 'ard2',
  timeout: 1500000,
  files: { 'Sp1/Sp1.ino': 'float temperature;\nvoid setup() {\n  pinMode(2, OUTPUT);\n}\nvoid loop() {\n}\n', 'Sp1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Sp1'],
  async run({ page, log }) {
    const problems = []
    const S = (code) => page.eval(`(() => { const { useBuild, useUi, useSetup, useCores } = window.__avrStores; ${code} })()`)
    const audit = async (screen, theme, width) => {
      await sleep(350)
      const list = await page.eval(`(${spacingAudit})()`)
      for (const i of list) problems.push(`[${width}px, ${theme}] ${screen}: ${i}`)
      if (shotDir && /установк|ошибка|готово/.test(screen)) await page.shot(join(shotDir, `v-${width}-${theme}-${screen.replace(/[^a-zа-я0-9]+/gi, '-')}.png`))
    }
    const reset = () => S(`useSetup.setState({ running: false, steps: [], error: null }); useBuild.setState({ busy: false, kind: null, progress: null, log: '' }); useUi.getState().setWizard(false)`)
    const STEPS = `[{ id: 'a', label: 'Установка ESP32 3.3.12 из комплекта', status: 'run' }, { id: 'b', label: 'Проверка файлов', status: 'wait' }]`

    await openRecent({ page }, 'Sp1')
    for (const theme of ['dark', 'light']) {
      await S(`useUi.getState().setSettings({ theme: '${theme}' })`)
      for (const width of [1280, 760]) {
        await page.cdp.send('Emulation.setDeviceMetricsOverride', { width, height: width === 760 ? 760 : 800, deviceScaleFactor: 1, mobile: false })
        await sleep(400)
        // Боковые панели и вкладки
        for (const id of ['files', 'search', 'examples', 'boards', 'libs', 'ref', 'ui', 'web', 'settings']) {
          await page.click(`[data-testid=act-${id}]`)
          await audit('панель ' + id, theme, width)
        }
        // Панель «Платы» с карточкой установки: идёт / ошибка / готово
        await page.click('[data-testid=act-boards]')
        await S(`useBuild.setState({ cores: [] })`)
        await S(`useSetup.setState({ running: true, error: null, steps: ${STEPS} }); useBuild.setState({ busy: true, kind: 'core-install', progress: { label: 'Копирование архивов 4 из 24', pct: 25 } })`)
        await audit('Платы: установка идёт', theme, width)
        await S(`useSetup.setState({ running: false, error: 'Не удалось скопировать файлы ядра', steps: [{ id: 'a', label: 'Установка ESP32 3.3.12 из комплекта', status: 'fail' }] }); useBuild.setState({ busy: false, kind: null, progress: null, log: 'error: нет места на диске\\nошибка копирования' })`)
        await audit('Платы: установка ошибка', theme, width)
        await S(`useSetup.setState({ running: false, error: null, steps: [{ id: 'a', label: 'Установка ESP32 3.3.12 из комплекта', status: 'ok' }] })`)
        await audit('Платы: установка готово', theme, width)
        await reset()
        // Мастер: плата не установлена → установка идёт / ошибка / готово
        await S(`useUi.getState().setWizard(true)`)
        await page.waitExists('[data-testid=wz-board]', { timeout: 60000 })
        await page.fill('[data-testid=wz-search]', 'arduino uno')
        await page.click('[data-testid=wz-board][data-fqbn="arduino:avr:uno"]')
        await sleep(500)
        await audit('Мастер: плата без поддержки', theme, width)
        await S(`useSetup.setState({ running: true, error: null, steps: ${STEPS} }); useBuild.setState({ busy: true, kind: 'core-install', progress: { label: 'Копирование архивов 4 из 24', pct: 25 } })`)
        await audit('Мастер: установка идёт', theme, width)
        await S(`useSetup.setState({ running: false, error: 'Не удалось скопировать файлы ядра', steps: [{ id: 'a', label: 'Установка ESP32 3.3.12 из комплекта', status: 'fail' }] }); useBuild.setState({ busy: false, kind: null, progress: null, log: 'error: нет места на диске' })`)
        await audit('Мастер: установка ошибка', theme, width)
        await S(`useSetup.setState({ running: false, error: null, steps: [] }); useBuild.setState({ log: '' })`)
        await page.fill('[data-testid=wz-search]', 'esp32')
        await page.click('[data-testid=wz-board][data-fqbn="esp32:esp32:esp32"]')
        await sleep(500)
        await audit('Мастер: плата готово', theme, width)
        await page.click('[data-testid=wz-next]')
        await audit('Мастер: имя', theme, width)
        await page.key('Escape')
        await reset()
      }
    }
    for (const x of [...new Set(problems)]) log(x)
    assert(problems.length === 0, 'склеенные или невыровненные карточки:\n' + [...new Set(problems)].slice(0, 40).join('\n'))
  }
}

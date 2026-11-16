import { auditPage } from '../lib/audit.mjs'
import { assert, openRecent } from '../lib/kit.mjs'
import { sleep } from '../lib/cdp.mjs'

export default {
  id: 'j',
  title: 'Темы и ширина (1344 и 760): нет горизонтального скролла и обрезанных элементов',
  arduino: 'ard2',
  timeout: 240000,
  files: { 'Aud1/Aud1.ino': 'float temperature;\nvoid setup() {\n  pinMode(2, OUTPUT);\n}\nvoid loop() {\n}\n', 'Aud1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Aud1'],
  async run({ page, log }) {
    const problems = []
    const audit = async (screen, theme, width) => {
      await sleep(250)
      const list = await page.eval(`(${auditPage})(${JSON.stringify({ theme })})`)
      for (const i of list) problems.push(`[${width}px, ${theme}] ${screen}: ${i}`)
    }
    const themeNow = () => page.eval(`document.documentElement.dataset.theme`)
    const setThemeOnStart = async (t) => {
      if ((await themeNow()) !== t) await page.click('.start-theme')
      await page.waitFor(`document.documentElement.dataset.theme === '${t}'`)
    }
    const setThemeInProject = async (t) => {
      if ((await themeNow()) === t) return
      await page.click('[data-testid=act-settings]')
      await page.click({ sel: '.view button', text: t === 'light' ? 'Светлая' : 'Тёмная' })
      await page.waitFor(`document.documentElement.dataset.theme === '${t}'`)
    }

    for (const width of [1344, 760]) {
      await page.setWindowSize(width, 760)
      for (const theme of ['dark', 'light']) {
        log(`ширина ${width}, тема ${theme}`)
        // старт и мастер
        await setThemeOnStart(theme)
        await audit('старт', theme, width)
        await page.click('[data-testid=start-create]')
        await page.waitExists('[data-testid=wz-board]', { timeout: 40000 })
        await audit('мастер: плата', theme, width)
        await page.click('[data-testid=wz-next]')
        await page.waitExists('[data-testid=wz-name]')
        await audit('мастер: имя', theme, width)
        await page.key('Escape')
        await page.waitGone('[data-testid=wizard]')

        // проект
        await openRecent({ page }, 'Aud1')
        await audit('редактор + проводник', theme, width)
        for (const [id, label] of [['search', 'поиск'], ['examples', 'примеры'], ['boards', 'платы и библиотеки']]) {
          await page.click(`[data-testid=act-${id}]`)
          await sleep(500)
          await audit('панель: ' + label, theme, width)
        }
        for (const t of ['problems', 'monitor', 'plotter', 'output']) {
          await page.click(`[data-testid=btab-${t}]`)
          await audit('нижняя панель: ' + t, theme, width)
        }
        await page.click('[data-testid=hdr-board]')
        await page.waitExists('.board-pop')
        await audit('выбор платы', theme, width)
        await page.key('Escape')
        await page.key('p', { ctrl: true, shift: true })
        await page.waitExists('.palette, [role=dialog]')
        await audit('палитра команд', theme, width)
        await page.key('Escape')
        for (const [id, wait, label] of [['ref', '.ref-search', 'справочник'], ['ui', '[data-testid=uib]', 'конструктор ESPUI'], ['web', '.wd-pal-item', 'веб-дизайнер'], ['settings', null, 'настройки']]) {
          await page.click(`[data-testid=act-${id}]`)
          if (wait) await page.waitExists(wait)
          await sleep(900)
          await audit(label, theme, width)
        }
        if (theme === 'dark') await setThemeInProject('light')
        else await setThemeInProject('dark')
        // возвращаемся на старт: тема для следующего круга выставится заново
        await page.click('[data-testid=hdr-close-project]')
        await page.waitExists('[data-testid=start-screen]')
      }
    }
    const uniq = [...new Set(problems)]
    assert(uniq.length === 0, `найдено замечаний: ${uniq.length}\n  - ` + uniq.slice(0, 40).join('\n  - '))
  }
}

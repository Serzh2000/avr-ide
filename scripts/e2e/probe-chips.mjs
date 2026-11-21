// Проба «Справочник STM32» (ChipsView): поднимает Vite на временной странице, открывает её в Electron,
// проверяет поиск, выводы и фильтр по сигналу, снимает кадры в обеих темах на 1280 и 760.
//   node scripts/e2e/probe-chips.mjs [каталог для снимков]
import { spawn } from 'node:child_process'
import { createServer as createNet } from 'node:net'
import { join, resolve } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { ROOT, killTree, rmTemp } from './lib/app.mjs'
import { Cdp, Page, sleep } from './lib/cdp.mjs'

const out = resolve(process.argv[2] ?? join(ROOT, 'scripts', 'e2e', 'artifacts', 'chips'))
const harness = join(ROOT, 'scripts', 'e2e', 'chips-harness')
const free = () => new Promise((res) => { const s = createNet().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)) }) })
let bad = 0
const check = (ok, what) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + what); if (!ok) bad++ }

const vite = await createServer({ root: harness, plugins: [react()], server: { port: await free(), host: '127.0.0.1', fs: { allow: [ROOT] } }, logLevel: 'error', configFile: false })
await vite.listen()
const url = vite.resolvedUrls.local[0]
const port = await free()
const tmp = mkdtempSync(join(tmpdir(), 'chips-probe-'))
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const exe = join(ROOT, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron')
const child = spawn(exe, [join(harness, 'electron-main.cjs'), `--remote-debugging-port=${port}`, '--remote-allow-origins=*', `--user-data-dir=${tmp}`, '--disable-backgrounding-occluded-windows', url], { env, stdio: 'ignore' })
let cdp
try {
  let target
  for (let i = 0; i < 100 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page' && t.url.startsWith('http')) } catch { /* ждём */ }
    if (!target) await sleep(200)
  }
  if (!target) throw new Error('окно Electron не открылось')
  cdp = await Cdp.connect(target.webSocketDebuggerUrl)
  const page = new Page(cdp)
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  const errors = []
  cdp.on((m) => { if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text) })
  const nav = async (qs) => {
    await page.eval(`location.href = ${JSON.stringify(url + '?' + qs)}`)
    await sleep(800)
    await page.waitFor(`!!document.querySelector('[data-testid=chips-view]')`, { what: 'ChipsView' })
  }
  const setVal = (sel, v) => page.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); const set = Object.getOwnPropertyDescriptor(e.constructor.prototype, 'value').set; set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  const tab = (name) => page.eval(`[...document.querySelectorAll('.chips-tabs button')].find((b) => b.textContent === ${JSON.stringify(name)})?.click()`)

  await nav('theme=dark')
  const items = await page.eval(`document.querySelectorAll('.chips-item').length`)
  check(items === 16, `в списке 16 чипов (сейчас ${items})`)
  await setVal('[data-testid=chips-search]', 'lqfp48')
  await sleep(150)
  check(await page.eval(`document.querySelectorAll('.chips-item').length`) === 1, 'поиск lqfp48 оставляет один чип')
  await setVal('[data-testid=chips-search]', 'cortex-m7')
  await sleep(150)
  check(await page.eval(`document.querySelector('.chips-item b').textContent`) === 'STM32H743ZIT6', 'поиск cortex-m7 находит H743')

  for (const [theme, w, h] of [['dark', 1280, 800], ['light', 1280, 800], ['dark', 760, 900], ['light', 760, 900]]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
    await nav(`theme=${theme}&chip=stm32f103c8`)
    const tag = `${theme}-${w}`
    await sleep(300)
    check((await page.eval(`document.documentElement.scrollWidth - innerWidth`)) <= 0, `${tag}: нет горизонтальной прокрутки страницы`)
    await page.shot(join(out, `overview-${tag}.png`))
    await tab('Выводы'); await sleep(200)
    await setVal('[data-testid=chips-signal]', 'USART1_TX'); await sleep(200)
    const pins = await page.eval(`[...document.querySelectorAll('[data-testid=chips-pin-table] tbody tr')].map((r) => r.dataset.pin).join()`)
    check(pins === 'PA9,PB6', `${tag}: USART1_TX на ${pins}`)
    await page.shot(join(out, `pins-${tag}.png`))
    await tab('Периферия'); await sleep(200); await page.shot(join(out, `periph-${tag}.png`))
    await tab('Файлы для проекта'); await sleep(200)
    check((await page.eval(`document.querySelector('[data-testid=chips-files]').textContent`)).includes('startup_stm32f103xb.s'), `${tag}: файлы проекта`)
    await page.shot(join(out, `files-${tag}.png`))
  }
  check(errors.length === 0, 'нет ошибок в консоли страницы' + (errors.length ? ': ' + errors[0] : ''))
} finally {
  try { cdp?.close() } catch { /* */ }
  killTree(child.pid)
  await vite.close()
  rmTemp(tmp)
}
console.log(bad ? `замечаний: ${bad}` : 'всё в порядке; снимки: ' + out)
process.exit(bad ? 1 : 0)

// Раннер сквозных тестов интерфейса.
//   node scripts/e2e/run.mjs            быстрые сценарии
//   node scripts/e2e/run.mjs --full     + сценарии с долгими компиляциями и установкой ядра
//   node scripts/e2e/run.mjs --only a,b запустить только указанные сценарии (по id)
// Каждый сценарий получает собственный экземпляр приложения и временные данные.
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ARTIFACTS, ROOT, ensureBuilt, launch } from './lib/app.mjs'

const args = process.argv.slice(2)
const full = args.includes('--full')
const only = (args.find((a) => a.startsWith('--only='))?.slice(7) ?? (args.includes('--only') ? args[args.indexOf('--only') + 1] : '')).split(',').filter(Boolean)

const dir = join(ROOT, 'scripts', 'e2e', 'scenarios')
const files = readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort()
const scenarios = []
for (const f of files) scenarios.push((await import(pathToFileURL(join(dir, f)).href)).default)
const chosen = scenarios.filter((s) => (only.length ? only.includes(s.id) : full || !s.full))

try { ensureBuilt() } catch (e) { console.error(String(e.message)); process.exit(2) }
mkdirSync(ARTIFACTS, { recursive: true })

const results = []
for (const s of chosen) {
  const t0 = Date.now()
  let app = null
  let status = 'OK'
  let reason = ''
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`сценарий не уложился в ${Math.round(ms / 1000)} с`)), ms))])
  try {
    app = await launch({ arduino: s.arduino, files: s.files, projects: s.projects, env: s.env, hardware: s.hardware })
    await withTimeout(s.run({ app, page: app.page, sketchbook: app.sketchbook, tmp: app.tmp, log: (m) => console.log('    · ' + m) }), s.timeout ?? 120000)
  } catch (e) {
    status = 'FAIL'
    reason = String(e.message ?? e)
    if (app) {
      try {
        await withTimeout((async () => {
          await app.cdp.send('Page.bringToFront')
          await app.page.shot(join(ARTIFACTS, `${s.id}.png`))
        })(), 8000)
      } catch { /* окно недоступно */ }
      writeFileSync(join(ARTIFACTS, `${s.id}.log`), `${reason}\n\n--- ошибки страницы ---\n${app.consoleErrors.join('\n')}\n\n--- вывод процесса ---\n${app.log()}\n`)
    }
  } finally {
    if (app) await app.close()
  }
  const sec = ((Date.now() - t0) / 1000).toFixed(1)
  results.push({ s, status, reason })
  console.log(`${status === 'OK' ? 'OK  ' : 'FAIL'} [${s.id}] ${s.title} (${sec} с)${reason ? '\n       ' + reason.split('\n').join('\n       ') : ''}`)
}

const bad = results.filter((r) => r.status !== 'OK')
console.log(`\nИтого: ${results.length - bad.length} из ${results.length} успешно.` + (bad.length ? ` Упали: ${bad.map((r) => r.s.id).join(', ')}. Скриншоты и логи: ${ARTIFACTS}` : ''))
process.exit(bad.length ? 1 : 0)

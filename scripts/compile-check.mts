// Проверка сборки: генерирует код из всех шаблонов обоих конструкторов (и проект со всеми
// элементами ESPUI) и компилирует его через arduino-cli. Ловит конфликты имён с библиотеками и т.п.
//
// Запуск:  npm run check:compile            (платы по умолчанию: esp32, esp8266)
//          npm run check:compile -- --boards esp32,esp32s3,esp32c3,esp8266 --only espui_home
//
// Нужны: arduino-cli (resources/ или PATH), ядра esp32:esp32 и/или esp8266:esp8266, библиотеки
// ESPUI, "Async TCP", "ESP Async WebServer" (для ESP32) и "ESP Async TCP" (для ESP8266).
// Скрипт ничего не устанавливает сам. Проверяется только компиляция, не работа на плате.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ui from '../src/renderer/src/uibuilder/core/index.ts'
import * as wd from '../src/renderer/src/webdesign/core/index.ts'
import { richProject } from '../src/renderer/src/uibuilder/tests/fixtures.ts'

const root = resolve(fileURLToPath(import.meta.url), '..', '..')
const BOARDS: Record<string, { fqbn: string; platform: 'esp32' | 'esp8266'; urls?: string }> = {
  esp32: { fqbn: 'esp32:esp32:esp32', platform: 'esp32' },
  esp32s3: { fqbn: 'esp32:esp32:esp32s3', platform: 'esp32' },
  esp32c3: { fqbn: 'esp32:esp32:esp32c3', platform: 'esp32' },
  esp8266: {
    fqbn: 'esp8266:esp8266:nodemcuv2',
    platform: 'esp8266',
    urls: 'http://arduino.esp8266.com/stable/package_esp8266com_index.json'
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const boardKeys = (arg('boards') ?? 'esp32,esp8266').split(',').map((s) => s.trim())
const only = arg('only')

const exeName = process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli'
const local = join(root, 'resources', exeName)
const cli = existsSync(local) ? local : exeName
if (spawnSync(cli, ['version'], { encoding: 'utf8' }).status !== 0) {
  console.error('arduino-cli не найден (положите в resources/ или добавьте в PATH)')
  process.exit(2)
}

interface Sketch { name: string; files: Record<string, string> }

/** Пустые заглушки для функций пользователя (привязка callback): прототипы без cb_ в начале. */
function stubs(header: string): string {
  const names = new Set<string>()
  for (const m of header.matchAll(/^void\s+([A-Za-z_]\w*)\s*\(Control\*\s*sender,\s*int\s+type\)\s*;/gm))
    if (!m[1].startsWith('cb_')) names.add(m[1])
  return [...names].map((n) => `void ${n}(Control*, int) {}`).join('\n')
}

function sketchesFor(platform: 'esp32' | 'esp8266'): Sketch[] {
  const out: Sketch[] = []
  const wifi = (p: { wifi: { ssid: string; password: string } }) => {
    p.wifi.ssid = 'testnet'
    p.wifi.password = 'testpass123'
  }
  const espui = (name: string, p: ReturnType<typeof richProject>) => {
    wifi(p)
    const { code, issues } = ui.generateWithIssues(p, platform, { ledcApi: 'v3' })
    const errs = issues.filter((i) => i.severity === 'error')
    if (errs.length) throw new Error(`${name}: ошибки модели: ${errs.map((e) => e.message).join('; ')}`)
    out.push({
      name,
      files: {
        'ui_generated.h': code,
        [`${name}.ino`]: `#include "ui_generated.h"\n${stubs(code)}\nvoid setup(){ Serial.begin(115200); ui_setup(); }\nvoid loop(){ ui_loop(); }\n`
      }
    })
  }
  for (const t of ui.PROJECT_TEMPLATES) {
    if (t.id !== 'empty') espui(`espui_${t.id}`, ui.createProjectFromTemplate(t.id, platform))
  }
  espui('espui_rich', richProject(platform))
  for (const t of wd.TEMPLATES) {
    const p = t.build(platform)
    wifi(p)
    const c = wd.generateCpp(p)
    out.push({ name: `web_${t.id}`, files: { 'web_generated.h': c.header, [`web_${t.id}.ino`]: c.sketch } })
  }
  return out
}

const tmp = mkdtempSync(join(tmpdir(), 'avride-check-'))
let failed = 0
let total = 0
try {
  for (const key of boardKeys) {
    const b = BOARDS[key]
    if (!b) {
      console.error(`неизвестная плата «${key}» (есть: ${Object.keys(BOARDS).join(', ')})`)
      process.exit(2)
    }
    for (const s of sketchesFor(b.platform)) {
      if (only && s.name !== only) continue
      const dir = join(tmp, key, s.name)
      mkdirSync(dir, { recursive: true })
      for (const [f, c] of Object.entries(s.files)) writeFileSync(join(dir, f), c)
      const args = ['compile', '--fqbn', b.fqbn, dir]
      if (b.urls) args.push('--additional-urls', b.urls)
      const r = spawnSync(cli, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      total++
      const ok = r.status === 0
      console.log(`${ok ? 'OK  ' : 'FAIL'} ${key.padEnd(8)} ${s.name}`)
      if (!ok) {
        failed++
        const lines = `${r.stdout}\n${r.stderr}`.split('\n').filter((l) => /error/i.test(l)).slice(0, 6)
        for (const l of lines) console.log('     ' + l.trim())
      }
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
console.log(`\nИтого: ${total - failed} из ${total} собрались`)
process.exit(failed ? 1 : 0)

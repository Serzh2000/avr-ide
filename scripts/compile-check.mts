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
import { parseSketch } from '../src/renderer/src/uibuilder/sketch/parse.ts'
import { resolveProject } from '../src/renderer/src/uibuilder/sketch/resolve.ts'
import { addCallbackStub, planIntegration } from '../src/renderer/src/uibuilder/sketch/integrate.ts'

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
  // Сценарии «привязка к переменным и пинам скетча»: переменные НЕ объявляются в ui_generated.h,
  // скетч правится так же, как при нажатии «Вставить в скетч» (planIntegration).
  const sketchScenario = (name: string, sketch: string, build: (p: ReturnType<typeof ui.createDefaultProject>) => void, stubFns: string[] = []) => {
    const p = ui.createDefaultProject(platform)
    p.wifi.ssid = 'testnet'
    p.wifi.password = 'testpass123'
    build(p)
    const info = parseSketch(sketch)
    const r = resolveProject(p, info)
    const { code, issues } = ui.generateWithIssues(r.project, platform, { ledcApi: 'v3' })
    const errs = [...issues, ...r.issues].filter((i) => i.severity === 'error')
    if (errs.length) throw new Error(`${name}: ошибки: ${errs.map((e) => e.message).join('; ')}`)
    let ino = sketch
    for (const fn of stubFns) ino = addCallbackStub(ino, fn, 'switcher', 'Свет')
    const plan = planIntegration(ino)
    out.push({ name, files: { 'ui_generated.h': code, [`${name}.ino`]: plan.code } })
  }
  const ext = (name: string, type: 'bool' | 'int' | 'float' | 'String') => ({ name, type, init: '', external: true })
  const SK = `#include <Arduino.h>
#define LED_PIN 2
const int relayPin = 4;
float temperature = 21.5;
double humidity = 40.0;
bool ledState = false;
volatile bool flag = false;
uint8_t brightness = 10;
unsigned long counter = 0;
String status = "ready";

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  temperature += 0.1;
  counter++;
  delay(100);
}
`
  sketchScenario('sketchvars_basic', SK, (p) => {
    p.variables = [ext('temperature', 'float'), ext('humidity', 'float'), ext('ledState', 'bool'), ext('brightness', 'int'), ext('counter', 'int'), ext('status', 'String'), ext('flag', 'bool')]
    const mk = (type: ui.WidgetType, label: string, binding: ui.Binding) => {
      const e = ui.createElement(type, p)
      e.label = label
      e.binding = binding
      p.tabs[0].elements.push(e)
    }
    mk('label', 'Температура', { kind: 'var', variable: 'temperature', direction: 'toUi' })
    mk('graph', 'Влажность', { kind: 'var', variable: 'humidity', direction: 'toUi' })
    mk('switcher', 'Светодиод', { kind: 'var', variable: 'ledState', direction: 'both' })
    mk('slider', 'Яркость', { kind: 'var', variable: 'brightness', direction: 'both' })
    mk('number', 'Счётчик', { kind: 'var', variable: 'counter', direction: 'toUi' })
    mk('text', 'Статус', { kind: 'var', variable: 'status', direction: 'both' })
    mk('button', 'Флаг', { kind: 'var', variable: 'flag', direction: 'fromUi' })
    mk('switcher', 'Реле', { kind: 'pin', pin: 0, pinName: 'relayPin', direction: 'toPin', mode: 'digital' })
    mk('switcher', 'Лампа', { kind: 'pin', pin: 0, pinName: 'LED_PIN', direction: 'toPin', mode: 'digital', invert: true })
  })
  // обработчик, добавленный заготовкой в скетч, плюс вкладки
  sketchScenario(
    'sketchvars_callbacks',
    SK,
    (p) => {
      p.variables = [ext('temperature', 'float')]
      const a = ui.createElement('label', p)
      a.binding = { kind: 'var', variable: 'temperature', direction: 'toUi' }
      const b = ui.createElement('switcher', p)
      b.binding = { kind: 'callback', fn: 'onSwitch' }
      const t2 = ui.createTab(p)
      p.tabs[0].elements.push(a)
      t2.elements.push(b)
      p.tabs.push(t2)
    },
    ['onSwitch']
  )
  // существующий в скетче обработчик (определён ДО #include) и повторная вставка (идемпотентность)
  {
    const sk2 = `#include <ESPUI.h>
int level = 3;
void onSlide(Control* sender, int type) { level = sender->value.toInt(); }
void setup() {}
void loop() {}
`
    sketchScenario('sketchvars_existingcb', sk2, (p) => {
      p.variables = [ext('level', 'int')]
      const a = ui.createElement('slider', p)
      a.binding = { kind: 'callback', fn: 'onSlide' }
      const b = ui.createElement('label', p)
      b.binding = { kind: 'var', variable: 'level', direction: 'toUi' }
      p.tabs[0].elements.push(a, b)
    })
  }

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
        const all = `${r.stdout}\n${r.stderr}`.split('\n')
        let lines = all.filter((l) => /error/i.test(l)).slice(0, 6)
        if (!lines.length) lines = all.filter((l) => l.trim()).slice(-8)
        for (const l of lines) console.log('     ' + l.trim())
      }
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
console.log(`\nИтого: ${total - failed} из ${total} собрались`)
process.exit(failed ? 1 : 0)

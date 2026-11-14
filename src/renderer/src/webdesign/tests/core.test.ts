import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  TEMPLATES, addBlock, allBlocks, buildPreviewHtml, cloneBlock, cppString, createBlock, createDefaultProject,
  escapeHtml, findBlock, generateCpp, generateCss, generateHtml, generateJs, generateSite, identProblem, isColor,
  moveBlock, parseProject, rawDelimiter, serializeProject, uniqueId, validate, hasErrors, WD_VERSION
} from '../core/index'
import type { Issue, WdProject } from '../core/index'
import { checkHtml } from './htmlcheck'

const here = dirname(fileURLToPath(import.meta.url))
const normalize = (s: string): string => s.replace(/\r\n/g, '\n')

function golden(name: string, actual: string): void {
  const file = join(here, 'golden', name)
  if (process.env.UPDATE_GOLDEN === '1' || !existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, actual)
    return
  }
  assert.equal(actual, normalize(readFileSync(file, 'utf8')), `golden ${name} изменился (UPDATE_GOLDEN=1 обновит)`)
}

const codes = (is: Issue[], sev: 'error' | 'warning'): string[] => is.filter((i) => i.severity === sev).map((i) => i.code)
const has = (is: Issue[], code: string): boolean => is.some((i) => i.code === code)

/** Синтаксическая проверка JS без выполнения. */
function assertValidJs(src: string, what: string): void {
  assert.doesNotThrow(() => new vm.Script(src, { filename: what }), `${what}: JS синтаксически некорректен`)
  assert.doesNotThrow(() => new Function(src), `${what}: new Function`)
}

function project(): WdProject {
  const p = createDefaultProject('esp32')
  p.variables = [{ name: 'led', type: 'bool', init: 'false' }]
  const sw = createBlock('switch', 'sw')
  sw.binding = { kind: 'var', variable: 'led', direction: 'both' }
  p.blocks[0].children.push(sw)
  return p
}

// ---------- шаблоны: golden + валидность ----------
for (const t of TEMPLATES) {
  for (const platform of ['esp32', 'esp8266'] as const) {
    test(`шаблон ${t.id}/${platform}: без ошибок валидатора, JS и HTML корректны`, () => {
      const p = t.build(platform)
      p.wifi.ssid = 'net'
      const issues = validate(p)
      assert.deepEqual(codes(issues, 'error'), [], issues.map((i) => i.message).join('\n'))
      const site = generateSite(p)
      assertValidJs(site.js, 'app.js')
      assert.deepEqual(checkHtml(site.html), [])
      assert.deepEqual(checkHtml(site.bundle), [])
      const inline = [...site.bundle.matchAll(/<script>\n([\s\S]*?)<\/script>/g)].map((m) => m[1])
      assert.equal(inline.length, 1)
      assertValidJs(inline[0], 'bundle script')
      const prev = buildPreviewHtml(p)
      assert.deepEqual(checkHtml(prev), [])
      for (const m of prev.matchAll(/<script>\n([\s\S]*?)<\/script>/g)) assertValidJs(m[1], 'preview script')
      // без внешних ресурсов
      assert.ok(!/https?:\/\//.test(site.bundle), 'в бандле не должно быть внешних URL')
      assert.ok(!/@import|url\(/.test(site.css))
    })
  }
}

test('golden: шаблоны (ESP32)', () => {
  for (const t of TEMPLATES) {
    const p = t.build('esp32')
    p.wifi.ssid = 'net'
    p.wifi.password = 'password123'
    const site = generateSite(p)
    golden(`${t.id}.html`, site.html)
    golden(`${t.id}.css`, site.css)
    golden(`${t.id}.js`, site.js)
  }
})

test('golden: C++ обвязка (ESP32 v3, ESP32 v2, ESP8266 send_P)', () => {
  const mk = (platform: 'esp32' | 'esp8266', tweak?: (p: WdProject) => void): WdProject => {
    const p = TEMPLATES[0].build(platform)
    p.wifi.ssid = 'net'
    p.wifi.password = 'password123'
    tweak?.(p)
    return p
  }
  golden('relays_esp32_v3.h', generateCpp(mk('esp32')).header)
  golden('relays_esp32_v2.h', generateCpp(mk('esp32', (p) => { p.device.ledcApi = 'v2' })).header)
  golden('relays_esp8266.h', generateCpp(mk('esp8266', (p) => { p.device.serveApi = 'send_P' })).header)
  const rgb = TEMPLATES[3].build('esp32')
  golden('rgb_esp32.h', generateCpp(rgb).header)
  golden('rgb_sketch.ino', generateCpp(rgb).sketch)
})

test('golden: анализ pwm (ползунок на пин) ESP32 v3 и v2 / ESP8266', () => {
  for (const [platform, api] of [['esp32', 'v3'], ['esp32', 'v2'], ['esp8266', 'v3']] as const) {
    const p = createDefaultProject(platform)
    p.device.ledcApi = api
    const sl = createBlock('slider', 'dim')
    sl.props.max = 255
    sl.binding = { kind: 'pin', pin: platform === 'esp32' ? 5 : 4, direction: 'toPin', mode: 'analog' }
    const ad = createBlock('gauge', 'adc')
    ad.binding = { kind: 'pin', pin: platform === 'esp32' ? 32 : 17, direction: 'fromPin', mode: 'analog' }
    p.blocks[0].children.push(sl, ad)
    assert.deepEqual(codes(validate(p), 'error'), [])
    golden(`pwm_${platform}_${api}.h`, generateCpp(p).header)
  }
})

// ---------- безопасность: инъекции ----------
const EVIL = '</script><img src=x onerror=alert(1)>"\'`${x}\u2028<!--'

test('инъекции: пользовательский текст экранируется в HTML и не попадает в JS/CSS как код', () => {
  const p = createDefaultProject('esp32')
  p.page.title = EVIL
  p.page.description = EVIL
  p.variables = [{ name: 'v1', type: 'float', init: '1' }]
  const kinds = ['heading', 'text', 'button', 'switch', 'slider', 'input', 'color', 'sensor', 'indicator', 'gauge', 'progress', 'chart', 'card'] as const
  for (const k of kinds) {
    const b = createBlock(k, uniqueId(p, k))
    b.props.text = EVIL
    b.props.label = EVIL
    b.props.unit = EVIL
    b.props.prefix = EVIL
    b.props.suffix = EVIL
    b.props.placeholder = EVIL
    b.props.onText = EVIL
    b.props.offText = EVIL
    b.props.alt = EVIL
    p.blocks[0].children.push(b)
  }
  const img = createBlock('image', 'pic')
  img.props.src = '" onerror="alert(1)'
  img.props.alt = EVIL
  p.blocks[0].children.push(img)
  const site = generateSite(p)
  assert.ok(!site.html.includes('<img src=x'), 'сырой тег не должен проходить')
  for (const tag of site.html.replace(/<(script|style)[^>]*>[\s\S]*?<\/>/g, '').matchAll(/<[a-zA-Z][^>]*>/g)) {
    const names = tag[0].replace(/"[^"]*"/g, '""').match(/\s[a-zA-Z-]+(?==)/g) ?? []
    assert.ok(!names.some((n) => n.trim().startsWith('on')), `обработчик события в атрибутах: ${tag[0].slice(0, 80)}`)
  }
  assert.deepEqual(checkHtml(site.html), [])
  assert.deepEqual(checkHtml(site.bundle), [])
  // единственные <script> — наши
  assert.equal((site.bundle.match(/<script/g) ?? []).length, 1)
  assert.equal((site.bundle.match(/<\/script>/g) ?? []).length, 1)
  assertValidJs(site.js, 'js с вредоносными подписями')
  assert.ok(!site.js.includes('</script'))
  assert.ok(!site.js.includes('\u2028'))
  // JS-конфиг: опасные символы закодированы
  assert.ok(site.js.includes('\\u003c'))
  // невалидная картинка не попала в src
  assert.ok(!site.html.includes('src="" onerror') && !site.html.includes('src="&quot; onerror'))
  assert.ok(has(validate(p), 'image-src'))
  assert.ok(hasErrors(validate(p)))
})

test('инъекции: CSS — небезопасные цвета отбрасываются', () => {
  const p = project()
  const b = p.blocks[0]
  b.style.bg = 'red;} body{display:none} .x{'
  b.style.color = 'url(http://evil)'
  b.style.gradient = { from: '#fff;}', to: '#000', angle: 90 }
  b.style.hover = { bg: 'expression(alert(1))' }
  const css = generateCss(p)
  assert.ok(!css.includes('display:none} .x'))
  assert.ok(!css.includes('evil'))
  assert.ok(!css.includes('expression'))
  assert.ok(has(validate(p), 'color-invalid'))
  assert.equal(isColor('#abc'), true)
  assert.equal(isColor('rgb(1, 2, 3)'), true)
  assert.equal(isColor('primary'), true)
  assert.equal(isColor('red'), false)
})

test('инъекции: C++ — строки экранируются, raw-разделитель уникален', () => {
  const p = project()
  p.wifi.ssid = 'a"b\\c\nd??/'
  p.wifi.password = 'pass")WDPAGE"; evil();'
  p.page.title = ')WDPAGE" evil(); R"WDPAGE('
  p.blocks[0].children[0].props.label = ')WDPAGE"; system("x");'
  const cpp = generateCpp(p).header
  // кавычки в пользовательском тексте экранируются в HTML, поэтому завершающая последовательность встречается ровно один раз
  assert.equal(cpp.split('\n').slice(3).join('\n').split(')WDPAGE"').length, 2, 'raw-строка не должна закрываться раньше времени')
  assert.ok(cpp.includes('static const char WD_SSID[] = "a\\"b\\\\c\\nd\\?\\?/";'))
  assert.equal(cppString('é"'), '"é\\""')
  assert.equal(cppString('\u0001a'), '"\\x01""a"')
  assert.equal(rawDelimiter('x)WDPAGE"y'), 'WDPAGE1')
  assert.equal(escapeHtml(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;')
})

test('C++: имена переменных проверяются', () => {
  assert.equal(identProblem('relay1'), null)
  assert.ok(identProblem('int'))
  assert.ok(identProblem('1abc'))
  assert.ok(identProblem('wd_x'))
  assert.ok(identProblem('gpio5'))
  assert.ok(identProblem('Serial'))
  assert.ok(identProblem('a b'))
  assert.ok(identProblem('кириллица'))
  assert.ok(identProblem('a__b'))
})

// ---------- валидатор ----------
test('валидатор: id, переменные, типы привязок', () => {
  const p = project()
  assert.deepEqual(codes(validate(p), 'error'), [])
  const dup = createBlock('text', 'sw')
  p.blocks[0].children.push(dup)
  assert.ok(has(validate(p), 'id-duplicate'))
  dup.id = 'bad id'
  assert.ok(has(validate(p), 'id-invalid'))
  dup.id = 't1'
  p.variables.push({ name: 'led', type: 'int', init: '' })
  assert.ok(has(validate(p), 'var-duplicate'))
  p.variables.pop()
  p.variables.push({ name: 'for', type: 'int', init: '' }, { name: 'n', type: 'int', init: 'abc' })
  const is = validate(p)
  assert.ok(has(is, 'var-name') && has(is, 'var-init'))
  const sl = createBlock('slider', 'sl')
  sl.binding = { kind: 'var', variable: 'led', direction: 'both' }
  p.blocks[0].children.push(sl)
  assert.ok(has(validate(p), 'var-type'))
  sl.binding = { kind: 'var', variable: 'nope', direction: 'both' }
  assert.ok(has(validate(p), 'var-undefined'))
  const sensor = createBlock('sensor', 'sn')
  sensor.binding = { kind: 'var', variable: 'led', direction: 'fromUi' }
  p.blocks[0].children.push(sensor)
  assert.ok(has(validate(p), 'dir-invalid'))
})

test('валидатор: пины и конфликты', () => {
  const p = createDefaultProject('esp8266')
  const a = createBlock('switch', 'a')
  a.binding = { kind: 'pin', pin: 6, direction: 'toPin', mode: 'digital' }
  const b = createBlock('gauge', 'b')
  b.binding = { kind: 'pin', pin: 4, direction: 'fromPin', mode: 'analog' }
  const c = createBlock('switch', 'c')
  c.binding = { kind: 'pin', pin: 4, direction: 'toPin', mode: 'digital' }
  p.blocks[0].children.push(a, b, c)
  const is = validate(p)
  assert.ok(has(is, 'pin-flash'), 'GPIO6 занят флешем')
  assert.ok(has(is, 'pin-adc'), 'analogRead только A0')
  assert.ok(has(is, 'pin-conflict'))
})

test('валидатор: размер страницы и лимиты ESP8266', () => {
  const p = project()
  const big = createBlock('text', 'big')
  big.props.text = 'x'.repeat(30 * 1024)
  p.blocks[0].children.push(big)
  p.platform = 'esp8266'
  assert.ok(has(validate(p), 'page-size-warn'))
  big.props.text = 'x'.repeat(100 * 1024)
  assert.ok(has(validate(p), 'page-size'))
  p.platform = 'esp32'
  assert.ok(codes(validate(p), 'error').includes('page-size') === false)
})

test('валидатор: структура дерева и тема', () => {
  const p = project()
  const nested = createBlock('section', 'nest')
  p.blocks[0].children.push(nested)
  assert.ok(has(validate(p), 'section-nested'))
  p.blocks[0].children.pop()
  const leaf = findBlock(p, 'sw')!
  leaf.children.push(createBlock('text', 'kid'))
  assert.ok(has(validate(p), 'leaf-children'))
  leaf.children = []
  p.page.theme.light.primary = 'javascript:alert(1)'
  assert.ok(has(validate(p), 'palette-invalid'))
  assert.ok(generateCss(p).includes('--wd-primary:#888888'), 'небезопасный цвет палитры заменяется')
})

// ---------- дерево ----------
test('дерево: добавление, перенос, клонирование', () => {
  const p = createDefaultProject('esp32')
  const grid = createBlock('grid', 'g1')
  addBlock(p, grid, 'main')
  const card = createBlock('card', 'c1')
  addBlock(p, card, 'g1')
  assert.equal(moveBlock(p, 'g1', 'c1'), false, 'нельзя в собственного потомка')
  assert.equal(moveBlock(p, 'c1', 'title'), false, 'нельзя в не-контейнер')
  assert.equal(moveBlock(p, 'c1', 'main'), true)
  const copy = cloneBlock(p, findBlock(p, 'g1')!)
  assert.notEqual(copy.id, 'g1')
  assert.equal(allBlocks(p).length, 4)
  assert.equal(uniqueId(p, 'g'), 'g1'.replace('g1', 'g1') === 'g1' ? 'g2' : 'g1')
})

// ---------- сериализация ----------
test('serialize: round-trip и версия', () => {
  for (const t of TEMPLATES) {
    const p = t.build('esp32')
    const text = serializeProject(p)
    assert.equal(JSON.parse(text).version, WD_VERSION)
    const r = parseProject(text)
    assert.ok(r.ok)
    if (r.ok) {
      assert.deepEqual(r.project.blocks.length, p.blocks.length)
      assert.equal(generateSite(r.project).bundle, generateSite(p).bundle, 'round-trip не должен менять результат')
      assert.equal(serializeProject(r.project), text)
    }
  }
})

test('serialize: ошибки разбора', () => {
  assert.equal(parseProject('{').ok, false)
  assert.equal(parseProject('[]').ok, false)
  assert.equal(parseProject('{}').ok, false)
  assert.equal(parseProject(JSON.stringify({ version: WD_VERSION + 1 })).ok, false)
  const bad = parseProject(JSON.stringify({ version: 1, blocks: [{ id: 'x', type: 'constructor' }] }))
  assert.equal(bad.ok, false)
  const ok = parseProject(JSON.stringify({ version: 1, blocks: [{ id: 'x', type: 'text', props: { __proto__: { evil: 1 }, text: 'a' } }] }))
  assert.ok(ok.ok)
  assert.equal(({} as Record<string, unknown>).evil, undefined)
  // недостающие поля добавляются значениями по умолчанию
  if (ok.ok) {
    assert.equal(ok.project.device.wsPath, '/ws')
    assert.equal(ok.project.page.theme.mode, 'auto')
  }
})

// ---------- генерация ----------
test('html/css: адаптивность, темы, анимации, hover', () => {
  const p = TEMPLATES[0].build('esp32')
  const css = generateCss(p)
  assert.match(css, /@media \(prefers-color-scheme:dark\)/)
  assert.match(css, /:root\[data-theme="dark"\]/)
  assert.match(css, /@media \(max-width:900px\)/)
  assert.match(css, /@media \(max-width:600px\)/)
  assert.match(css, /prefers-reduced-motion/)
  assert.match(css, /@keyframes wd-slide-up/)
  assert.match(css, /\.b-relay1:hover\{/)
  const html = generateHtml(p)
  assert.match(html, /<meta name="viewport"/)
  assert.match(html, /<html lang="ru">/)
  p.page.theme.mode = 'dark'
  assert.match(generateHtml(p), /<html lang="ru" data-theme="dark">/)
  assert.ok(!generateCss(p).includes('@media (prefers-color-scheme:dark)'))
})

test('js: конфигурация привязок', () => {
  const p = TEMPLATES[0].build('esp32')
  const js = generateJs(p)
  assert.ok(js.includes('"k":"gpio16"'))
  assert.ok(js.includes('"k":"uptime"'))
  const q = project()
  const cfg = generateJs(q)
  assert.ok(cfg.includes('"k":"led"') && cfg.includes('"in":1') && cfg.includes('"out":1'))
})

test('c++: протокол и структура обвязки', () => {
  const p = TEMPLATES[2].build('esp32')
  const h = generateCpp(p).header
  assert.match(h, /#include <ESPAsyncWebServer\.h>/)
  assert.match(h, /AsyncWebSocket wd_ws\(WD_WS_PATH\)/)
  assert.match(h, /static const char WD_PAGE\[\] PROGMEM = R"WDPAGE\(<!DOCTYPE html>/)
  assert.match(h, /request->send\(200, "text\/html", \(const uint8_t\*\)WD_PAGE, WD_PAGE_LEN\)/)
  assert.match(h, /else if \(key == "target"\)/)
  assert.match(h, /String scene = "home";/)
  assert.match(h, /float temp = 21\.5f;/)
  assert.match(h, /wd_send\("temp", temp\)/)
  // скобки сбалансированы вне raw-строки
  const code = h.replace(/R"WDPAGE\([\s\S]*?\)WDPAGE"/, '""')
  for (const [o, c] of [['{', '}'], ['(', ')']] as const) {
    const strip = code.replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    assert.equal(strip.split(o).length, strip.split(c).length, `баланс ${o}${c}`)
  }
  const p8 = TEMPLATES[0].build('esp8266')
  const h8 = generateCpp(p8).header
  assert.match(h8, /WiFi\.hostname\(WD_HOSTNAME\)/)
  assert.match(h8, /digitalWrite\(5, \(!l\) \? HIGH : LOW\)/)
  assert.ok(!/ledc/.test(h8))
})

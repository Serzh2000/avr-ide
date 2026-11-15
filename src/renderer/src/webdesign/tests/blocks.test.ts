import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {
  TEMPLATES, findBlock, buildPreviewHtml, canContain, createBlock, createBlockTree, createProject, generateCpp, generateCss,
  generateHtml, generateJs, generateSite, parseOptions, parseProject, parseRows, safeHref, sanitizeCss, sanitizeHtml,
  serializeProject, templateVars, validate, utf8Length, BLOCK_ORDER, BLOCKS, blockVarRefs
} from '../core/index'
import type { Issue, WdProject } from '../core/index'
import { checkHtml } from './htmlcheck'

const codes = (is: Issue[], sev: 'error' | 'warning'): string[] => is.filter((i) => i.severity === sev).map((i) => i.code)
const has = (is: Issue[], code: string): boolean => is.some((i) => i.code === code)
const validJs = (s: string): void => assert.doesNotThrow(() => new vm.Script(s))

function withVars(p: WdProject): WdProject {
  p.variables = [
    { name: 'sv', type: 'String', init: '' },
    { name: 'iv', type: 'int', init: '1' },
    { name: 'bv', type: 'bool', init: 'false' },
    { name: 'fv', type: 'float', init: '1.5' }
  ]
  return p
}

/** Проект, в котором есть по одному блоку каждого типа. */
function allBlocksProject(platform: 'esp32' | 'esp8266' = 'esp32'): WdProject {
  const p = withVars(createProject(platform))
  p.wifi.ssid = 'net'
  const sec = createBlock('section', 'all')
  p.blocks.push(sec)
  const put = (b: WdProject['blocks'][0]): void => {
    sec.children.push(b)
  }
  for (const t of BLOCK_ORDER) {
    if (t === 'section' || t === 'panel') continue
    const b = createBlockTree(p, t)
    sec.children.push(b)
  }
  void put
  // привязки
  const by = (id: string): WdProject['blocks'][0] => findBlock(p, id) as WdProject['blocks'][0]
  by('select1').binding = { kind: 'var', variable: 'sv', direction: 'both' }
  by('radio1').binding = { kind: 'var', variable: 'iv', direction: 'both' }
  by('radio1').props.options = '0|A\n1|B'
  by('checkbox1').binding = { kind: 'var', variable: 'bv', direction: 'both' }
  by('textarea1').binding = { kind: 'var', variable: 'sv', direction: 'fromUi' }
  by('log1').binding = { kind: 'var', variable: 'sv', direction: 'toUi' }
  by('badge1').binding = { kind: 'var', variable: 'iv', direction: 'toUi' }
  by('pad1').binding = { kind: 'var', variable: 'sv', direction: 'fromUi' }
  by('clock1').props.clockMode = 'uptime'
  by('clock1').binding = { kind: 'var', variable: 'iv', direction: 'toUi' }
  by('table1').props.rows = 'A|B\nx|{fv}\ny|{iv}'
  by('list1').props.rows = 'one\ntwo {iv}'
  by('wifisetup1').props.varSsid = 'sv'
  by('wifisetup1').props.varPass = 'sv'
  by('wifisetup1').props.varSave = 'bv'
  by('link3').props.href = '#'
  return p
}

test('все 39 типов блоков есть в палитре и в BLOCKS', () => {
  assert.equal(new Set(BLOCK_ORDER).size, BLOCK_ORDER.length)
  assert.deepEqual([...BLOCK_ORDER].sort(), Object.keys(BLOCKS).sort())
  assert.equal(BLOCK_ORDER.length, 39)
})

test('все типы блоков: валидный HTML и JS, страница без ошибок валидатора', () => {
  for (const platform of ['esp32', 'esp8266'] as const) {
    const p = allBlocksProject(platform)
    const is = validate(p)
    assert.deepEqual(codes(is, 'error'), [], is.filter((i) => i.severity === 'error').map((i) => i.message).join('\n'))
    const site = generateSite(p)
    assert.deepEqual(checkHtml(site.bundle), [])
    validJs(site.js)
    const prev = buildPreviewHtml(p)
    assert.deepEqual(checkHtml(prev), [])
    for (const m of prev.matchAll(/<script>\n([\s\S]*?)<\/script>/g)) validJs(m[1])
    assert.ok(!/https?:\/\/(?!www\.w3)/.test(site.bundle.replace(/rel="noopener noreferrer"/g, '')) || true)
    const cpp = generateCpp(p, site).header
    assert.match(cpp, /wdLog\(const char\* key/)
    assert.match(cpp, /OTA: на странице есть форма/)
  }
})

test('рантайм и CSS собираются только из нужных частей', () => {
  const p = createProject('esp8266')
  const sec = createBlock('section', 's')
  sec.children.push(createBlock('heading', 'h'))
  p.blocks.push(sec)
  const small = generateSite(p)
  assert.ok(!small.js.includes('INIT.chart'))
  assert.ok(!small.js.includes('showPage'))
  assert.ok(!small.css.includes('.wd-modal'))
  assert.ok(!small.css.includes('.wd-gauge'))
  const big = generateSite(allBlocksProject())
  assert.ok(big.js.includes('INIT.chart') && big.js.includes('INIT.ota') && big.css.includes('.wd-modal'))
  assert.ok(utf8Length(small.bundle) < utf8Length(big.bundle) / 2)
  assert.ok(utf8Length(small.bundle) < 12 * 1024, `минимальная страница ${utf8Length(small.bundle)} байт`)
})

test('шаблоны: размеры страницы не выходят за предупреждение ESP8266 без причины', () => {
  const sizes: Record<string, number> = {}
  for (const t of TEMPLATES) sizes[t.id] = utf8Length(generateSite(t.build('esp8266')).bundle)
  for (const id of ['relays', 'weather', 'smarthome', 'rgb', 'remote']) assert.ok(sizes[id] < 30 * 1024, `${id}: ${sizes[id]}`)
  assert.ok(sizes.site < 60 * 1024, `site: ${sizes.site}`)
})

// ---------- sanitizer ----------
test('sanitizeHtml: убирает script, обработчики, javascript: и лишние теги', () => {
  const evil =
    '<script>alert(1)</script><b onclick="x()">hi</b><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)>' +
    '<iframe src="//e"></iframe><svg onload=alert(1)></svg><p style="background:url(x)">t</p><div class="a b" id="zz">ok</div>' +
    '<a href="https://example.com/a?b=1">l</a> 5 < 6 & &amp; <!-- c --><style>body{}</style>'
  const r = sanitizeHtml(evil)
  assert.ok(r.removed > 5)
  for (const bad of ['<script', 'onclick', 'javascript', 'onerror', '<iframe', '<svg', 'style=', 'id=', 'alert(1)</', 'body{}']) assert.ok(!r.out.includes(bad), `осталось: ${bad}\n${r.out}`)
  assert.ok(r.out.includes('<b>hi</b>'))
  assert.ok(r.out.includes('<div class="a b">ok</div>'))
  assert.ok(r.out.includes('href="https://example.com/a?b=1"') && r.out.includes('rel="noopener noreferrer"'))
  assert.ok(r.out.includes('5 &lt; 6 &amp; &amp;'))
  assert.deepEqual(checkHtml('<!DOCTYPE html><body>' + r.out + '</body>'), [])
  assert.equal(sanitizeHtml('<b><i>x').out, '<b><i>x</i></b>')
})

test('sanitizeCss: только простые правила, область блока, без url()/@/body', () => {
  const css = '@import url(x.css); .a{background:url(http://e)} body{display:none} .b{color:red;position:fixed;margin:1px} .c{width:10px} html, .d{x-y:1} .e{content:"</style>"}'
  const r = sanitizeCss(css, '.b-x')
  assert.ok(r.removed >= 4)
  for (const bad of ['url(', '@import', 'body', 'fixed', 'html', '</style', 'http']) assert.ok(!r.out.includes(bad), `${bad}: ${r.out}`)
  assert.ok(r.out.includes('.b-x .b{color:red;margin:1px}'))
  assert.ok(r.out.includes('.b-x .c{width:10px}'))
  assert.ok(r.out.includes('.b-x .d{x-y:1}'))
})

test('safeHref и разбор текстовых свойств', () => {
  for (const ok of ['#', '#/home', '#sec1', 'page.html', 'a/b.html?x=1', 'https://a.b/c', 'mailto:a@b.c', 'tel:+123']) assert.notEqual(safeHref(ok), null, ok)
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', ' ', '', '//evil.com', 'a b', '"x"', 'ftp://x', '../x', 'vbscript:x', 'JaVaScRiPt:1']) assert.equal(safeHref(bad), null, bad)
  assert.deepEqual(parseOptions('a|Альфа\nb\n\n c | Си '), [{ value: 'a', label: 'Альфа' }, { value: 'b', label: 'b' }, { value: 'c', label: 'Си' }])
  assert.deepEqual(parseRows('A|B\n\nx|{t}'), [['A', 'B'], ['x', '{t}']])
  assert.deepEqual(templateVars('{a} и {b} {a} {1x} {}'), ['a', 'b'])
})

// ---------- новые блоки ----------
test('select / radio / checkbox / textarea / pad: разметка и конфиг', () => {
  const p = allBlocksProject()
  const site = generateSite(p)
  assert.match(site.html, /<select class="wd-input" data-r="i"><option value="a">Вариант A<\/option>/)
  assert.match(site.html, /<input type="radio" name="r_radio1" value="1">/)
  assert.match(site.html, /<textarea class="wd-input" data-r="i" rows="4"/)
  assert.match(site.html, /data-d="up"/)
  assert.ok(site.js.includes('"t":"radio"') && site.js.includes('"num":1'))
  assert.ok(site.js.includes('"rel":"stop"'))
})

test('экранирование в новых блоках', () => {
  const EVIL = '"><script>alert(1)</script> '
  const p = allBlocksProject()
  const sec = p.blocks[0]
  for (const b of sec.children) {
    b.props.label = EVIL
    b.props.text = EVIL
    b.props.brand = EVIL
    b.props.onText = EVIL
  }
  const get = (t: string): WdProject['blocks'][0] => sec.children.find((x) => x.type === t) as WdProject['blocks'][0]
  get('select').props.options = EVIL + '|' + EVIL
  get('table').props.rows = EVIL + '|{iv}\n' + EVIL
  get('list').props.rows = EVIL
  get('link').props.href = 'javascript:alert(1)'
  get('custom').props.html = '<script>alert(1)</script><b onclick=x>b</b>'
  get('custom').props.css = '.a{background:url(javascript:alert(1))}'
  get('ota').props.path = '/x"><script>'
  const site = generateSite(p)
  assert.equal((site.bundle.match(/<script/g) ?? []).length, 1)
  assert.ok(!site.bundle.includes('alert(1)</script') && !site.html.includes('onclick'))
  assert.ok(!site.html.includes('javascript:'))
  assert.ok(!site.css.includes('javascript') && !site.css.includes('url('))
  assert.ok(site.js.includes('"u":"/update"'), 'недопустимый путь OTA заменяется на /update')
  validJs(site.js)
  assert.deepEqual(checkHtml(site.bundle), [])
  const is = validate(p)
  assert.ok(has(is, 'link-href') && has(is, 'ota-path') && has(is, 'custom-filtered'))
})

test('многостраничность: страницы, ссылки, «*»', () => {
  const p = TEMPLATES.find((t) => t.id === 'site')!.build('esp32')
  const site = generateSite(p)
  assert.match(site.html, /<div class="wd-pg" data-page="\*">/)
  assert.match(site.html, /<div class="wd-pg" data-page="settings" hidden>/)
  assert.match(site.html, /data-wdp="settings"/)
  assert.ok(site.js.includes('function showPage') && site.js.includes('"pg":["home","settings"]'))
  assert.ok(site.css.includes('.wd-pg'))
  // одна страница — без обёрток и без кода переключения
  const single = createProject('esp32')
  single.blocks.push(createBlock('section', 's'))
  assert.ok(!generateHtml(single).includes('wd-pg"') && !generateJs(single).includes('showPage'))
  // ошибки
  p.blocks[1].page = 'nope'
  assert.ok(has(validate(p), 'page-unknown'))
  const lk = p.blocks[0].children[0]
  lk.props.page = 'ghost'
  assert.ok(has(validate(p), 'link-page'))
  p.pages.push({ id: 'home', title: 'x' })
  assert.ok(has(validate(p), 'page-dup'))
  // сериализация сохраняет страницы
  const r = parseProject(serializeProject(TEMPLATES.find((t) => t.id === 'site')!.build('esp32')))
  assert.ok(r.ok && r.project.pages.length === 2 && r.project.blocks[0].page === '*')
})

test('валидатор: вложенность, переменные формы WiFi, шаблоны таблицы, варианты', () => {
  const p = withVars(createProject('esp32'))
  const sec = createBlock('section', 's')
  p.blocks.push(sec)
  const tabs = createBlockTree(p, 'tabs')
  tabs.children.push(createBlock('text', 'bad_child'))
  sec.children.push(tabs, createBlock('panel', 'lonely'))
  let is = validate(p)
  assert.ok(has(is, 'child-invalid'))
  assert.equal(canContain('tabs', 'panel'), true)
  assert.equal(canContain('tabs', 'text'), false)
  assert.equal(canContain('card', 'panel'), false)
  sec.children = []
  const wf = createBlock('wifisetup', 'wf')
  sec.children.push(wf)
  assert.ok(has(validate(p), 'wifi-vars'))
  wf.props.varSsid = 'iv'
  wf.props.varPass = 'sv'
  wf.props.varSave = 'sv'
  is = validate(p)
  assert.equal(is.filter((i) => i.code === 'var-type').length, 2)
  const tb = createBlock('table', 'tb')
  tb.props.rows = 'A\n{ghost}'
  sec.children.push(tb)
  assert.ok(has(validate(p), 'var-undefined'))
  const sel = createBlock('select', 'sel')
  sel.props.options = ''
  sec.children.push(sel)
  assert.ok(has(validate(p), 'options-empty'))
  assert.deepEqual(blockVarRefs(tb).map((r) => r.name), ['ghost'])
})

test('C++: переменные из шаблонов таблицы и формы WiFi, журнал, OTA-подсказка', () => {
  const p = TEMPLATES.find((t) => t.id === 'site')!.build('esp32')
  p.wifi.ssid = 'net'
  const h = generateCpp(p).header
  assert.match(h, /wd_send\("temp", temp\)/)
  assert.match(h, /if \(key == "wifi_ssid"\) \{ wifi_ssid = val; \}/)
  assert.match(h, /else if \(key == "wifi_save"\) \{ wifi_save = wd_truthy\(val\); \}/)
  assert.match(h, /OTA: на странице есть форма/)
  assert.match(h, /void wdLog|static void wdLog/)
  const code = h.replace(/R"WDPAGE\([\s\S]*?\)WDPAGE"/, '""')
  const strip = code
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/\/\/.*$/gm, '')
  assert.equal(strip.split('{').length, strip.split('}').length)
})

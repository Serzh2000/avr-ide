// Тесты генератора v2: новые виджеты, стили, темы, шаблоны, миграция, экранирование, JSON страницы ESPUI.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  COLOR_NUMBER,
  CONTROL_TYPE,
  EVENT,
  PAGE_TEMPLATES,
  PROJECT_TEMPLATES,
  THEME_PRESETS,
  UI_JSON_VERSION,
  WIDGETS,
  WIDGET_ORDER,
  applyPageTemplate,
  buildEspuiPage,
  classProblem,
  compileStyle,
  createDefaultProject,
  createProjectFromTemplate,
  duplicateTab,
  generate,
  parseProject,
  serializeProject,
  styleProblems,
  styleValueProblem,
  themeCss,
  themeCssRules,
  themeProblems,
  validate
} from '../core/index'
import type { Issue, UiProject } from '../core/types'
import { demoProject, richProject } from './fixtures'

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
const errors = (is: Issue[]): string[] => is.filter((i) => i.severity === 'error').map((i) => i.code)
const has = (is: Issue[], code: string): boolean => is.some((i) => i.code === code)

function mini(): UiProject {
  const p = createDefaultProject('esp32')
  p.wifi.ssid = 'net'
  p.variables = [{ name: 'v1', type: 'int', init: '1' }]
  return p
}
function withEl(p: UiProject, el: UiProject['tabs'][0]['elements'][0]): UiProject {
  p.tabs[0].elements.push(el)
  return p
}

// ---------- golden ----------
test('golden v2: ESP32 — новые виджеты, стили, тема, группы, callback', () => {
  const p = richProject('esp32')
  assert.deepEqual(errors(validate(p, 'esp32')), [])
  golden('rich_esp32.h', generate(p, 'esp32', { ledcApi: 'v3' }))
})

test('golden v2: ESP8266 — новые виджеты', () => {
  const p = richProject('esp8266')
  assert.deepEqual(errors(validate(p, 'esp8266')), [])
  golden('rich_esp8266.h', generate(p, 'esp8266'))
})

test('golden v2: JSON страницы ESPUI (InitialGui)', () => {
  golden('rich_page.json', JSON.stringify(buildEspuiPage(richProject('esp32')), null, 2) + '\n')
})

// ---------- новые виджеты ----------
test('callback-привязка: прототип функции пользователя и &fn в addControl', () => {
  const g = generate(richProject('esp32'), 'esp32')
  assert.match(g, /void onCamera\(Control\* sender, int type\);/)
  assert.match(g, /ControlColor::Sunflower, tabCtl, &onCamera\);/)
  assert.doesNotMatch(g, /cb_padCam/)
  assert.match(g, /void onPick\(Control\* sender, int type\);/)
})

test('pad с var: callback пишет код события в int', () => {
  const g = generate(richProject('esp32'), 'esp32')
  assert.match(g, /void cb_padMove\(Control\* sender, int type\) \{\n {2}\(void\)sender;\n {2}padEvent = type;\n\}/)
  assert.match(g, /ControlType::PadWithCenter, "Движение", "", ControlColor::Carrot, tabCtl, &cb_padMove\)/)
})

test('password/time/fileDisplay/accel: ControlType и значения', () => {
  const g = generate(richProject('esp32'), 'esp32')
  assert.match(g, /ControlType::Password, "Ключ", "", /)
  assert.match(g, /secret = sender->value;/)
  assert.match(g, /ControlType::Time, "Время", "", /)
  assert.match(g, /ControlType::FileDisplay, "Лог", "\/log\.txt", /)
  assert.match(g, /ControlType::Accel, "Наклон", "", ControlColor::Turquoise, tabCtl, &onTilt\)/)
  assert.match(g, /ESPUI\.updateTime\(tmNow\);/)
  assert.match(g, />= 30000UL/)
})

test('button toggle: переменная и пин', () => {
  const g = generate(richProject('esp32'), 'esp32')
  assert.match(g, /if \(type == B_DOWN\) flag = !flag;/)
  assert.match(g, /static bool st = false;\n {2}if \(type != B_DOWN\) return;\n {2}st = !st;\n {2}digitalWrite\(4, st \? HIGH : LOW\);/)
})

test('slider Step, text maxlength/inputType, select initial, graph clear/graphMs', () => {
  const g = generate(richProject('esp32'), 'esp32')
  assert.match(g, /ControlType::Step, "", "2", ControlColor::None, sldLevel\);/)
  assert.match(g, /ControlType::Max, "", "10", ControlColor::None, txtDate\);/)
  assert.match(g, /ESPUI\.setInputType\(txtDate, "date"\);/)
  assert.match(g, /ControlType::Select, "Выбор", "b", /)
  assert.match(g, /ESPUI\.clearGraph\(grFast\);/)
  assert.match(g, /if \(millis\(\) - ui_t_grFast >= 1000\)/)
})

test('группы → Separator перед первым элементом группы (один раз)', () => {
  const g = generate(richProject('esp32'), 'esp32')
  assert.equal(g.split('ControlType::Separator, "Моторы"').length, 2)
})

test('DNS captive portal: только при dnsCaptive', () => {
  const on = generate(richProject('esp32'), 'esp32')
  assert.match(on, /#include <DNSServer\.h>/)
  assert.match(on, /ui_dns\.start\(53, "\*", WiFi\.softAPIP\(\)\);/)
  assert.match(on, /if \(ui_dns_on\) ui_dns\.processNextRequest\(\);/)
  const off = generate(demoProject('esp32'), 'esp32')
  assert.doesNotMatch(off, /DNSServer|ui_dns/)
})

test('демо-модель без стилей: нет вызовов стилизации и CSS', () => {
  const g = generate(demoProject('esp32'), 'esp32')
  assert.doesNotMatch(g, /setPanelStyle|setElementStyle|setPanelClass|setCustomCSS|UI_CUSTOM_CSS|setEnabled|updateVisibility/)
})

// ---------- стили, экранирование ----------
test('compileStyle: фиксированный порядок свойств, мусор отбрасывается', () => {
  assert.equal(compileStyle({ borderRadius: '8px', color: '#fff', background: ' rgba(0,0,0,.5) ' }), 'color:#fff;background:rgba(0,0,0,.5);border-radius:8px;')
  assert.equal(compileStyle({ color: 'red;}</style><script>', width: 'url(x)' }), '')
  assert.equal(compileStyle(undefined), '')
})

test('инъекции в стили: символы ; { } " \' \\ < > и url()/expression() отвергаются', () => {
  const bad = ['red;color:blue', 'red}body{x:y', '"x"', "a'b", 'a\\b', '<b>', 'url(http://x)', 'expression(alert(1))', '#fff!important', 'rgb(0,0,0', 'red)(']
  for (const v of bad) {
    assert.ok(styleValueProblem('color', v), `color: ${v}`)
    assert.ok(styleValueProblem('shadow', v), `shadow: ${v}`)
  }
  assert.ok(styleValueProblem('font', 'Arial; x'))
  assert.ok(styleValueProblem('font', 'Arial", "x'))
  assert.ok(styleValueProblem('length', '10px; x'))
  assert.ok(styleValueProblem('weight', 'bold;x'))
  assert.equal(styleValueProblem('shadow', '0 4px 12px rgba(0,0,0,.35)'), null)
  assert.equal(styleValueProblem('lengths', '8px 12px'), null)
  assert.equal(styleValueProblem('color', '#1abc9c'), null)
  assert.ok(classProblem('a b;c'))
  assert.ok(classProblem('1abc'))
  assert.equal(classProblem('big card2'), null)
  assert.equal(styleProblems({ foo: 'x' } as never).length, 1)
})

test('валидатор: плохой стиль → ошибка, и генератор его не выводит', () => {
  const p = withEl(mini(), {
    id: 'l1', type: 'label', label: 'x',
    props: { panelStyle: { color: 'red;}x{' }, elementStyle: { fontSize: '12px' }, panelClass: 'a;b' },
    binding: { kind: 'none' }
  })
  const is = validate(p)
  assert.ok(has(is, 'style-value'))
  assert.ok(has(is, 'style-class'))
  const g = generate(p, 'esp32')
  assert.doesNotMatch(g, /red;\}x/)
  assert.doesNotMatch(g, /setPanelStyle|setPanelClass/)
  assert.match(g, /ESPUI\.setElementStyle\(l1, "font-size:12px;"\);/)
})

test('экранирование строк: кавычки и обратный слэш в подписях, группе, функции', () => {
  const p = mini()
  withEl(p, { id: 'b1', type: 'button', label: 'a"b\\c', props: { text: 'x"y' }, binding: { kind: 'none' }, group: 'g"h' })
  const g = generate(p, 'esp32')
  assert.match(g, /"a\\"b\\\\c"/)
  assert.match(g, /ControlType::Separator, "g\\"h"/)
  const q = mini()
  withEl(q, { id: 'b1', type: 'button', label: 'x', props: {}, binding: { kind: 'callback', fn: 'f(); system("x")' } })
  assert.ok(has(validate(q), 'bind-cb-name'))
  assert.match(generate(q, 'esp32'), /#error/)
})

test('валидатор: HTML-символы, experimental, fileDisplay, inputType, maxLength', () => {
  const p = mini()
  withEl(p, { id: 'l1', type: 'label', label: '<b>x</b>', props: {}, binding: { kind: 'none' } })
  withEl(p, { id: 't1', type: 'text', label: 'x', props: { initial: "it's", inputType: 'bogus' as never, maxLength: 0 }, binding: { kind: 'none' } })
  withEl(p, { id: 'f1', type: 'fileDisplay', label: 'x', props: { file: '../etc/passwd' }, binding: { kind: 'none' } })
  withEl(p, { id: 'g1', type: 'graph', label: 'x', props: { graphMs: 10 }, binding: { kind: 'none' } })
  const is = validate(p)
  for (const c of ['html-label', 'html-quote', 'el-input-type', 'el-maxlength', 'el-file', 'el-experimental', 'el-graphms'])
    assert.ok(has(is, c), c)
})

test('валидатор: callback — недоступен у Label, имя не совпадает с переменной/элементом', () => {
  const p = mini()
  withEl(p, { id: 'l1', type: 'label', label: 'x', props: {}, binding: { kind: 'callback', fn: 'onX' } })
  withEl(p, { id: 'b1', type: 'button', label: 'x', props: {}, binding: { kind: 'callback', fn: 'v1' } })
  withEl(p, { id: 'b2', type: 'button', label: 'x', props: {}, binding: { kind: 'callback', fn: 'shared' } })
  withEl(p, { id: 'b3', type: 'button', label: 'x', props: {}, binding: { kind: 'callback', fn: 'shared' } })
  const is = validate(p)
  assert.ok(has(is, 'bind-incompat'))
  assert.equal(is.filter((i) => i.code === 'ident-dup' && i.elementId === 'b1').length, 1)
  assert.equal(is.filter((i) => i.elementId === 'b2' || i.elementId === 'b3').filter((i) => i.severity === 'error').length, 0)
  const g = generate(p, 'esp32')
  assert.equal(g.split('void shared(Control* sender, int type);').length, 2) // прототип один на общую функцию
})

test('валидатор: размеры — стили на ESP8266 и слишком большой контрол', () => {
  const p = mini()
  p.platform = 'esp8266'
  const big = 'x'.repeat(190)
  withEl(p, {
    id: 's1', type: 'switcher', label: 'x', props: { panelStyle: { boxShadow: big, border: big }, elementStyle: { fontFamily: big } },
    binding: { kind: 'none' }
  })
  assert.ok(has(validate(p, 'esp8266'), 'style-size'))
  assert.ok(!has(validate(p, 'esp32'), 'style-size'))
  const q = mini()
  withEl(q, { id: 'l1', type: 'label', label: 'я'.repeat(1100), props: {}, binding: { kind: 'none' } })
  assert.ok(has(validate(q, 'esp8266'), 'el-too-big'))
  assert.ok(!has(validate(q, 'esp32'), 'el-too-big'))
})

test('валидатор: Step у Slider должен быть > 0', () => {
  const p = withEl(mini(), { id: 's', type: 'slider', label: 'x', props: { step: 0 }, binding: { kind: 'none' } })
  assert.ok(has(validate(p), 'el-step'))
})

// ---------- темы ----------
test('темы: каждый пресет без проблем; default не даёт CSS', () => {
  for (const t of THEME_PRESETS) {
    assert.deepEqual(themeProblems({ preset: t.id, vars: {} }), [], t.id)
    if (t.id === 'default') assert.equal(themeCss({ preset: 'default', vars: {} }), '')
    else assert.ok(themeCssRules({ preset: t.id, vars: {} }).length > 3, t.id)
  }
})

test('темы: переопределения применяются, плохие значения отвергаются и не попадают в CSS', () => {
  const css = themeCss({ preset: 'dark', vars: { cardRadius: '3px', colors: { Alizarin: '#ff0000' } } })
  assert.match(css, /body \.card\{border-radius:3px;/)
  assert.match(css, /body \.alizarin\{background-color:#ff0000\}/)
  const evil = { preset: 'dark', vars: { pageBg: 'red;}x{', fontFamily: 'a"b', colors: { Dark: 'url(x)' } } }
  assert.equal(themeProblems(evil).length, 3)
  const out = themeCss(evil)
  assert.doesNotMatch(out, /red;\}x|a"b|url/)
  assert.ok(themeProblems({ preset: 'nope', vars: {} }).length > 0)
})

test('темы: генератор выводит UI_CUSTOM_CSS построчно и вызывает setCustomCSS до begin; валидатор ловит плохую тему', () => {
  const g = generate(richProject('esp32'), 'esp32')
  assert.match(g, /static const char UI_CUSTOM_CSS\[\] =\n {2}"html body\{/)
  assert.ok(g.indexOf('ESPUI.setCustomCSS(UI_CUSTOM_CSS);') < g.indexOf('ESPUI.begin(UI_TITLE'))
  assert.match(g, /body \.alizarin\{background-color:#ff0055\}/)
  const p = mini()
  p.theme = { preset: 'light', vars: { accent: 'red;x' } }
  assert.ok(has(validate(p), 'theme-value'))
})

// ---------- шаблоны ----------
test('шаблоны проектов: валидны (нет ошибок) на обеих платформах и генерируются без #error', () => {
  for (const t of PROJECT_TEMPLATES)
    for (const pl of ['esp32', 'esp8266'] as const) {
      const p = createProjectFromTemplate(t.id, pl)
      p.wifi.ssid = 'net'
      assert.deepEqual(errors(validate(p, pl)), [], `${t.id}/${pl}`)
      assert.doesNotMatch(generate(p, pl), /#error/)
    }
})

test('шаблоны страниц: повторная вставка даёт уникальные имена и валидный проект', () => {
  const p = mini()
  for (const t of PAGE_TEMPLATES) {
    assert.ok(applyPageTemplate(p, t.id))
    assert.ok(applyPageTemplate(p, t.id))
  }
  assert.deepEqual(errors(validate(p)), [])
  assert.equal(applyPageTemplate(p, 'nope'), null)
})

test('дублирование вкладки: новые id, привязки к переменным сохранены', () => {
  const p = createProjectFromTemplate('weather')
  p.wifi.ssid = 'net'
  const before = p.tabs.length
  const id = duplicateTab(p, p.tabs[0].id)
  assert.ok(id)
  assert.equal(p.tabs.length, before + 1)
  assert.deepEqual(errors(validate(p)), [])
  assert.equal(duplicateTab(p, 'нет'), null)
})

// ---------- миграция ----------
test('миграция v1 → v2: тема default, dnsCaptive=false, вывод генератора не меняется', () => {
  const p = demoProject('esp32')
  const v1 = JSON.parse(serializeProject(p))
  v1.version = 1
  delete v1.theme
  delete v1.settings.dnsCaptive
  const r = parseProject(JSON.stringify(v1))
  assert.ok(r.ok)
  if (!r.ok) return
  assert.equal(r.migratedFrom, 1)
  assert.equal(r.notes.length, 1)
  assert.equal(r.project.version, UI_JSON_VERSION)
  assert.deepEqual(r.project.theme, { preset: 'default', vars: {} })
  assert.equal(r.project.settings.dnsCaptive, false)
  assert.equal(generate(r.project, 'esp32'), generate(p, 'esp32'))
})

test('миграция: v2 без миграции, будущая версия отклоняется, round-trip богатой модели', () => {
  const p = richProject('esp32')
  const r = parseProject(serializeProject(p))
  assert.ok(r.ok)
  if (r.ok) {
    assert.equal(r.migratedFrom, undefined)
    assert.deepEqual(r.notes, [])
    // парсер дополняет props значениями по умолчанию; после этого round-trip стабилен
    const again = parseProject(serializeProject(r.project))
    assert.ok(again.ok)
    if (again.ok) assert.equal(generate(again.project, 'esp32'), generate(r.project, 'esp32'))
    assert.deepEqual(r.project.theme, p.theme)
    assert.equal(r.project.tabs[0].elements[0].group, 'Моторы')
  }
  assert.equal(parseProject(JSON.stringify({ version: UI_JSON_VERSION + 1 })).ok, false)
  assert.equal(parseProject(JSON.stringify({ version: 0 })).ok, false)
})

test('парсер: неизвестные поля стиля/темы вычищаются, callback без fn не падает', () => {
  const r = parseProject(
    JSON.stringify({
      version: 2,
      theme: { preset: 'dark', vars: { pageBg: '#000', evil: 'x', colors: { Dark: '#111', Bogus: '#222' } } },
      tabs: [{ id: 't', title: 'T', elements: [{ id: 'b', type: 'button', props: { panelStyle: { color: '#fff', hack: 'x', width: 5 } }, binding: { kind: 'callback' } }] }]
    })
  )
  assert.ok(r.ok)
  if (!r.ok) return
  assert.deepEqual(r.project.theme.vars, { pageBg: '#000', colors: { Dark: '#111' } })
  assert.deepEqual(r.project.tabs[0].elements[0].props.panelStyle, { color: '#fff' })
  assert.deepEqual(r.project.tabs[0].elements[0].binding, { kind: 'callback', fn: '' })
})

// ---------- каталог и API ----------
test('каталог: все espuiType и события существуют в подтверждённых таблицах ESPUI', () => {
  for (const t of WIDGET_ORDER) {
    assert.ok(WIDGETS[t].espuiType in CONTROL_TYPE, WIDGETS[t].espuiType)
    for (const e of WIDGETS[t].events) assert.ok(e in EVENT, e)
  }
  assert.equal(CONTROL_TYPE.Tab, 11)
  assert.equal(CONTROL_TYPE.Password, 99)
  assert.equal(EVENT.B_DOWN, -1)
  assert.equal(EVENT.S_ACTIVE, -7)
  assert.equal(COLOR_NUMBER.None, 255)
})

test('createElement для новых виджетов: корректные id и генерация без #error', () => {
  const p = mini()
  p.tabs[0].elements.push(
    ...WIDGET_ORDER.map((t) => {
      const w = WIDGETS[t]
      return { id: `${w.idPrefix}9`, type: t, label: w.defaultLabel, props: structuredClone(w.defaultProps), binding: { kind: 'none' as const } }
    })
  )
  assert.deepEqual(errors(validate(p)), [])
  assert.doesNotMatch(generate(p, 'esp32'), /#error/)
})

// ---------- JSON страницы ----------
test('buildEspuiPage: структура сообщения InitialGui', () => {
  const page = buildEspuiPage(richProject('esp32'))
  const m = page.message
  assert.equal(m.type, 200)
  assert.deepEqual(m.controls[0], { type: 0, label: 'Rich' })
  const c = m.controls as Array<Record<string, unknown>>
  // вкладки идут первыми: id 1 и 2
  assert.equal(c[1].type, CONTROL_TYPE.Tab)
  assert.equal(c[1].id, 1)
  assert.equal(c[2].id, 2)
  const pwd = c.find((x) => x.id === page.ids.pwdKey)!
  assert.equal(pwd.type, CONTROL_TYPE.Text) // Password уходит как Text
  assert.equal(pwd.value, '--------')
  const sld = c.find((x) => x.id === page.ids.sldLevel)!
  assert.equal(sld.parentControl, '1') // строка
  assert.equal(sld.wide, true)
  assert.equal(sld.panelStyle, 'background:#102030;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,.4);')
  assert.equal(sld.panelClass, 'big card2')
  const pad = c.find((x) => x.id === page.ids.padCam)!
  assert.equal(pad.enabled, false)
  assert.equal(c.find((x) => x.id === page.ids.btnToggle)!.visible, false)
  const sel = c.filter((x) => x.type === CONTROL_TYPE.Option)
  assert.deepEqual(sel.map((x) => x.selected), ['', 'selected'])
  assert.ok(page.customCss.startsWith('html body{'))
  // уникальные возрастающие id
  const ids = c.slice(1).map((x) => x.id as number)
  assert.deepEqual(ids, ids.map((_, i) => i + 1))
})

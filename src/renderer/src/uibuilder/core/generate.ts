// Генератор C++ (ui_generated.h) под библиотеку ESPUI (s00500/ESPUI).
//
// Использованное API ESPUI (подтверждено по README, ESPUI.h/.cpp, ESPUIcontrol.h/.cpp и фронтенду, ветка master;
// полный реестр с пометками — data/espui/API_NOTES.md):
//   uint16_t ESPUI.addControl(ControlType, label, value, ControlColor, parentId[, callback])
//   Control::noParent, ControlType::{Tab,Label,Button,Switcher,Slider,Number,Text,Password,Select,Option,Pad,
//   PadWithCenter,Time,FileDisplay,Accel,Graph,Separator,Min,Max,Step}, ControlColor::{Turquoise…Dark,None}
//   callback: void(Control* sender, int type); значение — строка sender->value
//   ESPUI.updateLabel/updateSwitcher/updateSlider/updateNumber/updateText/updateSelect/updateTime,
//   ESPUI.updateControlValue(id, String), ESPUI.addGraphPoint(id, int), ESPUI.clearGraph(id),
//   ESPUI.setPanelWide/setVertical/setEnabled/updateVisibility/setPanelStyle/setElementStyle/setPanelClass/setInputType,
//   ESPUI.setCustomCSS(const char*), ESPUI.sliderContinuous, ESPUI.begin(title, user, pass)
//
// Закрыто по источникам: значение Switcher "1"/"0" (шорткат switcher() и JS), значения констант событий (ESPUI.h),
// Step у Slider (JS ставит step и для слайдера), DNS для captive portal — ESPUI его не запускает (опция dnsCaptive).
// Не проверено на плате: компиляция сгенерированного C++, порядок подключения custom.css, вызов setPanelStyle до begin().
import { cppString, floatLiteral, varInitLiteral } from './cpp'
import { compileStyle, classProblem } from './css'
import { themeCssRules } from './themes'
import { pinLiteral } from './pins'
import type { PinRole } from './pins'
import type {
  Binding,
  GenerateOptions,
  Issue,
  Platform,
  UiElement,
  UiProject,
  UiVariable
} from './types'
import { GENERATOR_VERSION } from './types'
import { WIDGETS, isWidgetType } from './widgets'
import { findVariable, hasErrors, pwmMax, validate } from './validate'

/** Какой кусок кода к какому элементу относится (для подсветки и «что попадёт в код»). */
export type RegionKind = 'decl' | 'callback' | 'pin' | 'control' | 'style' | 'update'
export interface CodeRegion {
  elementId: string
  kind: RegionKind
  /** Номера строк кода (с 0), включительно. */
  start: number
  end: number
}

const TAG_OPEN = '\u0001'
const TAG_CLOSE = '\u0002'
/** Помечает строки как относящиеся к элементу; метка вырезается в конце генерации. */
function tg(id: string, kind: RegionKind, lines: string[]): string[] {
  return lines.map((l) => (l ? `${TAG_OPEN}${id}|${kind}${TAG_CLOSE}${l}` : l))
}
const TAG_RE = /^(\s*)\u0001([^|]+)\|(\w+)\u0002/

function extractRegions(lines: string[]): { lines: string[]; regions: CodeRegion[] } {
  const regions: CodeRegion[] = []
  const out: string[] = []
  lines.forEach((l, i) => {
    const m = TAG_RE.exec(l)
    if (!m) {
      out.push(l)
      return
    }
    out.push(m[1] + l.slice(m[0].length))
    const kind = m[3] as RegionKind
    const last = regions[regions.length - 1]
    if (last && last.elementId === m[2] && last.kind === kind && last.end === i - 1) last.end = i
    else regions.push({ elementId: m[2], kind, start: i, end: i })
  })
  return { lines: out, regions }
}

export const GEN_BEGIN = '// <<GEN BEGIN>>'
export const GEN_END = '// <<GEN END>>'

type PinBinding = Extract<Binding, { kind: 'pin' }>

interface Plan {
  el: UiElement
  variable?: UiVariable
  toUi: boolean
  fromUi: boolean
  pin?: PinBinding
  /** Номер LEDC-канала (ESP32, ядро 2.x). */
  channel?: number
  /** Нужен callback. */
  callback: boolean
  /** Привязка «callback»: имя функции пользователя (вместо генерируемого cb_<id>). */
  userFn?: string
  /** Кэш последнего значения, отправленного в UI. */
  cache?: { decl: string; type: string; expr: string }
}

const NEG_INF_INT = '(-2147483647 - 1)'

function num(n: number): string {
  return String(n)
}

/** Пин в коде: имя из скетча (если задано pinName) или число. */
function pinExpr(platform: Platform, b: PinBinding, role: PinRole): string {
  return b.pinName ? b.pinName : pinLiteral(platform, b.pin, role)
}

function pinOn(invert: boolean | undefined, on: boolean): string {
  return on !== !!invert ? 'HIGH' : 'LOW'
}

function digitalRead(ctx: Ctx, b: PinBinding): string {
  return `(digitalRead(${pinExpr(ctx.platform, b, 'in-digital')}) == ${b.invert ? 'LOW' : 'HIGH'})`
}

interface Ctx {
  p: UiProject
  platform: Platform
  opts: Required<Pick<GenerateOptions, 'ledcApi'>> & GenerateOptions
}

function planElement(ctx: Ctx, el: UiElement, state: { channel: number }): Plan {
  const plan: Plan = { el, toUi: false, fromUi: false, callback: false }
  const b = el.binding
  if (b && b.kind === 'var') {
    const v = findVariable(ctx.p, b.variable)
    if (v) {
      plan.variable = v
      plan.toUi = b.direction === 'toUi' || b.direction === 'both'
      plan.fromUi = b.direction === 'fromUi' || b.direction === 'both'
    }
  } else if (b && b.kind === 'pin') {
    plan.pin = b
    if (b.direction === 'fromPin') plan.toUi = true
    else {
      plan.fromUi = true
      if (b.mode === 'analog' && ctx.platform === 'esp32') plan.channel = state.channel++
    }
  }
  if (b && b.kind === 'callback' && b.fn) plan.userFn = b.fn
  plan.callback = plan.fromUi || !!plan.userFn
  const cache = cacheFor(ctx, plan)
  if (cache) plan.cache = cache
  return plan
}

// ---------- Выражения ----------

/** Булево C++-выражение «логическое состояние» источника (для switcher). */
function boolSource(ctx: Ctx, plan: Plan): string {
  if (plan.pin) return digitalRead(ctx, plan.pin)
  return plan.variable ? plan.variable.name : 'false'
}

/** Целочисленное C++-выражение источника (slider/number/graph). */
function intSource(ctx: Ctx, plan: Plan): string {
  if (plan.pin) {
    if (plan.pin.mode === 'analog') return `analogRead(${pinExpr(ctx.platform, plan.pin, 'in-analog')})`
    return `(${digitalRead(ctx, plan.pin)} ? 1 : 0)`
  }
  const v = plan.variable
  if (!v) return '0'
  if (v.type === 'float') return `(int)lroundf(${v.name})`
  if (v.type === 'bool') return `(${v.name} ? 1 : 0)`
  return v.name
}

/** C++-выражение типа String для label/text/select/number(float). */
function stringSource(ctx: Ctx, plan: Plan): string {
  const el = plan.el
  const dec = el.props.decimals ?? (el.type === 'number' ? 1 : 2)
  let core: string
  if (plan.pin) {
    core =
      plan.pin.mode === 'analog'
        ? `String(analogRead(${pinExpr(ctx.platform, plan.pin, 'in-analog')}))`
        : `String(${digitalRead(ctx, plan.pin)} ? "ON" : "OFF")`
  } else if (plan.variable) {
    const v = plan.variable
    if (v.type === 'String') core = v.name
    else if (v.type === 'bool') core = `String(${v.name} ? "ON" : "OFF")`
    else if (v.type === 'float') core = `String(${v.name}, ${dec})`
    else core = `String(${v.name})`
  } else core = '""'
  if (el.type === 'label') {
    const pre = el.props.prefix ?? ''
    const suf = el.props.suffix ?? ''
    if (pre || suf) {
      let e = pre ? `String(${cppString(pre)}) + ${core}` : core
      if (suf) e = pre ? `${e} + ${cppString(suf)}` : `String(${core}) + ${cppString(suf)}`
      return e
    }
  }
  return core
}

function cacheFor(ctx: Ctx, plan: Plan): Plan['cache'] | undefined {
  if (!plan.toUi) return undefined
  const el = plan.el
  const id = `ui_prev_${el.id}`
  switch (el.type) {
    case 'label':
    case 'text':
    case 'select':
      return { decl: `String ${id};`, type: 'String', expr: stringSource(ctx, plan) }
    case 'switcher':
      return { decl: `int8_t ${id} = -1;`, type: 'int8_t', expr: `${boolSource(ctx, plan)} ? 1 : 0` }
    case 'slider':
      return { decl: `int ${id} = ${NEG_INF_INT};`, type: 'int', expr: intSource(ctx, plan) }
    case 'number':
      if (plan.variable?.type === 'float')
        return { decl: `String ${id};`, type: 'String', expr: stringSource(ctx, plan) }
      return { decl: `int ${id} = ${NEG_INF_INT};`, type: 'int', expr: intSource(ctx, plan) }
    default:
      return undefined // graph, button, separator — без кэша
  }
}

/** Начальное значение контрола (C++-выражение, приводимое к const String&). */
function initialValue(ctx: Ctx, plan: Plan): string {
  const el = plan.el
  const pr = el.props
  switch (el.type) {
    case 'label':
      if (plan.toUi) return stringSource(ctx, plan)
      return cppString((pr.prefix ?? '') + (pr.initial ?? '') + (pr.suffix ?? ''))
    case 'button':
      return cppString(pr.text ?? el.label)
    case 'switcher':
      // Значение Switcher "1"/"0": так делают шорткат switcher() и updateSwitcher, JS проверяет value=="1" (API_NOTES.md п.4).
      if (plan.variable) return `${boolSource(ctx, plan)} ? "1" : "0"`
      if (plan.pin) return plan.pin.direction === 'fromPin' ? `${boolSource(ctx, plan)} ? "1" : "0"` : `"${pr.on ? 1 : 0}"`
      return `"${pr.on ? 1 : 0}"`
    case 'slider':
    case 'number': {
      if (el.type === 'number' && plan.variable?.type === 'float') return stringSource(ctx, plan)
      if (plan.variable || (plan.pin && plan.pin.direction === 'fromPin')) return `String(${intSource(ctx, plan)})`
      return cppString(num(pr.min ?? 0))
    }
    case 'text':
      if (plan.variable) return plan.variable.name
      return cppString(pr.initial ?? '')
    case 'select': {
      if (plan.variable) return plan.variable.type === 'String' ? plan.variable.name : `String(${plan.variable.name})`
      const opts = pr.options ?? []
      const pick = pr.initial !== undefined && opts.some((o) => o.value === pr.initial) ? pr.initial : opts[0]?.value
      return cppString(pick ?? '')
    }
    case 'fileDisplay':
      return cppString(pr.file ?? '')
    default:
      return '""'
  }
}

// ---------- Callback'и ----------

function pwmWrite(ctx: Ctx, plan: Plan, valueExpr: string): string {
  const pin = pinExpr(ctx.platform, plan.pin!, 'out-pwm')
  const max = pwmMax(ctx.p, ctx.platform)
  const v = `constrain(${valueExpr}, 0, ${max})`
  if (ctx.platform === 'esp8266') return `analogWrite(${pin}, ${v});`
  if (ctx.opts.ledcApi === 'v2') return `ledcWrite(${plan.channel}, ${v});`
  return `ledcWrite(${pin}, ${v});`
}

function callbackBody(ctx: Ctx, plan: Plan): string[] {
  const el = plan.el
  const out: string[] = []
  const v = plan.variable
  const pin = plan.pin
  const inv = pin?.invert
  const dig = (cond: string): string =>
    `digitalWrite(${pinExpr(ctx.platform, pin!, 'out-digital')}, ${cond} ? ${pinOn(inv, true)} : ${pinOn(inv, false)});`
  switch (el.type) {
    case 'button':
      if (el.props.action === 'toggle') {
        if (v && v.type === 'bool') out.push(`if (type == B_DOWN) ${v.name} = !${v.name};`)
        else if (v) out.push(`if (type == B_DOWN) ${v.name} = ${v.name} ? 0 : 1;`)
        else if (pin) {
          out.push('static bool st = false;')
          out.push('if (type != B_DOWN) return;')
          out.push('st = !st;')
          out.push(dig('st'))
        }
      } else if (v) {
        if (v.type === 'int') out.push(`if (type == B_DOWN) ${v.name}++;`)
        else out.push(`${v.name} = (type == B_DOWN);`)
      } else if (pin) out.push(dig('(type == B_DOWN)'))
      break
    case 'pad':
    case 'padCenter':
      if (v) out.push(`${v.name} = type;`)
      break
    case 'password':
    case 'time':
      if (v) out.push(`${v.name} = sender->value;`)
      break
    case 'switcher':
      out.push('bool on = (type == S_ACTIVE);')
      if (v) out.push(v.type === 'bool' ? `${v.name} = on;` : `${v.name} = on ? 1 : 0;`)
      else if (pin) out.push(dig('on'))
      break
    case 'slider':
    case 'number':
      if (v) {
        if (v.type === 'float') out.push(`${v.name} = sender->value.toFloat();`)
        else out.push(`${v.name} = sender->value.toInt();`)
      } else if (pin) {
        out.push('int val = sender->value.toInt();')
        out.push(pwmWrite(ctx, plan, 'val'))
      }
      break
    case 'text':
      if (v) out.push(`${v.name} = sender->value;`)
      break
    case 'select':
      if (v) out.push(v.type === 'int' ? `${v.name} = sender->value.toInt();` : `${v.name} = sender->value;`)
      break
  }
  // Для «both»: запоминаем значение, чтобы периодическое обновление не отправляло эхо в UI.
  if (plan.toUi && plan.cache) out.push(`ui_prev_${el.id} = ${plan.cache.expr};`)
  const usesType = out.some((l) => /\btype\b/.test(l))
  const usesSender = out.some((l) => l.includes('sender'))
  const pre: string[] = []
  if (!usesType) pre.push('(void)type;')
  if (!usesSender) pre.push('(void)sender;')
  return [...pre, ...out]
}

// ---------- Обновление в ui_loop ----------

function graphMsOf(el: UiElement): number {
  const ms = el.props.graphMs
  return typeof ms === 'number' && Number.isInteger(ms) && ms >= 50 ? ms : 0
}

function graphPointLine(ctx: Ctx, plan: Plan): string {
  const el = plan.el
  const scale = el.props.scale ?? 1
  const src = plan.variable?.type === 'float' ? `${plan.variable.name}` : intSource(ctx, plan)
  const e = plan.variable?.type === 'float' || scale !== 1 ? `(int)lroundf((float)(${src}) * ${floatLiteral(scale)})` : `(int)(${src})`
  return `ESPUI.addGraphPoint(${el.id}, ${e});`
}

/** Блоки со своим таймером: график с graphMs и опрос времени браузера (Time). Выполняются до общего периода UIGEN_UPDATE_MS. */
function fastBlock(ctx: Ctx, plan: Plan): string[] | null {
  const el = plan.el
  if (el.type === 'graph' && plan.toUi) {
    const ms = graphMsOf(el)
    if (!ms) return null
    const t = `ui_t_${el.id}`
    return [`static uint32_t ${t} = 0;`, `if (millis() - ${t} >= ${ms}) {`, `  ${t} = millis();`, `  ${graphPointLine(ctx, plan)}`, '}']
  }
  if (el.type === 'time') {
    const sec = el.props.pollSec ?? 0
    if (!(Number.isInteger(sec) && sec > 0)) return null
    const t = `ui_t_${el.id}`
    return [
      `static uint32_t ${t} = 0;`,
      `if (millis() - ${t} >= ${sec * 1000}UL) {`,
      `  ${t} = millis();`,
      `  ESPUI.updateTime(${el.id});`,
      '}'
    ]
  }
  return null
}

function updateBlock(ctx: Ctx, plan: Plan): string[] | null {
  const el = plan.el
  if (!plan.toUi) return null
  const id = el.id
  if (el.type === 'graph') {
    if (graphMsOf(el)) return null // со своим периодом — см. fastBlock
    return [graphPointLine(ctx, plan)]
  }
  if (!plan.cache) return null
  const c = plan.cache
  let upd: string
  switch (el.type) {
    case 'label':
      upd = `ESPUI.updateLabel(${id}, cur);`
      break
    case 'text':
      upd = `ESPUI.updateText(${id}, cur);`
      break
    case 'select':
      upd = `ESPUI.updateSelect(${id}, cur);`
      break
    case 'switcher':
      upd = `ESPUI.updateSwitcher(${id}, cur == 1);`
      break
    case 'slider':
      upd = `ESPUI.updateSlider(${id}, cur);`
      break
    default:
      upd = c.type === 'String' ? `ESPUI.updateControlValue(${id}, cur);` : `ESPUI.updateNumber(${id}, cur);`
  }
  return [
    `${c.type} cur = ${c.expr};`,
    `if (cur != ui_prev_${id}) {`,
    `  ui_prev_${id} = cur;`,
    `  ${upd}`,
    '}'
  ]
}

// ---------- Основная функция ----------

function indent(lines: string[], n: number): string[] {
  const pad = ' '.repeat(n)
  return lines.map((l) => (l ? pad + l : l))
}

export function generate(project: UiProject, platform: Platform = project.platform, options: GenerateOptions = {}): string {
  return generateWithIssues(project, platform, options).code
}

export function generateWithIssues(
  project: UiProject,
  platform: Platform = project.platform,
  options: GenerateOptions = {}
): { code: string; issues: Issue[]; regions: CodeRegion[] } {
  const issues = validate(project, platform, options)
  const ctx: Ctx = { p: project, platform, opts: { ...options, ledcApi: options.ledcApi ?? 'v3' } }
  const L: string[] = []
  const w = project.wifi
  const s = project.settings
  const multiTab = project.tabs.length > 1
  const errCount = issues.filter((i) => i.severity === 'error').length

  // Планы элементов (в порядке следования)
  const state = { channel: 0 }
  const plans: Array<{ tabId: string; plan: Plan }> = []
  for (const t of project.tabs)
    for (const el of t.elements)
      if (isWidgetType(el.type)) plans.push({ tabId: t.id, plan: planElement(ctx, el, state) })

  const header = [
    `// ui_generated.h — создано конструктором ESPUI (AVR IDE), генератор v${GENERATOR_VERSION}`,
    `// Платформа: ${platform}${platform === 'esp32' ? `, LEDC API ${ctx.opts.ledcApi}` : ''}`,
    ...(options.timestamp ? [`// Сгенерировано: ${options.timestamp}`] : []),
    '// Не правьте код между маркерами GEN BEGIN / GEN END — он перезаписывается при каждой генерации.',
    '// Использование в скетче:  #include "ui_generated.h"  →  ui_setup() в setup(),  ui_loop() в loop().',
    '#pragma once',
    ''
  ]
  L.push(...header, GEN_BEGIN)
  if (errCount > 0) {
    L.push(
      `// ВНИМАНИЕ: в модели ${errCount} ошибок — код может быть неполным. Откройте конструктор и исправьте.`,
      `#error "ui_generated.h: модель конструктора содержит ошибки"`
    )
  }

  // includes
  L.push('', '#include <Arduino.h>')
  if (platform === 'esp8266') L.push('#include <ESP8266WiFi.h>', '#include <ESPAsyncTCP.h>')
  else L.push('#include <WiFi.h>', '#include <AsyncTCP.h>')
  L.push('#include <ESPAsyncWebServer.h>', '#include <ESPUI.h>')
  const dns = !!s.dnsCaptive
  if (dns) L.push('#include <DNSServer.h>')

  // настройки
  L.push('', '// ---- Настройки ----')
  L.push(`#define UIGEN_UPDATE_MS ${s.updateMs}`)
  L.push('#define UIGEN_WIFI_TIMEOUT_MS 20000')
  L.push(`static const char UIGEN_TITLE[] = ${cppString(s.title)};`)
  if (w.mode === 'sta') {
    L.push(`static const char UIGEN_WIFI_SSID[] = ${cppString(w.ssid)};`)
    L.push(`static const char UIGEN_WIFI_PASS[] = ${cppString(w.password)};`)
  }
  L.push(`static const char UIGEN_AP_SSID[] = ${cppString(w.apSsid)};`)
  L.push(`static const char UIGEN_AP_PASS[] = ${cppString(w.apPassword)};`)
  if (w.hostname) L.push(`static const char UIGEN_HOSTNAME[] = ${cppString(w.hostname)};`)
  const auth = !!s.authUser && !!s.authPass
  if (auth) {
    L.push(`static const char UIGEN_AUTH_USER[] = ${cppString(s.authUser)};`)
    L.push(`static const char UIGEN_AUTH_PASS[] = ${cppString(s.authPass)};`)
  }
  // Тема → custom.css (ESPUI.setCustomCSS; строка должна жить всё время работы, поэтому static const char[]).
  const cssRules = themeCssRules(project.theme)
  if (cssRules.length) {
    L.push('// Тема оформления (CSS для ESPUI.setCustomCSS; раздаётся только при ESPUI.begin(), не beginLITTLEFS()).')
    L.push('static const char UIGEN_CUSTOM_CSS[] =')
    cssRules.forEach((r, i) => L.push(`  ${cppString(r)}${i === cssRules.length - 1 ? ';' : ''}`))
  }
  if (dns) {
    L.push('static DNSServer ui_dns;', 'static bool ui_dns_on = false;')
  }

  // переменные
  const ownVars = project.variables.filter((v) => !v.external)
  const sketchVars = project.variables.filter((v) => v.external)
  L.push('', '// ---- Переменные ----')
  if (sketchVars.length) {
    L.push(
      `// Из вашего скетча (здесь НЕ объявляются, код использует их напрямую): ${sketchVars.map((v) => v.name).join(', ')}.`,
      '// Поэтому #include "ui_generated.h" должен стоять в скетче ПОСЛЕ объявления этих переменных.'
    )
  }
  if (ownVars.length === 0 && sketchVars.length === 0) L.push('// (нет)')
  for (const v of ownVars) L.push(`${v.type} ${v.name} = ${varInitLiteral(v)};`)

  // id контролов
  L.push('', '// ---- ID контролов ESPUI ----')
  if (multiTab) for (const t of project.tabs) L.push(`uint16_t ${t.id};`)
  for (const { plan } of plans) L.push(...tg(plan.el.id, 'decl', [`uint16_t ${plan.el.id};`]))
  if (!multiTab && plans.length === 0) L.push('// (нет элементов)')

  // кэш
  const caches = plans.filter((x) => x.plan.cache)
  if (caches.length) {
    L.push('', '// ---- Последние отправленные в UI значения (чтобы не слать повторно) ----')
    for (const { plan } of caches) L.push(...tg(plan.el.id, 'decl', [plan.cache!.decl]))
  }

  // callback'и
  const userFns = new Map<string, string[]>() // имя → описания элементов
  const userFnOwner = new Map<string, string>()
  for (const { plan } of plans)
    if (plan.userFn) {
      const list = userFns.get(plan.userFn) ?? []
      const evs = WIDGETS[plan.el.type].events
      list.push(`${plan.el.id} (${WIDGETS[plan.el.type].espuiType}${evs.length ? ': ' + evs.join(', ') : ''})`)
      userFns.set(plan.userFn, list)
      if (!userFnOwner.has(plan.userFn)) userFnOwner.set(plan.userFn, plan.el.id)
    }
  if (userFns.size) {
    L.push('', '// ---- Функции пользователя: определите их в своём скетче (тип события — второй аргумент) ----')
    for (const [fn, who] of userFns)
      L.push(...tg(userFnOwner.get(fn)!, 'decl', [`void ${fn}(Control* sender, int type);  // ${who.join('; ')}`]))
  }
  const cbs = plans.filter((x) => x.plan.callback && !x.plan.userFn)
  if (cbs.length) {
    L.push('', '// ---- Callback\'и: UI → устройство ----')
    for (const { plan } of cbs) {
      L.push(
        ...tg(plan.el.id, 'callback', [
          `void cb_${plan.el.id}(Control* sender, int type) {`,
          ...indent(callbackBody(ctx, plan), 2),
          '}'
        ])
      )
      L.push('')
    }
    L.pop()
  }

  // WiFi
  L.push('', '// ---- WiFi ----')
  L.push('inline void ui_wifi_ap() {', '  WiFi.mode(WIFI_AP);')
  L.push(
    w.apPassword ? '  WiFi.softAP(UIGEN_AP_SSID, UIGEN_AP_PASS);' : '  WiFi.softAP(UIGEN_AP_SSID);'
  )
  if (s.serialLog) L.push('  Serial.print("AP IP: ");', '  Serial.println(WiFi.softAPIP());')
  if (dns) L.push('  // Captive portal: ESPUI сама DNS не запускает — отвечаем на все имена адресом точки доступа.', '  ui_dns.start(53, "*", WiFi.softAPIP());', '  ui_dns_on = true;')
  L.push('}', '')
  L.push('inline void ui_wifi() {')
  if (w.mode === 'sta') {
    L.push('  WiFi.mode(WIFI_STA);')
    if (w.hostname)
      L.push(platform === 'esp8266' ? '  WiFi.hostname(UIGEN_HOSTNAME);' : '  WiFi.setHostname(UIGEN_HOSTNAME);')
    L.push(w.password ? '  WiFi.begin(UIGEN_WIFI_SSID, UIGEN_WIFI_PASS);' : '  WiFi.begin(UIGEN_WIFI_SSID);')
    L.push('  uint32_t t0 = millis();')
    L.push('  while (WiFi.status() != WL_CONNECTED && millis() - t0 < UIGEN_WIFI_TIMEOUT_MS) {', '    delay(250);', '  }')
    L.push('  if (WiFi.status() == WL_CONNECTED) {')
    if (s.serialLog) L.push('    Serial.print("IP: ");', '    Serial.println(WiFi.localIP());')
    L.push('    return;', '  }')
    L.push('  // Подключиться не удалось — поднимаем собственную точку доступа.')
    L.push('  ui_wifi_ap();')
  } else L.push('  ui_wifi_ap();')
  L.push('}')

  // ui_setup
  L.push('', '// ---- Инициализация ----', 'inline void ui_setup() {')
  const setup: string[] = []
  // пины
  const pinLines: string[] = []
  for (const { plan } of plans) {
    const b = plan.pin
    if (!b) continue
    const pinStart = pinLines.length
    if (b.direction === 'toPin') {
      const p = pinExpr(platform, b, b.mode === 'analog' ? 'out-pwm' : 'out-digital')
      if (b.mode === 'digital') {
        const initOn = plan.el.type === 'switcher' ? !!plan.el.props.on : false
        pinLines.push(`pinMode(${p}, OUTPUT);`, `digitalWrite(${p}, ${pinOn(b.invert, initOn)});`)
      } else if (platform === 'esp8266') {
        pinLines.push(`pinMode(${p}, OUTPUT);`, `analogWrite(${p}, 0);`)
      } else if (ctx.opts.ledcApi === 'v2') {
        pinLines.push(
          `ledcSetup(${plan.channel}, ${s.pwmFreq}, ${s.pwmBits});`,
          `ledcAttachPin(${p}, ${plan.channel});`,
          `ledcWrite(${plan.channel}, 0);`
        )
      } else {
        pinLines.push(`ledcAttach(${p}, ${s.pwmFreq}, ${s.pwmBits});`, `ledcWrite(${p}, 0);`)
      }
    } else if (b.mode === 'digital') {
      pinLines.push(`pinMode(${pinExpr(platform, b, 'in-digital')}, ${b.pull === 'up' ? 'INPUT_PULLUP' : 'INPUT'});`)
    }
    const mine = tg(plan.el.id, 'pin', pinLines.splice(pinStart))
    pinLines.push(...mine)
  }
  if (pinLines.length) setup.push('// Пины', ...pinLines, '')
  setup.push('// WiFi', 'ui_wifi();', '')
  setup.push('// Контролы ESPUI')
  if (s.sliderContinuous) setup.push('ESPUI.sliderContinuous = true;')

  const parentOf = (tabId: string): string => (multiTab ? tabId : 'Control::noParent')
  if (multiTab)
    for (const t of project.tabs)
      setup.push(`${t.id} = ESPUI.addControl(ControlType::Tab, ${cppString(t.title)}, ${cppString(t.title)});`)

  const after: string[] = []
  const clears: string[] = []
  for (const t of project.tabs) {
    if (!multiTab && t.elements.length === 0) continue
    let prevGroup = ''
    for (const el of t.elements) {
      const entry = plans.find((x) => x.plan.el === el)
      if (!entry) continue
      const plan = entry.plan
      const def = WIDGETS[el.type]
      const color = `ControlColor::${el.props.color ?? (el.type === 'separator' ? 'None' : 'Turquoise')}`
      const cb = plan.callback ? `, &${plan.userFn ?? `cb_${el.id}`}` : ''
      const S = (...lines: string[]): number => setup.push(...tg(el.id, 'control', lines))
      const A = (...lines: string[]): number => after.push(...tg(el.id, 'style', lines))
      const group = el.group?.trim() ?? ''
      if (group && group !== prevGroup)
        S(`ESPUI.addControl(ControlType::Separator, ${cppString(group)}, "", ControlColor::None, ${parentOf(t.id)});`)
      prevGroup = group
      S(
        `${el.id} = ESPUI.addControl(ControlType::${def.espuiType}, ${cppString(el.label)}, ${initialValue(ctx, plan)}, ${color}, ${parentOf(t.id)}${cb});`
      )
      if (el.type === 'slider' || el.type === 'number') {
        S(`ESPUI.addControl(ControlType::Min, "", ${cppString(num(el.props.min ?? 0))}, ControlColor::None, ${el.id});`)
        S(`ESPUI.addControl(ControlType::Max, "", ${cppString(num(el.props.max ?? 100))}, ControlColor::None, ${el.id});`)
        // Step поддерживают и Slider, и Number (JS ставит атрибут step на #sl{id} / #num{id}).
        if (el.props.step !== undefined)
          S(`ESPUI.addControl(ControlType::Step, "", ${cppString(num(el.props.step))}, ControlColor::None, ${el.id});`)
      }
      if (el.type === 'text' && el.props.maxLength !== undefined && el.props.maxLength > 0)
        S(`ESPUI.addControl(ControlType::Max, "", ${cppString(num(el.props.maxLength))}, ControlColor::None, ${el.id});`)
      if (el.type === 'select')
        for (const o of el.props.options ?? [])
          S(`ESPUI.addControl(ControlType::Option, ${cppString(o.label)}, ${cppString(o.value)}, ControlColor::None, ${el.id});`)
      if (el.props.wide) A(`ESPUI.setPanelWide(${el.id}, true);`)
      if (el.props.vertical && (el.type === 'slider' || el.type === 'switcher'))
        A(`ESPUI.setVertical(${el.id}, true);`)
      if (el.type === 'text' && el.props.inputType && el.props.inputType !== 'text')
        A(`ESPUI.setInputType(${el.id}, ${cppString(el.props.inputType)});`)
      const ps = compileStyle(el.props.panelStyle)
      if (ps) A(`ESPUI.setPanelStyle(${el.id}, ${cppString(ps)});`)
      const es = compileStyle(el.props.elementStyle)
      if (es) A(`ESPUI.setElementStyle(${el.id}, ${cppString(es)});`)
      const pc = el.props.panelClass?.trim() ?? ''
      if (pc && !classProblem(pc)) A(`ESPUI.setPanelClass(${el.id}, ${cppString(pc)});`)
      if (el.props.disabled) A(`ESPUI.setEnabled(${el.id}, false);`)
      if (el.props.hidden) A(`ESPUI.updateVisibility(${el.id}, false);`)
      if (el.type === 'graph' && el.props.clearOnStart) clears.push(...tg(el.id, 'control', [`ESPUI.clearGraph(${el.id});`]))
    }
  }
  if (cssRules.length) after.push('ESPUI.setCustomCSS(UIGEN_CUSTOM_CSS);')
  if (after.length) setup.push('', '// Оформление (до begin)', ...after)
  setup.push('', '// Запуск веб-интерфейса')
  setup.push(auth ? 'ESPUI.begin(UIGEN_TITLE, UIGEN_AUTH_USER, UIGEN_AUTH_PASS);' : 'ESPUI.begin(UIGEN_TITLE);')
  if (clears.length) setup.push(...clears)
  L.push(...indent(setup, 2), '}')

  // ui_loop
  L.push('', '// ---- Периодическое обновление: устройство → UI ----', 'inline void ui_loop() {')
  const blocks: string[][] = []
  const fast: string[][] = []
  const wrapBlock = (id: string, b: string[]): string[] => tg(id, 'update', ['{', ...indent(b, 2), '}'])
  for (const { plan } of plans) {
    const b = updateBlock(ctx, plan)
    if (b) blocks.push(wrapBlock(plan.el.id, b))
  }
  for (const { plan } of plans) {
    const b = fastBlock(ctx, plan)
    if (b) fast.push(wrapBlock(plan.el.id, b))
  }
  if (dns) L.push('  if (ui_dns_on) ui_dns.processNextRequest();')
  for (const b of fast) L.push(...indent(b, 2))
  if (blocks.length === 0) {
    if (!dns && fast.length === 0) L.push('  // Нет элементов с привязкой «устройство → UI».')
  } else {
    L.push('  static uint32_t ui_last = 0;', '  if (millis() - ui_last < UIGEN_UPDATE_MS) return;', '  ui_last = millis();')
    for (const b of blocks) L.push(...indent(b, 2))
  }
  L.push('}', GEN_END, '')
  const done = extractRegions(L)
  return { code: done.lines.join('\n'), issues, regions: done.regions }
}

/**
 * Вставляет сгенерированный блок в существующий файл: заменяет текст между маркерами,
 * остальное (ручной код вне маркеров) сохраняет. Если маркеров нет — возвращает generated.
 */
export function mergeGenerated(existing: string | null | undefined, generated: string): string {
  if (!existing) return generated
  const b = existing.indexOf(GEN_BEGIN)
  const e = existing.indexOf(GEN_END)
  const gb = generated.indexOf(GEN_BEGIN)
  const ge = generated.indexOf(GEN_END)
  if (b < 0 || e < b || gb < 0 || ge < gb) return generated
  return existing.slice(0, b) + generated.slice(gb, ge + GEN_END.length) + existing.slice(e + GEN_END.length)
}

export { hasErrors }

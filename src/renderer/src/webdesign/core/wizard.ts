// Мастер «Страница для устройства»: простые ответы школьника → проект веб-конструктора.
// Чистые функции без DOM: их проверяют тесты и сборка (scripts/compile-check.mts).
// Ответы хранятся в web_design.json (поле wizard), чтобы мастер можно было открыть снова и поменять любой шаг.
import { createBlock, createProject } from './factory'
import { checkPin, pinChoices } from './pins'
import type { PinRole } from './pins'
import type { Binding, Block, Platform, VarType, WdProject, WdVariable } from './types'

export type WizKind = 'switch' | 'button' | 'slider' | 'sensor' | 'indicator' | 'gauge' | 'chart'
export type WizLink =
  | { kind: 'pin'; pin: number }
  /** existing — переменная уже есть в скетче; иначе её объявит код страницы. */
  | { kind: 'var'; name: string; existing: boolean }

export interface WizItem {
  id: string
  kind: WizKind
  label: string
  link: WizLink
  /** Для ползунка, датчика, шкалы и графика. */
  min?: number
  max?: number
  unit?: string
}

export type WizAccent = 'indigo' | 'blue' | 'green' | 'orange' | 'pink'
export interface WizardSpec {
  version: 1
  title: string
  subtitle: string
  items: WizItem[]
  wifi: { mode: 'ap' | 'sta'; ssid: string; password: string; apSsid: string; apPassword: string }
  theme: 'auto' | 'light' | 'dark'
  accent: WizAccent
}

/** Что умеет каждый элемент — понятными словами для мастера. */
export const WIZ_KINDS: Record<WizKind, {
  title: string
  hint: string
  /** Что делает пин: «включает» (выход) или «читает» (вход). */
  pinRole: PinRole
  pinHint: string
  varType: VarType
  varHint: string
  defaultLabel: string
  range?: { min: number; max: number; unit: string }
}> = {
  switch: { title: 'Переключатель', hint: 'Включить и выключить: свет, реле, вентилятор', pinRole: 'out-digital', pinHint: 'Пин, к которому подключены светодиод или реле', varType: 'bool', varHint: 'true — включено, false — выключено', defaultLabel: 'Свет' },
  button: { title: 'Кнопка', hint: 'Пока нажата — на пине сигнал (звонок, мотор)', pinRole: 'out-digital', pinHint: 'Пин, на который подаётся сигнал при нажатии', varType: 'bool', varHint: 'true, пока кнопка нажата', defaultLabel: 'Сигнал' },
  slider: { title: 'Ползунок', hint: 'Выбрать число: яркость, скорость, угол', pinRole: 'out-pwm', pinHint: 'Пин с ШИМ — например, светодиод для яркости', varType: 'int', varHint: 'Число от минимума до максимума', defaultLabel: 'Яркость', range: { min: 0, max: 100, unit: '%' } },
  sensor: { title: 'Показания датчика', hint: 'Показать число: температура, влажность', pinRole: 'in-analog', pinHint: 'Аналоговый пин датчика (0–4095 на ESP32)', varType: 'float', varHint: 'Число, которое скетч записывает из датчика', defaultLabel: 'Температура', range: { min: 0, max: 50, unit: '°C' } },
  indicator: { title: 'Лампочка-индикатор', hint: 'Показать «да/нет»: дверь открыта, есть движение', pinRole: 'in-digital', pinHint: 'Цифровой пин датчика или кнопки', varType: 'bool', varHint: 'true — горит, false — нет', defaultLabel: 'Движение' },
  gauge: { title: 'Круговая шкала', hint: 'Число на красивой шкале: уровень воды, заряд', pinRole: 'in-analog', pinHint: 'Аналоговый пин датчика', varType: 'int', varHint: 'Число от минимума до максимума', defaultLabel: 'Уровень', range: { min: 0, max: 100, unit: '%' } },
  chart: { title: 'График', hint: 'Как меняется число со временем', pinRole: 'in-analog', pinHint: 'Аналоговый пин датчика', varType: 'float', varHint: 'Число, которое скетч обновляет', defaultLabel: 'Температура', range: { min: 0, max: 50, unit: '°C' } }
}

export const WIZ_ACCENTS: Record<WizAccent, { title: string; light: string; dark: string }> = {
  indigo: { title: 'Индиго', light: '#4f46e5', dark: '#8b93ff' },
  blue: { title: 'Синий', light: '#1d6fd8', dark: '#60a5fa' },
  green: { title: 'Зелёный', light: '#15803d', dark: '#4ade80' },
  orange: { title: 'Оранжевый', light: '#c2410c', dark: '#fb923c' },
  pink: { title: 'Розовый', light: '#be185d', dark: '#f472b6' }
}

/** Готовые наборы для первого шага: школьнику не нужно собирать страницу с нуля. */
export const WIZ_STARTERS: Array<{ id: string; title: string; hint: string; kinds: WizKind[]; labels?: string[]; title2: string }> = [
  { id: 'light', title: 'Свет и розетки', hint: 'Два переключателя', kinds: ['switch', 'switch'], labels: ['Свет', 'Розетка'], title2: 'Умный свет' },
  { id: 'servo', title: 'Мотор или сервопривод', hint: 'Ползунок угла и кнопка', kinds: ['slider', 'button'], labels: ['Угол', 'Старт'], title2: 'Управление мотором' },
  { id: 'meteo', title: 'Метеостанция', hint: 'Два датчика и график', kinds: ['sensor', 'sensor', 'chart'], labels: ['Температура', 'Влажность', 'Температура за минуту'], title2: 'Моя метеостанция' },
  { id: 'alarm', title: 'Сигнализация', hint: 'Индикатор и кнопка', kinds: ['indicator', 'button'], labels: ['Движение', 'Сирена'], title2: 'Охрана' },
  { id: 'empty', title: 'Свой вариант', hint: 'Добавлю элементы сам', kinds: [], title2: 'Моё устройство' }
]

const ident = (s: string): string => {
  const map: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' }
  const lat = s.toLowerCase().split('').map((c) => map[c] ?? c).join('')
  const parts = lat.replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
  let id = parts.map((p, i) => (i ? p[0].toUpperCase() + p.slice(1) : p)).join('')
  if (!id || /^[0-9]/.test(id)) id = 'value' + id
  return id.slice(0, 28)
}

/** Свободное имя переменной для элемента (латиница, верблюжий регистр). */
export function suggestVarName(label: string, taken: Set<string>): string {
  const base = ident(label)
  let n = base
  for (let i = 2; taken.has(n); i++) n = base + i
  return n
}

/** Первый подходящий свободный пин для роли. */
export function suggestPin(platform: Platform, role: PinRole, used: Set<number>): number {
  const all = pinChoices(platform, role)
  // сначала пины без замечаний (не загрузочные, не TX/RX, не flash)
  const safe = all.filter((c) => pinIsSafe(platform, c.pin, role))
  return (safe.find((c) => !used.has(c.pin)) ?? all.find((c) => !used.has(c.pin)) ?? all[0])?.pin ?? 0
}

/** Пины, которые мастер не предлагает сам: загрузочные (strapping), TX/RX порта USB, встроенная flash. */
const AVOID: Record<Platform, number[]> = {
  esp32: [0, 1, 2, 3, 5, 12, 15],
  esp8266: [0, 1, 2, 3, 15],
  'pico-w': [0, 1]
}

/** Пин без замечаний для роли и не из «неудобных» (для подсказки в списке). */
export const pinIsSafe = (platform: Platform, pin: number, role: PinRole): boolean =>
  checkPin(platform, pin, role).length === 0 && !AVOID[platform].includes(pin)

export function newWizItem(platform: Platform, kind: WizKind, items: WizItem[], label?: string): WizItem {
  const k = WIZ_KINDS[kind]
  const used = new Set(items.flatMap((i) => (i.link.kind === 'pin' ? [i.link.pin] : [])))
  const ids = new Set(items.map((i) => i.id))
  let id = kind + '1'
  for (let i = 2; ids.has(id); i++) id = kind + i
  const name = label ?? k.defaultLabel
  // Показания (температура, влажность) обычно читает скетч из датчика — по умолчанию новая переменная.
  // Управление (свет, реле, мотор) — сразу пин. Свободного пина нет (на ESP8266 один аналоговый) — тоже переменная.
  const free = pinChoices(platform, k.pinRole).some((c) => !used.has(c.pin) && pinIsSafe(platform, c.pin, k.pinRole))
  const varsTaken = new Set(items.flatMap((i) => (i.link.kind === 'var' ? [i.link.name] : [])))
  const link: WizLink = k.pinRole === 'in-analog' || !free
    ? { kind: 'var', name: suggestVarName(name, varsTaken), existing: false }
    : { kind: 'pin', pin: suggestPin(platform, k.pinRole, used) }
  const it: WizItem = { id, kind, label: name, link }
  if (k.range) Object.assign(it, k.range)
  return it
}

export function defaultWizardSpec(platform: Platform): WizardSpec {
  const board = platform === 'pico-w' ? 'Pico' : platform === 'esp8266' ? 'ESP8266' : 'ESP32'
  return {
    version: 1,
    title: 'Моё устройство',
    subtitle: '',
    items: [],
    wifi: { mode: 'ap', ssid: '', password: '', apSsid: `${board}-Web`, apPassword: '12345678' },
    theme: 'auto',
    accent: 'indigo'
  }
}

/** Сетевое имя для адреса http://<имя>.local — из названия страницы. */
const hostName = (title: string): string => (ident(title).replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()).replace(/^-/, '') || 'esp-web').slice(0, 24)

function bindingFor(it: WizItem): Binding {
  const k = WIZ_KINDS[it.kind]
  if (it.link.kind === 'var') {
    const dir = it.kind === 'button' ? 'fromUi' : k.pinRole.startsWith('out') ? 'both' : 'toUi'
    return { kind: 'var', variable: it.link.name, direction: dir }
  }
  const out = k.pinRole.startsWith('out')
  return { kind: 'pin', pin: it.link.pin, direction: out ? 'toPin' : 'fromPin', mode: k.pinRole === 'out-pwm' || k.pinRole === 'in-analog' ? 'analog' : 'digital' }
}

function blockFor(it: WizItem, idx: number): Block {
  const id = `w${idx + 1}`
  const range = it.min !== undefined && it.max !== undefined ? { min: it.min, max: it.max } : {}
  const unit = it.unit ?? ''
  let b: Block
  switch (it.kind) {
    case 'switch': b = createBlock('switch', id); b.props = { ...b.props, label: it.label }; break
    case 'button': b = createBlock('button', id); b.props = { ...b.props, text: it.label, action: 'momentary' }; break
    case 'slider': b = createBlock('slider', id); b.props = { ...b.props, label: it.label, ...range, step: 1, unit }; break
    case 'sensor': b = createBlock('sensor', id); b.props = { ...b.props, label: it.label, ...range, unit, decimals: 1 }; break
    case 'indicator': b = createBlock('indicator', id); b.props = { ...b.props, label: it.label, onText: 'Да', offText: 'Нет' }; break
    case 'gauge': b = createBlock('gauge', id); b.props = { ...b.props, label: it.label, ...range, unit }; break
    case 'chart': b = createBlock('chart', id); b.props = { ...b.props, label: it.label, ...range, unit }; break
  }
  b.binding = bindingFor(it)
  const card = createBlock('card', `${id}_card`)
  card.props = { ...card.props, label: '' }
  card.children = [b]
  return card
}

/** Собрать проект страницы по ответам мастера. Ответы сохраняются в project.wizard. */
export function buildFromWizard(spec: WizardSpec, platform: Platform): WdProject {
  const p = createProject(platform)
  p.wizard = JSON.parse(JSON.stringify(spec)) as WizardSpec
  p.page.title = spec.title.trim() || 'Моё устройство'
  const t = p.page.theme
  t.mode = spec.theme
  t.light.primary = WIZ_ACCENTS[spec.accent].light
  t.dark.primary = WIZ_ACCENTS[spec.accent].dark
  p.wifi = { ...p.wifi, ...spec.wifi, hostname: hostName(p.page.title) }

  const vars: WdVariable[] = []
  const seen = new Set<string>()
  for (const it of spec.items) {
    if (it.link.kind !== 'var' || seen.has(it.link.name)) continue
    seen.add(it.link.name)
    const k = WIZ_KINDS[it.kind]
    vars.push(it.link.existing
      ? { name: it.link.name, type: k.varType, init: '', external: true }
      : { name: it.link.name, type: k.varType, init: k.varType === 'bool' ? 'false' : k.varType === 'float' ? '0.0' : String(it.min ?? 0) })
  }
  p.variables = vars

  const head = createBlock('section', 'head')
  head.style = { ...head.style, bg: 'surface', color: 'text', align: 'left', padding: 28, gap: 4, borderWidth: 1, borderColor: 'border', radius: 12 }
  const h = createBlock('heading', 'head_h')
  h.props = { ...h.props, text: p.page.title, level: 1 }
  head.children = [h]
  if (spec.subtitle.trim()) {
    const sub = createBlock('text', 'head_t')
    sub.props = { ...sub.props, text: spec.subtitle.trim() }
    sub.style = { ...sub.style, color: 'muted' }
    head.children.push(sub)
  }
  const main = createBlock('section', 'main')
  const grid = createBlock('grid', 'main_grid')
  grid.props = { ...grid.props, columns: spec.items.length >= 3 ? 3 : Math.max(1, spec.items.length) }
  grid.responsive = { tablet: { columns: 2 }, mobile: { columns: 1 } }
  grid.children = spec.items.map(blockFor)
  main.children = [grid]
  p.blocks = [head, main]
  return p
}

const KINDS = Object.keys(WIZ_KINDS) as WizKind[]
const ACCENTS = Object.keys(WIZ_ACCENTS) as WizAccent[]
const s = (v: unknown, d = '', max = 120): string => (typeof v === 'string' ? v.slice(0, max) : d)
const n = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

/** Проверить ответы мастера из файла (они могли быть изменены вручную). null — поле битое. */
export function parseWizardSpec(raw: unknown, platform: Platform): WizardSpec | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const d = defaultWizardSpec(platform)
  const w = (r.wifi && typeof r.wifi === 'object' ? r.wifi : {}) as Record<string, unknown>
  const items: WizItem[] = []
  for (const x of Array.isArray(r.items) ? r.items.slice(0, 24) : []) {
    if (!x || typeof x !== 'object') continue
    const it = x as Record<string, unknown>
    const kind = KINDS.find((k) => k === it.kind)
    const l = (it.link && typeof it.link === 'object' ? it.link : {}) as Record<string, unknown>
    if (!kind) continue
    const link: WizLink | null = l.kind === 'pin' && n(l.pin) !== undefined ? { kind: 'pin', pin: n(l.pin)! }
      : l.kind === 'var' && typeof l.name === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(l.name) ? { kind: 'var', name: l.name, existing: l.existing === true }
      : null
    if (!link) continue
    items.push({ id: s(it.id, kind, 40) || kind, kind, label: s(it.label, WIZ_KINDS[kind].defaultLabel, 60), link, min: n(it.min), max: n(it.max), unit: typeof it.unit === 'string' ? it.unit.slice(0, 12) : undefined })
  }
  return {
    version: 1,
    title: s(r.title, d.title, 80),
    subtitle: s(r.subtitle, '', 160),
    items,
    wifi: {
      mode: w.mode === 'sta' ? 'sta' : 'ap',
      ssid: s(w.ssid, '', 32), password: s(w.password, '', 63),
      apSsid: s(w.apSsid, d.wifi.apSsid, 32), apPassword: s(w.apPassword, d.wifi.apPassword, 63)
    },
    theme: r.theme === 'light' || r.theme === 'dark' ? r.theme : 'auto',
    accent: ACCENTS.find((a) => a === r.accent) ?? 'indigo'
  }
}

/** Что не так с ответами (показывается на шаге и блокирует «Готово»). */
export function wizardProblems(spec: WizardSpec): Array<{ step: 'items' | 'links' | 'wifi'; text: string }> {
  const out: Array<{ step: 'items' | 'links' | 'wifi'; text: string }> = []
  if (!spec.items.length) out.push({ step: 'items', text: 'Добавьте хотя бы один элемент.' })
  const pins = new Map<number, string>()
  for (const it of spec.items) {
    if (!it.label.trim()) out.push({ step: 'items', text: 'У каждого элемента должно быть название.' })
    if (it.link.kind === 'pin') {
      const prev = pins.get(it.link.pin)
      if (prev) out.push({ step: 'links', text: `«${prev}» и «${it.label}» подключены к одному пину ${it.link.pin}.` })
      pins.set(it.link.pin, it.label)
    } else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(it.link.name)) {
      out.push({ step: 'links', text: `Имя переменной для «${it.label}»: только латинские буквы, цифры и _, не с цифры.` })
    }
    if (it.min !== undefined && it.max !== undefined && it.min >= it.max) out.push({ step: 'items', text: `«${it.label}»: минимум должен быть меньше максимума.` })
  }
  if (spec.wifi.mode === 'ap') {
    if (!spec.wifi.apSsid.trim()) out.push({ step: 'wifi', text: 'Придумайте имя сети.' })
    if (spec.wifi.apPassword && spec.wifi.apPassword.length < 8) out.push({ step: 'wifi', text: 'Пароль сети — минимум 8 символов (или оставьте пустым).' })
  } else if (!spec.wifi.ssid.trim()) out.push({ step: 'wifi', text: 'Введите имя домашней сети Wi‑Fi.' })
  return out
}

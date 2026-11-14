// Сериализация проекта в ui.json (с полем version), безопасное чтение и миграция версий.
import { createDefaultProject } from './factory'
import { migrateRaw } from './migrate'
import type { Binding, StyleSpec, ThemeVars, UiElement, UiProject, UiTab, UiTheme, UiVariable } from './types'
import { ESPUI_COLORS, UI_JSON_VERSION } from './types'
import { STYLE_FIELDS } from './css'
import { THEME_VAR_FIELDS } from './themes'
import { WIDGETS, isWidgetType } from './widgets'

export function serializeProject(p: UiProject): string {
  return JSON.stringify({ ...p, version: UI_JSON_VERSION }, null, 2) + '\n'
}

export type ParseResult =
  | { ok: true; project: UiProject; /** версия файла до миграции, если она выполнялась */ migratedFrom?: number; notes: string[] }
  | { ok: false; error: string }

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}
const str = (x: unknown, d: string): string => (typeof x === 'string' ? x : d)
const numOr = (x: unknown, d: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : d)
const boolOr = (x: unknown, d: boolean): boolean => (typeof x === 'boolean' ? x : d)

/** Оставляет у стиля только известные ключи со строковыми значениями (значения проверит validate). */
function cleanStyle(x: unknown): StyleSpec | undefined {
  if (!isObj(x)) return undefined
  const out: Record<string, string> = {}
  for (const f of STYLE_FIELDS) {
    const v = x[f.key]
    if (typeof v === 'string') out[f.key] = v
  }
  return Object.keys(out).length ? (out as StyleSpec) : undefined
}

function cleanTheme(x: unknown): UiTheme {
  if (!isObj(x)) return { preset: 'default', vars: {} }
  const vars: ThemeVars = {}
  const src = isObj(x.vars) ? x.vars : {}
  for (const f of THEME_VAR_FIELDS) {
    const v = src[f.key]
    if (typeof v === 'string') vars[f.key] = v
  }
  if (isObj(src.colors)) {
    const colors: NonNullable<ThemeVars['colors']> = {}
    for (const c of ESPUI_COLORS) {
      if (c === 'None') continue
      const v = (src.colors as Record<string, unknown>)[c]
      if (typeof v === 'string') colors[c] = v
    }
    if (Object.keys(colors).length) vars.colors = colors
  }
  return { preset: str(x.preset, 'default'), vars }
}

function cleanBinding(b: unknown): Binding {
  if (!isObj(b) || typeof b.kind !== 'string') return { kind: 'none' }
  if (b.kind === 'callback') return { kind: 'callback', fn: str(b.fn, '') }
  return b as unknown as Binding
}

/**
 * Читает ui.json. Старые версии мигрируются (см. migrate.ts), отсутствующие поля заполняются значениями
 * по умолчанию, более новая версия формата отклоняется (чтобы не потерять данные при записи).
 * Смысловые ошибки (дубли, плохие имена) находит validate(), а не парсер.
 */
export function parseProject(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { ok: false, error: `ui.json не является корректным JSON: ${(e as Error).message}` }
  }
  if (!isObj(raw)) return { ok: false, error: 'ui.json: ожидался объект' }
  const version = raw.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    return { ok: false, error: 'ui.json: отсутствует или некорректно поле version' }
  if (version > UI_JSON_VERSION)
    return { ok: false, error: `ui.json версии ${version} создан более новой версией IDE (поддерживается ${UI_JSON_VERSION})` }

  let notes: string[] = []
  let migratedFrom: number | undefined
  if (version < UI_JSON_VERSION) {
    const m = migrateRaw(raw, version)
    if (!m) return { ok: false, error: `ui.json версии ${version}: нет пути миграции до версии ${UI_JSON_VERSION}` }
    notes = m.notes
    migratedFrom = version
  }

  const d = createDefaultProject()
  const platform = raw.platform === 'esp8266' || raw.platform === 'esp32' ? raw.platform : d.platform
  const wifi = isObj(raw.wifi) ? raw.wifi : {}
  const set = isObj(raw.settings) ? raw.settings : {}

  const variables: UiVariable[] = []
  if (Array.isArray(raw.variables))
    for (const v of raw.variables) {
      if (!isObj(v)) continue
      const type = v.type
      variables.push({
        name: str(v.name, ''),
        type: type === 'bool' || type === 'int' || type === 'float' || type === 'String' ? type : 'int',
        init: typeof v.init === 'string' ? v.init : v.init === undefined ? '' : String(v.init)
      })
    }

  const tabs: UiTab[] = []
  if (Array.isArray(raw.tabs))
    for (const t of raw.tabs) {
      if (!isObj(t)) continue
      const elements: UiElement[] = []
      if (Array.isArray(t.elements))
        for (const e of t.elements) {
          if (!isObj(e) || !isWidgetType(e.type)) continue
          const def = WIDGETS[e.type]
          const props = { ...structuredClone(def.defaultProps), ...(isObj(e.props) ? e.props : {}) }
          const ps = cleanStyle(props.panelStyle)
          const es = cleanStyle(props.elementStyle)
          delete props.panelStyle
          delete props.elementStyle
          if (ps) props.panelStyle = ps
          if (es) props.elementStyle = es
          const el: UiElement = {
            id: str(e.id, ''),
            type: e.type,
            label: str(e.label, def.defaultLabel),
            props,
            binding: cleanBinding(e.binding)
          }
          if (typeof e.group === 'string' && e.group !== '') el.group = e.group
          elements.push(el)
        }
      tabs.push({ id: str(t.id, `tab${tabs.length + 1}`), title: str(t.title, ''), elements })
    }

  const project: UiProject = {
    version: UI_JSON_VERSION,
    platform,
    wifi: {
      mode: wifi.mode === 'ap' ? 'ap' : 'sta',
      ssid: str(wifi.ssid, d.wifi.ssid),
      password: str(wifi.password, d.wifi.password),
      apSsid: str(wifi.apSsid, d.wifi.apSsid),
      apPassword: str(wifi.apPassword, d.wifi.apPassword),
      hostname: str(wifi.hostname, d.wifi.hostname)
    },
    settings: {
      title: str(set.title, d.settings.title),
      authUser: str(set.authUser, ''),
      authPass: str(set.authPass, ''),
      updateMs: numOr(set.updateMs, d.settings.updateMs),
      sliderContinuous: boolOr(set.sliderContinuous, false),
      serialLog: boolOr(set.serialLog, true),
      pwmFreq: numOr(set.pwmFreq, d.settings.pwmFreq),
      pwmBits: numOr(set.pwmBits, d.settings.pwmBits),
      dnsCaptive: boolOr(set.dnsCaptive, false)
    },
    theme: cleanTheme(raw.theme),
    variables,
    tabs: tabs.length ? tabs : d.tabs
  }
  return migratedFrom !== undefined ? { ok: true, project, migratedFrom, notes } : { ok: true, project, notes }
}

/** Экспорт ui.json (то же, что serializeProject; отдельное имя — точка входа для UI «Экспорт»). */
export function exportProject(p: UiProject): string {
  return serializeProject(p)
}

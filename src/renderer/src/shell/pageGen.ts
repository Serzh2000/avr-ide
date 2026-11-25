// Генерация заголовка страницы (ui_generated.h / web_generated.h) из сохранённого файла страницы и текущего скетча.
// Чистые функции без React и без обращения к диску: их использует и «Вставить в скетч», и автообновление перед сборкой,
// и строка состояния «код актуален / устарел», и тесты.
import { generateWithIssues, parseProject as parseUi, serializeProject as serializeUi } from '../uibuilder/core/index'
import { resolveProject } from '../uibuilder/sketch/resolve'
import { parseSketch } from '../uibuilder/sketch/parse'
import type { SketchInfo } from '../uibuilder/sketch/parse'
import type { UiProject } from '../uibuilder/core/index'
import type { PageKind } from '../uibuilder/sketch/integrate'
import { generateCpp, generateSite, parseProject as parseWeb, resolveWdProject, validate as validateWeb } from '../webdesign/core/index'

export type BoardPlatform = 'esp32' | 'esp8266' | 'pico-w' | 'avr' | 'stm32' | 'rp2040' | 'generic' | null

export interface PageProblem {
  severity: 'error' | 'warning'
  message: string
  /** Элемент (ESPUI) или блок (веб-дизайнер), к которому относится проблема. */
  targetId?: string
}

export type PageGen =
  | {
      ok: true
      kind: PageKind
      /** Полный текст заголовка (при ошибках модели в нём стоит #error). */
      header: string
      errors: PageProblem[]
      warnings: PageProblem[]
      /** Сколько элементов/блоков на странице. */
      items: number
    }
  | { ok: false; kind: PageKind; error: string }

const espPlatform = (b: BoardPlatform | undefined): 'esp32' | 'esp8266' | null => (b === 'esp32' || b === 'esp8266' ? b : null)

/** Какой API LEDC использовался в уже записанном заголовке ESPUI (в ui.json он не хранится). */
export function ledcApiFromHeader(header: string | null): 'v2' | 'v3' {
  const m = header ? /LEDC API (v2|v3)/.exec(header) : null
  return m && m[1] === 'v2' ? 'v2' : 'v3'
}

/** Текст ui.json для сохранения в папку проекта: ядро ESP32 3.x (по умолчанию) не пишется, 2.x запоминается полем ledcApi. */
export function serializeUiPage(project: UiProject, ledcApi: 'v2' | 'v3'): string {
  const text = serializeUi(project)
  if (ledcApi !== 'v2') return text
  return JSON.stringify({ ...(JSON.parse(text) as object), ledcApi }, null, 2) + '\n'
}

/** Ядро LEDC, записанное в ui.json (см. serializeUiPage). */
export function ledcApiFromJson(json: string): 'v2' | 'v3' | null {
  try {
    const v = (JSON.parse(json) as { ledcApi?: unknown }).ledcApi
    return v === 'v2' ? 'v2' : v === 'v3' ? 'v3' : null
  } catch {
    return null
  }
}

export const WEB_ERROR_GUARD = '#error "web_generated.h: в модели страницы есть ошибки — откройте «Веб-дизайнер» и исправьте их (вкладка «Проблемы»)"'

/** В заголовке веб-дизайнера при ошибках модели ставится #error — сборка остановится с понятным сообщением, а не с кашей из C++. */
export function guardWebHeader(header: string, errorCount: number): string {
  return errorCount > 0 ? header.replace('#pragma once', `#pragma once\n${WEB_ERROR_GUARD}`) : header
}

/** Состояние связи страницы со скетчем: не подключена / подключена и код актуален / подключена, но код устарел. */
export type PageLinkState = 'off' | 'ok' | 'stale'
export function pageLinkState(connected: boolean, diskHeader: string | null, liveHeader: string | null): PageLinkState {
  if (!connected) return 'off'
  return liveHeader !== null && diskHeader === liveHeader ? 'ok' : 'stale'
}

/** Сколько элементов на странице из текста ui.json / web_design.json (0 — пусто или файл не разобрался). */
export function countPageItems(kind: PageKind, json: string): number {
  if (kind === 'ui') {
    const r = parseUi(json)
    return r.ok ? r.project.tabs.reduce((n, t) => n + t.elements.length, 0) : 0
  }
  const r = parseWeb(json)
  if (!r.ok) return 0
  let n = 0
  const go = (bs: typeof r.project.blocks): void => {
    for (const b of bs) {
      n++
      go(b.children)
    }
  }
  go(r.project.blocks)
  return n
}

export interface GenInput {
  /** Текст ui.json / web_design.json. */
  json: string
  /** Текст главного файла скетча (для переменных из скетча); null — скетч неизвестен. */
  sketchCode: string | null
  /** Платформа выбранной платы, если она поддерживает интеграцию. */
  board?: BoardPlatform
  /** Уже записанный заголовок (из него берётся ядро LEDC для ESPUI). */
  existingHeader?: string | null
  /** Готовый разбор скетча (чтобы не разбирать дважды). */
  sketch?: SketchInfo | null
}

export function genPage(kind: PageKind, inp: GenInput): PageGen {
  const sketch = inp.sketch !== undefined ? inp.sketch : inp.sketchCode === null ? null : parseSketch(inp.sketchCode)
  const plat = espPlatform(inp.board)
  if (kind === 'ui') {
    const r = parseUi(inp.json)
    if (!r.ok) return { ok: false, kind, error: r.error }
    const proj = r.project
    if (plat) proj.platform = plat
    const res = resolveProject(proj, sketch)
    const ledcApi = ledcApiFromJson(inp.json) ?? ledcApiFromHeader(inp.existingHeader ?? null)
    const out = generateWithIssues(res.project, res.project.platform, { ledcApi })
    const all = [...out.issues, ...res.issues]
    const conv = (i: (typeof all)[number]): PageProblem => ({ severity: i.severity, message: i.message, targetId: i.elementId })
    return {
      ok: true,
      kind,
      header: out.code,
      errors: all.filter((i) => i.severity === 'error').map(conv),
      warnings: all.filter((i) => i.severity !== 'error').map(conv),
      items: res.project.tabs.reduce((n, t) => n + t.elements.length, 0)
    }
  }
  const r = parseWeb(inp.json)
  if (!r.ok) return { ok: false, kind, error: r.error }
  const proj = r.project
  if (inp.board === 'pico-w') proj.platform = 'pico-w'
  else if (plat) proj.platform = plat
  const res = resolveWdProject(proj, sketch)
  const site = generateSite(res.project)
  const issues = [...validateWeb(res.project, site), ...res.issues]
  const conv = (i: (typeof issues)[number]): PageProblem => ({ severity: i.severity, message: i.message, targetId: i.blockId })
  const errors = issues.filter((i) => i.severity === 'error').map(conv)
  let header = generateCpp(res.project, site).header
  header = guardWebHeader(header, errors.length)
  let items = 0
  const count = (bs: typeof res.project.blocks): void => {
    for (const b of bs) {
      items++
      count(b.children)
    }
  }
  count(res.project.blocks)
  return { ok: true, kind, header, errors, warnings: issues.filter((i) => i.severity !== 'error').map(conv), items }
}

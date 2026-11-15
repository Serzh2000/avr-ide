// Сборка srcdoc для живого превью: оригинальный фронт ESPUI (data/espui/frontend, MIT) + мок WebSocket.
// Файлы фронта подключаются через Vite `?raw` (путь вне src/ — Vite разрешает: fs.allow по умолчанию — корень workspace,
// т.е. корень репозитория, где лежит package.json) и инлайнятся: внешних ссылок в документе нет.
import normalizeCss from '../../../../../data/espui/frontend/css/normalize.css?raw'
import styleCss from '../../../../../data/espui/frontend/css/style.css?raw'
import zeptoJs from '../../../../../data/espui/frontend/js/zepto.min.js?raw'
import sliderJs from '../../../../../data/espui/frontend/js/slider.js?raw'
import graphJs from '../../../../../data/espui/frontend/js/graph.js?raw'
import controlsJs from '../../../../../data/espui/frontend/js/controls.js?raw'
import tabbedJs from '../../../../../data/espui/frontend/js/tabbedcontent.js?raw'
import mockJs from './ws-mock.js?raw'
import agentJs from './editor-agent.js?raw'
import { buildEspuiPage, findVariable } from '../core/index'
import type { UiProject } from '../core/index'

/** Описание элемента для симуляции устройства (читает ws-mock.js). */
export interface SimItem {
  id: number
  type: number
  label: string
  kind: 'var' | 'pin' | 'callback' | 'none'
  variable?: string
  dir?: string
  vtype?: string
  init?: string
  decimals?: number
  prefix?: string
  suffix?: string
  min?: number
  max?: number
  analog?: boolean
  action?: string
  /** Подпись пина для отчёта симуляции («GPIO2»). */
  pinLabel?: string
  invert?: boolean
  /** Имя функции пользователя (привязка callback). */
  fn?: string
  /** Значение формирует устройство (а не пользователь) — «оживляем» случайным блужданием. */
  driven: boolean
}

/** Защита от преждевременного закрытия <script>/<style> в инлайн-тексте. */
const safeScript = (s: string): string => s.replace(/<\/(script)/gi, '<\\/$1')
const safeStyle = (s: string): string => s.replace(/<\/(style)/gi, '<\\/$1')
/** JSON внутри <script>: экранируем «<» и разделители строк. */
const safeJson = (o: unknown): string =>
  JSON.stringify(o)
    .replace(/</g, '\\u003c')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029')

export function buildSim(p: UiProject, ids: Record<string, number>, visible: Set<number>): SimItem[] {
  const out: SimItem[] = []
  const typeNum: Record<string, number> = { label: 4, button: 3, switcher: 5, slider: 6, number: 7, text: 8, select: 12, graph: 9 }
  for (const t of p.tabs) {
    for (const el of t.elements) {
      const id = ids[el.id]
      const type = typeNum[el.type]
      if (id === undefined || type === undefined || !visible.has(id)) continue
      const b = el.binding
      const pr = el.props
      const item: SimItem = { id, type, label: el.label, kind: b.kind, driven: false }
      if (b.kind === 'var') {
        const v = findVariable(p, b.variable)
        item.variable = b.variable
        item.dir = b.direction
        item.vtype = v?.type
        item.init = v?.init
      } else if (b.kind === 'pin') {
        item.analog = b.mode === 'analog'
        item.dir = b.direction
        item.pinLabel = b.pinName ? `${b.pinName} (GPIO${b.pin})` : p.platform === 'esp8266' && b.pin === 17 ? 'A0' : `GPIO${b.pin}`
        item.invert = !!b.invert
      } else if (b.kind === 'callback') {
        item.fn = b.fn
      }
      item.decimals = pr.decimals
      item.prefix = pr.prefix
      item.suffix = pr.suffix
      item.min = pr.min
      item.max = pr.max
      item.action = pr.action
      item.driven =
        el.type === 'graph' ||
        (b.kind === 'var' && (b.direction === 'toUi' || (el.type === 'label' && b.direction === 'both'))) ||
        (b.kind === 'pin' && b.direction === 'fromPin') ||
        (el.type === 'label' && b.kind === 'callback')
      out.push(item)
    }
  }
  return out
}

export interface PreviewOptions {
  /** edit — статичный вид для редактирования (без «оживления»); test — работающая симуляция. */
  mode: 'edit' | 'test'
  /** Какая вкладка (id вкладки конструктора) открыта. */
  activeTab?: string
}

export function buildPreviewSrcdoc(project: UiProject, opts: PreviewOptions = { mode: 'test' }): string {
  const page = buildEspuiPage(project, { showHidden: opts.mode === 'edit' })
  const visible = new Set<number>()
  for (const c of page.message.controls) if ('id' in c && c.visible) visible.add(c.id)
  const sim = buildSim(project, page.ids, visible)
  const cards: Record<number, string> = {}
  for (const [elId, num] of Object.entries(page.ids)) cards[num] = elId
  const tabs: Record<number, string> = {}
  for (const [tabId, num] of Object.entries(page.tabIds)) tabs[num] = tabId
  const activeTabNum = opts.activeTab !== undefined ? page.tabIds[opts.activeTab] : undefined
  const cfg = safeJson({ page: page.message, sim, mode: opts.mode, cards, tabs, activeTab: activeTabNum ?? null })
  const title = project.settings.title.replace(/</g, '&lt;')
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${safeStyle(normalizeCss)}</style>
<style>${safeStyle(styleCss)}</style>
<style>${safeStyle(page.customCss)}</style>
<script>window.__ESPUI_PREVIEW__ = ${cfg};</script>
<script>${safeScript(mockJs)}</script>
<script>${safeScript(agentJs)}</script>
<script>${safeScript(zeptoJs)}</script>
<script>${safeScript(sliderJs)}</script>
<script>${safeScript(graphJs)}</script>
<script>${safeScript(controlsJs)}</script>
<script>${safeScript(tabbedJs)}</script>
<script>${safeScript(page.customJs)}</script>
</head>
<body onload="javascript:start();">
<div><h4><div id="mainHeader">Control</div><span id="conStatus" class="label">Offline</span></h4></div>
<hr />
<div class="container">
<div id="row" class="row u-full-width"></div>
<ul id="tabsnav" class="navigation navigation-tabs u-full-width"></ul>
<div id="tabscontent" class="tabscontent u-full-width"></div>
</div>
</body></html>`
}

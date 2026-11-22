// Генератор JS: конфигурация привязок + клиентский рантайм.
import { fmt, jsonForScript, num } from './escape'
import { STATUS_TEXT, textLang, usedTypes, isValidOtaPath } from './html'
import { buildRuntime } from './runtime'
import { parseRows, templateVars } from './sanitize'
import { bindingKey, walk } from './factory'
import type { Binding, Block, VarType, WdProject } from './types'

type Cfg = Record<string, unknown>

const ACTIVE: Block['type'][] = [
  'heading', 'text', 'button', 'switch', 'slider', 'input', 'color', 'sensor', 'indicator', 'gauge', 'progress', 'chart',
  'checkbox', 'select', 'radio', 'textarea', 'log', 'badge', 'pad', 'clock', 'tabs', 'modal', 'table', 'list', 'wifisetup', 'ota'
]

const EXTRA_TX = {
  ru: { needSsid: 'Введите имя сети', sent: 'Отправлено на устройство', noconn: 'Нет связи с устройством', otaNoFile: 'Выберите файл', otaOk: 'Загружено, устройство перезапускается', otaErr: 'Ошибка загрузки' },
  en: { needSsid: 'Enter the network name', sent: 'Sent to the device', noconn: 'No connection to the device', otaNoFile: 'Choose a file', otaOk: 'Uploaded, the device is restarting', otaErr: 'Upload failed' }
}

export function bindingFlags(b: Binding): { in: boolean; out: boolean } {
  if (b.kind === 'var') return { in: b.direction !== 'toUi', out: b.direction !== 'fromUi' }
  if (b.kind === 'pin') return { in: b.direction === 'toPin', out: b.direction === 'fromPin' }
  return { in: false, out: false }
}

function varType(p: WdProject, name: string): VarType | null {
  return p.variables.find((v) => v.name === name)?.type ?? null
}

/** Значение, которое отправляет кнопка action=send, приведённое к типу привязки. */
export function buttonValue(p: WdProject, b: Block): unknown {
  const raw = b.props.value ?? ''
  if (b.binding.kind === 'pin') return raw === '' ? true : /^(true|1)$/i.test(raw.trim())
  const t = b.binding.kind === 'var' ? varType(p, b.binding.variable) : null
  if (t === 'bool') return /^(true|1)$/i.test(raw.trim())
  if (t === 'int') return Math.trunc(Number(raw) || 0)
  if (t === 'float') return Number(raw) || 0
  return raw
}

export function buildConfig(p: WdProject): Cfg {
  const tx = STATUS_TEXT[textLang(p)]
  const on = textLang(p) === 'ru' ? 'Вкл' : 'On'
  const off = textLang(p) === 'ru' ? 'Выкл' : 'Off'
  const entries: Cfg[] = []
  walk(p.blocks, (b) => {
    if (!ACTIVE.includes(b.type)) return
    const key = bindingKey(b.binding)
    const f = bindingFlags(b.binding)
    const pr = b.props
    if ((b.type === 'heading' || b.type === 'text' || b.type === 'badge') && !(key && f.out)) return
    const e: Cfg = { i: `b_${b.id}`, t: b.type }
    if (key) {
      e.k = key
      e.in = f.in ? 1 : 0
      e.out = f.out ? 1 : 0
    }
    if (pr.prefix) e.p = pr.prefix
    if (pr.suffix) e.s = pr.suffix
    if (pr.unit) e.u = pr.unit
    if (pr.decimals !== undefined) e.d = Math.round(num(pr.decimals, 0, 0, 6))
    if (b.type === 'slider' || b.type === 'gauge' || b.type === 'progress' || b.type === 'chart') {
      e.min = num(pr.min, 0)
      e.max = num(pr.max, 100)
    }
    if (b.type === 'chart') {
      e.pts = Math.round(num(pr.points, 60, 5, 600))
      e.fill = pr.fill ? 1 : 0
    }
    if (b.type === 'indicator') {
      e.on = pr.onText ?? on
      e.off = pr.offText ?? off
    }
    if (b.type === 'button') {
      e.act = pr.action === 'send' ? 'send' : 'momentary'
      if (e.act === 'send') e.val = buttonValue(p, b)
    }
    if (b.type === 'input') e.nt = pr.inputType === 'number' ? 1 : 0
    if ((b.type === 'select' || b.type === 'radio') && b.binding.kind === 'var') {
      const t = varType(p, b.binding.variable)
      if (t === 'int' || t === 'float') e.num = 1
    }
    if (b.type === 'log') e.n = Math.round(num(pr.lines, 100, 10, 1000))
    if (b.type === 'pad') e.rel = pr.releaseValue || (pr.padMode === 'joystick' ? '0,0' : 'stop')
    if (b.type === 'clock') {
      e.cm = pr.clockMode === 'uptime' ? 'uptime' : 'browser'
      e.sec = pr.showSeconds ? 1 : 0
      e.h12 = pr.clock12 ? 1 : 0
      e.date = pr.showDate ? 1 : 0
    }
    if (b.type === 'table' || b.type === 'list') {
      const cells: unknown[] = []
      if (b.type === 'table') {
        parseRows(pr.rows).forEach((row, r) => row.forEach((t, c) => { const k = templateVars(t); if (k.length) cells.push([`${r}-${c}`, t, k]) }))
      } else {
        String(pr.rows ?? '').split(/\r?\n/).filter((l) => l.trim() !== '').forEach((t, n) => { const k = templateVars(t); if (k.length) cells.push([String(n), t, k]) })
      }
      e.cells = cells
    }
    if (b.type === 'wifisetup') {
      e.vs = pr.varSsid ?? ''
      e.vp = pr.varPass ?? ''
      e.vv = pr.varSave ?? ''
    }
    if (b.type === 'ota') e.u = isValidOtaPath(pr.path ?? '') ? pr.path : '/update'
    entries.push(e)
  })
  return {
    ws: p.device.wsPath,
    rc: Math.round(num(p.page.reconnectMs, 5000, 1000, 60000)),
    tx: { ...tx, on, off, ...EXTRA_TX[textLang(p)] },
    pg: (p.pages?.length ? p.pages : [{ id: 'main' }]).map((x) => x.id),
    b: entries
  }
}

export function generateJs(p: WdProject, standalone = false): string {
  const cfg = jsonForScript(buildConfig(p))
  return buildRuntime(usedTypes(p), (p.pages?.length ?? 1) > 1, cfg, standalone)
}

void fmt

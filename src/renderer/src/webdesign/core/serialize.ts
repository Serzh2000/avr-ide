// Сериализация project.json: версия, нормализация при чтении (значения по умолчанию, отсев мусора).
import { BLOCKS } from './blocks'
import { has } from './escape'
import { createProject, defaultDevice, defaultTheme, defaultWifi, defaultPage } from './factory'
import { PALETTE_KEYS, WD_VERSION } from './types'
import type { Binding, Block, BlockType, Platform, SitePage, WdProject, WdVariable } from './types'

export function serializeProject(p: WdProject): string {
  return JSON.stringify({ ...p, version: WD_VERSION }, null, 2) + '\n'
}

export type ParseResult = { ok: true; project: WdProject; notes: string[] } | { ok: false; error: string }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Копия plain-объекта без опасных ключей (__proto__, constructor, prototype). */
function clean(v: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!isObj(v)) return out
  for (const k of Object.keys(v)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue
    const x = v[k]
    out[k] = isObj(x) ? clean(x) : x
  }
  return out
}

const MAX_BLOCKS = 600
const MAX_DEPTH = 12

function str(v: unknown, d: string): string {
  return typeof v === 'string' ? v : d
}
function bool(v: unknown, d: boolean): boolean {
  return typeof v === 'boolean' ? v : d
}
function numv(v: unknown, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d
}
function oneOf<T extends string>(v: unknown, list: readonly T[], d: T): T {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : d
}

function parseBinding(v: unknown): Binding {
  if (!isObj(v)) return { kind: 'none' }
  if (v.kind === 'var' && typeof v.variable === 'string')
    return { kind: 'var', variable: v.variable, direction: oneOf(v.direction, ['toUi', 'fromUi', 'both'] as const, 'toUi') }
  if (v.kind === 'pin' && typeof v.pin === 'number')
    return {
      kind: 'pin',
      pin: Math.trunc(v.pin),
      direction: oneOf(v.direction, ['toPin', 'fromPin'] as const, 'toPin'),
      mode: oneOf(v.mode, ['digital', 'analog'] as const, 'digital'),
      invert: v.invert === true ? true : undefined,
      pull: v.pull === 'up' ? 'up' : undefined
    }
  return { kind: 'none' }
}

function parseBlock(v: unknown, depth: number, count: { n: number }, errs: string[]): Block | null {
  if (!isObj(v)) return null
  if (depth > MAX_DEPTH) {
    errs.push('слишком глубокая вложенность блоков')
    return null
  }
  if (++count.n > MAX_BLOCKS) {
    errs.push(`слишком много блоков (максимум ${MAX_BLOCKS})`)
    return null
  }
  const type = v.type as BlockType
  if (typeof type !== 'string' || !has(BLOCKS, type)) {
    errs.push(`неизвестный тип блока: ${String(v.type)}`)
    return null
  }
  const children: Block[] = []
  if (Array.isArray(v.children)) {
    for (const c of v.children) {
      const b = parseBlock(c, depth + 1, count, errs)
      if (b) children.push(b)
    }
  }
  const b: Block = {
    id: str(v.id, ''),
    type,
    props: clean(v.props) as Block['props'],
    style: clean(v.style) as Block['style'],
    binding: parseBinding(v.binding),
    children
  }
  if (typeof v.page === 'string') b.page = v.page
  if (isObj(v.responsive)) {
    const r = clean(v.responsive) as NonNullable<Block['responsive']>
    b.responsive = { tablet: isObj(r.tablet) ? r.tablet : undefined, mobile: isObj(r.mobile) ? r.mobile : undefined }
  }
  return b
}

export function parseProject(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { ok: false, error: `Некорректный JSON: ${(e as Error).message}` }
  }
  if (!isObj(raw)) return { ok: false, error: 'Ожидается объект проекта' }
  const ver = numv(raw.version, 0)
  if (ver < 1) return { ok: false, error: 'Не найдено поле version — это не project.json конструктора' }
  if (ver > WD_VERSION) return { ok: false, error: `Проект версии ${ver} новее поддерживаемой (${WD_VERSION}) — обновите IDE` }

  const notes: string[] = []
  const platform = oneOf<Platform>(raw.platform, ['esp8266', 'esp32'], 'esp32')
  const p = createProject(platform)

  const pg = clean(raw.page)
  const dp = defaultPage()
  p.page = {
    title: str(pg.title, dp.title),
    lang: str(pg.lang, dp.lang),
    description: str(pg.description, ''),
    theme: defaultTheme(),
    tablet: numv(pg.tablet, dp.tablet),
    mobile: numv(pg.mobile, dp.mobile),
    showStatus: bool(pg.showStatus, true),
    reconnectMs: numv(pg.reconnectMs, dp.reconnectMs)
  }
  const th = clean(pg.theme)
  const t = p.page.theme
  t.mode = oneOf(th.mode, ['auto', 'light', 'dark'] as const, 'auto')
  t.toggle = bool(th.toggle, true)
  t.font = oneOf(th.font, ['sans', 'serif', 'mono', 'rounded'] as const, 'sans')
  t.baseSize = numv(th.baseSize, t.baseSize)
  t.radius = numv(th.radius, t.radius)
  t.maxWidth = numv(th.maxWidth, t.maxWidth)
  for (const which of ['light', 'dark'] as const) {
    const src = clean(th[which])
    for (const k of PALETTE_KEYS) if (typeof src[k] === 'string') t[which][k] = src[k] as string
  }

  const w = clean(raw.wifi)
  const dw = defaultWifi()
  p.wifi = {
    mode: oneOf(w.mode, ['sta', 'ap'] as const, 'sta'),
    ssid: str(w.ssid, dw.ssid),
    password: str(w.password, dw.password),
    apSsid: str(w.apSsid, dw.apSsid),
    apPassword: str(w.apPassword, dw.apPassword),
    hostname: str(w.hostname, dw.hostname)
  }
  const dv = clean(raw.device)
  const dd = defaultDevice()
  p.device = {
    wsPath: str(dv.wsPath, dd.wsPath),
    port: numv(dv.port, dd.port),
    updateMs: numv(dv.updateMs, dd.updateMs),
    pwmFreq: numv(dv.pwmFreq, dd.pwmFreq),
    pwmBits: numv(dv.pwmBits, dd.pwmBits),
    ledcApi: oneOf(dv.ledcApi, ['v2', 'v3'] as const, 'v3'),
    serveApi: oneOf(dv.serveApi, ['send', 'send_P'] as const, 'send'),
    serialLog: bool(dv.serialLog, true)
  }

  if (Array.isArray(raw.variables)) {
    for (const x of raw.variables) {
      if (!isObj(x)) continue
      const v: WdVariable = {
        name: str(x.name, ''),
        type: oneOf(x.type, ['bool', 'int', 'float', 'String'] as const, 'int'),
        init: str(x.init, '')
      }
      p.variables.push(v)
    }
  }
  const pgs: SitePage[] = []
  if (Array.isArray(raw.pages)) {
    for (const x of raw.pages) {
      if (isObj(x) && typeof x.id === 'string') pgs.push({ id: x.id, title: str(x.title, x.id) })
    }
  }
  if (pgs.length) p.pages = pgs.slice(0, 20)
  const errs: string[] = []
  const count = { n: 0 }
  if (Array.isArray(raw.blocks)) {
    for (const b of raw.blocks) {
      const blk = parseBlock(b, 0, count, errs)
      if (blk) p.blocks.push(blk)
    }
  }
  if (errs.length) return { ok: false, error: errs[0] }
  return { ok: true, project: p, notes }
}

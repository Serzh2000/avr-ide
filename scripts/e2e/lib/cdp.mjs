// Минимальный клиент Chrome DevTools Protocol поверх встроенного в Node WebSocket (без зависимостей).
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.listeners = []
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(String(ev.data))
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject, method } = this.pending.get(m.id)
        this.pending.delete(m.id)
        if (m.error) reject(new Error(`CDP ${method}: ${m.error.message}`))
        else resolve(m.result)
      } else if (m.method) this.listeners.forEach((l) => l(m))
    })
    ws.addEventListener('close', () => {
      for (const { reject, method } of this.pending.values()) reject(new Error(`CDP ${method}: соединение закрыто`))
      this.pending.clear()
    })
  }
  static connect(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url)
      ws.addEventListener('open', () => resolve(new Cdp(ws)))
      ws.addEventListener('error', () => reject(new Error('не удалось подключиться к ' + url)))
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  on(fn) { this.listeners.push(fn) }
  close() { try { this.ws.close() } catch { /* уже закрыт */ } }
}

const MODS = { alt: 1, ctrl: 2, meta: 4, shift: 8 }
const KEYS = {
  Enter: { code: 'Enter', vk: 13, text: '\r' }, Escape: { code: 'Escape', vk: 27 }, Tab: { code: 'Tab', vk: 9 },
  Backspace: { code: 'Backspace', vk: 8 }, Delete: { code: 'Delete', vk: 46 }, ArrowDown: { code: 'ArrowDown', vk: 40 },
  ArrowUp: { code: 'ArrowUp', vk: 38 }, ArrowLeft: { code: 'ArrowLeft', vk: 37 }, ArrowRight: { code: 'ArrowRight', vk: 39 },
  Home: { code: 'Home', vk: 36 }, End: { code: 'End', vk: 35 }, ' ': { code: 'Space', vk: 32, text: ' ' }, F1: { code: 'F1', vk: 112 }
}

/**
 * Превращает цель в JS-выражение поиска элемента.
 * Строка = CSS-селектор; объект { sel, text, re, within, last, enabled }.
 * Берутся только видимые элементы (не внутри [hidden]); text ищется в тексте, aria-label, title, placeholder.
 */
export function finder(target) {
  const t = typeof target === 'string' ? { sel: target } : target
  const sel = JSON.stringify(t.sel ?? '*')
  const text = t.text != null ? JSON.stringify(t.text) : 'null'
  const re = t.re != null ? JSON.stringify(t.re) : 'null'
  const within = t.within ? `document.querySelector(${JSON.stringify(t.within)})` : 'document'
  return `(() => {
    const root = ${within}; if (!root) return null
    const vis = (e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && !e.closest('[hidden]') }
    const txt = ${text}
    const re = ${re} ? new RegExp(${re}, 'i') : null
    const list = [...root.querySelectorAll(${sel})].filter((e) => {
      if (!vis(e)) return false
      if (${t.enabled === false ? 'false' : 'true'} && e.disabled) return false
      const s = (e.innerText || e.value || '') + ' ' + (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || '') + ' ' + (e.getAttribute('placeholder') || '')
      if (txt != null && !s.toLowerCase().includes(txt.toLowerCase())) return false
      if (re && !re.test(s)) return false
      return true
    })
    return ${t.last ? 'list[list.length - 1]' : 'list[0]'} ?? null
  })()`
}

/** Элемент DOM нельзя вернуть по значению — превращаем в true. */
function wrapNode(expr) {
  const src = typeof expr === 'function' ? `(${expr})()` : expr
  return `(async () => { const v = await (${src}); return v && typeof v === 'object' && v.nodeType ? true : v })()`
}

/** Страница: обёртка над CDP с помощниками для проверки интерфейса. */
export class Page {
  constructor(cdp) { this.cdp = cdp }

  async eval(expr) {
    const src = typeof expr === 'function' ? `(${expr})()` : expr
    const r = await this.cdp.send('Runtime.evaluate', { expression: src, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) {
      const d = r.exceptionDetails
      throw new Error('JS: ' + (d.exception?.description ?? d.text))
    }
    return r.result.value
  }

  /** Ждёт, пока выражение станет истинным. Возвращает значение. */
  async waitFor(expr, { timeout = 10000, what = '', interval = 100 } = {}) {
    const t0 = Date.now()
    let last
    for (;;) {
      try { last = await this.eval(wrapNode(expr)); if (last) return last } catch (e) { last = e }
      if (Date.now() - t0 > timeout) {
        throw new Error(`таймаут ${timeout} мс: ${what || (typeof expr === 'string' ? expr.slice(0, 120) : 'условие')}` + (last instanceof Error ? ` (${last.message})` : ''))
      }
      await sleep(interval)
    }
  }

  /** Центр элемента после прокрутки; проверяет, что в этой точке действительно он (а не перекрывающий слой). */
  async #center(find) {
    return this.eval(`(() => {
      const el = (${find}); if (!el) return null
      for (const block of ['nearest', 'center', 'start', 'end']) {
        el.scrollIntoView({ block, inline: 'nearest' })
        const b = el.getBoundingClientRect()
        if (!b.width || !b.height) return { hidden: true }
        const x = b.left + b.width / 2, y = b.top + b.height / 2
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue
        const top = document.elementFromPoint(x, y)
        if (top && (el === top || el.contains(top) || top.contains(el))) return { x, y }
      }
      const b = el.getBoundingClientRect()
      const top = document.elementFromPoint(Math.min(Math.max(b.left + b.width / 2, 0), innerWidth - 1), Math.min(Math.max(b.top + b.height / 2, 0), innerHeight - 1))
      return { hidden: true, covered: top ? top.tagName + '.' + top.className : 'вне окна' }
    })()`)
  }

  /** Клик мышью (настоящие события ввода) по элементу, найденному JS-выражением. */
  async clickExpr(find, { timeout = 8000, what = 'элемент', button = 'left', clickCount = 1 } = {}) {
    const t0 = Date.now()
    let c = null
    for (;;) {
      c = await this.#center(find).catch(() => null)
      if (c && !c.hidden) break
      if (Date.now() - t0 > timeout) throw new Error(`не найден для клика: ${what}` + (c?.covered ? ` (перекрыт элементом ${c.covered})` : c?.hidden ? ' (нулевой размер)' : ''))
      await sleep(100)
    }
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y })
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button, clickCount })
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button, clickCount })
  }

  click(target, opts = {}) { return this.clickExpr(finder(target), { what: JSON.stringify(target), ...opts }) }
  exists(target) { return this.eval(`!!(${finder(target)})`) }
  count(sel) { return this.eval(`[...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => e.getBoundingClientRect().width > 0).length`) }
  text(target) { return this.eval(`(${finder(target)})?.innerText ?? null`) }
  waitExists(target, opts = {}) { return this.waitFor(`!!(${finder(target)})`, { what: 'появление ' + JSON.stringify(target), ...opts }) }
  waitGone(target, opts = {}) { return this.waitFor(`!(${finder(target)})`, { what: 'исчезновение ' + JSON.stringify(target), ...opts }) }

  /** Вставка текста в сфокусированный элемент. */
  async insertText(text) { await this.cdp.send('Input.insertText', { text }) }

  /** Очищает и заполняет input/textarea: клик, выделить всё, вставить. */
  async fill(target, text) {
    await this.click(target)
    await this.key('a', { ctrl: true })
    if (text === '') await this.key('Backspace')
    else await this.insertText(text)
  }

  /** Нажатие клавиши: key('s', { ctrl: true }), key('F1'), key(' ', { ctrl: true }). */
  async key(key, { ctrl, shift, alt } = {}) {
    const mods = (ctrl ? MODS.ctrl : 0) | (shift ? MODS.shift : 0) | (alt ? MODS.alt : 0)
    const k = KEYS[key]
    const isChar = key.length === 1
    const code = k?.code ?? (isChar && /[a-z]/i.test(key) ? 'Key' + key.toUpperCase() : isChar && /\d/.test(key) ? 'Digit' + key : key)
    const vk = k?.vk ?? (isChar ? key.toUpperCase().charCodeAt(0) : 0)
    const text = mods & (MODS.ctrl | MODS.alt) ? undefined : (k?.text ?? (isChar ? (shift ? key.toUpperCase() : key) : undefined))
    const base = { key: shift && isChar ? key.toUpperCase() : key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods }
    await this.cdp.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', ...base, ...(text ? { text } : {}) })
    await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
  }

  async shot(path) {
    const r = await this.cdp.send('Page.captureScreenshot', { format: 'png' })
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, Buffer.from(r.data, 'base64'))
  }

  /** Внешний размер окна (window.resizeTo работает в окне Electron; учитывается minWidth/minHeight окна). */
  async setWindowSize(width, height) {
    await this.eval(`window.resizeTo(${width}, ${height})`)
    await this.waitFor(`outerWidth === ${width}`, { timeout: 5000, what: `ширина окна ${width}` })
    await sleep(300)
  }
}

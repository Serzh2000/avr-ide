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
  Home: { code: 'Home', vk: 36 }, End: { code: 'End', vk: 35 }, ' ': { code: 'Space', vk: 32, text: ' ' }, F1: { code: 'F1', vk: 112 },
  F2: { code: 'F2', vk: 113 }, F5: { code: 'F5', vk: 116 }, F9: { code: 'F9', vk: 120 }, F10: { code: 'F10', vk: 121 }, F11: { code: 'F11', vk: 122 }, F12: { code: 'F12', vk: 123 }
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


  /** Прямоугольник первого видимого элемента (координаты окна) или null. */
  rectOf(target) {
    return this.eval(`(() => { const e = ${finder(target)}; if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height } })()`)
  }

  /** Перетаскивание мышью по координатам (настоящие события мыши: pointerdown/move/up). */
  async mouseDrag(from, to, steps = 10) {
    const m = (type, x, y, extra = {}) => this.cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', ...extra })
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x, y: from.y })
    await m('mousePressed', from.x, from.y, { clickCount: 1, buttons: 1 })
    for (let i = 1; i <= steps; i++) await m('mouseMoved', from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps, { buttons: 1 })
    await m('mouseReleased', to.x, to.y, { clickCount: 1, buttons: 0 })
  }

  /** Тянет разделитель на dx пикселей (по горизонтали) от его центра. */
  async dragSplitter(target, dx) {
    const r = await this.rectOf(target)
    if (!r) throw new Error('разделитель не найден: ' + JSON.stringify(target))
    const x = r.x + r.w / 2, y = r.y + Math.min(r.h / 2, 200)
    // конечная точка — внутри окна: за его краем отпускание кнопки может не дойти до страницы
    const iw = await this.eval('innerWidth')
    const tx = Math.min(iw - 2, Math.max(2, x + dx))
    await this.mouseDrag({ x, y }, { x: tx, y })
  }

  /**
   * Перетаскивание HTML5 drag-and-drop (draggable + dragover/drop) настоящей мышью:
   * нажатие и сдвиг на источнике, затем перехваченное перетаскивание «доставляется» на цель
   * (Input.setInterceptDrags + dispatchDragEvent — родной цикл перетаскивания ОС в CDP недоступен).
   * where: 'top' | 'center' | 'bottom' — часть цели, куда отпустить.
   */
  async dragAndDrop(src, dst, where = 'center') {
    // координаты берём заново на каждой попытке: layout мог сдвинуться (появление строк, прокрутка, анимация)
    let s = await this.rectOf(src)
    let d = await this.rectOf(dst)
    if (!s) throw new Error('источник не найден: ' + JSON.stringify(src))
    if (!d) throw new Error('цель не найдена: ' + JSON.stringify(dst))
    const box = { data: null }
    this.cdp.on((m) => { if (m.method === 'Input.dragIntercepted') box.data = m.params.data })
    await this.cdp.send('Input.setInterceptDrags', { enabled: true })
    try {
      const mv = (x, y) => this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 })
      let sx = 0, sy = 0
      for (let attempt = 0; attempt < 4 && !box.data; attempt++) {
        if (attempt > 0) {
          await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: sx, y: sy, button: 'left', buttons: 0, clickCount: 1 }).catch(() => {})
          await sleep(300)
          s = (await this.rectOf(src)) ?? s
          d = (await this.rectOf(dst)) ?? d
        }
        sx = s.x + Math.min(s.w * 0.4, 60); sy = s.y + s.h / 2
        await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sx, y: sy })
        await this.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sx, y: sy, button: 'left', buttons: 1, clickCount: 1 })
        for (let i = 1; i <= 6 && !box.data; i++) { await mv(sx + i * 3, sy + i * 3); await sleep(40) }
        for (let i = 0; i < 12 && !box.data; i++) await sleep(100)
      }
      if (!box.data) throw new Error('перетаскивание не началось: ' + JSON.stringify(src))
      const tx = d.x + Math.min(d.w * 0.4, 80)
      const ty = where === 'top' ? d.y + d.h * 0.15 : where === 'bottom' ? d.y + d.h * 0.85 : d.y + d.h / 2
      const drag = (type, x, y) => this.cdp.send('Input.dispatchDragEvent', { type, x, y, data: box.data, modifiers: 0 })
      await drag('dragEnter', sx, sy + 8)
      await drag('dragOver', (sx + tx) / 2, (sy + ty) / 2)
      await drag('dragOver', tx, ty)
      await sleep(60)
      await drag('dragOver', tx, ty)
      await drag('drop', tx, ty)
      await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: tx, y: ty, button: 'left', buttons: 0, clickCount: 1 })
    } finally {
      await this.cdp.send('Input.setInterceptDrags', { enabled: false }).catch(() => {})
    }
    await sleep(150)
  }

  async shot(path) {
    const r = await this.cdp.send('Page.captureScreenshot', { format: 'png' })
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, Buffer.from(r.data, 'base64'))
  }

  /** Внешний размер окна (window.resizeTo работает в окне Electron; учитывается minWidth/minHeight окна). */
  async setWindowSize(width, height) {
    // resizeTo повторяем: на части мониторов/DPI первая попытка не срабатывает (окно развёрнуто, идёт анимация)
    const t0 = Date.now()
    for (;;) {
      await this.eval(`window.resizeTo(${width}, ${height})`)
      const ok = await this.eval(`outerWidth === ${width} && outerHeight === ${height}`)
      if (ok) break
      if (Date.now() - t0 > 12000) throw new Error(`таймаут: размер окна ${width}x${height}, сейчас ${await this.eval('outerWidth + "x" + outerHeight')}`)
      await sleep(300)
    }
    await this.settle(`document.documentElement.clientWidth`, { what: 'ширина документа после смены размера окна' })
  }

  /** Ждёт, пока значение выражения не перестанет меняться (три опроса подряд), и возвращает его. */
  async settle(expr, { timeout = 5000, what = '' } = {}) {
    const t0 = Date.now()
    let prev = null, same = 0
    for (;;) {
      const v = await this.eval(`new Promise((res) => setTimeout(() => res(JSON.stringify(${expr})), 50))`)
      same = v === prev ? same + 1 : 0
      prev = v
      if (same >= 2) return JSON.parse(v)
      if (Date.now() - t0 > timeout) throw new Error(`таймаут ${timeout} мс: значение не устаканилось${what ? ' (' + what + ')' : ''}: ${v}`)
      await sleep(40)
    }
  }
}

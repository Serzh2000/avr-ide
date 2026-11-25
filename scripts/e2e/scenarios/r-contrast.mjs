// Контраст текста (WCAG AA, 4.5:1; крупный — 3:1) на основных экранах в обеих темах. Считается по вычисленным цветам DOM
// (прозрачные фоны складываются по цепочке предков); содержимое iframe-холстов не входит (это страница пользователя).
import { assert, openRecent, openWorkspaceTool } from '../lib/kit.mjs'
import { sleep } from '../lib/cdp.mjs'

const CHECK = `(() => {
  const parse = (c) => { const m = c.match(/rgba?[(]([^)]+)[)]/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 })
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b) }
  const bgOf = (el) => { const stack = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) stack.push(c); if (c && c.a >= 1) break } let b = { r: 255, g: 255, b: 255, a: 1 }; for (let i = stack.length - 1; i >= 0; i--) b = over(stack[i], b); return b }
  const out = new Map()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n; (n = walker.nextNode());) {
    if (!n.nodeValue.trim()) continue
    const el = n.parentElement
    if (!el || el.closest('.monaco-editor, svg, iframe, [hidden], .ref-pinout, canvas, [disabled], [aria-disabled=true]')) continue
    const st = getComputedStyle(el)
    if (st.visibility === 'hidden' || st.display === 'none' || +st.opacity === 0) continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue
    let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity
    if (op < 0.02) continue // скрытая через opacity:0 панель (закрытая боковая панель) не видна пользователю
    const fg = parse(st.color); if (!fg) continue
    const bg = bgOf(el)
    const f = over({ ...fg, a: fg.a * op }, bg)
    const L1 = lum(f), L2 = lum(bg)
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const px = parseFloat(st.fontSize), bold = parseInt(st.fontWeight) >= 700
    const need = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5
    if (ratio < need) { const k = el.className && typeof el.className === 'string' ? el.tagName.toLowerCase() + '.' + el.className.split(' ')[0] : el.tagName.toLowerCase(); const o = out.get(k) ?? { k, ratio: 99, need, text: n.nodeValue.trim().slice(0, 30), count: 0 }; o.count++; if (ratio < o.ratio) { o.ratio = +ratio.toFixed(2); o.text = n.nodeValue.trim().slice(0, 30) } out.set(k, o) }
  }
  return [...out.values()].sort((a, b) => a.ratio - b.ratio)
})()`

export default {
  id: 'r',
  title: 'Контраст текста AA на основных экранах в обеих темах',
  arduino: 'ard2',
  files: { 'Con1/Con1.ino': 'void setup() {\n}\nvoid loop() {\n}\n', 'Con1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Con1'],
  async run({ page, log }) {
    await openRecent({ page }, 'Con1')
    const bad = []
    // Самопроверка проверяльщика: заведомо плохой текст должен быть найден
    await page.eval(`(() => { const d = document.createElement('div'); d.id = 'bad-contrast'; d.style.cssText = 'position:fixed;left:100px;top:100px;z-index:999;background:#888;color:#777;font-size:13px'; d.textContent = 'плохой контраст'; document.body.appendChild(d) })()`)
    const probe = await page.eval(CHECK)
    assert(probe.some((x) => x.text.startsWith('плохой')), 'проверка контраста находит заведомо плохой текст')
    await page.eval(`document.getElementById('bad-contrast').remove()`)
    const audit = async (name) => {
      let result = await page.eval(CHECK)
      // Повторяем замер после перехода цвета.
      for (let attempt = 0; attempt < 3 && result.length > 0; attempt++) {
        await sleep(450)
        result = await page.eval(CHECK)
      }
      for (const item of result) bad.push(`${name}: ${item.k} «${item.text}» ${item.ratio}:1 (нужно ${item.need}), ×${item.count}`)
    }
    for (const theme of ['dark', 'light']) {
      await page.eval(`window.__avrStores.useUi.getState().setSettings({ theme: '${theme}' })`)
      await sleep(900)
      for (const id of ['files', 'search', 'examples', 'boards', 'libs', 'ref', 'ui', 'web', 'settings']) {
        await page.click(`[data-testid=act-${id}]`)
        await sleep(700)
        await audit(`${theme}/${id}`)
      }
      for (const tool of ['output', 'problems', 'monitor', 'plotter']) {
        await openWorkspaceTool(page, tool)
        await sleep(150)
        await audit(`${theme}/${tool}`)
      }
    }
    const uniq = [...new Set(bad)]
    for (const b of uniq) log(b)
    assert(uniq.length === 0, 'недостаточный контраст:\n' + uniq.slice(0, 40).join('\n'))
  }
}

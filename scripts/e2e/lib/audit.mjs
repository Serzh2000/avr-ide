// Автоаудит раскладки и темы: выполняется внутри страницы (функция сериализуется целиком).
// Находит горизонтальный скролл, элементы управления за краем окна и «не той темы» крупные заливки.

/* eslint-disable */
export function auditPage(opts) {
  const issues = []
  const W = window.innerWidth
  const H = window.innerHeight
  const de = document.documentElement
  if (de.scrollWidth > W + 1) issues.push(`горизонтальный скролл страницы: scrollWidth ${de.scrollWidth} > ${W}`)
  if (document.body.scrollWidth > W + 1) issues.push(`горизонтальный скролл body: ${document.body.scrollWidth} > ${W}`)
  if (de.dataset.theme !== opts.theme) issues.push(`тема документа «${de.dataset.theme}», ожидалась «${opts.theme}»`)

  const visible = (e) => {
    const r = e.getBoundingClientRect()
    if (r.width < 6 || r.height < 6) return false
    const cs = getComputedStyle(e)
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false
    for (let p = e; p; p = p.parentElement) {
      if (p.hasAttribute('hidden') || getComputedStyle(p).display === 'none') return false
    }
    return true
  }
  const name = (e) => {
    const t = (e.getAttribute('aria-label') || e.getAttribute('title') || e.innerText || e.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 40)
    return `<${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : ''}> «${t}»`
  }
  // Предок, который по замыслу прокручивается или обрезает содержимое и сам помещается в окно
  const clippedByDesign = (e) => {
    for (let p = e.parentElement; p && p !== document.body && p !== de; p = p.parentElement) {
      const cs = getComputedStyle(p)
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) {
        const r = p.getBoundingClientRect()
        if (r.right <= W + 1 && r.left >= -1) return true
      }
    }
    return false
  }

  const seen = new Set()
  for (const e of document.querySelectorAll('button, input, select, textarea, a[href], [role=tab], [role=option], [role=menuitem], label')) {
    if (e.matches('input[type=file], .inputarea, textarea.inputarea, .monaco-editor *')) continue
    if (!visible(e)) continue
    const r = e.getBoundingClientRect()
    if (r.right > W + 1 || r.left < -1) {
      if (clippedByDesign(e)) continue
      const k = name(e)
      if (seen.has(k)) continue
      seen.add(k)
      issues.push(`элемент выходит за окно по горизонтали (${Math.round(r.left)}…${Math.round(r.right)} из ${W}): ${k}`)
    }
  }
  for (const sel of ['.header', '.statusbar', '.activity']) {
    const e = document.querySelector(sel)
    if (!e) continue
    const r = e.getBoundingClientRect()
    if (r.bottom > H + 1 || r.top < -1 || r.right > W + 1) issues.push(`${sel} обрезан окном: top ${Math.round(r.top)}, bottom ${Math.round(r.bottom)} из ${H}`)
  }
  // Заголовочные кнопки шапки не должны налезать друг на друга и на край
  const hdr = document.querySelector('.header')
  if (hdr) {
    const boxes = [...hdr.querySelectorAll('button')].filter((b) => !b.closest('.popover') && visible(b)).map((b) => ({ b, r: b.getBoundingClientRect() }))
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r, c = boxes[j].r
      const ox = Math.min(a.right, c.right) - Math.max(a.left, c.left)
      const oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top)
      if (ox > 3 && oy > 3) issues.push(`кнопки шапки перекрываются: ${name(boxes[i].b)} и ${name(boxes[j].b)}`)
    }
  }

  // Тема: крупные непрозрачные заливки не должны быть «не того цвета»
  const lum = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(',').map((x) => parseFloat(x))
    if (p.length === 4 && p[3] < 0.95) return null
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2])
  }
  const wrong = new Map()
  for (const e of document.querySelectorAll('body *')) {
    if (e.closest('.monaco-editor, iframe, canvas, svg, .uib-canvas, .start-card.primary, .btn.primary, .statusbar, .hbtn.primary, .wd-preview, .plot-wrap, .uib-stage-outer, .wd-frame-box')) continue
    if (e.tagName === 'IFRAME' || e.tagName === 'CANVAS' || e.tagName === 'svg') continue
    if (!visible(e)) continue
    const r = e.getBoundingClientRect()
    if (r.width * r.height < 4000) continue
    const bg = getComputedStyle(e).backgroundColor
    const l = lum(bg)
    if (l === null) continue
    const bad = opts.theme === 'light' ? l < 0.1 : l > 0.5
    if (bad) {
      const k = name(e) + ' ' + bg
      if (!wrong.has(k)) wrong.set(k, 1)
    }
  }
  for (const k of [...wrong.keys()].slice(0, 6)) issues.push(`заливка не по теме «${opts.theme}»: ${k}`)
  const mon = document.querySelector('.view:not([hidden]) .monaco-editor')
  if (mon && visible(mon)) {
    const light = mon.classList.contains('vs') && !mon.classList.contains('vs-dark')
    const dark = mon.classList.contains('vs-dark') || mon.classList.contains('hc-black')
    if (opts.theme === 'light' && dark) issues.push('Monaco остался в тёмной теме при светлой теме приложения')
    if (opts.theme === 'dark' && light) issues.push('Monaco остался в светлой теме при тёмной теме приложения')
  }
  return issues
}

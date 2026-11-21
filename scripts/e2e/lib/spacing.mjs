// Аудит вертикальных стыков карточек: соседние блоки с рамкой/фоном не должны «слипаться» (зазор 1–5 px) или перекрываться,
// а их левые/правые края — разъезжаться больше чем на 2 px. Функция сериализуется целиком и выполняется внутри страницы.
export function spacingAudit() {
  const out = []
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 20 && r.height > 8 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0 }
  const clear = (c) => !c || c === 'transparent' || /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c)
  // «Карточка»: скруглённый блок с рамкой по всем сторонам или с собственным фоном
  const isCard = (el) => {
    const s = getComputedStyle(el)
    const rad = parseFloat(s.borderTopLeftRadius) > 0
    const sides = ['Top', 'Right', 'Bottom', 'Left'].filter((k) => parseFloat(s['border' + k + 'Width']) > 0 && s['border' + k + 'Style'] !== 'none' && !clear(s['border' + k + 'Color']))
    const bg = !clear(s.backgroundColor) || (s.backgroundImage && s.backgroundImage !== 'none')
    return rad && (sides.length === 4 || bg)
  }
  const name = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + (el.dataset?.testid ? '[' + el.dataset.testid + ']' : '')
  const skip = '.monaco-editor, canvas, svg, iframe, .popover, .tooltip, .toast, .splitter, .ex-code, .uib-canvas, .wd-preview, .ref-pinout-wrap'
  const seen = new Set()
  for (const parent of document.querySelectorAll('body *')) {
    if (parent.closest(skip) || !vis(parent)) continue
    const kids = [...parent.children].filter((c) => vis(c) && getComputedStyle(c).position !== 'absolute' && getComputedStyle(c).position !== 'fixed')
    for (let i = 0; i + 1 < kids.length; i++) {
      const a = kids[i], b = kids[i + 1]
      if (!isCard(a) || !isCard(b)) continue
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect()
      // только вертикальная стопка (b ниже a, горизонтали пересекаются)
      if (rb.top < ra.top - 1 || Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left) < 20) continue
      const gap = Math.round((rb.top - ra.bottom) * 10) / 10
      const problems = []
      if (gap < 0) problems.push(`перекрытие ${-gap} px`)
      else if (gap > 0 && gap < 6) problems.push(`зазор ${gap} px (нужно ≥ 6 или ровно 0 у слитных строк)`)
      if (Math.abs(ra.left - rb.left) > 2 || Math.abs(ra.right - rb.right) > 2) problems.push(`края не выровнены (лево ${Math.round(ra.left)}/${Math.round(rb.left)}, право ${Math.round(ra.right)}/${Math.round(rb.right)})`)
      const ca = getComputedStyle(a), cb = getComputedStyle(b)
      if (ca.borderTopLeftRadius !== cb.borderTopLeftRadius && gap < 12) problems.push(`разные радиусы ${ca.borderTopLeftRadius}/${cb.borderTopLeftRadius}`)
      if (!problems.length) continue
      const key = name(a) + '|' + name(b) + '|' + problems.join()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(`${name(a)} ↓ ${name(b)}: ${problems.join('; ')}`)
    }
  }
  return out
}

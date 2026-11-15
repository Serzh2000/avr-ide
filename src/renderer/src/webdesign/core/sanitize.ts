// Фильтры пользовательского HTML/CSS (блок «Свой HTML/CSS») и разбор текстовых свойств (options, rows, href).
import { escapeHtml, isSafeImageSrc } from './escape'

export interface Sanitized {
  out: string
  /** Сколько тегов/атрибутов/правил отброшено. */
  removed: number
}

const TAGS = new Set(
  ('a b i u s em strong small code pre blockquote p div span br hr h1 h2 h3 h4 h5 h6 ul ol li table thead tbody tfoot ' +
    'tr th td img sub sup mark kbd').split(' ')
)
const VOID = new Set(['br', 'hr', 'img'])
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'textarea', 'select'])

/** Безопасный адрес ссылки: #якорь, относительный путь, http(s), mailto, tel. Иначе null. */
export function safeHref(href: string): string | null {
  const h = href.trim()
  if (h === '') return null
  if (/[\u0000-\u001f\s"'<>`\\]/.test(h)) return null
  if (h.startsWith('#')) return /^#[\w/.:-]*$/.test(h) ? h : null
  if (/^(?:https?:\/\/|mailto:|tel:)[^\s]+$/i.test(h)) return h
  if (/^[A-Za-z0-9_][A-Za-z0-9_./?=&%#+-]*$/.test(h) && !h.includes('..')) return h
  return null
}

function escText(s: string): string {
  return s.replace(/&(?!#?[A-Za-z0-9]{1,10};)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/y
const ATTR_RE = /([a-zA-Z_:][-\w:.]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g

/** Белый список тегов и атрибутов; всё остальное — текст или удаляется. Результат безопасно вставлять в страницу. */
export function sanitizeHtml(src: string): Sanitized {
  let out = ''
  let removed = 0
  const stack: string[] = []
  let i = 0
  const s = String(src).slice(0, 20000)
  while (i < s.length) {
    const lt = s.indexOf('<', i)
    if (lt < 0) {
      out += escText(s.slice(i))
      break
    }
    out += escText(s.slice(i, lt))
    if (s.startsWith('<!--', lt)) {
      const end = s.indexOf('-->', lt + 4)
      removed++
      i = end < 0 ? s.length : end + 3
      continue
    }
    TAG_RE.lastIndex = lt
    const m = TAG_RE.exec(s)
    if (!m) {
      out += '&lt;'
      i = lt + 1
      continue
    }
    i = lt + m[0].length
    const closing = m[1] === '/'
    const name = m[2].toLowerCase()
    if (DROP_WITH_CONTENT.has(name) && !closing) {
      removed++
      const re = new RegExp(`</${name}\\s*>`, 'i')
      const rest = s.slice(i)
      const e = re.exec(rest)
      i = e ? i + e.index + e[0].length : s.length
      continue
    }
    if (!TAGS.has(name)) {
      removed++
      continue
    }
    if (closing) {
      const idx = stack.lastIndexOf(name)
      if (idx < 0) {
        removed++
        continue
      }
      while (stack.length > idx) out += `</${stack.pop()}>`
      continue
    }
    let attrs = ''
    for (const a of m[3].matchAll(ATTR_RE)) {
      const an = a[1].toLowerCase()
      let av = a[2] ?? ''
      if (av[0] === '"' || av[0] === "'") av = av.slice(1, -1)
      av = av.replace(/&(?:quot|#34);/g, '"').replace(/&(?:amp|#38);/g, '&')
      let ok: string | null = null
      if (an === 'class') ok = /^[\w\s-]{0,80}$/.test(av) ? av : null
      else if (an === 'title' || an === 'alt' || an === 'aria-label') ok = av.slice(0, 200)
      else if (an === 'href' && name === 'a') {
        const h = safeHref(av)
        ok = h
      } else if (an === 'src' && name === 'img') ok = isSafeImageSrc(av) ? av : null
      else if ((an === 'width' || an === 'height' || an === 'colspan' || an === 'rowspan') && /^\d{1,4}$/.test(av)) ok = av
      if (ok === null) removed++
      else attrs += ` ${an}="${escapeHtml(ok)}"`
    }
    if (name === 'a') attrs += ' rel="noopener noreferrer"'
    out += `<${name}${attrs}>`
    if (!VOID.has(name)) stack.push(name)
  }
  while (stack.length) out += `</${stack.pop()}>`
  return { out, removed }
}

const BAD_VALUE = /url\s*\(|expression|javascript|behaviou?r|binding|@import|\\|[<>{}]/i
const SEL_OK = /^[\w\s.#>+~:,*\-[\]="'^$|()]+$/

/** Фильтр CSS: только простые правила «селектор { свойство: значение }», каждый селектор получает префикс области блока. */
export function sanitizeCss(src: string, scope: string): Sanitized {
  let removed = 0
  const text = String(src).slice(0, 20000).replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: string[] = []
  for (const chunk of text.split('}')) {
    if (!chunk.trim()) continue
    const brace = chunk.indexOf('{')
    if (brace < 0) {
      removed++
      continue
    }
    const sel = chunk.slice(0, brace).trim()
    const body = chunk.slice(brace + 1)
    if (!sel || sel.includes('@') || !SEL_OK.test(sel) || /url\s*\(|expression|javascript/i.test(sel)) {
      removed++
      continue
    }
    const sels: string[] = []
    for (const part of sel.split(',')) {
      const p = part.trim()
      if (!p || /^(?::root|html|body)\b/i.test(p)) removed++
      else sels.push(`${scope} ${p}`)
    }
    const decls: string[] = []
    for (const d of body.split(';')) {
      if (!d.trim()) continue
      const c = d.indexOf(':')
      if (c < 0) {
        removed++
        continue
      }
      const prop = d.slice(0, c).trim().toLowerCase()
      const val = d.slice(c + 1).trim()
      if (!/^[a-z-]{2,40}$/.test(prop) || BAD_VALUE.test(val) || val.length > 200 || !val || (prop === 'position' && /fixed|sticky/i.test(val))) {
        removed++
        continue
      }
      decls.push(`${prop}:${val}`)
    }
    if (sels.length && decls.length) rules.push(`${sels.join(',')}{${decls.join(';')}}`)
  }
  return { out: rules.join('\n'), removed }
}

// ---------- текстовые свойства ----------

export interface Option {
  value: string
  label: string
}

/** «значение|подпись» построчно; без подписи подпись = значению. */
export function parseOptions(text: string | undefined): Option[] {
  const out: Option[] = []
  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (!line.trim()) continue
    const k = line.indexOf('|')
    const value = (k < 0 ? line : line.slice(0, k)).trim()
    const label = (k < 0 ? line : line.slice(k + 1)).trim()
    out.push({ value, label: label || value })
  }
  return out.slice(0, 100)
}

/** Строки таблицы: ячейки через «|». */
export function parseRows(text: string | undefined): string[][] {
  return String(text ?? '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .slice(0, 200)
    .map((l) => l.split('|').map((c) => c.trim()))
}

/** Имена переменных в шаблоне: {name}. */
export function templateVars(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)) if (!out.includes(m[1])) out.push(m[1])
  return out
}

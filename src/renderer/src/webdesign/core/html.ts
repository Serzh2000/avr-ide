// Генератор HTML-разметки. Весь пользовательский текст проходит через escapeHtml;
// динамические значения в рантайме пишутся через textContent (см. runtime.ts).
import { escapeHtml, fmt, has, isBlockId, isSafeImageSrc, num } from './escape'
import { sanitizeHtml, parseOptions, parseRows, safeHref, templateVars } from './sanitize'
import type { Block, BlockType, IconName, WdProject } from './types'

export const ICON_PATHS: Record<IconName, string> = {
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z',
  thermometer: 'M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z',
  droplet: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  fan: 'M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM12 11C10 6 11 3 14 3c3 0 2 5-2 8zM13 12c5-2 8-1 8 2 0 3-5 2-8-2zM12 13c2 5 1 8-2 8-3 0-2-5 2-8zM11 12C6 14 3 13 3 10c0-3 5-2 8 2z',
  power: 'M12 3v9M6.4 6.6a8 8 0 1 0 11.2 0',
  wifi: 'M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01',
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  gauge: 'M12 14l4-4M3.5 18a9.5 9.5 0 1 1 17 0',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  cloud: 'M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z'
}

export function iconSvg(name: IconName | undefined, size: number, cls: string): string {
  const d = name && has(ICON_PATHS, name) ? ICON_PATHS[name] : ''
  if (!d) return ''
  const s = fmt(num(size, 24, 8, 256))
  return `<svg class="wd-icon${cls ? ' ' + cls : ''}" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`
}

export interface HtmlOptions {
  /** Встроить CSS и JS в документ (одиночный файл). Иначе — ссылки style.css / app.js. */
  inline?: { css: string; js: string }
  /** Режим превью в редакторе: data-wd-id и data-wd-edit для выбора и правки блоков. */
  preview?: boolean
  /** Скрипт, вставляемый перед основным (мок WebSocket для превью). */
  beforeScript?: string
  /** Дополнительный скрипт после основного (мост превью ↔ редактор). */
  afterScript?: string
}

export const STATUS_TEXT: Record<'ru' | 'en', { online: string; offline: string; connecting: string }> = {
  ru: { online: 'Онлайн', offline: 'Нет связи', connecting: 'Подключение…' },
  en: { online: 'Online', offline: 'Offline', connecting: 'Connecting…' }
}

export function pageLang(p: WdProject): string {
  return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(p.page.lang) ? p.page.lang : 'ru'
}

export function textLang(p: WdProject): 'ru' | 'en' {
  return pageLang(p).toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

function multiline(s: string): string {
  return escapeHtml(s).replace(/\r?\n/g, '<br>')
}

function numAttr(name: string, v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? ` ${name}="${fmt(v)}"` : ''
}

/** Текст ячейки с {переменными}: до прихода данных вместо них «--». */
function cellText(t: string): string {
  return escapeHtml(t.replace(/\{[A-Za-z_][A-Za-z0-9_]*\}/g, '--'))
}

export const SITE_TEXT = {
  ru: {
    ssid: 'Сеть (SSID)', pass: 'Пароль', close: 'Закрыть', clear: 'Очистить', up: 'Вверх', down: 'Вниз', left: 'Влево', right: 'Вправо', stop: 'Стоп',
    otaWarn: 'Прошивка заменяется целиком. Не отключайте питание во время загрузки.', file: 'Файл прошивки (.bin)'
  },
  en: {
    ssid: 'Network (SSID)', pass: 'Password', close: 'Close', clear: 'Clear', up: 'Up', down: 'Down', left: 'Left', right: 'Right', stop: 'Stop',
    otaWarn: 'The firmware is replaced entirely. Do not power off during the upload.', file: 'Firmware file (.bin)'
  }
} as const

export function isValidOtaPath(p: string): boolean {
  return /^\/[A-Za-z0-9_./-]{1,40}$/.test(p) && !p.includes('..')
}

interface Ctx {
  preview: boolean
  lang: 'ru' | 'en'
  firstPage: string
  multi: boolean
}

function renderBlock(b: Block, ctx: Ctx, parent: Block | null, index: number): string {
  if (!isBlockId(b.id)) return ''
  const id = b.id
  const preview = ctx.preview
  const base = `id="b_${id}"${preview ? ` data-wd-id="${id}"` : ''}`
  const cls = (c: string): string => `class="${c} b-${id}"`
  const ed = (prop: string): string => (preview ? ` data-wd-edit="${prop}"` : '')
  const p = b.props
  const T = SITE_TEXT[ctx.lang]
  const label = escapeHtml(p.label ?? '')
  const kids = (): string => b.children.map((c, i) => renderBlock(c, ctx, b, i)).join('')
  switch (b.type) {
    case 'section':
      return `<section ${cls('wd-section')} ${base}><div class="wd-inner">${kids()}</div></section>`
    case 'grid':
      return `<div ${cls('wd-grid')} ${base}>${kids()}</div>`
    case 'flex':
      return `<div ${cls('wd-flex')} ${base}>${kids()}</div>`
    case 'card': {
      const title = p.label ? `<div class="wd-card-title"${ed('label')}>${label}</div>` : ''
      return `<div ${cls('wd-card')} ${base}>${title}${kids()}</div>`
    }
    case 'heading': {
      const lv = Math.round(num(p.level, 2, 1, 4))
      return `<h${lv} ${cls('wd-heading')} ${base}><span data-r="v"${ed('text')}>${multiline(p.text ?? '')}</span></h${lv}>`
    }
    case 'text':
      return `<p ${cls('wd-text')} ${base}><span data-r="v"${ed('text')}>${multiline(p.text ?? '')}</span></p>`
    case 'button':
      return `<button type="button" ${cls('wd-btn')} ${base}${ed('text')}>${escapeHtml(p.text ?? '')}</button>`
    case 'switch':
      return `<label ${cls('wd-switch')} ${base}><input type="checkbox" role="switch" data-r="i"><span class="wd-track"></span><span${ed('label')}>${label}</span></label>`
    case 'checkbox':
      return `<label ${cls('wd-cb')} ${base}><input type="checkbox" data-r="i"><span${ed('label')}>${label}</span></label>`
    case 'slider': {
      const min = num(p.min, 0)
      return `<label ${cls('wd-field')} ${base}><span class="wd-field-head"><span${ed('label')}>${label}</span><output data-r="v"></output></span><input class="wd-range" data-r="i" type="range" min="${fmt(min)}" max="${fmt(num(p.max, 100))}" step="${fmt(num(p.step, 1, 0.001))}" value="${fmt(min)}"></label>`
    }
    case 'input': {
      const isNum = p.inputType === 'number'
      const ph = p.placeholder ? ` placeholder="${escapeHtml(p.placeholder)}"` : ''
      const extra = isNum ? `${numAttr('min', p.min)}${numAttr('max', p.max)} step="${fmt(num(p.step, 1, 0.001))}" inputmode="decimal"` : ''
      return `<label ${cls('wd-field')} ${base}><span class="wd-label"${ed('label')}>${label}</span><input class="wd-input" data-r="i" type="${isNum ? 'number' : 'text'}"${ph}${extra ? ' ' + extra : ''}></label>`
    }
    case 'textarea': {
      const ph = p.placeholder ? ` placeholder="${escapeHtml(p.placeholder)}"` : ''
      return `<label ${cls('wd-field')} ${base}><span class="wd-label"${ed('label')}>${label}</span><textarea class="wd-input" data-r="i" rows="${Math.round(num(p.lines, 4, 1, 30))}"${ph}></textarea></label>`
    }
    case 'select': {
      const opts = parseOptions(p.options).map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('')
      return `<label ${cls('wd-field')} ${base}><span class="wd-label"${ed('label')}>${label}</span><select class="wd-input" data-r="i">${opts}</select></label>`
    }
    case 'radio': {
      const opts = parseOptions(p.options)
        .map((o) => `<label class="wd-opt"><input type="radio" name="r_${id}" value="${escapeHtml(o.value)}"><span>${escapeHtml(o.label)}</span></label>`)
        .join('')
      return `<fieldset ${cls('wd-field wd-radio')} ${base} data-r="i"><legend class="wd-label"${ed('label')}>${label}</legend>${opts}</fieldset>`
    }
    case 'color':
      return `<label ${cls('wd-field')} ${base}><span class="wd-label"${ed('label')}>${label}</span><input class="wd-color" data-r="i" type="color" value="#4f6df5"></label>`
    case 'sensor': {
      const icon = iconSvg(p.icon, 36, '')
      const unit = p.unit ? `<span class="wd-unit">${escapeHtml(p.unit)}</span>` : ''
      return `<div ${cls('wd-sensor')} ${base}>${icon}<div><div class="wd-label"${ed('label')}>${label}</div><div class="wd-sensor-val"><span data-r="v">--</span>${unit}</div></div></div>`
    }
    case 'indicator':
      return `<div ${cls('wd-indicator')} ${base} data-on="0"><span class="wd-dot"></span><span${ed('label')}>${label}</span><span class="wd-muted" data-r="t">${escapeHtml(p.offText ?? '')}</span></div>`
    case 'gauge':
      return `<div ${cls('wd-gauge')} ${base}><svg viewBox="0 0 120 80" role="img" aria-label="${escapeHtml(p.label ?? '')}"><path class="wd-g-bg" pathLength="100" d="M10 65A50 50 0 0 1 110 65"/><path class="wd-g-fg" data-r="fg" pathLength="100" d="M10 65A50 50 0 0 1 110 65"/><text class="wd-g-text" data-r="v" x="60" y="62" text-anchor="middle">--</text></svg><div class="wd-label"${ed('label')}>${label}</div></div>`
    case 'progress':
      return `<div ${cls('wd-field')} ${base}><div class="wd-field-head"><span${ed('label')}>${label}</span><output data-r="v">--</output></div><div class="wd-progress" role="progressbar" aria-valuemin="${fmt(num(p.min, 0))}" aria-valuemax="${fmt(num(p.max, 100))}" aria-valuenow="0" data-r="pb"><div class="wd-progress-bar" data-r="bar"></div></div></div>`
    case 'chart':
      return `<div ${cls('wd-field')} ${base}><div class="wd-field-head"><span${ed('label')}>${label}</span><output data-r="v">--</output></div><canvas class="wd-chart" data-r="c" role="img" aria-label="${escapeHtml(p.label ?? '')}"></canvas></div>`
    case 'log':
      return `<div ${cls('wd-field')} ${base}><div class="wd-field-head"><span${ed('label')}>${label}</span><button type="button" class="wd-clr" data-r="clr">${T.clear}</button></div><pre class="wd-log" data-r="l" role="log" aria-live="off"></pre></div>`
    case 'image':
      return p.src && isSafeImageSrc(p.src)
        ? `<img ${cls('wd-img')} ${base} src="${escapeHtml(p.src)}" alt="${escapeHtml(p.alt ?? '')}" loading="lazy">`
        : `<div ${cls('wd-img')} ${base} role="img" aria-label="${escapeHtml(p.alt ?? '')}"></div>`
    case 'icon':
      return iconSvg(p.icon, p.iconSize ?? 32, `b-${id}`).replace('<svg ', `<svg ${base} `)
    case 'divider':
      return `<hr ${cls('wd-divider')} ${base}>`
    case 'badge':
      return `<span ${cls(`wd-badge${p.soft ? ' soft' : ''}`)} ${base}><span data-r="v"${ed('text')}>${escapeHtml(p.text ?? '')}</span></span>`
    case 'link': {
      const text = escapeHtml(p.text ?? '')
      const variant = p.variant === 'button' ? 'wd-btn wd-linkbtn' : 'wd-link'
      if (p.page && ctx.multi) return `<a ${cls(variant)} ${base} href="#/${escapeHtml(p.page)}" data-wdp="${escapeHtml(p.page)}"${ed('text')}>${text}</a>`
      const href = safeHref(p.href ?? '') ?? '#'
      const ext = /^https?:/i.test(href)
      const tgt = p.newTab && ext ? ' target="_blank"' : ''
      return `<a ${cls(variant)} ${base} href="${escapeHtml(href)}"${tgt}${ext ? ' rel="noopener noreferrer"' : ''}${ed('text')}>${text}</a>`
    }
    case 'list': {
      const items = String(p.rows ?? '').split(/\r?\n/).filter((l) => l.trim() !== '')
      const lis = items.map((t, n) => `<li${templateVars(t).length ? ` data-c="${n}"` : ''}>${cellText(t)}</li>`).join('')
      return `<ul ${cls('wd-list')} ${base}>${lis}</ul>`
    }
    case 'table': {
      const rows = parseRows(p.rows)
      const cap = p.label ? `<caption class="wd-label"${ed('label')}>${label}</caption>` : ''
      const cell = (t: string, r: number, c: number, tag: string): string =>
        `<${tag}${templateVars(t).length ? ` data-c="${r}-${c}"` : ''}>${cellText(t)}</${tag}>`
      const head = rows.length ? `<thead><tr>${rows[0].map((t, c) => cell(t, 0, c, 'th')).join('')}</tr></thead>` : ''
      const body = rows.slice(1).map((r, i) => `<tr>${r.map((t, c) => cell(t, i + 1, c, 'td')).join('')}</tr>`).join('')
      return `<div ${cls('wd-tablewrap')} ${base}><table class="wd-table">${cap}${head}<tbody>${body}</tbody></table></div>`
    }
    case 'navbar': {
      const icon = iconSvg(p.icon, 22, '')
      const home = ctx.multi ? ` href="#/${escapeHtml(ctx.firstPage)}" data-wdp="${escapeHtml(ctx.firstPage)}"` : ' href="#"'
      const brand = p.brand || p.icon ? `<a class="wd-brand"${home}>${icon}<span${ed('brand')}>${escapeHtml(p.brand ?? '')}</span></a>` : ''
      return `<nav ${cls(`wd-navbar${p.sticky ? ' wd-sticky' : ''}`)} ${base}><div class="wd-nav-in">${brand}<div class="wd-nav-links">${kids()}</div></div></nav>`
    }
    case 'footer': {
      const t = p.text ? `<p${ed('text')}>${multiline(p.text)}</p>` : ''
      return `<footer ${cls('wd-footer')} ${base}><div class="wd-inner">${t}${kids()}</div></footer>`
    }
    case 'tabs': {
      const panels = b.children.filter((c) => c.type === 'panel')
      const list = panels
        .map((c, i) => `<button type="button" class="wd-tab" role="tab" data-r="t" data-i="${i}" aria-selected="${i === 0}">${escapeHtml(c.props.label ?? '')}</button>`)
        .join('')
      return `<div ${cls('wd-tabs')} ${base}><div class="wd-tablist" role="tablist">${list}</div>${kids()}</div>`
    }
    case 'accordion':
      return `<div ${cls('wd-acc')} ${base}>${kids()}</div>`
    case 'panel':
      if (parent?.type === 'accordion')
        return `<details ${cls('wd-acc-item')} ${base}${index === 0 ? ' open' : ''}><summary${ed('label')}>${label}</summary><div class="wd-panel-in">${kids()}</div></details>`
      return `<div ${cls('wd-panel')} ${base} role="tabpanel" data-i="${index}"${index === 0 ? '' : ' hidden'}>${kids()}</div>`
    case 'modal':
      return `<div ${cls('wd-modalwrap')} ${base}><button type="button" class="wd-btn" data-r="open"${ed('text')}>${escapeHtml(p.text ?? '')}</button><div class="wd-modal" data-r="m" hidden role="dialog" aria-modal="true" aria-label="${escapeHtml(p.label ?? '')}"><div class="wd-modal-box"><div class="wd-modal-head"><strong${ed('label')}>${label}</strong><button type="button" class="wd-x" data-r="close" aria-label="${T.close}">×</button></div><div class="wd-modal-body">${kids()}</div></div></div></div>`
    case 'pad': {
      const head = p.label ? `<span class="wd-label"${ed('label')}>${label}</span>` : ''
      if (p.padMode === 'joystick')
        return `<div ${cls('wd-field')} ${base}>${head}<div class="wd-joy" data-r="j" role="application" aria-label="${escapeHtml(p.label ?? '')}"><div class="wd-joy-knob" data-r="k"></div></div></div>`
      const btn = (d: string, g: string, t: string, area: string): string =>
        `<button type="button" class="wd-pb" data-d="${d}" aria-label="${t}" style="grid-area:${area}">${g}</button>`
      return `<div ${cls('wd-field')} ${base}>${head}<div class="wd-pad">${btn('up', '▲', T.up, '1/2')}${btn('left', '◀', T.left, '2/1')}${btn('center', '●', T.stop, '2/2')}${btn('right', '▶', T.right, '2/3')}${btn('down', '▼', T.down, '3/2')}</div></div>`
    }
    case 'clock':
      return `<div ${cls('wd-clock')} ${base}>${p.label ? `<div class="wd-label"${ed('label')}>${label}</div>` : ''}<div class="wd-clock-t" data-r="t">--:--</div><div class="wd-label" data-r="d"></div></div>`
    case 'custom':
      return `<div ${cls('wd-custom')} ${base}>${sanitizeHtml(p.html ?? '').out}</div>`
    case 'wifisetup':
      return `<form ${cls('wd-form')} ${base} novalidate><div class="wd-card-title"${ed('label')}>${label}</div><label class="wd-field"><span class="wd-label">${T.ssid}</span><input class="wd-input" data-r="s" maxlength="32" autocomplete="off"></label><label class="wd-field"><span class="wd-label">${T.pass}</span><input class="wd-input" data-r="p" type="password" maxlength="63" autocomplete="new-password"></label><button type="button" class="wd-btn" data-r="go"${ed('text')}>${escapeHtml(p.text ?? '')}</button><div class="wd-muted" data-r="msg" role="status"></div></form>`
    case 'ota':
      return `<form ${cls('wd-form')} ${base} novalidate><div class="wd-card-title"${ed('label')}>${label}</div><div class="wd-muted">${T.otaWarn}</div><label class="wd-field"><span class="wd-label">${T.file}</span><input class="wd-input" data-r="f" type="file" accept=".bin,.bin.gz,application/octet-stream"></label><div class="wd-progress"><div class="wd-progress-bar" data-r="bar"></div></div><button type="button" class="wd-btn" data-r="go"${ed('text')}>${escapeHtml(p.text ?? '')}</button><div class="wd-muted" data-r="msg" role="status"></div></form>`
  }
  return ''
}

/** Типы блоков, реально используемые на странице (для подключения только нужного CSS и JS). */
export function usedTypes(p: WdProject): Set<BlockType> {
  const s = new Set<BlockType>()
  const rec = (l: Block[]): void => {
    for (const b of l) {
      s.add(b.type)
      rec(b.children)
    }
  }
  rec(p.blocks)
  return s
}

export function generateHtml(p: WdProject, o: HtmlOptions = {}): string {
  const lang = pageLang(p)
  const tx = STATUS_TEXT[textLang(p)]
  const th = p.page.theme
  const fixedTheme = th.mode === 'dark' ? ' data-theme="dark"' : th.mode === 'light' ? ' data-theme="light"' : ''
  const desc = p.page.description ? `\n<meta name="description" content="${escapeHtml(p.page.description)}">` : ''
  const css = o.inline ? `<style>\n${o.inline.css.replace(/<\/style/gi, '<\\/style')}</style>` : '<link rel="stylesheet" href="style.css">'
  const before = o.beforeScript ? `<script>\n${o.beforeScript.replace(/<\/script/gi, '<\\/script')}</script>\n` : ''
  const main = o.inline
    ? `<script>\n${o.inline.js.replace(/<\/script/gi, '<\\/script')}</script>`
    : '<script src="app.js"></script>'
  const after = o.afterScript ? `\n<script>\n${o.afterScript.replace(/<\/script/gi, '<\\/script')}</script>` : ''
  const tools: string[] = []
  if (p.page.showStatus)
    tools.push(`<div class="wd-status" data-state="connecting" id="wd-status" role="status"><i></i><span>${tx.connecting}</span></div>`)
  if (th.toggle)
    tools.push(
      `<button type="button" class="wd-tbtn" id="wd-theme-toggle" aria-label="${textLang(p) === 'ru' ? 'Сменить тему' : 'Toggle theme'}">${iconSvg('moon', 20, '')}</button>`
    )
  const toolsHtml = tools.length ? `<div class="wd-tools">${tools.join('')}</div>\n` : ''
  const pages = p.pages?.length ? p.pages : [{ id: 'main', title: '' }]
  const ctx: Ctx = { preview: !!o.preview, lang: textLang(p), firstPage: pages[0].id, multi: pages.length > 1 }
  const roots = p.blocks
    .map((b, i) => {
      const html = renderBlock(b, ctx, null, i)
      if (!ctx.multi || !html) return html
      const pg = b.page === '*' || pages.some((x) => x.id === b.page) ? (b.page as string) : pages[0].id
      return `<div class="wd-pg" data-page="${escapeHtml(pg)}"${pg === pages[0].id || pg === '*' ? '' : ' hidden'}>${html}</div>`
    })
    .join('\n')
  return `<!DOCTYPE html>
<html lang="${lang}"${fixedTheme}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(p.page.title)}</title>${desc}
${css}
</head>
<body${tools.length ? ' class="wd-has-tools"' : ''}>
${toolsHtml}<main>
${roots}
</main>
${before}${main}${after}
</body>
</html>
`
}

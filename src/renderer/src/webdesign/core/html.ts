// Генератор HTML-разметки. Весь пользовательский текст проходит через escapeHtml;
// динамические значения в рантайме пишутся через textContent (см. runtime.ts).
import { escapeHtml, fmt, has, isBlockId, isSafeImageSrc, num } from './escape'
import type { Block, IconName, WdProject } from './types'

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
  /** Режим превью в редакторе: data-wd-id для выбора блоков. */
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

function renderBlock(b: Block, preview: boolean): string {
  if (!isBlockId(b.id)) return ''
  const id = b.id
  const base = `id="b_${id}"${preview ? ` data-wd-id="${id}"` : ''}`
  const cls = (c: string): string => `class="${c} b-${id}"`
  const p = b.props
  const label = escapeHtml(p.label ?? '')
  const kids = (): string => b.children.map((c) => renderBlock(c, preview)).join('')
  switch (b.type) {
    case 'section':
      return `<section ${cls('wd-section')} ${base}><div class="wd-inner">${kids()}</div></section>`
    case 'grid':
      return `<div ${cls('wd-grid')} ${base}>${kids()}</div>`
    case 'flex':
      return `<div ${cls('wd-flex')} ${base}>${kids()}</div>`
    case 'card': {
      const title = p.label ? `<div class="wd-card-title">${label}</div>` : ''
      return `<div ${cls('wd-card')} ${base}>${title}${kids()}</div>`
    }
    case 'heading': {
      const lv = Math.round(num(p.level, 2, 1, 4))
      return `<h${lv} ${cls('wd-heading')} ${base}><span data-r="v">${multiline(p.text ?? '')}</span></h${lv}>`
    }
    case 'text':
      return `<p ${cls('wd-text')} ${base}><span data-r="v">${multiline(p.text ?? '')}</span></p>`
    case 'button':
      return `<button type="button" ${cls('wd-btn')} ${base}>${escapeHtml(p.text ?? '')}</button>`
    case 'switch':
      return `<label ${cls('wd-switch')} ${base}><input type="checkbox" role="switch" data-r="i"><span class="wd-track"></span><span>${label}</span></label>`
    case 'slider': {
      const min = num(p.min, 0)
      return `<label ${cls('wd-field')} ${base}><span class="wd-field-head"><span>${label}</span><output data-r="v"></output></span><input class="wd-range" data-r="i" type="range" min="${fmt(min)}" max="${fmt(num(p.max, 100))}" step="${fmt(num(p.step, 1, 0.001))}" value="${fmt(min)}"></label>`
    }
    case 'input': {
      const isNum = p.inputType === 'number'
      const ph = p.placeholder ? ` placeholder="${escapeHtml(p.placeholder)}"` : ''
      const extra = isNum ? `${numAttr('min', p.min)}${numAttr('max', p.max)} step="${fmt(num(p.step, 1, 0.001))}" inputmode="decimal"` : ''
      return `<label ${cls('wd-field')} ${base}><span class="wd-label">${label}</span><input class="wd-input" data-r="i" type="${isNum ? 'number' : 'text'}"${ph}${extra ? ' ' + extra : ''}></label>`
    }
    case 'color':
      return `<label ${cls('wd-field')} ${base}><span class="wd-label">${label}</span><input class="wd-color" data-r="i" type="color" value="#4f6df5"></label>`
    case 'sensor': {
      const icon = iconSvg(p.icon, 36, '')
      const unit = p.unit ? `<span class="wd-unit">${escapeHtml(p.unit)}</span>` : ''
      return `<div ${cls('wd-sensor')} ${base}>${icon}<div><div class="wd-label">${label}</div><div class="wd-sensor-val"><span data-r="v">--</span>${unit}</div></div></div>`
    }
    case 'indicator':
      return `<div ${cls('wd-indicator')} ${base} data-on="0"><span class="wd-dot"></span><span>${label}</span><span class="wd-muted" data-r="t">${escapeHtml(p.offText ?? '')}</span></div>`
    case 'gauge':
      return `<div ${cls('wd-gauge')} ${base}><svg viewBox="0 0 120 80" role="img" aria-label="${escapeHtml(p.label ?? '')}"><path class="wd-g-bg" pathLength="100" d="M10 65A50 50 0 0 1 110 65"/><path class="wd-g-fg" data-r="fg" pathLength="100" d="M10 65A50 50 0 0 1 110 65"/><text class="wd-g-text" data-r="v" x="60" y="62" text-anchor="middle">--</text></svg><div class="wd-label">${label}</div></div>`
    case 'progress':
      return `<div ${cls('wd-field')} ${base}><div class="wd-field-head"><span>${label}</span><output data-r="v">--</output></div><div class="wd-progress" role="progressbar" aria-valuemin="${fmt(num(p.min, 0))}" aria-valuemax="${fmt(num(p.max, 100))}" aria-valuenow="0" data-r="pb"><div class="wd-progress-bar" data-r="bar"></div></div></div>`
    case 'chart':
      return `<div ${cls('wd-field')} ${base}><div class="wd-field-head"><span>${label}</span><output data-r="v">--</output></div><canvas class="wd-chart" data-r="c" role="img" aria-label="${escapeHtml(p.label ?? '')}"></canvas></div>`
    case 'image':
      return p.src && isSafeImageSrc(p.src)
        ? `<img ${cls('wd-img')} ${base} src="${escapeHtml(p.src)}" alt="${escapeHtml(p.alt ?? '')}" loading="lazy">`
        : `<div ${cls('wd-img')} ${base} role="img" aria-label="${escapeHtml(p.alt ?? '')}"></div>`
    case 'icon':
      return iconSvg(p.icon, p.iconSize ?? 32, `b-${id}`).replace('<svg ', `<svg ${base} `)
    case 'divider':
      return `<hr ${cls('wd-divider')} ${base}>`
  }
  return ''
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
  return `<!DOCTYPE html>
<html lang="${lang}"${fixedTheme}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(p.page.title)}</title>${desc}
${css}
</head>
<body>
${toolsHtml}<main>
${p.blocks.map((b) => renderBlock(b, !!o.preview)).join('\n')}
</main>
${before}${main}${after}
</body>
</html>
`
}

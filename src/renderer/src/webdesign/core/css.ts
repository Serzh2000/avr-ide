// Генератор CSS: тема (CSS-переменные, dark/light), базовые компоненты, стили блоков, адаптивность.
import { colorCss, fmt, has, literalColor, num } from './escape'
import type {
  AnimKey, Block, BlockStyle, BlockType, FontKey, Gradient, Palette, ResponsiveOverride, ShadowKey, Theme, WdProject
} from './types'
import { PALETTE_KEYS } from './types'
import { walk } from './factory'
import { sanitizeCss } from './sanitize'

export const FONT_STACKS: Record<FontKey, string> = {
  sans: 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
  serif: 'Georgia,Cambria,"Times New Roman",Times,serif',
  mono: 'ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace',
  rounded: 'ui-rounded,"SF Pro Rounded","Hiragino Maru Gothic ProN",Quicksand,"Segoe UI",system-ui,sans-serif'
}

const SHADOWS: Record<ShadowKey, string> = {
  none: 'none',
  sm: '0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.10)',
  md: '0 4px 8px -2px rgba(16,24,40,.10),0 2px 4px -2px rgba(16,24,40,.06)',
  lg: '0 16px 32px -8px rgba(16,24,40,.18),0 6px 12px -6px rgba(16,24,40,.10)'
}
const SHADOWS_DARK: Record<ShadowKey, string> = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,.4)',
  md: '0 4px 10px -2px rgba(0,0,0,.5)',
  lg: '0 18px 36px -8px rgba(0,0,0,.65)'
}

const KEYFRAMES: Record<Exclude<AnimKey, 'none'>, string> = {
  fade: '@keyframes wd-fade{from{opacity:0}to{opacity:1}}',
  'slide-up': '@keyframes wd-slide-up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}',
  zoom: '@keyframes wd-zoom{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}',
  pulse: '@keyframes wd-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}',
  float: '@keyframes wd-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}',
  glow: '@keyframes wd-glow{0%,100%{filter:drop-shadow(0 0 0 transparent)}50%{filter:drop-shadow(0 0 10px var(--wd-primary))}}'
}
const INFINITE: AnimKey[] = ['pulse', 'float', 'glow']

function paletteVars(p: Palette): string {
  const out: string[] = []
  for (const k of PALETTE_KEYS) out.push(`--wd-${k}:${literalColor(p[k]) ?? '#888888'}`)
  return out.join(';')
}

function px(n: number): string {
  return `${fmt(n)}px`
}

function gradientCss(g: Gradient | undefined): string | null {
  if (!g) return null
  const a = colorCss(g.from)
  const b = colorCss(g.to)
  if (!a || !b) return null
  return `linear-gradient(${fmt(num(g.angle, 135, 0, 360))}deg,${a},${b})`
}

/** Переопределения для тёмной темы. */
function darkDecls(s: BlockStyle): string[] {
  const d: string[] = []
  const g = gradientCss(s.darkGradient)
  const bg = colorCss(s.darkBg)
  if (g) d.push(`background:${g}`)
  else if (bg) d.push(`background:${bg}`)
  const c = colorCss(s.darkColor)
  if (c) d.push(`color:${c}`)
  return d
}

function shadowVar(k: ShadowKey | undefined): string | null {
  return k && has(SHADOWS, k) ? `var(--wd-shadow-${k})` : null
}

/** Объявления одного блока (без hover/адаптива). */
function blockDecls(s: BlockStyle): string[] {
  const d: string[] = []
  const g = gradientCss(s.gradient)
  const bg = colorCss(s.bg)
  if (g) d.push(`background:${g}`)
  else if (bg) d.push(`background:${bg}`)
  const c = colorCss(s.color)
  if (c) d.push(`color:${c}`)
  if (s.padding !== undefined) d.push(`padding:${px(num(s.padding, 0, 0, 200))}`)
  if (s.margin !== undefined) d.push(`margin:${px(num(s.margin, 0, 0, 200))}`)
  if (s.radius !== undefined) d.push(`border-radius:${px(num(s.radius, 0, 0, 999))}`)
  if (s.borderWidth !== undefined && num(s.borderWidth, 0, 0, 20) > 0) {
    const bc = colorCss(s.borderColor) ?? 'var(--wd-border)'
    d.push(`border:${px(num(s.borderWidth, 0, 0, 20))} solid ${bc}`)
  }
  const sh = shadowVar(s.shadow)
  if (sh) d.push(`box-shadow:${sh}`)
  if (s.font && has(FONT_STACKS, s.font)) d.push(`font-family:${FONT_STACKS[s.font]}`)
  if (s.size !== undefined) d.push(`font-size:${px(num(s.size, 16, 8, 96))}`)
  if (s.weight !== undefined) d.push(`font-weight:${Math.round(num(s.weight, 400, 100, 900))}`)
  if (s.align === 'left' || s.align === 'center' || s.align === 'right') d.push(`text-align:${s.align}`)
  if (s.widthPct !== undefined) d.push(`width:${fmt(num(s.widthPct, 100, 5, 100))}%`)
  if (s.maxWidth !== undefined) d.push(`max-width:${px(num(s.maxWidth, 1000, 20, 4000))}`)
  if (s.minHeight !== undefined) d.push(`min-height:${px(num(s.minHeight, 0, 0, 2000))}`)
  if (s.opacity !== undefined) d.push(`opacity:${fmt(num(s.opacity, 1, 0, 1))}`)
  if (s.span !== undefined && num(s.span, 1, 1, 12) > 1) d.push(`grid-column:span ${Math.round(num(s.span, 1, 1, 12))}`)
  if (s.transitionMs !== undefined) {
    const ms = Math.round(num(s.transitionMs, 180, 0, 5000))
    d.push(`transition:background-color ${ms}ms,color ${ms}ms,transform ${ms}ms,box-shadow ${ms}ms,opacity ${ms}ms,filter ${ms}ms`)
  }
  if (s.anim && s.anim !== 'none' && has(KEYFRAMES, s.anim)) {
    const ms = Math.round(num(s.animMs, INFINITE.includes(s.anim) ? 2400 : 600, 50, 20000))
    const delay = Math.round(num(s.animDelay, 0, 0, 20000))
    d.push(
      INFINITE.includes(s.anim)
        ? `animation:wd-${s.anim} ${ms}ms ease-in-out ${delay}ms infinite`
        : `animation:wd-${s.anim} ${ms}ms ease ${delay}ms backwards`
    )
  }
  return d
}

function hoverDecls(s: BlockStyle): string[] {
  const h = s.hover
  if (!h) return []
  const d: string[] = []
  const bg = colorCss(h.bg)
  if (bg) d.push(`background:${bg}`)
  const c = colorCss(h.color)
  if (c) d.push(`color:${c}`)
  const tf: string[] = []
  if (h.lift) tf.push('translateY(-3px)')
  if (h.scale !== undefined && h.scale !== 1) tf.push(`scale(${fmt(num(h.scale, 1, 0.5, 2))})`)
  if (tf.length) d.push(`transform:${tf.join(' ')}`)
  const sh = shadowVar(h.shadow)
  if (sh) d.push(`box-shadow:${sh}`)
  return d
}

function responsiveDecls(b: Block, r: ResponsiveOverride): string[] {
  const d: string[] = []
  if (r.hidden) return ['display:none!important']
  if (r.columns !== undefined && b.type === 'grid')
    d.push(`grid-template-columns:repeat(${Math.round(num(r.columns, 1, 1, 12))},minmax(0,1fr))`)
  if (r.direction === 'row' || r.direction === 'column') d.push(`flex-direction:${r.direction}`)
  if (r.padding !== undefined) d.push(`padding:${px(num(r.padding, 0, 0, 200))}`)
  if (r.size !== undefined) d.push(`font-size:${px(num(r.size, 16, 8, 96))}`)
  if (r.align === 'left' || r.align === 'center' || r.align === 'right') d.push(`text-align:${r.align}`)
  if (r.widthPct !== undefined) d.push(`width:${fmt(num(r.widthPct, 100, 5, 100))}%`)
  return d
}

const BASE_CSS = String.raw`*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
[hidden]{display:none!important}
body{margin:0;min-height:100vh;background:var(--wd-bg);color:var(--wd-text);font-family:var(--wd-font);font-size:var(--wd-base);line-height:1.55;-webkit-font-smoothing:antialiased}
h1,h2,h3,h4,p{margin:0}
h1{font-size:2.2em;line-height:1.15;letter-spacing:-.02em}
h2{font-size:1.65em;line-height:1.2;letter-spacing:-.01em}
h3{font-size:1.25em;line-height:1.3}
h4{font-size:1.05em;line-height:1.35}
hr.wd-divider{border:0;border-top:1px solid var(--wd-border);width:100%;margin:8px 0}
.wd-section{width:100%;padding:32px 20px}
.wd-inner{max-width:var(--wd-max);margin:0 auto;display:flex;flex-direction:column;gap:16px}
.wd-grid{display:grid;gap:16px;grid-template-columns:repeat(3,minmax(0,1fr))}
.wd-flex{display:flex;gap:12px}
.wd-card{display:flex;flex-direction:column;gap:12px;min-width:0}
.wd-card-title{display:flex;align-items:center;gap:8px;font-weight:600;font-size:1.05em}
.wd-muted{color:var(--wd-muted)}
.wd-label{color:var(--wd-muted);font-size:.9em}
.wd-btn{appearance:none;border:0;cursor:pointer;font:inherit;font-weight:600;padding:.7em 1.3em;border-radius:var(--wd-radius);background:var(--wd-primary);color:#fff;transition:transform .15s,box-shadow .15s,filter .15s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none}
.wd-btn:hover{filter:brightness(1.08)}
.wd-btn:active,.wd-btn[data-down="1"]{transform:translateY(1px) scale(.98);filter:brightness(.95)}
.wd-btn:focus-visible,.wd-input:focus-visible{outline:2px solid var(--wd-accent);outline-offset:2px}
.wd-switch{display:flex;align-items:center;gap:12px;cursor:pointer;user-select:none;position:relative}
.wd-switch input{position:absolute;opacity:0;width:1px;height:1px;margin:0}
.wd-track{width:50px;height:30px;border-radius:15px;background:var(--wd-border);position:relative;flex:none;transition:background .2s}
.wd-track::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .22s cubic-bezier(.4,.2,.2,1)}
.wd-switch input:checked+.wd-track{background:var(--wd-primary)}
.wd-switch input:checked+.wd-track::after{transform:translateX(20px)}
.wd-switch input:focus-visible+.wd-track{outline:2px solid var(--wd-accent);outline-offset:2px}
.wd-field{display:flex;flex-direction:column;gap:8px}
.wd-field-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:.9em;color:var(--wd-muted)}
.wd-field-head output{color:var(--wd-text);font-weight:600;font-variant-numeric:tabular-nums}
.wd-range{-webkit-appearance:none;appearance:none;width:100%;height:8px;margin:6px 0;border-radius:4px;outline:none;background:linear-gradient(to right,var(--wd-primary) var(--wd-fill,0%),var(--wd-border) var(--wd-fill,0%))}
.wd-range::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#fff;border:3px solid var(--wd-primary);box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:grab}
.wd-range::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid var(--wd-primary);box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:grab}
.wd-range:focus-visible{outline:2px solid var(--wd-accent);outline-offset:4px}
.wd-input{width:100%;font:inherit;color:var(--wd-text);background:var(--wd-bg);border:1px solid var(--wd-border);border-radius:calc(var(--wd-radius) * .7);padding:.6em .8em}
.wd-color{width:100%;height:46px;padding:3px;border:1px solid var(--wd-border);border-radius:calc(var(--wd-radius) * .7);background:var(--wd-bg);cursor:pointer}
.wd-sensor{display:flex;align-items:center;gap:14px}
.wd-sensor .wd-icon{flex:none;color:var(--wd-primary)}
.wd-sensor-val{font-size:2.1em;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.wd-unit{font-size:.45em;font-weight:500;color:var(--wd-muted);margin-left:.3em;letter-spacing:0}
.wd-indicator{display:flex;align-items:center;gap:10px}
.wd-dot{width:14px;height:14px;border-radius:50%;background:var(--wd-border);flex:none;transition:background .25s,box-shadow .25s}
.wd-indicator[data-on="1"] .wd-dot{background:var(--wd-success);box-shadow:0 0 0 4px color-mix(in srgb,var(--wd-success) 25%,transparent),0 0 12px var(--wd-success)}
.wd-gauge{text-align:center}
.wd-gauge svg{width:100%;max-width:240px;display:block;margin:0 auto}
.wd-g-bg,.wd-g-fg{fill:none;stroke-width:10;stroke-linecap:round}
.wd-g-bg{stroke:var(--wd-border)}
.wd-g-fg{stroke:var(--wd-primary);stroke-dasharray:100;stroke-dashoffset:100;transition:stroke-dashoffset .6s ease}
.wd-g-text{fill:var(--wd-text);font-size:19px;font-weight:700;font-variant-numeric:tabular-nums}
.wd-progress{height:12px;border-radius:6px;background:var(--wd-border);overflow:hidden}
.wd-progress-bar{height:100%;width:0;border-radius:6px;background:linear-gradient(90deg,var(--wd-primary),var(--wd-accent));transition:width .5s ease}
.wd-chart{width:100%;height:160px;display:block}
.wd-img{max-width:100%;height:auto;display:block}
.wd-icon{display:inline-block;vertical-align:middle;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.wd-tools{position:fixed;top:12px;right:12px;display:flex;gap:8px;align-items:center;z-index:50}
.wd-tbtn{appearance:none;cursor:pointer;width:38px;height:38px;border-radius:50%;border:1px solid var(--wd-border);background:var(--wd-surface);color:var(--wd-text);display:grid;place-items:center;box-shadow:var(--wd-shadow-sm)}
.wd-tbtn:hover{border-color:var(--wd-primary)}
.wd-tbtn:focus-visible{outline:2px solid var(--wd-accent);outline-offset:2px}
.wd-status{display:flex;align-items:center;gap:8px;padding:0 12px;height:38px;border-radius:19px;border:1px solid var(--wd-border);background:var(--wd-surface);font-size:.8em;color:var(--wd-muted);box-shadow:var(--wd-shadow-sm)}
.wd-status i{width:9px;height:9px;border-radius:50%;background:var(--wd-danger)}
.wd-status[data-state="online"] i{background:var(--wd-success)}
.wd-status[data-state="connecting"] i{background:var(--wd-warning)}
.wd-cb{display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none}
.wd-cb input{width:20px;height:20px;accent-color:var(--wd-primary);margin:0;cursor:pointer}
.wd-radio{border:0;padding:0;margin:0;min-width:0}
.wd-radio legend{padding:0;margin-bottom:6px}
.wd-opt{display:flex;align-items:center;gap:10px;padding:4px 0;cursor:pointer}
.wd-opt input{accent-color:var(--wd-primary);width:18px;height:18px;margin:0}
textarea.wd-input{resize:vertical;min-height:2.5em}
.wd-log{margin:0;padding:10px 12px;height:160px;overflow:auto;background:var(--wd-bg);border:1px solid var(--wd-border);border-radius:calc(var(--wd-radius) * .7);font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word}
.wd-clr{appearance:none;border:0;background:none;color:var(--wd-muted);font:inherit;font-size:.9em;cursor:pointer}
.wd-navbar{width:100%}
.wd-sticky{position:sticky;top:0;z-index:40}
.wd-nav-in{max-width:var(--wd-max);margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.wd-has-tools .wd-nav-in{padding-right:170px}
.wd-brand{display:flex;align-items:center;gap:8px;font-weight:700;color:inherit;text-decoration:none}
.wd-nav-links{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.wd-link{color:var(--wd-primary);text-decoration:none;padding:.35em .6em;border-radius:calc(var(--wd-radius) * .6);transition:background-color .15s}
.wd-link:hover{background:color-mix(in srgb,var(--wd-primary) 12%,transparent)}
.wd-linkbtn{display:inline-block;text-decoration:none;color:#fff}
.wd-footer{width:100%;color:var(--wd-muted)}
.wd-tablist{display:flex;gap:4px;border-bottom:1px solid var(--wd-border);margin-bottom:12px;overflow-x:auto}
.wd-tab{appearance:none;background:none;border:0;border-bottom:2px solid transparent;padding:.6em 1em;font:inherit;color:var(--wd-muted);cursor:pointer;white-space:nowrap}
.wd-tab[aria-selected="true"]{color:var(--wd-primary);border-bottom-color:var(--wd-primary);font-weight:600}
.wd-tab:hover{color:var(--wd-text)}
.wd-panel{display:flex;flex-direction:column;gap:12px}
.wd-acc{display:flex;flex-direction:column;gap:8px}
.wd-acc-item{border:1px solid var(--wd-border);border-radius:var(--wd-radius);background:var(--wd-surface);overflow:hidden}
.wd-acc-item summary{cursor:pointer;padding:.8em 1em;font-weight:600;list-style:none;display:flex;justify-content:space-between}
.wd-acc-item summary::after{content:"+";color:var(--wd-muted)}
.wd-acc-item[open] summary::after{content:"\2212"}
.wd-acc-item summary::-webkit-details-marker{display:none}
.wd-panel-in{padding:0 1em 1em;display:flex;flex-direction:column;gap:12px}
.wd-tablewrap{overflow-x:auto}
.wd-table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.wd-table caption{text-align:left;padding-bottom:6px}
.wd-table th,.wd-table td{text-align:left;padding:.6em .8em;border-bottom:1px solid var(--wd-border)}
.wd-table th{color:var(--wd-muted);font-weight:600;font-size:.85em}
.wd-list{margin:0;padding-left:1.3em;display:flex;flex-direction:column;gap:.3em}
.wd-badge{display:inline-flex;align-items:center;padding:.15em .7em;border-radius:999px;font-size:.8em;font-weight:600;background:var(--wd-primary);color:#fff;line-height:1.5}
.wd-badge.soft{background:color-mix(in srgb,var(--wd-primary) 16%,transparent);color:var(--wd-primary)}
.wd-modal{position:fixed;inset:0;z-index:100;display:grid;place-items:center;background:rgba(0,0,0,.5);padding:16px}
.wd-modal-box{background:var(--wd-surface);color:var(--wd-text);border-radius:var(--wd-radius);box-shadow:var(--wd-shadow-lg);width:min(520px,100%);max-height:90vh;overflow:auto;padding:20px;animation:wd-mz .2s ease}
@keyframes wd-mz{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:none}}
.wd-modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.wd-modal-body{display:flex;flex-direction:column;gap:12px}
.wd-x{appearance:none;border:0;background:none;font-size:1.6em;line-height:1;color:var(--wd-muted);cursor:pointer}
.wd-pad{display:grid;grid-template:repeat(3,56px)/repeat(3,56px);gap:6px;justify-content:center}
.wd-pb{appearance:none;border:1px solid var(--wd-border);border-radius:calc(var(--wd-radius) * .8);background:var(--wd-surface);color:var(--wd-text);font-size:1.2em;cursor:pointer;touch-action:none;user-select:none}
.wd-pb:active,.wd-pb[data-down="1"]{background:var(--wd-primary);color:#fff}
.wd-joy{width:160px;height:160px;border-radius:50%;background:var(--wd-surface);border:2px solid var(--wd-border);position:relative;margin:0 auto;touch-action:none}
.wd-joy-knob{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:var(--wd-primary);box-shadow:var(--wd-shadow-md)}
.wd-clock{text-align:center}
.wd-clock-t{font-size:2.4em;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.wd-custom{min-width:0}
.wd-form{display:flex;flex-direction:column;gap:12px}
.wd-pg{min-width:0}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}`


const ALL_FIELDS: BlockType[] = ['slider', 'input', 'textarea', 'select', 'radio', 'color', 'progress', 'chart', 'log', 'pad', 'wifisetup', 'ota']
/** Строки базового CSS, нужные только определённым блокам (остальные — всегда). Так страница для ESP8266 остаётся небольшой. */
const GATES: Array<[RegExp, BlockType[]]> = [
  [/^\.wd-(switch|track)/, ['switch']],
  [/^\.wd-(field|input)/, ALL_FIELDS],
  [/^textarea\.wd-input/, ['textarea']],
  [/^\.wd-range/, ['slider']],
  [/^\.wd-color/, ['color']],
  [/^\.wd-(sensor|unit)/, ['sensor']],
  [/^\.wd-(indicator|dot)/, ['indicator']],
  [/^\.wd-(gauge|g-)/, ['gauge']],
  [/^\.wd-progress/, ['progress', 'ota']],
  [/^\.wd-chart/, ['chart']],
  [/^\.wd-img/, ['image']],
  [/^hr\.wd-divider/, ['divider']],
  [/^\.wd-cb/, ['checkbox']],
  [/^\.wd-(radio|opt)/, ['radio']],
  [/^\.wd-(log|clr)/, ['log']],
  [/^\.wd-(navbar|sticky|nav-|has-tools \.wd-nav|brand)/, ['navbar']],
  [/^\.wd-(link|linkbtn)/, ['link', 'navbar']],
  [/^\.wd-footer/, ['footer']],
  [/^\.wd-(tablist|tab[\[:\{])/, ['tabs']],
  [/^\.wd-panel\{/, ['tabs']],
  [/^\.wd-(acc|panel-in)/, ['accordion']],
  [/^\.wd-(tablewrap|table)/, ['table']],
  [/^\.wd-list/, ['list']],
  [/^\.wd-badge/, ['badge']],
  [/^(\.wd-(modal|x)|@keyframes wd-mz)/, ['modal']],
  [/^\.wd-(pad|pb|joy)/, ['pad']],
  [/^\.wd-clock/, ['clock']],
  [/^\.wd-custom/, ['custom']],
  [/^\.wd-form/, ['wifisetup', 'ota']],
  [/^\.wd-pg/, []]
]

export function baseCss(used: Set<BlockType>, multiPage: boolean): string {
  const out: string[] = []
  for (const line of BASE_CSS.split('\n')) {
    const g = GATES.find(([re]) => re.test(line))
    if (!g) out.push(line)
    else if (g[0].source === '^\\.wd-pg' ? multiPage : g[1].some((t) => used.has(t))) out.push(line)
  }
  return out.join('\n')
}

function responsiveBase(theme: Theme, page: WdProject['page']): string {
  const t = Math.round(num(page.tablet, 900, 320, 2000))
  const m = Math.round(num(page.mobile, 600, 240, 1500))
  void theme
  return `@media (max-width:${t}px){.wd-section{padding:26px 16px}h1{font-size:1.9em}}
@media (max-width:${m}px){.wd-section{padding:20px 14px}h1{font-size:1.6em}h2{font-size:1.4em}.wd-status span{display:none}.wd-status{padding:0 12px}}`
}

function themeVars(theme: Theme, dark: boolean): string {
  const shadows = dark ? SHADOWS_DARK : SHADOWS
  return `${paletteVars(dark ? theme.dark : theme.light)};--wd-shadow-sm:${shadows.sm};--wd-shadow-md:${shadows.md};--wd-shadow-lg:${shadows.lg};color-scheme:${dark ? 'dark' : 'light'}`
}

/** Правила, действующие только в тёмной теме, в трёх вариантах включения (auto-media, data-theme). */
function darkScoped(mode: Theme['mode'], rules: (scope: string) => string): string {
  const explicit = rules(':root[data-theme="dark"]')
  if (mode !== 'auto') return explicit + '\n'
  return `@media (prefers-color-scheme:dark){${rules(':root:not([data-theme="light"])')}}\n${explicit}\n`
}

export function generateCss(p: WdProject): string {
  const th = p.page.theme
  const out: string[] = []
  const font = has(FONT_STACKS, th.font) ? FONT_STACKS[th.font] : FONT_STACKS.sans
  out.push(
    `:root{${themeVars(th, false)};--wd-font:${font};--wd-base:${fmt(num(th.baseSize, 16, 12, 24))}px;--wd-radius:${fmt(num(th.radius, 12, 0, 40))}px;--wd-max:${fmt(num(th.maxWidth, 1100, 320, 3000))}px}`
  )
  out.push(darkScoped(th.mode, (s) => `${s}{${themeVars(th, true)}}`).trimEnd())
  const usedTypes = new Set<BlockType>()
  walk(p.blocks, (b) => usedTypes.add(b.type))
  out.push(baseCss(usedTypes, (p.pages?.length ?? 1) > 1))

  // стили блоков
  const used = new Set<AnimKey>()
  const blocks: Block[] = []
  walk(p.blocks, (b) => blocks.push(b))
  const rules: string[] = []
  const darkRules: Array<{ id: string; d: string[] }> = []
  const tablet: string[] = []
  const mobile: string[] = []
  for (const b of blocks) {
    const sel = `.b-${b.id}`
    let d = blockDecls(b.style)
    if (b.style.gap !== undefined) {
      const gap = `gap:${px(num(b.style.gap, 0, 0, 200))}`
      if (b.type === 'section') rules.push(`${sel}>.wd-inner{${gap}}`)
      else d.push(gap)
    }
    if (b.type === 'grid') {
      const cols = Math.round(num(b.props.columns, 3, 1, 12))
      d.push(`grid-template-columns:repeat(${cols},minmax(0,1fr))`)
      tablet.push(`${sel}{grid-template-columns:repeat(${Math.min(cols, 2)},minmax(0,1fr))}`)
      mobile.push(`${sel}{grid-template-columns:minmax(0,1fr)}`)
    }
    if (b.type === 'flex') {
      d.push(`flex-direction:${b.props.direction === 'column' ? 'column' : 'row'}`)
      d.push(`flex-wrap:${b.props.wrap === false ? 'nowrap' : 'wrap'}`)
      const jm: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' }
      const am: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' }
      if (b.props.justify && jm[b.props.justify]) d.push(`justify-content:${jm[b.props.justify]}`)
      if (b.props.alignItems && am[b.props.alignItems]) d.push(`align-items:${am[b.props.alignItems]}`)
    }
    if (b.type === 'chart' && b.style.minHeight !== undefined) {
      rules.push(`${sel} canvas{height:${px(num(b.style.minHeight, 160, 40, 2000))}}`)
      d = d.filter((x) => !x.startsWith('min-height'))
    }
    if (d.length) rules.push(`${sel}{${d.join(';')}}`)
    if (b.type === 'custom' && b.props.css) {
      const sc = sanitizeCss(b.props.css, sel).out
      if (sc) rules.push(sc)
    }
    const h = hoverDecls(b.style)
    if (h.length) rules.push(`${sel}:hover{${h.join(';')}}`)
    const dd = darkDecls(b.style)
    if (dd.length) darkRules.push({ id: b.id, d: dd })
    if (b.style.anim && b.style.anim !== 'none') used.add(b.style.anim)
    const rt = b.responsive?.tablet ? responsiveDecls(b, b.responsive.tablet) : []
    if (rt.length) tablet.push(`${sel}{${rt.join(';')}}`)
    const rm = b.responsive?.mobile ? responsiveDecls(b, b.responsive.mobile) : []
    if (rm.length) mobile.push(`${sel}{${rm.join(';')}}`)
  }
  for (const k of Object.keys(KEYFRAMES) as Array<keyof typeof KEYFRAMES>) if (used.has(k)) out.push(KEYFRAMES[k])
  if (rules.length) out.push(rules.join('\n'))
  if (darkRules.length)
    out.push(
      darkScoped(th.mode, (s) => darkRules.map((r) => `${s} .b-${r.id}{${r.d.join(';')}}`).join('')).trimEnd()
    )
  out.push(responsiveBase(th, p.page))
  const t = Math.round(num(p.page.tablet, 900, 320, 2000))
  const m = Math.round(num(p.page.mobile, 600, 240, 1500))
  if (tablet.length) out.push(`@media (max-width:${t}px){${tablet.join('')}}`)
  if (mobile.length) out.push(`@media (max-width:${m}px){${mobile.join('')}}`)
  return out.join('\n') + '\n'
}

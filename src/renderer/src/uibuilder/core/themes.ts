// Темы оформления: пресет + переопределения → CSS для ESPUI.setCustomCSS().
// Селекторы взяты из dataStyleCSS.h / dataControlsJS.h (см. API_NOTES.md п.5). Порядок подключения custom.css не проверен,
// поэтому селекторы получают префикс «body » (выше специфичность), а не !important.
import { styleValueProblem } from './css'
import type { StyleKind } from './css'
import type { EspuiColor, ThemeVars, UiTheme } from './types'

export interface ThemePreset {
  id: string
  title: string
  description: string
  vars: ThemeVars
}

type Col = Exclude<EspuiColor, 'None'>
const COLOR_KEYS: Col[] = ['Turquoise', 'Emerald', 'Peterriver', 'Wetasphalt', 'Sunflower', 'Carrot', 'Alizarin', 'Dark']
const COLOR_CLASS_NAME: Record<Col, string> = {
  Turquoise: 'turquoise',
  Emerald: 'emerald',
  Peterriver: 'peterriver',
  Wetasphalt: 'wetasphalt',
  Sunflower: 'sunflower',
  Carrot: 'carrot',
  Alizarin: 'alizarin',
  Dark: 'dark'
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'default', title: 'ESPUI по умолчанию', description: 'Родная тема библиотеки, CSS не добавляется', vars: {} },
  {
    id: 'dark',
    title: 'Тёмная',
    description: 'Тёмный фон, приглушённые цвета панелей, мягкие тени',
    vars: {
      pageBg: '#121417',
      pageText: '#e6e9ee',
      fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
      cardRadius: '12px',
      cardShadow: '0 4px 14px rgba(0,0,0,.45)',
      cardText: '#f5f7fa',
      buttonRadius: '8px',
      headerColor: '#ffffff',
      accent: '#3794ff',
      colors: {
        Turquoise: '#138d75',
        Emerald: '#1e8449',
        Peterriver: '#2471a3',
        Wetasphalt: '#2c3e50',
        Sunflower: '#b7950b',
        Carrot: '#ca6f1e',
        Alizarin: '#b03a2e',
        Dark: '#2b2f3a'
      }
    }
  },
  {
    id: 'light',
    title: 'Светлая',
    description: 'Светлый фон, аккуратные скругления',
    vars: {
      pageBg: '#f4f6f8',
      pageText: '#1d2733',
      fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
      cardRadius: '10px',
      cardShadow: '0 2px 8px rgba(20,30,50,.15)',
      buttonRadius: '6px',
      headerColor: '#1d2733',
      accent: '#2f80ed'
    }
  },
  {
    id: 'neon',
    title: 'Тёмная',
    description: 'Тёмный фон, спокойные цвета панелей',
    vars: {
      pageBg: '#14161c',
      pageText: '#e4e7ee',
      fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
      cardRadius: '10px',
      cardShadow: '0 1px 2px rgba(0,0,0,.4)',
      cardText: '#ffffff',
      buttonRadius: '6px',
      headerColor: '#e4e7ee',
      accent: '#818cf8',
      colors: {
        Turquoise: '#2a9d8f',
        Emerald: '#3f9b5f',
        Peterriver: '#4f6fd6',
        Wetasphalt: '#3a4252',
        Sunflower: '#b8912a',
        Carrot: '#c4703a',
        Alizarin: '#c2474f',
        Dark: '#262a33'
      }
    }
  },
  {
    id: 'minimal',
    title: 'Минимал',
    description: 'Белый фон, плоские светлые панели без теней',
    vars: {
      pageBg: '#ffffff',
      pageText: '#222222',
      fontFamily: 'Helvetica, Arial, sans-serif',
      cardRadius: '0px',
      cardShadow: 'none',
      cardText: '#111111',
      buttonRadius: '0px',
      headerColor: '#111111',
      accent: '#222222',
      colors: {
        Turquoise: '#e0f2f1',
        Emerald: '#e8f5e9',
        Peterriver: '#e3f2fd',
        Wetasphalt: '#eceff1',
        Sunflower: '#fffde7',
        Carrot: '#fff3e0',
        Alizarin: '#ffebee',
        Dark: '#cfd8dc'
      }
    }
  },
  {
    id: 'warm',
    title: 'Тёплая',
    description: 'Кремовый фон и мягкие тёплые панели',
    vars: {
      pageBg: '#fbf3e9',
      pageText: '#4a3b2a',
      fontFamily: 'Georgia, Times New Roman, serif',
      cardRadius: '16px',
      cardShadow: '0 3px 10px rgba(120,80,30,.25)',
      buttonRadius: '12px',
      headerColor: '#6b4a1f',
      accent: '#c0733a',
      colors: {
        Turquoise: '#5f9e8f',
        Emerald: '#7aa35c',
        Peterriver: '#6f93b5',
        Wetasphalt: '#7b6a5a',
        Sunflower: '#d9a441',
        Carrot: '#d4763b',
        Alizarin: '#c0564b',
        Dark: '#5a4a3a'
      }
    }
  }
]

export function findPreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id)
}

export function defaultTheme(): UiTheme {
  return { preset: 'default', vars: {} }
}

/** Пресет + переопределения. Неизвестный пресет считается default. */
export function resolveTheme(theme: UiTheme | undefined): ThemeVars {
  const base = findPreset(theme?.preset ?? 'default')?.vars ?? {}
  const over = theme?.vars ?? {}
  const out: ThemeVars = { ...base }
  for (const k of Object.keys(over) as Array<keyof ThemeVars>) {
    const v = over[k]
    if (k === 'colors') continue
    if (typeof v === 'string' && v.trim() !== '') (out as Record<string, unknown>)[k] = v.trim()
  }
  if (base.colors || over.colors) out.colors = { ...(base.colors ?? {}), ...(over.colors ?? {}) }
  return out
}

const VAR_KIND: Record<string, StyleKind> = {
  pageBg: 'color',
  pageText: 'color',
  cardText: 'color',
  headerColor: 'color',
  accent: 'color',
  fontFamily: 'font',
  cardRadius: 'lengths',
  buttonRadius: 'lengths',
  cardShadow: 'shadow'
}

export const THEME_VAR_FIELDS: Array<{ key: Exclude<keyof ThemeVars, 'colors'>; title: string; kind: StyleKind; hint: string }> = [
  { key: 'pageBg', title: 'Фон страницы', kind: 'color', hint: '#121417' },
  { key: 'pageText', title: 'Цвет текста', kind: 'color', hint: '#e6e9ee' },
  { key: 'headerColor', title: 'Цвет заголовка', kind: 'color', hint: '#ffffff' },
  { key: 'fontFamily', title: 'Шрифт', kind: 'font', hint: 'Segoe UI, Arial, sans-serif' },
  { key: 'cardRadius', title: 'Скругление панелей', kind: 'lengths', hint: '12px' },
  { key: 'cardShadow', title: 'Тень панелей', kind: 'shadow', hint: '0 4px 14px rgba(0,0,0,.4)' },
  { key: 'cardText', title: 'Текст на панелях', kind: 'color', hint: '#ffffff' },
  { key: 'buttonRadius', title: 'Скругление кнопок', kind: 'lengths', hint: '8px' },
  { key: 'accent', title: 'Акцент', kind: 'color', hint: '#3794ff' }
]

/** Проблемы значений темы (пресет + переопределения). */
export function themeProblems(theme: UiTheme | undefined): string[] {
  const out: string[] = []
  if (!theme) return out
  if (!findPreset(theme.preset)) out.push(`неизвестный пресет темы «${String(theme.preset)}»`)
  const over = theme.vars ?? {}
  for (const k of Object.keys(over)) {
    if (k === 'colors') {
      const cs = over.colors ?? {}
      for (const ck of Object.keys(cs)) {
        if (!COLOR_KEYS.includes(ck as Col)) out.push(`тема: неизвестный цвет «${ck}»`)
        else {
          const p = styleValueProblem('color', String(cs[ck as Col] ?? ''))
          if (p) out.push(`тема, цвет ${ck}: ${p}`)
        }
      }
      continue
    }
    const kind = VAR_KIND[k]
    if (!kind) {
      out.push(`тема: неизвестный параметр «${k}»`)
      continue
    }
    const val = (over as Record<string, unknown>)[k]
    if (typeof val !== 'string') out.push(`тема, ${k}: значение должно быть строкой`)
    else {
      const p = styleValueProblem(kind, val)
      if (p) out.push(`тема, ${k}: ${p}`)
    }
  }
  return out
}

function ok(kind: StyleKind, v: string | undefined): string | undefined {
  if (v === undefined) return undefined
  const t = v.trim().replace(/\s+/g, ' ')
  return t !== '' && !styleValueProblem(kind, t) ? t : undefined
}

/** Строки CSS темы (по одному правилу). Пусто для 'default' без переопределений. Некорректные значения пропускаются. */
export function themeCssRules(theme: UiTheme | undefined): string[] {
  const v = resolveTheme(theme)
  const rules: string[] = []
  const body = [
    ['background-color', ok('color', v.pageBg)],
    ['color', ok('color', v.pageText)],
    ['font-family', ok('font', v.fontFamily)]
  ] as const
  const decl = (list: ReadonlyArray<readonly [string, string | undefined]>): string =>
    list.filter(([, x]) => x !== undefined).map(([p, x]) => `${p}:${x}`).join(';')
  const b = decl(body)
  if (b) rules.push(`html body{${b}}`)
  const hc = ok('color', v.headerColor)
  if (hc) rules.push(`body #mainHeader{color:${hc}}`)
  const card = decl([
    ['border-radius', ok('lengths', v.cardRadius)],
    ['box-shadow', ok('shadow', v.cardShadow)],
    ['color', ok('color', v.cardText)]
  ])
  if (card) rules.push(`body .card{${card}}`)
  const br = ok('lengths', v.buttonRadius)
  if (br) rules.push(`body button{border-radius:${br}}`)
  const ac = ok('color', v.accent)
  if (ac) {
    rules.push(`body ul.navigation{border-bottom-color:${ac}}`)
    rules.push(`body ul.navigation li.active a{background:${ac}}`)
    rules.push(`body .switch.checked{background-color:${ac}}`)
  }
  for (const c of COLOR_KEYS) {
    const col = ok('color', v.colors?.[c])
    if (col) rules.push(`body .${COLOR_CLASS_NAME[c]}{background-color:${col}}`)
  }
  return rules
}

/** Весь CSS темы одной строкой (для оценки размера и превью). */
export function themeCss(theme: UiTheme | undefined): string {
  return themeCssRules(theme).join('')
}

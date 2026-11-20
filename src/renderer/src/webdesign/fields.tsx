import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { create } from 'zustand'
import { PALETTE_KEYS, isColor, isPaletteKey } from './core/index'
import { useWebDesigner } from './store'
import { Select as KitSelect } from '../shell/kit'

// ---------- раскрытость групп (запоминается) ----------
const ACC_KEY = 'avride.webdesign.acc.v1'
interface AccState {
  open: Record<string, boolean>
  toggle: (id: string, def: boolean) => void
  set: (id: string, v: boolean) => void
}
function loadAcc(): Record<string, boolean> {
  try {
    const r = JSON.parse(localStorage.getItem(ACC_KEY) ?? '{}') as unknown
    return r && typeof r === 'object' ? (r as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}
export const useAcc = create<AccState>((set, get) => ({
  open: loadAcc(),
  toggle: (id, def) => get().set(id, !(get().open[id] ?? def)),
  set: (id, v) => {
    const open = { ...get().open, [id]: v }
    set({ open })
    try {
      localStorage.setItem(ACC_KEY, JSON.stringify(open))
    } catch {
      /* не критично */
    }
  }
}))

/** Группа-«аккордеон»: заголовок сворачивает содержимое, состояние запоминается. */
export function Group({ id, title, def = true, children, hint }: { id: string; title: string; def?: boolean; children: ReactNode; hint?: string }): ReactNode {
  const open = useAcc((s) => s.open[id] ?? def)
  const toggle = useAcc.getState().toggle
  return (
    <div className="wd-grp">
      <button className="wd-grp-h" aria-expanded={open} onClick={() => toggle(id, def)} title={hint}>
        <span className="wd-grp-ar">{open ? '▾' : '▸'}</span> {title}
      </button>
      {open && <div className="wd-grp-b">{children}</div>}
    </div>
  )
}

/** Строка свойства. fid — идентификатор для поиска по свойствам (подсветка и прокрутка). */
export function Row({ title, children, hint, fid }: { title: string; children: ReactNode; hint?: string; fid?: string }): ReactNode {
  const hl = useWebDesigner((s) => s.highlight)
  const on = !!fid && hl?.fid === fid
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (on) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [on, hl?.n])
  return (
    <div ref={ref} className={`wd-row${on ? ' hl' : ''}`} title={hint} data-fid={fid}>
      <div className="wd-row-title">
        {title}
        {hint && <span className="wd-q" aria-hidden="true">?</span>}
      </div>
      <div className="wd-row-body">{children}</div>
    </div>
  )
}

/** Компактная пара полей в одной строке. */
export function Pair({ children }: { children: ReactNode }): ReactNode {
  return <div className="wd-pair">{children}</div>
}

/** Поле с подписью сверху (для пар). */
export function Mini({ title, hint, fid, children }: { title: string; hint?: string; fid?: string; children: ReactNode }): ReactNode {
  const hl = useWebDesigner((s) => s.highlight)
  const on = !!fid && hl?.fid === fid
  const ref = useRef<HTMLLabelElement>(null)
  useEffect(() => {
    if (on) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [on, hl?.n])
  return (
    <label ref={ref} className={`wd-mini-f${on ? ' hl' : ''}`} title={hint} data-fid={fid}>
      <span className="wd-row-title">{title}</span>
      {children}
    </label>
  )
}

export function TextField({ value, onChange, placeholder, mono, multiline, rows }: {
  value: string | undefined
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
  multiline?: boolean
  rows?: number
}): ReactNode {
  const cls = `wd-input${mono ? ' mono' : ''}`
  if (multiline)
    return <textarea className={cls} rows={rows ?? 3} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  return <input className={cls} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

/** Число со стрелками и единицей; пустое поле => undefined (если optional). */
export function NumField({ value, onChange, min, max, step, optional, unit, placeholder }: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  min?: number
  max?: number
  step?: number
  optional?: boolean
  unit?: string
  placeholder?: string
}): ReactNode {
  return (
    <div className="wd-num">
      <input
        className="wd-input"
        type="number"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => {
          const t = e.target.value
          if (t === '') onChange(optional ? undefined : 0)
          else if (Number.isFinite(Number(t))) onChange(Number(t))
        }}
      />
      {unit && <span className="wd-unit">{unit}</span>}
    </div>
  )
}

/** Сегментный переключатель. allowClear: повторный клик по активному сбрасывает значение. */
export function Seg<T extends string>({ value, options, onChange, allowClear }: {
  value: T | undefined
  options: Array<{ value: T; label: string; title?: string }>
  onChange: (v: T | undefined) => void
  allowClear?: boolean
}): ReactNode {
  return (
    <div className="wd-segs wd-segs-f" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`wd-seg${value === o.value ? ' on' : ''}`}
          title={o.title ?? o.label}
          aria-pressed={value === o.value}
          onClick={() => onChange(allowClear && value === o.value ? undefined : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Select<T extends string>({ value, options, onChange }: {
  value: T | undefined
  options: Array<{ value: T | ''; label: string }>
  onChange: (v: T | undefined) => void
}): ReactNode {
  return (
    <KitSelect className="wd-input" value={value ?? ''} onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </KitSelect>
  )
}

export function Check({ value, onChange, label }: { value: boolean | undefined; onChange: (v: boolean) => void; label?: string }): ReactNode {
  return (
    <label className="wd-check">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

const TOKEN_LABELS: Record<string, string> = {
  bg: 'Фон страницы', surface: 'Поверхность', text: 'Текст', muted: 'Приглушённый', primary: 'Основной',
  accent: 'Акцент', success: 'Успех', warning: 'Предупреждение', danger: 'Опасность', border: 'Граница'
}

/** Цвет: пипетка-палитра темы (токены), «нет» и свой цвет. */
export function ColorField({ value, onChange }: { value: string | undefined; onChange: (v: string | undefined) => void }): ReactNode {
  const theme = useWebDesigner((s) => s.project.page.theme)
  const custom = value !== undefined && !isPaletteKey(value)
  const hex = value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#4f6df5'
  return (
    <div className="wd-clr">
      <button type="button" className={`wd-sw none${value === undefined ? ' on' : ''}`} title="Не задан (по умолчанию)" aria-pressed={value === undefined} onClick={() => onChange(undefined)}>⌀</button>
      {PALETTE_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          className={`wd-sw${value === k ? ' on' : ''}`}
          style={{ background: theme.light[k] }}
          title={`${TOKEN_LABELS[k]} (${k}) — следует теме`}
          aria-pressed={value === k}
          onClick={() => onChange(k)}
        />
      ))}
      <label className={`wd-sw pick${custom ? ' on' : ''}`} title="Свой цвет" style={custom ? { background: hex } : undefined}>
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} />
        {!custom && '+'}
      </label>
      {custom && (
        <input className={`wd-input mono wd-hex${isColor(value) ? '' : ' bad'}`} value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      )}
    </div>
  )
}

/** Цвет только литералом (палитра темы). */
export function HexField({ value, onChange }: { value: string; onChange: (v: string) => void }): ReactNode {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#888888'
  return (
    <div className="wd-color-field">
      <input type="color" className="wd-swatch" value={hex} onChange={(e) => onChange(e.target.value)} />
      <input className={`wd-input mono${isColor(value) ? '' : ' bad'}`} value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <div className="wd-sec">
      <div className="wd-h">{title}</div>
      {children}
    </div>
  )
}

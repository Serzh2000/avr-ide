import type { ReactNode } from 'react'
import { PALETTE_KEYS, isColor, isPaletteKey } from './core/index'

export function Row({ title, children, hint }: { title: string; children: ReactNode; hint?: string }): ReactNode {
  return (
    <div className="wd-row" title={hint}>
      <div className="wd-row-title">{title}</div>
      <div className="wd-row-body">{children}</div>
    </div>
  )
}

export function TextField({ value, onChange, placeholder, mono, multiline }: {
  value: string | undefined
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
  multiline?: boolean
}): ReactNode {
  const cls = `wd-input${mono ? ' mono' : ''}`
  if (multiline)
    return <textarea className={cls} rows={3} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  return <input className={cls} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

/** Число; пустое поле => undefined (сбросить значение). */
export function NumField({ value, onChange, min, max, step, optional }: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  min?: number
  max?: number
  step?: number
  optional?: boolean
}): ReactNode {
  return (
    <input
      className="wd-input"
      type="number"
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const t = e.target.value
        if (t === '') onChange(optional ? undefined : 0)
        else if (Number.isFinite(Number(t))) onChange(Number(t))
      }}
    />
  )
}

export function Select<T extends string>({ value, options, onChange }: {
  value: T | undefined
  options: Array<{ value: T | ''; label: string }>
  onChange: (v: T | undefined) => void
}): ReactNode {
  return (
    <select className="wd-input" value={value ?? ''} onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
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

/** Цвет: токен палитры темы, свой цвет (#hex) или не задан. */
export function ColorField({ value, onChange }: { value: string | undefined; onChange: (v: string | undefined) => void }): ReactNode {
  const custom = value !== undefined && !isPaletteKey(value)
  const hex = value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#4f6df5'
  return (
    <div className="wd-color-field">
      <select
        className="wd-input"
        value={value === undefined ? '' : custom ? '__custom' : value}
        onChange={(e) => {
          const v = e.target.value
          onChange(v === '' ? undefined : v === '__custom' ? hex : v)
        }}
      >
        <option value="">— по умолчанию —</option>
        {PALETTE_KEYS.map((k) => (
          <option key={k} value={k}>
            {TOKEN_LABELS[k]}
          </option>
        ))}
        <option value="__custom">Свой цвет…</option>
      </select>
      {custom && (
        <>
          <input type="color" className="wd-swatch" value={hex} onChange={(e) => onChange(e.target.value)} />
          <input
            className={`wd-input mono${isColor(value) ? '' : ' bad'}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
          />
        </>
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

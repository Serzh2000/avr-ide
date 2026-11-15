import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './icons'

export interface PickerItem {
  id: string
  title: string
  /** Вторая строка: «float · строка 12». */
  detail?: string
  group: string
  /** Недоступный вариант с объяснением причины. */
  disabled?: boolean
  reason?: string
  /** Выделить как действие («Создать новую…»). */
  action?: boolean
  /** Значок слева (имя иконки). */
  icon?: string
}

/** Выпадающий список с поиском и группами. Открывается во «всплывающем» блоке (position: fixed), поэтому не обрезается прокруткой панели. */
export function Picker({
  items,
  value,
  placeholder,
  onPick,
  emptyText,
  invalid,
  describeValue,
  id
}: {
  items: PickerItem[]
  value: string | null
  placeholder: string
  onPick: (item: PickerItem) => void
  emptyText?: string
  invalid?: boolean
  /** Подпись выбранного значения, если его нет в списке (например, переменная исчезла). */
  describeValue?: (v: string) => ReactNode
  id?: string
}): ReactNode {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0, width: 280, up: false, max: 320 })

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return items.filter((i) => !s || `${i.title} ${i.detail ?? ''} ${i.group}`.toLowerCase().includes(s))
  }, [items, q])
  const selectable = shown.filter((i) => !i.disabled)

  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom - 12
    const spaceAbove = r.top - 12
    const up = spaceBelow < 220 && spaceAbove > spaceBelow
    const max = Math.max(160, Math.min(380, up ? spaceAbove : spaceBelow))
    setPos({ left: r.left, top: up ? r.top - 4 : r.bottom + 4, width: Math.max(r.width, 300), up, max })
  }, [open, shown.length])

  useEffect(() => {
    if (!open) return
    setQ('')
    setHi(0)
    setTimeout(() => search.current?.focus(), 0)
    const close = (e: Event): void => {
      if (pop.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('resize', () => setOpen(false))
    return () => window.removeEventListener('pointerdown', close, true)
  }, [open])

  useEffect(() => {
    pop.current?.querySelector('[data-hi="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [hi, open])

  const pick = (it: PickerItem): void => {
    if (it.disabled) return
    setOpen(false)
    onPick(it)
    btn.current?.focus()
  }

  const cur = value ? items.find((i) => i.id === value) : undefined
  let groupShown = ''
  return (
    <>
      <button
        ref={btn}
        id={id}
        type="button"
        className={`uib-picker${invalid ? ' invalid' : ''}${value ? '' : ' empty'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span className="uib-picker-value">
          {cur ? (
            <>
              <b>{cur.title}</b>
              {cur.detail && <em>{cur.detail}</em>}
            </>
          ) : value ? (
            describeValue ? describeValue(value) : <b>{value}</b>
          ) : (
            placeholder
          )}
        </span>
        <Icon name="chevron" size={14} />
      </button>
      {open && (
        <div
          ref={pop}
          className="uib-popover"
          role="listbox"
          style={{ left: pos.left, width: pos.width, maxHeight: pos.max, ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              setOpen(false)
              btn.current?.focus()
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setHi((h) => Math.min(selectable.length - 1, h + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHi((h) => Math.max(0, h - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              const it = selectable[hi]
              if (it) pick(it)
            }
          }}
        >
          <label className="uib-popover-search">
            <Icon name="search" size={14} />
            <input ref={search} value={q} onChange={(e) => { setQ(e.target.value); setHi(0) }} placeholder="Поиск…" aria-label="Поиск" />
          </label>
          <div className="uib-popover-list">
            {shown.length === 0 && <div className="uib-popover-empty">{emptyText ?? 'Ничего не найдено'}</div>}
            {shown.map((it) => {
              const head = it.group !== groupShown ? it.group : null
              groupShown = it.group
              const sel = !it.disabled && selectable[hi]?.id === it.id
              return (
                <div key={it.id}>
                  {head && <div className="uib-popover-group">{head}</div>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={it.id === value}
                    aria-disabled={it.disabled}
                    data-hi={sel}
                    className={`uib-opt-item${it.disabled ? ' disabled' : ''}${sel ? ' hi' : ''}${it.id === value ? ' current' : ''}${it.action ? ' action' : ''}`}
                    title={it.reason}
                    onMouseMove={() => !it.disabled && setHi(selectable.findIndex((s) => s.id === it.id))}
                    onClick={() => pick(it)}
                  >
                    {it.icon && <Icon name={it.icon} size={14} />}
                    <span className="uib-opt-main">
                      <b>{it.title}</b>
                      {it.detail && <em>{it.detail}</em>}
                      {it.disabled && it.reason && <small>{it.reason}</small>}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

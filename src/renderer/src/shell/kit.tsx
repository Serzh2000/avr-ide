// Общие элементы интерфейса: диалоги, контекстное меню, всплывающие окна, разделители.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode, PointerEvent as RPointerEvent } from 'react'
import { useDialogs } from './dialogs'
import { Icon } from './icons'
import type { IconName } from './icons'

/** Диалоги подтверждения и ввода (рисуются поверх всего). */
export function DialogHost(): ReactNode {
  const cur = useDialogs((s) => s.current)
  const close = useDialogs((s) => s.close)
  const [val, setVal] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cur?.type === 'prompt') {
      setVal(cur.value); setErr(null)
      setTimeout(() => { input.current?.focus(); input.current?.select() }, 0)
    }
  }, [cur])

  if (!cur) return null
  const finish = (v: string | null): void => { (cur.resolve as (x: string | null) => void)(v); close() }
  const submit = (): void => {
    if (cur.type !== 'prompt') return
    const e = cur.validate?.(val) ?? null
    if (e) { setErr(e); return }
    finish(val)
  }
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) finish(null) }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); finish(null) } }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={cur.title}>
        <h2>{cur.title}</h2>
        {cur.type === 'confirm' ? (
          <>
            {cur.message && <p className="modal-msg">{cur.message}</p>}
            <div className="modal-actions">
              {cur.buttons.map((b, i) => (
                <button key={b.id} autoFocus={i === 0} className={'btn ' + (b.kind ?? 'default')} onClick={() => finish(b.id)}>{b.label}</button>
              ))}
            </div>
          </>
        ) : (
          <>
            {cur.label && <label className="modal-msg" htmlFor="dlg-input">{cur.label}</label>}
            <input id="dlg-input" ref={input} className="input" value={val} spellCheck={false}
              onChange={(e) => { setVal(e.target.value); setErr(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
            {err && <div className="field-error">{err}</div>}
            <div className="modal-actions">
              <button className="btn primary" onClick={submit}>{cur.okLabel}</button>
              <button className="btn" onClick={() => finish(null)}>Отмена</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export interface MenuItem {
  label?: string
  icon?: IconName
  danger?: boolean
  separator?: boolean
  disabled?: boolean
  hint?: string
  onClick?: () => void
}

/** Контекстное меню в точке (x, y). */
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }): ReactNode {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })
  useEffect(() => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ x: Math.min(x, window.innerWidth - r.width - 6), y: Math.min(y, window.innerHeight - r.height - 6) })
  }, [x, y])
  useEffect(() => {
    const off = (e: Event): void => { if (!ref.current?.contains(e.target as Node)) onClose() }
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('mousedown', off, true)
    window.addEventListener('blur', onClose)
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('mousedown', off, true); window.removeEventListener('blur', onClose); window.removeEventListener('keydown', esc) }
  }, [onClose])
  return (
    <div className="ctx" ref={ref} style={{ left: pos.x, top: pos.y }} role="menu" onContextMenu={(e) => e.preventDefault()}>
      {items.map((it, i) =>
        it.separator ? <div key={i} className="ctx-sep" /> : (
          <button key={i} role="menuitem" className={'ctx-item' + (it.danger ? ' danger' : '')} disabled={it.disabled}
            onClick={() => { onClose(); it.onClick?.() }}>
            <span className="ctx-ico">{it.icon && <Icon name={it.icon} size={14} />}</span>
            <span className="grow">{it.label}</span>
            {it.hint && <span className="ctx-hint">{it.hint}</span>}
          </button>
        )
      )}
    </div>
  )
}

/** Закрывает всплывающее окно по клику снаружи и Esc. */
export function usePopoverClose(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent): void => { if (!ref.current?.contains(e.target as Node)) onClose() }
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('mousedown', down)
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('mousedown', down); window.removeEventListener('keydown', esc) }
  }, [open, onClose, ref])
}

/** Перетаскиваемый разделитель. axis x — меняет ширину, y — высоту. */
export function Splitter({ axis, onDelta, onDone }: { axis: 'x' | 'y'; onDelta: (d: number) => void; onDone?: () => void }): ReactNode {
  const start = useCallback((e: RPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    let last = axis === 'x' ? e.clientX : e.clientY
    document.body.classList.add(axis === 'x' ? 'resizing-x' : 'resizing-y')
    const move = (ev: PointerEvent): void => {
      const cur = axis === 'x' ? ev.clientX : ev.clientY
      onDelta(cur - last)
      last = cur
    }
    const up = (): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      document.body.classList.remove('resizing-x', 'resizing-y')
      onDone?.()
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }, [axis, onDelta, onDone])
  return <div className={'splitter splitter-' + axis} onPointerDown={start} role="separator" aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'} />
}

/** Пустое состояние: заголовок, подсказка и действия. */
export function EmptyState({ icon, title, hint, children }: { icon?: IconName; title: string; hint?: string; children?: ReactNode }): ReactNode {
  return (
    <div className="empty">
      {icon && <Icon name={icon} size={28} />}
      <div className="empty-title">{title}</div>
      {hint && <div className="empty-hint">{hint}</div>}
      {children && <div className="empty-actions">{children}</div>}
    </div>
  )
}

export function Spinner(): ReactNode {
  return <span className="spinner" aria-label="Выполняется" />
}

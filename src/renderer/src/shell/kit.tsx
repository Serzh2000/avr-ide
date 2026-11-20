// Общие элементы интерфейса: диалоги, контекстное меню, всплывающие окна, разделители.
import { cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactElement, ReactNode, PointerEvent as RPointerEvent } from 'react'
import './panel.css'
import { useDialogs } from './dialogs'
import { Icon } from './icons'
import type { IconName } from './icons'
import { useUi } from './ui'

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
  // Фокус по умолчанию: основная кнопка; если её нет (удаление и т. п.) — безопасная «Отмена», а не опасное действие
  const btns = cur.type === 'confirm' ? cur.buttons : []
  const focusIdx = Math.max(0, btns.findIndex((b) => b.kind === 'primary') >= 0 ? btns.findIndex((b) => b.kind === 'primary') : btns.findIndex((b) => b.kind !== 'danger'))
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) finish(null) }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); finish(null) } }}>
      {cur.type === 'confirm' ? (
        <Dialog title={cur.title} ariaLabel={cur.title} onClose={() => finish(null)} className="modal"
          footer={cur.buttons.map((b, i) => (
            <Button key={b.id} autoFocus={i === focusIdx} variant={b.kind === 'primary' ? 'primary' : b.kind === 'danger' ? 'danger' : 'secondary'} onClick={() => finish(b.id)}>{b.label}</Button>
          ))}>
          {cur.message && <p className="modal-msg">{cur.message}</p>}
        </Dialog>
      ) : (
        <Dialog title={cur.title} ariaLabel={cur.title} onClose={() => finish(null)} className="modal"
          footer={<>
            <Button onClick={() => finish(null)}>Отмена</Button>
            <Button variant="primary" onClick={submit}>{cur.okLabel}</Button>
          </>}>
          <div className="form-row stack">
            {cur.label && <label className="form-label" htmlFor="dlg-input">{cur.label}</label>}
            <div className="form-field">
              <input id="dlg-input" ref={input} className={'input' + (err ? ' invalid' : '')} value={val} spellCheck={false}
                onChange={(e) => { setVal(e.target.value); setErr(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
              {err && <div className="field-error">{err}</div>}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}

/**
 * Общий каркас диалога: шапка (заголовок слева | центр | действия справа), тело и подвал с одинаковыми полями 20px.
 * `footer` выравнивается вправо, `footerStart` — влево.
 */
export function Dialog({ title, icon, center, headActions, onClose, footer, footerStart, className = '', children, testid, closeDisabled, ariaLabel }: {
  title: ReactNode
  icon?: IconName
  center?: ReactNode
  headActions?: ReactNode
  onClose?: () => void
  footer?: ReactNode
  footerStart?: ReactNode
  className?: string
  children?: ReactNode
  testid?: string
  closeDisabled?: boolean
  /** Если заголовок — строка, он же служит именем диалога для скринридера и тестов */
  ariaLabel?: string
}): ReactNode {
  const id = useId()
  return (
    <div className={'dlg ' + className} role="dialog" aria-modal="true" aria-label={ariaLabel} aria-labelledby={ariaLabel ? undefined : id} data-testid={testid}>
      <header className="dlg-head">
        <h2 id={id} className="dlg-title">{icon && <Icon name={icon} size={18} />}{title}</h2>
        <div className="dlg-center">{center}</div>
        <div className="dlg-actions">
          {headActions}
          {onClose && <button className="icon-btn dlg-x" title="Закрыть" aria-label="Закрыть" onClick={onClose} disabled={closeDisabled}><Icon name="x" size={16} /></button>}
        </div>
      </header>
      <div className="dlg-body">{children}</div>
      {(footer || footerStart) && (
        <footer className="dlg-foot">
          <div className="dlg-foot-start">{footerStart}</div>
          <div className="dlg-foot-end">{footer}</div>
        </footer>
      )}
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

/** Перетаскиваемый разделитель. axis x — меняет ширину, y — высоту. Работает и с клавиатуры (стрелки, Shift — крупный шаг); двойной клик / Home — onReset. */
export function Splitter({ axis, onDelta, onDone, onReset, label, testid }: {
  axis: 'x' | 'y'; onDelta: (d: number) => void; onDone?: () => void; onReset?: () => void; label?: string; testid?: string
}): ReactNode {
  const start = useCallback((e: RPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    let last = axis === 'x' ? e.clientX : e.clientY
    document.body.classList.add(axis === 'x' ? 'resizing-x' : 'resizing-y')
    let ended = false
    const pos = (ev: PointerEvent): number => (axis === 'x' ? ev.clientX : ev.clientY)
    const end = (): void => {
      if (ended) return
      ended = true
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', end)
      el.removeEventListener('lostpointercapture', end)
      document.body.classList.remove('resizing-x', 'resizing-y')
      onDone?.()
    }
    function move(ev: PointerEvent): void {
      // кнопку уже отпустили, а pointerup потерялся (вне окна и т. п.) — завершаем, а не тянем дальше
      if (ev.buttons === 0) { end(); return }
      const cur = pos(ev)
      onDelta(cur - last)
      last = cur
    }
    function up(ev: PointerEvent): void {
      // последний сдвиг мог слиться с отпусканием — учитываем итоговую позицию
      const cur = pos(ev)
      if (cur !== last) { onDelta(cur - last); last = cur }
      end()
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', end)
    el.addEventListener('lostpointercapture', end)
  }, [axis, onDelta, onDone])
  const key = (e: React.KeyboardEvent): void => {
    const step = e.shiftKey ? 48 : 12
    const dec = axis === 'x' ? 'ArrowLeft' : 'ArrowUp'
    const inc = axis === 'x' ? 'ArrowRight' : 'ArrowDown'
    if (e.key === dec || e.key === inc) { e.preventDefault(); e.stopPropagation(); onDelta(e.key === inc ? step : -step); onDone?.() }
    else if (e.key === 'Home' && onReset) { e.preventDefault(); onReset() }
  }
  return (
    <div className={'splitter splitter-' + axis} onPointerDown={start} onKeyDown={key} onDoubleClick={onReset} tabIndex={0}
      role="separator" aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'} aria-label={label ?? 'Изменить размер'} data-testid={testid}
      title={onReset ? 'Потяните, чтобы изменить размер. Двойной клик — по умолчанию' : 'Потяните, чтобы изменить размер'} />
  )
}

/** Число-настройка (ширина панели и т. п.) с запоминанием в localStorage; значение всегда в пределах [min, max]. */
export function usePersistedSize(key: string, def: number, min: number, max: number): { size: number; set: (n: number) => void; by: (d: number) => void; reset: () => void } {
  const clamp = useCallback((n: number) => Math.min(max, Math.max(min, Math.round(n))), [min, max])
  const [size, setSize] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem(key))
      return Number.isFinite(v) && v > 0 ? clamp(v) : def
    } catch { return def }
  })
  const ref = useRef(size)
  const set = useCallback((n: number) => {
    const v = clamp(n)
    ref.current = v
    setSize(v)
    try { localStorage.setItem(key, String(v)) } catch { /* не критично */ }
  }, [clamp, key])
  const by = useCallback((d: number) => set(ref.current + d), [set])
  const reset = useCallback(() => set(def), [set, def])
  return { size, set, by, reset }
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

/** Всплывающее уведомление: информация, успех или ошибка, при необходимости — кнопка действия. Показывает useUi.notice. */
export function Toast(): ReactNode {
  const notice = useUi((s) => s.notice)
  if (!notice) return null
  const kind = notice.kind ?? 'info'
  const icon: IconName = kind === 'ok' ? 'check' : kind === 'error' ? 'error' : 'info'
  return (
    <div className={'toast ' + kind} role={kind === 'error' ? 'alert' : 'status'} data-testid="toast">
      <Icon name={icon} size={16} />
      <span className="toast-text">{notice.text}</span>
      {notice.action && <Button size="sm" onClick={() => { notice.action!.run(); useUi.setState({ notice: null }) }}>{notice.action.label}</Button>}
      <button className="icon-btn toast-x" aria-label="Закрыть уведомление" onClick={() => useUi.setState({ notice: null })}><Icon name="x" size={13} /></button>
    </div>
  )
}

/** Бейдж-счётчик или метка состояния. */
export function Badge({ tone, children }: { tone?: 'ok' | 'warn' | 'err' | 'accent'; children: ReactNode }): ReactNode {
  return <span className={'gh-badge' + (tone === 'ok' ? ' inst' : tone === 'warn' ? ' warn' : tone === 'accent' ? ' mine' : '') + (tone === 'err' ? ' err' : '')}>{children}</span>
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'secondary' | 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  /** Показывает спиннер и блокирует повторный клик */
  loading?: boolean
}

/** Единая кнопка: варианты и размеры соответствуют классам .btn в styles.css. */
export function Button({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...rest }: ButtonProps): ReactNode {
  const cls = ['btn', variant !== 'secondary' ? variant : '', size === 'sm' ? 'small' : size === 'lg' ? 'lg' : '', loading ? 'busy' : '', className ?? ''].filter(Boolean).join(' ')
  return <button {...rest} className={cls} disabled={disabled || loading}>{loading && <Spinner />}{children}</button>
}

/** Переключатель-сегмент (вкладки внутри панели): одна кнопка выбрана. Стиль .seg. */
export function Tabs<T extends string>({ items, value, onChange, label, className }: { items: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string; className?: string }): ReactNode {
  return (
    <div className={'seg ' + (className ?? '')} role="tablist" aria-label={label}>
      {items.map((it) => (
        <button key={it.id} role="tab" aria-selected={value === it.id} className={value === it.id ? 'on' : ''} onClick={() => onChange(it.id)}>{it.label}</button>
      ))}
    </div>
  )
}

/** Переключатель «вкл/выкл» со строкой подписи и пояснением «зачем». */
export function Switch({ checked, onChange, title, hint }: { checked: boolean; onChange: (v: boolean) => void; title: string; hint?: string }): ReactNode {
  return (
    <label className="set-row">
      <div className="set-label"><b>{title}</b>{hint && <span className="dim">{hint}</span>}</div>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

/** Строка формы «подпись | поле» с подсказкой и ошибкой под полем (стиль .form-row). */
export function Field({ label, hint, error, stack, children }: { label: string; hint?: ReactNode; error?: string; stack?: boolean; children: ReactNode }): ReactNode {
  const id = useId()
  return (
    <div className={'form-row' + (stack ? ' stack' : '')}>
      <label className="form-label" htmlFor={id}>{label}</label>
      <div className="form-field">{isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children}</div>
      {(error || hint) && <div className={'form-hint' + (error ? ' err' : '')}>{error ?? hint}</div>}
    </div>
  )
}

/** Выпадающий список в общем стиле. */
export function Select({ className, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>): ReactNode {
  return <select {...rest} className={'select ' + (className ?? '')} />
}

/** Чип: небольшая метка с иконкой; кликабельная, если задан onClick. */
export function Chip({ icon, children, onClick, tone, title }: { icon?: IconName; children: ReactNode; onClick?: () => void; tone?: 'ok' | 'warn' | 'accent'; title?: string }): ReactNode {
  const cls = 'chip-tag' + (tone ? ' ' + tone : '')
  const inner = <>{icon && <Icon name={icon} size={12} />}{children}</>
  return onClick ? <button className={cls} onClick={onClick} title={title}>{inner}</button> : <span className={cls} title={title}>{inner}</span>
}

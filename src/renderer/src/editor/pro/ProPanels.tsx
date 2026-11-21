// Панели умного редактора Pro: поиск символов проекта (Ctrl+T), список ссылок (Shift+F12), переименование с предпросмотром (F2).
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { create } from 'zustand'
import type { CursorReq, RefMatch, RenamePlan, SymDto } from '../../../../main/pro/symbols/types'
import { query } from './proClient'

export type PanelState =
  | { kind: 'symbols' }
  | { kind: 'refs'; name: string; refs: RefMatch[]; truncated: boolean }
  | { kind: 'rename'; req: CursorReq; name: string }
  | null

interface ProUi { panel: PanelState; open: (p: PanelState) => void; close: () => void }

export const useProUi = create<ProUi>((set) => ({ panel: null, open: (panel) => set({ panel }), close: () => set({ panel: null }) }))

export interface PanelHooks {
  /** Папка проекта (для коротких путей) */
  root: string | null
  onOpen: (path: string, line: number, col: number) => void
  onApply: (files: { path: string; text: string }[]) => Promise<void>
  /** Вернуть фокус в редактор после закрытия */
  focusEditor: () => void
}

const norm = (p: string): string => p.replace(/\\/g, '/')
export function relPath(root: string | null, path: string): string {
  const p = norm(path)
  const r = root ? norm(root).replace(/\/$/, '') + '/' : ''
  if (r && p.toLowerCase().startsWith(r.toLowerCase())) return p.slice(r.length)
  const parts = p.split('/')
  return parts.length > 2 ? '…/' + parts.slice(-2).join('/') : p
}

const KIND_LABEL: Record<string, string> = { function: 'f', macro: '#', variable: 'v', struct: 'S', union: 'U', enum: 'E', class: 'C', typedef: 'T', enumerator: 'e', field: '·', label: ':' }
const KIND_NAME: Record<string, string> = { function: 'функция', macro: 'макрос', variable: 'переменная', struct: 'структура', union: 'объединение', enum: 'перечисление', class: 'класс', typedef: 'тип', enumerator: 'константа', field: 'поле', label: 'метка' }

function Close({ onClose }: { onClose: () => void }): ReactNode {
  return <button className="avr-pp-x" type="button" aria-label="Закрыть" title="Закрыть (Esc)" onClick={onClose}>×</button>
}

function SymbolPicker({ hooks }: { hooks: PanelHooks }): ReactNode {
  const close = useProUi((s) => s.close)
  const [q, setQ] = useState('')
  const [items, setItems] = useState<SymDto[]>([])
  const [sel, setSel] = useState(0)
  const [busy, setBusy] = useState(true)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => {
    let live = true
    const t = setTimeout(() => {
      void query<SymDto[]>('search', { query: q }).then((r) => { if (live) { setItems(r ?? []); setSel(0); setBusy(false) } })
    }, q ? 70 : 0)
    return () => { live = false; clearTimeout(t) }
  }, [q])
  useEffect(() => { list.current?.querySelector('[data-sel="1"]')?.scrollIntoView({ block: 'nearest' }) }, [sel, items])
  const go = (s: SymDto | undefined): void => {
    if (!s) return
    close()
    hooks.onOpen(s.path, s.line, s.col)
  }
  return (
    <div className="avr-pp" data-testid="pro-symbols" role="dialog" aria-label="Поиск символов проекта">
      <div className="avr-pp-head">
        <input ref={input} className="avr-pp-input" data-testid="pro-symbols-input" value={q} placeholder="Имя функции, макроса, типа, регистра…" spellCheck={false}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((i) => Math.min(items.length - 1, i + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((i) => Math.max(0, i - 1)) }
            else if (e.key === 'Enter') { e.preventDefault(); go(items[sel]) }
            else if (e.key === 'Escape') { e.preventDefault(); close(); hooks.focusEditor() }
          }} />
        <Close onClose={() => { close(); hooks.focusEditor() }} />
      </div>
      <div className="avr-pp-list" ref={list} role="listbox">
        {items.map((s, i) => (
          <div key={`${s.name}|${s.path}|${s.line}|${s.kind}`} role="option" aria-selected={i === sel} data-sel={i === sel ? '1' : '0'} data-testid="pro-symbols-item" data-name={s.name} data-kind={s.kind}
            className={'avr-pp-row' + (i === sel ? ' sel' : '')} onMouseMove={() => setSel(i)} onClick={() => go(s)} title={s.detail}>
            <span className={'avr-pp-kind k-' + s.kind} title={KIND_NAME[s.kind]}>{KIND_LABEL[s.kind] ?? '?'}</span>
            <span className="avr-pp-name">{s.name}</span>
            <span className="avr-pp-detail">{s.detail && s.detail !== s.name ? s.detail : KIND_NAME[s.kind]}</span>
            <span className={'avr-pp-where' + (s.own ? '' : ' ext')}>{relPath(hooks.root, s.path)}:{s.line}</span>
          </div>
        ))}
        {!items.length && <div className="avr-pp-empty">{busy ? 'Ищу…' : q ? 'Ничего не найдено в проекте и подключённых заголовках.' : 'Введите часть имени.'}</div>}
      </div>
      <div className="avr-pp-foot">↑↓ выбрать · Enter перейти · Esc закрыть</div>
    </div>
  )
}

function highlight(text: string, name: string, to?: string): ReactNode {
  const re = new RegExp(`(?<![\\w$])${name.replace(/[$.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w$])`, 'g')
  const parts: ReactNode[] = []
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    parts.push(text.slice(last, m.index))
    parts.push(to ? <span key={m.index}><del className="avr-pp-old">{m[0]}</del><ins className="avr-pp-new">{to}</ins></span> : <mark key={m.index} className="avr-pp-hit">{m[0]}</mark>)
    last = m.index + m[0].length
  }
  parts.push(text.slice(last))
  return <>{parts}</>
}

function Refs({ p, hooks }: { p: Extract<PanelState, { kind: 'refs' }>; hooks: PanelHooks }): ReactNode {
  const close = useProUi((s) => s.close)
  const groups = useMemo(() => {
    const m = new Map<string, RefMatch[]>()
    for (const r of p.refs) { const a = m.get(r.path); if (a) a.push(r); else m.set(r.path, [r]) }
    return [...m]
  }, [p.refs])
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { box.current?.focus() }, [])
  return (
    <div className="avr-pp avr-pp-refs" data-testid="pro-refs" role="dialog" aria-label={`Ссылки на ${p.name}`} tabIndex={-1} ref={box}
      onKeyDown={(e) => { if (e.key === 'Escape') { close(); hooks.focusEditor() } }}>
      <div className="avr-pp-head">
        <div className="avr-pp-title">Ссылки на <b>{p.name}</b>: {p.refs.length}{p.truncated ? '+' : ''} в {groups.length} {groups.length === 1 ? 'файле' : 'файлах'}</div>
        <Close onClose={() => { close(); hooks.focusEditor() }} />
      </div>
      <div className="avr-pp-list">
        {groups.map(([path, ms]) => (
          <div key={path}>
            <div className="avr-pp-file">{relPath(hooks.root, path)} <span className="avr-pp-count">{ms.length}</span></div>
            {ms.map((m) => (
              <div key={`${m.line}:${m.col}`} className="avr-pp-row" role="button" tabIndex={0} data-testid="pro-refs-item" onClick={() => hooks.onOpen(m.path, m.line, m.col)}
                onKeyDown={(e) => { if (e.key === 'Enter') hooks.onOpen(m.path, m.line, m.col) }}>
                <span className="avr-pp-line">{m.line}</span>
                <span className="avr-pp-code">{highlight(m.text, p.name)}</span>
              </div>
            ))}
          </div>
        ))}
        {!p.refs.length && <div className="avr-pp-empty">Ссылок в файлах проекта не найдено.</div>}
      </div>
      <div className="avr-pp-foot">Поиск по границам слов в файлах проекта, без комментариев и строк · Esc закрыть</div>
    </div>
  )
}

function Rename({ p, hooks }: { p: Extract<PanelState, { kind: 'rename' }>; hooks: PanelHooks }): ReactNode {
  const close = useProUi((s) => s.close)
  const [name, setName] = useState(p.name)
  const [plan, setPlan] = useState<RenamePlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus(); input.current?.select() }, [])
  const preview = async (): Promise<void> => {
    setBusy(true)
    setErr(null)
    const r = await query<RenamePlan>('rename', { ...p.req, newName: name.trim() })
    setBusy(false)
    if (!r) { setErr('Индекс символов недоступен.'); return }
    if (!r.ok) { setErr(r.error); setPlan(null); return }
    setPlan(r)
  }
  const total = plan && plan.ok ? plan.files.reduce((a, f) => a + f.count, 0) : 0
  const apply = async (): Promise<void> => {
    if (!plan || !plan.ok) return
    setBusy(true)
    await hooks.onApply(plan.files.map((f) => ({ path: f.path, text: f.newText })))
    setBusy(false)
    close()
    hooks.focusEditor()
  }
  return (
    <div className="avr-pp avr-pp-rename" data-testid="pro-rename" role="dialog" aria-label={`Переименовать ${p.name}`}
      onKeyDown={(e) => { if (e.key === 'Escape') { close(); hooks.focusEditor() } }}>
      <div className="avr-pp-head">
        <div className="avr-pp-title">Переименовать <b>{p.name}</b> в проекте</div>
        <Close onClose={() => { close(); hooks.focusEditor() }} />
      </div>
      <div className="avr-pp-form">
        <input ref={input} className="avr-pp-input" data-testid="pro-rename-input" value={name} spellCheck={false} aria-label="Новое имя"
          onChange={(e) => { setName(e.target.value); setPlan(null); setErr(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (plan && plan.ok) void apply(); else void preview() } }} />
        <button className="avr-pp-btn" type="button" data-testid="pro-rename-preview" disabled={busy || !name.trim() || name.trim() === p.name} onClick={() => void preview()}>Предпросмотр</button>
      </div>
      {err && <div className="avr-pp-err" data-testid="pro-rename-error" role="alert">{err}</div>}
      {plan && plan.ok && (
        <>
          {plan.warning && <div className="avr-pp-warn">{plan.warning}</div>}
          <div className="avr-pp-list" data-testid="pro-rename-list">
            {plan.files.map((f) => (
              <div key={f.path}>
                <div className="avr-pp-file">{relPath(hooks.root, f.path)} <span className="avr-pp-count">{f.count}</span></div>
                {f.matches.map((m) => (
                  <div key={`${m.line}:${m.col}`} className="avr-pp-row static">
                    <span className="avr-pp-line">{m.line}</span>
                    <span className="avr-pp-code">{highlight(m.text, plan.name, plan.newName)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="avr-pp-actions">
            <span className="avr-pp-sum">{total} {total === 1 ? 'замена' : total < 5 ? 'замены' : 'замен'} в {plan.files.length} {plan.files.length === 1 ? 'файле' : 'файлах'}. Файлы будут записаны на диск; открытые вкладки обновятся.</span>
            <button className="avr-pp-btn" type="button" onClick={() => { close(); hooks.focusEditor() }}>Отмена</button>
            <button className="avr-pp-btn primary" type="button" data-testid="pro-rename-apply" disabled={busy} onClick={() => void apply()}>Применить</button>
          </div>
        </>
      )}
      {!plan && !err && <div className="avr-pp-foot">Введите новое имя и нажмите Enter: сначала покажем все замены, ничего не меняя.</div>}
    </div>
  )
}

export default function ProPanels({ hooks }: { hooks: PanelHooks }): ReactNode {
  const panel = useProUi((s) => s.panel)
  if (!panel) return null
  if (panel.kind === 'symbols') return <SymbolPicker hooks={hooks} />
  if (panel.kind === 'refs') return <Refs p={panel} hooks={hooks} />
  return <Rename p={panel} hooks={hooks} />
}


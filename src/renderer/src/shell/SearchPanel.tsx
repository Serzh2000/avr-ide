// Панель «Поиск по проекту» (Ctrl+Shift+F): результаты по файлам, замена с подтверждением.
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { create } from 'zustand'
import type { SearchResponse } from '../../../main/files/search'
import type { SearchOptions } from '../../../main/files/searchcore'
import { confirmDialog } from './dialogs'
import { Icon } from './icons'
import { EmptyState, Spinner } from './kit'
import { isDirty, useProject } from './project'
import { useUi } from './ui'

interface SearchState {
  query: string
  replacement: string
  opts: SearchOptions
  replaceOpen: boolean
  loading: boolean
  error: string | null
  result: SearchResponse | null
  closed: Record<string, boolean>
  set: (p: Partial<SearchState>) => void
  run: () => Promise<void>
}

let seq = 0
export const useSearch = create<SearchState>((set, get) => ({
  query: '',
  replacement: '',
  opts: { caseSensitive: false, wholeWord: false, regex: false },
  replaceOpen: false,
  loading: false,
  error: null,
  result: null,
  closed: {},
  set: (p) => set(p),
  run: async () => {
    const { query, opts } = get()
    const my = ++seq
    if (!query) { set({ result: null, error: null, loading: false }); return }
    set({ loading: true })
    const r = await window.api.search.run(query, opts)
    if (my !== seq) return
    if (r.ok) set({ result: r.data, error: null, loading: false, closed: {} })
    else set({ result: null, error: r.error, loading: false })
  }
}))

const plural = (n: number, one: string, few: string, many: string): string => {
  const m = n % 100
  const d = n % 10
  return m >= 11 && m <= 14 ? many : d === 1 ? one : d >= 2 && d <= 4 ? few : many
}

export default function SearchPanel(): ReactNode {
  const s = useSearch()
  const nonce = useUi((u) => u.searchNonce)
  const openFile = useProject((p) => p.openFile)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { input.current?.focus(); input.current?.select() }, [nonce])
  // поиск запускается сам через короткую паузу после ввода и при смене параметров
  useEffect(() => {
    const t = setTimeout(() => { void useSearch.getState().run() }, 300)
    return () => clearTimeout(t)
  }, [s.query, s.opts])

  const toggle = (k: keyof SearchOptions): void => s.set({ opts: { ...s.opts, [k]: !s.opts[k] } })
  const files = s.result?.files ?? []

  const doReplace = async (paths: string[], count: number, scope: string): Promise<void> => {
    if (busy || !paths.length) return
    const dirty = paths.filter((p) => isDirty(useProject.getState().docs[p]))
    const a = await confirmDialog({
      title: 'Заменить?',
      message: `«${s.query}» → «${s.replacement}»\n${count} ${plural(count, 'замена', 'замены', 'замен')} ${scope}.` +
        (dirty.length ? '\n\nНесохранённые правки в этих файлах будут сохранены перед заменой.' : '') +
        '\n\nФайлы на диске будут перезаписаны без возможности отмены.',
      buttons: [{ id: 'ok', label: 'Заменить', kind: 'danger' }, { id: 'cancel', label: 'Отмена', kind: 'primary' }]
    })
    if (a !== 'ok') return
    setBusy(true)
    try {
      if (dirty.length && !(await useProject.getState().saveAll())) return
      const r = await window.api.search.replace(s.query, s.opts, s.replacement, paths)
      if (!r.ok) { useUi.getState().notify(r.error); return }
      const d = r.data
      useUi.getState().notify(`Заменено: ${d.replaced} в ${d.files} ${plural(d.files, 'файле', 'файлах', 'файлах')}.` + (d.skipped.length ? ` Пропущено файлов: ${d.skipped.length}.` : ''))
      await useProject.getState().syncFromDisk()
      await useSearch.getState().run()
    } finally { setBusy(false) }
  }

  const total = s.result?.total ?? 0
  return (
    <div className="search-panel">
      <div className="side-title">
        <span className="grow">Поиск</span>
        <button className="icon-btn" title="Очистить" onClick={() => { s.set({ query: '', result: null, error: null }); input.current?.focus() }}><Icon name="x" size={15} /></button>
      </div>
      <div className="srch-form">
        <div className="srch-row">
          <button className={'icon-btn srch-chev' + (s.replaceOpen ? ' on' : '')} title={s.replaceOpen ? 'Скрыть замену' : 'Показать замену'} aria-expanded={s.replaceOpen}
            onClick={() => s.set({ replaceOpen: !s.replaceOpen })}><Icon name={s.replaceOpen ? 'chevD' : 'arrow'} size={14} /></button>
          <div className="side-search srch-field">
            <input ref={input} value={s.query} placeholder="Найти в проекте" spellCheck={false} aria-label="Что искать"
              onChange={(e) => s.set({ query: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') void s.run() }} />
            <button className={'srch-opt' + (s.opts.caseSensitive ? ' on' : '')} title="Учитывать регистр" aria-pressed={s.opts.caseSensitive} onClick={() => toggle('caseSensitive')}>Aa</button>
            <button className={'srch-opt' + (s.opts.wholeWord ? ' on' : '')} title="Целое слово" aria-pressed={s.opts.wholeWord} onClick={() => toggle('wholeWord')}><u>ab</u></button>
            <button className={'srch-opt' + (s.opts.regex ? ' on' : '')} title="Регулярное выражение" aria-pressed={s.opts.regex} onClick={() => toggle('regex')}>.*</button>
          </div>
        </div>
        {s.replaceOpen && (
          <div className="srch-row">
            <span className="srch-chev" />
            <div className="side-search srch-field">
              <input value={s.replacement} placeholder="Заменить на" spellCheck={false} aria-label="Чем заменить"
                onChange={(e) => s.set({ replacement: e.target.value })} />
            </div>
          </div>
        )}
      </div>
      <div className="srch-status" aria-live="polite">
        {s.loading ? <><Spinner /> Ищу…</>
          : s.error ? <span className="srch-err">{s.error}</span>
            : s.result ? (total
              ? `${total} ${plural(total, 'совпадение', 'совпадения', 'совпадений')} в ${files.length} ${plural(files.length, 'файле', 'файлах', 'файлах')}`
              : 'Ничего не найдено')
              : ''}
      </div>
      {s.result?.truncated && <div className="srch-note">Показана только часть результатов. Уточните запрос.</div>}
      {s.replaceOpen && total > 0 && !s.loading && (
        <div className="srch-note">
          <button className="btn small danger" disabled={busy} onClick={() => void doReplace(files.map((f) => f.path), total, `в ${files.length} ${plural(files.length, 'файле', 'файлах', 'файлах')}`)}>Заменить всё ({total})</button>
        </div>
      )}
      <div className="srch-results">
        {!s.query && !s.result && (
          <EmptyState icon="search" title="Поиск по файлам проекта" hint="Введите слово или фрагмент кода. Клик по результату откроет файл на нужной строке." />
        )}
        {files.map((f) => {
          const closed = !!s.closed[f.path]
          return (
            <div key={f.path} className="srch-file">
              <div className="srch-fhead" onClick={() => s.set({ closed: { ...s.closed, [f.path]: !closed } })} title={f.rel}>
                <span className="srch-fchev"><Icon name={closed ? 'arrow' : 'chevD'} size={12} /></span>
                <span className="srch-fname">{f.rel}</span>
                <span className="badge">{f.matches.length}</span>
                {s.replaceOpen && (
                  <button className="icon-btn srch-freplace" title="Заменить в этом файле" disabled={busy}
                    onClick={(e) => { e.stopPropagation(); void doReplace([f.path], f.matches.length, 'в этом файле') }}><Icon name="replace" size={13} /></button>
                )}
              </div>
              {!closed && f.matches.map((m, i) => (
                <button key={i} className="srch-match" title={`${f.rel}:${m.line}`} onClick={() => void openFile(f.path, { line: m.line, column: m.col })}>
                  <span className="srch-line">{m.line}</span>
                  <span className="srch-text">{m.text.slice(0, m.start).trimStart()}<mark>{m.text.slice(m.start, m.start + m.len)}</mark>{m.text.slice(m.start + m.len)}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

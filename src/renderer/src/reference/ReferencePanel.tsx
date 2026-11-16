import { useEffect, useMemo, useRef, useState } from 'react'
import './reference.css'
import { functions, boards } from './data'
import { search } from './search'
import { ALL_PLATFORMS, PLATFORM_LABELS } from './types'
import type { FuncEntry, PlatformId } from './types'
import LibrariesView from './LibrariesView'
import BoardsView from './BoardsView'
import { FuncDetail, FunctionList, keyOf } from './FunctionsView'
import { libEntriesFor } from './libEntries'
import { clearRecent, EXAMPLE_QUERIES, loadRecent, pushRecent, suggestNames } from './recent'
import { useProjectLibs } from '../libs/store'
import { lookupRef } from '../libs/model'

interface Props {
  initialQuery?: string
  platform?: string
  /** Текст скетча: по его #include справочник покажет функции подключённых библиотек. */
  sketchCode?: string
}

type Tab = 'functions' | 'boards' | 'libs'

function normPlatform(p?: string): PlatformId | 'all' {
  return p && (ALL_PLATFORMS as string[]).includes(p) ? (p as PlatformId) : 'all'
}

/** Ширина контейнера (ResizeObserver): панель живёт рядом с боковыми панелями, окно приложения тут не показатель. */
function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(1000)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth || 1000)
    const ro = new ResizeObserver((es) => setW(Math.round(es[0].contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

export default function ReferencePanel({ initialQuery = '', platform, sketchCode }: Props) {
  const libsState = useProjectLibs(sketchCode)
  const rootRef = useRef<HTMLDivElement>(null)
  const width = useWidth(rootRef)
  const narrow = width < 700
  const compact = width < 560

  const [tab, setTab] = useState<Tab>('functions')
  const [query, setQuery] = useState(initialQuery)
  const [plat, setPlat] = useState<PlatformId | 'all'>(normPlatform(platform))
  const [category, setCategory] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [cardOpen, setCardOpen] = useState(false)
  const [boardId, setBoardId] = useState<string>(boards[0].id)
  const [libFocus, setLibFocus] = useState<{ word: string; nonce: number } | null>(null)
  const [focus, setFocus] = useState(false)
  const [recent, setRecent] = useState<string[]>(() => loadRecent())

  useEffect(() => {
    setQuery(initialQuery)
    setSelected(null)
    setCategory(null)
    setCardOpen(false)
    // слово из библиотеки проекта (F1 в редакторе): открываем раздел «Библиотеки проекта» на этом символе
    const coreHit = initialQuery ? search(functions, initialQuery, 'all').some((e) => e.name.toLowerCase() === initialQuery.toLowerCase()) : false
    if (initialQuery && !coreHit && lookupRef(libsState.index, initialQuery)) {
      setTab('libs')
      setLibFocus({ word: initialQuery, nonce: Date.now() })
    } else setTab('functions')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])
  useEffect(() => { setPlat(normPlatform(platform)) }, [platform])

  const results = useMemo(() => {
    let list: FuncEntry[] = [...search(functions, query, plat), ...libEntriesFor(libsState.index, query, 80)]
    if (category) list = list.filter((e) => e.category === category)
    return list
  }, [query, plat, libsState.index, category])
  const current = useMemo(() => results.find((e) => keyOf(e) === selected) ?? (narrow ? undefined : results[0]), [results, selected, narrow])
  const suggestions = useMemo(() => suggestNames([...functions, ...libEntriesFor(libsState.index, query, 6)], query), [query, libsState.index])
  const showSuggest = focus && tab !== 'boards' && (query.trim() === '' ? true : suggestions.length > 0 && !suggestions.every((s) => s.toLowerCase() === query.trim().toLowerCase()))

  const commit = (q: string): void => setRecent((r) => pushRecent(r, q))
  const pick = (q: string): void => {
    setQuery(q)
    setCategory(null)
    setTab('functions')
    setSelected(null)
    setCardOpen(true)
    commit(q)
    setFocus(false)
    const first = search(functions, q, plat)[0] ?? libEntriesFor(libsState.index, q, 1)[0]
    if (first) setSelected(keyOf(first))
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'functions', label: 'Функции' },
    { id: 'boards', label: narrow ? 'Платы' : 'Платы и распиновка' },
    { id: 'libs', label: 'Библиотеки проекта', count: libsState.libs.length }
  ]
  const placeholder = tab === 'functions' ? 'Поиск: Serial.begin, pinMode, ШИМ…' : tab === 'libs' ? 'Поиск по библиотекам: begin, readTemperature…' : 'Фильтр пинов: GPIO4, ADC, strapping…'

  return (
    <div className={'ref' + (narrow ? ' narrow' : '') + (compact ? ' compact' : '')} ref={rootRef}>
      <header className="ref-bar">
        <div className="ref-tabs" role="tablist" aria-label="Разделы справочника">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)} title={t.id === 'libs' ? 'Классы, функции и константы библиотек, подключённых в скетче' : undefined}>
              {t.label}
              {t.count ? <span className="ref-tab-count">{t.count}</span> : null}
            </button>
          ))}
        </div>
        <div className="ref-search-wrap">
          <input
            className="ref-search"
            type="text"
            role="combobox"
            aria-expanded={showSuggest}
            aria-label="Поиск по справочнику"
            placeholder={placeholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCategory(null) }}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 120)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { commit(query); setFocus(false); if (narrow && results[0]) { setSelected(keyOf(results[0])); setCardOpen(true) } }
              if (e.key === 'Escape') { setFocus(false); (e.target as HTMLInputElement).blur() }
            }}
            autoFocus
          />
          {query && <button type="button" className="ref-clear" aria-label="Очистить поиск" onMouseDown={(e) => e.preventDefault()} onClick={() => { setQuery(''); setCategory(null) }}>×</button>}
          {showSuggest && (
            <div className="ref-suggest" role="listbox">
              {query.trim() === '' ? (
                <>
                  {recent.length > 0 && (
                    <div className="ref-suggest-sec">
                      <div className="ref-suggest-h">Недавние запросы<button type="button" className="ref-link" onMouseDown={(e) => e.preventDefault()} onClick={() => setRecent(clearRecent())}>очистить</button></div>
                      {recent.map((r) => <button key={r} type="button" role="option" className="ref-suggest-item" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)}><span className="ref-suggest-ico">↺</span>{r}</button>)}
                    </div>
                  )}
                  <div className="ref-suggest-sec">
                    <div className="ref-suggest-h">Попробуйте</div>
                    <div className="ref-suggest-chips">{EXAMPLE_QUERIES.map((q) => <button key={q} type="button" className="ref-chip btn" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(q)}>{q}</button>)}</div>
                  </div>
                </>
              ) : (
                suggestions.map((s) => <button key={s} type="button" role="option" className="ref-suggest-item" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)}><span className="ref-suggest-ico">ƒ</span>{s}</button>)
              )}
            </div>
          )}
        </div>
        {tab !== 'libs' && (
          <select className="ref-select" value={plat} onChange={(e) => setPlat(e.target.value as PlatformId | 'all')} aria-label="Платформа">
            <option value="all">Все платформы</option>
            {ALL_PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
          </select>
        )}
      </header>

      {tab === 'libs' && <LibrariesView libs={libsState.libs} index={libsState.index} query={query} loading={libsState.loading} error={libsState.error} focus={libFocus} narrow={narrow} />}
      {tab === 'boards' && <BoardsView boards={boards} plat={plat} query={query} boardId={boardId} onBoard={setBoardId} narrow={narrow} compact={compact} />}
      {tab === 'functions' && (
        <div className={'ref-body ref-funcs' + (narrow ? ' narrow' : '') + (narrow && cardOpen && current ? ' card-open' : '')}>
          <div className="ref-list">
            <div className="ref-list-head">
              <span>{query || category ? `Найдено: ${results.length}` : `Всего: ${results.length}`}</span>
              {category && <button type="button" className="ref-chip btn" onClick={() => setCategory(null)}>{category} ×</button>}
            </div>
            {results.length === 0 ? (
              <div className="ref-empty-state">
                <b>Ничего не найдено{query ? ` по «${query}»` : ''}</b>
                <p>Попробуйте имя функции на английском (<code>analogWrite</code>) или русское слово: «ШИМ», «прерывание», «задержка».{plat !== 'all' && <> Сейчас включён фильтр платформы — <button type="button" className="ref-link" onClick={() => setPlat('all')}>показать все платформы</button>.</>}</p>
                <div className="ref-suggest-chips">{EXAMPLE_QUERIES.map((q) => <button key={q} type="button" className="ref-chip btn" onClick={() => pick(q)}>{q}</button>)}</div>
              </div>
            ) : (
              <FunctionList results={results} grouped={!query.trim() && !category} selectedKey={current ? keyOf(current) : null} onSelect={(k) => { setSelected(k); setCardOpen(true) }} />
            )}
          </div>
          <div className="ref-detail">
            {current ? (
              <FuncDetail
                e={current}
                onCategory={(c) => { setCategory(c); setQuery(''); setCardOpen(false) }}
                onBack={narrow ? () => setCardOpen(false) : undefined}
                onOpenLib={current.source ? () => { setLibFocus({ word: current.name, nonce: Date.now() }); setTab('libs') } : undefined}
              />
            ) : (
              <div className="ref-empty-state"><b>Выберите функцию</b><p>Слева — список по категориям; карточка с сигнатурой, параметрами и примером появится здесь.</p></div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import './reference.css'
import { functions, boards } from './data'
import { search } from './search'
import { ALL_PLATFORMS, PLATFORM_LABELS } from './types'
import type { BoardEntry, FuncEntry, PinInfo, PlatformId } from './types'

interface Props {
  initialQuery?: string
  platform?: string
  /** Текст скетча: по его #include справочник покажет функции подключённых библиотек. */
  sketchCode?: string
}

type Tab = 'functions' | 'boards'

const keyOf = (e: FuncEntry): string => `${e.name}|${e.platforms.join(',')}`

const SPECIAL_LABEL: Record<NonNullable<PinInfo['special']>, string> = {
  strapping: 'strapping',
  flash: 'flash',
  'input-only': 'только вход',
  usb: 'USB',
  warning: 'осторожно'
}

function normPlatform(p?: string): PlatformId | 'all' {
  return p && (ALL_PLATFORMS as string[]).includes(p) ? (p as PlatformId) : 'all'
}

function pinMatches(p: PinInfo, q: string): boolean {
  if (!q) return true
  const hay = [p.label, String(p.gpio ?? ''), ...p.functions, p.notes ?? '', p.special ? SPECIAL_LABEL[p.special] : '']
    .join(' ')
    .toLowerCase()
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t))
}

export default function ReferencePanel({ initialQuery = '', platform }: Props) {
  const [tab, setTab] = useState<Tab>('functions')
  const [query, setQuery] = useState(initialQuery)
  const [plat, setPlat] = useState<PlatformId | 'all'>(normPlatform(platform))
  const [selected, setSelected] = useState<string | null>(null)
  const [boardId, setBoardId] = useState<string>(boards[0].id)

  useEffect(() => { setQuery(initialQuery); setTab('functions'); setSelected(null) }, [initialQuery])
  useEffect(() => { setPlat(normPlatform(platform)) }, [platform])

  const results = useMemo(() => search(functions, query, plat), [query, plat])
  const current = useMemo(
    () => results.find((e) => keyOf(e) === selected) ?? results[0],
    [results, selected]
  )

  const visibleBoards = useMemo(
    () => boards.filter((b) => plat === 'all' || b.platform === plat),
    [plat]
  )
  const board: BoardEntry | undefined = visibleBoards.find((b) => b.id === boardId) ?? visibleBoards[0]
  const pins = useMemo(() => (board ? board.pins.filter((p) => pinMatches(p, query)) : []), [board, query])

  return (
    <div className="ref">
      <div className="ref-bar">
        <div className="ref-tabs">
          <button className={tab === 'functions' ? 'active' : ''} onClick={() => setTab('functions')}>Функции</button>
          <button className={tab === 'boards' ? 'active' : ''} onClick={() => setTab('boards')}>Распиновки</button>
        </div>
        <input
          className="ref-search"
          type="search"
          placeholder={tab === 'functions' ? 'Поиск: digitalWrite, ШИМ, WiFi…' : 'Фильтр пинов: GPIO4, ADC, strapping…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <select className="ref-select" value={plat} onChange={(e) => setPlat(e.target.value as PlatformId | 'all')}>
          <option value="all">Все платформы</option>
          {ALL_PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
        </select>
      </div>

      {tab === 'functions' ? (
        <div className="ref-body">
          <div className="ref-list">
            {results.length === 0 && <div className="ref-empty">Ничего не найдено</div>}
            {results.map((e) => (
              <div
                key={keyOf(e)}
                className={'ref-card' + (current && keyOf(current) === keyOf(e) ? ' selected' : '')}
                onClick={() => setSelected(keyOf(e))}
              >
                <div className="ref-card-name">{e.name}</div>
                <div className="ref-card-desc">{e.description}</div>
                <div className="ref-card-meta">
                  <span className="ref-cat">{e.category}</span>
                  {e.platforms.map((p) => <span key={p} className={'ref-badge p-' + p}>{p}</span>)}
                </div>
              </div>
            ))}
          </div>
          <div className="ref-detail">
            {current ? <FuncDetail e={current} /> : <div className="ref-empty">Выберите функцию</div>}
          </div>
        </div>
      ) : (
        <div className="ref-body ref-boards">
          <div className="ref-board-head">
            <select className="ref-select" value={board?.id ?? ''} onChange={(e) => setBoardId(e.target.value)}>
              {visibleBoards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {board && <span className="ref-mcu">MCU: {board.mcu}</span>}
          </div>
          {!board && <div className="ref-empty">Нет плат для выбранной платформы</div>}
          {board && (
            <div className="ref-board-scroll">
              {board.notes && (
                <ul className="ref-notes">{board.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              )}
              <table className="ref-pins">
                <thead><tr><th>Пин</th><th>GPIO</th><th>Функции</th><th>Заметки</th></tr></thead>
                <tbody>
                  {pins.map((p) => (
                    <tr key={p.label} className={p.special ? 'sp-' + p.special : ''}>
                      <td><b>{p.label}</b></td>
                      <td>{p.gpio ?? '—'}</td>
                      <td>{p.functions.join(', ')}</td>
                      <td>
                        {p.special && <span className={'ref-flag f-' + p.special}>{SPECIAL_LABEL[p.special]}</span>}
                        {p.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pins.length === 0 && <div className="ref-empty">Пины не найдены</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FuncDetail({ e }: { e: FuncEntry }) {
  return (
    <div>
      <h2 className="ref-title">{e.name}</h2>
      <div className="ref-card-meta">
        <span className="ref-cat">{e.category}</span>
        {e.platforms.map((p) => <span key={p} className={'ref-badge p-' + p}>{PLATFORM_LABELS[p]}</span>)}
      </div>
      <pre className="ref-sig">{e.signature}</pre>
      <p>{e.description}</p>
      {e.params.length > 0 && (
        <>
          <h3>Параметры</h3>
          <table className="ref-params">
            <tbody>
              {e.params.map((p) => (
                <tr key={p.name}><td><code>{p.name}</code></td><td className="ref-type">{p.type}</td><td>{p.desc}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <h3>Возвращает</h3>
      <p>{e.returns}</p>
      <h3>Пример</h3>
      <pre className="ref-code">{e.example}</pre>
      {e.warnings && e.warnings.length > 0 && (
        <div className="ref-warn"><b>Предупреждения</b><ul>{e.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>
      )}
      {e.notes && e.notes.length > 0 && (
        <div className="ref-note"><b>Заметки</b><ul>{e.notes.map((w, i) => <li key={i}>{w}</li>)}</ul></div>
      )}
    </div>
  )
}

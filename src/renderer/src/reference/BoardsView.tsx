import { useMemo, useState } from 'react'
import { PLATFORM_LABELS, type BoardEntry, type PinInfo, type PlatformId } from './types'
import Pinout, { hasAdc2, Legend, pinMatches, SPECIAL_LABEL } from './Pinout'

interface Props {
  boards: BoardEntry[]
  plat: PlatformId | 'all'
  query: string
  boardId: string
  onBoard: (id: string) => void
  narrow: boolean
  compact: boolean
}

export default function BoardsView({ boards, plat, query, boardId, onBoard, narrow, compact }: Props) {
  const [mode, setMode] = useState<'scheme' | 'table'>('scheme')
  const [pin, setPin] = useState<string | null>(null)
  const visible = useMemo(() => boards.filter((b) => plat === 'all' || b.platform === plat), [boards, plat])
  const board: BoardEntry | undefined = visible.find((b) => b.id === boardId) ?? visible[0]
  const pins = useMemo(() => (board ? board.pins.filter((p) => pinMatches(p, query)) : []), [board, query])
  const current = board && pin ? board.pins.find((p) => p.label === pin) : undefined

  if (visible.length === 0) {
    return <div className="ref-empty-state"><b>Нет плат для платформы «{plat === 'all' ? 'все' : PLATFORM_LABELS[plat as PlatformId]}»</b><p>Выберите другую платформу в фильтре справа от поиска.</p></div>
  }

  return (
    <div className={'ref-body ref-boards' + (narrow ? ' narrow' : '')}>
      <nav className="ref-board-list" aria-label="Платы">
        {narrow ? (
          <select className="ref-select" value={board?.id ?? ''} onChange={(e) => { onBoard(e.target.value); setPin(null) }} aria-label="Плата">
            {visible.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        ) : (
          visible.map((b) => (
            <button key={b.id} type="button" className={'ref-board-item' + (board && b.id === board.id ? ' selected' : '')} onClick={() => { onBoard(b.id); setPin(null) }}>
              <span className="ref-board-name">{b.name}</span>
              <span className="ref-board-sub"><span className={'ref-badge p-' + b.platform}>{b.mcu}</span><span className="ref-cat">{b.pins.length} пинов</span></span>
            </button>
          ))
        )}
      </nav>
      {board && (
        <div className="ref-board-main">
          <div className="ref-crumbs" aria-label="Путь">
            <span>Платы</span><span className="sep">›</span><span>{PLATFORM_LABELS[board.platform]}</span><span className="sep">›</span><b>{board.name}</b>
          </div>
          <div className="ref-board-head">
            <h2 className="ref-title">{board.name}</h2>
            <span className={'ref-badge p-' + board.platform}>{board.mcu}</span>
            <div className="ref-seg" role="tablist" aria-label="Вид">
              <button type="button" role="tab" aria-selected={mode === 'scheme'} className={mode === 'scheme' ? 'active' : ''} onClick={() => setMode('scheme')}>Схема</button>
              <button type="button" role="tab" aria-selected={mode === 'table'} className={mode === 'table' ? 'active' : ''} onClick={() => setMode('table')}>Таблица</button>
            </div>
          </div>
          {query && <div className="ref-filter-note">Пины, не подходящие под «{query}», приглушены ({pins.length} из {board.pins.length} совпало).</div>}
          {mode === 'scheme' ? (
            <>
              <Legend board={board} />
              <div className="ref-pinout-wrap">
                <Pinout board={board} query={query} selected={pin} onSelect={setPin} compact={compact} />
              </div>
              <p className="ref-hint">Условная схема: пины идут в порядке списка и не повторяют физическую раскладку платы. Наведите курсор или нажмите на пин, чтобы увидеть подробности.</p>
              {current ? <PinCard board={board} pin={current} onClose={() => setPin(null)} /> : <div className="ref-pin-card empty">Выберите пин на схеме</div>}
            </>
          ) : (
            <PinTable board={board} pins={pins} onPick={(l) => { setPin(l); setMode('scheme') }} />
          )}
          {board.notes && board.notes.length > 0 && (
            <>
              <h3 className="ref-h3">Заметки по плате</h3>
              <ul className="ref-notes">{board.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function PinCard({ board, pin, onClose }: { board: BoardEntry; pin: PinInfo; onClose: () => void }) {
  return (
    <div className={'ref-pin-card' + (pin.special ? ' sp-' + pin.special : '')}>
      <div className="ref-pin-card-head">
        <b>{pin.label}</b>
        {pin.gpio !== null && <span className="ref-cat">GPIO{pin.gpio}</span>}
        {pin.special && <span className={'ref-flag f-' + pin.special}>{SPECIAL_LABEL[pin.special]}</span>}
        {hasAdc2(board, pin) && <span className="ref-flag f-adc2">ADC2</span>}
        <button type="button" className="ref-icon-btn" onClick={onClose} aria-label="Закрыть">×</button>
      </div>
      <div className="ref-pin-fns">{pin.functions.length ? pin.functions.map((f) => <span key={f} className="ref-chip">{f}</span>) : <span className="ref-cat">Только цифровой ввод-вывод</span>}</div>
      {hasAdc2(board, pin) && <p className="ref-pin-note">ADC2 нельзя использовать при включённом WiFi — для аналоговых датчиков берите пины ADC1.</p>}
      {pin.notes && <p className="ref-pin-note">{pin.notes}</p>}
    </div>
  )
}

function PinTable({ board, pins, onPick }: { board: BoardEntry; pins: PinInfo[]; onPick: (label: string) => void }) {
  if (pins.length === 0) return <div className="ref-empty-state"><b>Пины не найдены</b><p>Измените запрос в поле поиска сверху.</p></div>
  return (
    <div className="ref-table-wrap">
      <table className="ref-pins">
        <thead><tr><th>Пин</th><th>GPIO</th><th>Функции</th><th>Заметки</th></tr></thead>
        <tbody>
          {pins.map((p) => (
            <tr key={p.label} className={p.special ? 'sp-' + p.special : ''} onClick={() => onPick(p.label)}>
              <td><b>{p.label}</b></td>
              <td>{p.gpio ?? '—'}</td>
              <td>{p.functions.join(', ')}</td>
              <td>
                {p.special && <span className={'ref-flag f-' + p.special}>{SPECIAL_LABEL[p.special]}</span>}
                {hasAdc2(board, p) && <span className="ref-flag f-adc2">ADC2</span>}
                {p.notes}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

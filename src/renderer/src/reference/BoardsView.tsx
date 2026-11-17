import { useEffect, useMemo, useRef, useState } from 'react'
import { PLATFORM_LABELS, type BoardEntry, type PinInfo, type PlatformId } from './types'
import Pinout, { hasAdc2, Legend, pinMatches, SPECIAL_LABEL } from './Pinout'
import { layouts } from './data/boardLayouts'
import { boardArt } from './data/boardArt'
import { CAT_LABEL, codeName, isIo, pinCat, type Cat } from './boardModel'

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
  const [hl, setHl] = useState<Cat | null>(null)
  const [zoom, setZoom] = useState(1)
  const rootRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(1200)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    setW(el.clientWidth || 1200)
    const ro = new ResizeObserver((es) => setW(Math.round(es[0].contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const collapsed = narrow || w < 900
  const sideBySide = w >= 1500
  const visible = useMemo(() => boards.filter((b) => plat === 'all' || b.platform === plat), [boards, plat])
  const board: BoardEntry | undefined = visible.find((b) => b.id === boardId) ?? visible[0]
  const pins = useMemo(() => (board ? board.pins.filter((p) => pinMatches(p, query)) : []), [board, query])
  const current = board && pin ? board.pins.find((p) => p.label === pin) : undefined

  if (visible.length === 0) {
    return <div className="ref-empty-state"><b>Нет плат для платформы «{plat === 'all' ? 'все' : PLATFORM_LABELS[plat as PlatformId]}»</b><p>Выберите другую платформу в фильтре справа от поиска.</p></div>
  }

  return (
    <div ref={rootRef} className={'ref-body ref-boards' + (collapsed ? ' collapsed' : '')}>
      <nav className="ref-board-list" aria-label="Платы">
        {collapsed ? (
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
              <button type="button" role="tab" aria-selected={mode === 'scheme'} className={mode === 'scheme' ? 'active' : ''} onClick={() => setMode('scheme')}>Вид сверху</button>
              <button type="button" role="tab" aria-selected={mode === 'table'} className={mode === 'table' ? 'active' : ''} onClick={() => setMode('table')}>Список</button>
            </div>
          </div>
          {query && <div className="ref-filter-note">Пины, не подходящие под «{query}», приглушены ({pins.length} из {board.pins.length} совпало).</div>}
          {mode === 'scheme' ? (
            <>
              <Legend board={board} active={hl} onToggle={setHl} />
              <div className={'board-stage' + (sideBySide ? ' two-col' : '')}>
                <div className="board-stage-main">
                  <div className="board-zoom" role="group" aria-label="Масштаб схемы">
                    <button type="button" className="btn small" onClick={() => setZoom((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100))} disabled={zoom <= 1} aria-label="Уменьшить">−</button>
                    <button type="button" className="btn small" onClick={() => setZoom(1)} disabled={zoom === 1}>Вписать</button>
                    <button type="button" className="btn small" onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))} disabled={zoom >= 3} aria-label="Увеличить">+</button>
                  </div>
                  <div className="ref-pinout-wrap">
                    {layouts[board.id] ? <Pinout board={board} layout={layouts[board.id]} query={query} selected={pin} onSelect={setPin} compact={compact} highlight={hl} zoom={zoom} /> : <div className="ref-empty-state"><b>Схема этой платы пока не нарисована</b><p>Откройте вкладку «Список».</p></div>}
                  </div>
                  <p className="ref-hint">Вид сверху в масштабе платы{layouts[board.id]?.size ? ` (${layouts[board.id].size})` : ''}; положение мелких деталей приблизительное. Наведите курсор на вывод — подсказка, нажмите — карточка.{layouts[board.id]?.art ? ` Рисунок платы: ${boardArt[layouts[board.id].art!].license}.` : ''}</p>
                </div>
                <div className="board-side">
                  {current ? <PinCard board={board} pin={current} onClose={() => setPin(null)} /> : <BoardSummary board={board} />}
                </div>
              </div>
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

function BoardSummary({ board }: { board: BoardEntry }) {
  const group = (sp: NonNullable<PinInfo['special']>): string[] => board.pins.filter((p) => p.special === sp).map((p) => p.label)
  const strap = group('strapping'), flash = group('flash'), inOnly = group('input-only'), usb = group('usb')
  const adc2 = board.platform.startsWith('esp32') ? board.pins.filter((p) => hasAdc2(board, p)).map((p) => p.label) : []
  const rows: [string, string][] = [['Микроконтроллер', board.mcu], ...(board.specs ?? [])]
  if (board.electrical) {
    rows.push(['Логика', board.electrical.logic], ['Ток вывода', board.electrical.current])
    if (board.electrical.tolerant) rows.push(['5 В на входах', board.electrical.tolerant])
    if (board.electrical.supply) rows.push(['Питание', board.electrical.supply])
  }
  const limits: string[] = []
  if (strap.length) limits.push(`strapping (влияют на загрузку): ${strap.join(', ')}`)
  if (flash.length) limits.push(`заняты flash, не использовать: ${flash.join(', ')}`)
  if (inOnly.length) limits.push(`только вход: ${inOnly.join(', ')}`)
  if (usb.length) limits.push(`USB: ${usb.join(', ')}`)
  if (adc2.length) limits.push('ADC2 не работает при включённом WiFi')
  return (
    <div className="ref-pin-card is-empty board-summary" data-testid="board-summary">
      <div className="ref-pin-card-head"><b>{board.name}</b><span className="ref-cat">Нажмите на вывод — появится описание</span></div>
      <dl className="board-facts">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {limits.length > 0 && <><div className="board-facts-h">Ключевые ограничения</div><ul className="board-limits">{limits.map((l) => <li key={l}>{l}</li>)}</ul></>}
      {board.source && board.source.length > 0 && <div className="board-src">Источники: {board.source.map((u) => u.replace(/^https?:[/][/]/, '').split('/').slice(0, 2).join('/')).join(', ')}</div>}
    </div>
  )
}

function PinCard({ board, pin, onClose }: { board: BoardEntry; pin: PinInfo; onClose: () => void }) {
  const [copied, setCopied] = useState('')
  const cat = pinCat(pin)
  const code = codeName(board, pin)
  const copy = (text: string, what: string): void => {
    void navigator.clipboard?.writeText(text).then(() => { setCopied(what); window.setTimeout(() => setCopied(''), 1500) }).catch(() => undefined)
  }
  const pinMode = code !== null ? `pinMode(${code}, OUTPUT);` : ''
  return (
    <div className={'ref-pin-card' + (pin.special ? ' sp-' + pin.special : '')} data-testid="pin-card">
      <div className="ref-pin-card-head">
        <b>{pin.label}</b>
        {pin.gpio !== null && <span className="ref-cat">{board.platform === 'stm32' ? 'Arduino №' : 'GPIO'}{pin.gpio}</span>}{pin.code && <span className="ref-cat">{pin.code}</span>}
        <span className={'ref-cat-tag cat-' + cat}>{CAT_LABEL[cat]}</span>
        {pin.special && <span className={'ref-flag f-' + pin.special}>{SPECIAL_LABEL[pin.special]}</span>}
        {hasAdc2(board, pin) && <span className="ref-flag f-adc2">ADC2</span>}
        {pin.fiveV && <span className="ref-flag f-ft">5 В</span>}
        <button type="button" className="ref-icon-btn" onClick={onClose} aria-label="Закрыть">×</button>
      </div>
      <div className="ref-pin-fns">{pin.functions.length ? pin.functions.map((f) => <span key={f} className="ref-chip">{f}</span>) : <span className="ref-cat">{pin.kind ? 'Служебный вывод — не GPIO' : 'Только цифровой ввод-вывод'}</span>}</div>
      {hasAdc2(board, pin) && <p className="ref-pin-note">ADC2 нельзя использовать при включённом WiFi — для аналоговых датчиков берите пины ADC1.</p>}
      {pin.notes && <p className="ref-pin-note">{pin.notes}</p>}
      {isIo(pin) && board.electrical && <p className="ref-pin-note ref-pin-el"><b>Уровни и ток:</b> {board.electrical.logic} {board.electrical.current}</p>}
      {code !== null && (
        <div className="ref-pin-actions">
          <button type="button" className="btn small" onClick={() => copy(code, 'num')} data-testid="pin-copy-num">{copied === 'num' ? 'Скопировано' : `Копировать ${code}`}</button>
          <button type="button" className="btn small" onClick={() => copy(pinMode, 'mode')} data-testid="pin-copy-mode">{copied === 'mode' ? 'Скопировано' : 'Копировать pinMode'}</button>
          <button type="button" className="btn small" onClick={() => copy(`#define PIN_${pin.label.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()} ${code}`, 'def')}>{copied === 'def' ? 'Скопировано' : 'Копировать #define'}</button>
        </div>
      )}
    </div>
  )
}

function PinTable({ board, pins, onPick }: { board: BoardEntry; pins: PinInfo[]; onPick: (label: string) => void }) {
  if (pins.length === 0) return <div className="ref-empty-state"><b>Пины не найдены</b><p>Измените запрос в поле поиска сверху.</p></div>
  return (
    <div className="ref-table-wrap">
      <table className="ref-pins">
        <thead><tr><th>Вывод</th><th>{board.platform === 'stm32' ? 'Имя в коде' : 'GPIO'}</th><th>Функции</th><th>Заметки</th></tr></thead>
        <tbody>
          {pins.map((p) => (
            <tr key={p.label} className={p.special ? 'sp-' + p.special : ''} onClick={() => onPick(p.label)}>
              <td><b>{p.label}</b></td>
              <td>{(board.platform === 'stm32' ? p.code : p.gpio) ?? '—'}</td>
              <td>{p.functions.join(', ')}</td>
              <td>
                {p.special && <span className={'ref-flag f-' + p.special}>{SPECIAL_LABEL[p.special]}</span>}
                {hasAdc2(board, p) && <span className="ref-flag f-adc2">ADC2</span>}
                {p.fiveV && <span className="ref-flag f-ft">5 В</span>}
                {p.notes}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

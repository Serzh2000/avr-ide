import { useEffect, useRef, useState, type ReactElement } from 'react'
import { ALL_PLATFORMS, PLATFORM_LABELS, type FuncEntry, type PlatformId } from './types'

export const keyOf = (e: FuncEntry): string => (e.source ? `${e.name}|lib:${e.source.lib}|${e.source.header}:${e.source.line}` : `${e.name}|${e.platforms.join(',')}`)

const SHORT: Record<PlatformId, string> = { avr: 'AVR', esp8266: '8266', esp32: 'ESP32', esp32s3: 'S3', esp32c3: 'C3', stm32: 'STM32', rp2040: 'RP2040', esp32s2: 'S2', esp32c6: 'C6', samd: 'SAMD', teensy: 'Teensy', renesas: 'RA', nrf52: 'nRF52' }

/** Значки платформ: все пять — один нейтральный «все». */
export function PlatformChips({ platforms, full }: { platforms: PlatformId[]; full?: boolean }) {
  if (ALL_PLATFORMS.every((p) => platforms.includes(p))) return <span className="ref-badge p-all" title="Все платформы">все</span>
  return (
    <>
      {platforms.map((p) => <span key={p} className={'ref-badge p-' + p} title={PLATFORM_LABELS[p]}>{full ? PLATFORM_LABELS[p] : SHORT[p]}</span>)}
    </>
  )
}

export function CopyButton({ text, label, className = '' }: { text: string; label: string; className?: string }) {
  const [done, setDone] = useState(false)
  const t = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(t.current), [])
  const copy = async (): Promise<void> => {
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand('copy')
        ta.remove()
      } catch {
        ok = false
      }
    }
    setDone(ok)
    window.clearTimeout(t.current)
    t.current = window.setTimeout(() => setDone(false), 1600)
  }
  return (
    <button type="button" className={'ref-copy ' + className + (done ? ' done' : '')} onClick={() => void copy()} title={label}>
      {done ? '✓ Скопировано' : label}
    </button>
  )
}

interface ListProps {
  results: FuncEntry[]
  /** Показывать группы по категориям (когда нет запроса). */
  grouped: boolean
  selectedKey: string | null
  onSelect: (k: string) => void
}

export function FunctionList({ results, grouped, selectedKey, onSelect }: ListProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector('.ref-item.selected')?.scrollIntoView({ block: 'nearest' })
  }, [selectedKey])
  const item = (e: FuncEntry): ReactElement => (
    <button key={keyOf(e)} type="button" className={'ref-item' + (selectedKey === keyOf(e) ? ' selected' : '')} onClick={() => onSelect(keyOf(e))}>
      <span className="ref-item-name">{e.name}</span>
      <span className="ref-item-desc">{e.description}</span>
      <span className="ref-item-meta">
        {e.source ? <span className="ref-badge lib-name">{e.source.lib}</span> : <><span className="ref-cat">{e.category}</span><PlatformChips platforms={e.platforms} /></>}
      </span>
    </button>
  )
  if (!grouped) return <div className="ref-list-scroll" ref={ref}>{results.map(item)}</div>
  const groups: [string, FuncEntry[]][] = []
  const idx = new Map<string, FuncEntry[]>()
  for (const e of results) {
    let g = idx.get(e.category)
    if (!g) {
      g = []
      idx.set(e.category, g)
      groups.push([e.category, g])
    }
    g.push(e)
  }
  return (
    <div className="ref-list-scroll" ref={ref}>
      {groups.map(([cat, list]) => (
        <section key={cat} className="ref-group">
          <h3 className="ref-group-h">{cat}<span className="ref-count">{list.length}</span></h3>
          {list.map(item)}
        </section>
      ))}
    </div>
  )
}

interface DetailProps {
  e: FuncEntry
  onCategory: (c: string) => void
  onOpenLib?: () => void
  onBack?: () => void
}

export function FuncDetail({ e, onCategory, onOpenLib, onBack }: DetailProps) {
  return (
    <article className="ref-card">
      {onBack && <button type="button" className="ref-back" onClick={onBack}>← К списку</button>}
      <div className="ref-crumbs" aria-label="Путь">
        <span>Справочник</span><span className="sep">›</span>
        {e.source ? <span>{e.category}</span> : <button type="button" className="ref-crumb-btn" onClick={() => onCategory(e.category)} title="Показать всю категорию">{e.category}</button>}
        <span className="sep">›</span><b>{e.name}</b>
      </div>
      <h2 className="ref-title">{e.name}</h2>
      <div className="ref-chips">
        {e.source
          ? <span className="ref-badge lib-name">{e.source.lib}{e.source.version ? ' ' + e.source.version : ''}</span>
          : <PlatformChips platforms={e.platforms} full />}
      </div>
      {e.source && (
        <div className="lib-source">
          Определено в <code>{e.source.header}:{e.source.line}</code>
          {onOpenLib && <button className="lib-btn" type="button" onClick={onOpenLib}>Открыть в разделе «Библиотеки проекта»</button>}
        </div>
      )}
      <div className="ref-code-box">
        <pre className="ref-sig">{e.signature}</pre>
        <CopyButton text={e.signature} label="Копировать сигнатуру" />
      </div>
      <p className="ref-desc">{e.description}</p>
      {e.params.length > 0 && (
        <>
          <h3 className="ref-h3">Параметры</h3>
          <table className="ref-params">
            <tbody>
              {e.params.map((p) => (
                <tr key={p.name}><td><code>{p.name}</code></td><td className="ref-type">{p.type}</td><td>{p.desc}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {e.returns && (<><h3 className="ref-h3">Возвращает</h3><p>{e.returns}</p></>)}
      {e.example && (
        <>
          <h3 className="ref-h3">Пример</h3>
          <div className="ref-code-box">
            <pre className="ref-code">{e.example}</pre>
            <CopyButton text={e.example} label="Копировать пример" />
          </div>
        </>
      )}
      {e.warnings && e.warnings.length > 0 && (
        <div className="ref-warn"><b>Предупреждения</b><ul>{e.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>
      )}
      {e.notes && e.notes.length > 0 && (
        <div className="ref-note"><b>Заметки</b><ul>{e.notes.map((w, i) => <li key={i}>{w}</li>)}</ul></div>
      )}
    </article>
  )
}

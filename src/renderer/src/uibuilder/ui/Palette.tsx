import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { WIDGETS } from '../core/index'
import type { WidgetType } from '../core/index'
import { useUiBuilder } from '../store'
import { Icon, WidgetIcon } from './icons'
import { PALETTE_GROUPS } from './paletteData'

export const DND_WIDGET = 'application/x-uib-widget'

export function Palette(): ReactNode {
  const addElementSmart = useUiBuilder((s) => s.addElementSmart)
  const mode = useUiBuilder((s) => s.mode)
  const collapsed = useUiBuilder((s) => s.paletteCollapsed)
  const setCollapsed = useUiBuilder.getState().setPaletteCollapsed
  const [q, setQ] = useState('')
  const [hover, setHover] = useState<WidgetType | null>(null)

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return PALETTE_GROUPS
    return PALETTE_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => `${i.title} ${i.hint} ${i.keywords} ${WIDGETS[i.type].espuiType}`.toLowerCase().includes(s))
    })).filter((g) => g.items.length)
  }, [q])
  const info = hover ? PALETTE_GROUPS.flatMap((g) => g.items).find((i) => i.type === hover) : null

  return (
    <aside className={`uib-palette${collapsed ? ' collapsed' : ''}`} aria-label="Элементы страницы">
      <div className="uib-pane-head">
        <span>Элементы</span>
        <button className="uib-icon-btn" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Развернуть список элементов' : 'Свернуть до значков'} aria-label={collapsed ? 'Развернуть список элементов' : 'Свернуть список элементов'}>
          <Icon name={collapsed ? 'right' : 'left'} size={14} />
        </button>
      </div>
      <label className="uib-search">
        <Icon name="search" size={14} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Найти элемент…"
          aria-label="Поиск элемента"
          onKeyDown={(e) => e.key === 'Escape' && setQ('')}
        />
      </label>
      <div className="uib-palette-list">
        {groups.length === 0 && <div className="uib-hint">Ничего не нашлось. Попробуйте «кнопка», «график», «число».</div>}
        {groups.map((g) => (
          <section key={g.id} className="uib-palette-group">
            <h3>{g.title}</h3>
            {g.items.map((it) => (
              <button
                key={it.type}
                type="button"
                className="uib-palette-item"
                draggable={mode === 'edit'}
                disabled={mode === 'test'}
                title={`${it.hint}\nКлик — добавить, или перетащите на страницу`}
                onMouseEnter={() => setHover(it.type)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(it.type)}
                onBlur={() => setHover(null)}
                onDragStart={(e) => {
                  e.dataTransfer.setData(DND_WIDGET, it.type)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => addElementSmart(it.type)}
              >
                <span className="uib-palette-ico">
                  <WidgetIcon type={it.type} />
                </span>
                <span className="uib-palette-name">
                  {it.title}
                  {WIDGETS[it.type].experimental ? <em title="В ESPUI помечен как экспериментальный"> β</em> : null}
                </span>
                <Icon name="plus" size={13} className="uib-palette-add" />
              </button>
            ))}
          </section>
        ))}
      </div>
      <div className="uib-palette-info" aria-live="polite">
        {mode === 'test' ? (
          <span>Режим «Тест»: страница работает как на устройстве. Чтобы добавить элементы, вернитесь в «Редактировать».</span>
        ) : info ? (
          <>
            <strong>{info.title}</strong>
            <span>{info.hint}</span>
          </>
        ) : (
          <span>Клик — добавить после выбранного, или перетащите на страницу.</span>
        )}
      </div>
    </aside>
  )
}

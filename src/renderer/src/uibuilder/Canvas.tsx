import { Fragment, useState } from 'react'
import type { CSSProperties, DragEvent, ReactNode } from 'react'
import {
  COLOR_CSS,
  PAGE_TEMPLATES,
  WIDGETS,
  WIDGET_GROUPS,
  WIDGET_ORDER,
  resolveTheme,
  staticInitialValue,
  styleToReact,
  findVariable
} from './core/index'
import type { EspuiColor, Issue, ThemeVars, UiElement, UiProject, WidgetType } from './core/index'
import { useUiBuilder } from './store'

export const DND_WIDGET = 'application/x-uib-widget'
export const DND_ELEMENT = 'application/x-uib-element'

export function Palette(): ReactNode {
  const addElement = useUiBuilder((s) => s.addElement)
  return (
    <div className="uib-palette">
      <div className="uib-h">Элементы</div>
      {WIDGET_GROUPS.map((g) => {
        const items = WIDGET_ORDER.filter((t) => WIDGETS[t].group === g.id)
        if (!items.length) return null
        return (
          <div key={g.id}>
            <div className="uib-palette-group">{g.title}</div>
            {items.map((t) => (
              <div
                key={t}
                className="uib-palette-item"
                draggable
                title={`${WIDGETS[t].description}\nПеретащите на холст или дважды щёлкните`}
                onDragStart={(e) => {
                  e.dataTransfer.setData(DND_WIDGET, t)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onDoubleClick={() => addElement(t)}
              >
                <span className="uib-palette-name">
                  {WIDGETS[t].title}
                  {WIDGETS[t].experimental ? ' ⚠' : ''}
                </span>
                <span className="uib-palette-ctl">{WIDGETS[t].espuiType}</span>
              </div>
            ))}
          </div>
        )
      })}
      <div className="uib-hint">⚠ — элементы ESPUI, помеченные разработчиками как экспериментальные или неполные (Graph, FileDisplay, Accel).</div>
    </div>
  )
}

function bindingBadge(p: UiProject, el: UiElement): string {
  const b = el.binding
  if (b.kind === 'var') {
    const arrow = b.direction === 'toUi' ? '→ UI' : b.direction === 'fromUi' ? '← UI' : '⇄ UI'
    return `${b.variable || '?'} ${arrow}`
  }
  if (b.kind === 'pin') {
    const pin = p.platform === 'esp8266' && b.mode === 'analog' && b.direction === 'fromPin' ? 'A0' : `GPIO${b.pin}`
    return b.direction === 'toPin' ? `UI → ${pin}` : `${pin} → UI`
  }
  if (b.kind === 'callback') return `ƒ ${b.fn || '?'}()`
  return ''
}

function Pad({ center }: { center: boolean }): ReactNode {
  return (
    <div className="uib-pv-pad">
      <span className="u">▲</span>
      <span className="l">◀</span>
      <span className="c">{center ? 'OK' : ''}</span>
      <span className="r">▶</span>
      <span className="d">▼</span>
    </div>
  )
}

function Control({ p, el }: { p: UiProject; el: UiElement }): ReactNode {
  const pr = el.props
  const b = el.binding
  const v = b.kind === 'var' ? findVariable(p, b.variable) : undefined
  const min = pr.min ?? 0
  const max = pr.max ?? 100
  const initNum = v && (v.type === 'int' || v.type === 'float') ? Number(v.init) || 0 : min
  const es = styleToReact(pr.elementStyle) as CSSProperties
  const disabled = !!pr.disabled
  switch (el.type) {
    case 'label':
      return (
        <div className="uib-pv-label" style={es}>
          {staticInitialValue(p, el) || '—'}
        </div>
      )
    case 'button':
      return (
        <div className="uib-pv-button" style={es}>
          {pr.text || el.label}
          {pr.action === 'toggle' ? ' ⇄' : ''}
        </div>
      )
    case 'switcher': {
      const on = v ? v.init === 'true' || v.init === '1' : !!pr.on
      return (
        <div className={`uib-pv-switch${on ? ' on' : ''}${pr.vertical ? ' vertical' : ''}`}>
          <span />
        </div>
      )
    }
    case 'slider':
      return (
        <input
          className="uib-pv-slider"
          style={es}
          type="range"
          min={min}
          max={max}
          step={pr.step ?? 1}
          value={Math.min(max, Math.max(min, initNum))}
          readOnly
          disabled
        />
      )
    case 'number':
      return <div className="uib-pv-input">{initNum}</div>
    case 'text':
      return (
        <div className="uib-pv-input">
          {v ? v.init : (pr.initial ?? '')}
          {pr.inputType && pr.inputType !== 'text' ? <span className="uib-pv-hint"> [{pr.inputType}]</span> : null}
        </div>
      )
    case 'password':
      return <div className="uib-pv-input">••••••••</div>
    case 'select':
      return <div className="uib-pv-input">{pr.options?.find((o) => o.value === staticInitialValue(p, el))?.label ?? pr.options?.[0]?.label ?? '—'} ▾</div>
    case 'pad':
      return <Pad center={false} />
    case 'padCenter':
      return <Pad center />
    case 'time':
      return <div className="uib-pv-input">⏱ время браузера{pr.pollSec ? ` · каждые ${pr.pollSec} с` : ''}</div>
    case 'fileDisplay':
      return <div className="uib-pv-input uib-pv-file">{pr.file || '(файл не задан)'}</div>
    case 'accel':
      return <div className="uib-pv-input">акселерометр (не завершён в ESPUI)</div>
    case 'graph':
      return (
        <svg className="uib-pv-graph" viewBox="0 0 100 30" preserveAspectRatio="none">
          <polyline fill="none" stroke="#fff" strokeWidth="1.5" points="0,22 15,18 30,24 45,10 60,14 75,6 100,12" />
        </svg>
      )
    default:
      void disabled
      return null
  }
}

function cardStyle(el: UiElement, theme: ThemeVars): CSSProperties {
  const color = el.props.color ?? 'Turquoise'
  const themed = color !== 'None' ? theme.colors?.[color as Exclude<EspuiColor, 'None'>] : theme.colors?.Dark
  const st: CSSProperties = { background: themed ?? COLOR_CSS[color] }
  if (theme.cardRadius) st.borderRadius = theme.cardRadius
  if (theme.cardShadow) st.boxShadow = theme.cardShadow
  if (theme.cardText) st.color = theme.cardText
  return { ...st, ...(styleToReact(el.props.panelStyle) as CSSProperties) }
}

export function Canvas({ issues }: { issues: Issue[] }): ReactNode {
  const project = useUiBuilder((s) => s.project)
  const activeTab = useUiBuilder((s) => s.activeTab)
  const selected = useUiBuilder((s) => s.selected)
  const {
    setActiveTab,
    select,
    addElement,
    moveElement,
    moveElementToTab,
    removeElement,
    duplicateElement,
    addTab,
    patchTab,
    removeTab,
    moveTab,
    duplicateTab,
    addPageTemplate
  } = useUiBuilder.getState()
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [overTab, setOverTab] = useState<string | null>(null)

  const tab = project.tabs.find((t) => t.id === activeTab) ?? project.tabs[0]
  const multi = project.tabs.length > 1
  const theme = resolveTheme(project.theme)
  const tabIndex = project.tabs.findIndex((t) => t.id === tab.id)

  const onDrop = (e: DragEvent, index: number): void => {
    e.preventDefault()
    e.stopPropagation()
    setDropIndex(null)
    const w = e.dataTransfer.getData(DND_WIDGET)
    const el = e.dataTransfer.getData(DND_ELEMENT)
    if (w && w in WIDGETS) addElement(w as WidgetType, tab.id, index)
    else if (el) {
      // индекс считается до удаления: поправим, если элемент из этой же вкладки стоит раньше
      const from = tab.elements.findIndex((x) => x.id === el)
      moveElement(el, tab.id, from >= 0 && from < index ? index - 1 : index)
    }
  }
  const over = (e: DragEvent, index: number): void => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes(DND_ELEMENT) ? 'move' : 'copy'
    setDropIndex(index)
  }

  const canvasStyle: CSSProperties = {}
  if (theme.pageBg) canvasStyle.background = theme.pageBg
  if (theme.pageText) canvasStyle.color = theme.pageText
  if (theme.fontFamily) canvasStyle.fontFamily = theme.fontFamily

  return (
    <div className="uib-canvas-wrap">
      <div className="uib-tabs">
        {project.tabs.map((t) => (
          <div
            key={t.id}
            className={`uib-tab${t.id === tab.id ? ' active' : ''}${overTab === t.id ? ' drop' : ''}`}
            onClick={() => setActiveTab(t.id)}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes(DND_ELEMENT)) {
                e.preventDefault()
                setOverTab(t.id)
              }
            }}
            onDragLeave={() => setOverTab(null)}
            onDrop={(e) => {
              setOverTab(null)
              const id = e.dataTransfer.getData(DND_ELEMENT)
              if (id) {
                e.preventDefault()
                moveElementToTab(id, t.id)
              }
            }}
            title="Перетащите сюда элемент, чтобы перенести его во вкладку"
          >
            {t.title || t.id}
          </div>
        ))}
        <button className="uib-btn small" onClick={addTab} title="Добавить вкладку">
          +
        </button>
        <div className="uib-spacer" />
        <input
          className="uib-input small"
          value={tab.title}
          onChange={(e) => patchTab(tab.id, { title: e.target.value })}
          title="Название вкладки"
        />
        <button className="uib-btn small" disabled={tabIndex <= 0} onClick={() => moveTab(tab.id, -1)} title="Сдвинуть вкладку влево">
          ◀
        </button>
        <button className="uib-btn small" disabled={tabIndex >= project.tabs.length - 1} onClick={() => moveTab(tab.id, 1)} title="Сдвинуть вкладку вправо">
          ▶
        </button>
        <button className="uib-btn small" onClick={() => duplicateTab(tab.id)} title="Дублировать вкладку (привязки к пинам придётся поправить)">
          ⧉
        </button>
        <select
          className="uib-input small"
          value=""
          onChange={(e) => e.target.value && addPageTemplate(e.target.value)}
          title="Добавить готовую страницу"
        >
          <option value="">+ шаблон…</option>
          {PAGE_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        {multi && (
          <button className="uib-btn small danger" onClick={() => removeTab(tab.id)} title="Удалить вкладку">
            ✕
          </button>
        )}
      </div>
      {!multi && (
        <div className="uib-hint">
          Одна вкладка: панель вкладок в ESPUI не создаётся. Добавьте вторую, чтобы получить вкладки.
        </div>
      )}
      <div
        className="uib-canvas"
        style={canvasStyle}
        onClick={() => select(null)}
        onDragOver={(e) => over(e, tab.elements.length)}
        onDrop={(e) => onDrop(e, tab.elements.length)}
      >
        <div className="uib-page-title" style={theme.headerColor ? { color: theme.headerColor } : undefined}>
          {project.settings.title}
        </div>
        <div className="uib-panels">
          {tab.elements.length === 0 && <div className="uib-empty">Перетащите элемент из палитры сюда</div>}
          {tab.elements.map((el, i) => {
            const def = WIDGETS[el.type]
            const elIssues = issues.filter((x) => x.elementId === el.id)
            const err = elIssues.some((x) => x.severity === 'error')
            const warn = elIssues.length > 0
            const sep = el.type === 'separator'
            const prev = i > 0 ? (tab.elements[i - 1].group ?? '') : ''
            const group = el.group?.trim() ?? ''
            return (
              <Fragment key={el.id}>
                {group && group !== prev && <div className="uib-group-head">{group}</div>}
                <div
                  className={`uib-panel${selected === el.id ? ' selected' : ''}${el.props.wide ? ' wide' : ''}${sep ? ' sep' : ''}${dropIndex === i ? ' drop-before' : ''}${el.props.hidden ? ' hidden-el' : ''}${el.props.disabled ? ' disabled-el' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DND_ELEMENT, el.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => setDropIndex(null)}
                  onDragOver={(e) => over(e, i)}
                  onDrop={(e) => onDrop(e, i)}
                  onClick={(e) => {
                    e.stopPropagation()
                    select(el.id)
                  }}
                >
                  {sep ? (
                    <div className="uib-sep-line">{el.label || '— разделитель —'}</div>
                  ) : (
                    <div className="uib-panel-body" style={cardStyle(el, theme)}>
                      <div className="uib-panel-label">{el.label}</div>
                      <Control p={project} el={el} />
                    </div>
                  )}
                  <div className="uib-panel-meta">
                    <span className="uib-tag">{def.title}</span>
                    <span className="uib-bind">{bindingBadge(project, el)}</span>
                    {warn && (
                      <span className={`uib-flag ${err ? 'err' : 'warn'}`} title={elIssues.map((x) => x.message).join('\n')}>
                        {err ? '●' : '▲'} {elIssues.length}
                      </span>
                    )}
                  </div>
                  {selected === el.id && (
                    <div className="uib-panel-tools">
                      <button className="uib-btn small" onClick={(e) => { e.stopPropagation(); duplicateElement(el.id) }}>
                        Дублировать
                      </button>
                      <button className="uib-btn small danger" onClick={(e) => { e.stopPropagation(); removeElement(el.id) }}>
                        Удалить
                      </button>
                    </div>
                  )}
                </div>
              </Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}

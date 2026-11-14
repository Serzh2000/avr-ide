import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ESPUI_COLORS,
  EVENT,
  STYLE_FIELDS,
  WIDGETS,
  bindingKindsFor,
  classProblem,
  compileStyle,
  defaultBinding,
  pinChoices,
  pinRoleOf,
  styleValueProblem,
  utf8Len,
  varDirectionsFor
} from './core/index'
import type { Binding, ElementProps, Issue, PropDef, SelectOption, StyleSpec, UiElement, UiProject } from './core/index'
import { useUiBuilder } from './store'

/** Текстовое поле, фиксирующее значение по blur/Enter (чтобы не ломать привязки при наборе id). */
function CommitInput({ value, onCommit, mono }: { value: string; onCommit: (v: string) => void; mono?: boolean }): ReactNode {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <input
      className={`uib-input${mono ? ' mono' : ''}`}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && onCommit(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setText(value)
      }}
    />
  )
}

function Row({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <label className="uib-row">
      <span className="uib-row-title">{title}</span>
      {children}
    </label>
  )
}

function PropField({ def, el }: { def: PropDef; el: UiElement }): ReactNode {
  const patchProps = useUiBuilder((s) => s.patchProps)
  const val = el.props[def.key]
  const set = (v: unknown): void => patchProps(el.id, { [def.key]: v } as Partial<ElementProps>)
  switch (def.kind) {
    case 'color':
      return (
        <Row title={def.title}>
          <select className="uib-input" value={(val as string | undefined) ?? 'Turquoise'} onChange={(e) => set(e.target.value)}>
            {ESPUI_COLORS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Row>
      )
    case 'bool':
      return (
        <Row title={def.title}>
          <input type="checkbox" checked={!!val} onChange={(e) => set(e.target.checked)} />
        </Row>
      )
    case 'text':
      return (
        <Row title={def.title}>
          <input className="uib-input" value={(val as string | undefined) ?? ''} onChange={(e) => set(e.target.value)} />
        </Row>
      )
    case 'int':
    case 'number':
      return (
        <Row title={def.title}>
          <input
            className="uib-input"
            type="number"
            step={def.kind === 'int' ? 1 : 'any'}
            value={(val as number | undefined) ?? ''}
            onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </Row>
      )
    case 'options':
      return <OptionsEditor el={el} />
    case 'choice':
      return (
        <Row title={def.title}>
          <select
            className="uib-input"
            value={(val as string | undefined) ?? def.choices?.[0]?.value ?? ''}
            onChange={(e) => set(e.target.value)}
          >
            {def.choices?.map((c) => (
              <option key={c.value} value={c.value}>
                {c.title}
              </option>
            ))}
          </select>
        </Row>
      )
  }
}

/** Конструктор стиля: значения проверяются теми же правилами, что и в генераторе (core/css.ts). */
function StyleEditor({ el, which, title }: { el: UiElement; which: 'panelStyle' | 'elementStyle'; title: string }): ReactNode {
  const patchStyle = useUiBuilder((s) => s.patchStyle)
  const spec: StyleSpec = el.props[which] ?? {}
  const compiled = compileStyle(spec)
  return (
    <div className="uib-section">
      <div className="uib-h">{title}</div>
      {STYLE_FIELDS.map((f) => {
        const val = spec[f.key] ?? ''
        const prob = styleValueProblem(f.kind, val)
        return (
          <div className="uib-style-row" key={f.key} title={prob ?? f.hint}>
            <span className="uib-row-title">{f.title}</span>
            {f.choices ? (
              <select className="uib-input" value={val} onChange={(e) => patchStyle(el.id, which, f.key, e.target.value)}>
                <option value="">—</option>
                {f.choices.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            ) : (
              <input
                className={`uib-input mono${prob ? ' bad' : ''}`}
                value={val}
                placeholder={f.hint}
                onChange={(e) => patchStyle(el.id, which, f.key, e.target.value)}
              />
            )}
            {f.kind === 'color' ? (
              <input
                type="color"
                className="uib-swatch"
                value={/^#[0-9a-fA-F]{6}$/.test(val) ? val : '#000000'}
                onChange={(e) => patchStyle(el.id, which, f.key, e.target.value)}
                title="Выбрать цвет"
              />
            ) : (
              <span />
            )}
          </div>
        )
      })}
      {compiled && (
        <div className="uib-hint">
          <code>{compiled}</code> — {utf8Len(compiled)} байт
        </div>
      )}
    </div>
  )
}

function ClassEditor({ el }: { el: UiElement }): ReactNode {
  const patchProps = useUiBuilder((s) => s.patchProps)
  const val = el.props.panelClass ?? ''
  const prob = val ? classProblem(val) : null
  return (
    <Row title="CSS-класс панели">
      <input
        className={`uib-input mono${prob ? ' bad' : ''}`}
        title={prob ?? 'Класс из своей темы / custom.css'}
        value={val}
        onChange={(e) => patchProps(el.id, { panelClass: e.target.value || undefined })}
      />
    </Row>
  )
}

function StructureEditor({ el, project }: { el: UiElement; project: UiProject }): ReactNode {
  const setGroup = useUiBuilder((s) => s.setGroup)
  const moveElementToTab = useUiBuilder((s) => s.moveElementToTab)
  const tab = project.tabs.find((t) => t.elements.some((e) => e.id === el.id))
  const groups = Array.from(new Set(project.tabs.flatMap((t) => t.elements.map((e) => e.group).filter((g): g is string => !!g))))
  return (
    <>
      <Row title="Группа">
        <div>
          <input
            className="uib-input"
            list="uib-groups"
            value={el.group ?? ''}
            placeholder="без группы"
            title="Перед первым элементом группы генератор добавит Separator с этим названием"
            onChange={(e) => setGroup(el.id, e.target.value)}
          />
          <datalist id="uib-groups">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
      </Row>
      {project.tabs.length > 1 && (
        <Row title="Вкладка">
          <select className="uib-input" value={tab?.id ?? ''} onChange={(e) => moveElementToTab(el.id, e.target.value)}>
            {project.tabs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title || t.id}
              </option>
            ))}
          </select>
        </Row>
      )}
    </>
  )
}

function OptionsEditor({ el }: { el: UiElement }): ReactNode {
  const patchProps = useUiBuilder((s) => s.patchProps)
  const opts: SelectOption[] = el.props.options ?? []
  const set = (o: SelectOption[]): void => patchProps(el.id, { options: o })
  return (
    <div className="uib-options">
      <div className="uib-row-title">Варианты (подпись → значение)</div>
      {opts.map((o, i) => (
        <div className="uib-opt" key={i}>
          <input className="uib-input" value={o.label} onChange={(e) => set(opts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <input className="uib-input mono" value={o.value} onChange={(e) => set(opts.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
          <button className="uib-btn small danger" onClick={() => set(opts.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button className="uib-btn small" onClick={() => set([...opts, { label: `Вариант ${opts.length + 1}`, value: String(opts.length + 1) }])}>
        + вариант
      </button>
    </div>
  )
}

function BindingEditor({ el, project }: { el: UiElement; project: UiProject }): ReactNode {
  const setBinding = useUiBuilder((s) => s.setBinding)
  const def = WIDGETS[el.type]
  const kinds = bindingKindsFor(el.type)
  const b = el.binding
  const patch = (x: Partial<Binding>): void => setBinding(el.id, { ...b, ...x } as Binding)

  const kindTitle = { none: 'Без привязки', var: 'Переменная', pin: 'Пин', callback: 'Функция пользователя' } as const
  return (
    <div className="uib-bind-editor">
      <Row title="Привязка">
        <select className="uib-input" value={b.kind} onChange={(e) => setBinding(el.id, defaultBinding(el.type, e.target.value as 'none' | 'var' | 'pin' | 'callback', el.id))}>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {kindTitle[k]}
            </option>
          ))}
        </select>
      </Row>
      {b.kind === 'var' && (
        <>
          <Row title="Переменная">
            <select className="uib-input" value={b.variable} onChange={(e) => patch({ variable: e.target.value })}>
              <option value="">— выберите —</option>
              {project.variables.map((v) => {
                const ok = varDirectionsFor(el.type, v.type).length > 0
                return (
                  <option key={v.name} value={v.name} disabled={!ok}>
                    {v.name} ({v.type}){ok ? '' : ' — не подходит'}
                  </option>
                )
              })}
            </select>
          </Row>
          <Row title="Направление">
            <select className="uib-input" value={b.direction} onChange={(e) => patch({ direction: e.target.value as 'toUi' | 'fromUi' | 'both' })}>
              {(['toUi', 'fromUi', 'both'] as const)
                .filter((d) =>
                  varDirectionsFor(el.type, project.variables.find((v) => v.name === b.variable)?.type).includes(d)
                )
                .map((d) => (
                  <option key={d} value={d}>
                    {d === 'toUi' ? 'устройство → UI (показать)' : d === 'fromUi' ? 'UI → устройство (записать)' : 'в обе стороны'}
                  </option>
                ))}
            </select>
          </Row>
          {el.type === 'button' && (
            <div className="uib-hint">bool: true, пока кнопка нажата. int: счётчик нажатий.</div>
          )}
        </>
      )}
      {b.kind === 'callback' && (
        <>
          <Row title="Имя функции">
            <input className="uib-input mono" value={b.fn} onChange={(e) => patch({ fn: e.target.value })} />
          </Row>
          <div className="uib-hint">
            Определите в скетче: <code>void {b.fn || 'onEvent'}(Control* sender, int type)</code>. События:{' '}
            {def.events.length ? def.events.map((n) => `${n}=${EVENT[n]}`).join(', ') : 'формат не подтверждён'}. Значение — в{' '}
            <code>sender-&gt;value</code>.
          </div>
        </>
      )}
      {b.kind === 'pin' && (
        <PinEditor el={el} b={b} project={project} patch={patch} def={def} />
      )}
    </div>
  )
}

function PinEditor({
  el,
  b,
  project,
  patch,
  def
}: {
  el: UiElement
  b: Extract<Binding, { kind: 'pin' }>
  project: UiProject
  patch: (x: Partial<Binding>) => void
  def: (typeof WIDGETS)[keyof typeof WIDGETS]
}): ReactNode {
  const setBinding = useUiBuilder((s) => s.setBinding)
  const dirs = [...(def.pinToPin.length ? (['toPin'] as const) : []), ...(def.pinFromPin.length ? (['fromPin'] as const) : [])]
  const modes = b.direction === 'toPin' ? def.pinToPin : def.pinFromPin
  const role = pinRoleOf(b)
  const choices = role ? pinChoices(project.platform, role) : []
  const changeDir = (d: 'toPin' | 'fromPin'): void => {
    const list = d === 'toPin' ? def.pinToPin : def.pinFromPin
    setBinding(el.id, { ...b, direction: d, mode: list.includes(b.mode) ? b.mode : list[0] })
  }
  return (
    <>
      <Row title="Направление">
        <select className="uib-input" value={b.direction} onChange={(e) => changeDir(e.target.value as 'toPin' | 'fromPin')}>
          {dirs.map((d) => (
            <option key={d} value={d}>
              {d === 'toPin' ? 'UI → пин (запись)' : 'пин → UI (чтение)'}
            </option>
          ))}
        </select>
      </Row>
      <Row title="Режим">
        <select className="uib-input" value={b.mode} onChange={(e) => patch({ mode: e.target.value as 'digital' | 'analog' })}>
          {modes.map((m) => (
            <option key={m} value={m}>
              {m === 'digital'
                ? b.direction === 'toPin' ? 'digitalWrite' : 'digitalRead'
                : b.direction === 'toPin'
                  ? project.platform === 'esp8266' ? 'analogWrite (PWM)' : 'ledcWrite (PWM)'
                  : 'analogRead'}
            </option>
          ))}
        </select>
      </Row>
      <Row title="Пин">
        <select className="uib-input" value={b.pin} onChange={(e) => patch({ pin: Number(e.target.value) })}>
          {!choices.some((c) => c.pin === b.pin) && <option value={b.pin}>{b.pin} (недопустим)</option>}
          {choices.map((c) => (
            <option key={c.pin} value={c.pin}>
              {c.label}
            </option>
          ))}
        </select>
      </Row>
      {b.mode === 'digital' && (
        <Row title="Инвертировать">
          <input type="checkbox" checked={!!b.invert} onChange={(e) => patch({ invert: e.target.checked })} />
        </Row>
      )}
      {b.mode === 'digital' && b.direction === 'fromPin' && (
        <Row title="Подтяжка к питанию">
          <input type="checkbox" checked={b.pull === 'up'} onChange={(e) => patch({ pull: e.target.checked ? 'up' : 'none' })} />
        </Row>
      )}
    </>
  )
}

export function Inspector({ issues }: { issues: Issue[] }): ReactNode {
  const project = useUiBuilder((s) => s.project)
  const selected = useUiBuilder((s) => s.selected)
  const patchElement = useUiBuilder((s) => s.patchElement)
  const renameElement = useUiBuilder((s) => s.renameElement)

  let el: UiElement | undefined
  for (const t of project.tabs) for (const e of t.elements) if (e.id === selected) el = e
  if (!el)
    return (
      <div className="uib-inspector">
        <div className="uib-h">Свойства</div>
        <div className="uib-hint">Выберите элемент на холсте.</div>
      </div>
    )
  const def = WIDGETS[el.type]
  const mine = issues.filter((i) => i.elementId === el.id)
  return (
    <div className="uib-inspector">
      <div className="uib-h">
        {def.title} <span className="uib-tag">{def.espuiType}</span>
      </div>
      <div className="uib-hint">{def.description}</div>
      <Row title="Идентификатор C++">
        <CommitInput mono value={el.id} onCommit={(v) => renameElement(el.id, v)} />
      </Row>
      <Row title="Подпись">
        <input className="uib-input" value={el.label} onChange={(e) => patchElement(el.id, { label: e.target.value })} />
      </Row>
      <StructureEditor el={el} project={project} />
      {def.props.map((p) => (
        <PropField key={p.key} def={p} el={el} />
      ))}
      {(def.callback || def.varToUi.length > 0 || def.varFromUi.length > 0 || def.pinToPin.length > 0 || def.pinFromPin.length > 0) && (
        <>
          <div className="uib-h">Привязка</div>
          <BindingEditor el={el} project={project} />
        </>
      )}
      {el.type !== 'separator' && (
        <>
          <StyleEditor el={el} which="panelStyle" title="Стиль панели (setPanelStyle)" />
          <StyleEditor el={el} which="elementStyle" title="Стиль элемента (setElementStyle)" />
          <ClassEditor el={el} />
        </>
      )}
      {mine.length > 0 && (
        <div className="uib-issues-mini">
          {mine.map((i, n) => (
            <div key={n} className={`uib-issue ${i.severity}`}>
              {i.severity === 'error' ? '●' : '▲'} {i.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

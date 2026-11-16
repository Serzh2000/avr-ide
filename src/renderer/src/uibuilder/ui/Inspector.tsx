import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  COLOR_CSS,
  ESPUI_COLORS,
  STYLE_FIELDS,
  WIDGETS,
  classProblem,
  compileStyle,
  identProblem,
  styleValueProblem,
  utf8Len
} from '../core/index'
import type { CodeRegion, ElementProps, PropDef, RegionKind, SelectOption, StyleSpec, UiElement, UiProject } from '../core/index'
import { useUiBuilder } from '../store'
import { BindingSection } from './BindingSection'
import { Icon, WidgetIcon } from './icons'
import { IssueRow } from './Issues'
import { findElement, useBuilder } from './ctx'
import { highlightLine } from './highlight'
import { widgetHint, widgetTitle } from './paletteData'
import { canBind } from './bindinfo'

/** Дружелюбные названия свойств вместо терминов ESPUI. */
const PROP_TITLES: Partial<Record<keyof ElementProps, string>> = {
  initial: 'Начальный текст',
  prefix: 'Текст перед значением',
  suffix: 'Текст после значения (например °C)',
  decimals: 'Знаков после запятой',
  text: 'Текст на кнопке',
  action: 'Как работает кнопка',
  on: 'Включён сначала',
  vertical: 'Вертикальный',
  min: 'Минимум',
  max: 'Максимум',
  step: 'Шаг',
  scale: 'Множитель значения',
  graphMs: 'Новая точка каждые, мс',
  clearOnStart: 'Очищать график при запуске',
  inputType: 'Что вводить',
  maxLength: 'Максимум символов',
  file: 'Путь к файлу',
  pollSec: 'Спрашивать время каждые, сек (0 — не спрашивать)',
  options: 'Пункты списка'
}
const HIDE_IN_APPEARANCE = new Set<keyof ElementProps>(['color', 'wide', 'disabled', 'hidden'])

/** Поиск по свойствам: пустая строка — показывать всё. */
const SearchCtx = createContext('')
function matchQ(q0: string, ...texts: Array<string | undefined>): boolean {
  const q = q0.trim().toLowerCase()
  return !q || texts.some((t) => !!t && t.toLowerCase().includes(q))
}
function useMatch(...texts: Array<string | undefined>): boolean {
  const q = useContext(SearchCtx).trim().toLowerCase()
  return !q || texts.some((t) => !!t && t.toLowerCase().includes(q))
}

function Field({ title, hint, children }: { title: string; hint?: string; children: ReactNode }): ReactNode {
  const show = useMatch(title, hint)
  if (!show) return null
  return (
    <label className="uib-field" title={hint}>
      <span className="uib-field-label">{title}</span>
      {children}
      {hint && <span className="uib-field-hint">{hint}</span>}
    </label>
  )
}

function Check({ title, hint, checked, onChange }: { title: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }): ReactNode {
  const show = useMatch(title, hint)
  if (!show) return null
  return (
    <label className="uib-check" title={hint}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {title}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  )
}

/** Сегменты вместо выпадающего списка (для 2–4 коротких вариантов). */
function Segments({ value, options, onChange, label }: { value: string; options: Array<{ value: string; title: string }>; onChange: (v: string) => void; label: string }): ReactNode {
  return (
    <div className="uib-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.title}
        </button>
      ))}
    </div>
  )
}

/** Текстовое поле, фиксирующее значение по blur/Enter (чтобы не ломать привязки при наборе id). */
function CommitInput({ value, onCommit, mono, error }: { value: string; onCommit: (v: string) => void; mono?: boolean; error?: string | null }): ReactNode {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <input
      className={`uib-input${mono ? ' mono' : ''}${error ? ' bad' : ''}`}
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

function loadOpen(id: string, d: boolean): boolean {
  try {
    const v = localStorage.getItem('avride.uib.acc.' + id)
    return v === null ? d : v === '1'
  } catch {
    return d
  }
}

/** Аккордеон: раскрытость запоминается по id. При поиске всегда раскрыт. */
function Collapsible({ id, title, defaultOpen, children, badge }: { id: string; title: string; defaultOpen?: boolean; children: ReactNode; badge?: ReactNode }): ReactNode {
  const [open, setOpen] = useState(() => loadOpen(id, !!defaultOpen))
  const searching = useContext(SearchCtx).trim() !== ''
  const shown = open || searching
  return (
    <section className={`uib-collapsible${shown ? ' open' : ''}${searching ? ' searching' : ''}`}>
      <button
        type="button"
        className="uib-collapsible-head"
        aria-expanded={shown}
        onClick={() => {
          setOpen(!open)
          try {
            localStorage.setItem('avride.uib.acc.' + id, open ? '0' : '1')
          } catch {
            /* ignore */
          }
        }}
      >
        <Icon name="chevronRight" size={14} className="uib-caret" />
        <span>{title}</span>
        {badge}
      </button>
      {shown && <div className="uib-collapsible-body">{children}</div>}
    </section>
  )
}

function PropField({ def, el }: { def: PropDef; el: UiElement }): ReactNode {
  const patchProps = useUiBuilder((s) => s.patchProps)
  const val = el.props[def.key]
  const title = PROP_TITLES[def.key] ?? def.title
  const set = (v: unknown): void => patchProps(el.id, { [def.key]: v } as Partial<ElementProps>)
  switch (def.kind) {
    case 'bool':
      return <Check title={title} checked={!!val} onChange={set} />
    case 'text':
      return (
        <Field title={title}>
          <input className="uib-input" value={(val as string | undefined) ?? ''} onChange={(e) => set(e.target.value)} />
        </Field>
      )
    case 'int':
    case 'number':
      return (
        <Field title={title}>
          <input
            className="uib-input"
            type="number"
            step={def.kind === 'int' ? 1 : 'any'}
            value={(val as number | undefined) ?? ''}
            onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </Field>
      )
    case 'options':
      return <OptionsEditor el={el} />
    case 'choice':
      if ((def.choices?.length ?? 9) <= 3)
        return (
          <Field title={title}>
            <Segments label={title} value={(val as string | undefined) ?? def.choices?.[0]?.value ?? ''} options={def.choices ?? []} onChange={set} />
          </Field>
        )
      return (
        <Field title={title}>
          <select className="uib-select" value={(val as string | undefined) ?? def.choices?.[0]?.value ?? ''} onChange={(e) => set(e.target.value)}>
            {def.choices?.map((c) => (
              <option key={c.value} value={c.value}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
      )
    default:
      return null
  }
}

function ColorPicker({ el }: { el: UiElement }): ReactNode {
  const patchProps = useUiBuilder((s) => s.patchProps)
  const show = useMatch('цвет панели')
  if (!show) return null
  const cur = el.props.color ?? 'Turquoise'
  return (
    <div className="uib-field">
      <span className="uib-field-label">Цвет панели</span>
      <div className="uib-swatches" role="radiogroup" aria-label="Цвет панели">
        {ESPUI_COLORS.filter((c) => c !== 'None').map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={cur === c}
            className={`uib-swatch-btn${cur === c ? ' on' : ''}`}
            style={{ background: COLOR_CSS[c] }}
            title={c}
            onClick={() => patchProps(el.id, { color: c })}
          />
        ))}
      </div>
    </div>
  )
}

function OptionsEditor({ el }: { el: UiElement }): ReactNode {
  const patchProps = useUiBuilder((s) => s.patchProps)
  const opts: SelectOption[] = el.props.options ?? []
  const set = (o: SelectOption[]): void => patchProps(el.id, { options: o })
  return (
    <div className="uib-field">
      <span className="uib-field-label">Пункты списка</span>
      <div className="uib-opts-head">
        <span>Что видно на странице</span>
        <span>Что получит скетч</span>
      </div>
      {opts.map((o, i) => (
        <div className="uib-opt" key={i}>
          <input className="uib-input" aria-label={`Название пункта ${i + 1}`} value={o.label} onChange={(e) => set(opts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <input className="uib-input mono" aria-label={`Значение пункта ${i + 1}`} value={o.value} onChange={(e) => set(opts.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
          <button className="uib-icon-btn danger" title="Удалить пункт" onClick={() => set(opts.filter((_, j) => j !== i))}>
            <Icon name="close" size={13} />
          </button>
        </div>
      ))}
      <button className="uib-btn small" onClick={() => set([...opts, { label: `Вариант ${opts.length + 1}`, value: String(opts.length + 1) }])}>
        <Icon name="plus" size={13} /> Пункт
      </button>
    </div>
  )
}

/** Конструктор стиля: значения проверяются теми же правилами, что и в генераторе (core/css.ts). */
function StyleEditor({ el, which, title }: { el: UiElement; which: 'panelStyle' | 'elementStyle'; title: string }): ReactNode {
  const patchStyle = useUiBuilder((s) => s.patchStyle)
  const spec: StyleSpec = el.props[which] ?? {}
  const compiled = compileStyle(spec)
  const q = useContext(SearchCtx)
  return (
    <div className="uib-style-block">
      <div className="uib-field-label strong">{title}</div>
      {STYLE_FIELDS.filter((f) => matchQ(q, f.title, f.hint)).map((f) => {
        const val = spec[f.key] ?? ''
        const prob = styleValueProblem(f.kind, val)
        return (
          <div className="uib-style-row" key={f.key} title={prob ?? f.hint}>
            <span className="uib-field-label">{f.title}</span>
            {f.choices ? (
              <select className="uib-select" value={val} onChange={(e) => patchStyle(el.id, which, f.key, e.target.value)}>
                <option value="">—</option>
                {f.choices.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            ) : (
              <input className={`uib-input mono${prob ? ' bad' : ''}`} value={val} placeholder={f.hint} onChange={(e) => patchStyle(el.id, which, f.key, e.target.value)} />
            )}
            {f.kind === 'color' ? (
              <input type="color" className="uib-swatch" value={/^#[0-9a-fA-F]{6}$/.test(val) ? val : '#000000'} onChange={(e) => patchStyle(el.id, which, f.key, e.target.value)} title="Выбрать цвет" />
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

function Layout({ el, project }: { el: UiElement; project: UiProject }): ReactNode {
  const setGroup = useUiBuilder((s) => s.setGroup)
  const moveElementToTab = useUiBuilder((s) => s.moveElementToTab)
  const moveElementBy = useUiBuilder((s) => s.moveElementBy)
  const tab = project.tabs.find((t) => t.elements.some((e) => e.id === el.id))
  const idx = tab ? tab.elements.findIndex((e) => e.id === el.id) : -1
  const groups = Array.from(new Set(project.tabs.flatMap((t) => t.elements.map((e) => e.group).filter((g): g is string => !!g))))
  return (
    <>
      {project.tabs.length > 1 && (
        <Field title="Вкладка">
          <select className="uib-select" value={tab?.id ?? ''} onChange={(e) => moveElementToTab(el.id, e.target.value)}>
            {project.tabs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title || t.id}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field title="Группа" hint="Перед первым элементом группы на странице появится заголовок-разделитель с этим названием.">
        <input className="uib-input" list="uib-groups" value={el.group ?? ''} placeholder="без группы" onChange={(e) => setGroup(el.id, e.target.value)} />
        <datalist id="uib-groups">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </Field>
      <div className="uib-row-actions" hidden={useContext(SearchCtx).trim() !== ''}>
        <button className="uib-btn small" disabled={idx <= 0} onClick={() => moveElementBy(el.id, -1)}>
          <Icon name="left" size={13} /> Раньше
        </button>
        <button className="uib-btn small" disabled={!tab || idx >= tab.elements.length - 1} onClick={() => moveElementBy(el.id, 1)}>
          Позже <Icon name="right" size={13} />
        </button>
      </div>
    </>
  )
}

const KIND_TITLE: Record<RegionKind, string> = {
  decl: 'Объявления',
  pin: 'Настройка пинов',
  control: 'Создание элемента на странице',
  style: 'Оформление',
  callback: 'Что происходит при действии на странице',
  update: 'Обновление значения на странице'
}
const KIND_ORDER: RegionKind[] = ['decl', 'pin', 'control', 'style', 'callback', 'update']

/** «Что попадёт в код»: фрагменты сгенерированного файла именно этого элемента. */
export function CodeFragment({ id, regions, code }: { id: string; regions: CodeRegion[]; code: string }): ReactNode {
  const st = useUiBuilder.getState
  const lines = code.split('\n')
  const mine = regions.filter((r) => r.elementId === id)
  if (!mine.length) return <p className="uib-hint">Для этого элемента код не создаётся (или в модели есть ошибка).</p>
  return (
    <div className="uib-fragment">
      {KIND_ORDER.map((k) => {
        const rs = mine.filter((r) => r.kind === k)
        if (!rs.length) return null
        return (
          <div key={k} className="uib-fragment-part">
            <div className="uib-fragment-title">{KIND_TITLE[k]}</div>
            <pre className="uib-code mini">
              {rs.map((r) => lines.slice(r.start, r.end + 1).map((l, i) => <div key={`${r.start}-${i}`}>{highlightLine(l) /* строка */}</div>))}
            </pre>
          </div>
        )
      })}
      <button className="uib-link-btn" onClick={() => st().setBottom('code')}>
        <Icon name="code" size={13} /> Показать в общем файле
      </button>
    </div>
  )
}

type InspTab = 'bind' | 'look' | 'behave' | 'code'
const TAB_KEY = 'avride.uib.insptab'

export function Inspector({ sheet, onClose }: { sheet?: boolean; onClose?: () => void } = {}): ReactNode {
  const ctx = useBuilder()
  const project = useUiBuilder((s) => s.project)
  const selected = useUiBuilder((s) => s.selected)
  const focus = useUiBuilder((s) => s.focus)
  const st = useUiBuilder.getState
  const root = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<InspTab>(() => {
    try {
      return (localStorage.getItem(TAB_KEY) as InspTab) || 'bind'
    } catch {
      return 'bind'
    }
  })
  const [q, setQ] = useState('')
  const pick = (t: InspTab): void => {
    setTab(t)
    try {
      localStorage.setItem(TAB_KEY, t)
    } catch {
      /* ignore */
    }
  }

  // запрос «перейти к связи / подписи»
  useEffect(() => {
    if (!focus || !root.current) return
    if (focus.section === 'binding') {
      setQ('')
      setTab('bind')
    }
    const t = setTimeout(() => {
      const target = focus.section === 'binding' ? root.current?.querySelector('#uib-binding') : root.current?.querySelector('#uib-label-input')
      if (!target) return
      target.scrollIntoView({ block: 'start', behavior: 'smooth' })
      const f = target.querySelector<HTMLElement>('button.uib-picker, input[type="radio"]:checked, input[type="radio"]') ?? (target as HTMLElement)
      f.focus?.({ preventScroll: true })
      if (focus.section === 'label') (target as HTMLInputElement).select?.()
    }, 80)
    return () => clearTimeout(t)
  }, [focus])

  const el = findElement(project, selected)
  const eff = findElement(ctx.effective, selected)
  if (!el || !eff)
    return (
      <aside className={`uib-inspector${sheet ? ' sheet' : ''}`} ref={root} aria-label="Настройки элемента">
        {sheet && onClose && <button className="uib-icon-btn uib-sheet-close" onClick={onClose} aria-label="Закрыть свойства"><Icon name="close" size={15} /></button>}
        <Overview />
      </aside>
    )
  const def = WIDGETS[el.type]
  const mine = ctx.issues.filter((i) => i.elementId === el.id)
  const idProb = identProblem(el.id)
  const ownTab = project.tabs.find((t) => t.elements.some((e) => e.id === el.id))
  const idx = ownTab ? ownTab.elements.findIndex((e) => e.id === el.id) : -1
  const hasBind = canBind(el.type)
  const behaveProps = def.props.filter((p) => !HIDE_IN_APPEARANCE.has(p.key))
  const tabs: Array<{ id: InspTab; title: string }> = [
    ...(hasBind ? [{ id: 'bind' as const, title: 'Связь' }] : []),
    { id: 'look', title: 'Вид' },
    ...(behaveProps.length ? [{ id: 'behave' as const, title: 'Поведение' }] : []),
    { id: 'code', title: 'Код' }
  ]
  const active: InspTab = tabs.some((t) => t.id === tab) ? tab : tabs[0].id
  const searching = q.trim() !== ''
  const bindMatch = /связ|привяз|переменн|пин|функц|скетч|код/i.test(q)

  const bindPane = <BindingSection el={eff} />
  const lookPane = (
    <>
      {el.type !== 'separator' && (
        <Collapsible id="look.color" title="Цвет и размер" defaultOpen>
          <ColorPicker el={el} />
          {def.props.some((p) => p.key === 'wide') && <Check title="На всю ширину страницы" hint="Карточка занимает целую строку" checked={!!el.props.wide} onChange={(v) => st().patchProps(el.id, { wide: v })} />}
          {def.props.some((p) => p.key === 'vertical') && <Check title="Вертикальный" checked={!!el.props.vertical} onChange={(v) => st().patchProps(el.id, { vertical: v })} />}
        </Collapsible>
      )}
      {el.type !== 'separator' && (
        <Collapsible id="look.adv" title="Дополнительно: свои стили (CSS)">
          <StyleEditor el={el} which="panelStyle" title="Стиль карточки" />
          <StyleEditor el={el} which="elementStyle" title="Стиль самого элемента" />
          <Field title="CSS-класс карточки" hint="Класс из своей темы или custom.css">
            <input
              className={`uib-input mono${el.props.panelClass && classProblem(el.props.panelClass) ? ' bad' : ''}`}
              title={el.props.panelClass ? (classProblem(el.props.panelClass) ?? '') : ''}
              value={el.props.panelClass ?? ''}
              onChange={(e) => st().patchProps(el.id, { panelClass: e.target.value || undefined })}
            />
          </Field>
        </Collapsible>
      )}
      {el.type === 'separator' && <p className="uib-hint uib-pad">У разделителя настраивается только заголовок — он вверху панели.</p>}
    </>
  )
  const behavePane = (
    <>
      <Collapsible id="behave.main" title="Параметры элемента" defaultOpen>
        {behaveProps.map((p) => (
          <PropField key={p.key} def={p} el={el} />
        ))}
      </Collapsible>
      <Collapsible id="behave.adv" title="Дополнительно">
        <Layout el={el} project={project} />
        <Check title="Недоступен для нажатия" hint="Элемент серый, пользователь не может им управлять" checked={!!el.props.disabled} onChange={(v) => st().patchProps(el.id, { disabled: v })} />
        <Check title="Скрыт на странице" hint="В редакторе виден бледным" checked={!!el.props.hidden} onChange={(v) => st().patchProps(el.id, { hidden: v })} />
        <Field title="Идентификатор в коде" hint="Имя переменной uint16_t в ui_generated.h. Меняйте, только если оно конфликтует с вашим кодом.">
          <CommitInput mono value={el.id} error={idProb} onCommit={(v) => st().renameElement(el.id, v)} />
        </Field>
        {idProb && <div className="uib-field-error">{idProb}</div>}
      </Collapsible>
    </>
  )
  const codePane = <CodeFragment id={el.id} regions={ctx.regions} code={ctx.code} />

  return (
    <aside className={`uib-inspector${sheet ? ' sheet' : ''}`} ref={root} aria-label="Настройки элемента">
      <div className="uib-insp-top">
        {sheet && onClose && (
          <button className="uib-icon-btn uib-sheet-close" onClick={onClose} aria-label="Закрыть свойства" title="Закрыть">
            <Icon name="close" size={15} />
          </button>
        )}
        <header className="uib-insp-head">
          <span className="uib-insp-ico">
            <WidgetIcon type={el.type} size={18} />
          </span>
          <div className="uib-insp-title" title={widgetHint(el.type)}>
            <strong>{el.label || widgetTitle(el.type)}</strong>
            <span>
              {widgetTitle(el.type)} · <code>{el.id}</code>
              {ownTab && project.tabs.length > 1 ? ` · ${ownTab.title || ownTab.id}` : ''}
            </span>
          </div>
        </header>
        <div className="uib-insp-actions">
          <button className="uib-icon-btn" disabled={idx <= 0} onClick={() => st().moveElementBy(el.id, -1)} title="Выше / раньше (Alt+←)" aria-label="Сдвинуть раньше">
            <Icon name="up" size={15} />
          </button>
          <button className="uib-icon-btn" disabled={!ownTab || idx >= ownTab.elements.length - 1} onClick={() => st().moveElementBy(el.id, 1)} title="Ниже / позже (Alt+→)" aria-label="Сдвинуть позже">
            <Icon name="down" size={15} />
          </button>
          <button className="uib-icon-btn" onClick={() => st().duplicateElement(el.id)} title="Дублировать (Ctrl+D)" aria-label="Дублировать">
            <Icon name="copy" size={15} />
          </button>
          {project.tabs.length > 1 && (
            <select className="uib-select compact" value={ownTab?.id ?? ''} onChange={(e) => st().moveElementToTab(el.id, e.target.value)} title="Перенести на другую вкладку страницы" aria-label="Вкладка страницы">
              {project.tabs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title || t.id}
                </option>
              ))}
            </select>
          )}
          <span className="uib-spacer" />
          <button className="uib-icon-btn danger" onClick={() => st().removeElement(el.id)} title="Удалить (Delete)" aria-label="Удалить">
            <Icon name="trash" size={15} />
          </button>
        </div>
        <label className="uib-field top">
          <input
            id="uib-label-input"
            className="uib-input"
            value={el.label}
            onChange={(e) => st().patchElement(el.id, { label: e.target.value })}
            placeholder={el.type === 'separator' ? 'Заголовок разделителя' : 'Подпись на странице, например: Температура'}
            aria-label={el.type === 'separator' ? 'Заголовок разделителя' : 'Подпись на странице'}
          />
        </label>
        <label className="uib-search insp">
          <Icon name="search" size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти свойство…" aria-label="Поиск по свойствам" onKeyDown={(e) => e.key === 'Escape' && setQ('')} />
          {q && (
            <button className="uib-icon-btn" onClick={() => setQ('')} aria-label="Очистить поиск">
              <Icon name="close" size={12} />
            </button>
          )}
        </label>
        {!searching && (
          <div className="uib-insp-tabs" role="tablist">
            {tabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={active === t.id} className={active === t.id ? 'on' : ''} onClick={() => pick(t.id)}>
                {t.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {mine.length > 0 && (
        <div className="uib-insp-issues">
          {mine.map((i, n) => (
            <IssueRow key={n} issue={i} compact />
          ))}
        </div>
      )}

      <SearchCtx.Provider value={q}>
        <div className="uib-insp-pane">
          {searching ? (
            <>
              {hasBind && bindMatch && bindPane}
              {lookPane}
              {behaveProps.length > 0 && behavePane}
              {/код|объявл|созда|обнов/i.test(q) && codePane}
            </>
          ) : active === 'bind' ? (
            bindPane
          ) : active === 'look' ? (
            lookPane
          ) : active === 'behave' ? (
            behavePane
          ) : (
            codePane
          )}
        </div>
      </SearchCtx.Provider>
    </aside>
  )
}

function Overview(): ReactNode {
  const ctx = useBuilder()
  const project = useUiBuilder((s) => s.project)
  const st = useUiBuilder.getState
  const total = project.tabs.reduce((n, t) => n + t.elements.length, 0)
  let bound = 0
  for (const t of project.tabs) for (const e of t.elements) if (e.binding.kind !== 'none') bound++
  const errs = ctx.issues.filter((i) => i.severity === 'error').length
  return (
    <div className="uib-overview">
      <header className="uib-insp-head">
        <span className="uib-insp-ico">
          <Icon name="doc" size={20} />
        </span>
        <div className="uib-insp-title">
          <strong>Страница</strong>
          <span>Кликните элемент на холсте, чтобы настроить его.</span>
        </div>
      </header>
      <dl className="uib-stats">
        <div>
          <dt>Элементов</dt>
          <dd>{total}</dd>
        </div>
        <div>
          <dt>Связано с кодом</dt>
          <dd>{bound}</dd>
        </div>
        <div>
          <dt>Ошибок</dt>
          <dd className={errs ? 'bad' : ''}>{errs}</dd>
        </div>
      </dl>
      <section className="uib-section">
        <h3>Заголовок страницы</h3>
        <input className="uib-input" value={project.settings.title} onChange={(e) => st().patchSettings({ title: e.target.value })} aria-label="Заголовок страницы" />
        <div className="uib-row-actions">
          <button className="uib-btn small" onClick={() => st().setBottom('project')}>
            WiFi и страница…
          </button>
          <button className="uib-btn small" onClick={() => st().setBottom('theme')}>
            Тема…
          </button>
        </div>
      </section>
      <section className="uib-section">
        <h3>Горячие клавиши</h3>
        <ul className="uib-keys">
          <li><kbd>Ctrl+Z</kbd> <kbd>Ctrl+Y</kbd> отмена и повтор</li>
          <li><kbd>Delete</kbd> удалить выбранный</li>
          <li><kbd>Ctrl+D</kbd> дублировать</li>
          <li><kbd>Alt+←</kbd> <kbd>Alt+→</kbd> порядок</li>
          <li><kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> выбор соседнего</li>
          <li><kbd>F2</kbd> или двойной клик — подпись</li>
          <li><kbd>Esc</kbd> снять выделение</li>
        </ul>
      </section>
    </div>
  )
}

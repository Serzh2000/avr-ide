import { Chip } from '../../shell/kit'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Issue, UiElement } from '../core/index'
import { variableUsage } from '../sketch/resolve'
import { useUiBuilder } from '../store'
import type { BottomTab } from '../store'
import { JsonPanel, ProjectPanel, ThemePanel, VariablesPanel } from '../BottomPanels'
import { Icon, WidgetIcon } from './icons'
import { BINDING_ISSUE, bindInfo, canBind } from './bindinfo'
import { findElement, useBuilder } from './ctx'
import { highlightLine } from './highlight'
import { IssueRow } from './Issues'
import { widgetTitle } from './paletteData'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function CopyButton({ text, label = 'Копировать код', primary }: { text: string; label?: string; primary?: boolean }): ReactNode {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle')
  return (
    <button
      className={`uib-btn${primary ? ' primary' : ''}`}
      onClick={async () => {
        setState((await copyText(text)) ? 'ok' : 'fail')
        setTimeout(() => setState('idle'), 1600)
      }}
    >
      <Icon name="copy" size={14} /> {state === 'ok' ? 'Скопировано' : state === 'fail' ? 'Не удалось скопировать' : label}
    </button>
  )
}

// ------------------------------------------------------------------ Связи

type LinkFilter = 'all' | 'unbound' | 'problems'

const DIR_TEXT: Record<string, string> = {
  toUi: 'скетч → страница',
  fromUi: 'страница → скетч',
  both: 'в обе стороны',
  none: '—'
}

function LinksPanel(): ReactNode {
  const ctx = useBuilder()
  const project = useUiBuilder((s) => s.project)
  const selected = useUiBuilder((s) => s.selected)
  const st = useUiBuilder.getState
  const [filter, setFilter] = useState<LinkFilter>('all')
  const [view, setView] = useState<'elements' | 'vars'>('elements')

  const rows = useMemo(() => {
    const out: Array<{ el: UiElement; tab: string; info: ReturnType<typeof bindInfo>; problems: Issue[] }> = []
    for (const t of ctx.effective.tabs)
      for (const e of t.elements) {
        const problems = ctx.issues.filter((i) => i.elementId === e.id)
        out.push({ el: e, tab: t.title || t.id, info: bindInfo(e, ctx.effective, ctx.sketch, ctx.issues), problems })
      }
    return out
  }, [ctx.effective, ctx.sketch, ctx.issues])
  const bindable = rows.filter((r) => canBind(r.el.type))
  const unbound = bindable.filter((r) => r.info.state === 'none')
  const withProblems = rows.filter((r) => r.problems.length > 0 || r.info.state === 'broken')
  const shown = filter === 'all' ? rows : filter === 'unbound' ? unbound : withProblems

  const usage = useMemo(() => variableUsage(project), [project])

  return (
    <div className="uib-links">
      <div className="uib-links-bar">
        <div className="uib-seg" role="tablist" aria-label="Вид">
          <button className={view === 'elements' ? 'on' : ''} onClick={() => setView('elements')}>По элементам</button>
          <button className={view === 'vars' ? 'on' : ''} onClick={() => setView('vars')}>По переменным</button>
        </div>
        {view === 'elements' && (
          <div className="uib-seg" role="tablist" aria-label="Фильтр">
            <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Все ({rows.length})</button>
            <button className={filter === 'unbound' ? 'on' : ''} onClick={() => setFilter('unbound')}>Без привязки ({unbound.length})</button>
            <button className={filter === 'problems' ? 'on' : ''} onClick={() => setFilter('problems')}>С проблемами ({withProblems.length})</button>
          </div>
        )}
        <span className="uib-dim">Клик по строке — перейти к элементу</span>
      </div>
      {view === 'elements' ? (
        shown.length === 0 ? (
          <div className="uib-empty-note">{rows.length === 0 ? 'На странице пока нет элементов.' : filter === 'unbound' ? 'Все элементы связаны с кодом.' : filter === 'problems' ? 'Проблем со связями нет.' : ''}</div>
        ) : (
          <table className="uib-linktable">
            <thead>
              <tr>
                <th>Элемент</th>
                <th>Вкладка</th>
                <th>Связан с</th>
                <th>Направление</th>
                <th>Состояние</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ el, tab, info, problems }) => (
                <tr key={el.id} className={selected === el.id ? 'sel' : ''} onClick={() => st().reveal(el.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && st().reveal(el.id)}>
                  <td>
                    <span className="uib-cell-el">
                      <WidgetIcon type={el.type} size={15} /> <b>{el.label || el.id}</b> <small>{widgetTitle(el.type)}</small>
                    </span>
                  </td>
                  <td>{tab}</td>
                  <td>
                    {info.source ? (
                      <span className="uib-cell-src">
                        <Icon name={info.icon === 'warn' ? 'link' : info.icon} size={13} /> <code>{info.source}</code>
                        {info.detail && <small>{info.detail}</small>}
                      </span>
                    ) : (
                      <span className="uib-dim">{info.state === 'unbindable' ? 'не требуется' : 'не выбрано'}</span>
                    )}
                  </td>
                  <td>{info.source ? DIR_TEXT[info.dir] : ''}</td>
                  <td>
                    {info.state === 'broken' || problems.some((p) => p.severity === 'error') ? (
                      <Chip tone="err" title={problems.map((p) => p.message).join('\n')}>
                        <Icon name="error" size={12} /> {problems.find((p) => BINDING_ISSUE.test(p.code))?.message.split(/[.—]/)[0] ?? 'Ошибка'}
                      </Chip>
                    ) : problems.length ? (
                      <Chip tone="warn" title={problems.map((p) => p.message).join('\n')}>
                        <Icon name="warn" size={12} /> Предупреждение
                      </Chip>
                    ) : info.state === 'none' ? (
                      <button
                        className="uib-btn small"
                        onClick={(e) => {
                          e.stopPropagation()
                          st().reveal(el.id)
                          st().requestFocus('binding')
                        }}
                      >
                        Связать…
                      </button>
                    ) : info.state === 'unbindable' ? (
                      <span className="uib-dim">—</span>
                    ) : (
                      <Chip tone="ok">
                        <Icon name="ok" size={12} /> Готово
                      </Chip>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : (
        <VarUsage usage={usage} />
      )}
    </div>
  )
}

function VarUsage({ usage }: { usage: Map<string, string[]> }): ReactNode {
  const ctx = useBuilder()
  const project = useUiBuilder((s) => s.project)
  const st = useUiBuilder.getState
  const names = new Set<string>([...usage.keys()])
  const sketchOnly = (ctx.sketch?.vars ?? []).filter((v) => v.type && !names.has(v.name))
  return (
    <table className="uib-linktable">
      <thead>
        <tr>
          <th>Переменная</th>
          <th>Откуда</th>
          <th>Используется в</th>
        </tr>
      </thead>
      <tbody>
        {[...names].map((n) => {
          const v = project.variables.find((x) => x.name === n)
          const sv = ctx.sketch?.vars.find((x) => x.name === n)
          return (
            <tr key={n}>
              <td>
                <code>{n}</code> {v && <small>{ctx.effective.variables.find((x) => x.name === n)?.type}</small>}
              </td>
              <td>
                {v?.external ? (
                  sv ? (
                    <button className="uib-link-btn" onClick={() => ctx.host?.goToLine(sv.line)} disabled={!ctx.host}>
                      из скетча · строка {sv.line}
                    </button>
                  ) : (
                    <Chip tone="err">нет в скетче</Chip>
                  )
                ) : (
                  <span>создана конструктором</span>
                )}
              </td>
              <td>
                {(usage.get(n) ?? []).map((id) => {
                  const e = findElement(project, id)
                  return (
                    <button key={id} className="uib-chip" onClick={() => st().reveal(id)}>
                      {e ? <WidgetIcon type={e.type} size={12} /> : null} {e?.label || id}
                    </button>
                  )
                })}
              </td>
            </tr>
          )
        })}
        {sketchOnly.map((v) => (
          <tr key={v.name} className="dim">
            <td>
              <code>{v.name}</code> <small>{v.type}</small>
            </td>
            <td>из скетча · строка {v.line}</td>
            <td className="uib-dim">пока не используется на странице</td>
          </tr>
        ))}
        {names.size === 0 && sketchOnly.length === 0 && (
          <tr>
            <td colSpan={3} className="uib-dim">Переменных пока нет.</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

// ------------------------------------------------------------------ Код

function CodePanel({ onInsert }: { onInsert: () => void }): ReactNode {
  const ctx = useBuilder()
  const selected = useUiBuilder((s) => s.selected)
  const st = useUiBuilder.getState
  const lines = useMemo(() => ctx.code.split('\n'), [ctx.code])
  const owner = useMemo(() => {
    const m = new Array<string | null>(lines.length).fill(null)
    for (const r of ctx.regions) for (let i = r.start; i <= r.end; i++) m[i] = r.elementId
    return m
  }, [ctx.regions, lines.length])
  const body = useRef<HTMLDivElement>(null)
  const errs = ctx.issues.filter((i) => i.severity === 'error').length

  useEffect(() => {
    if (!selected || !body.current) return
    const first = ctx.regions.find((r) => r.elementId === selected)
    if (!first) return
    const row = body.current.querySelector<HTMLElement>(`[data-line="${first.start}"]`)
    if (row) body.current.scrollTop = Math.max(0, row.offsetTop - 40)
  }, [selected, ctx.regions])

  return (
    <div className="uib-code-panel">
      <div className="uib-code-info">
        <div className="uib-code-actions">
          <button className="uib-btn primary" onClick={onInsert}>
            <Icon name="insert" size={14} /> Вставить в скетч…
          </button>
          <CopyButton text={ctx.code} />
          {errs > 0 && <Chip tone="err">Ошибок в модели: {errs} — в коде будет #error</Chip>}
        </div>
        <p className="uib-hint">Подсвечены строки выбранного элемента. Клик по строке выделяет её элемент на холсте.</p>
        <div className="uib-files">
          <div className="uib-file">
            <Icon name="doc" size={15} />
            <div>
              <b>ui_generated.h</b>
              <span>Страница целиком. Создаётся рядом со скетчем, перезаписывается при каждой вставке.</span>
            </div>
          </div>
          <div className="uib-file">
            <Icon name="doc" size={15} />
            <div>
              <b>ui.json</b>
              <span>Ваша страница для дальнейшего редактирования.</span>
            </div>
          </div>
          <div className="uib-file">
            <Icon name="code" size={15} />
            <div>
              <b>Ваш скетч (.ino)</b>
              <span>Только три строки: <code>#include</code>, <code>ui_setup()</code>, <code>ui_loop()</code>.</span>
            </div>
          </div>
        </div>
      </div>
      <div className="uib-code-body" ref={body}>
        <pre className="uib-code">
          {lines.map((l, i) => {
            const o = owner[i]
            return (
              <div
                key={i}
                data-line={i}
                className={`uib-codeline${o ? ' owned' : ''}${o && o === selected ? ' on' : ''}`}
                onClick={() => o && st().reveal(o)}
                title={o ? `Относится к элементу «${findElement(ctx.effective, o)?.label || o}»` : undefined}
              >
                <span className="ln">{i + 1}</span>
                <span className="tx">{highlightLine(l)}</span>
              </div>
            )
          })}
        </pre>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Проблемы

function IssuesPanel(): ReactNode {
  const ctx = useBuilder()
  const list = [...ctx.issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1))
  if (list.length === 0)
    return (
      <div className="uib-empty-note ok">
        <Icon name="ok" size={18} /> Проблем не найдено — страницу можно вставлять в скетч.
      </div>
    )
  return (
    <div className="uib-issues">
      {list.map((i, n) => (
        <IssueRow key={`${i.code}-${n}`} issue={i} />
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ контейнер

const TABS: Array<{ id: BottomTab; title: string }> = [
  { id: 'links', title: 'Связи' },
  { id: 'code', title: 'Код' },
  { id: 'issues', title: 'Проблемы' },
  { id: 'variables', title: 'Переменные' },
  { id: 'project', title: 'WiFi и страница' },
  { id: 'theme', title: 'Тема' },
  { id: 'json', title: 'ui.json' }
]

export function BottomPanel({ onInsert }: { onInsert: () => void }): ReactNode {
  const ctx = useBuilder()
  const bottom = useUiBuilder((s) => s.bottom)
  const open = useUiBuilder((s) => s.bottomOpen)
  const project = useUiBuilder((s) => s.project)
  const { setBottom, setBottomOpen } = useUiBuilder.getState()
  const h = useUiBuilder((s) => s.bottomHeight)
  const setH = useUiBuilder.getState().setBottomHeight
  const errs = ctx.issues.filter((i) => i.severity === 'error').length
  const warns = ctx.issues.length - errs
  const drag = useRef<{ y: number; h: number } | null>(null)
  useEffect(() => {
    const move = (e: PointerEvent): void => {
      if (!drag.current) return
      setH(Math.max(140, Math.min(window.innerHeight - 220, drag.current.h + (drag.current.y - e.clientY))))
    }
    const up = (): void => {
      drag.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [])
  void project
  return (
    <section className={`uib-bottom${open ? ' open' : ''}`} style={open ? { height: h } : undefined} aria-label="Панели: связи, код, проблемы">
      {open && <div className="uib-grab" onPointerDown={(e) => (drag.current = { y: e.clientY, h })} title="Потяните, чтобы изменить высоту панели" />}
      <div className="uib-bottom-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={open && bottom === t.id} className={`uib-btab${open && bottom === t.id ? ' active' : ''}`} onClick={() => (open && bottom === t.id ? setBottomOpen(false) : setBottom(t.id))}>
            {t.title}
            {t.id === 'issues' && ctx.issues.length > 0 && <span className={`uib-count ${errs ? 'err' : 'warn'}`}>{errs || warns}</span>}
          </button>
        ))}
        <div className="uib-spacer" />
        <button className="uib-icon-btn" onClick={() => setBottomOpen(!open)} title={open ? 'Свернуть панель' : 'Развернуть панель'} aria-label={open ? 'Свернуть панель' : 'Развернуть панель'}>
          <Icon name={open ? 'down' : 'up'} size={15} />
        </button>
      </div>
      {open && (
        <div className="uib-bottom-body" role="tabpanel">
          {bottom === 'links' && <LinksPanel />}
          {bottom === 'code' && <CodePanel onInsert={onInsert} />}
          {bottom === 'issues' && <IssuesPanel />}
          {bottom === 'variables' && <VariablesPanel />}
          {bottom === 'project' && <ProjectPanel />}
          {bottom === 'theme' && <ThemePanel />}
          {bottom === 'json' && <JsonPanel project={project} />}
        </div>
      )}
    </section>
  )
}


import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  EVENT,
  WIDGETS,
  allIds,
  bindingForIntent,
  defaultCallbackName,
  defaultVarType,
  describeBinding,
  identProblem,
  initProblem,
  intentOf,
  intentsFor,
  pinRoleOf,
  suggestVarName,
  typeRu,
  typesForIntent,
  varCompat
} from '../core/index'
import type { Binding, Intent, UiElement, VarType } from '../core/index'
import { boardPinLabel, boardPins } from '../sketch/boardpins'
import { addCallbackStub } from '../sketch/integrate'
import { resolvePin } from '../sketch/parse'
import { useUiBuilder } from '../store'
import { Icon } from './icons'
import { canBind } from './bindinfo'
import { useBuilder } from './ctx'
import { Picker } from './Picker'
import type { PickerItem } from './Picker'
import { Select } from '../../shell/kit'

type PinB = Extract<Binding, { kind: 'pin' }>

const NEW_VAR = '__new_var__'
const NEW_FN = '__new_fn__'
const OTHER_PIN = '__other_pin__'

export function BindingSection({ el }: { el: UiElement }): ReactNode {
  const ctx = useBuilder()
  const st = useUiBuilder.getState
  const intents = useMemo(() => intentsFor(el.type), [el.type])
  const cur = intentOf(el.binding)
  const info = intents.find((i) => i.id === cur)

  if (!canBind(el.type))
    return (
      <section className="uib-bind-card" id="uib-binding">
        <h3>Связь с кодом</h3>
        <p className="uib-hint">Этот элемент ничего не связывает с вашим кодом — он только оформление или показывает файл.</p>
      </section>
    )

  const setIntent = (i: Intent): void => st().setBinding(el.id, bindingForIntent(el, i, el.binding))
  const sentence = describeBinding(el, { updateMs: ctx.effective.settings.updateMs, pinText: (b) => (b.pinName ? `${b.pinName} (GPIO${b.pin})` : boardPinLabel(ctx.effective.platform, b.pin)) })

  return (
    <section className="uib-bind-card" id="uib-binding" aria-labelledby="uib-bind-h">
      <h3 id="uib-bind-h">
        <Icon name="link" size={15} /> Связь с кодом
      </h3>
      <p className="uib-q" id="uib-q">
        Что должно происходить?
      </p>
      <div className="uib-intents" role="radiogroup" aria-labelledby="uib-q">
        {intents.map((i) => (
          <label key={i.id} data-testid="uib-intent" data-intent={i.id} className={`uib-intent${cur === i.id ? ' on' : ''}`} title={i.hint}>
            <input type="radio" name={`intent-${el.id}`} checked={cur === i.id} onChange={() => setIntent(i.id)} />
            <span className="uib-intent-dot" />
            <span className="uib-intent-text">
              <b>{i.title}</b>
              {cur === i.id && i.hint && <small>{i.hint}</small>}
            </span>
          </label>
        ))}
      </div>

      {(cur === 'show' || cur === 'write' || cur === 'both') && <VarSource el={el} intent={cur} />}
      {(cur === 'pinWrite' || cur === 'pinRead') && el.binding.kind === 'pin' && <PinSource el={el} b={el.binding} />}
      {cur === 'callback' && el.binding.kind === 'callback' && <FnSource el={el} fn={el.binding.fn} />}

      {cur !== 'none' && (
        <div className="uib-sentence">
          <Icon name="bulb" size={14} />
          <span>{sentence}</span>
        </div>
      )}
      {cur === 'none' && info && <p className="uib-hint">Выберите, что элемент должен делать, — и укажите переменную, пин или функцию.</p>}
    </section>
  )
}

// ---------------------------------------------------------------- переменные

function VarSource({ el, intent }: { el: UiElement; intent: 'show' | 'write' | 'both' }): ReactNode {
  const ctx = useBuilder()
  const st = useUiBuilder.getState
  const project = useUiBuilder((s) => s.project)
  const b = el.binding as Extract<Binding, { kind: 'var' }>
  const [creating, setCreating] = useState(false)
  const allowed = typesForIntent(el.type, intent)
  const directions: Array<'toUi' | 'fromUi'> = intent === 'both' ? ['toUi', 'fromUi'] : intent === 'show' ? ['toUi'] : ['fromUi']
  const sketch = ctx.sketch

  const compat = (t: VarType): { ok: boolean; text: string } => {
    for (const d of directions) {
      const c = varCompat(el.type, t, d)
      if (!c.ok) return c
    }
    return varCompat(el.type, t, directions[0])
  }

  const items: PickerItem[] = []
  if (sketch) {
    const list = sketch.vars.filter((v) => !v.isArray || true)
    const okList: PickerItem[] = []
    const badList: PickerItem[] = []
    for (const v of list) {
      const detail = `${v.ctype} · строка ${v.line}`
      if (!v.type) {
        badList.push({ id: `s:${v.name}`, title: v.name, detail, group: 'Переменные из вашего скетча', disabled: true, reason: v.note ?? 'Тип не поддерживается' })
        continue
      }
      const c = compat(v.type)
      const constBad = v.isConst && directions.includes('fromUi')
      const it: PickerItem = { id: `s:${v.name}`, title: v.name, detail, group: 'Переменные из вашего скетча' }
      if (!c.ok) {
        it.disabled = true
        it.reason = c.text
        badList.push(it)
      } else if (constBad) {
        it.disabled = true
        it.reason = 'Объявлена как const — страница не сможет её менять'
        badList.push(it)
      } else okList.push(it)
    }
    items.push(...okList, ...badList)
  }
  const own = project.variables.filter((v) => !v.external)
  const effOwn = ctx.effective.variables
  for (const v of own) {
    const t = effOwn.find((x) => x.name === v.name)?.type ?? v.type
    const c = compat(t)
    items.push({
      id: `o:${v.name}`,
      title: v.name,
      detail: `${t} · создана конструктором`,
      group: 'Созданные в конструкторе',
      disabled: !c.ok,
      reason: c.ok ? undefined : c.text
    })
  }
  items.push({ id: NEW_VAR, title: 'Создать новую переменную…', group: 'Новая', action: true, icon: 'plus' })

  const cur = b.variable
  const curSketch = sketch?.vars.find((v) => v.name === cur)
  const curEff = ctx.effective.variables.find((v) => v.name === cur)
  const curVar = project.variables.find((v) => v.name === cur)
  const missing = !!cur && (!curVar || (curVar.external && sketch && !curSketch))
  const verdict = curEff
    ? (() => {
        for (const d of directions) {
          const c = varCompat(el.type, curEff.type, d)
          if (!c.ok) return c
        }
        return varCompat(el.type, curEff.type, directions[0])
      })()
    : null
  const value = cur ? (curVar?.external ? `s:${cur}` : `o:${cur}`) : null

  const onPick = (it: PickerItem): void => {
    if (it.id === NEW_VAR) {
      setCreating(true)
      return
    }
    setCreating(false)
    if (it.id.startsWith('s:')) {
      const v = sketch?.vars.find((x) => x.name === it.id.slice(2))
      if (!v || !v.type) return
      st().bindVariable(el.id, { name: v.name, type: v.type, init: v.initValue, external: true }, b.direction)
    } else {
      st().setBinding(el.id, { kind: 'var', variable: it.id.slice(2), direction: b.direction })
    }
  }

  return (
    <div className="uib-source">
      <label className="uib-field-label" htmlFor="uib-var-picker">
        Какая переменная?
      </label>
      <Picker
        id="uib-var-picker"
        items={items}
        value={value}
        invalid={!cur || missing || (!!verdict && !verdict.ok)}
        placeholder="Выберите переменную…"
        emptyText="Нет подходящих переменных — создайте новую"
        onPick={onPick}
        describeValue={(v) => (
          <>
            <b>{v.slice(2)}</b>
            <em>не найдена</em>
          </>
        )}
      />
      {!ctx.host && <p className="uib-hint">Скетч не подключён: переменные из вашего кода подхватятся, когда конструктор откроют внутри IDE. Пока можно создать новую.</p>}
      {ctx.host && sketch && sketch.vars.length === 0 && <p className="uib-hint">В скетче пока нет глобальных переменных. Объявите их (например, <code>float temperature;</code>) — они появятся здесь, или создайте новую.</p>}

      {cur && missing && (
        <div className="uib-note err">
          <Icon name="error" size={14} />
          <span>Переменной «{cur}» больше нет в скетче — её удалили или переименовали. Выберите другую.</span>
        </div>
      )}
      {cur && !missing && verdict && (
        <div className={`uib-note ${verdict.ok ? 'ok' : 'err'}`}>
          <Icon name={verdict.ok ? 'ok' : 'error'} size={14} />
          <span>{verdict.text}</span>
        </div>
      )}
      {cur && curSketch && curSketch.type && ctx.host && (
        <button className="uib-link-btn" onClick={() => ctx.host?.goToLine(curSketch.line)}>
          <Icon name="code" size={13} /> Перейти в код — строка {curSketch.line}
        </button>
      )}
      {cur && curVar && !curVar.external && <p className="uib-hint">Переменная создана конструктором: она объявляется в файле ui_generated.h ({curVar.type}, начальное значение: {curVar.init || 'по умолчанию'}).</p>}

      {creating && (
        <NewVariable
          el={el}
          intent={intent}
          allowed={allowed}
          onCancel={() => setCreating(false)}
          onCreate={(v) => {
            st().bindVariable(el.id, v, b.direction)
            setCreating(false)
          }}
        />
      )}
    </div>
  )
}

function NewVariable({
  el,
  intent,
  allowed,
  onCancel,
  onCreate
}: {
  el: UiElement
  intent: Intent
  allowed: VarType[]
  onCancel: () => void
  onCreate: (v: { name: string; type: VarType; init: string }) => void
}): ReactNode {
  const ctx = useBuilder()
  const project = useUiBuilder((s) => s.project)
  const taken = useMemo(() => {
    const s = allIds(project)
    ctx.sketch?.names.forEach((_v, k) => s.add(k))
    return s
  }, [project, ctx.sketch])
  const [name, setName] = useState(() => suggestVarName(el, taken))
  const [type, setType] = useState<VarType>(() => defaultVarType(el.type, intent))
  const [init, setInit] = useState('')
  const prob = identProblem(name) ?? (taken.has(name) ? `имя «${name}» уже занято (в скетче или на странице)` : null)
  const initProb = initProblem(type, init)
  return (
    <form
      className="uib-newvar"
      onSubmit={(e) => {
        e.preventDefault()
        if (!prob && !initProb) onCreate({ name, type, init })
      }}
    >
      <div className="uib-newvar-title">Новая переменная</div>
      <label className="uib-field-label">Имя</label>
      <input className={`uib-input mono${prob ? ' bad' : ''}`} value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Имя переменной" />
      {prob && <div className="uib-field-error">{prob}</div>}
      <div className="uib-grid2">
        <div>
          <label className="uib-field-label">Тип</label>
          <Select className="uib-select" value={type} onChange={(e) => setType(e.target.value as VarType)} aria-label="Тип переменной">
            {(['bool', 'int', 'float', 'String'] as const).map((t) => (
              <option key={t} value={t} disabled={allowed.length > 0 && !allowed.includes(t)}>
                {typeRu(t)}
                {allowed.length > 0 && !allowed.includes(t) ? ' — не подходит' : ''}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="uib-field-label">Начальное значение</label>
          <input className={`uib-input mono${initProb ? ' bad' : ''}`} value={init} onChange={(e) => setInit(e.target.value)} placeholder={type === 'bool' ? 'false' : type === 'String' ? '' : '0'} aria-label="Начальное значение" />
        </div>
      </div>
      {initProb && <div className="uib-field-error">{initProb}</div>}
      <p className="uib-hint">Переменная объявится в файле <code>ui_generated.h</code>. Чтобы пользоваться ей в своём коде, пишите его ниже строки <code>#include "ui_generated.h"</code>.</p>
      <div className="uib-row-actions">
        <button type="submit" className="uib-btn primary" disabled={!!prob || !!initProb}>
          Создать и связать
        </button>
        <button type="button" className="uib-btn" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------- пины

function PinSource({ el, b }: { el: UiElement; b: PinB }): ReactNode {
  const ctx = useBuilder()
  const st = useUiBuilder.getState
  const def = WIDGETS[el.type]
  const platform = ctx.effective.platform
  const modes = b.direction === 'toPin' ? def.pinToPin : def.pinFromPin
  const role = pinRoleOf(b) ?? 'out-digital'
  const [other, setOther] = useState(false)
  const items: PickerItem[] = []
  const sketchPins = ctx.sketch?.pins ?? []
  const resolvedPins = sketchPins.map((p) => ({ p, n: resolvePin(p, platform) }))
  for (const { p, n } of resolvedPins) {
    items.push({
      id: `s:${p.name}`,
      title: p.name,
      detail: n !== null ? `${boardPinLabel(platform, n)} · строка ${p.line}` : `${p.expr} · строка ${p.line}`,
      group: 'Пины из вашего скетча',
      disabled: n === null,
      reason: n === null ? `Не удалось определить номер пина «${p.expr}» для этой платы` : undefined,
      icon: 'pin'
    })
  }
  for (const bp of boardPins(platform, role)) {
    const bad = bp.problem?.severity === 'error'
    items.push({
      id: `b:${bp.pin}`,
      title: bp.label,
      detail: [bp.note, bp.problem && !bad ? bp.problem.message : ''].filter(Boolean).join(' · ') || undefined,
      group: platform === 'esp8266' ? 'Пины платы (ESP8266)' : 'Пины платы (ESP32)',
      disabled: bad,
      reason: bp.problem?.message
    })
  }
  items.push({ id: OTHER_PIN, title: 'Другой номер…', group: 'Прочее', action: true, icon: 'edit' })

  const chosen = b.pin >= 0
  const value = !chosen ? null : b.pinName ? `s:${b.pinName}` : `b:${b.pin}`
  const sketchPin = b.pinName ? sketchPins.find((p) => p.name === b.pinName) : undefined
  const set = (patch: Partial<PinB>): void => st().setBinding(el.id, { ...b, ...patch })

  const modeTitle = (m: 'digital' | 'analog'): string =>
    b.direction === 'toPin'
      ? m === 'digital'
        ? 'Вкл/выкл'
        : 'ШИМ (плавно)'
      : m === 'digital'
        ? 'Вкл/выкл'
        : 'Число (analogRead)'

  return (
    <div className="uib-source">
      {modes.length > 1 && (
        <>
          <div className="uib-field-label">Как читать пин?</div>
          <div className="uib-seg" role="radiogroup">
            {modes.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={b.mode === m} className={b.mode === m ? 'on' : ''} onClick={() => set({ mode: m })}>
                {modeTitle(m)}
              </button>
            ))}
          </div>
        </>
      )}
      <label className="uib-field-label" htmlFor="uib-pin-picker">
        Какой пин?
      </label>
      <Picker
        id="uib-pin-picker"
        items={items}
        value={value}
        invalid={!chosen}
        placeholder="Выберите пин…"
        onPick={(it) => {
          if (it.id === OTHER_PIN) {
            setOther(true)
            return
          }
          setOther(false)
          if (it.id.startsWith('s:')) {
            const sp = sketchPins.find((p) => p.name === it.id.slice(2))
            const n = sp ? resolvePin(sp, platform) : null
            if (sp && n !== null) set({ pin: n, pinName: sp.name })
          } else {
            const next: PinB = { ...b, pin: Number(it.id.slice(2)) }
            delete next.pinName
            st().setBinding(el.id, next)
          }
        }}
        describeValue={(v) => <b>{v}</b>}
      />
      {other && (
        <div className="uib-row-inline">
          <input
            className="uib-input mono"
            type="number"
            min={0}
            max={48}
            autoFocus
            placeholder="номер GPIO"
            aria-label="Номер GPIO"
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isInteger(n) && n >= 0) {
                const next: PinB = { ...b, pin: n }
                delete next.pinName
                st().setBinding(el.id, next)
              }
            }}
          />
        </div>
      )}
      {chosen && b.pinName && (
        <p className="uib-hint">
          В код попадёт имя <code>{b.pinName}</code> из вашего скетча (сейчас это {boardPinLabel(platform, b.pin)}) — если измените его там, страница подхватит.
        </p>
      )}
      {chosen && !b.pinName && <p className="uib-hint">В код попадёт номер {b.pin}. Если в скетче есть <code>#define</code> для пина — выберите его в списке выше.</p>}
      {b.mode === 'digital' && (
        <label className="uib-check">
          <input type="checkbox" checked={!!b.invert} onChange={(e) => set({ invert: e.target.checked })} />
          <span>
            Инвертировать
            <small>«Включено» = низкий уровень (LOW). Нужно для реле и светодиодов, подключённых к плюсу.</small>
          </span>
        </label>
      )}
      {b.mode === 'digital' && b.direction === 'fromPin' && (
        <label className="uib-check">
          <input type="checkbox" checked={b.pull === 'up'} onChange={(e) => set({ pull: e.target.checked ? 'up' : 'none' })} />
          <span>
            Подтяжка к питанию
            <small>INPUT_PULLUP — для кнопки, замыкающей пин на землю.</small>
          </span>
        </label>
      )}
      {sketchPin && ctx.host && (
        <button className="uib-link-btn" onClick={() => ctx.host?.goToLine(sketchPin.line)}>
          <Icon name="code" size={13} /> Перейти в код — строка {sketchPin.line}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- функции

function FnSource({ el, fn }: { el: UiElement; fn: string }): ReactNode {
  const ctx = useBuilder()
  const st = useUiBuilder.getState
  const def = WIDGETS[el.type]
  const [creating, setCreating] = useState(false)
  const funcs = (ctx.sketch?.funcs ?? []).filter((f) => f.isCallback && f.name !== 'setup' && f.name !== 'loop')
  const items: PickerItem[] = funcs.map((f) => ({ id: `f:${f.name}`, title: `${f.name}()`, detail: `строка ${f.line}`, group: 'Функции из вашего скетча', icon: 'func' }))
  items.push({ id: NEW_FN, title: 'Новая функция…', group: 'Новая', action: true, icon: 'plus' })
  const found = ctx.sketch?.funcs.find((f) => f.name === fn)
  const [name, setName] = useState(() => defaultCallbackName(el.id))
  const prob = identProblem(name) ?? (ctx.sketch?.names.has(name) && !ctx.sketch.funcs.some((f) => f.name === name && f.isCallback) ? 'это имя уже занято в скетче' : null)
  const events = def.events.length ? def.events.map((n) => `${n} = ${EVENT[n]}`).join(', ') : ''
  return (
    <div className="uib-source">
      <label className="uib-field-label" htmlFor="uib-fn-picker">
        Какая функция?
      </label>
      <Picker
        id="uib-fn-picker"
        items={items}
        value={fn ? `f:${fn}` : null}
        invalid={!fn}
        placeholder="Выберите функцию…"
        emptyText="В скетче нет функций вида void имя(Control* sender, int type)"
        describeValue={(v) => <b>{v.slice(2)}()</b>}
        onPick={(it) => {
          if (it.id === NEW_FN) {
            setCreating(true)
            return
          }
          setCreating(false)
          st().setBinding(el.id, { kind: 'callback', fn: it.id.slice(2) })
        }}
      />
      {creating && (
        <form
          className="uib-newvar"
          onSubmit={(e) => {
            e.preventDefault()
            if (!prob) {
              st().setBinding(el.id, { kind: 'callback', fn: name })
              setCreating(false)
            }
          }}
        >
          <div className="uib-newvar-title">Новая функция</div>
          <input className={`uib-input mono${prob ? ' bad' : ''}`} value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Имя функции" />
          {prob && <div className="uib-field-error">{prob}</div>}
          <div className="uib-row-actions">
            <button type="submit" className="uib-btn primary" disabled={!!prob}>
              Выбрать
            </button>
            <button type="button" className="uib-btn" onClick={() => setCreating(false)}>
              Отмена
            </button>
          </div>
        </form>
      )}
      {fn && !found && ctx.sketch && (
        <div className="uib-note warn">
          <Icon name="warn" size={14} />
          <span>Функции «{fn}» в скетче ещё нет.</span>
          {ctx.host && (
            <button
              className="uib-btn small"
              onClick={() => {
                ctx.host?.replaceSketchCode(addCallbackStub(ctx.host.sketchCode, fn, el.type, el.label))
                st().showToast(`Функция ${fn}() добавлена в конец скетча`)
              }}
            >
              Добавить заготовку в скетч
            </button>
          )}
        </div>
      )}
      {fn && found && ctx.host && (
        <button className="uib-link-btn" onClick={() => ctx.host?.goToLine(found.line)}>
          <Icon name="code" size={13} /> Перейти в код — строка {found.line}
        </button>
      )}
      <p className="uib-hint">
        Функция получает <code>(Control* sender, int type)</code>: <code>type</code> — что случилось{events ? ` (${events})` : ''}, <code>sender-&gt;value</code> — значение текстом.
      </p>
    </div>
  )
}


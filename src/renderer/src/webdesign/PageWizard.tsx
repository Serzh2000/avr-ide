// Мастер «Страница для устройства»: модальное окно, которое ведёт школьника по шагам.
// К любому шагу можно вернуться (слева список шагов). Ответы сохраняются в web_design.json.
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import './wizard.css'
import {
  WIZ_ACCENTS, WIZ_KINDS, WIZ_STARTERS, buildFromWizard, buildPreviewHtml, defaultWizardSpec, newWizItem, pinChoices,
  suggestVarName, wizardProblems, pinIsSafe, checkPin, suggestPin
} from './core/index'
import type { Platform, WizAccent, WizItem, WizKind, WizardSpec } from './core/index'
import type { SketchInfo } from '../uibuilder/sketch/parse'
import { Button, Dialog } from '../shell/kit'

type Step = 'start' | 'items' | 'links' | 'wifi' | 'look' | 'done'
const STEPS: Array<{ id: Step; title: string; sub: string }> = [
  { id: 'start', title: 'Начало', sub: 'Название и идея' },
  { id: 'items', title: 'Что на странице', sub: 'Кнопки, ползунки, датчики' },
  { id: 'links', title: 'Подключение', sub: 'Пины и переменные' },
  { id: 'wifi', title: 'Wi‑Fi', sub: 'Как открыть страницу' },
  { id: 'look', title: 'Оформление', sub: 'Цвет и тема' },
  { id: 'done', title: 'Готово', sub: 'Проверка и подключение' }
]
const KIND_ORDER: WizKind[] = ['switch', 'button', 'slider', 'sensor', 'indicator', 'gauge', 'chart']
const KIND_ICON: Record<WizKind, string> = { switch: '⏻', button: '●', slider: '⇆', sensor: '°', indicator: '◉', gauge: '◔', chart: '∿' }

export interface PageWizardProps {
  platform: Platform
  /** Ответы прошлого раза (project.wizard) или null — новая страница. */
  initial: WizardSpec | null
  /** Страница уже есть, но собрана не мастером: при «Готово» она заменится. */
  replacesManual: boolean
  sketch: SketchInfo | null
  /** Скетч уже подключён к странице. */
  connected: boolean
  /** Плата не поддерживает веб-страницу (не ESP32 / ESP8266 / Pico W). */
  noBoard: boolean
  onClose: () => void
  /** Применить: проект собран; дальше — подключение к скетчу. */
  onFinish: (spec: WizardSpec) => void
}

export default function PageWizard(props: PageWizardProps): ReactNode {
  const { platform, initial, sketch, onClose, onFinish } = props
  const [spec, setSpec] = useState<WizardSpec>(() => initial ?? defaultWizardSpec(platform))
  const [step, setStep] = useState<Step>(initial?.items.length ? 'done' : 'start')
  const [seen, setSeen] = useState<Set<Step>>(() => new Set(initial?.items.length ? STEPS.map((s) => s.id) : ['start']))
  const problems = useMemo(() => wizardProblems(spec), [spec])
  const idx = STEPS.findIndex((s) => s.id === step)

  const go = (s: Step): void => { setStep(s); setSeen((v) => new Set(v).add(s)) }
  const patch = (fn: (s: WizardSpec) => void): void => setSpec((prev) => { const n = JSON.parse(JSON.stringify(prev)) as WizardSpec; fn(n); return n })
  const patchItem = (id: string, fn: (it: WizItem) => void): void => patch((s) => { const it = s.items.find((x) => x.id === id); if (it) fn(it) })
  const stepProblems = (s: Step): string[] => problems.filter((p) => p.step === s).map((p) => p.text)

  const body: Record<Step, () => ReactNode> = {
    start: () => (
      <>
        <h3 className="pw-q">Как назовём страницу?</h3>
        <input className="pw-input pw-title" value={spec.title} maxLength={80} placeholder="Например: Умная теплица" onChange={(e) => patch((s) => { s.title = e.target.value })} data-testid="wz-title" autoFocus />
        <details className="pw-more">
          <summary>Добавить подзаголовок</summary>
          <input className="pw-input" value={spec.subtitle} maxLength={160} placeholder="Например: 8 «Б», проект по физике" onChange={(e) => patch((s) => { s.subtitle = e.target.value })} />
        </details>
        <h3 className="pw-q">С чего начнём?</h3>
        <p className="pw-hint">Выберите готовую идею — элементы можно будет поменять на следующем шаге.</p>
        <div className="pw-cards">
          {WIZ_STARTERS.map((st) => (
            <button key={st.id} type="button" className="pw-card" data-testid={'wz-starter-' + st.id} onClick={() => {
              if (spec.items.length && !window.confirm('Заменить уже выбранные элементы?')) return
              patch((s) => {
                s.items = []
                st.kinds.forEach((k, i) => s.items.push(newWizItem(platform, k, s.items, st.labels?.[i])))
                if (!s.title.trim() || s.title === 'Моё устройство' || WIZ_STARTERS.some((x) => x.title2 === s.title)) s.title = st.title2
              })
              go('items')
            }}>
              <b>{st.title}</b><span>{st.hint}</span>
            </button>
          ))}
        </div>
      </>
    ),
    items: () => (
      <>
        <h3 className="pw-q">Что будет на странице?</h3>
        {spec.items.length === 0 && <p className="pw-hint">Пока пусто. Нажмите на элемент ниже, чтобы добавить его.</p>}
        <ol className="pw-items">
          {spec.items.map((it, i) => {
            const k = WIZ_KINDS[it.kind]
            return (
              <li key={it.id} className="pw-item" data-testid="wz-item">
                <span className="pw-ic" aria-hidden>{KIND_ICON[it.kind]}</span>
                <div className="pw-item-main">
                  <span className="pw-kind">{k.title}</span>
                  <input className="pw-input" value={it.label} maxLength={60} aria-label={`Название: ${k.title}`} onChange={(e) => patchItem(it.id, (x) => { x.label = e.target.value })} />
                  {k.range && (
                    <details className="pw-more">
                      <summary>Диапазон: {it.min} … {it.max} {it.unit}</summary>
                      <div className="pw-range">
                        <label>от <input className="pw-input" type="number" value={it.min ?? 0} onChange={(e) => patchItem(it.id, (x) => { x.min = Number(e.target.value) })} /></label>
                        <label>до <input className="pw-input" type="number" value={it.max ?? 100} onChange={(e) => patchItem(it.id, (x) => { x.max = Number(e.target.value) })} /></label>
                        <label>единицы <input className="pw-input" value={it.unit ?? ''} maxLength={12} onChange={(e) => patchItem(it.id, (x) => { x.unit = e.target.value })} /></label>
                      </div>
                    </details>
                  )}
                </div>
                <div className="pw-item-acts">
                  <button type="button" className="icon-btn" title="Выше" disabled={i === 0} onClick={() => patch((s) => { const [x] = s.items.splice(i, 1); s.items.splice(i - 1, 0, x) })}>↑</button>
                  <button type="button" className="icon-btn" title="Ниже" disabled={i === spec.items.length - 1} onClick={() => patch((s) => { const [x] = s.items.splice(i, 1); s.items.splice(i + 1, 0, x) })}>↓</button>
                  <button type="button" className="icon-btn" title="Убрать" onClick={() => patch((s) => { s.items.splice(i, 1) })}>✕</button>
                </div>
              </li>
            )
          })}
        </ol>
        <h4 className="pw-sub">Добавить</h4>
        <div className="pw-cards small">
          {KIND_ORDER.map((k) => (
            <button key={k} type="button" className="pw-card" data-testid={'wz-add-' + k} onClick={() => patch((s) => { s.items.push(newWizItem(platform, k, s.items)) })}>
              <b><span className="pw-ic" aria-hidden>{KIND_ICON[k]}</span> {WIZ_KINDS[k].title}</b><span>{WIZ_KINDS[k].hint}</span>
            </button>
          ))}
        </div>
      </>
    ),
    links: () => (
      <>
        <h3 className="pw-q">Как каждый элемент связан с платой?</h3>
        <p className="pw-hint"><b>Пин</b> — элемент сам включает светодиод или читает датчик, код писать не нужно. <b>Переменная</b> — значение попадает в переменную скетча, а что с ним делать, решает ваш код.</p>
        {spec.items.length === 0 && <p className="pw-hint">Сначала добавьте элементы на шаге «Что на странице».</p>}
        {spec.items.map((it) => <LinkRow key={it.id} it={it} spec={spec} platform={platform} sketch={sketch} patchItem={patchItem} />)}
      </>
    ),
    wifi: () => (
      <>
        <h3 className="pw-q">Как телефон найдёт страницу?</h3>
        <div className="pw-cards two">
          <button type="button" className={'pw-card' + (spec.wifi.mode === 'ap' ? ' on' : '')} data-testid="wz-wifi-ap" onClick={() => patch((s) => { s.wifi.mode = 'ap' })}>
            <b>Своя сеть платы</b><span>Плата сама раздаёт Wi‑Fi. Подключитесь к ней телефоном и откройте 192.168.4.1. Работает где угодно.</span>
          </button>
          <button type="button" className={'pw-card' + (spec.wifi.mode === 'sta' ? ' on' : '')} data-testid="wz-wifi-sta" onClick={() => patch((s) => { s.wifi.mode = 'sta' })}>
            <b>Домашний Wi‑Fi</b><span>Плата подключается к вашему роутеру. Адрес страницы появится в «Мониторе порта».</span>
          </button>
        </div>
        {spec.wifi.mode === 'ap' ? (
          <div className="pw-form">
            <label>Имя сети<input className="pw-input" value={spec.wifi.apSsid} maxLength={32} onChange={(e) => patch((s) => { s.wifi.apSsid = e.target.value })} /></label>
            <label>Пароль <span className="pw-dim">(не меньше 8 символов или пусто — без пароля)</span><input className="pw-input" value={spec.wifi.apPassword} maxLength={63} onChange={(e) => patch((s) => { s.wifi.apPassword = e.target.value })} /></label>
          </div>
        ) : (
          <div className="pw-form">
            <label>Имя домашней сети<input className="pw-input" value={spec.wifi.ssid} maxLength={32} onChange={(e) => patch((s) => { s.wifi.ssid = e.target.value })} data-testid="wz-ssid" /></label>
            <label>Пароль от неё<input className="pw-input" type="password" value={spec.wifi.password} maxLength={63} onChange={(e) => patch((s) => { s.wifi.password = e.target.value })} /></label>
            <p className="pw-hint">Пароль попадёт в код прошивки. Не выкладывайте такой скетч в открытый доступ.</p>
          </div>
        )}
      </>
    ),
    look: () => (
      <>
        <h3 className="pw-q">Какого цвета будет страница?</h3>
        <div className="pw-swatches">
          {(Object.keys(WIZ_ACCENTS) as WizAccent[]).map((a) => (
            <button key={a} type="button" className={'pw-swatch' + (spec.accent === a ? ' on' : '')} title={WIZ_ACCENTS[a].title} aria-label={WIZ_ACCENTS[a].title} style={{ background: WIZ_ACCENTS[a].light }} onClick={() => patch((s) => { s.accent = a })} />
          ))}
        </div>
        <h3 className="pw-q">Тема</h3>
        <div className="seg pw-seg">
          {([['auto', 'Как на телефоне'], ['light', 'Светлая'], ['dark', 'Тёмная']] as const).map(([v, t]) => (
            <button key={v} type="button" className={spec.theme === v ? 'on' : ''} onClick={() => patch((s) => { s.theme = v })}>{t}</button>
          ))}
        </div>
        <PreviewFrame spec={spec} platform={platform} />
      </>
    ),
    done: () => {
      const all = problems
      return (
        <>
          <h3 className="pw-q">{all.length ? 'Осталось кое-что поправить' : 'Всё готово!'}</h3>
          {all.length > 0 && (
            <ul className="pw-problems">
              {all.map((p, i) => <li key={i}><button type="button" className="link-btn" onClick={() => go(p.step)}>{STEPS.find((s) => s.id === p.step)?.title}</button>: {p.text}</li>)}
            </ul>
          )}
          <PreviewFrame spec={spec} platform={platform} />
          <ol className="pw-next">
            <li>Нажмите «{props.connected ? 'Сохранить страницу' : 'Подключить к скетчу'}» — IDE сама допишет нужные строки в скетч.</li>
            <li>Нажмите «Загрузить» вверху, чтобы прошить плату.</li>
            <li>{spec.wifi.mode === 'ap'
              ? <>Подключите телефон к сети <b>{spec.wifi.apSsid || '…'}</b> и откройте <b>192.168.4.1</b>.</>
              : <>Откройте «Монитор порта»: там будет адрес страницы, его нужно ввести в браузере телефона.</>}</li>
          </ol>
          {props.replacesManual && <p className="pw-warn">Страница, которую вы правили в расширенном режиме, будет заменена собранной мастером.</p>}
          {props.noBoard && <p className="pw-warn">Выберите вверху плату с Wi‑Fi: ESP32, ESP8266 или Raspberry Pi Pico W — иначе страницу не к чему подключить.</p>}
        </>
      )
    }
  }

  const last = idx === STEPS.length - 1
  return (
    <div className="modal-backdrop">
      <Dialog className="pw" testid="wz" title="Страница для устройства" icon="web" onClose={onClose}
        footerStart={idx > 0 ? <Button onClick={() => go(STEPS[idx - 1].id)} data-testid="wz-back">Назад</Button> : null}
        footer={last
          ? <Button variant="primary" disabled={problems.length > 0 || props.noBoard} data-testid="wz-finish" onClick={() => onFinish(spec)}>{props.connected ? 'Сохранить страницу' : 'Подключить к скетчу'}</Button>
          : <Button variant="primary" data-testid="wz-next" disabled={step === 'items' && spec.items.length === 0} onClick={() => go(STEPS[idx + 1].id)}>Далее</Button>}>
        <div className="pw-body">
          <nav className="pw-steps" aria-label="Шаги мастера">
            {STEPS.map((s, i) => {
              const bad = s.id !== 'done' && stepProblems(s.id).length > 0 && seen.has(s.id) && s.id !== step
              return (
                <button key={s.id} type="button" className={'pw-step' + (s.id === step ? ' on' : '') + (seen.has(s.id) ? ' seen' : '') + (bad ? ' bad' : '')}
                  data-testid={'wz-step-' + s.id} disabled={!seen.has(s.id) && i > idx + 1} onClick={() => go(s.id)} aria-current={s.id === step ? 'step' : undefined}>
                  <span className="pw-num">{i + 1}</span>
                  <span className="pw-step-t"><b>{s.title}</b><span>{s.sub}</span></span>
                </button>
              )
            })}
          </nav>
          <section className="pw-main" data-testid={'wz-page-' + step}>
            {body[step]()}
            {step !== 'done' && stepProblems(step).length > 0 && <ul className="pw-problems">{stepProblems(step).map((t, i) => <li key={i}>{t}</li>)}</ul>}
          </section>
        </div>
      </Dialog>
    </div>
  )
}

function LinkRow({ it, spec, platform, sketch, patchItem }: { it: WizItem; spec: WizardSpec; platform: Platform; sketch: SketchInfo | null; patchItem: (id: string, fn: (it: WizItem) => void) => void }): ReactNode {
  const k = WIZ_KINDS[it.kind]
  const pins = pinChoices(platform, k.pinRole)
  const fits = (sketch?.vars ?? []).filter((v) => v.type && (v.type === k.varType || (k.varType !== 'bool' && (v.type === 'int' || v.type === 'float'))))
  const taken = new Set(spec.items.flatMap((x) => (x.id !== it.id && x.link.kind === 'var' ? [x.link.name] : [])))
  for (const v of sketch?.vars ?? []) taken.add(v.name)
  const usedPins = new Set(spec.items.flatMap((x) => (x.id !== it.id && x.link.kind === 'pin' ? [x.link.pin] : [])))
  return (
    <div className="pw-link" data-testid="wz-link">
      <div className="pw-link-head"><span className="pw-ic" aria-hidden>{KIND_ICON[it.kind]}</span><b>{it.label || k.title}</b><span className="pw-dim">{k.title}</span></div>
      <div className="seg pw-seg">
        <button type="button" className={it.link.kind === 'pin' ? 'on' : ''} disabled={!pins.length} onClick={() => patchItem(it.id, (x) => { x.link = { kind: 'pin', pin: suggestPin(platform, k.pinRole, usedPins) } })}>Пин платы</button>
        <button type="button" className={it.link.kind === 'var' ? 'on' : ''} onClick={() => patchItem(it.id, (x) => { x.link = { kind: 'var', name: suggestVarName(x.label || k.defaultLabel, taken), existing: false } })}>Переменная в скетче</button>
      </div>
      {it.link.kind === 'pin' ? (
        <label className="pw-line">{k.pinHint}
          <select className="pw-input" value={it.link.pin} onChange={(e) => patchItem(it.id, (x) => { x.link = { kind: 'pin', pin: Number(e.target.value) } })}>
            {pins.map((p) => <option key={p.pin} value={p.pin}>{p.label}{usedPins.has(p.pin) ? ' — уже занят' : !pinIsSafe(platform, p.pin, k.pinRole) ? ' — лучше не использовать' : ''}</option>)}
          </select>
          {checkPin(platform, it.link.pin, k.pinRole).map((pp, i) => <span key={i} className="pw-pin-warn">{pp.message}</span>)}
        </label>
      ) : (
        <div className="pw-line">
          {fits.length > 0 && (
            <div className="seg pw-seg">
              <button type="button" className={!it.link.existing ? 'on' : ''} onClick={() => patchItem(it.id, (x) => { x.link = { kind: 'var', name: suggestVarName(x.label || k.defaultLabel, taken), existing: false } })}>Новая</button>
              <button type="button" className={it.link.existing ? 'on' : ''} onClick={() => patchItem(it.id, (x) => { x.link = { kind: 'var', name: fits[0].name, existing: true } })}>Уже есть в скетче</button>
            </div>
          )}
          {it.link.existing && fits.length > 0 ? (
            <select className="pw-input" value={it.link.name} onChange={(e) => patchItem(it.id, (x) => { x.link = { kind: 'var', name: e.target.value, existing: true } })}>
              {fits.map((v) => <option key={v.name} value={v.name}>{v.ctype} {v.name}</option>)}
            </select>
          ) : (
            <label className="pw-line">Имя переменной — {k.varHint.toLowerCase()}
              <input className="pw-input mono" value={it.link.name} maxLength={40} onChange={(e) => patchItem(it.id, (x) => { if (x.link.kind === 'var') x.link = { ...x.link, name: e.target.value.replace(/[^A-Za-z0-9_]/g, '') } })} />
            </label>
          )}
          {!it.link.existing && <p className="pw-hint">Страница сама объявит <code>{k.varType} {it.link.name}</code>. В скетче её можно читать и менять, например {k.pinRole.startsWith('out') ? <code>if ({it.link.name}) …</code> : <code>{it.link.name} = датчик.read();</code>}</p>}
        </div>
      )}
    </div>
  )
}

function PreviewFrame({ spec, platform }: { spec: WizardSpec; platform: Platform }): ReactNode {
  const html = useMemo(() => buildPreviewHtml(buildFromWizard(spec, platform)), [spec, platform])
  return <iframe className="pw-preview" title="Как будет выглядеть страница" sandbox="allow-scripts" srcDoc={html} data-testid="wz-preview" />
}

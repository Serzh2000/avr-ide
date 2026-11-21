// Вкладка «Выводы»: слева дерево периферии, в центре схема корпуса, справа инспектор выбранного вывода или периферии.
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { isUsartName, usartInfo } from '../../../../shared/pro/pinconfig/gen/support'
import { assignSignal, autoPlace, clearPin, disablePeripheral, enablePeripheral, patchPin, setGpioRole, setPeriphParam, unassignSignal } from '../../../../shared/pro/pinconfig/ops'
import { assignable, GUARD_LABEL, isAnalogSignal, periphOf, signalPart, signalPins, usageText } from '../../../../shared/pro/pinconfig/model'
import { usartBrr } from '../../../../shared/pro/pinconfig/clock'
import type { GpioRole, OType, PinsConfig, Pull, Speed } from '../../../../shared/pro/pinconfig/types'
import { Button, Chip, EmptyState, Field, Select } from '../../shell/kit'
import { confirmDialog } from '../../shell/dialogs'
import { Icon } from '../../shell/icons'
import { useUi } from '../../shell/ui'
import PackageView, { Legend } from './PackageView'
import { fmtHz } from './pinsModel'
import type { PinsModel } from './pinsModel'
import { usePins } from './pinsStore'

const PULL_LABEL: Record<Pull, string> = { none: 'нет', up: 'к питанию', down: 'к земле' }
const SPEED_LABEL: Record<Speed, string> = { low: 'низкая', medium: 'средняя', high: 'высокая', veryhigh: 'очень высокая' }
const BAUDS = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]

/** Группа периферии по типу: USART1, USART2 → USART. */
const typeOf = (n: string): string => n.replace(/\d+$/, '') || n

// ---------- дерево периферии ----------

function Tree({ model, cfg }: { model: PinsModel; cfg: PinsConfig }): ReactNode {
  const edit = usePins((s) => s.edit)
  const sel = usePins((s) => s.sel)
  const select = usePins((s) => s.select)
  const [q, setQ] = useState('')
  const groups = useMemo(() => {
    const m = new Map<string, typeof model.periphs>()
    for (const p of model.periphs) {
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) continue
      const t = typeOf(p.name)
      m.set(t, [...(m.get(t) ?? []), p])
    }
    return [...m.entries()]
  }, [model.periphs, q])
  const on = Object.values(cfg.peripherals).filter((p) => p.enabled).length
  const toggle = (name: string, v: boolean): void => {
    if (v) { edit((c) => enablePeripheral(c, model.chip, name)); select({ kind: 'periph', name }) }
    else edit((c) => disablePeripheral(c, name))
  }
  return (
    <aside className="pc-tree" data-testid="pins-tree" aria-label="Периферия">
      <div className="pc-tree-head">
        <input className="input" type="search" placeholder="Найти периферию…" aria-label="Найти периферию" value={q} onChange={(e) => setQ(e.target.value)} data-testid="pins-tree-search" />
        <div className="dim small">Включено: {on} из {model.periphs.length}</div>
      </div>
      <div className="pc-tree-list">
        {groups.length === 0 && <div className="pc-empty dim small">Ничего не найдено.</div>}
        {groups.map(([type, list]) => (
          <section key={type} className="pc-tree-group">
            <h4>{type}</h4>
            {list.map((p) => {
              const per = cfg.peripherals[p.name]
              const pins = per ? Object.values(per.signals) : []
              const conflict = per?.enabled && pins.some((pin) => model.conflicts.has(pin))
              const active = sel?.kind === 'periph' && sel.name === p.name
              return (
                <div key={p.name} className={'pc-per' + (active ? ' on' : '') + (conflict ? ' bad' : '')} data-testid="pins-periph" data-periph={p.name} data-enabled={per?.enabled ? '1' : '0'}>
                  <input type="checkbox" className="switch sm" checked={!!per?.enabled} onChange={(e) => toggle(p.name, e.target.checked)} aria-label={`Включить ${p.name}`} data-testid="pins-periph-toggle" />
                  <button className="pc-per-name" onClick={() => select({ kind: 'periph', name: p.name })} title={`Показать ${p.name}: сигналы и выводы`}>
                    <b>{p.name}</b>
                    <span className="dim small">{per?.enabled ? (pins.length ? pins.join(', ') : 'выводы не назначены') : `${p.signals.length} сигн.`}</span>
                  </button>
                  {conflict && <span className="pc-badge err" title="Конфликт выводов">!</span>}
                </div>
              )
            })}
          </section>
        ))}
      </div>
    </aside>
  )
}

// ---------- инспектор вывода ----------

interface Option { id: string; group: string; label: string; hint?: string; current: boolean; run: (c: PinsConfig) => PinsConfig }

function PinInspector({ model, cfg, pin }: { model: PinsModel; cfg: PinsConfig; pin: string }): ReactNode {
  const edit = usePins((s) => s.edit)
  const [q, setQ] = useState('')
  const row = model.pkg.pins.find((r) => r[1] === pin)
  const io = !!row && row[2] === 'io'
  const fam = model.family
  const pc = cfg.pins[pin]
  const usage = model.usage.get(pin) ?? []
  const guards = (model.guards.get(pin) ?? []).filter((g) => g.kind !== 'jtag')
  const issues = model.issues.filter((i) => i.pin === pin)
  if (!row) return null
  if (!io) {
    return (
      <div className="pc-insp-body">
        <h3>{row[1]} <span className="dim small">вывод {row[0]}</span></h3>
        <p className="dim">{row[2] === 'power' || row[2] === 'mono' ? 'Питание или земля: не настраивается.' : row[2] === 'reset' ? 'Вход сброса NRST: не настраивается.' : 'BOOT0 выбирает, откуда стартует микроконтроллер: не настраивается.'}</p>
      </div>
    )
  }
  const guardNames = [...new Set(guards.map((g) => GUARD_LABEL[g.kind]))].join(' / ')

  const options: Option[] = []
  options.push({ id: 'none', group: 'Режим', label: 'Не используется', current: usage.length === 0, run: (c) => clearPin(c, pin, true) })
  const gp = (role: GpioRole, label: string, hint?: string): void => { options.push({ id: 'gpio-' + role, group: 'Режим', label, hint, current: usage.some((u) => u.kind === 'gpio' && u.role === role), run: (c) => setGpioRole(c, pin, role) }) }
  gp('input', 'GPIO: вход'); gp('output', 'GPIO: выход'); gp('analog', 'Аналоговый вход'); gp('exti', 'Внешнее прерывание (EXTI)', 'код прерывания не генерируется')
  for (const f of assignable(row)) {
    const sig = f[0]
    const per = cfg.peripherals[periphOf(sig)]
    const where = per?.signals[sig]
    options.push({
      id: sig, group: 'Функции периферии', label: sig,
      hint: [f[1] >= 0 ? `AF${f[1]}` : '', f[2] ? `ремап ${f[2].split('|').join(' или ')}` : '', where && where !== pin ? `сейчас на ${where}` : ''].filter(Boolean).join(' · ') || undefined,
      current: where === pin && !!per?.enabled, run: (c) => assignSignal(c, pin, sig)
    })
  }
  const shown = options.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase()) || (o.hint ?? '').toLowerCase().includes(q.toLowerCase()))
  const groups = [...new Set(shown.map((o) => o.group))]

  const apply = async (o: Option): Promise<void> => {
    if (o.id !== 'none' && guards.length && !pc?.confirmed) {
      const r = await confirmDialog({
        title: `Занять защищённый вывод ${pin}?`,
        message: `${pin} — вывод ${guardNames}: ${guards[0].text}. Если занять его без необходимости, можно потерять доступ к отладке или остановить генератор. Продолжить?`,
        buttons: [{ id: 'ok', label: 'Занять вывод', kind: 'danger' }, { id: 'cancel', label: 'Отмена' }]
      })
      if (r !== 'ok') return
      edit((c) => patchPin(o.run(c), pin, { confirmed: true }))
      return
    }
    edit(o.run)
  }

  const role = usage[0]
  const gpioRole = role?.kind === 'gpio' ? role.role : null
  const isAf = role?.kind === 'af' && !isAnalogSignal(role.signal)
  const labelErr = issues.find((i) => i.code === 'label' || i.code === 'label-dup')
  const patch = (p: Parameters<typeof patchPin>[2]): void => edit((c) => patchPin(c, pin, p))
  const speeds: Speed[] = fam === 'f1' ? ['low', 'medium', 'high'] : ['low', 'medium', 'high', 'veryhigh']
  const speedNow: Speed = (pc?.speed ?? (isAf ? 'high' : 'low'))
  const hasParams = gpioRole === 'input' || gpioRole === 'output' || gpioRole === 'exti' || isAf

  return (
    <div className="pc-insp-body" data-testid="pins-inspector" data-pin={pin}>
      <h3 data-testid="pins-insp-title">{pin} <span className="dim small">вывод {row[0]}{row[3] ? ` · ${row[3]}` : ''}</span></h3>
      {guards.length > 0 && (
        <div className="pc-note warn" data-testid="pins-guard"><Icon name="warn" size={14} /><span><b>{guardNames}.</b> {guards[0].text}.{pc?.confirmed ? ' Занят по вашему подтверждению.' : ' Выбор функции попросит подтверждение.'}</span></div>
      )}
      {issues.filter((i) => i.severity !== 'info').map((i, k) => (
        <div key={k} className={'pc-note ' + (i.severity === 'error' ? 'err' : 'warn')} data-testid="pins-issue"><Icon name={i.severity === 'error' ? 'error' : 'warn'} size={14} /><span>{i.message}</span></div>
      ))}
      <Field label="Метка" stack hint="Имя в gpio.h: LED даёт LED_PORT, LED_PIN, LED_SET()" error={labelErr?.message}>
        <input className={'input' + (labelErr ? ' invalid' : '')} value={pc?.label ?? ''} placeholder="LED, BTN …" spellCheck={false} data-testid="pins-label"
          onChange={(e) => patch({ label: e.target.value })} />
      </Field>
      <h4>Функция вывода</h4>
      <input className="input" type="search" placeholder="Найти функцию: USART, TIM, I2C…" aria-label="Найти функцию вывода" value={q} onChange={(e) => setQ(e.target.value)} data-testid="pins-func-search" />
      <div className="pc-funcs" data-testid="pins-funcs">
        {groups.map((g) => (
          <div key={g}>
            <div className="pc-funcs-group">{g}</div>
            {shown.filter((o) => o.group === g).map((o) => (
              <button key={o.id} className={'pc-func' + (o.current ? ' on' : '')} data-testid="pins-func" data-func={o.id} aria-pressed={o.current} onClick={() => void apply(o)}>
                <span className="pc-radio" aria-hidden="true">{o.current && <Icon name="check" size={12} />}</span>
                <span className="mono">{o.label}</span>
                {o.hint && <span className="dim small">{o.hint}</span>}
              </button>
            ))}
          </div>
        ))}
        {shown.length === 0 && <div className="pc-empty dim small">Такой функции на этом выводе нет.</div>}
      </div>
      {hasParams && (
        <div className="pc-params" data-testid="pins-params">
          <h4>Параметры</h4>
          <Field label="Подтяжка"><Select value={pc?.pull ?? 'none'} onChange={(e) => patch({ pull: e.target.value as Pull })} data-testid="pins-pull">{(['none', 'up', 'down'] as Pull[]).map((p) => <option key={p} value={p}>{PULL_LABEL[p]}</option>)}</Select></Field>
          {gpioRole === 'output' && (
            <>
              <Field label="Тип выхода"><Select value={pc?.otype ?? 'pp'} onChange={(e) => patch({ otype: e.target.value as OType })} data-testid="pins-otype"><option value="pp">двухтактный</option><option value="od">открытый сток</option></Select></Field>
              <Field label="Начальный уровень"><Select value={pc?.initial ?? 'low'} onChange={(e) => patch({ initial: e.target.value as 'low' | 'high' })} data-testid="pins-initial"><option value="low">низкий (0)</option><option value="high">высокий (1)</option></Select></Field>
            </>
          )}
          {(gpioRole === 'output' || isAf) && (
            <Field label="Скорость фронта"><Select value={speedNow} onChange={(e) => patch({ speed: e.target.value as Speed })} data-testid="pins-speed">{speeds.map((s) => <option key={s} value={s}>{SPEED_LABEL[s]}{fam === 'f1' ? ` (${s === 'low' ? 2 : s === 'medium' ? 10 : 50} МГц)` : ''}</option>)}</Select></Field>
          )}
          {isAf && fam !== 'f1' && (
            <Field label="Тип выхода"><Select value={pc?.otype ?? (role && role.kind === 'af' && /^I2C/.test(role.periph) ? 'od' : 'pp')} onChange={(e) => patch({ otype: e.target.value as OType })}><option value="pp">двухтактный</option><option value="od">открытый сток</option></Select></Field>
          )}
          {gpioRole === 'exti' && (
            <Field label="Фронт" hint="Настройка EXTI в коде пока вручную"><Select value={pc?.edge ?? 'falling'} onChange={(e) => patch({ edge: e.target.value as 'rising' | 'falling' | 'both' })}><option value="rising">нарастающий</option><option value="falling">спадающий</option><option value="both">оба</option></Select></Field>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- инспектор периферии ----------

function PeriphInspector({ model, cfg, name }: { model: PinsModel; cfg: PinsConfig; name: string }): ReactNode {
  const edit = usePins((s) => s.edit)
  const info = model.periphs.find((p) => p.name === name)
  const per = cfg.peripherals[name]
  if (!info) return null
  const issues = model.issues.filter((i) => i.periph === name)
  const usart = isUsartName(name) ? usartInfo(model.chip, name) : null
  const supported = !!usart
  const fck = usart ? (usart.bus === 'apb1' ? model.clock.pclk1 : model.clock.pclk2) : 0
  const brr = usart && per?.baud && fck ? usartBrr(fck, per.baud) : null
  const hasBusy = per?.enabled && Object.values(per.signals).some((p) => model.conflicts.has(p))
  return (
    <div className="pc-insp-body" data-testid="pins-inspector" data-periph={name}>
      <h3>{name} <Chip tone={supported ? 'ok' : undefined} title={supported ? 'Инициализацию этой периферии генерирует AVR IDE' : 'Выводы настроены, инициализация периферии — вручную'}>{supported ? 'инициализация генерируется' : 'инициализация вручную'}</Chip></h3>
      <label className="pc-switch"><input type="checkbox" className="switch" checked={!!per?.enabled} onChange={(e) => edit((c) => (e.target.checked ? enablePeripheral(c, model.chip, name) : disablePeripheral(c, name)))} data-testid="pins-insp-enable" /><span>Включена</span></label>
      {issues.filter((i) => i.severity !== 'info').map((i, k) => (
        <div key={k} className={'pc-note ' + (i.severity === 'error' ? 'err' : 'warn')} data-testid="pins-issue"><Icon name={i.severity === 'error' ? 'error' : 'warn'} size={14} /><span>{i.message}</span></div>
      ))}
      {hasBusy && <Button size="sm" data-testid="pins-autoplace" onClick={() => { const r = autoPlace(cfg, model.chip, name); if (r) edit(() => r); else useUi.getState().notify('Свободных выводов для всех сигналов нет — освободите вывод вручную.') }}>Подобрать свободные выводы</Button>}
      {per?.enabled && usart && (
        <Field label="Скорость" hint={brr ? `Шина ${fmtHz(fck)} → фактически ${Math.round(brr.actualBaud)} бод (ошибка ${brr.errorPct.toFixed(2)} %). Кадр 8N1.` : 'Кадр 8N1.'}>
          <span className="pc-baud">
            <Select value={BAUDS.includes(per.baud ?? 0) ? String(per.baud) : 'x'} data-testid="pins-baud" onChange={(e) => { if (e.target.value !== 'x') edit((c) => setPeriphParam(c, name, { baud: Number(e.target.value) })) }}>
              {!BAUDS.includes(per.baud ?? 0) && <option value="x">{per.baud} бод</option>}
              {BAUDS.map((b) => <option key={b} value={b}>{b} бод</option>)}
            </Select>
          </span>
        </Field>
      )}
      {per?.enabled && (
        <>
          <h4>Выводы сигналов</h4>
          <div className="pc-sigs">
            {info.signals.map((s) => {
              const cur = per.signals[s]
              const cands = signalPins(model.pkg, s)
              return (
                <div key={s} className="pc-sig" data-testid="pins-sig" data-signal={s}>
                  <span className="mono">{signalPart(s)}</span>
                  <Select value={cur ?? ''} aria-label={`Вывод для ${s}`} data-testid="pins-sig-pin" onChange={(e) => edit((c) => (e.target.value ? assignSignal(c, e.target.value, s) : unassignSignal(c, name, s)))}>
                    <option value="">не назначен</option>
                    {cands.map((p) => {
                      const u = model.usage.get(p.pin)?.filter((x) => !(x.kind === 'af' && x.signal === s))
                      return <option key={p.pin} value={p.pin}>{p.pin}{p.af >= 0 ? ` · AF${p.af}` : ''}{p.remap ? ' · ремап' : ''}{u && u.length ? ` · занят: ${usageText(u[0])}` : ''}</option>
                    })}
                  </Select>
                </div>
              )
            })}
          </div>
        </>
      )}
      {!per?.enabled && <p className="dim">Включите периферию — выводы сигналов подберутся автоматически, их можно изменить.</p>}
    </div>
  )
}

// ---------- вкладка ----------

export default function PinoutTab({ model, cfg }: { model: PinsModel; cfg: PinsConfig }): ReactNode {
  const sel = usePins((s) => s.sel)
  // в узкой вкладке инспектор лежит под схемой: после выбора вывода показываем его (в широкой он и так на виду)
  useEffect(() => { if (sel) document.querySelector('.pc-insp')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [sel])
  const select = usePins((s) => s.select)
  const highlight = useMemo(() => {
    const s = new Set<string>()
    if (sel?.kind === 'periph') for (const f of model.pkg.pins) if (f[2] === 'io' && f[4].some((x) => periphOf(x[0]) === sel.name)) s.add(f[1])
    return s
  }, [sel, model.pkg])
  return (
    <div className="pc-pinout" data-testid="pins-pinout">
      <Tree model={model} cfg={cfg} />
      <section className="pc-center" aria-label="Схема корпуса">
        <Legend />
        <PackageView pkg={model.pkg} cfg={cfg} usage={model.usage} guards={model.guards} conflicts={model.conflicts} chipName={model.chip.name}
          selected={sel?.kind === 'pin' ? sel.pin : null} highlight={highlight} onSelect={(pin) => select({ kind: 'pin', pin })} />
        <div className="dim small pc-hint">Щёлкните вывод — выберите его функцию. Пунктиром отмечены выводы, на которых есть сигналы выбранной периферии.</div>
      </section>
      <aside className="pc-insp" aria-label="Инспектор">
        {sel?.kind === 'pin' ? <PinInspector model={model} cfg={cfg} pin={sel.pin} key={'p' + sel.pin} /> :
          sel?.kind === 'periph' ? <PeriphInspector model={model} cfg={cfg} name={sel.name} key={'d' + sel.name} /> :
            <EmptyState icon="board" title="Ничего не выбрано" hint="Выберите вывод на схеме или периферию слева — здесь появятся настройки." />}
      </aside>
    </div>
  )
}


// Нижняя панель «Отладка» Pro-режима: управление выполнением, переменные и watch, регистры CPU, стек, точки останова, память, дизассемблер, периферия (SVD).
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../shell/icons'
import { Button, EmptyState, Tabs } from '../shell/kit'
import { fieldValue, withField } from '../../../main/pro/debug/svd'
import type { SvdField, SvdRegister } from '../../../main/pro/debug/svd'
import { promptDialog } from '../shell/dialogs'
import { useProject } from '../shell/project'
import { useProStore } from './proStore'
import { SIDE_EFFECT, useHw } from './hwStore'
import './hw.css'

type Sub = 'vars' | 'regs' | 'stack' | 'bps' | 'mem' | 'dis' | 'svd'
const SUBS: { id: Sub; label: string }[] = [
  { id: 'vars', label: 'Переменные' }, { id: 'regs', label: 'Регистры' }, { id: 'stack', label: 'Стек' }, { id: 'bps', label: 'Точки останова' },
  { id: 'mem', label: 'Память' }, { id: 'dis', label: 'Дизассемблер' }, { id: 'svd', label: 'Периферия' }
]

const h8 = (n: number): string => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0')
const base = (p: string): string => p.replace(/\\/g, '/').split('/').pop() ?? p
const parseAddr = (s: string): number | null => {
  const t = s.trim().replace(/^0x/i, '')
  return /^[0-9a-f]{1,8}$/i.test(t) ? parseInt(t, 16) : null
}

const STATE_LABEL = { off: 'Не запущена', starting: 'Запуск…', running: 'Выполняется', stopped: 'Остановлена' } as const

export function DebugToolbar(): ReactNode {
  const st = useHw((s) => s.debug.status)
  const reason = useHw((s) => s.debug.reason)
  const stopLine = useHw((s) => s.debug.stopLine)
  const stopFile = useHw((s) => s.debug.stopFile)
  const config = useProStore((s) => s.config)
  const { run, startDebug, stopDebug, loadProgram } = useHw.getState()
  const stopped = st === 'stopped'
  const where = stopped && stopFile && stopLine ? ` · ${base(stopFile)}:${stopLine}` : ''
  return (
    <div className="panel-actions dbg-bar" data-testid="dbg-toolbar">
      {st === 'off' || st === 'starting'
        ? <Button variant="primary" size="sm" onClick={() => void startDebug(config)} loading={st === 'starting'} data-testid="dbg-start"><Icon name="bug" size={14} /> Начать отладку</Button>
        : <>
          {st === 'running'
            ? <button className="icon-btn dbg-btn" data-testid="dbg-pause" title="Пауза" aria-label="Пауза" onClick={() => void run('pause')}><Icon name="pause" size={15} /></button>
            : <button className="icon-btn dbg-btn ok" data-testid="dbg-resume" title="Продолжить (F5)" aria-label="Продолжить" disabled={!stopped} onClick={() => void run('resume')}><Icon name="play" size={15} fill /></button>}
          <button className="icon-btn dbg-btn" data-testid="dbg-over" title="Шаг с обходом (F10)" aria-label="Шаг с обходом" disabled={!stopped} onClick={() => void run('stepOver')}><Icon name="stepOver" size={15} /></button>
          <button className="icon-btn dbg-btn" data-testid="dbg-into" title="Шаг внутрь (F11)" aria-label="Шаг внутрь" disabled={!stopped} onClick={() => void run('stepInto')}><Icon name="stepInto" size={15} /></button>
          <button className="icon-btn dbg-btn" data-testid="dbg-out" title="Шаг наружу (Shift+F11)" aria-label="Шаг наружу" disabled={!stopped} onClick={() => void run('stepOut')}><Icon name="stepOut" size={15} /></button>
          <button className="icon-btn dbg-btn err" data-testid="dbg-stop" title="Остановить отладку (Shift+F5)" aria-label="Остановить отладку" onClick={() => void stopDebug()}><Icon name="stop" size={14} fill /></button>
        </>}
      <span className={'dbg-state ' + st} data-testid="dbg-state" data-state={st}>{STATE_LABEL[st]}{where}{stopped && reason && reason !== 'end-stepping-range' ? ` · ${REASON[reason] ?? reason}` : ''}</span>
      <span className="grow" />
      {st !== 'off' && st !== 'starting' && <Button size="sm" onClick={() => void loadProgram()} disabled={!stopped} data-testid="dbg-load" title="Записать .elf во Flash микроконтроллера (с подтверждением). Обычная отладка в плату ничего не пишет.">Загрузить программу в устройство…</Button>}
    </div>
  )
}

const REASON: Record<string, string> = { 'breakpoint-hit': 'точка останова', 'signal-received': 'пауза', 'function-finished': 'выход из функции', 'location-reached': 'достигнуто место' }

function Table({ head, children, testid }: { head: string[]; children: ReactNode; testid?: string }): ReactNode {
  return (
    <table className="dbg-table" data-testid={testid}>
      <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  )
}

function Vars(): ReactNode {
  const locals = useHw((s) => s.locals)
  const watches = useHw((s) => s.watches)
  const st = useHw((s) => s.debug.status)
  const { addWatch, removeWatch } = useHw.getState()
  const [expr, setExpr] = useState('')
  return (
    <div className="dbg-pane">
      <Table head={['Локальные переменные', 'Тип', 'Значение']} testid="dbg-locals">
        {locals.length ? locals.map((v) => <tr key={v.name} data-testid="dbg-var" data-name={v.name}><td>{v.name}</td><td className="dim">{v.type}</td><td className="mono">{v.value}</td></tr>)
          : <tr><td colSpan={3} className="dim">{st === 'stopped' ? 'Нет локальных переменных в этом месте.' : 'Появятся после остановки программы.'}</td></tr>}
      </Table>
      <Table head={['Наблюдаемые выражения', '', 'Значение']} testid="dbg-watches">
        {watches.length ? watches.map((w) => (
          <tr key={w.expr} data-testid="dbg-watch" data-expr={w.expr}>
            <td className="mono">{w.expr}</td>
            <td><button className="icon-btn" aria-label={`Убрать ${w.expr}`} title="Убрать" onClick={() => removeWatch(w.expr)}><Icon name="x" size={12} /></button></td>
            <td className={'mono' + (w.error ? ' hw-bad' : '')}>{w.error ?? w.value ?? '—'}</td>
          </tr>
        )) : <tr><td colSpan={3} className="dim">Добавьте выражение, чтобы видеть его значение при остановках.</td></tr>}
      </Table>
      <form className="dbg-add" onSubmit={(e) => { e.preventDefault(); void addWatch(expr); setExpr('') }}>
        <input className="input" value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="Например, counter * 2" data-testid="dbg-watch-input" aria-label="Новое выражение" spellCheck={false} />
        <Button size="sm" type="submit" disabled={!expr.trim()} data-testid="dbg-watch-add">Следить</Button>
      </form>
    </div>
  )
}

function Regs(): ReactNode {
  const regs = useHw((s) => s.regs)
  const prev = useHw((s) => s.prevRegs)
  const names = Object.keys(regs)
  if (!names.length) return <p className="dim dbg-empty">Регистры появятся после остановки программы.</p>
  return (
    <div className="dbg-regs" data-testid="dbg-regs">
      {names.map((n) => (
        <div key={n} className={'dbg-reg' + (n in prev && prev[n] !== regs[n] ? ' changed' : '')} data-testid="dbg-reg" data-name={n}>
          <b>{n}</b><span className="mono" title="Шестнадцатеричное значение">{h8(regs[n])}</span>
          <span className="dim mono" title="Десятичное значение со знаком"><small aria-hidden="true">dec</small> {regs[n] | 0}</span>
        </div>
      ))}
    </div>
  )
}

function Stack(): ReactNode {
  const stack = useHw((s) => s.stack)
  const frame = useHw((s) => s.frame)
  const { selectFrame } = useHw.getState()
  if (!stack.length) return <p className="dim dbg-empty">Стек вызовов появится после остановки программы.</p>
  return (
    <div className="dbg-pane" data-testid="dbg-stack">
      {stack.map((f) => (
        <button key={f.index} className={'dbg-frame' + (f.index === frame ? ' on' : '')} data-testid="dbg-frame" data-index={f.index} onClick={() => void selectFrame(f.index)}>
          <span className="dim">#{f.index}</span> <b>{f.function}</b> <span className="dim">{f.file ? `${base(f.file)}:${f.line ?? '?'}` : h8(f.pc)}</span>
        </button>
      ))}
    </div>
  )
}

function Bps(): ReactNode {
  const bps = useHw((s) => s.bps)
  const { removeBp, setCondition, addFunctionBreakpoint } = useHw.getState()
  const root = useProject((s) => s.root)
  const [fn, setFn] = useState('')
  const rel = (f: string): string => { const n = f.replace(/\\/g, '/'); const r = root?.replace(/\\/g, '/'); return r && n.toLowerCase().startsWith(r.toLowerCase() + '/') ? n.slice(r.length + 1) : base(f) }
  return (
    <div className="dbg-pane" data-testid="dbg-bps">
      {bps.length ? bps.map((b, i) => (
        <div key={`${b.file}:${b.line}:${i}`} className="dbg-bp" data-testid="dbg-bp" data-line={b.line}>
          <span className={'dbg-dot' + (b.verified === false ? ' off' : '')} aria-hidden="true" />
          <button className="dbg-bp-loc" title="Открыть место в редакторе" onClick={() => void useProject.getState().openFile(b.file, { line: b.line })}>{rel(b.file)}:{b.line}</button>
          {b.condition && <span className="mono dim">если {b.condition}</span>}
          <span className="grow" />
          <button className="icon-btn" title="Условие остановки" aria-label="Условие остановки" onClick={async () => {
            const v = await promptDialog({ title: 'Условие остановки', label: 'Остановка только если выражение истинно (пусто — всегда)', value: b.condition ?? '', okLabel: 'Применить' })
            if (v !== null) void setCondition(b, v.trim())
          }}><Icon name="edit" size={13} /></button>
          <button className="icon-btn" title="Убрать точку останова" aria-label="Убрать точку останова" data-testid="dbg-bp-remove" onClick={() => void removeBp(b)}><Icon name="x" size={13} /></button>
        </div>
      )) : <p className="dim dbg-empty">Точек останова нет. Щёлкните слева от номера строки в редакторе, чтобы поставить точку (аппаратную, до шести штук).</p>}
      <form className="dbg-add" onSubmit={(e) => { e.preventDefault(); void addFunctionBreakpoint(fn.trim()); setFn('') }}>
        <input className="input" value={fn} onChange={(e) => setFn(e.target.value)} placeholder="Остановиться в функции, например main" aria-label="Имя функции" spellCheck={false} data-testid="dbg-fn-input" />
        <Button size="sm" type="submit" disabled={!fn.trim()}>На функции</Button>
      </form>
    </div>
  )
}

function Mem(): ReactNode {
  const mem = useHw((s) => s.mem)
  const st = useHw((s) => s.debug.status)
  const { readMem } = useHw.getState()
  const [addr, setAddr] = useState('0x20000000')
  const a = parseAddr(addr)
  const rows: ReactNode[] = []
  if (mem) for (let i = 0; i < mem.bytes.length; i += 16) {
    const chunk = mem.bytes.slice(i, i + 16)
    rows.push(<div key={i} className="dbg-memrow mono" data-testid="dbg-memrow"><span className="dim">{h8(mem.address + i)}</span><span>{chunk.map((b) => b.toString(16).padStart(2, '0')).join(' ')}</span><span className="dim">{chunk.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('')}</span></div>)
  }
  return (
    <div className="dbg-pane">
      <form className="dbg-add" onSubmit={(e) => { e.preventDefault(); if (a !== null) void readMem(a) }}>
        <input className="input mono" value={addr} onChange={(e) => setAddr(e.target.value)} aria-label="Адрес памяти (hex)" data-testid="dbg-mem-addr" spellCheck={false} placeholder="Адрес, например 20000000 или 0x08000000" />
        <Button size="sm" type="submit" disabled={a === null || st !== 'stopped'} data-testid="dbg-mem-read">Показать 256 байт</Button>
      </form>
      {rows.length ? <div className="dbg-mem" data-testid="dbg-mem">{rows}</div> : <p className="dim dbg-empty">{st === 'stopped' ? 'Введите адрес и нажмите «Показать». Чтение памяти не меняет состояние платы.' : 'Память читается, когда программа остановлена.'}</p>}
    </div>
  )
}

function Dis(): ReactNode {
  const dis = useHw((s) => s.disasm)
  const pc = useHw((s) => s.regs['pc'])
  if (!dis.length) return <p className="dim dbg-empty">Дизассемблер появится после остановки программы.</p>
  return (
    <div className="dbg-mem" data-testid="dbg-dis">
      {dis.map((d) => (
        <div key={d.address} className={'dbg-memrow mono' + (d.address === pc ? ' cur' : '')} data-testid="dbg-dis-row">
          <span className="dim">{h8(d.address)}</span><span>{d.text.replace(/\t/g, ' ')}</span><span className="dim">{d.func ? `${d.func}+${d.offset ?? 0}` : ''}</span>
        </div>
      ))}
    </div>
  )
}

function SvdRegisterRow({ periph, base: pBase, reg }: { periph: string; base: number; reg: SvdRegister }): ReactNode {
  const val = useHw((s) => s.svdValues[reg.name])
  const st = useHw((s) => s.debug.status)
  const { writeMem } = useHw.getState()
  const [open, setOpen] = useState(false)
  const addr = pBase + reg.offset
  const ro = !!reg.access && /^read-only$/i.test(reg.access)
  const edit = async (f: SvdField | null, label: string): Promise<void> => {
    const cur = val ?? 0
    const v = await promptDialog({ title: `Записать в ${periph}.${reg.name}${f ? '.' + f.name : ''}`, label: `Новое значение ${label} (число, 0x… для hex)`, value: String(f ? fieldValue(cur, f) : cur), okLabel: 'Далее',
      validate: (t) => (Number.isFinite(Number(t.trim())) && t.trim() !== '' && Number(t) >= 0 && Number(t) <= 0xffffffff ? null : 'Введите целое число') })
    if (v === null) return
    const next = f ? withField(cur, f, Number(v)) : Number(v) >>> 0
    const bytes = [next & 255, (next >>> 8) & 255, (next >>> 16) & 255, (next >>> 24) & 255]
    if (await writeMem(addr, bytes, `${periph}.${reg.name}${f ? '.' + f.name : ''} = ${v}`)) {
      const r = await window.api.pro.debug.readMemory(addr, 4)
      if (r.ok) useHw.setState((s) => ({ svdValues: { ...s.svdValues, [reg.name]: (r.data[0] | (r.data[1] << 8) | (r.data[2] << 16) | (r.data[3] << 24)) >>> 0 } }))
    }
  }
  const readOne = async (): Promise<void> => {
    const r = await window.api.pro.debug.readMemory(addr, 4)
    if (r.ok) useHw.setState((s) => ({ svdValues: { ...s.svdValues, [reg.name]: (r.data[0] | (r.data[1] << 8) | (r.data[2] << 16) | (r.data[3] << 24)) >>> 0 } }))
  }
  return (
    <div className="svd-reg" data-testid="svd-reg" data-name={reg.name}>
      <div className="svd-reg-head">
        <button className="icon-btn" aria-label={open ? 'Свернуть' : 'Развернуть'} aria-expanded={open} onClick={() => setOpen(!open)}><Icon name={open ? 'chevD' : 'chevR'} size={13} /></button>
        <b>{reg.name}</b><span className="dim mono">{h8(addr)}</span>
        <span className="grow dim svd-desc">{reg.description}</span>
        <span className="mono" data-testid="svd-value">{val !== undefined ? h8(val) : SIDE_EFFECT.test(reg.name) ? 'читается по клику' : '—'}</span>
        {SIDE_EFFECT.test(reg.name) && st === 'stopped' && <button className="icon-btn" title="Прочитать (чтение этого регистра может изменить состояние периферии)" aria-label="Прочитать регистр" onClick={() => void readOne()}><Icon name="refresh" size={13} /></button>}
        {!ro && st === 'stopped' && <button className="icon-btn" title="Записать значение (потребуется подтверждение)" aria-label="Записать значение" data-testid="svd-write" onClick={() => void edit(null, 'регистра')}><Icon name="edit" size={13} /></button>}
      </div>
      {open && reg.fields.map((f) => (
        <div key={f.name} className="svd-field" data-testid="svd-field" data-name={f.name}>
          <span className="mono dim">[{f.bitWidth > 1 ? `${f.bitOffset + f.bitWidth - 1}:${f.bitOffset}` : f.bitOffset}]</span> <b>{f.name}</b>
          <span className="grow dim svd-desc">{f.description}</span>
          {val !== undefined && <span className="mono">{fieldValue(val, f)}{f.enums.find((e) => e.value === fieldValue(val, f)) ? ` · ${f.enums.find((e) => e.value === fieldValue(val, f))!.name}` : ''}</span>}
          {!ro && !/^read-only$/i.test(f.access ?? '') && val !== undefined && st === 'stopped' && <button className="icon-btn" aria-label={`Записать поле ${f.name}`} title="Записать значение поля (потребуется подтверждение)" onClick={() => void edit(f, 'поля')}><Icon name="edit" size={12} /></button>}
        </div>
      ))}
    </div>
  )
}

function Svd(): ReactNode {
  const svd = useHw((s) => s.svd)
  const periph = useHw((s) => s.svdPeriph)
  const st = useHw((s) => s.debug.status)
  const config = useProStore((s) => s.config)
  const { loadSvd, downloadSvd, openPeripheral, readPeripheral } = useHw.getState()
  const [q, setQ] = useState('')
  useEffect(() => { if (svd.status === 'idle') void loadSvd(config) }, [svd.status, config]) // eslint-disable-line react-hooks/exhaustive-deps
  // вернулись на вкладку: вдруг файл SVD уже скачали или положили вручную
  useEffect(() => { if (svd.status === 'missing' || svd.status === 'none' || svd.status === 'error') void loadSvd(config) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (svd.status === 'idle' || svd.status === 'loading') return <p className="dim dbg-empty">Загружаю описание регистров…</p>
  if (svd.status === 'none') return <p className="dim dbg-empty">Для этого чипа нет файла SVD в справочнике. Можно указать его в avride.project.json в поле «svd».</p>
  if (svd.status === 'error') return <p className="hw-bad dbg-empty">{svd.error}</p>
  if (svd.status === 'missing' || svd.status === 'downloading') {
    return (
      <EmptyState icon="download" title="Нужно описание регистров (SVD)" hint="Файл SVD перечисляет периферию микроконтроллера: регистры и поля с названиями. Он скачивается один раз (около 1 МБ) из открытого репозитория modm-io/cmsis-svd-stm32 после вашего подтверждения.">
        <Button variant="primary" size="sm" loading={svd.status === 'downloading'} onClick={() => void downloadSvd(config)} data-testid="svd-download">Скачать SVD…</Button>
      </EmptyState>
    )
  }
  const list = (svd.list ?? []).filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div className="svd" data-testid="svd">
      <div className="svd-list">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти периферию: GPIOA, USART1…" aria-label="Поиск периферии" spellCheck={false} data-testid="svd-search" />
        <div className="svd-items">
          {list.map((p) => (
            <button key={p.name} className={'svd-item' + (periph?.name === p.name ? ' on' : '')} data-testid="svd-periph" data-name={p.name} onClick={() => void openPeripheral(p.name)} title={p.description}>
              <b>{p.name}</b> <span className="dim mono">{h8(p.base)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="svd-detail">
        {periph ? (
          <>
            <div className="svd-title"><b>{periph.name}</b> <span className="dim">{periph.description}</span><span className="grow" />
              <Button size="sm" onClick={() => void readPeripheral()} disabled={st !== 'stopped'} data-testid="svd-read" title="Прочитать значения регистров (кроме регистров данных)">Прочитать</Button></div>
            {st !== 'stopped' && <p className="dim hw-note">Значения читаются, когда программа остановлена.</p>}
            {periph.registers.map((r) => <SvdRegisterRow key={r.name} periph={periph.name} base={periph.base} reg={r} />)}
          </>
        ) : <p className="dim dbg-empty">Выберите периферию слева.</p>}
      </div>
    </div>
  )
}

export default function DebugPanel(): ReactNode {
  const [sub, setSub] = useState<Sub>('vars')
  const st = useHw((s) => s.debug.status)
  const err = useHw((s) => s.debug.error)
  const config = useProStore((s) => s.config)
  const project = useProStore((s) => s.project)
  const nBp = useHw((s) => s.bps.length)
  return (
    <div className="panel-body dbg" data-testid="dbg-panel">
      <DebugToolbar />
      {err && st === 'off' && (
        <div className="hw-card err hw-inline" role="alert" data-testid="dbg-error" data-kind={err.kind}>
          <div className="hw-card-title"><Icon name="error" size={15} /> {err.title}</div>
          <p className="hw-card-text">{err.hint}</p>
        </div>
      )}
      {st === 'off' && !err ? (
        <EmptyState icon="bug" title="Отладка не запущена" hint={project ? 'Отладка подключается к плате через программатор (ST-Link, J-Link или CMSIS-DAP), останавливает программу в начале main и позволяет ходить по строкам. Программа в плате при этом не меняется. Сначала соберите проект (конфигурация Debug) и поставьте точки останова щелчком слева от номера строки.' : 'Откройте проект STM32.'}>
          <Button variant="primary" size="sm" onClick={() => void useHw.getState().startDebug(config)} disabled={!project} data-testid="dbg-start-empty">Начать отладку</Button>
        </EmptyState>
      ) : (
        <>
          <Tabs<Sub> className="seg-sub dbg-tabs" label="Разделы отладки" items={SUBS.map((s) => ({ id: s.id, label: s.id === 'bps' && nBp ? `${s.label} (${nBp})` : s.label }))} value={sub} onChange={setSub} />
          <div className="dbg-body" data-testid={'dbg-sec-' + sub}>
            {sub === 'vars' && <Vars />}
            {sub === 'regs' && <Regs />}
            {sub === 'stack' && <Stack />}
            {sub === 'bps' && <Bps />}
            {sub === 'mem' && <Mem />}
            {sub === 'dis' && <Dis />}
            {sub === 'svd' && <Svd />}
          </div>
        </>
      )}
    </div>
  )
}

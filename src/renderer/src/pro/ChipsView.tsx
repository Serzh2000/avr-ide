// «Справочник STM32» для Pro-режима: каталог чипов из базы src/shared/pro (open-pin-data, CMSIS).
// Самодостаточный компонент: подключается в любую область редактора, ничего не знает об оболочке.
//   <ChipsView initialChip="stm32f103c8" onOpenBoard={(id) => …} />
import { useMemo, useState, type ReactNode } from 'react'
import { Button, Chip, Field, Select, Tabs } from '../shell/kit'
import { BOARD_FACTS } from '../../../shared/pro/boardFacts'
import { CHIP_SOURCES, analogChannels, boardsForChip, getChip, getPackage, listChips, pinsBySignal, searchChips, specialPins, type ChipRecord, type FuncRow, type PinRow } from '../../../shared/pro/chipdb'
import { boards } from '../reference/data'
import './chips.css'

type Tab = 'overview' | 'pins' | 'periph' | 'files'
const HEX = (n: number): string => '0x' + n.toString(16).toUpperCase().padStart(8, '0')
const SIZE = (b: number): string => (b >= 1048576 ? `${b / 1048576} МБ` : `${b / 1024} КБ`)
const QUICK = ['USART1_TX', 'USART1_RX', 'I2C1', 'SPI1', 'ADC', 'TIM2_CH1', 'CAN', 'USB']
const stBoards = boards.filter((b) => b.platform === 'stm32')

/** Группировка экземпляров периферии по типу: USART1, USART2 → USART. */
function groupPeriph(list: string[]): [string, string[]][] {
  const m = new Map<string, string[]>()
  for (const p of list) {
    const k = p.replace(/\d+$/, '') || p
    m.set(k, [...(m.get(k) ?? []), p])
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

function FuncTag({ f, hit }: { f: FuncRow; hit: boolean }): ReactNode {
  const title = f[2] ? `Только при ремапе AFIO: ${f[2]}` : f[1] >= 0 ? `Альтернативная функция AF${f[1]}` : 'Аналоговая или системная функция (номера AF нет)'
  return (
    <span className={'chips-fn' + (hit ? ' hit' : '') + (f[2] ? ' remap' : '')} title={title}>
      {f[1] >= 0 && <i>AF{f[1]}</i>}{f[0]}{f[2] && <i className="rm">remap</i>}
    </span>
  )
}

function Overview({ chip, onOpenBoard }: { chip: ChipRecord; onOpenBoard?: (id: string) => void }): ReactNode {
  const brd = boardsForChip(chip, stBoards)
  const facts = BOARD_FACTS.filter((f) => f.chip === chip.id)
  return (
    <div className="chips-sec" data-testid="chips-overview">
      <div className="chips-facts">
        <div><span>Ядро</span><b>{chip.core}{chip.fpu ? ' + FPU' : ''}</b></div>
        <div><span>Частота</span><b>до {chip.maxMHz} МГц</b></div>
        <div><span>Flash</span><b>{chip.flashKB} КБ</b></div>
        <div><span>ОЗУ</span><b>{chip.ramKB} КБ</b></div>
        <div><span>Питание</span><b>{chip.voltage[0]}–{chip.voltage[1]} В</b></div>
        <div><span>Температура</span><b>{chip.tempC[0]}…{chip.tempC[1]} °C</b></div>
        <div><span>Идентификатор</span><b title="DBGMCU_IDCODE.DEV_ID (по open-pin-data)">{chip.dieId.replace('DIE', '0x')}</b></div>
        <div><span>Корпуса</span><b>{chip.packages.map((p) => `${p.name} (${p.pins.length})`).join(', ')}</b></div>
      </div>
      <h4>Карта памяти</h4>
      <table className="chips-table" data-testid="chips-memory">
        <thead><tr><th>Область</th><th>Адрес</th><th>Размер</th><th>Откуда</th></tr></thead>
        <tbody>{chip.regions.map((r) => <tr key={r[0]}><td><b>{r[0]}</b></td><td className="mono">{HEX(r[1])}</td><td>{SIZE(r[2])}</td><td className="dim">{r[4]}</td></tr>)}</tbody>
      </table>
      <h4>Платы с этим чипом</h4>
      {brd.length === 0 && facts.length === 0 && <p className="dim">В справочнике плат нет плат с этим чипом.</p>}
      <div className="chips-boards">
        {brd.map((b) => {
          const f = facts.find((x) => x.board === b.id)
          return (
            <div className="chips-board" key={b.id}>
              <b>{b.name}</b>
              {f?.led && <span className="dim">светодиод {f.led}{f.button ? `, кнопка ${f.button}` : ''}</span>}
              {onOpenBoard && <Button size="sm" onClick={() => onOpenBoard(b.id)}>Распиновка</Button>}
            </div>
          )
        })}
        {facts.filter((f) => !f.board).map((f) => (
          <div className="chips-board" key={f.name}><b>{f.name}</b><span className="dim">светодиод {f.led}, кнопка {f.button}; платы пока нет в справочнике</span></div>
        ))}
      </div>
      {chip.notes.length > 0 && <><h4>Оговорки</h4><ul className="chips-notes">{chip.notes.map((n) => <li key={n}>{n}</li>)}</ul></>}
    </div>
  )
}

function Pins({ chip }: { chip: ChipRecord }): ReactNode {
  const [pkgName, setPkg] = useState(chip.packages[0].name)
  const [q, setQ] = useState('')
  const [onlyIo, setOnlyIo] = useState(false)
  const pkg = getPackage(chip, pkgName)
  const hits = useMemo(() => (q.trim() ? new Set(pinsBySignal(pkg, q.trim()).map((h) => h.pos)) : null), [pkg, q])
  const rows: PinRow[] = pkg.pins.filter((r) => (hits ? hits.has(r[0]) : onlyIo ? r[2] === 'io' : true))
  const sp = specialPins(pkg)
  const needle = q.trim().toLowerCase()
  return (
    <div className="chips-sec" data-testid="chips-pins">
      <div className="chips-filter">
        {chip.packages.length > 1 && (
          <Field label="Корпус"><Select aria-label="Корпус" value={pkgName} onChange={(e) => setPkg(e.target.value)}>{chip.packages.map((p) => <option key={p.name} value={p.name}>{p.name} · {p.pins.length} выводов</option>)}</Select></Field>
        )}
        <Field label="Сигнал" hint="Часть названия: USART1_TX, I2C1, ADC, TIM2_CH1"><input className="chips-input" data-testid="chips-signal" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти вывод по сигналу" aria-label="Фильтр по сигналу" /></Field>
        <label className="chips-check"><input type="checkbox" checked={onlyIo} onChange={(e) => setOnlyIo(e.target.checked)} />Только порты ввода-вывода</label>
      </div>
      <div className="chips-quick">{QUICK.map((s) => <Chip key={s} onClick={() => setQ(s === q ? '' : s)} tone={s === q ? 'accent' : undefined}>{s}</Chip>)}</div>
      <p className="dim small">{pkg.name}, {pkg.part} · показано {rows.length} из {pkg.pins.length}{hits ? ' (найдено по сигналу)' : ''}. {chip.family === 'STM32F1' ? 'F1: вместо AFn — ремап AFIO; метка «remap» значит, что функция попадает на вывод только после ремапа.' : 'AFn — номер альтернативной функции для настройки порта.'}</p>
      <div className="chips-scroll">
        <table className="chips-table" data-testid="chips-pin-table">
          <thead><tr><th>№</th><th>Вывод</th><th>Особая роль</th><th>Функции</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} className={r[2] === 'power' ? 'pwr' : undefined} data-pin={r[1]}>
                <td className="mono">{r[0]}</td>
                <td className="mono"><b>{r[1]}</b></td>
                <td className="dim">{[...new Set([r[3], ...sp.filter((s) => s.pos === r[0]).map((s) => s.role)])].filter(Boolean).join(', ')}</td>
                <td className="chips-fns">{r[4].map((f) => <FuncTag key={f[0] + (f[2] ?? '')} f={f} hit={!!needle && f[0].toLowerCase().includes(needle)} />)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="dim">Таких выводов в этом корпусе нет.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Periph({ chip }: { chip: ChipRecord }): ReactNode {
  const pkg = chip.packages[0]
  const an = analogChannels(pkg)
  return (
    <div className="chips-sec" data-testid="chips-periph">
      <div className="chips-groups">
        {groupPeriph(chip.peripherals).map(([k, l]) => (
          <div key={k} className="chips-group"><b>{k}</b><div>{l.map((p) => <Chip key={p}>{p}</Chip>)}</div></div>
        ))}
      </div>
      <h4>Аналоговые входы и выходы ({pkg.name})</h4>
      <p className="chips-analog">{an.length ? an.map((a) => <span key={a.pin + a.signal} className="chips-fn"><i>{a.pin}</i>{a.signal}</span>) : <span className="dim">нет данных</span>}</p>
    </div>
  )
}

function Files({ chip }: { chip: ChipRecord }): ReactNode {
  const f = chip.files
  const rows: [string, string, string][] = [
    ['Заголовок CMSIS', f.header, `Drivers/CMSIS/Device/ST/${chip.family}xx/Include (${f.cmsisRepo})`],
    ['Макрос устройства', f.define, 'Задаётся ключом -D при сборке (см. stm32…xx.h)'],
    ['Файл запуска (GCC)', f.startup, `${f.cmsisRepo}: Source/Templates/gcc`],
    ['Скрипт компоновщика', f.linker ?? 'нет подтверждённого имени', f.linker ? 'из примеров STM32Cube' : 'генерируется по карте памяти'],
    ['SVD (регистры)', f.svd, 'modm-io/cmsis-svd-stm32'],
    ['Цель OpenOCD', f.openocd, 'tcl/target; интерфейс — interface/stlink.cfg']
  ]
  const used = [...new Set(Object.values(chip.src))]
  return (
    <div className="chips-sec" data-testid="chips-files">
      <table className="chips-table">
        <thead><tr><th>Что</th><th>Имя</th><th>Где</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r[0]}><td>{r[0]}</td><td className="mono"><b>{r[1]}</b></td><td className="dim">{r[2]}</td></tr>)}</tbody>
      </table>
      <h4>Источники данных</h4>
      <ul className="chips-notes">{used.map((k) => <li key={k}><b>{CHIP_SOURCES[k].what}</b> — {CHIP_SOURCES[k].url}, лицензия {CHIP_SOURCES[k].license}</li>)}</ul>
    </div>
  )
}

export interface ChipsViewProps {
  /** Чип, выбранный при открытии («stm32f103c8») */
  initialChip?: string
  /** Нажатие «Распиновка» у платы с этим чипом (id платы справочника) */
  onOpenBoard?: (boardId: string) => void
}

export default function ChipsView({ initialChip, onOpenBoard }: ChipsViewProps): ReactNode {
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState('')
  const [id, setId] = useState(initialChip && getChip(initialChip) ? initialChip : listChips()[0].id)
  const [tab, setTab] = useState<Tab>('overview')
  const families = [...new Set(listChips().map((c) => c.family))]
  const found = searchChips(query).filter((c) => !family || c.family === family)
  const chip = getChip(id) ?? listChips()[0]
  return (
    <div className="chips" data-testid="chips-view">
      <aside className="chips-list">
        <div className="chips-bar">
          <input className="chips-input" data-testid="chips-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Чип, семейство, корпус…" aria-label="Поиск чипа" />
          <Select aria-label="Семейство" value={family} onChange={(e) => setFamily(e.target.value)}><option value="">Все семейства</option>{families.map((f) => <option key={f} value={f}>{f}</option>)}</Select>
        </div>
        <div className="chips-items" role="listbox" aria-label="Чипы">
          {found.map((c) => (
            <button key={c.id} role="option" aria-selected={c.id === chip.id} className={'chips-item' + (c.id === chip.id ? ' on' : '')} data-chip={c.id} onClick={() => setId(c.id)}>
              <b>{c.name}</b>
              <span className="dim">{c.core} · {c.flashKB} КБ / {c.ramKB} КБ · {c.packages.map((p) => p.name).join(', ')}</span>
            </button>
          ))}
          {found.length === 0 && <p className="dim chips-empty">Ничего не найдено. Попробуйте «f4», «lqfp64» или «cortex-m7».</p>}
        </div>
      </aside>
      <section className="chips-card">
        <header className="chips-head">
          <h2>{chip.name}</h2>
          <span className="dim">{chip.line} · {chip.family}</span>
        </header>
        <Tabs<Tab> label="Разделы чипа" value={tab} onChange={setTab} className="chips-tabs" items={[{ id: 'overview', label: 'Обзор' }, { id: 'pins', label: 'Выводы' }, { id: 'periph', label: 'Периферия' }, { id: 'files', label: 'Файлы для проекта' }]} />
        <div className="chips-body">
          {tab === 'overview' && <Overview chip={chip} onOpenBoard={onOpenBoard} />}
          {tab === 'pins' && <Pins key={chip.id} chip={chip} />}
          {tab === 'periph' && <Periph chip={chip} />}
          {tab === 'files' && <Files chip={chip} />}
        </div>
      </section>
    </div>
  )
}

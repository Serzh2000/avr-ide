// «Выводы и тактирование»: визуальный конфигуратор выводов и тактирования проекта STM32 (как STM32CubeMX, но проще).
// Данные — avride.pins.json рядом с проектом и база чипов (src/shared/pro). Результат — код gpio/clock/uart/board в проекте.
import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import type { PinIssue } from '../../../../shared/pro/pinconfig/types'
import { Button, Chip, EmptyState, Select, Skeleton, Tabs } from '../../shell/kit'
import { confirmDialog } from '../../shell/dialogs'
import { Icon } from '../../shell/icons'
import { useProject } from '../../shell/project'
import { useProStore } from '../proStore'
import ClockTab from './ClockTab'
import GenerateDialog from './GenerateDialog'
import PinoutTab from './PinoutTab'
import TableTab from './TableTab'
import { usePinsModel } from './pinsModel'
import { chipOf, usePins } from './pinsStore'
import './pins.css'

function IssuesStrip({ issues }: { issues: PinIssue[] }): ReactNode {
  const select = usePins((s) => s.select)
  const setTab = usePins((s) => s.setTab)
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const list = issues.filter((i) => i.severity !== 'info')
  if (list.length === 0) return null
  return (
    <section className="pc-issue-strip" data-testid="pins-issues" aria-label="Проблемы конфигурации">
      <button className="pc-issue-toggle" type="button" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(!expanded)}>
        <Icon name={list.some((i) => i.severity === 'error') ? 'error' : 'warn'} size={14} /> Проблемы ({list.length})
      </button>
      <div className="pc-issues" id={listId} data-expanded={expanded}>
      {list.map((i, k) => (
        <button key={k} className={'pc-issue ' + (i.severity === 'error' ? 'err' : 'warn')} data-testid="pins-issue-row" data-code={i.code} data-severity={i.severity}
          onClick={() => { if (i.pin) { select({ kind: 'pin', pin: i.pin }); setTab('pinout') } else if (i.periph) { select({ kind: 'periph', name: i.periph }); setTab('pinout') } else if (/^(clock|hse|pll|vco|sys|hclk|pclk|ahb|apb)/.test(i.code)) setTab('clock') }}>
          <Icon name={i.severity === 'error' ? 'error' : 'warn'} size={14} /><span>{i.message}</span>
        </button>
      ))}
      </div>
    </section>
  )
}

export default function PinsView(): ReactNode {
  const root = useProject((s) => s.root)
  const project = useProStore((s) => s.project)
  const loading = usePins((s) => s.loading)
  const st = usePins((s) => s.state)
  const error = usePins((s) => s.error)
  const cfg = usePins((s) => s.cfg)
  const tab = usePins((s) => s.tab)
  const setTab = usePins((s) => s.setTab)
  const edit = usePins((s) => s.edit)
  const dirty = usePins((s) => s.dirty)
  const saveError = usePins((s) => s.saveError)
  const [gen, setGen] = useState(false)
  const chip = chipOf(st)
  const model = usePinsModel(chip, cfg)

  useEffect(() => { void usePins.getState().load() }, [root, project])
  // вернулись в окно — перечитываем файл (его могли править руками), несохранённые правки остаются
  useEffect(() => {
    const f = (): void => { if (!usePins.getState().dirty) void usePins.getState().load() }
    window.addEventListener('focus', f)
    return () => window.removeEventListener('focus', f)
  }, [])

  if (!root || !project) {
    return <div className="pc" data-testid="pins-view"><EmptyState icon="board" title="Нет проекта STM32" hint="Откройте или создайте проект STM32 C/C++ — конфигуратор работает с avride.pins.json рядом с проектом." /></div>
  }
  if (error) {
    return <div className="pc" data-testid="pins-view"><EmptyState icon="error" title="Не удалось открыть конфигуратор" hint={error}><Button onClick={() => void usePins.getState().load()}>Повторить</Button></EmptyState></div>
  }
  if (!st) return <div className="pc" data-testid="pins-view"><Skeleton label="Загружаю конфигурацию выводов…" rows={5} /></div>
  if (!chip) {
    return <div className="pc" data-testid="pins-view" data-state="nochip"><EmptyState icon="board" title={`Чипа ${st.chipName} нет в базе`} hint="Конфигуратору нужна таблица выводов из базы чипов. Справочник STM32 содержит 16 чипов; для остальных пока можно работать с кодом вручную." /></div>
  }
  if (st.file.exists && !st.file.ok) {
    const f = st.file
    return (
      <div className="pc" data-testid="pins-view" data-state="broken">
        <EmptyState icon="error" title="Файл avride.pins.json с ошибкой" hint={f.error}>
          <Button data-testid="pins-open-file" onClick={() => { const n = useProject.getState().tree.find((x) => x.name === 'avride.pins.json'); if (n) void useProject.getState().openFile(n.path) }}>Открыть файл</Button>
          <Button variant="danger" data-testid="pins-recreate" onClick={async () => {
            const r = await confirmDialog({ title: 'Создать конфигурацию заново?', message: 'Файл avride.pins.json будет заменён пустой конфигурацией. Ошибочное содержимое пропадёт.', buttons: [{ id: 'ok', label: 'Заменить', kind: 'danger' }, { id: 'cancel', label: 'Отмена' }] })
            if (r === 'ok') void usePins.getState().create()
          }}>Создать заново</Button>
        </EmptyState>
      </div>
    )
  }
  if (!cfg || !model) {
    return (
      <div className="pc" data-testid="pins-view" data-state="empty">
        <EmptyState icon="board" title="Конфигурации выводов ещё нет" hint={`Создайте avride.pins.json: назначайте выводы ${chip.name} на схеме корпуса, настройте тактирование и сгенерируйте код gpio, clock и uart. Файл хранится рядом с проектом.`}>
          <Button variant="primary" data-testid="pins-create" loading={loading} onClick={() => void usePins.getState().create()}>Создать конфигурацию</Button>
        </EmptyState>
      </div>
    )
  }

  const shownIssues = model.issues.filter((i) => !(tab === 'clock' && i.code === 'clock-manual'))
  const errs = shownIssues.filter((i) => i.severity === 'error').length
  const warns = shownIssues.filter((i) => i.severity === 'warning').length
  const unsupported = model.issues.find((i) => i.code === 'gen-family')
  return (
    <div className="pc" data-testid="pins-view" data-state="ready" data-chip={chip.id}>
      <header className="pc-head">
        <div className="pc-title">
          <b data-testid="pins-chip">{chip.name}</b>
          {chip.packages.length === 1 && <Chip title="Корпус из базы чипов">{model.pkg.name}</Chip>}
          {chip.packages.length > 1 && (
            <Select aria-label="Корпус" value={model.pkg.name} data-testid="pins-package-select" onChange={(e) => edit((c) => ({ ...c, package: e.target.value }))}>
              {chip.packages.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </Select>
          )}
        </div>
        <div className="pc-head-mid">
          <Select aria-label="Режим кода" value={cfg.mode} data-testid="pins-mode" title={st.halAvailable ? 'Как генерировать код' : 'Режим HAL доступен, когда в проекте есть заголовки HAL (stm32…_hal.h)'} onChange={(e) => edit((c) => ({ ...c, mode: e.target.value as 'cmsis' | 'hal' }))}>
            <option value="cmsis">Код: регистры CMSIS</option>
            <option value="hal" disabled={!st.halAvailable}>Код: HAL{st.halAvailable ? '' : ' (HAL нет в проекте)'}</option>
          </Select>
          {errs > 0 && <Chip tone="warn" title="Ошибки мешают генерации">Ошибок: {errs}</Chip>}
          {warns > 0 && <Chip tone="warn">Предупреждений: {warns}</Chip>}
          {errs === 0 && warns === 0 && <Chip tone="ok">Без конфликтов</Chip>}
          <span className="dim small" data-testid="pins-saved">{saveError ? <span className="err-text">не сохранено: {saveError}</span> : dirty ? 'сохраняю…' : 'сохранено в avride.pins.json'}</span>
        </div>
        <Button variant="primary" data-testid="pins-generate" disabled={!!unsupported} title={unsupported?.message} onClick={() => setGen(true)}><Icon name="code" size={14} /> {unsupported ? 'Генерация недоступна' : 'Сгенерировать код…'}</Button>
      </header>
      <Tabs label="Разделы конфигуратора" className="pc-tabs" value={tab} onChange={setTab} items={[{ id: 'pinout', label: 'Выводы' }, { id: 'clock', label: 'Тактирование' }, { id: 'table', label: 'Таблица выводов' }]} />
      <div className="pc-body">
        {tab === 'pinout' && <PinoutTab model={model} cfg={cfg} />}
        {tab === 'clock' && <ClockTab model={model} cfg={cfg} />}
        {tab === 'table' && <TableTab model={model} cfg={cfg} />}
      </div>
      <IssuesStrip issues={shownIssues} />
      {gen && <GenerateDialog onClose={() => setGen(false)} />}
    </div>
  )
}

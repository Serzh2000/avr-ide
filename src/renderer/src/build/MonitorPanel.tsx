import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../shell/icons'
import { EmptyState, Button, Select } from '../shell/kit'
import { useUi } from '../shell/ui'
import { BAUDS } from './boards'
import { useMonitor } from './monitorStore'
import { useBuild } from './useBuild'

/** Запуск/остановка порта и скорость — общие для «Монитора порта» и «Плоттера» (порт открывается один раз). */
export function PortControls(): ReactNode {
  const port = useUi((s) => s.port)
  const busy = useBuild((s) => s.busy)
  const found = useBuild((s) => s.status?.found)
  const running = useMonitor((s) => s.running)
  const baud = useMonitor((s) => s.baud)
  const start = useMonitor((s) => s.start)
  const starting = useMonitor((s) => s.starting)
  const stop = useMonitor((s) => s.stop)
  const setBaud = useMonitor((s) => s.setBaud)
  return (
    <>
      {running
        ? <Button variant="danger" size="sm" onClick={() => void stop()}><Icon name="stop" size={12} fill /> Остановить</Button>
        : <Button variant="primary" size="sm" onClick={() => void start()} loading={starting} disabled={busy || !found} title={port ? `Подключиться к ${port}` : 'Сначала выберите порт'}>{starting ? 'Открываю порт…' : 'Запустить'}</Button>}
      <label className="inline-field">Скорость
        <Select value={baud} onChange={(e) => setBaud(Number(e.target.value))} disabled={running} className="select small" title="Та же, что в Serial.begin()">
          {BAUDS.map((b) => <option key={b} value={b}>{b}</option>)}
        </Select>
      </label>
      <span className="dim port-note">{port ? `Порт: ${port}` : 'Порт не выбран'}</span>
    </>
  )
}

/** Монитор порта через `arduino-cli monitor` (запускается в main). Данные общие с плоттером. */
export default function MonitorPanel(): ReactNode {
  const text = useMonitor((s) => s.text)
  const running = useMonitor((s) => s.running)
  const clearText = useMonitor((s) => s.clearText)
  const send = useMonitor((s) => s.send)
  const start = useMonitor((s) => s.start)
  const port = useUi((s) => s.port)
  const busy = useBuild((s) => s.busy)
  const found = useBuild((s) => s.status?.found)
  const [input, setInput] = useState('')
  const [eol, setEol] = useState('\n')
  const box = useRef<HTMLPreElement>(null)
  const stick = useRef(true)

  useEffect(() => { const el = box.current; if (el && stick.current) el.scrollTop = el.scrollHeight }, [text])

  const doSend = async (): Promise<void> => {
    if (!running) return
    await send(input + eol)
    setInput('')
  }

  return (
    <div className="panel-body">
      <div className="panel-actions">
        <PortControls />
        <span className="grow" />
        <button className="icon-btn" title="Очистить монитор" onClick={clearText}><Icon name="trash" size={14} /></button>
      </div>
      {text ? (
        <pre className="log" ref={box} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40 }}>
          <div className="ln plain">{text}</div>
        </pre>
      ) : (
        <EmptyState icon="plug" title="Монитор порта" hint="Показывает всё, что плата присылает по USB через Serial.println(). Выберите порт и ту же скорость, что в Serial.begin().">
          {!running && <Button variant="primary" onClick={() => (port ? void start() : useUi.getState().setPicker('port'))} disabled={busy || !found}>{port ? 'Запустить монитор' : 'Выбрать порт'}</Button>}
        </EmptyState>
      )}
      <div className="panel-actions send-row">
        <input className="input grow" value={input} placeholder={running ? 'Отправить в порт…' : 'Запустите монитор, чтобы отправлять данные'} disabled={!running}
          onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void doSend() }} />
        <Select value={eol} onChange={(e) => setEol(e.target.value)} className="select small" title="Что добавлять в конец строки">
          <option value="">Без конца строки</option>
          <option value={'\n'}>Новая строка</option>
          <option value={'\r'}>Возврат каретки</option>
          <option value={'\r\n'}>CR + NL</option>
        </Select>
        <Button size="sm" onClick={() => void doSend()} disabled={!running}>Отправить</Button>
      </div>
    </div>
  )
}

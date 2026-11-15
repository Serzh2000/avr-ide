import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../shell/icons'
import { useUi } from '../shell/ui'
import { BAUDS } from './boards'
import { useBuild } from './useBuild'

const MAX = 200_000

/** Монитор порта через `arduino-cli monitor` (запускается в main). */
export default function MonitorPanel(): ReactNode {
  const port = useUi((s) => s.port)
  const busy = useBuild((s) => s.busy)
  const found = useBuild((s) => s.status?.found)
  const disabled = busy || !found
  const [text, setText] = useState('')
  const [running, setRunning] = useState(false)
  const [baud, setBaud] = useState(115200)
  const [input, setInput] = useState('')
  const [eol, setEol] = useState('\n')
  const box = useRef<HTMLPreElement>(null)
  const stick = useRef(true)

  useEffect(() => {
    const offD = window.api.monitor.onData((e) => setText((t) => { const n = t + e.text; return n.length > MAX ? n.slice(n.length - MAX) : n }))
    const offC = window.api.monitor.onClosed(() => setRunning(false))
    return () => { offD(); offC(); void window.api.monitor.stop() }
  }, [])
  useEffect(() => { const el = box.current; if (el && stick.current) el.scrollTop = el.scrollHeight }, [text])
  // Прошивка занимает порт — на время операции монитор закрываем
  useEffect(() => { if (busy && running) void window.api.monitor.stop() }, [busy, running])

  const start = async (): Promise<void> => {
    if (!port) { setText((t) => t + 'Выберите порт (кнопка с портом вверху окна).\n'); return }
    const r = await window.api.monitor.start(port, baud)
    if (r.ok) { setRunning(true); setText((t) => t + `--- ${port} @ ${baud} ---\n`) }
    else setText((t) => t + `Ошибка: ${r.error}\n`)
  }
  const send = async (): Promise<void> => {
    if (!running) return
    await window.api.monitor.send(input + eol)
    setInput('')
  }

  return (
    <div className="panel-body">
      <div className="panel-actions">
        {running
          ? <button className="btn small danger" onClick={() => void window.api.monitor.stop()}><Icon name="stop" size={12} fill /> Остановить</button>
          : <button className="btn small primary" onClick={start} disabled={disabled} title={port ? `Подключиться к ${port}` : 'Сначала выберите порт'}>Запустить монитор</button>}
        <label className="inline-field">Скорость
          <select value={baud} onChange={(e) => setBaud(Number(e.target.value))} disabled={running} className="select small">
            {BAUDS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <span className="dim">{port ? `Порт: ${port}` : 'Порт не выбран'}</span>
        <span className="grow" />
        <button className="icon-btn" title="Очистить монитор" onClick={() => setText('')}><Icon name="trash" size={14} /></button>
      </div>
      {text ? (
        <pre className="log" ref={box} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40 }}>
          <div className="ln plain">{text}</div>
        </pre>
      ) : (
        <div className="panel-empty">Монитор порта показывает всё, что плата отправляет через Serial.println(). Выберите порт и скорость (как в Serial.begin) и нажмите «Запустить монитор».</div>
      )}
      <div className="panel-actions send-row">
        <input className="input grow" value={input} placeholder={running ? 'Отправить в порт…' : 'Запустите монитор, чтобы отправлять данные'} disabled={!running}
          onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send() }} />
        <select value={eol} onChange={(e) => setEol(e.target.value)} className="select small" title="Что добавлять в конец строки">
          <option value="">Без конца строки</option>
          <option value={'\n'}>Новая строка</option>
          <option value={'\r'}>Возврат каретки</option>
          <option value={'\r\n'}>CR + NL</option>
        </select>
        <button className="btn small" onClick={send} disabled={!running}>Отправить</button>
      </div>
    </div>
  )
}

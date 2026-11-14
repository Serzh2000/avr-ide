import { useEffect, useRef, useState } from 'react'
import { BAUDS } from './boards'

const MAX = 200_000

interface Props { port: string; disabled: boolean }

/** Монитор порта через `arduino-cli monitor` (запускается в main). */
export default function MonitorPanel({ port, disabled }: Props) {
  const [text, setText] = useState('')
  const [running, setRunning] = useState(false)
  const [baud, setBaud] = useState(115200)
  const [input, setInput] = useState('')
  const [eol, setEol] = useState('\n')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const offD = window.api.monitor.onData((e) =>
      setText((t) => { const n = t + e.text; return n.length > MAX ? n.slice(n.length - MAX) : n })
    )
    const offC = window.api.monitor.onClosed(() => setRunning(false))
    return () => { offD(); offC(); void window.api.monitor.stop() }
  }, [])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [text])
  // Прошивка занимает порт — если выбранный порт сменился или идёт операция, монитор закрываем
  useEffect(() => { if (disabled && running) void window.api.monitor.stop() }, [disabled, running])

  const start = async (): Promise<void> => {
    if (!port) { setText((t) => t + 'Выберите порт.\n'); return }
    const r = await window.api.monitor.start(port, baud)
    if (r.ok) { setRunning(true); setText((t) => t + `--- ${port} @ ${baud} ---\n`) }
    else setText((t) => t + `error: ${r.error}\n`)
  }
  const send = async (): Promise<void> => {
    if (!running) return
    await window.api.monitor.send(input + eol)
    setInput('')
  }

  return (
    <div className="panel-body">
      <div className="panel-actions">
        <select value={baud} onChange={(e) => setBaud(Number(e.target.value))} disabled={running}>
          {BAUDS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        {running
          ? <button onClick={() => void window.api.monitor.stop()}>Стоп</button>
          : <button onClick={start} disabled={disabled}>Старт ({port || 'нет порта'})</button>}
        <button onClick={() => setText('')}>Очистить</button>
        <select value={eol} onChange={(e) => setEol(e.target.value)}>
          <option value="">без конца строки</option>
          <option value={'\n'}>NL</option>
          <option value={'\r'}>CR</option>
          <option value={'\r\n'}>CR+NL</option>
        </select>
      </div>
      <pre className="log"><div className="ln plain">{text}</div><div ref={end} /></pre>
      <div className="panel-actions">
        <input
          className="grow"
          value={input}
          placeholder="Отправить в порт…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void send() }}
        />
        <button onClick={send} disabled={!running}>Отправить</button>
      </div>
    </div>
  )
}

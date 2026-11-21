// Нижняя панель «SWO» Pro-режима: приём printf через ITM (стимул-порт 0) по выводу SWO программатора. Запуск и остановка отдельного OpenOCD,
// консоль с автопрокруткой, «Очистить» и «Сохранить…». Устройство только слушается: прошивка и стирание отсюда не выполняются.
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../shell/icons'
import { Badge, Button, Switch } from '../shell/kit'
import { useUi } from '../shell/ui'
import { programmerLabel } from '../../../shared/pro/programmers'
import { useProStore } from './proStore'
import { useHw } from './hwStore'
import { ErrorCard } from './HwPanel'
import './hw.css'

const toMHz = (hz: number): string => (hz ? String(Math.round(hz / 1000) / 1000).replace('.', ',') : '')
const fromMHz = (s: string): number => Math.round(Number(s.replace(',', '.').trim()) * 1_000_000)

/** Поле частоты в МГц: правка не применяется, пока поле в фокусе, чтобы запятая и частичный ввод не ломали значение. */
function MHzField({ label, value, placeholder, onCommit, testId, title }: { label: string; value: number; placeholder?: string; onCommit: (hz: number) => void; testId: string; title?: string }): ReactNode {
  const [text, setText] = useState(toMHz(value))
  const focus = useRef(false)
  useEffect(() => { if (!focus.current) setText(toMHz(value)) }, [value])
  const commit = (): void => {
    focus.current = false
    const hz = fromMHz(text)
    if (text.trim() === '' || !Number.isFinite(hz) || hz < 1000) { setText(toMHz(value)); if (text.trim() === '') onCommit(0); return }
    onCommit(hz)
    setText(toMHz(hz))
  }
  return (
    <label className="inline-field">{label}
      <input className="input swo-num" inputMode="decimal" value={text} placeholder={placeholder} spellCheck={false} data-testid={testId} title={title}
        onFocus={() => { focus.current = true }} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
      <span className="dim">МГц</span>
    </label>
  )
}

const fmt = (n: number): string => n.toLocaleString('ru-RU')

export default function SwoPanel(): ReactNode {
  const config = useProStore((s) => s.config)
  const project = useProStore((s) => s.project)
  const { swo, prefs, kind, sysclkHz, flash, debug, tools } = useHw()
  const { setPrefs, swoStart, swoStop, swoClear } = useHw.getState()
  const [auto, setAuto] = useState(true)
  const box = useRef<HTMLPreElement>(null)
  useEffect(() => { if (auto && box.current) box.current.scrollTop = box.current.scrollHeight }, [swo.text, auto])

  const running = swo.status === 'running'
  const starting = swo.status === 'starting'
  const busyOther = flash.status === 'running' || debug.status !== 'off'
  const label = programmerLabel(kind)
  const noOcd = !!tools && !tools.openocd
  const save = async (): Promise<void> => {
    const r = await window.api.pro.swoSave(swo.text)
    if (!r.ok) useUi.getState().notify(r.error, { kind: 'error' })
    else if (r.data.path) useUi.getState().notify('Вывод SWO сохранён в файл.', { kind: 'ok' })
  }
  // счётчики после «Очистить» считаются от момента очистки
  const b = swo.base
  const s = swo.stats && b ? { ...swo.stats, bytes: swo.stats.bytes - b.bytes, packets: swo.stats.packets - b.packets, overflows: swo.stats.overflows - b.overflows, ports: Object.fromEntries(Object.entries(swo.stats.ports).map(([p, n]) => [p, n - (b.ports[Number(p)] ?? 0)]).filter(([, n]) => (n as number) > 0)) } : swo.stats
  const ports = s ? Object.entries(s.ports).filter(([p]) => p !== '0') : []

  return (
    <div className="panel-body swo" data-testid="swo-panel">
      <div className="swo-bar">
        {running || starting
          ? <Button size="sm" onClick={() => void swoStop()} data-testid="swo-stop"><Icon name="stop" size={13} fill /> Остановить</Button>
          : <Button size="sm" variant="primary" onClick={() => void swoStart(config)} disabled={!project || busyOther || noOcd} data-testid="swo-start"
              title={busyOther ? 'Программатор занят прошивкой или отладкой' : noOcd ? 'Сначала установите OpenOCD (вкладка «Прошивка»)' : 'Подключиться к плате и принимать вывод SWO (ничего не записывает в плату)'}>
              <Icon name="arrow" size={13} /> Запустить
            </Button>}
        {starting && <span className="dim swo-state" data-testid="swo-state" data-state="starting">Подключение…</span>}
        {running && <Badge tone="ok"><span data-testid="swo-state" data-state="running">приём идёт</span></Badge>}
        {!running && !starting && <span className="dim swo-state" data-testid="swo-state" data-state="off">{swo.endedReason ? `остановлено: ${swo.endedReason}` : 'не запущен'}</span>}
        <span className="grow" />
        <label className="swo-auto" title="Прокручивать вывод к последней строке"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} data-testid="swo-autoscroll" /> Автопрокрутка</label>
        <Button size="sm" onClick={swoClear} disabled={!swo.text && !swo.stats} data-testid="swo-clear">Очистить</Button>
        <Button size="sm" onClick={() => void save()} disabled={!swo.text} data-testid="swo-save">Сохранить…</Button>
      </div>

      <div className="swo-params">
        <MHzField label="Частота ядра" value={prefs.traceClockHz || sysclkHz} placeholder="72" testId="swo-clock" title="Реальная частота ядра (SYSCLK): по ней OpenOCD настраивает скорость SWO. По умолчанию — из проекта (Цель → тактирование)."
          onCommit={(hz) => setPrefs({ traceClockHz: hz === sysclkHz ? 0 : hz })} />
        <MHzField label="Скорость SWO" value={prefs.swoHz} placeholder="2" testId="swo-speed" title="Скорость вывода SWO. Если текст приходит искажённым или пропадает, уменьшите."
          onCommit={(hz) => setPrefs({ swoHz: hz || 2_000_000 })} />
        <span className="dim swo-via">через {label}</span>
      </div>

      {swo.error && <div className="swo-err"><ErrorCard e={swo.error} onRetry={() => void swoStart(config)} /></div>}

      <pre className="swo-console" ref={box} data-testid="swo-console" aria-label="Вывод SWO, порт 0" aria-live="off" tabIndex={0}>
        {swo.text || <span className="dim">Здесь появится текст, который программа отправляет в SWO: ITM_SendChar() или printf() (шаблон «printf через SWO» в мастере проекта, сниппет «swo» в редакторе). Нажмите «Запустить», затем прошейте плату или перезапустите её.</span>}
      </pre>

      <div className="swo-foot dim" data-testid="swo-stats">
        {s ? <>принято {fmt(s.bytes)} байт в {fmt(s.packets)} пакетах{s.overflows ? <span className="hw-bad"> · переполнений: {s.overflows} (уменьшите скорость или вывод)</span> : null}{ports.length ? ` · другие порты: ${ports.map(([p, n]) => `${p}: ${n} байт`).join(', ')}` : ''}</> : 'данных пока нет'}
      </div>

      <details className="swo-help">
        <summary>Как подключить SWO</summary>
        <ul>
          <li>SWO — вывод только от микроконтроллера к программатору (обычно PB3). Его нужно соединить с выводом SWO (TDO/SWO) программатора отдельным проводом, кроме SWDIO, SWCLK, GND и 3V3.</li>
          <li>Плата Nucleo или Discovery: SWO обычно уже соединён со встроенным ST-Link (смотрите схему платы).</li>
          <li>Дешёвый ST-Link V2 («свисток» для Blue Pill): вывода SWO у него часто нет, а на клонах SWO может не работать; тогда используйте UART или настоящий ST-Link.</li>
          <li>Прошивка должна включить ITM (шаблон «printf через SWO» делает это сама). Приём SWO и отладка/прошивка вместе не работают: программатор открывает один OpenOCD.</li>
          <li>Поддержка SWO зависит от программатора и версии OpenOCD; на ST-Link, J-Link и CMSIS-DAP вживую не проверялась.</li>
        </ul>
      </details>
    </div>
  )
}

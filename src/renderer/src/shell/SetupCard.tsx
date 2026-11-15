// Карточка первого запуска: диагностика arduino-cli и установка поддержки плат в один клик.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { BASE_CORES } from '../build/boards'
import { installBaseCores, useSetup } from '../build/setup'
import { useBuild } from '../build/useBuild'
import { Icon } from './icons'
import { Spinner } from './kit'
import { useUi } from './ui'

export default function SetupCard(): ReactNode {
  const status = useBuild((s) => s.status)
  const cores = useBuild((s) => s.cores)
  const busy = useBuild((s) => s.busy)
  const progress = useBuild((s) => s.progress)
  const cancel = useBuild((s) => s.cancel)
  const recheck = useBuild((s) => s.recheck)
  const { running, steps, error } = useSetup()
  const notify = useUi((s) => s.notify)
  const showBottom = useUi((s) => s.showBottom)
  const [pick, setPick] = useState<Record<string, boolean>>({ 'arduino:avr': true, 'esp32:esp32': true, 'esp8266:esp8266': true })
  const [chk, setChk] = useState(false)

  if (!status) return null

  if (!status.found) {
    return (
      <div className="card warn">
        <div className="card-title"><Icon name="warn" size={18} /> Не найден arduino-cli</div>
        <p>Это программа, которая собирает скетчи и прошивает платы. Без неё кнопки «Проверить» и «Загрузить» не работают.</p>
        <p className="dim">IDE ищет её в папке resources рядом с приложением, затем в PATH, затем по пути из настроек.</p>
        <div className="card-actions">
          <button className="btn primary" onClick={async () => {
            const r = await window.api.cli.pickPath()
            if (!r.ok) notify(r.error)
            else if (r.data) await recheck()
          }}>Указать путь к arduino-cli…</button>
          <button className="btn" disabled={chk} onClick={async () => { setChk(true); const s = await recheck(); setChk(false); notify(s.found ? 'arduino-cli найден.' : 'Пока не найден.') }}>
            {chk ? <Spinner /> : null} Проверить снова
          </button>
        </div>
        <details className="card-details"><summary>Как установить</summary><pre>{status.help}</pre></details>
      </div>
    )
  }

  const noCores = cores !== null && cores.length === 0
  if (!noCores && !running && !steps.length) return null
  if (!noCores && !running && steps.every((s) => s.status === 'ok')) return null

  const chosen = BASE_CORES.filter((c) => pick[c.id]).map((c) => c.id as string)
  const needEsp = BASE_CORES.some((c) => pick[c.id] && c.esp)
  const pct = progress?.pct

  return (
    <div className="card accent">
      <div className="card-title"><Icon name="download" size={18} /> Установите поддержку плат</div>
      {!running && (
        <>
          <p>Сейчас не установлено ни одного ядра, поэтому собирать скетчи нельзя. Выберите платы — всё скачается и установится автоматически.</p>
          <div className="core-list">
            {BASE_CORES.map((c) => (
              <label key={c.id} className="core-opt">
                <input type="checkbox" checked={!!pick[c.id]} onChange={(e) => setPick({ ...pick, [c.id]: e.target.checked })} />
                <span><b>{c.label}</b><span className="dim"> — {c.hint}</span></span>
              </label>
            ))}
          </div>
          {needEsp && (
            <p className="dim small">
              Для ESP32 и ESP8266 в конфигурацию arduino-cli будут добавлены официальные адреса пакетов (Espressif и ESP8266 Community).
              Нажимая «Установить», вы соглашаетесь на это изменение. Потребуется интернет, загрузка может занять несколько минут.
            </p>
          )}
          <div className="card-actions">
            <button className="btn primary" disabled={!chosen.length || busy} onClick={() => { showBottom('output'); void installBaseCores(chosen, needEsp) }}>
              Установить выбранное
            </button>
          </div>
        </>
      )}
      {steps.length > 0 && (
        <ul className="steps">
          {steps.map((s) => (
            <li key={s.id} className={'step ' + s.status}>
              <span className="step-ico">{s.status === 'run' ? <Spinner /> : s.status === 'ok' ? <Icon name="check" size={14} /> : s.status === 'fail' ? <Icon name="x" size={14} /> : <span className="dot" />}</span>
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {running && (
        <>
          <div className={'bar' + (pct == null ? ' indeterminate' : '')}><div style={{ width: pct != null ? pct + '%' : undefined }} /></div>
          <div className="card-actions"><button className="btn" onClick={cancel}>Отмена</button></div>
        </>
      )}
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}

// Нижняя панель «Прошивка» Pro-режима: программатор (ST-Link, J-Link, CMSIS-DAP), инструменты (OpenOCD, GDB), параметры, ход и итог прошивки.
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../shell/icons'
import { Badge, Button, Select, Switch } from '../shell/kit'
import { useProStore } from './proStore'
import { SPEEDS, useHw } from './hwStore'
import { probesOfKind, setProgrammerKind } from './programmer'
import { KIND_TEXTS, PROGRAMMERS, PROGRAMMER_KINDS, programmerLabel } from '../../../shared/pro/programmers'
import type { ProgrammerKind } from '../../../shared/pro/programmers'
import type { FlashError } from '../../../main/pro/openocd/logParse'
import './hw.css'

const mb = (n: number): string => (n / 1048576).toFixed(1).replace('.', ',') + ' МБ'

const SOURCE: Record<string, string> = { env: 'переменная окружения', custom: 'указано вручную', ide: 'установлено через IDE', cubeide: 'из STM32CubeIDE', xpack: 'xPack', path: 'из PATH' }

export function ErrorCard({ e, onRetry }: { e: FlashError; onRetry?: () => void }): ReactNode {
  const act = useHw.getState()
  const kind = act.kind
  const main = e.kind === 'no-openocd' ? { label: 'Установить OpenOCD', run: () => void act.planInstall() }
    : e.kind === 'no-probe' || e.kind === 'no-driver' ? { label: 'Проверить программатор снова', run: () => void act.refreshProbes() }
    : e.kind === 'read-protected' ? { label: 'Стереть всю память…', run: () => void act.eraseAll(useProStore.getState().config) }
    : onRetry ? { label: 'Повторить', run: onRetry } : null
  return (
    <div className="hw-card err" role="alert" data-testid="hw-error" data-kind={e.kind}>
      <div className="hw-card-title"><Icon name="error" size={15} /> {e.title}</div>
      <p className="hw-card-text">{e.hint}</p>
      {e.kind === 'no-driver' && (
        <ol className="hw-steps" data-testid="hw-driver-steps">
          {KIND_TEXTS[kind].driverSteps.map((s) => <li key={s}>{s}</li>)}
        </ol>
      )}
      {main && <div className="hw-card-actions"><Button variant="primary" size="sm" onClick={main.run} data-testid="hw-error-action">{main.label}</Button></div>}
    </div>
  )
}

function InstallCard(): ReactNode {
  const ins = useHw((s) => s.install)
  const planInstall = useHw((s) => s.planInstall)
  const cancel = useHw((s) => s.cancelInstall)
  const confirm = useHw((s) => s.confirmInstall)
  if (ins.status === 'planning') return <div className="hw-card" data-testid="hw-install-planning"><div className="hw-card-title">Проверяю, что будет скачано…</div></div>
  if (ins.status === 'confirm' && ins.plan) {
    const p = ins.plan
    return (
      <div className="hw-card" data-testid="hw-install-confirm-card">
        <div className="hw-card-title"><Icon name="download" size={15} /> Установить OpenOCD?</div>
        <dl className="hw-kv">
          <dt>Файл</dt><dd>{p.file}</dd>
          <dt>Размер</dt><dd>{mb(p.size)}</dd>
          <dt>Источник</dt><dd>{p.source}</dd>
          <dt>Лицензия</dt><dd>{p.license}</dd>
          <dt>SHA-256</dt><dd className="mono">{p.sha256.slice(0, 16)}…{p.sha256.slice(-8)}</dd>
        </dl>
        <p className="hw-card-text">Архив скачивается в папку данных приложения, сверяется с контрольной суммой и распаковывается. Больше ничего не устанавливается.</p>
        <div className="hw-card-actions">
          <Button variant="primary" size="sm" onClick={() => void confirm()} data-testid="hw-install-confirm">Скачать и установить</Button>
          <Button size="sm" onClick={cancel}>Отмена</Button>
        </div>
      </div>
    )
  }
  if (ins.status === 'running') {
    const f = ins.total ? Math.min(1, (ins.done ?? 0) / ins.total) : 0
    return (
      <div className="hw-card" data-testid="hw-install-running">
        <div className="hw-card-title">Установка OpenOCD: {Math.round(f * 100)}%</div>
        <div className="hw-bar"><i style={{ width: f * 100 + '%' }} /></div>
      </div>
    )
  }
  if (ins.status === 'error') return <ErrorCard e={{ kind: 'unknown', title: 'Не удалось установить OpenOCD', hint: ins.error ?? '' }} onRetry={() => void planInstall()} />
  return null
}

export default function HwPanel(): ReactNode {
  const config = useProStore((s) => s.config)
  const project = useProStore((s) => s.project)
  const { probes, probesLoaded, tools, flash, prefs } = useHw()
  const install = useHw((s) => s.install.status)
  const debugOn = useHw((s) => s.debug.status !== 'off')
  const { refreshProbes, refreshTools, setPrefs, flashNow, eraseAll, pickTool, planInstall, cancelFlash } = useHw.getState()
  useEffect(() => { void refreshProbes(); void refreshTools() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const running = flash.status === 'running'
  const noOcd = !!tools && !tools.openocd
  const kind = useHw((s) => s.kind)
  const label = programmerLabel(kind)
  const mine = probesOfKind(probes, kind)
  const others = probes.filter((p) => p.kind !== kind)
  const probe = mine.find((p) => p.id === prefs.probeId) ?? mine[0]
  let status: ReactNode = null
  if (install !== 'idle') status = <InstallCard />
  else if (noOcd) status = <ErrorCard e={{ kind: 'no-openocd', title: 'Не найден OpenOCD', hint: `Это программа, которая общается с программатором (${label}). Её можно скачать одной кнопкой (около 3 МБ) или указать путь к уже установленной.` }} />
  else if (probesLoaded && !mine.length) status = <ErrorCard e={{ kind: 'no-probe', title: KIND_TEXTS[kind].noProbeTitle, hint: KIND_TEXTS[kind].noProbeHint }} />
  else if (probe?.driver === 'missing') status = <ErrorCard e={{ kind: 'no-driver', title: KIND_TEXTS[kind].noDriverTitle, hint: KIND_TEXTS[kind].noDriverHint }} />
  else if (flash.status === 'error' && flash.error) status = <ErrorCard e={flash.error} onRetry={() => void flashNow(config)} />
  else if (running) {
    status = (
      <div className="hw-card" data-testid="hw-progress" aria-live="polite">
        <div className="hw-card-title">{flash.label || 'Выполняется…'}</div>
        <div className="hw-bar"><i style={{ width: flash.fraction * 100 + '%' }} /></div>
        <div className="hw-card-actions"><Button size="sm" onClick={cancelFlash}>Остановить</Button></div>
      </div>
    )
  } else if (flash.status === 'ok') {
    status = (
      <div className="hw-card ok" data-testid="hw-done">
        <div className="hw-card-title"><Icon name="check" size={15} /> {flash.wrote ? 'Плата прошита' : flash.label}</div>
        {!!flash.wrote && <p className="hw-card-text">Записано {flash.wrote} байт{flash.seconds ? ` за ${flash.seconds.toFixed(1).replace('.', ',')} с` : ''}{flash.verified ? ', проверка записи пройдена' : ''}. Плата перезапущена и выполняет программу.</p>}
        <div className="hw-card-actions"><Button size="sm" variant="primary" onClick={() => useHw.getState().startDebug(config)} data-testid="hw-to-debug">Начать отладку</Button></div>
      </div>
    )
  } else if (probe) {
    status = (
      <div className="hw-card" data-testid="hw-ready">
        <div className="hw-card-title"><Icon name="plug" size={15} /> Готово к прошивке</div>
        <p className="hw-card-text">{probe.name}{probe.serial ? ` · № ${probe.serial.slice(0, 8)}…` : ''} → {project?.target.chip ?? 'микроконтроллер'}. Прошивка заменит программу в плате. Если проект ещё не собран, сначала нажмите «Собрать».</p>
      </div>
    )
  }

  return (
    <div className="panel-body hw" data-testid="hw-panel">
      <div className="hw-grid">
        <div className="hw-col">
          {status}
          <div className="hw-actions">
            <Button variant="primary" onClick={() => void flashNow(config)} loading={running} disabled={debugOn || !project} data-testid="hw-flash" title={debugOn ? 'Остановите отладку перед прошивкой' : 'Записать собранную программу в плату'}>
              {!running && <Icon name="arrow" size={14} />} {running ? "Прошивка…" : "Прошить"}
            </Button>
            <Button variant="danger" onClick={() => void eraseAll(config)} disabled={running || debugOn || !project || noOcd} data-testid="hw-erase" title="Полностью стереть Flash микроконтроллера (потребуется подтверждение)">Стереть всю память…</Button>
          </div>
        </div>

        <div className="hw-col">
          <h4 className="hw-h">Программатор <Badge tone={mine.length ? 'ok' : 'warn'}>{mine.length ? 'подключён' : 'нет'}</Badge>
            <button className="icon-btn" title="Проверить подключение заново" aria-label="Проверить подключение заново" data-testid="hw-probes-refresh" onClick={() => void refreshProbes()}><Icon name="refresh" size={14} /></button>
          </h4>
          <label className="inline-field hw-kind">Тип
            <Select className="small" value={kind} onChange={(e) => void setProgrammerKind(e.target.value as ProgrammerKind)} title={PROGRAMMERS[kind].about} data-testid="hw-kind">
              {PROGRAMMER_KINDS.map((k) => <option key={k} value={k}>{PROGRAMMERS[k].label}</option>)}
            </Select>
          </label>
          {mine.length ? mine.map((p) => (
            <label key={p.id} className="hw-probe" data-testid="hw-probe">
              <input type="radio" name="probe" checked={p.id === (probe?.id ?? '')} onChange={() => { setPrefs({ probeId: p.id }); if (useHw.getState().flash.status === 'error') useHw.setState({ flash: { status: 'idle', label: '', fraction: 0 } }) }} />
              <span><b>{p.name}</b>{p.serial ? <span className="dim"> · № {p.serial.slice(0, 10)}</span> : null}
                {p.vcp && <span className="dim"> · есть виртуальный COM-порт (UART-монитор)</span>}
                {p.driver === 'missing' && <span className="hw-bad"> · нет драйвера</span>}</span>
            </label>
          )) : <p className="dim hw-note">{probesLoaded ? `${label} не обнаружен.` : `Ищу ${label}…`}</p>}
          {!mine.length && others.length > 0 && (
            <p className="hw-note" data-testid="hw-others">Найдено другое: {[...new Set(others.map((p) => p.name))].map((n) => { const c = others.filter((p) => p.name === n).length; return c > 1 ? `${n} ×${c}` : n }).join(', ')}.{' '}
              <button className="hw-link" onClick={() => void setProgrammerKind(others[0].kind as ProgrammerKind)} data-testid="hw-use-other">Использовать {programmerLabel(others[0].kind)}</button></p>
          )}

          <h4 className="hw-h">Инструменты</h4>
          <dl className="hw-kv" data-testid="hw-tools">
            <dt>OpenOCD</dt><dd data-testid="hw-openocd">{tools?.openocd ? <>найден <span className="dim">({SOURCE[tools.openocd.source] ?? tools.openocd.source})</span></> : <span className="hw-bad">не найден</span>}</dd>
            <dt>GDB</dt><dd data-testid="hw-gdb">{tools?.gdb ? <>найден <span className="dim">({SOURCE[tools.gdb.source] ?? tools.gdb.source})</span></> : <span className="hw-bad">не найден</span>} <span className="dim">для отладки</span></dd>
          </dl>
          <div className="hw-card-actions">
            {noOcd && install === 'idle' && <Button size="sm" variant="primary" onClick={() => void planInstall()} data-testid="hw-install">Установить OpenOCD</Button>}
            <Button size="sm" onClick={() => void pickTool('openocd')}>Указать OpenOCD…</Button>
            <Button size="sm" onClick={() => void pickTool('arm-none-eabi-gdb')}>Указать GDB…</Button>
          </div>

          <h4 className="hw-h">Параметры</h4>
          <div className="hw-opts">
            <label className="inline-field">Скорость SWD
              <Select className="small" value={prefs.speedKhz} onChange={(e) => setPrefs({ speedKhz: Number(e.target.value) })} title="Если прошивка срывается, уменьшите скорость" data-testid="hw-speed">
                {[...new Set([...SPEEDS, prefs.speedKhz])].sort((a, b) => a - b).map((s) => <option key={s} value={s}>{s} кГц</option>)}
              </Select>
            </label>
            <label className="inline-field">Подключение
              <Select className="small" value={prefs.resetMode} onChange={(e) => setPrefs({ resetMode: e.target.value as 'normal' | 'under-reset' })} data-testid="hw-resetmode">
                <option value="normal">обычное</option>
                <option value="under-reset">при сбросе (NRST)</option>
              </Select>
            </label>
          </div>
          <Switch checked={prefs.verify} onChange={(v) => setPrefs({ verify: v })} title="Проверять запись" hint="Сравнить записанное с файлом" />
          <Switch checked={prefs.reset} onChange={(v) => setPrefs({ reset: v })} title="Перезапустить плату после прошивки" hint="Программа сразу начнёт работать" />
        </div>
      </div>
    </div>
  )
}

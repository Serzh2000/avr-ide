import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { KIND_TEXTS, PROGRAMMERS, PROGRAMMER_KINDS, programmerLabel } from '../../../shared/pro/programmers'
import type { ProgrammerKind } from '../../../shared/pro/programmers'
import { useBuild } from '../build/useBuild'
import { Icon } from '../shell/icons'
import { Button, Dialog, Select, Switch } from '../shell/kit'
import { useUi } from '../shell/ui'
import { ErrorCard, InstallCard, TOOL_SOURCE } from './HwPanel'
import { SPEEDS, useHw } from './hwStore'
import { probesOfKind, setProgrammerKind } from './programmer'
import { runProAction, useProStore } from './proStore'

const STAGES = ['Инструменты', 'Подключение', 'Запись'] as const
type Step = 0 | 1 | 2

function FlashTask(): ReactNode {
  const [step, setStep] = useState<Step>(() => useHw.getState().flash.status === 'running' ? 2 : 0)
  const stage = useRef<HTMLElement>(null)
  const [artifact, setArtifact] = useState<{ config: string; elf: string | null; error?: string } | null>(null)
  const config = useProStore((s) => s.config)
  const project = useProStore((s) => s.project)
  const building = useBuild((s) => s.busy)
  const result = useBuild((s) => s.result)
  const close = useUi((s) => s.closeFlash)
  const { probes, probesLoaded, tools, flash, prefs, install, kind, debug, swo } = useHw()
  const { refreshProbes, refreshTools, setPrefs, flashNow, eraseAll, pickTool, planInstall, cancelFlash } = useHw.getState()

  useEffect(() => {
    const previous = useHw.getState().flash
    if (previous.status !== 'running') useHw.setState({ flash: { status: 'idle', label: '', fraction: 0 } })
    void refreshProbes()
    void refreshTools()
  }, [refreshProbes, refreshTools])

  useEffect(() => {
    if (!project) return
    let alive = true
    void window.api.pro.targetInfo(config).then((r) => {
      if (alive) setArtifact(r.ok ? { config, elf: r.data.elf } : { config, elf: null, error: r.error })
    }, () => { if (alive) setArtifact({ config, elf: null, error: 'Не удалось проверить файл прошивки.' }) })
    return () => { alive = false }
  }, [config, project, result])

  const running = flash.status === 'running'
  const installing = install.status === 'running' || install.status === 'planning'
  const occupied = debug.status !== 'off' || swo.status !== 'off'
  const label = programmerLabel(kind)
  const mine = probesOfKind(probes, kind)
  const others = probes.filter((p) => p.kind !== kind)
  const probe = mine.find((p) => p.id === prefs.probeId) ?? mine[0]
  const readyProbe = !!probe && probe.driver !== 'missing'
  const elf = artifact?.config === config ? artifact.elf : null
  const locked = installing || running
  const canWrite = !!project && readyProbe && !!tools?.openocd && !!elf && !occupied && !building
  const canErase = !!project && readyProbe && !!tools?.openocd && !occupied && !building

  const write = (): void => { if (canWrite && !locked) void flashNow(config) }
  const forward = (): void => setStep(step === 0 ? 1 : 2)
  const back = (): void => setStep(step === 2 ? 1 : 0)
  const canNext = step === 0 ? !!tools?.openocd && install.status !== 'confirm' : readyProbe

  // Сеанс записи мог начаться раньше, например при повторном открытии мастера.
  const current = running ? 2 : step
  useEffect(() => {
    if (current > 0) stage.current?.focus()
  }, [current])
  useEffect(() => {
    if (document.activeElement === document.body) stage.current?.focus()
  }, [running, install.status])
  useEffect(() => {
    const escape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented || locked ||
        document.activeElement !== document.body || document.querySelector('.modal')) return
      event.preventDefault()
      close()
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [close, locked])

  return (
    <div className="modal-backdrop" onKeyDown={(e) => e.stopPropagation()} onMouseDown={(e) => { if (e.target === e.currentTarget && !locked) close() }}>
      <Dialog title="Мастер прошивки" icon="plug" className="flash-wizard" testid="hw-panel" onClose={close} closeDisabled={locked}
        footerStart={<Button disabled={locked} onClick={close}>Закрыть</Button>}
        footer={<>
          {current > 0 && !running && <Button data-testid="hw-back" disabled={locked} onClick={back}>Назад</Button>}
          {current < 2 && <Button variant="primary" data-testid="hw-next" disabled={locked || !canNext} onClick={forward}>Далее</Button>}
          {current === 2 && !running && <Button variant="primary" data-testid="hw-flash" disabled={!canWrite || locked} onClick={write}>{flash.status === 'ok' ? 'Прошить снова' : 'Прошить'}</Button>}
          {running && <Button onClick={cancelFlash}>Остановить запись</Button>}
        </>}>
        <ol className="flash-stages" aria-label="Шаги мастера прошивки">
          {STAGES.map((name, i) => <li key={name} aria-current={i === current ? 'step' : undefined} data-done={i < current || undefined}><span>{i + 1}</span>{name}</li>)}
        </ol>
        {current === 0 && <section className="flash-section" aria-label="Инструменты" ref={stage} tabIndex={-1}>
          {!elf && artifact?.config === config && project && <div className="hw-card">
            <div className="hw-card-title">Сначала соберите проект</div>
            <p className="hw-card-text">{artifact.error ?? 'Сборка создаст файл для записи. Плата и программатор для неё не нужны.'}</p>
            <Button variant="primary" disabled={building || locked} onClick={() => { close(); void runProAction('build') }}>Собрать проект</Button>
          </div>}
          <h3>Проверьте OpenOCD</h3>
          <p className="dim">OpenOCD связывает IDE с программатором. Для записи программы GDB не требуется.</p>
          <dl className="hw-kv" data-testid="hw-tools">
            <dt>OpenOCD</dt><dd data-testid="hw-openocd">{!tools ? 'Проверяется…' : tools.openocd ? 'Найден · ' + (TOOL_SOURCE[tools.openocd.source] ?? tools.openocd.source) : 'Не найден'}</dd>
          </dl>
          {install.status !== 'idle' ? <InstallCard /> : <div className="hw-card-actions">
            {tools && !tools.openocd && <Button variant={elf ? 'primary' : 'secondary'} onClick={() => void planInstall()} data-testid="hw-install">Установить OpenOCD</Button>}
            <Button onClick={() => void pickTool('openocd')}>Указать OpenOCD…</Button>
          </div>}
          <details className="flash-settings">
            <summary>Инструменты отладки</summary>
            <p data-testid="hw-gdb">GDB {tools?.gdb ? 'найден' : 'не найден'}</p>
            <Button disabled={installing} onClick={() => void pickTool('arm-none-eabi-gdb')}>Указать GDB…</Button>
          </details>
        </section>}
        {current === 1 && <section className="flash-section" aria-label="Подключение" ref={stage} tabIndex={-1}>
          <div className="flash-row"><h3>Подключите программатор</h3>{probe?.driver !== 'missing' && <Button data-testid="hw-probes-refresh" onClick={() => void refreshProbes()}><Icon name="refresh" size={14} /> Проверить</Button>}</div>
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

          {probesLoaded && !mine.length && <p className="dim">{KIND_TEXTS[kind].noProbeHint}</p>}
          {probe?.driver === 'missing' && <ErrorCard e={{ kind: 'no-driver', title: KIND_TEXTS[kind].noDriverTitle, hint: KIND_TEXTS[kind].noDriverHint }} />}
          <details className="flash-settings">
            <summary>Параметры подключения и записи</summary>
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
          </details>
        </section>}
        {current === 2 && <section className="flash-section" aria-label="Запись" ref={stage} tabIndex={-1}>
          <h3>{running ? 'Запись программы' : flash.status === 'idle' ? 'Проверьте данные перед записью' : 'Результат операции'}</h3>
          <dl className="hw-kv">
            <dt>Микроконтроллер</dt><dd>{project?.target.chip ?? 'Не выбран'}</dd>
            <dt>Конфигурация</dt><dd>{config}</dd>
            <dt>Программатор</dt><dd>{probe?.name ?? label}{probe?.serial ? ' · № ' + probe.serial : ''}</dd>
            <dt>Файл</dt><dd title={elf ?? undefined}>{elf ? elf.split(/[\\/]/).pop() : artifact?.config === config ? 'Нет собранной программы' : 'Проверяется…'}</dd>
          </dl>
          {running ? (
            <div className="hw-card" data-testid="hw-progress" role="status">
              <div className="hw-card-title">{flash.label || 'Выполняется…'}</div>
              <div className="hw-bar" role="progressbar" aria-label="Прошивка" aria-valuenow={Math.round(flash.fraction * 100)}><i style={{ width: flash.fraction * 100 + '%' }} /></div>
            </div>
          ) : flash.status === 'error' && flash.error ? <ErrorCard e={flash.error} onRetry={canWrite ? write : undefined} />
            : flash.status === 'ok' ? (
              <div className="hw-card ok" data-testid="hw-done" role="status">
                <div className="hw-card-title"><Icon name="check" size={15} /> {flash.wrote ? 'Плата прошита' : flash.label}</div>
                {!!flash.wrote && <p className="hw-card-text">Записано {flash.wrote} байт{flash.verified ? ', запись проверена' : ''}.</p>}
                {!!flash.wrote && tools?.gdb && <div className="hw-card-actions"><Button data-testid="hw-to-debug" disabled={occupied} onClick={() => { close(); void useHw.getState().startDebug(config) }}>Начать отладку</Button></div>}
              </div>
            ) : <p className="dim" data-testid="hw-ready">Файл последней сборки заменит текущую программу на плате.</p>}
          {!running && occupied && <p className="dim" role="status">Остановите отладку или приём SWO перед записью.</p>}
          {!running && !readyProbe && <p className="dim" role="status">Программатор недоступен. Вернитесь к проверке подключения.</p>}
          {!running && !elf && artifact?.config === config && <div className="hw-card-actions">
            {artifact.error && <span role="alert">{artifact.error}</span>}
            <Button disabled={building || !project} onClick={() => { close(); void runProAction('build') }}>Собрать проект</Button>
          </div>}
          {!running && <details className="flash-settings">
            <summary>Стирание памяти</summary>
            <p className="dim">Полное стирание удалит программу с платы. Потребуется подтверждение.</p>
            <Button variant="danger" disabled={!canErase} data-testid="hw-erase" onClick={() => void eraseAll(config)}>Стереть всю память…</Button>
          </details>}
        </section>}
      </Dialog>
    </div>
  )
}

export default function FlashWizard(): ReactNode {
  const open = useUi((s) => s.flashOpen)
  return open ? <FlashTask /> : null
}

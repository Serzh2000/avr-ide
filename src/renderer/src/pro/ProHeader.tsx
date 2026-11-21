// Шапка Профессионального режима: Собрать / Прошить / Отладка, конфигурация, цель, программатор. Вместо плата/порт Arduino.
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../shell/icons'
import { Chip, Select } from '../shell/kit'
import { useProject } from '../shell/project'
import { useUi } from '../shell/ui'
import type { ProActionKind } from '../../../main/pro/ipc'
import { ProModeSwitch } from './ProModeSwitch'
import { useBuild } from '../build/useBuild'
import { ElapsedText } from '../shell/BuildTimer'
import { initProBuild, useProBuild } from './buildStore'
import { initHw, openBottom, useHw } from './hwStore'
import { NOT_READY, PROGRAMMER_LABEL, loadProviders, providersReady, runProAction, shortChip, useProStore } from './proStore'
import './pro.css'

function ActionButton({ kind, id, icon, label, primary }: { kind: ProActionKind; id: string; icon: 'check' | 'arrow' | 'bolt'; label: string; primary?: boolean }): ReactNode {
  const ready = useProStore((s) => providersReady(s.providers, kind))
  const hasProject = useProStore((s) => !!s.project)
  const flashBusy = useHw((s) => s.flash.status === 'running')
  const dbg = useHw((s) => s.debug.status)
  const building = useBuild((s) => s.busy && s.kind === 'compile')
  const busy = (kind === 'flash' && flashBusy) || (kind === 'debug' && dbg === 'starting') || (kind === 'build' && building)
  const off = !ready || !hasProject
  const title = !hasProject ? 'Нет проекта профессионального режима: создайте или откройте проект STM32' : ready ? label : NOT_READY[kind]
  return (
    <button className={'hbtn' + (primary ? ' primary' : '') + (off ? ' pro-off' : '') + (kind === 'build' && building ? ' pb-building' : '') + (kind === 'debug' && dbg !== 'off' && dbg !== 'starting' ? ' on' : '')} data-testid={id} data-busy={busy || undefined} aria-disabled={off || busy} title={title} aria-label={label} onClick={() => void runProAction(kind)}>
      <Icon name={icon} size={16} /> <span className="hlabel">{kind === 'build' && building ? <>Сборка… <span className="pb-elapsed"><ElapsedText /></span></> : busy ? (kind === 'flash' ? 'Прошивка…' : 'Запуск…') : label}</span>
    </button>
  )
}

export default function ProHeader(): ReactNode {
  const project = useProStore((s) => s.project)
  const config = useProStore((s) => s.config)
  const setConfig = useProStore((s) => s.setConfig)
  const error = useProStore((s) => s.projectError)
  const name = useProject((s) => s.name)
  const sideVisible = useUi((s) => s.sideVisible)
  const bottomVisible = useUi((s) => s.bottomVisible)
  const toggleSide = useUi((s) => s.toggleSide)
  const toggleBottom = useUi((s) => s.toggleBottom)
  const setPalette = useUi((s) => s.setPalette)
  const probes = useHw((s) => s.probes)
  const probesLoaded = useHw((s) => s.probesLoaded)
  const building = useBuild((s) => s.busy && s.kind === 'compile')
  useEffect(() => {
    initProBuild()
    void useProBuild.getState().loadReport()
    void loadProviders()
    initHw()
    void useHw.getState().refreshProbes()
    void useHw.getState().refreshTools()
    const onFocus = (): void => { void useHw.getState().refreshProbes() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return (
    <header className="header pro-header" data-testid="header" data-mode="pro">
      <div className="hdr-group">
        <ActionButton kind="build" id="pro-build" icon="check" label="Собрать" />
        {building && <button className="hbtn pb-stop" data-testid="pro-build-stop" title="Остановить сборку" aria-label="Остановить сборку" onClick={() => useBuild.getState().cancel()}><Icon name="stop" size={14} fill /> <span className="hlabel">Остановить</span></button>}
        <ActionButton kind="flash" id="pro-flash" icon="arrow" label="Прошить" primary />
        <ActionButton kind="debug" id="pro-debug" icon="bolt" label="Отладка" />
      </div>

      <div className="hdr-group chips" data-testid="pro-chips-bar">
        {project ? (
          <>
            <label className="pro-field" title="Конфигурация сборки">
              <span className="pro-field-label hlabel">Конфигурация:</span>
              <Select className="small pro-config" data-testid="pro-config" aria-label="Конфигурация" value={config} onChange={(e) => setConfig(e.target.value)}>
                {Object.keys(project.configurations).map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </label>
            <span className="pro-dot hlabel" aria-hidden="true">·</span>
            <span className="pro-field" data-testid="pro-target" title={`${project.target.chip}${project.target.board ? ' · ' + project.target.board : ''}`}>
              <span className="pro-field-label hlabel">Цель:</span>
              <Chip icon="board">{shortChip(project.target.chip)}</Chip>
            </span>
            <span className="pro-dot hlabel" aria-hidden="true">·</span>
            <span className="pro-field" data-testid="pro-programmer" title="Программатор и интерфейс отладки">
              <span className="pro-field-label hlabel">Программатор:</span>
              <Chip icon="plug" tone={probesLoaded && !probes.length ? 'warn' : undefined} onClick={() => openBottom('hw')} title={probes.length ? `${probes[0].name}: открыть панель «Прошивка»` : 'ST-Link не найден: открыть панель «Прошивка»'}>
                <span data-testid="pro-probe">{probes.length ? probes[0].name : probesLoaded ? (PROGRAMMER_LABEL[project.programmer.kind] ?? 'Программатор') + ': не найден' : (PROGRAMMER_LABEL[project.programmer.kind] ?? project.programmer.kind)}</span>
              </Chip>
            </span>
          </>
        ) : (
          <Chip tone="warn" icon="warn" title={error ?? 'В открытой папке нет файла avride.project.json'}><span data-testid="pro-noproject">{error ? 'Файл проекта с ошибкой' : 'Нет проекта STM32'}</span></Chip>
        )}
      </div>

      <div className="hdr-mid">
        <div className="hdr-title" data-testid="hdr-title" title={name ? `Проект: ${name}` : undefined}>{name}</div>
      </div>

      <div className="hdr-group right">
        <ProModeSwitch />
        <span className="hdr-sep" aria-hidden="true" />
        <button className="icon-btn" title="Закрыть проект — вернуться на стартовый экран" aria-label="Закрыть проект" data-testid="hdr-close-project" onClick={() => void useProject.getState().closeProject()}><Icon name="home" size={16} /></button>
        <button className="icon-btn" data-testid="hdr-help" title="Справка: где что находится, горячие клавиши, тур" aria-label="Справка" onClick={() => useUi.getState().setHelp(true)}><Icon name="info" size={16} /></button>
        <button className="icon-btn" title="Командная палитра: любое действие по названию (Ctrl+Shift+P)" aria-label="Командная палитра" onClick={() => setPalette('commands')}><Icon name="command" size={16} /></button>
        <button className={'icon-btn' + (sideVisible ? ' on' : '')} title="Боковая панель (Ctrl+\)" aria-label="Боковая панель" onClick={toggleSide}><Icon name="sidebar" size={16} /></button>
        <button className={'icon-btn' + (bottomVisible ? ' on' : '')} title="Нижняя панель (Ctrl+`)" aria-label="Нижняя панель" onClick={toggleBottom}><Icon name="panelBottom" size={16} /></button>
      </div>
    </header>
  )
}

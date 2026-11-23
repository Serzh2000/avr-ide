import { useWorkspaceHeaderContext, WorkspaceHeaderActions, WorkspaceTitle } from '../shell/WorkspaceHeader'
import type { WorkspaceMenuAction } from '../shell/WorkspaceTools'
// Шапка Профессионального режима: Собрать / Прошить / Отладка, конфигурация, цель, программатор. Вместо плата/порт Arduino.
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../shell/icons'
import { Chip, Select, Spinner, usePopoverClose } from '../shell/kit'
import type { ProActionKind } from '../../../main/pro/ipc'
import { useBuild } from '../build/useBuild'
import { ElapsedText } from '../shell/BuildTimer'
import { initProBuild, useProBuild } from './buildStore'
import { initHw, openBottom, useHw } from './hwStore'
import { headerProbe, initProgrammer } from './programmer'
import { normalizeProgrammerKind } from '../../../shared/pro/programmers'
import { NOT_READY, loadProviders, providersReady, runProAction, shortChip, useProStore } from './proStore'
import './pro.css'

function ActionButton({ kind, id, icon, label, primary }: { kind: ProActionKind; id: string; icon: 'check' | 'arrow' | 'bolt'; label: string; primary?: boolean }): ReactNode {
  const ready = useProStore((s) => providersReady(s.providers, kind))
  const hasProject = useProStore((s) => !!s.project)
  const flashBusy = useHw((s) => s.flash.status === 'running')
  const dbg = useHw((s) => s.debug.status)
  const building = useBuild((s) => s.busy && s.kind === 'compile')
  const busy = (kind === 'flash' && flashBusy) || (kind === 'debug' && dbg === 'starting') || (kind === 'build' && building)
  const off = !ready || !hasProject
  const title = !hasProject ? 'Откройте исправный проект STM32' : ready ? label : NOT_READY[kind]
  return (
    <button className={'hbtn' + (primary ? ' primary' : '') + (off ? ' pro-off' : '') + (kind === 'build' && building ? ' pb-building' : '') + (kind === 'debug' && dbg !== 'off' && dbg !== 'starting' ? ' on' : '')} data-testid={id} data-busy={busy || undefined} aria-disabled={off || busy} title={title} aria-label={label} onClick={() => void runProAction(kind)}>
      {busy ? <Spinner /> : <Icon name={icon} size={16} />} <span className="hlabel">{kind === 'build' && building ? <>Сборка… <span className="pb-elapsed"><ElapsedText /></span></> : busy ? (kind === 'flash' ? 'Прошивка…' : 'Запуск…') : label}</span>
    </button>
  )
}

/** «Ещё» — при узкой шапке (<1100 px) конфигурация, цель и программатор сворачиваются в одно меню. */
function MoreMenu(): ReactNode {
  const project = useProStore((s) => s.project)
  const config = useProStore((s) => s.config)
  const setConfig = useProStore((s) => s.setConfig)
  const probes = useHw((s) => s.probes)
  const probesLoaded = useHw((s) => s.probesLoaded)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  usePopoverClose(open, () => setOpen(false), ref)
  if (!project) return null
  const hp = headerProbe(probes, probesLoaded, project.programmer.kind)
  return (
    <div className="chip-wrap pro-more" ref={ref}>
      <button className={'chip' + (open ? ' open' : '')} data-testid="pro-more" title="Конфигурация, цель и программатор" aria-label="Ещё: конфигурация, цель, программатор" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="sliders" size={14} /> <span className="chip-label">{config} · {shortChip(project.target.chip)}</span> <Icon name="chevD" size={12} />
      </button>
      {open && (
        <div className="popover pro-more-pop" role="dialog" aria-label="Конфигурация, цель, программатор">
          <div className="pop-head"><span className="grow">Параметры сборки</span><button className="icon-btn" aria-label="Закрыть" onClick={() => setOpen(false)}><Icon name="x" size={14} /></button></div>
          <div className="pro-more-body">
            <label className="pro-more-row">Конфигурация
              <Select className="small" aria-label="Конфигурация (меню)" value={config} onChange={(e) => setConfig(e.target.value)}>
                {Object.keys(project.configurations).map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </label>
            <div className="pro-more-row">Цель <Chip icon="board">{shortChip(project.target.chip)}</Chip></div>
            <div className="pro-more-row">Программатор
              <Chip icon="plug" tone={hp.missing ? 'warn' : undefined} onClick={() => { setOpen(false); openBottom('hw') }} title="Открыть панель «Прошивка»: выбор программатора">{hp.text}</Chip>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProHeader(): ReactNode {
  const project = useProStore((s) => s.project)
  const config = useProStore((s) => s.config)
  const setConfig = useProStore((s) => s.setConfig)
  const error = useProStore((s) => s.projectError)
  const { toolLabel, canFocusTool } = useWorkspaceHeaderContext()
  const compact = !!toolLabel
  const probes = useHw((s) => s.probes)
  const probesLoaded = useHw((s) => s.probesLoaded)
  const building = useBuild((s) => s.busy && s.kind === 'compile')
  const hp = headerProbe(probes, probesLoaded, normalizeProgrammerKind(project?.programmer.kind))
  useEffect(() => {
    initProBuild()
    void useProBuild.getState().loadReport()
    void loadProviders()
    initHw()
    initProgrammer()
    void useHw.getState().refreshProbes()
    void useHw.getState().refreshTools()
    const onFocus = (): void => { void useHw.getState().refreshProbes() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const projectActions: WorkspaceMenuAction[] = compact ? [
    { id: 'build', title: 'Собрать проект STM32', icon: 'check', run: () => void runProAction('build'), disabled: !project || building },
    ...(building ? [{ id: 'cancel', title: 'Остановить сборку', icon: 'stop', run: () => useBuild.getState().cancel() } as const] : []),
    { id: 'debug', title: 'Открыть отладку', icon: 'bolt', run: () => void runProAction('debug'), disabled: !project },
    { id: 'configs', title: 'Конфигурации сборки…', icon: 'sliders', run: () => useProBuild.getState().setDialog({ kind: 'configs' }), disabled: !project }
  ] : []

  return (
    <header className="header pro-header" data-testid="header" data-mode="pro" data-context={compact ? 'tool' : 'editor'}>
      {!compact && <>
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
              <Chip icon="plug" tone={hp.missing ? 'warn' : undefined} onClick={() => openBottom('hw')} title={`${hp.text}: открыть панель «Прошивка» (выбор программатора)`}>
                <span data-testid="pro-probe">{hp.text}</span>
              </Chip>
            </span>
            <MoreMenu />
          </>
        ) : (
          <Chip tone={error ? 'warn' : undefined} icon={error ? 'warn' : undefined} title={error ?? undefined}>
            <span data-testid="pro-noproject">{error ? 'Файл проекта с ошибкой' : 'Чтение проекта STM32…'}</span>
          </Chip>
        )}
      </div>

      </>}
      <WorkspaceTitle toolLabel={toolLabel} />
      <WorkspaceHeaderActions compact={compact} canFocusTool={canFocusTool} projectActions={projectActions} />
    </header>
  )
}

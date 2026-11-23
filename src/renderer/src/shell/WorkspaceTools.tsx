import { useRef, useState } from 'react'
import { useProStore } from '../pro/proStore'
import { useHw } from '../pro/hwStore'
import { Icon } from './icons'
import type { IconName } from './icons'
import { usePopoverClose } from './kit'
import { useProblems } from './useProblems'
import { useUi } from './ui'
import type { BottomTab } from './ui'

export const UTILITY_TABS: { id: BottomTab; title: string; icon: IconName; availability?: 'arduino' | 'stm32' }[] = [
  { id: 'output', title: 'Вывод', icon: 'terminal' },
  { id: 'problems', title: 'Проблемы', icon: 'warn' },
  { id: 'monitor', title: 'Монитор порта', icon: 'plug' },
  { id: 'plotter', title: 'Плоттер', icon: 'chart', availability: 'arduino' },
  { id: 'size', title: 'Размер программы', icon: 'chart', availability: 'stm32' },
  { id: 'hw', title: 'Мастер прошивки', icon: 'arrow', availability: 'stm32' },
  { id: 'debug', title: 'Отладка', icon: 'bolt', availability: 'stm32' },
  { id: 'swo', title: 'SWO', icon: 'terminal', availability: 'stm32' }
]

export interface WorkspaceMenuAction {
  id: string
  title: string
  icon: IconName
  run: () => void
  disabled?: boolean
}

export default function WorkspaceTools({ projectActions = [], viewActions = [] }: {
  projectActions?: WorkspaceMenuAction[]
  viewActions?: WorkspaceMenuAction[]
} = {}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const pro = useProStore((s) => s.proMode)
  const debug = useHw((s) => s.debug.status !== 'off')
  const swo = useHw((s) => s.swo.status === 'running')
  const problems = useProblems()
  usePopoverClose(open, () => setOpen(false), root, trigger)
  const choose = (run: () => void): void => {
    setOpen(false)
    trigger.current?.focus()
    run()
  }
  const action = ({ id, title, icon, run, disabled }: WorkspaceMenuAction) => (
    <button key={id} type="button" className="pop-item" data-testid={`workspace-action-${id}`} disabled={disabled} onClick={() => choose(run)}>
      <Icon name={icon} size={15} /><span>{title}</span>
    </button>
  )
  return (
    <div className="workspace-tools" ref={root}>
      <button ref={trigger} className="btn workspace-tools-trigger" data-testid="workspace-tools" title="Инструменты проекта"
        aria-label="Инструменты проекта" aria-expanded={open} aria-controls={open ? 'workspace-tools-menu' : undefined}
        onClick={() => setOpen(!open)}><span>Инструменты</span><Icon name="chevD" size={12} /></button>
      {open && (
        <div className="popover workspace-tools-menu" id="workspace-tools-menu">
          {projectActions.length > 0 && <div className="workspace-tools-section" role="group" aria-label="Действия проекта">
            <div className="workspace-tools-label" aria-hidden="true">Действия проекта</div>
            {projectActions.map(action)}
          </div>}
          <div className="workspace-tools-section" role="group" aria-label="Панели">
          <div className="workspace-tools-label" aria-hidden="true">Панели</div>
          {UTILITY_TABS.filter(({ availability }) => !availability || availability === (pro ? 'stm32' : 'arduino')).map(({ id, title, icon }) => (
            <button key={id} type="button" className="pop-item" data-testid={'btab-' + id} onClick={() => choose(() => useUi.getState().showBottom(id))}>
              <Icon name={icon} size={15} /><span className="grow">{title}</span>
              {id === 'problems' && problems.length > 0 && <span className="badge">{problems.length}</span>}
              {((id === 'debug' && debug) || (id === 'swo' && swo)) && <span className="badge" aria-label="Сеанс активен">●</span>}
            </button>
          ))}
          </div>
          {viewActions.length > 0 && <div className="workspace-tools-section" role="group" aria-label="Рабочая область">
            <div className="workspace-tools-label" aria-hidden="true">Рабочая область</div>
            {viewActions.map(action)}
          </div>}
        </div>
      )}
    </div>
  )
}

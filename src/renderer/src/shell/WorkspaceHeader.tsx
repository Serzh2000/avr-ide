import type { ReactNode } from 'react'
import { Icon } from './icons'
import { useProject } from './project'
import type { TabKind } from './project'
import { useUi } from './ui'
import WorkspaceTools from './WorkspaceTools'
import type { WorkspaceMenuAction } from './WorkspaceTools'

const labels: Partial<Record<TabKind, string>> = {
  ref: 'Справочник',
  ui: 'ESPUI',
  web: 'Веб-дизайнер',
  settings: 'Настройки',
  example: 'Пример',
  pins: 'Выводы и тактирование'
}

export function useWorkspaceHeaderContext() {
  const kind = useProject((s) => s.tabs.find((tab) => tab.id === s.activeId)?.kind)
  return {
    toolLabel: kind ? labels[kind] : undefined,
    canFocusTool: kind === 'ref' || kind === 'ui' || kind === 'web'
  }
}

export function WorkspaceTitle({ toolLabel }: { toolLabel?: string }): ReactNode {
  const name = useProject((s) => s.name)
  return (
    <div className="hdr-mid">
      <div className="hdr-title" data-testid="hdr-title" title={name || undefined}>{name}</div>
      {toolLabel && <span className="hdr-tool-label">{toolLabel}</span>}
    </div>
  )
}

export function WorkspaceHeaderActions({ compact, canFocusTool, projectActions = [], children }: {
  compact: boolean
  canFocusTool: boolean
  projectActions?: WorkspaceMenuAction[]
  children?: ReactNode
}): ReactNode {
  const { fullscreen, setFullscreen, sideVisible, toggleSide, setPalette, setHelp } = useUi()
  return (
    <div className="hdr-group right">
      <button className="icon-btn" title="Закрыть проект и вернуться к списку проектов" aria-label="Закрыть проект" data-testid="hdr-close-project" onClick={() => void useProject.getState().closeProject()}>
        <Icon name="home" size={16} />
      </button>
      {canFocusTool && (
        <button className={'icon-btn' + (fullscreen ? ' on' : '')} title={fullscreen ? 'Вернуть панели (Esc)' : 'Скрыть панели вокруг вкладки'} aria-label={fullscreen ? 'Вернуть панели' : 'Скрыть панели вокруг вкладки'} aria-pressed={fullscreen} onClick={() => setFullscreen(!fullscreen)}>
          <Icon name="collapse" size={16} />
        </button>
      )}
      <button className="icon-btn" title="Поиск команд (Ctrl+Shift+P)" aria-label="Поиск команд" onClick={() => setPalette('commands')}>
        <Icon name="command" size={16} />
      </button>
      {!compact && (
        <>
          <button className={'icon-btn' + (sideVisible ? ' on' : '')} title="Боковая панель (Ctrl+\)" aria-label="Боковая панель" aria-pressed={sideVisible} onClick={toggleSide}><Icon name="sidebar" size={16} /></button>
          <button className="icon-btn" data-testid="hdr-help" title="Справка" aria-label="Справка" onClick={() => setHelp(true)}><Icon name="info" size={16} /></button>
        </>
      )}
      <WorkspaceTools
        projectActions={projectActions}
        viewActions={compact ? [
          ...(fullscreen ? [] : [{ id: 'side', title: sideVisible ? 'Скрыть боковую панель' : 'Показать боковую панель', icon: 'sidebar', run: toggleSide } as const]),
          { id: 'help', title: 'Справка', icon: 'info', run: () => setHelp(true) }
        ] : []}
      />
      {children}
    </div>
  )
}

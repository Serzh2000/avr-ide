// Узкая панель значков слева (как в VS Code).
import type { ReactNode } from 'react'
import { useBuild } from '../build/useBuild'
import { Icon } from './icons'
import type { IconName } from './icons'
import { useProject } from './project'
import type { TabKind } from './project'
import { useUi } from './ui'
import type { SideView } from './ui'

interface Item { id: string; icon: IconName; title: string; side?: SideView; tab?: Exclude<TabKind, 'file'> }

const TOP: Item[] = [
  { id: 'files', icon: 'files', title: 'Проводник — файлы проекта (Ctrl+Shift+E)', side: 'files' },
  { id: 'boards', icon: 'board', title: 'Платы и библиотеки (Ctrl+Shift+X)', side: 'boards' },
  { id: 'ref', icon: 'book', title: 'Справочник по функциям и платам (F1)', tab: 'ref' },
  { id: 'ui', icon: 'layout', title: 'Конструктор ESPUI — веб-интерфейс для ESP', tab: 'ui' },
  { id: 'web', icon: 'web', title: 'Веб-дизайнер — HTML и CSS', tab: 'web' }
]
const BOTTOM: Item[] = [{ id: 'settings', icon: 'gear', title: 'Настройки (Ctrl+,)', tab: 'settings' }]

export default function ActivityBar(): ReactNode {
  const sideVisible = useUi((s) => s.sideVisible)
  const sideView = useUi((s) => s.sideView)
  const showSide = useUi((s) => s.showSide)
  const activeId = useProject((s) => s.activeId)
  const openPanel = useProject((s) => s.openPanel)
  const tabs = useProject((s) => s.tabs)
  const needCores = useBuild((s) => s.status?.found && s.cores !== null && s.cores.length === 0)

  const btn = (it: Item): ReactNode => {
    const active = it.side ? sideVisible && sideView === it.side : activeId === it.tab
    const open = it.tab ? tabs.some((t) => t.id === it.tab) : false
    return (
      <button key={it.id} className={'act-btn' + (active ? ' active' : '') + (open && !active ? ' open' : '')} title={it.title} aria-label={it.title} aria-pressed={active}
        onClick={() => (it.side ? showSide(it.side) : openPanel(it.tab!))}>
        <Icon name={it.icon} size={24} />
        {it.id === 'boards' && needCores && <span className="act-badge" title="Нужно установить поддержку плат" />}
      </button>
    )
  }
  return (
    <nav className="activity" aria-label="Разделы">
      <div className="act-group">{TOP.map(btn)}</div>
      <div className="act-group">{BOTTOM.map(btn)}</div>
    </nav>
  )
}

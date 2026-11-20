// Узкая панель значков слева (как в VS Code).
import type { ReactNode } from 'react'
import { useBuild } from '../build/useBuild'
import { Icon } from './icons'
import type { IconName } from './icons'
import { useProject } from './project'
import type { TabKind } from './project'
import { useUi } from './ui'
import type { SideView } from './ui'

interface Item { id: string; icon: IconName; label: string; title: string; side?: SideView; tab?: Exclude<TabKind, 'file'> }
interface Group { id: string; title: string; items: Item[] }

// Три группы по смыслу: работа с кодом проекта, платы и справочные материалы, визуальные конструкторы.
const GROUPS: Group[] = [
  { id: 'code', title: 'Проект', items: [
    { id: 'files', icon: 'files', label: 'Файлы', title: 'Файлы проекта (Ctrl+Shift+E)', side: 'files' },
    { id: 'search', icon: 'search', label: 'Поиск', title: 'Поиск по проекту (Ctrl+Shift+F)', side: 'search' },
    { id: 'examples', icon: 'code', label: 'Примеры', title: 'Готовые скетчи, чтобы начать быстрее (Файл → Примеры)', side: 'examples' }
  ] },
  { id: 'hw', title: 'Платы и библиотеки', items: [
    { id: 'boards', icon: 'board', label: 'Платы', title: 'Платы — поддержка плат (ядра) и источники (Ctrl+Shift+X)', side: 'boards' },
    { id: 'libs', icon: 'library', label: 'Библиотеки', title: 'Библиотеки — готовый код для датчиков и модулей (Ctrl+Shift+K)', side: 'libs' },
    { id: 'ref', icon: 'book', label: 'Справочник', title: 'Справочник по функциям, платам и распиновке (F1)', tab: 'ref' }
  ] },
  { id: 'tools', title: 'Конструкторы', items: [
    { id: 'ui', icon: 'layout', label: 'ESPUI', title: 'Конструктор ESPUI — веб-пульт управления для ESP без HTML', tab: 'ui' },
    { id: 'web', icon: 'web', label: 'Веб-сайт', title: 'Веб-дизайнер — свой HTML и CSS для ESP', tab: 'web' }
  ] }
]
const BOTTOM: Item[] = [{ id: 'settings', icon: 'gear', label: 'Настройки', title: 'Настройки (Ctrl+,)', tab: 'settings' }]

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
      <button key={it.id} data-testid={'act-' + it.id} className={'act-btn' + (active ? ' active' : '') + (open && !active ? ' open' : '')} title={it.title} aria-label={it.title} aria-pressed={active}
        onClick={() => (it.side ? showSide(it.side) : openPanel(it.tab!))}>
        <Icon name={it.icon} size={22} />
        <span className="act-label">{it.label}</span>
        {it.id === 'boards' && needCores && <span className="act-badge" title="Нужно установить поддержку плат" />}
      </button>
    )
  }
  return (
    <nav className="activity" data-testid="activity" aria-label="Разделы">
      <div className="act-scroll">
        {GROUPS.map((g) => <div className="act-group" key={g.id} role="group" aria-label={g.title}>{g.items.map(btn)}</div>)}
      </div>
      <div className="act-group act-bottom">{BOTTOM.map(btn)}</div>
    </nav>
  )
}

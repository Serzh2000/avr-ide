// Панель значков слева в Профессиональном режиме: Файлы, Поиск, Проект, Чипы и платы, Настройки (разделы Arduino скрыты).
import type { ReactNode } from 'react'
import { Icon } from '../shell/icons'
import type { IconName } from '../shell/icons'
import { useProject } from '../shell/project'
import { useUi } from '../shell/ui'
import type { SideView } from '../shell/ui'
import ProChipsPanel from './ProChipsPanel'
import ProProjectPanel from './ProProjectPanel'
import './pro.css'

interface Item { id: string; icon: IconName; label: string; title: string; side?: SideView }

const ITEMS: Item[] = [
  { id: 'files', icon: 'files', label: 'Файлы', title: 'Файлы проекта (Ctrl+Shift+E)', side: 'files' },
  { id: 'search', icon: 'search', label: 'Поиск', title: 'Поиск по проекту (Ctrl+Shift+F)', side: 'search' },
  { id: 'project', icon: 'layout', label: 'Проект', title: 'Проект: исходники, заголовки, startup, скрипт компоновщика, конфигурации и цель', side: 'project' },
  { id: 'chips', icon: 'board', label: 'Чипы', title: 'Чипы и платы STM32: справочник кристаллов и плат', side: 'chips' }
]

export default function ProActivityBar(): ReactNode {
  const sideVisible = useUi((s) => s.sideVisible)
  const sideView = useUi((s) => s.sideView)
  const showSide = useUi((s) => s.showSide)
  const compact = useUi((s) => s.settings.compactRail)
  const activeId = useProject((s) => s.activeId)
  const openPanel = useProject((s) => s.openPanel)
  const tabs = useProject((s) => s.tabs)

  const btn = (it: Item): ReactNode => {
    const active = sideVisible && sideView === it.side
    return (
      <button key={it.id} data-testid={'act-' + it.id} className={'act-btn' + (active ? ' active' : '')} title={it.title} aria-label={it.title} aria-pressed={active} onClick={() => showSide(it.side!)}>
        <Icon name={it.icon} size={22} />
        <span className="act-label">{it.label}</span>
      </button>
    )
  }
  const settingsActive = activeId === 'settings'
  const onKey = (e: React.KeyboardEvent<HTMLElement>): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
    const all = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('.act-btn')]
    const i = all.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    e.preventDefault()
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length
    all[next].focus()
  }
  return (
    <nav className={'activity' + (compact ? ' compact' : '')} data-testid="activity" data-mode="pro" aria-label="Разделы" onKeyDown={onKey}>
      <div className="act-scroll">
        <div className="act-group" role="group" aria-label="Проект">{ITEMS.map(btn)}</div>
      </div>
      <div className="act-group act-bottom">
        <button data-testid="act-settings" className={'act-btn' + (settingsActive ? ' active' : '') + (tabs.some((t) => t.id === 'settings') && !settingsActive ? ' open' : '')} title="Настройки (Ctrl+,)" aria-label="Настройки (Ctrl+,)" aria-pressed={settingsActive} onClick={() => openPanel('settings')}>
          <Icon name="gear" size={22} /><span className="act-label">Настройки</span>
        </button>
      </div>
    </nav>
  )
}

/** Содержимое боковой области для разделов Pro-режима (Файлы и Поиск показывает общая оболочка). */
export function ProSidePanel({ view }: { view: SideView }): ReactNode {
  return view === 'project' ? <ProProjectPanel /> : view === 'chips' ? <ProChipsPanel /> : null
}

import { Button, Toast } from './kit'
import type { ReactNode } from 'react'
import { findBoardName } from '../build/boardRows'
import { Icon } from './icons'
import { useProject } from './project'
import { formatWhen, midEllipsis, shortBoard } from './startLogic'
import { useUi } from './ui'

/** Всплывающее сообщение (на стартовом экране нет строки состояния, где обычно показываются уведомления). */
export function Notice(): ReactNode {
  return <Toast />
}

export default function StartScreen(): ReactNode {
  const recent = useProject((s) => s.recent)
  const theme = useUi((s) => s.settings.theme)
  const setSettings = useUi((s) => s.setSettings)
  const setWizard = useUi((s) => s.setWizard)
  const setHelp = useUi((s) => s.setHelp)
  const p = useProject.getState
  return (
    <main className="start" aria-label="Стартовый экран" data-testid="start-screen">
      <div className="start-toolbar">
        <button className="icon-btn" title="Справка: как начать, горячие клавиши" aria-label="Справка" data-testid="start-help" onClick={() => setHelp(true)}><Icon name="info" size={17} /></button>
          <button className="icon-btn start-theme" title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'} aria-label="Сменить тему"
          onClick={() => setSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
        </button>
      </div>

      <div className="start-inner">
        <header className="start-heading">
          <h1>Проекты</h1>
          <div className="start-actions">
            <Button variant="primary" data-testid="start-create" onClick={() => setWizard(true)}>
              <Icon name="folderPlus" size={16} /> Создать проект
            </Button>
            <Button data-testid="start-open" onClick={() => void p().pickOpen()}>
              <Icon name="folderOpen" size={16} /> Открыть проект
            </Button>
          </div>
        </header>

        {recent.length > 0 ? (
          <section className="start-recent" aria-label="Недавние проекты">
            <h2>Недавние проекты</h2>
            <ul>
              {recent.slice(0, 6).map((r) => {
                const board = shortBoard(r.fqbn, (f) => findBoardName(f) ?? undefined)
                return (
                  <li key={r.path}>
                    <button className="sr-open" data-testid="start-recent" onClick={() => void p().openRecent(r.path)} title={r.path}>
                      <Icon name="folder" size={16} />
                      <span className="sr-name">{r.name}</span>
                      <span className="sr-board" title={board}>{board}</span>
                      <span className="sr-path">{midEllipsis(r.path)}</span>
                      <span className="sr-when">{formatWhen(r.lastOpened)}</span>
                    </button>
                    <button className="icon-btn sr-remove" title="Убрать из списка" aria-label={`Убрать «${r.name}» из списка`}
                      onClick={async () => { await window.api.project.removeRecent(r.path); await p().refreshRecent() }}>
                      <Icon name="x" size={14} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : <p className="start-empty">Здесь появятся проекты, которые вы откроете.</p>}
      </div>
    </main>
  )
}

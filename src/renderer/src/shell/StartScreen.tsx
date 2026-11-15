// Стартовый экран: две большие кнопки и короткий список недавних проектов. Больше ничего.
import type { ReactNode } from 'react'
import { findBoardName } from '../build/boardRows'
import { Icon } from './icons'
import type { IconName } from './icons'
import { useProject } from './project'
import { formatWhen, midEllipsis, shortBoard } from './startLogic'
import { useUi } from './ui'

function BigButton({ icon, title, hint, primary, onClick }: { icon: IconName; title: string; hint: string; primary?: boolean; onClick: () => void }): ReactNode {
  return (
    <button className={'start-card' + (primary ? ' primary' : '')} onClick={onClick}>
      <span className="start-card-ico"><Icon name={icon} size={26} /></span>
      <span className="start-card-title">{title}</span>
      <span className="start-card-hint">{hint}</span>
    </button>
  )
}

/** Всплывающее сообщение (на стартовом экране нет строки состояния, где обычно показываются уведомления). */
export function Notice(): ReactNode {
  const notice = useUi((s) => s.notice)
  return notice ? <div className="toast" role="status">{notice.text}</div> : null
}

export default function StartScreen(): ReactNode {
  const recent = useProject((s) => s.recent)
  const theme = useUi((s) => s.settings.theme)
  const setSettings = useUi((s) => s.setSettings)
  const setWizard = useUi((s) => s.setWizard)
  const p = useProject.getState

  return (
    <main className="start" aria-label="Стартовый экран">
      <button className="icon-btn start-theme" title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'} aria-label="Сменить тему"
        onClick={() => setSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}>
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
      </button>

      <div className="start-inner">
        <div className="start-brand">
          <svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="var(--accent)" />
            <rect x="20" y="20" width="24" height="24" rx="3" fill="none" stroke="#fff" strokeWidth="3.5" />
            <path d="M26 12v8M38 12v8M26 44v8M38 44v8M12 26h8M12 38h8M44 26h8M44 38h8" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
          <h1>AVR IDE</h1>
          <p>Среда разработки для Arduino и ESP</p>
        </div>

        <div className="start-actions">
          <BigButton primary icon="folderPlus" title="Создать проект" hint="Выберите плату и назовите проект" onClick={() => setWizard(true)} />
          <BigButton icon="folderOpen" title="Открыть проект" hint="Папка со скетчем, который уже есть" onClick={() => void p().pickOpen()} />
        </div>

        {recent.length > 0 && (
          <section className="start-recent" aria-label="Недавние проекты">
            <h2>Недавние</h2>
            <ul>
              {recent.slice(0, 6).map((r) => {
                const board = shortBoard(r.fqbn, (f) => findBoardName(f) ?? undefined)
                return (
                  <li key={r.path}>
                    <button className="sr-open" onClick={() => void p().openRecent(r.path)} title={r.path}>
                      <Icon name="folder" size={16} />
                      <span className="sr-name">{r.name}</span>
                      {board && <span className="sr-board">{board}</span>}
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
        )}
      </div>
    </main>
  )
}

// Страница «Добро пожаловать»: быстрые действия, недавние проекты, примеры, подсказки.
import type { ReactNode } from 'react'
import { Icon } from './icons'
import type { IconName } from './icons'
import { useProject } from './project'
import SetupCard from './SetupCard'
import { useUi } from './ui'

const KEYS: [string, string][] = [
  ['Ctrl+B', 'Проверить скетч'],
  ['Ctrl+U', 'Загрузить на плату'],
  ['Ctrl+S', 'Сохранить'],
  ['Ctrl+P', 'Перейти к файлу'],
  ['Ctrl+Shift+P', 'Все команды'],
  ['F1', 'Справка по слову']
]

function Action({ icon, title, hint, onClick }: { icon: IconName; title: string; hint: string; onClick: () => void }): ReactNode {
  return (
    <button className="wl-action" onClick={onClick}>
      <span className="wl-ico"><Icon name={icon} size={20} /></span>
      <span className="wl-text"><span className="wl-title">{title}</span><span className="wl-hint">{hint}</span></span>
    </button>
  )
}

export default function Welcome(): ReactNode {
  const recent = useProject((s) => s.recent)
  const templates = useProject((s) => s.templates)
  const p = useProject.getState
  const setNewSketch = useUi((s) => s.setNewSketch)

  return (
    <div className="welcome">
      <div className="wl-head">
        <svg width="44" height="44" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="14" fill="var(--accent)" />
          <rect x="20" y="20" width="24" height="24" rx="3" fill="none" stroke="#fff" strokeWidth="3.5" />
          <path d="M26 12v8M38 12v8M26 44v8M38 44v8M12 26h8M12 38h8M44 26h8M44 38h8" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
        <div>
          <h1>AVR IDE</h1>
          <p>Среда разработки для Arduino, ESP8266 и ESP32</p>
        </div>
      </div>

      <div className="wl-grid">
        <section>
          <h2>Начать</h2>
          <Action icon="filePlus" title="Новый скетч" hint="Из шаблона: Blink, Wi-Fi, пустой" onClick={() => setNewSketch({})} />
          <Action icon="folderOpen" title="Открыть папку проекта" hint="Папка со скетчем (Ctrl+O)" onClick={() => void p().pickOpen()} />
          <Action icon="file" title="Открыть файл" hint="Откроется .ino вместе с его папкой" onClick={() => void p().pickOpenFile()} />
          <Action icon="layout" title="Конструктор ESPUI" hint="Соберите веб-интерфейс для ESP мышкой" onClick={() => p().openPanel('ui')} />
          <Action icon="book" title="Справочник" hint="Функции Arduino, ESP, распиновка плат" onClick={() => p().openPanel('ref')} />

          <h2>Недавние проекты</h2>
          {recent.length === 0 && <p className="dim small">Здесь появятся проекты, которые вы откроете или создадите.</p>}
          <ul className="recent">
            {recent.slice(0, 8).map((r) => (
              <li key={r.path}>
                <button className="recent-open" onClick={() => void p().openRecent(r.path)} title={r.path}>
                  <Icon name="folder" size={15} />
                  <span className="recent-name">{r.name}</span>
                  <span className="recent-path">{r.path}</span>
                </button>
                <button className="icon-btn" title="Убрать из списка" onClick={async () => { await window.api.project.removeRecent(r.path); await p().refreshRecent() }}><Icon name="x" size={13} /></button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SetupCard />
          <h2>Шаблоны</h2>
          <div className="tpl-grid">
            {templates.map((t) => (
              <button key={t.id} className="tpl" onClick={() => setNewSketch({ template: t.id })} title={`Создать скетч из шаблона «${t.name}»`}>
                <span className="tpl-name">{t.name}</span>
                <span className="tpl-desc">{t.description}</span>
              </button>
            ))}
          </div>
          <h2>Горячие клавиши</h2>
          <div className="keys">
            {KEYS.map(([k, d]) => (
              <div key={k} className="key-row"><kbd>{k}</kbd><span>{d}</span></div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

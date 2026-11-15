// Вкладка «Настройки».
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useBuild } from '../build/useBuild'
import { Icon } from './icons'
import { useUi } from './ui'

export default function SettingsView(): ReactNode {
  const settings = useUi((s) => s.settings)
  const setSettings = useUi((s) => s.setSettings)
  const notify = useUi((s) => s.notify)
  const status = useBuild((s) => s.status)
  const recheck = useBuild((s) => s.recheck)
  const [book, setBook] = useState('')
  useEffect(() => { void window.api.project.sketchbook().then((r) => { if (r.ok) setBook(r.data) }) }, [])

  const sourceLabel = status?.source === 'bundled' ? 'встроенный в приложение' : status?.source === 'custom' ? 'указан вами' : status?.source === 'path' ? 'найден в PATH' : ''

  return (
    <div className="settings">
      <h1>Настройки</h1>

      <section>
        <h2>Внешний вид</h2>
        <div className="set-row">
          <div className="set-label"><b>Тема</b><span className="dim">Оформление всего окна и редактора</span></div>
          <div className="seg wide">
            <button className={settings.theme === 'dark' ? 'on' : ''} onClick={() => setSettings({ theme: 'dark' })}><Icon name="moon" size={14} /> Тёмная</button>
            <button className={settings.theme === 'light' ? 'on' : ''} onClick={() => setSettings({ theme: 'light' })}><Icon name="sun" size={14} /> Светлая</button>
          </div>
        </div>
        <div className="set-row">
          <div className="set-label"><b>Размер шрифта в редакторе</b><span className="dim">Также Ctrl + «=» / Ctrl + «−»</span></div>
          <div className="range-row">
            <input type="range" min={10} max={28} value={settings.fontSize} onChange={(e) => setSettings({ fontSize: Number(e.target.value) })} aria-label="Размер шрифта" />
            <span className="range-val">{settings.fontSize} px</span>
          </div>
        </div>
      </section>

      <section>
        <h2>Редактор</h2>
        <label className="set-row">
          <div className="set-label"><b>Автосохранение</b><span className="dim">Сохранять файл через секунду после последнего изменения</span></div>
          <input type="checkbox" className="switch" checked={settings.autosave} onChange={(e) => setSettings({ autosave: e.target.checked })} />
        </label>
        <label className="set-row">
          <div className="set-label"><b>Миникарта</b><span className="dim">Уменьшенный обзор файла справа от кода</span></div>
          <input type="checkbox" className="switch" checked={settings.minimap} onChange={(e) => setSettings({ minimap: e.target.checked })} />
        </label>
      </section>

      <section>
        <h2>arduino-cli</h2>
        <div className="set-row col">
          <div className="set-label"><b>Расположение</b>
            <span className="dim">
              {status === null ? 'Проверяем…' : status.found ? `${sourceLabel}${status.version ? ', версия ' + status.version : ''}` : 'Не найден — укажите путь вручную'}
            </span>
          </div>
          <code className="path-box">{status?.path ?? '—'}</code>
          <div className="row-actions">
            <button className="btn" onClick={async () => {
              const r = await window.api.cli.pickPath()
              if (!r.ok) notify(r.error); else if (r.data) { await recheck(); notify('Путь к arduino-cli сохранён.') }
            }}>Выбрать файл…</button>
            <button className="btn" disabled={status?.source !== 'custom'} onClick={async () => { await window.api.cli.resetPath(); await recheck() }}>Сбросить на автопоиск</button>
            <button className="btn" onClick={async () => { const s = await recheck(); notify(s.found ? 'arduino-cli найден.' : 'arduino-cli не найден.') }}>Проверить</button>
          </div>
        </div>
      </section>

      <section>
        <h2>Проекты</h2>
        <div className="set-row col">
          <div className="set-label"><b>Папка для новых скетчей</b><span className="dim">Сюда по умолчанию создаются новые проекты</span></div>
          <code className="path-box">{book || '—'}</code>
          <div className="row-actions">
            <button className="btn" onClick={async () => { const r = await window.api.project.pickSketchbook(); if (r.ok && r.data) setBook(r.data) }}>Изменить…</button>
          </div>
        </div>
      </section>
    </div>
  )
}

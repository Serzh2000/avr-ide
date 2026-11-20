// Вкладка «Настройки».
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useBuild } from '../build/useBuild'
import { Icon } from './icons'
import { Button, Switch, Tabs } from './kit'
import { useUi } from './ui'

const SETTING_KEYS = [
  'внешний вид тема тёмная светлая шрифт компактная боковая панель подписи',
  'редактор автосохранение миникарта сохранять',
  'сборка загрузка arduino-cli путь расположение компилятор',
  'проекты папка скетчей новые'
]

export default function SettingsView(): ReactNode {
  const settings = useUi((s) => s.settings)
  const setSettings = useUi((s) => s.setSettings)
  const notify = useUi((s) => s.notify)
  const status = useBuild((s) => s.status)
  const recheck = useBuild((s) => s.recheck)
  const [book, setBook] = useState('')
  const [q, setQ] = useState('')
  const hit = (...t: string[]): boolean => !q.trim() || t.join(' ').toLowerCase().includes(q.trim().toLowerCase())
  useEffect(() => { void window.api.project.sketchbook().then((r) => { if (r.ok) setBook(r.data) }) }, [])

  const sourceLabel = status?.source === 'bundled' ? 'встроенный в приложение' : status?.source === 'custom' ? 'указан вами' : status?.source === 'path' ? 'найден в PATH' : ''

  return (
    <div className="settings">
      <h1>Настройки</h1>
      <div className="side-search set-search">
        <Icon name="search" size={14} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти настройку: тема, шрифт, путь…" aria-label="Поиск по настройкам" spellCheck={false} />
        {q && <button className="icon-btn" aria-label="Очистить поиск" onClick={() => setQ('')}><Icon name="x" size={13} /></button>}
      </div>

      {hit('внешний вид тема тёмная светлая шрифт компактная боковая панель подписи') && (
      <section>
        <h2>Внешний вид</h2>
        <div className="set-row">
          <div className="set-label"><b>Тема</b><span className="dim">Оформление всего окна и редактора</span></div>
          <Tabs className="wide" label="Тема" value={settings.theme} onChange={(v) => setSettings({ theme: v })} items={[{ id: 'dark', label: <><Icon name="moon" size={14} /> Тёмная</> }, { id: 'light', label: <><Icon name="sun" size={14} /> Светлая</> }]} />
        </div>
        <Switch title="Компактная боковая панель" hint="Только значки, без подписей — больше места для кода" checked={settings.compactRail} onChange={(v) => setSettings({ compactRail: v })} />
        <div className="set-row">
          <div className="set-label"><b>Размер шрифта в редакторе</b><span className="dim">Также Ctrl + «=» / Ctrl + «−»</span></div>
          <div className="range-row">
            <input type="range" min={10} max={28} value={settings.fontSize} onChange={(e) => setSettings({ fontSize: Number(e.target.value) })} aria-label="Размер шрифта" />
            <span className="range-val">{settings.fontSize} px</span>
          </div>
        </div>
      </section>
      )}

      {hit('редактор автосохранение миникарта сохранять') && (
      <section>
        <h2>Редактор</h2>
        <Switch title="Автосохранение" hint="Сохранять файл через секунду после последнего изменения, чтобы не потерять правки" checked={settings.autosave} onChange={(v) => setSettings({ autosave: v })} />
        <Switch title="Миникарта" hint="Уменьшенный обзор файла справа от кода — удобно в длинных скетчах" checked={settings.minimap} onChange={(v) => setSettings({ minimap: v })} />
      </section>
      )}

      {hit('сборка загрузка arduino-cli путь расположение компилятор') && (
      <section>
        <h2>Сборка и загрузка</h2>
        <div className="set-row col">
          <div className="set-label"><b>Программа arduino-cli</b>
            <span className="dim">
              Компилирует скетчи и загружает их на плату. {status === null ? 'Проверяем…' : status.found ? `${sourceLabel ? sourceLabel[0].toUpperCase() + sourceLabel.slice(1) : 'Найдена'}${status.version ? ', версия ' + status.version : ''}.` : 'Не найдена — укажите путь вручную.'}
            </span>
          </div>
          <code className="path-box">{status?.path ?? '—'}</code>
          <div className="row-actions">
            <Button onClick={async () => {
              const r = await window.api.cli.pickPath()
              if (!r.ok) notify(r.error); else if (r.data) { await recheck(); notify('Путь к arduino-cli сохранён.') }
            }}>Выбрать файл…</Button>
            <Button disabled={status?.source !== 'custom'} onClick={async () => { await window.api.cli.resetPath(); await recheck() }}>Сбросить на автопоиск</Button>
            <Button onClick={async () => { const s = await recheck(); notify(s.found ? 'arduino-cli найден.' : 'arduino-cli не найден.') }}>Проверить</Button>
          </div>
        </div>
      </section>
      )}

      {hit('проекты папка скетчей новые') && (
      <section>
        <h2>Проекты</h2>
        <div className="set-row col">
          <div className="set-label"><b>Папка для новых скетчей</b><span className="dim">Сюда по умолчанию создаются новые проекты</span></div>
          <code className="path-box">{book || '—'}</code>
          <div className="row-actions">
            <Button onClick={async () => { const r = await window.api.project.pickSketchbook(); if (r.ok && r.data) setBook(r.data) }}>Изменить…</Button>
          </div>
        </div>
      </section>
      )}
      {q.trim() !== '' && !SETTING_KEYS.some((k) => hit(k)) && <p className="dim">Ничего не найдено. Попробуйте «тема», «шрифт» или «путь».</p>}
    </div>
  )
}

// Область редактора: вкладки и их содержимое (код, конструкторы, справочник, настройки, приветствие).
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Editor from '../Editor'
import type { EditorPlatform } from '../editor/types'
import { useBuild } from '../build/useBuild'
import ReferencePanel from '../reference/ReferencePanel'
import UiBuilder from '../uibuilder/UiBuilder'
import WebDesigner from '../webdesign/WebDesigner'
import { openReference } from './commands'
import { FileIcon, Icon } from './icons'
import type { IconName } from './icons'
import { ContextMenu, EmptyState } from './kit'
import type { MenuItem } from './kit'
import { useUiHost } from './host'
import { markersFor, samePath } from './problems'
import { baseName } from './problems'
import { isDirty, useProject } from './project'
import type { Tab } from './project'
import SettingsView from './SettingsView'
import { useUi } from './ui'
import Welcome from './Welcome'

const TITLES: Record<string, { title: string; icon: IconName }> = {
  ref: { title: 'Справочник', icon: 'book' },
  ui: { title: 'Конструктор ESPUI', icon: 'layout' },
  web: { title: 'Веб-дизайнер', icon: 'web' },
  settings: { title: 'Настройки', icon: 'gear' },
  welcome: { title: 'Добро пожаловать', icon: 'home' }
}

function TabBar(): ReactNode {
  const tabs = useProject((s) => s.tabs)
  const activeId = useProject((s) => s.activeId)
  const docs = useProject((s) => s.docs)
  const activate = useProject((s) => s.activate)
  const closeTab = useProject((s) => s.closeTab)
  const closeMany = useProject((s) => s.closeMany)
  const saveAll = useProject((s) => s.saveAll)
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const anyDirty = Object.values(docs).some(isDirty)

  useEffect(() => {
    document.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeId])

  const ctx = (e: React.MouseEvent, t: Tab): void => {
    e.preventDefault()
    setMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'Закрыть', hint: 'Ctrl+W', onClick: () => void closeTab(t.id) },
        { label: 'Закрыть остальные', disabled: tabs.length < 2, onClick: () => void closeMany(tabs.filter((x) => x.id !== t.id).map((x) => x.id)) },
        { label: 'Закрыть все', onClick: () => void closeMany(tabs.map((x) => x.id)) },
        ...(t.path ? [{ separator: true }, { label: 'Копировать путь', onClick: () => void navigator.clipboard?.writeText(t.path!) }] : [])
      ]
    })
  }

  return (
    <div className="tabbar">
      <div className="tabs-scroll" role="tablist">
        {tabs.map((t) => {
          const meta = TITLES[t.kind]
          const name = t.path ? baseName(t.path) : meta.title
          const dirty = t.path ? isDirty(docs[t.path]) : false
          return (
            <div key={t.id} role="tab" aria-selected={t.id === activeId} className={'tab' + (t.id === activeId ? ' active' : '')} title={t.path ?? meta.title}
              onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); void closeTab(t.id) } else if (e.button === 0) activate(t.id) }}
              onContextMenu={(e) => ctx(e, t)}>
              {t.path ? <FileIcon name={name} /> : <Icon name={meta.icon} size={14} />}
              <span className="tab-name">{name}</span>
              <button className={'tab-close' + (dirty ? ' dirty' : '')} aria-label={`Закрыть ${name}`} title={dirty ? 'Есть несохранённые изменения — закрыть' : 'Закрыть (Ctrl+W)'}
                onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); void closeTab(t.id) }}>
                {dirty ? <span className="dirty-dot" /> : null}
                <Icon name="x" size={13} />
              </button>
            </div>
          )
        })}
      </div>
      <div className="tabbar-actions">
        {anyDirty && <button className="icon-btn" title="Сохранить всё (Ctrl+Shift+S)" onClick={() => void saveAll()}><Icon name="save" size={15} /></button>}
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  )
}

export default function EditorArea(): ReactNode {
  const tabs = useProject((s) => s.tabs)
  const activeId = useProject((s) => s.activeId)
  const docs = useProject((s) => s.docs)
  const root = useProject((s) => s.root)
  const reveal = useProject((s) => s.reveal)
  const setContent = useProject((s) => s.setContent)
  const saveFile = useProject((s) => s.saveFile)
  const problems = useBuild((s) => s.problems)
  const { settings, setCursor, fqbn } = useUi()
  const host = useUiHost()
  const [everFile, setEverFile] = useState(false)

  const active = tabs.find((t) => t.id === activeId)
  const filePath = active?.kind === 'file' ? active.path ?? null : null
  const doc = filePath ? docs[filePath] : undefined
  useEffect(() => { if (filePath) setEverFile(true) }, [filePath])
  // Маркеры ошибок сборки гасим при любой правке файла (позиции устарели)
  const snap = useRef<{ problems: unknown; docs: Record<string, string> }>({ problems: null, docs: {} })
  if (snap.current.problems !== problems) {
    snap.current = { problems, docs: Object.fromEntries(Object.entries(docs).map(([p, d]) => [p, d.content])) }
  }
  const fresh = !!filePath && snap.current.docs[filePath] === doc?.content
  const markers = useMemo(() => (fresh ? markersFor(problems, filePath) : []), [problems, filePath, fresh])
  const refQuery = useProject((s) => s.refQuery)
  const platform: EditorPlatform | null = fqbn.includes(':esp32s3') ? 'esp32s3' : fqbn.includes(':esp32c3') ? 'esp32c3' : host.platform

  const has = (k: string): boolean => tabs.some((t) => t.id === k)
  const showEmpty = !active

  return (
    <div className="editor-area">
      <TabBar />
      <div className="views">
        {(everFile || filePath) && (
          <div className="view" hidden={!filePath}>
            <Editor
              value={doc?.content ?? ''}
              onChange={(v) => { if (filePath) setContent(filePath, v) }}
              onSave={() => { if (filePath) void saveFile(filePath) }}
              filePath={filePath}
              markers={markers}
              reveal={reveal && filePath && samePath(reveal.path, filePath) ? { line: reveal.line, column: reveal.column, nonce: reveal.nonce } : null}
              onOpenReference={(w) => openReference(w)}
              onCursorChange={setCursor}
              fontSize={settings.fontSize}
              theme={settings.theme}
              platform={platform}
              minimap={settings.minimap}
            />
          </div>
        )}
        {has('ref') && <div className="view scroll-host" hidden={activeId !== 'ref'}><ReferencePanel initialQuery={refQuery} platform={platform ?? undefined} /></div>}
        {has('ui') && <div className="view" hidden={activeId !== 'ui'}><UiBuilder host={host} /></div>}
        {has('web') && <div className="view" hidden={activeId !== 'web'}><WebDesigner host={host} /></div>}
        {activeId === 'settings' && <div className="view scroll-host"><SettingsView /></div>}
        {activeId === 'welcome' && <div className="view scroll-host"><Welcome /></div>}
        {showEmpty && (
          <div className="view scroll-host">
            {root ? (
              <EmptyState icon="file" title="Нет открытых файлов" hint="Выберите файл в проводнике слева или нажмите Ctrl+P, чтобы найти файл по имени.">
                <button className="btn" onClick={() => useUi.getState().showSide('files')}>Показать файлы</button>
              </EmptyState>
            ) : <Welcome />}
          </div>
        )}
      </div>
    </div>
  )
}

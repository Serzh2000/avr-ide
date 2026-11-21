// Область редактора: вкладки и их содержимое (код, конструкторы, справочник, настройки, приветствие).
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Editor from '../Editor'
import type { EditorPlatform } from '../editor/types'
import { ALL_PLATFORMS } from '../reference/types'
import { useBuild } from '../build/useBuild'
import ReferencePanel from '../reference/ReferencePanel'
import UiBuilder from '../uibuilder/UiBuilder'
import WebDesigner from '../webdesign/WebDesigner'
import { openReference } from './commands'
import { FileIcon, Icon } from './icons'
import type { IconName } from './icons'
import { ContextMenu, EmptyState, Button } from './kit'
import type { MenuItem } from './kit'
import { useUiHost } from './host'
import { markersFor, samePath } from './problems'
import { baseName } from './problems'
import { isDirty, useProject } from './project'
import type { Tab } from './project'
import NotEspStub, { needsEsp } from './NotEspStub'
import SettingsView from './SettingsView'
import ExampleView, { useExamplePick } from './ExampleView'
import { useUi } from './ui'
import { useProStore } from '../pro/proStore'
import { useHw } from '../pro/hwStore'
import PinsView from '../pro/pins/PinsView'
import type { EditorDebug } from '../editor/types'
import { applyEdits, openLocation, useExternal } from '../editor/pro/openLocation'

const TITLES: Record<string, { title: string; icon: IconName }> = {
  ref: { title: 'Справочник', icon: 'book' },
  ui: { title: 'Конструктор ESPUI', icon: 'layout' },
  web: { title: 'Веб-дизайнер', icon: 'web' },
  settings: { title: 'Настройки', icon: 'gear' },
  example: { title: 'Пример', icon: 'code' },
  pins: { title: 'Пины и тактирование', icon: 'board' }
}

/** Платформа для подсказок: только та, что знает справочник; для остальных (STM32, RP2040, прочие) — определение по тексту скетча. */
const editorPlatform = (p: string | null): EditorPlatform | null => ((ALL_PLATFORMS as string[]).includes(p ?? '') ? (p as EditorPlatform) : null)

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
  const exSel = useExamplePick((s) => s.sel)
  // Страница настроек читается целиком: нижнюю панель убираем (вернуть — Ctrl+`)
  const hadBottom = useRef<boolean | null>(null)
  useEffect(() => {
    if (activeId === 'settings') {
      if (hadBottom.current === null) hadBottom.current = useUi.getState().bottomVisible
      useUi.setState({ bottomVisible: false })
    } else if (hadBottom.current !== null) {
      // ушли с настроек — вернуть нижнюю панель, как было (если её не открыли вручную)
      if (hadBottom.current && !useUi.getState().bottomVisible) useUi.setState({ bottomVisible: true })
      hadBottom.current = null
    }
  }, [activeId])
  // Если вкладки не помещаются — стрелки прокрутки и меню со списком всех вкладок вместо полосы прокрутки
  const scroller = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const upd = (): void => setMore(el.scrollWidth > el.clientWidth + 1)
    upd()
    const ro = new ResizeObserver(upd)
    ro.observe(el)
    return () => ro.disconnect()
  }, [tabs.length])

  useEffect(() => {
    // Активная вкладка всегда видна (в узком окне полоса прокручивается к ней сама)
    const el = scroller.current
    const t = el?.querySelector<HTMLElement>('.tab.active')
    if (!el || !t) return
    const l = t.offsetLeft, r = l + t.offsetWidth
    if (l < el.scrollLeft) el.scrollTo({ left: Math.max(0, l - 8) })
    else if (r > el.scrollLeft + el.clientWidth) el.scrollTo({ left: r - el.clientWidth + 8 })
  }, [activeId, tabs.length, more])

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
      <div className="tabs-scroll" role="tablist" ref={scroller}>
        {tabs.map((t) => {
          const meta = TITLES[t.kind]
          const name = t.path ? baseName(t.path) : t.kind === 'example' && exSel ? 'Пример: ' + exSel.name : meta.title
          const dirty = t.path ? isDirty(docs[t.path]) : false
          return (
            <div key={t.id} role="tab" data-testid="tab" data-tab={t.id} aria-selected={t.id === activeId} tabIndex={t.id === activeId ? 0 : -1} className={'tab' + (t.id === activeId ? ' active' : '')} title={t.path ?? meta.title}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return
                const i = tabs.findIndex((x) => x.id === t.id)
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault()
                  const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
                  activate(n.id)
                  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-tab="${n.id}"]`)?.focus())
                } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(t.id) }
                else if (e.key === 'Delete') { e.preventDefault(); void closeTab(t.id) }
              }}
              onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); void closeTab(t.id) } else if (e.button === 0) activate(t.id) }}
              onContextMenu={(e) => ctx(e, t)}
              onDoubleClick={() => { if (t.kind === 'ui' || t.kind === 'web' || t.kind === 'ref') useUi.getState().setFullscreen(!useUi.getState().fullscreen) }}>
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
        {more && (
          <>
            <button className="icon-btn" title="Прокрутить вкладки влево" aria-label="Прокрутить вкладки влево" onClick={() => scroller.current?.scrollBy({ left: -180, behavior: 'smooth' })}><Icon name="chevR" size={15} style={{ transform: 'rotate(180deg)' }} /></button>
            <button className="icon-btn" title="Прокрутить вкладки вправо" aria-label="Прокрутить вкладки вправо" onClick={() => scroller.current?.scrollBy({ left: 180, behavior: 'smooth' })}><Icon name="chevR" size={15} /></button>
            <button className="icon-btn" title="Список всех вкладок" aria-label="Список всех вкладок" data-testid="tabs-list" onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setMenu({ x: Math.max(8, r.right - 220), y: r.bottom + 4, items: tabs.map((t) => ({ label: (t.path ? baseName(t.path) : TITLES[t.kind].title) + (t.id === activeId ? '  ✓' : ''), onClick: () => activate(t.id) })) })
            }}><Icon name="chevD" size={15} /></button>
          </>
        )}
        {anyDirty && <button className="icon-btn" title="Сохранить всё (Ctrl+Shift+S)" onClick={() => void saveAll()}><Icon name="save" size={15} /></button>}
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  )
}

const BLINK = `// Мигание светодиодом: LED_BUILTIN — встроенный светодиод платы
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
`

/** Скетч — только пустой шаблон setup()/loop() (комментарии не считаются). */
const isEmptyTemplate = (code: string): boolean => code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '') === 'voidsetup(){}voidloop(){}'

/** Подсказка над пустым скетчем: что делать дальше новичку. */
function StarterBanner({ path, onInsert, onClose }: { path: string; onInsert: () => void; onClose: () => void }): ReactNode {
  return (
    <div className="starter" data-testid="starter" role="note" data-path={path}>
      <Icon name="info" size={15} />
      <span className="grow">Скетч пуст. Начать с примера «Мигание»?</span>
      <Button size="sm" variant="primary" data-testid="starter-blink" onClick={onInsert}>Вставить «Мигание»</Button>
      <Button size="sm" onClick={() => useUi.getState().showSide('examples')}>Все примеры</Button>
      <button className="icon-btn" aria-label="Скрыть подсказку" title="Скрыть подсказку" onClick={onClose}><Icon name="x" size={14} /></button>
    </div>
  )
}

export default function EditorArea(): ReactNode {
  const tabs = useProject((s) => s.tabs)
  const activeId = useProject((s) => s.activeId)
  const docs = useProject((s) => s.docs)
  const root = useProject((s) => s.root)
  const mainFile = useProject((s) => s.mainFile)
  const reveal = useProject((s) => s.reveal)
  const setContent = useProject((s) => s.setContent)
  const saveFile = useProject((s) => s.saveFile)
  const problems = useBuild((s) => s.problems)
  const { settings, setCursor, fqbn } = useUi()
  const host = useUiHost()
  const [everFile, setEverFile] = useState(false)
  const [starterOff, setStarterOff] = useState(false)

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
  const proMode = useProStore((s) => s.proMode)
  const externalPaths = useExternal((s) => s.paths)
  const bps = useHw((s) => s.bps)
  const stopFile = useHw((s) => s.debug.stopFile)
  const stopLine = useHw((s) => s.debug.stopLine)
  const debugProp = useMemo<EditorDebug | null>(() => {
    if (!proMode || !filePath || !/\.(c|h|cpp|hpp|cc|s)$/i.test(filePath)) return null
    return {
      breakpoints: bps.filter((b) => samePath(b.file, filePath)).map((b) => ({ line: b.line, verified: b.verified !== false })),
      line: stopFile && stopLine && samePath(stopFile, filePath) ? stopLine : null,
      onToggleBreakpoint: (line) => void useHw.getState().toggleBreakpoint(filePath, line)
    }
  }, [proMode, filePath, bps, stopFile, stopLine])
  const platform: EditorPlatform | null = proMode ? 'stm32' : fqbn.includes(':esp32s3') ? 'esp32s3' : fqbn.includes(':esp32c3') ? 'esp32c3' : editorPlatform(host.platform)

  // Тексты других файлов скетча (для подсказок по #include) и главного файла (для справочника)
  const srcKey = Object.entries(docs)
    .filter(([p]) => /\.(ino|h|hpp|c|cpp)$/i.test(p) && !(filePath && samePath(p, filePath)))
    .map(([, d]) => d.content)
  const srcSig = JSON.stringify(srcKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sketchSources = useMemo(() => srcKey, [srcSig])
  const sketchCode = mainFile ? docs[mainFile]?.content ?? '' : ''

  const has = (k: string): boolean => tabs.some((t) => t.id === k)
  const showEmpty = !active

  return (
    <div className="editor-area">
      <TabBar />
      {!starterOff && filePath && mainFile && samePath(filePath, mainFile) && doc && isEmptyTemplate(doc.content) && (
        <StarterBanner path={filePath} onInsert={() => setContent(filePath, BLINK)} onClose={() => setStarterOff(true)} />
      )}
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
              pro={useProStore.getState().proMode}
              minimap={settings.minimap}
              sketchSources={sketchSources}
              fqbn={fqbn}
              sketchDir={root}
              debug={debugProp}
              onOpenLocation={openLocation}
              onApplyEdits={applyEdits}
              readOnly={!!(filePath && externalPaths[filePath])}
            />
          </div>
        )}
        {has('ref') && <div className="view scroll-host" hidden={activeId !== 'ref'}><ReferencePanel initialQuery={refQuery} platform={platform ?? undefined} sketchCode={sketchCode} /></div>}
        {has('ui') && <div className="view" hidden={activeId !== 'ui'}>{needsEsp(host.platform) ? <NotEspStub tool="Конструктор ESPUI" platform={host.platform} /> : <UiBuilder host={host} />}</div>}
        {has('web') && <div className="view" hidden={activeId !== 'web'}>{needsEsp(host.platform) ? <NotEspStub tool="Веб-дизайнер" platform={host.platform} /> : <WebDesigner host={host} />}</div>}
        {has('example') && <div className="view" hidden={activeId !== 'example'}><ExampleView /></div>}
        {has('pins') && <div className="view" hidden={activeId !== 'pins'}><PinsView /></div>}
        {activeId === 'settings' && <div className="view scroll-host"><SettingsView /></div>}
        {showEmpty && (
          <div className="view scroll-host">
            <EmptyState icon="file" title="Нет открытых файлов" hint={useProStore.getState().proMode ? 'Выберите файл в проводнике слева — например, src/main.c.' : 'Выберите файл в проводнике слева — например, главный файл проекта с расширением .ino.'}>
              <Button onClick={() => useUi.getState().showSide('files')}>Показать файлы</Button>
            </EmptyState>
          </div>
        )}
      </div>
    </div>
  )
}

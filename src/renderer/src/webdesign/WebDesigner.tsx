import type { UiBuilderHost } from '../contracts'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import './webdesigner.css'
import { TEMPLATES, TEMPLATE_CATEGORIES, allBlocks, findBlock, generateCpp, generateSite, resolveWdProject, serializeProject, validate } from './core/index'
import { Splitter, Select } from '../shell/kit'
import { parseSketch } from '../uibuilder/sketch/parse'
import { PAGE_SPECS } from '../uibuilder/sketch/integrate'
import { PageInsertDialog } from '../shell/PageInsertDialog'
import { PageLinkChip } from '../shell/PageLinkChip'
import { guardWebHeader } from '../shell/pageGen'
import { usePageLink } from '../shell/pageLink'
import { LeftPanel } from './Left'
import { Preview } from './Preview'
import { Inspector } from './Inspector'
import { CodePanel, ExportMenu, MoreMenu, IssuesPanel, JsonPanel, PagePanel, ThemePanel, VariablesPanel, buildFiles } from './Bottom'
import { WdSketch } from './sketchCtx'
import type { WdSketchCtx } from './sketchCtx'
import { useWebDesigner } from './store'
import type { BottomTab } from './store'
import PublishDialog from './PublishDialog'
import { staticFirmwareFor } from './core/standalone'

const TABS: Array<{ id: BottomTab; title: string }> = [
  { id: 'vars', title: 'Переменные' },
  { id: 'theme', title: 'Тема' },
  { id: 'page', title: 'Страница и WiFi' },
  { id: 'html', title: 'HTML' },
  { id: 'css', title: 'CSS' },
  { id: 'js', title: 'JS' },
  { id: 'cpp', title: 'C++ обвязка' },
  { id: 'issues', title: 'Проблемы' },
  { id: 'json', title: 'project.json' }
]

/** Визуальный конструктор HTML, CSS и JS. Для ESP также генерирует WebSocket-обвязку. */
export default function WebDesigner({ host, fqbn }: { host?: UiBuilderHost; fqbn?: string } = {}): ReactNode {
  const project = useWebDesigner((s) => s.project)
  const bottom = useWebDesigner((s) => s.bottom)
  const drawerOpen = useWebDesigner((s) => s.drawerOpen)
  const drawerHeight = useWebDesigner((s) => s.drawerHeight)
  const { toggleDrawer, setPlatform, loadTemplate, newProject, setDrawerHeight, closeDrawer } = useWebDesigner.getState()
  const root = useRef<HTMLDivElement>(null)
  const inspectorOpen = useWebDesigner((s) => s.inspectorOpen)
  const leftWidth = useWebDesigner((s) => s.leftWidth)
  const rightWidth = useWebDesigner((s) => s.rightWidth)
  const leftCollapsed = useWebDesigner((s) => s.leftCollapsed)
  const { setLeftWidth, setRightWidth } = useWebDesigner.getState()
  const [inserting, setInserting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const standalone = host?.platform !== 'esp32' && host?.platform !== 'esp8266'
  const tabs = standalone
    ? TABS.filter((tab) => tab.id !== 'cpp' && tab.id !== 'vars').map((tab) => tab.id === 'page' ? { ...tab, title: 'Страница' } : tab)
    : TABS

  // Скетч разбирается на лету; «отложенное» значение не мешает набору текста в редакторе.
  const code = useDeferredValue(host?.sketchCode)
  const sketch = useMemo(() => (code === undefined ? null : parseSketch(code)), [code])
  // Платформа берётся из выбранной платы IDE
  useEffect(() => {
    if ((host?.platform === 'esp32' || host?.platform === 'esp8266') && host.platform !== useWebDesigner.getState().project.platform) setPlatform(host.platform)
  }, [host?.platform, setPlatform])

  const out = useMemo(() => {
    if (standalone) {
      const site = generateSite(project, true)
      return { site, issues: validate(project, site, true), cpp: null, liveHeader: '', sketchIssues: [] }
    }
    const r = resolveWdProject(project, sketch)
    const site = generateSite(r.project)
    const issues = [...validate(r.project, site), ...r.issues]
    const cpp = generateCpp(r.project, site)
    const errs = issues.filter((i) => i.severity === 'error').length
    return { site, issues, cpp, liveHeader: guardWebHeader(cpp.header, errs), sketchIssues: r.issues }
  }, [project, sketch, standalone])
  const portable = useMemo(() => publishing ? (standalone ? out.site.bundle : generateSite(project, true).bundle) : '', [out.site.bundle, project, publishing, standalone])
  const files = useMemo(() => buildFiles(project, out.site, out.cpp), [project, out])
  const sketchCtx = useMemo<WdSketchCtx>(() => ({ host: standalone ? undefined : host, sketch: standalone ? null : sketch, issues: out.sketchIssues, standalone }), [host, sketch, out.sketchIssues, standalone])
  const selectedId = useWebDesigner((s) => s.selected)
  const selBlock = selectedId ? findBlock(project, selectedId) : null
  const selName = selBlock ? String((selBlock.props as unknown as Record<string, unknown>).label ?? selBlock.type) : ''
  const blockCount = allBlocks(project).length
  const connected = !!sketch && sketch.includes.some((i) => i.header === PAGE_SPECS.web.header)
  const wdHint = blockCount === 0 ? 'Шаг 1: добавьте блок — вкладка «Блоки» слева'
    : !selBlock ? 'Шаг 2: кликните блок в превью, чтобы настроить его'
    : standalone ? 'Шаг 3: правьте свойства справа, готовое — «Размещение…»'
    : host && !connected ? 'Шаг 3: правьте свойства справа, готовое — «Вставить в скетч»'
    : 'Шаг 3: правьте свойства справа; код страницы обновится сам'
  const errs = out.issues.filter((i) => i.severity === 'error').length
  const warns = out.issues.length - errs

  // «Подключить» из подсказки «Дальше» или командной палитры
  const req = usePageLink((s) => s.insertRequest)
  const seen = useRef(0)
  useEffect(() => {
    if (req && req.kind === 'web' && req.nonce !== seen.current) {
      seen.current = req.nonce
      if (standalone) setPublishing(true)
      else setInserting(true)
    }
  }, [req, standalone])

  const pickTemplate = (id: string): void => {
    if (id && window.confirm('Заменить текущий проект шаблоном? Несохранённые изменения будут потеряны (экспортируйте project.json).')) loadTemplate(id)
  }
  const askNew = (): void => {
    if (window.confirm('Начать новый пустой проект?')) newProject()
  }
  const startResize = (e: React.PointerEvent): void => {
    e.preventDefault()
    const y0 = e.clientY
    const h0 = drawerHeight
    const max = (root.current?.clientHeight ?? 800) - 80
    const move = (ev: PointerEvent): void => setDrawerHeight(Math.min(max, h0 + (y0 - ev.clientY)))
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  /** «Обновить» в плашке: переписать web_generated.h и web_design.json, скетч не трогаем. */
  const refreshFiles = async (): Promise<void> => {
    if (!host) return
    const p = await host.writeFile(PAGE_SPECS.web.header, out.liveHeader)
    if (p) {
      const json = serializeProject(project)
      await host.writeFile(PAGE_SPECS.web.json, json)
      usePageLink.getState().patch('web', { header: out.liveHeader, json })
    }
  }

  return (
    <WdSketch.Provider value={sketchCtx}>
    <div className="wd" data-testid="wd" ref={root}>
      <div className="wd-toolbar">
        <strong>Веб-конструктор</strong>
        <div className="wd-tb-full">
          {!standalone && <label className="wd-inline">
            Плата
            <Select className="wd-input" value={project.platform} onChange={(e) => setPlatform(e.target.value as 'esp8266' | 'esp32')}>
              <option value="esp32">ESP32 / S3 / C3</option>
              <option value="esp8266">ESP8266</option>
            </Select>
          </label>}
          <label className="wd-inline">
            Шаблон
            <Select className="wd-input" value="" onChange={(e) => pickTemplate(e.target.value)}>
              <option value="">— загрузить —</option>
              {TEMPLATE_CATEGORIES.map((c) => (
                <optgroup key={c.id} label={c.title}>
                  {TEMPLATES.filter((t) => t.category === c.id).map((t) => (
                    <option key={t.id} value={t.id} title={`${t.description} · ${t.tags.join(', ')}`}>{t.title}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </label>
          <button className="wd-btn small" onClick={askNew}>Новый</button>
          <ExportMenu files={files} onPublish={standalone ? undefined : () => setPublishing(true)} />
        </div>
        <div className="wd-spacer" />
        <span className="wd-dim wd-tb-size" title="Размер страницы (HTML, CSS и JS)">
          {(new TextEncoder().encode(out.site.bundle).length / 1024).toFixed(1)} КБ
        </span>
        <button className={`wd-status${errs ? ' err' : warns ? ' warn' : ' ok'}`} onClick={() => toggleDrawer('issues')}>
          <span className="wd-st-full">
            {errs ? `Ошибок: ${errs}` : warns ? 'Есть предупреждения' : 'Всё в порядке'}
            {errs && warns ? `, предупреждений: ${warns}` : warns ? `: ${warns}` : ''}
          </span>
          <span className="wd-st-short">{errs ? `✖ ${errs}` : warns ? `⚠ ${warns}` : '✔'}</span>
        </button>
        {standalone ? (
          <button className="wd-btn small primary" data-testid="wd-publish" onClick={() => setPublishing(true)}>Размещение…</button>
        ) : <button className="wd-btn small primary" data-testid="wd-insert" onClick={() => setInserting(true)} title={`Записать ${PAGE_SPECS.web.header} и подключить его в скетч`}>
          Вставить в скетч
        </button>}
        <MoreMenu files={files} platform={project.platform} setPlatform={setPlatform} pickTemplate={pickTemplate} askNew={askNew} standalone={standalone} onPublish={standalone ? undefined : () => setPublishing(true)} />
      </div>
      <div className="ctx-strip" data-testid="wd-context">
        <span className="ctx-crumb">Сайт</span>
        <span className="ctx-crumb">{standalone ? 'Автономная страница' : project.platform === 'esp32' ? 'ESP32' : 'ESP8266'}</span>
        {selBlock && <span className="ctx-crumb cur">{selName}</span>}
        {host && !standalone && (
          <PageLinkChip kind="web" testid="wd-link" connected={connected} liveHeader={out.liveHeader}
            onConnect={() => setInserting(true)} onUpdate={() => void refreshFiles()} />
        )}
        <span className="ctx-hint" data-testid="wd-next-hint">{wdHint}</span>
      </div>
      <div className={`wd-main${inspectorOpen ? ' insp-open' : ''}`} style={{ '--wd-left': `${leftCollapsed ? 40 : leftWidth}px`, '--wd-right': `${rightWidth}px` } as React.CSSProperties}>
        <LeftPanel issues={out.issues} count={allBlocks(project).length} />
        {!leftCollapsed && (
          <div className="wd-split wd-split-l">
            <Splitter axis="x" onDelta={(d) => setLeftWidth(useWebDesigner.getState().leftWidth + d)} />
          </div>
        )}
        <Preview standalone={standalone} />
        <div className="wd-split wd-split-r">
          <Splitter axis="x" onDelta={(d) => setRightWidth(useWebDesigner.getState().rightWidth - d)} />
        </div>
        <Inspector issues={out.issues} />
      </div>
      {drawerOpen && tabs.some((tab) => tab.id === bottom) && (
        <div className="wd-drawer" style={{ height: drawerHeight }}>
          <div className="wd-resize" onPointerDown={startResize} role="separator" aria-orientation="horizontal" title="Потяните, чтобы изменить высоту" />
          <div className="wd-drawer-head">
            <strong>{tabs.find((t) => t.id === bottom)?.title}</strong>
            <div className="wd-spacer" />
            <button className="wd-btn small" onClick={closeDrawer} title="Свернуть панель">Свернуть ▾</button>
          </div>
          <div className="wd-bottom-body">
            {bottom === 'vars' && <VariablesPanel />}
            {bottom === 'theme' && <ThemePanel />}
            {bottom === 'page' && <PagePanel hardware={!standalone} />}
            {(bottom === 'html' || bottom === 'css' || bottom === 'js' || bottom === 'cpp') && (
              <CodePanel kind={bottom} site={out.site} cpp={out.cpp} issues={out.issues} />
            )}
            {bottom === 'issues' && <IssuesPanel issues={out.issues} />}
            {bottom === 'json' && <JsonPanel project={project} />}
          </div>
        </div>
      )}
      <div className="wd-tabs wd-dock" role="tablist">
        {tabs.map((t) => (
          <div
            key={t.id}
            role="tab"
            tabIndex={0}
            aria-selected={drawerOpen && bottom === t.id}
            className={`wd-tab${drawerOpen && bottom === t.id ? ' active' : ''}`}
            onClick={() => toggleDrawer(t.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleDrawer(t.id)}
          >
            {t.title}
            {t.id === 'issues' && out.issues.length > 0 ? ` (${out.issues.length})` : ''}
          </div>
        ))}
      </div>
      {publishing && <PublishDialog bundle={portable} defaultTarget={staticFirmwareFor(fqbn)} onClose={() => setPublishing(false)} />}
      {inserting && !standalone && (
        <PageInsertDialog
          kind="web"
          host={host}
          header={out.liveHeader}
          json={serializeProject(project)}
          errorCount={errs}
          errorsSlot={out.issues.filter((i) => i.severity === 'error').slice(0, 4).map((i, n) => (
            <button key={n} className="wd-issue error clickable" style={{ textAlign: 'left', width: '100%' }} onClick={() => i.blockId && useWebDesigner.getState().select(i.blockId)}>✖ {i.message}</button>
          ))}
          ids={{ dialog: 'wd-insert-dialog', confirm: 'wd-insert-confirm', result: 'wd-insert-result', replace: 'wd-insert-replace' }}
          extraLibs={`Нужны библиотеки: ESPAsyncWebServer и ${project.platform === 'esp8266' ? 'ESPAsyncTCP' : 'AsyncTCP'}.`}
          onClose={() => setInserting(false)}
        />
      )}
    </div>
    </WdSketch.Provider>
  )
}

import type { UiBuilderHost } from '../contracts'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import './webdesigner.css'
import { allBlocks, findBlock, generateCpp, generateSite, resolveWdProject, serializeProject, validate } from './core/index'
import { Splitter, Select } from '../shell/kit'
import { parseSketch } from '../uibuilder/sketch/parse'
import { PAGE_SPECS } from '../uibuilder/sketch/integrate'
import { PageInsertDialog } from '../shell/PageInsertDialog'
import { PageLinkChip } from '../shell/PageLinkChip'
import { guardWebHeader } from '../shell/pageGen'
import { savePageJson, usePageLink } from '../shell/pageLink'
import { LeftPanel } from './Left'
import { Preview, PreviewMode } from './Preview'
import { Inspector } from './Inspector'
import { CodePanel, ExportMenu, MoreMenu, IssuesPanel, JsonPanel, PagePanel, ThemePanel, VariablesPanel, buildFiles } from './Bottom'
import { WdSketch } from './sketchCtx'
import type { WdSketchCtx } from './sketchCtx'
import { useWebDesigner } from './store'
import type { DesignerView } from './store'
import PublishDialog from './PublishDialog'
import { staticFirmwareFor } from './core/standalone'
import { webPlatformFor, WEB_TARGET_NAMES, WEB_TCP_LIBRARIES } from './core/targets'

const VIEWS: Array<{ id: DesignerView; title: string }> = [
  { id: 'design', title: 'Предпросмотр' },
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

/** Визуальный конструктор HTML, CSS и JS. Для совместимых плат генерирует WebSocket-обвязку. */
export default function WebDesigner({ host, fqbn }: { host?: UiBuilderHost; fqbn?: string } = {}): ReactNode {
  const project = useWebDesigner((s) => s.project)
  const loading = usePageLink((s) => s.loading) && !!host?.sketchDir
  const requested = useWebDesigner((s) => s.view)
  const root = useRef<HTMLDivElement>(null)
  const { setView, setPlatform, loadTemplate, newProject } = useWebDesigner.getState()
  const inspectorOpen = useWebDesigner((s) => s.inspectorOpen)
  const leftWidth = useWebDesigner((s) => s.leftWidth)
  const rightWidth = useWebDesigner((s) => s.rightWidth)
  const leftCollapsed = useWebDesigner((s) => s.leftCollapsed)
  const { setLeftWidth, setRightWidth } = useWebDesigner.getState()
  const [inserting, setInserting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const boardPlatform = host ? webPlatformFor(fqbn) : null
  const standalone = boardPlatform === null
  const views = standalone
    ? VIEWS.filter((tab) => tab.id !== 'cpp' && tab.id !== 'vars').map((tab) => tab.id === 'page' ? { ...tab, title: 'Страница' } : tab)
    : VIEWS
  const view = views.some((item) => item.id === requested) ? requested : 'design'

  // Скетч разбирается на лету; «отложенное» значение не мешает набору текста в редакторе.
  const code = useDeferredValue(host?.sketchCode)
  const sketch = useMemo(() => (code === undefined ? null : parseSketch(code)), [code])
  // Платформа берётся из выбранной платы IDE
  useEffect(() => {
    if (!loading && boardPlatform && boardPlatform !== project.platform) setPlatform(boardPlatform)
  }, [boardPlatform, loading, project.platform, setPlatform])

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
    : host && !connected ? 'Шаг 3: правьте свойства справа, готовое — «Подключить к скетчу»'
    : 'Шаг 3: правьте свойства справа; код страницы обновится сам'
  const errs = out.issues.filter((i) => i.severity === 'error').length
  const warns = out.issues.length - errs

  // «Подключить» из подсказки «Дальше» или командной палитры
  const req = usePageLink((s) => s.insertRequest)
  const seen = useRef(0)
  useEffect(() => {
    if (!loading && req && req.kind === 'web' && req.nonce !== seen.current) {
      seen.current = req.nonce
      if (standalone) setPublishing(true)
      else setInserting(true)
    }
  }, [req, standalone, loading])

  const pickTemplate = (id: string): void => {
    if (id && window.confirm('Заменить текущий проект шаблоном? Несохранённые изменения будут потеряны (экспортируйте project.json).')) loadTemplate(id)
  }
  const askNew = (): void => {
    if (window.confirm('Начать новый пустой проект?')) newProject()
  }
  /** «Обновить» в плашке: переписать web_generated.h и web_design.json, скетч не трогаем. */
  const refreshFiles = async (): Promise<void> => {
    if (!host || !await savePageJson(host.sketchDir, 'web', serializeProject(project))) return
    const p = await host.writeFile(PAGE_SPECS.web.header, out.liveHeader)
    if (p && usePageLink.getState().root === host.sketchDir) usePageLink.getState().patch('web', { header: out.liveHeader })
  }

  if (loading) return <div className="wd" aria-busy="true"><p className="wd-pad" role="status">Загружаем страницу проекта…</p></div>

  return (
    <WdSketch.Provider value={sketchCtx}>
    <div className="wd" data-testid="wd" ref={root}>
      <div className="wd-toolbar">
        <Select className="wd-input wd-view" data-testid="wd-view" aria-label="Вид веб-конструктора" value={view}
          onChange={(e) => setView(e.target.value as DesignerView)}>
          {views.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
        </Select>
        <div className="wd-tb-full">
          <ExportMenu files={files} onPublish={standalone ? undefined : () => setPublishing(true)} />
        </div>
        <div className="wd-spacer" />
        <span className="wd-target" data-testid="wd-context" title="Платформа, для которой генерируется страница">{boardPlatform ? WEB_TARGET_NAMES[boardPlatform] : 'Автономная страница'}</span>
        {host && !standalone && (
          <PageLinkChip kind="web" testid="wd-link" connected={connected} liveHeader={out.liveHeader}
            onUpdate={() => void refreshFiles()} />
        )}
        {view === 'design' && <PreviewMode />}
        <button className={`wd-status${errs ? ' err' : warns ? ' warn' : ' ok'}`} onClick={() => setView('issues')}
          title={`${errs ? `Ошибок: ${errs}` : warns ? `Предупреждений: ${warns}` : 'Проблем нет'}. Размер страницы: ${(new TextEncoder().encode(out.site.bundle).length / 1024).toFixed(1)} КБ`}>
          <span className="wd-st-full">
            {errs ? `Ошибок: ${errs}` : warns ? `Замечаний: ${warns}` : 'Всё в порядке'}
            {errs && warns ? `, предупреждений: ${warns}` : ''}
          </span>
          <span className="wd-st-short">{errs ? `✖ ${errs}` : warns ? `⚠ ${warns}` : '✔'}</span>
        </button>
        {standalone ? (
          <button className="wd-btn primary" data-testid="wd-publish" onClick={() => setPublishing(true)}>Размещение…</button>
        ) : <button className="wd-btn primary" data-testid="wd-insert" onClick={() => setInserting(true)}>
          {connected ? 'Обновить в скетче…' : 'Подключить к скетчу'}
        </button>}
        <MoreMenu files={files} platform={boardPlatform} pickTemplate={pickTemplate} askNew={askNew} onPublish={standalone ? undefined : () => setPublishing(true)} />
      </div>
      <div hidden={view !== 'design'} className={`wd-main${inspectorOpen ? ' insp-open' : ''}`} style={{ '--wd-left': `${leftCollapsed ? 40 : leftWidth}px`, '--wd-right': `${rightWidth}px` } as React.CSSProperties}>
        <LeftPanel issues={out.issues} count={allBlocks(project).length} />
        {!leftCollapsed && (
          <div className="wd-split wd-split-l">
            <Splitter axis="x" onDelta={(d) => setLeftWidth(useWebDesigner.getState().leftWidth + d)} />
          </div>
        )}
        <Preview standalone={standalone} hint={view === 'design' && (blockCount === 0 || !selBlock) ? wdHint : undefined} />
        <div className="wd-split wd-split-r">
          <Splitter axis="x" onDelta={(d) => setRightWidth(useWebDesigner.getState().rightWidth - d)} />
        </div>
        <Inspector issues={out.issues} />
      </div>
      {view !== 'design' && (
        <section className="wd-workspace" data-testid="wd-workspace" aria-labelledby="wd-workspace-title">
          <header className="wd-workspace-head">
            <h2 id="wd-workspace-title">{views.find((item) => item.id === view)?.title}</h2>
            <button className="wd-btn small" data-testid="wd-return" onClick={() => { setView('design'); root.current?.querySelector<HTMLSelectElement>('[data-testid=wd-view]')?.focus() }}>К предпросмотру</button>
          </header>
          <div className="wd-workspace-body">
            {view === 'vars' && <VariablesPanel />}
            {view === 'theme' && <ThemePanel />}
            {view === 'page' && <PagePanel hardware={!standalone} />}
            {(view === 'html' || view === 'css' || view === 'js' || view === 'cpp') && (
              <CodePanel kind={view} site={out.site} cpp={out.cpp} issues={out.issues} />
            )}
            {view === 'issues' && <IssuesPanel issues={out.issues} />}
            {view === 'json' && <JsonPanel project={project} />}
          </div>
        </section>
      )}
      {publishing && <PublishDialog bundle={portable} defaultTarget={staticFirmwareFor(fqbn)} canLinkPico={boardPlatform === 'pico-w'} onClose={() => setPublishing(false)} />}
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
          extraLibs={`В менеджере «Библиотеки» установите ESP Async WebServer и ${WEB_TCP_LIBRARIES[project.platform]}.`}
          onClose={() => setInserting(false)}
        />
      )}
    </div>
    </WdSketch.Provider>
  )
}

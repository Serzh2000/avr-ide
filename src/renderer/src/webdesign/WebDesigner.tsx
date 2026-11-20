import type { UiBuilderHost } from '../contracts'
import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import './webdesigner.css'
import { TEMPLATES, TEMPLATE_CATEGORIES, allBlocks, findBlock, generateCpp, generateSite, validate } from './core/index'
import { Splitter, Select } from '../shell/kit'
import { LeftPanel } from './Left'
import { Preview } from './Preview'
import { Inspector } from './Inspector'
import { CodePanel, ExportMenu, MoreMenu, IssuesPanel, JsonPanel, PagePanel, ThemePanel, VariablesPanel, buildFiles } from './Bottom'
import { useWebDesigner } from './store'
import type { BottomTab } from './store'

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

/** Визуальный конструктор веб-страниц для ESP8266 / ESP32 (HTML + CSS + JS + WebSocket-обвязка). */
export default function WebDesigner(_props: { host?: UiBuilderHost } = {}): ReactNode {
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

  const out = useMemo(() => {
    const site = generateSite(project)
    const issues = validate(project, site)
    const cpp = generateCpp(project, site)
    return { site, issues, cpp }
  }, [project])
  const files = useMemo(() => buildFiles(project, out.site, out.cpp), [project, out])
  const selectedId = useWebDesigner((s) => s.selected)
  const selBlock = selectedId ? findBlock(project, selectedId) : null
  const selName = selBlock ? String((selBlock.props as unknown as Record<string, unknown>).label ?? selBlock.type) : ''
  const blockCount = allBlocks(project).length
  const wdHint = blockCount === 0 ? 'Шаг 1: добавьте блок — вкладка «Блоки» слева'
    : !selBlock ? 'Шаг 2: кликните блок в превью, чтобы настроить его'
    : 'Шаг 3: правьте свойства справа, готовое — меню «Экспорт»'
  const errs = out.issues.filter((i) => i.severity === 'error').length
  const warns = out.issues.length - errs

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

  return (
    <div className="wd" ref={root}>
      <div className="wd-toolbar">
        <strong>Веб-конструктор</strong>
        <div className="wd-tb-full">
          <label className="wd-inline">
            Плата
            <Select className="wd-input" value={project.platform} onChange={(e) => setPlatform(e.target.value as 'esp8266' | 'esp32')}>
              <option value="esp32">ESP32 / S3 / C3</option>
              <option value="esp8266">ESP8266</option>
            </Select>
          </label>
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
          <ExportMenu files={files} />
        </div>
        <div className="wd-spacer" />
        <span className="wd-dim wd-tb-size" title="Размер страницы (HTML+CSS+JS), которая лежит во флеше устройства">
          {(new TextEncoder().encode(out.site.bundle).length / 1024).toFixed(1)} КБ
        </span>
        <button className={`wd-status${errs ? ' err' : warns ? ' warn' : ' ok'}`} onClick={() => toggleDrawer('issues')}>
          <span className="wd-st-full">
            {errs ? `Ошибок: ${errs}` : 'Ошибок нет'}
            {warns ? `, предупреждений: ${warns}` : ''}
          </span>
          <span className="wd-st-short">{errs ? `✖ ${errs}` : '✔'}{warns ? ` ⚠ ${warns}` : ''}</span>
        </button>
        <MoreMenu files={files} platform={project.platform} setPlatform={setPlatform} pickTemplate={pickTemplate} askNew={askNew} />
      </div>
      <div className="ctx-strip" data-testid="wd-context">
        <span className="ctx-crumb">Сайт</span>
        <span className="ctx-crumb">{project.platform === 'esp32' ? 'ESP32' : 'ESP8266'}</span>
        {selBlock && <span className="ctx-crumb cur">{selName}</span>}
        <span className="ctx-hint">{wdHint}</span>
      </div>
      <div className={`wd-main${inspectorOpen ? ' insp-open' : ''}`} style={{ '--wd-left': `${leftCollapsed ? 40 : leftWidth}px`, '--wd-right': `${rightWidth}px` } as React.CSSProperties}>
        <LeftPanel issues={out.issues} count={allBlocks(project).length} />
        {!leftCollapsed && (
          <div className="wd-split wd-split-l">
            <Splitter axis="x" onDelta={(d) => setLeftWidth(useWebDesigner.getState().leftWidth + d)} />
          </div>
        )}
        <Preview />
        <div className="wd-split wd-split-r">
          <Splitter axis="x" onDelta={(d) => setRightWidth(useWebDesigner.getState().rightWidth - d)} />
        </div>
        <Inspector issues={out.issues} />
      </div>
      {drawerOpen && (
        <div className="wd-drawer" style={{ height: drawerHeight }}>
          <div className="wd-resize" onPointerDown={startResize} role="separator" aria-orientation="horizontal" title="Потяните, чтобы изменить высоту" />
          <div className="wd-drawer-head">
            <strong>{TABS.find((t) => t.id === bottom)?.title}</strong>
            <div className="wd-spacer" />
            <button className="wd-btn small" onClick={closeDrawer} title="Свернуть панель">Свернуть ▾</button>
          </div>
          <div className="wd-bottom-body">
            {bottom === 'vars' && <VariablesPanel />}
            {bottom === 'theme' && <ThemePanel />}
            {bottom === 'page' && <PagePanel />}
            {(bottom === 'html' || bottom === 'css' || bottom === 'js' || bottom === 'cpp') && (
              <CodePanel kind={bottom} site={out.site} cpp={out.cpp} issues={out.issues} />
            )}
            {bottom === 'issues' && <IssuesPanel issues={out.issues} />}
            {bottom === 'json' && <JsonPanel project={project} />}
          </div>
        </div>
      )}
      <div className="wd-tabs wd-dock" role="tablist">
        {TABS.map((t) => (
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
    </div>
  )
}

import type { UiBuilderHost } from '../contracts'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import './webdesigner.css'
import { TEMPLATES, generateCpp, generateSite, validate } from './core/index'
import { Palette, Tree } from './Left'
import { Preview } from './Preview'
import { Inspector } from './Inspector'
import { CodePanel, ExportBar, IssuesPanel, JsonPanel, PagePanel, ThemePanel, VariablesPanel, buildFiles } from './Bottom'
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
  const { setBottom, setPlatform, loadTemplate, newProject } = useWebDesigner.getState()

  const out = useMemo(() => {
    const site = generateSite(project)
    const issues = validate(project, site)
    const cpp = generateCpp(project, site)
    return { site, issues, cpp }
  }, [project])
  const files = useMemo(() => buildFiles(project, out.site, out.cpp), [project, out])
  const errs = out.issues.filter((i) => i.severity === 'error').length
  const warns = out.issues.length - errs

  return (
    <div className="wd">
      <div className="wd-toolbar">
        <strong>Веб-конструктор</strong>
        <label className="wd-inline">
          Плата
          <select className="wd-input" value={project.platform} onChange={(e) => setPlatform(e.target.value as 'esp8266' | 'esp32')}>
            <option value="esp32">ESP32 / S3 / C3</option>
            <option value="esp8266">ESP8266</option>
          </select>
        </label>
        <label className="wd-inline">
          Шаблон
          <select
            className="wd-input"
            value=""
            onChange={(e) => {
              if (e.target.value && window.confirm('Заменить текущий проект шаблоном? Несохранённые изменения будут потеряны (экспортируйте project.json).')) loadTemplate(e.target.value)
            }}
          >
            <option value="">— загрузить —</option>
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id} title={t.description}>{t.title}</option>
            ))}
          </select>
        </label>
        <button className="wd-btn small" onClick={() => window.confirm('Начать новый пустой проект?') && newProject()}>Новый</button>
        <div className="wd-spacer" />
        <span className="wd-dim" title="Размер страницы (HTML+CSS+JS), которая лежит во флеше устройства">
          {(new TextEncoder().encode(out.site.bundle).length / 1024).toFixed(1)} КБ
        </span>
        <button className={`wd-status${errs ? ' err' : warns ? ' warn' : ' ok'}`} onClick={() => setBottom('issues')}>
          {errs ? `Ошибок: ${errs}` : 'Ошибок нет'}
          {warns ? `, предупреждений: ${warns}` : ''}
        </button>
      </div>
      <div className="wd-main">
        <div className="wd-left">
          <Palette />
          <Tree issues={out.issues} />
        </div>
        <Preview />
        <Inspector issues={out.issues} />
      </div>
      <div className="wd-bottom">
        <div className="wd-tabs">
          {TABS.map((t) => (
            <div key={t.id} className={`wd-tab${bottom === t.id ? ' active' : ''}`} onClick={() => setBottom(t.id)}>
              {t.title}
              {t.id === 'issues' && out.issues.length > 0 ? ` (${out.issues.length})` : ''}
            </div>
          ))}
          <div className="wd-spacer" />
          <ExportBar files={files} />
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
    </div>
  )
}

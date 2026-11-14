import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import './uibuilder.css'
import { Canvas, Palette } from './Canvas'
import { Inspector } from './Inspector'
import { EspuiLivePreview } from './preview/EspuiLivePreview'
import { CodePanel, IssuesPanel, JsonPanel, ProjectPanel, ThemePanel, VariablesPanel } from './BottomPanels'
import { computeOutput, useUiBuilder } from './store'
import type { BottomTab } from './store'

const TABS: Array<{ id: BottomTab; title: string }> = [
  { id: 'variables', title: 'Переменные' },
  { id: 'project', title: 'WiFi и страница' },
  { id: 'theme', title: 'Тема' },
  { id: 'code', title: 'Сгенерированный код' },
  { id: 'issues', title: 'Проблемы' },
  { id: 'json', title: 'ui.json' }
]

/** Визуальный конструктор веб-интерфейса ESPUI (ESP8266 / ESP32). */
export default function UiBuilder(): ReactNode {
  const project = useUiBuilder((s) => s.project)
  const ledcApi = useUiBuilder((s) => s.ledcApi)
  const bottom = useUiBuilder((s) => s.bottom)
  const { setBottom, setPlatform, setLedcApi } = useUiBuilder.getState()
  const [mode, setMode] = useState<'edit' | 'live'>('edit')

  const out = useMemo(() => computeOutput(project, ledcApi), [project, ledcApi])
  const errs = out.issues.filter((i) => i.severity === 'error').length
  const warns = out.issues.length - errs

  return (
    <div className="uib">
      <div className="uib-toolbar">
        <strong>Конструктор ESPUI</strong>
        <label className="uib-inline">
          Плата
          <select className="uib-input" value={project.platform} onChange={(e) => setPlatform(e.target.value as 'esp8266' | 'esp32')}>
            <option value="esp32">ESP32 / S3 / C3</option>
            <option value="esp8266">ESP8266</option>
          </select>
        </label>
        {project.platform === 'esp32' && (
          <label className="uib-inline" title="В ядре Arduino-ESP32 3.x изменился API LEDC (ledcAttach вместо ledcSetup/ledcAttachPin)">
            Ядро ESP32
            <select className="uib-input" value={ledcApi} onChange={(e) => setLedcApi(e.target.value as 'v2' | 'v3')}>
              <option value="v3">3.x (ledcAttach)</option>
              <option value="v2">2.x (ledcSetup)</option>
            </select>
          </label>
        )}
        <div className="uib-modes" role="group" aria-label="Режим холста">
          <button className={`uib-mode${mode === 'edit' ? ' active' : ''}`} onClick={() => setMode('edit')}>
            Редактор
          </button>
          <button className={`uib-mode${mode === 'live' ? ' active' : ''}`} onClick={() => setMode('live')} title="Страница на оригинальном фронтенде ESPUI с симуляцией устройства">
            Живое превью (реальный ESPUI)
          </button>
        </div>
        <div className="uib-spacer" />
        <button className={`uib-status${errs ? ' err' : warns ? ' warn' : ' ok'}`} onClick={() => setBottom('issues')}>
          {errs ? `Ошибок: ${errs}` : 'Ошибок нет'}
          {warns ? `, предупреждений: ${warns}` : ''}
        </button>
      </div>
      <div className="uib-main">
        <Palette />
        {mode === 'edit' ? <Canvas issues={out.issues} /> : <EspuiLivePreview project={project} />}
        <Inspector issues={out.issues} />
      </div>
      <div className="uib-bottom">
        <div className="uib-bottom-tabs">
          {TABS.map((t) => (
            <div key={t.id} className={`uib-tab${bottom === t.id ? ' active' : ''}`} onClick={() => setBottom(t.id)}>
              {t.title}
              {t.id === 'issues' && out.issues.length > 0 ? ` (${out.issues.length})` : ''}
            </div>
          ))}
        </div>
        <div className="uib-bottom-body">
          {bottom === 'variables' && <VariablesPanel />}
          {bottom === 'project' && <ProjectPanel />}
          {bottom === 'theme' && <ThemePanel />}
          {bottom === 'code' && <CodePanel code={out.code} issues={out.issues} />}
          {bottom === 'issues' && <IssuesPanel issues={out.issues} />}
          {bottom === 'json' && <JsonPanel project={project} />}
        </div>
      </div>
    </div>
  )
}

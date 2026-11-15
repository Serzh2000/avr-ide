import type { UiBuilderHost } from '../contracts'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import './uibuilder.css'
import { computeOutput, useUiBuilder } from './store'
import { parseSketch } from './sketch/parse'
import { resolveProject } from './sketch/resolve'
import { BuilderContext, isEditableTarget } from './ui/ctx'
import type { BuilderCtx } from './ui/ctx'
import { Palette } from './ui/Palette'
import { CanvasView } from './ui/CanvasView'
import { Inspector } from './ui/Inspector'
import { BottomPanel } from './ui/Panels'
import { InsertDialog } from './ui/InsertDialog'
import { Icon } from './ui/icons'

/** Визуальный конструктор веб-интерфейса ESPUI (ESP8266 / ESP32). Переменные и пины подхватываются из скетча (host.sketchCode). */
export default function UiBuilder({ host }: { host?: UiBuilderHost } = {}): ReactNode {
  const project = useUiBuilder((s) => s.project)
  const ledcApi = useUiBuilder((s) => s.ledcApi)
  const mode = useUiBuilder((s) => s.mode)
  const palCollapsed = useUiBuilder((s) => s.paletteCollapsed)
  const canUndo = useUiBuilder((s) => s.past.length > 0)
  const canRedo = useUiBuilder((s) => s.future.length > 0)
  const st = useUiBuilder.getState
  const [inserting, setInserting] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // Скетч разбирается на лету; «отложенное» значение не мешает набору текста в редакторе.
  const code = useDeferredValue(host?.sketchCode)
  const sketch = useMemo(() => (code === undefined ? null : parseSketch(code)), [code])

  // Платформа берётся из выбранной платы IDE
  useEffect(() => {
    if ((host?.platform === 'esp32' || host?.platform === 'esp8266') && host.platform !== useUiBuilder.getState().project.platform) useUiBuilder.getState().setPlatform(host.platform)
  }, [host?.platform])

  const ctx = useMemo<BuilderCtx>(() => {
    const r = resolveProject(project, sketch)
    const out = computeOutput(r.project, ledcApi)
    return { host, sketch, effective: r.project, ledcApi, issues: [...out.issues, ...r.issues], code: out.code, regions: out.regions }
  }, [project, sketch, ledcApi, host])

  const errs = ctx.issues.filter((i) => i.severity === 'error').length
  const warns = ctx.issues.length - errs

  const onKeyDown = (e: KeyboardEvent): void => {
    if (isEditableTarget(e.target)) return
    const s = st()
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (mod && k === 'z' && !e.shiftKey) {
      e.preventDefault()
      s.undo()
    } else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) {
      e.preventDefault()
      s.redo()
    } else if (s.mode === 'edit' && s.selected) {
      const tab = s.project.tabs.find((t) => t.elements.some((x) => x.id === s.selected))
      const idx = tab ? tab.elements.findIndex((x) => x.id === s.selected) : -1
      if (mod && k === 'd') {
        e.preventDefault()
        s.duplicateElement(s.selected)
      } else if (e.key === 'Delete') {
        e.preventDefault()
        s.removeElement(s.selected)
      } else if (e.key === 'F2') {
        e.preventDefault()
        s.requestFocus('label')
      } else if (e.key === 'Escape') s.select(null)
      else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) {
        e.preventDefault()
        s.moveElementBy(s.selected, -1)
      } else if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) {
        e.preventDefault()
        s.moveElementBy(s.selected, 1)
      } else if (!e.altKey && tab && idx >= 0 && e.key.startsWith('Arrow')) {
        e.preventDefault()
        const next = tab.elements[idx + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1)]
        if (next) s.select(next.id)
      }
    }
  }

  if (host?.platform === 'avr')
    return (
      <div className="uib uib-avr">
        <div className="uib-avr-msg">
          <Icon name="warn" size={28} />
          <h2>Для этой платы конструктор недоступен</h2>
          <p>Веб-интерфейс ESPUI нужен WiFi, а у AVR-плат (Uno, Nano, Mega) его нет. Выберите плату ESP32 или ESP8266 в верхней панели.</p>
        </div>
      </div>
    )

  return (
    <BuilderContext.Provider value={ctx}>
      <div className="uib" ref={root} tabIndex={-1} onKeyDown={onKeyDown}>
        <div className="uib-toolbar">
          <div className="uib-undo" role="group" aria-label="История">
            <button className="uib-icon-btn" onClick={() => st().undo()} disabled={!canUndo} title="Отменить (Ctrl+Z)" aria-label="Отменить">
              <Icon name="undo" size={16} />
            </button>
            <button className="uib-icon-btn" onClick={() => st().redo()} disabled={!canRedo} title="Повторить (Ctrl+Y)" aria-label="Повторить">
              <Icon name="redo" size={16} />
            </button>
          </div>
          <div className="uib-modes" role="group" aria-label="Режим холста">
            <button className={`uib-mode${mode === 'edit' ? ' active' : ''}`} onClick={() => st().setMode('edit')} aria-pressed={mode === 'edit'}>
              <Icon name="edit" size={14} /> Редактировать
            </button>
            <button className={`uib-mode${mode === 'test' ? ' active' : ''}`} onClick={() => st().setMode('test')} aria-pressed={mode === 'test'} title="Страница работает как на устройстве: кнопки, ползунки, графики. «Устройство» — симуляция.">
              <Icon name="play" size={14} /> Тест
            </button>
          </div>
          {!host && (
            <label className="uib-inline">
              Плата
              <select className="uib-select compact" value={project.platform} onChange={(e) => st().setPlatform(e.target.value as 'esp8266' | 'esp32')}>
                <option value="esp32">ESP32 / S3 / C3</option>
                <option value="esp8266">ESP8266</option>
              </select>
            </label>
          )}
          {project.platform === 'esp32' && (
            <label className="uib-inline" title="В ядре Arduino-ESP32 3.x изменился API ШИМ (ledcAttach вместо ledcSetup/ledcAttachPin). Влияет только на пины с ШИМ.">
              Ядро ESP32
              <select className="uib-select compact" value={ledcApi} onChange={(e) => st().setLedcApi(e.target.value as 'v2' | 'v3')}>
                <option value="v3">3.x</option>
                <option value="v2">2.x</option>
              </select>
            </label>
          )}
          <div className="uib-spacer" />
          <button className={`uib-status ${errs ? 'err' : warns ? 'warn' : 'ok'}`} onClick={() => st().setBottom('issues')} title="Открыть список проблем">
            <Icon name={errs ? 'error' : warns ? 'warn' : 'ok'} size={14} />
            {errs ? `Ошибок: ${errs}` : warns ? `Предупреждений: ${warns}` : 'Всё в порядке'}
          </button>
          <button className="uib-btn primary" onClick={() => setInserting(true)} title="Записать ui_generated.h и подключить его в скетч">
            <Icon name="insert" size={15} /> <span className="lbl">Вставить в скетч</span>
          </button>
        </div>
        <div className={`uib-main${palCollapsed ? ' pal-collapsed' : ''}`}>
          <Palette />
          <CanvasView />
          <Inspector />
        </div>
        <BottomPanel onInsert={() => setInserting(true)} />
        {inserting && <InsertDialog onClose={() => setInserting(false)} />}
      </div>
    </BuilderContext.Provider>
  )
}

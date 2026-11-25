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
import { BUILDER_VIEWS, BuilderWorkspace } from './ui/Panels'
import type { BuilderView } from './store'
import { InsertDialog } from './ui/InsertDialog'
import { Icon } from './ui/icons'
import { bindInfo, canBind } from './ui/bindinfo'
import { Splitter, usePersistedSize, usePopoverClose, Select } from '../shell/kit'
import { PageLinkChip } from '../shell/PageLinkChip'
import { savePageJson, usePageLink } from '../shell/pageLink'
import { PAGE_SPECS } from './sketch/integrate'
import { serializeUiPage } from '../shell/pageGen'

/** Визуальный конструктор веб-интерфейса ESPUI (ESP8266 / ESP32). Переменные и пины подхватываются из скетча (host.sketchCode). */
export default function UiBuilder({ host }: { host?: UiBuilderHost } = {}): ReactNode {
  const project = useUiBuilder((s) => s.project)
  const loading = usePageLink((s) => s.loading) && !!host?.sketchDir
  const view = useUiBuilder((s) => s.view)
  const ledcApi = useUiBuilder((s) => s.ledcApi)
  const mode = useUiBuilder((s) => s.mode)
  const palCollapsed = useUiBuilder((s) => s.paletteCollapsed)
  const canUndo = useUiBuilder((s) => s.past.length > 0)
  const canRedo = useUiBuilder((s) => s.future.length > 0)
  const st = useUiBuilder.getState
  const [inserting, setInserting] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const selected = useUiBuilder((s) => s.selected)
  // Ширина самого конструктора (а не окна): боковые панели оболочки тоже отнимают место.
  const [w, setW] = useState(1200)
  const [inspOpen, setInspOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const more = useRef<HTMLDivElement>(null)
  usePopoverClose(menu, () => setMenu(false), more)
  const left = usePersistedSize('avride.uib.leftWidth', 208, 176, 420)
  const right = usePersistedSize('avride.uib.rightWidth', 300, 260, 560)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [loading])
  const mid = w <= 1180
  const narrow = w <= 960
  const compact = w <= 700
  // В узком окне свойства — выдвижная панель: открывается при выборе элемента.
  useEffect(() => {
    if (narrow) setInspOpen(selected !== null)
  }, [selected, narrow])

  // Скетч разбирается на лету; «отложенное» значение не мешает набору текста в редакторе.
  const code = useDeferredValue(host?.sketchCode)
  const sketch = useMemo(() => (code === undefined ? null : parseSketch(code)), [code])

  // Платформа берётся из выбранной платы IDE
  useEffect(() => {
    if (!loading && (host?.platform === 'esp32' || host?.platform === 'esp8266') && host.platform !== useUiBuilder.getState().project.platform) useUiBuilder.getState().setPlatform(host.platform)
  }, [host?.platform, loading])

  const ctx = useMemo<BuilderCtx>(() => {
    const r = resolveProject(project, sketch)
    const out = computeOutput(r.project, ledcApi)
    return { host, sketch, effective: r.project, ledcApi, issues: [...out.issues, ...r.issues], code: out.code, regions: out.regions }
  }, [project, sketch, ledcApi, host])

  // Где я и что дальше: вкладка страницы, выбранный элемент, следующий шаг (добавить → связать → вставить)
  const activeTabId = useUiBuilder((s) => s.activeTab)
  const tabNow = ctx.effective.tabs.find((t) => t.id === activeTabId) ?? ctx.effective.tabs[0]
  const selEl = selected ? ctx.effective.tabs.flatMap((t) => t.elements).find((e) => e.id === selected) : undefined
  const allEls = ctx.effective.tabs.flatMap((t) => t.elements)
  const unboundEls = allEls.filter((e) => canBind(e.type) && bindInfo(e, ctx.effective, ctx.sketch, ctx.issues).state === 'none')
  const connected = !!sketch && sketch.includes.some((i) => i.header === PAGE_SPECS.ui.header)
  const hint = allEls.length === 0 ? 'Шаг 1 из 3: добавьте элемент — клик в списке слева'
    : unboundEls.length > 0 ? `Шаг 2 из 3: свяжите «${unboundEls[0].label || unboundEls[0].id}» с переменной` + (unboundEls.length > 1 ? ` (и ещё ${unboundEls.length - 1})` : '')
    : host && connected ? ''
    : 'Шаг 3 из 3: нажмите «Подключить к скетчу»'
  const errs = ctx.issues.filter((i) => i.severity === 'error').length
  // «Подключить» из подсказки «Дальше» или командной палитры
  const req = usePageLink((s) => s.insertRequest)
  const seen = useRef(0)
  useEffect(() => {
    if (!loading && req && req.kind === 'ui' && req.nonce !== seen.current) {
      seen.current = req.nonce
      setInserting(true)
    }
  }, [req, loading])
  /** «Обновить» в плашке: переписать ui_generated.h и ui.json, скетч не трогаем. */
  const refreshFiles = async (): Promise<void> => {
    if (!host || !await savePageJson(host.sketchDir, 'ui', serializeUiPage(project, ledcApi))) return
    const p = await host.writeFile(PAGE_SPECS.ui.header, ctx.code)
    if (p && usePageLink.getState().root === host.sketchDir) usePageLink.getState().patch('ui', { header: ctx.code })
  }
  const warns = ctx.issues.length - errs

  const onKeyDown = (e: KeyboardEvent): void => {
    if (menu && more.current?.contains(e.target as Node)) return
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

  if (loading) return <div className="uib" aria-busy="true"><p className="uib-panel-pad" role="status">Загружаем страницу проекта…</p></div>

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
      <div data-testid="uib" className={`uib${mid ? ' mid' : ''}${narrow ? ' narrow' : ''}${compact ? ' compact' : ''}`} ref={root} tabIndex={-1} onKeyDown={onKeyDown}>
        <div className="uib-toolbar">
          <Select className="uib-select compact uib-view" data-testid="uib-view" aria-label="Вид ESPUI" value={view}
            onChange={(e) => st().setView(e.target.value as BuilderView)}>
            {BUILDER_VIEWS.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
          </Select>
          <div className="uib-undo" role="group" aria-label="История">
            <button className="uib-icon-btn" onClick={() => st().undo()} disabled={!canUndo} title="Отменить (Ctrl+Z)" aria-label="Отменить">
              <Icon name="undo" size={16} />
            </button>
            <button className="uib-icon-btn" onClick={() => st().redo()} disabled={!canRedo} title="Повторить (Ctrl+Y)" aria-label="Повторить">
              <Icon name="redo" size={16} />
            </button>
          </div>
          <div className="uib-modes" role="group" aria-label="Режим холста">
            <button data-testid="uib-mode-edit" className={`uib-mode${mode === 'edit' ? ' active' : ''}`} onClick={() => { st().setMode('edit'); st().setView('design') }} aria-pressed={mode === 'edit'} title="Редактировать страницу">
              <Icon name="edit" size={14} /> <span className="lbl">Редактировать</span>
            </button>
            <button data-testid="uib-mode-test" className={`uib-mode${mode === 'test' ? ' active' : ''}`} onClick={() => { st().setMode('test'); st().setView('design') }} aria-pressed={mode === 'test'} title="Страница работает как на устройстве: кнопки, ползунки, графики. «Устройство» — симуляция.">
              <Icon name="play" size={14} /> <span className="lbl">Тест</span>
            </button>
          </div>
          <div className="uib-spacer" />
          {host && <PageLinkChip kind="ui" testid="uib-link" connected={connected} liveHeader={ctx.code} onUpdate={() => void refreshFiles()} />}
          {allEls.length === 0 ? null : (
          <button className={`uib-status ${errs ? 'err' : warns ? 'warn' : 'ok'}`} onClick={() => st().setView('issues')} title="Открыть список проблем">
            <Icon name={errs ? 'error' : warns ? 'warn' : 'ok'} size={14} />
            <span className="lbl">{errs ? `Ошибок: ${errs}` : warns ? `Предупреждений: ${warns}` : 'Всё в порядке'}</span>
            {narrow && (errs || warns) ? <b>{errs || warns}</b> : null}
          </button>
          )}
          {narrow && view === 'design' && (
            <button className={'uib-btn' + (inspOpen ? ' on' : '')} data-testid="uib-props-btn" onClick={() => setInspOpen(!inspOpen)} title="Свойства страницы или выбранного элемента">Свойства</button>
          )}
          {(narrow || !host || project.platform === 'esp32') && (
            <div className="uib-more" ref={more}>
              <button className="uib-icon-btn" onClick={() => setMenu(!menu)} aria-haspopup="dialog" aria-expanded={menu} title="Ещё: плата и ядро ESP32" aria-label="Ещё">
                <Icon name="more" size={16} />
              </button>
              {menu && (
                <div className="uib-menu-pop" role="dialog" aria-label="Настройки конструктора ESPUI">
                  {narrow && (
                    <button onClick={() => { setInspOpen(!inspOpen); setMenu(false); more.current?.querySelector('button')?.focus() }}>
                      <Icon name="doc" size={14} /> {inspOpen ? 'Скрыть свойства' : 'Показать свойства'}
                    </button>
                  )}
                  {!host && (
                    <label className="uib-menu-row">
                      Плата
                      <Select className="uib-select compact" value={project.platform} onChange={(e) => st().setPlatform(e.target.value as 'esp8266' | 'esp32')}>
                        <option value="esp32">ESP32 / S3 / C3</option>
                        <option value="esp8266">ESP8266</option>
                      </Select>
                    </label>
                  )}
                  {project.platform === 'esp32' && (
                    <label className="uib-menu-row" title="В ядре Arduino-ESP32 3.x изменился API ШИМ">
                      Ядро ESP32
                      <Select className="uib-select compact" value={ledcApi} onChange={(e) => st().setLedcApi(e.target.value as 'v2' | 'v3')}>
                        <option value="v3">3.x</option>
                        <option value="v2">2.x</option>
                      </Select>
                    </label>
                  )}
                </div>
              )}
            </div>
          )}
          <button className="uib-btn primary" data-testid="uib-insert" onClick={() => setInserting(true)}>
            <Icon name="insert" size={15} /> {connected ? 'Подключение…' : 'Подключить к скетчу'}
          </button>
        </div>
        <div hidden={view !== 'design'} className={`uib-main${palCollapsed ? ' pal-collapsed' : ''}`} style={{ ...(palCollapsed ? {} : { '--uib-l': `${left.size}px` }), '--uib-r': `${right.size}px` } as React.CSSProperties}>
          <Palette />
          {!narrow && !palCollapsed && (
            <div className="uib-split uib-split-l"><Splitter axis="x" label="Ширина списка элементов" testid="uib-split-l" onDelta={left.by} onReset={left.reset} /></div>
          )}
          <CanvasView hint={view === 'design' && allEls.length > 0 ? (mode === 'test' ? 'Режим «Тест»: страница работает как на устройстве' : hint) : undefined} />
          {!narrow && (
            <div className="uib-split uib-split-r"><Splitter axis="x" label="Ширина свойств" testid="uib-split-r" onDelta={(d) => right.by(-d)} onReset={right.reset} /></div>
          )}
          {(!narrow || inspOpen) && <Inspector sheet={narrow} onClose={() => setInspOpen(false)} />}
        </div>
        <BuilderWorkspace onInsert={() => setInserting(true)} onReturn={() => { st().setView('design'); root.current?.querySelector<HTMLSelectElement>('[data-testid=uib-view]')?.focus() }} />
        {inserting && <InsertDialog onClose={() => setInserting(false)} />}
      </div>
    </BuilderContext.Provider>
  )
}

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { initBuild, useBuild } from './build/useBuild'
import { initMonitor } from './build/monitorStore'
import ManagerPanel from './build/ManagerPanel'
import ActivityBar from './shell/ActivityBar'
import FlashWizard from './pro/FlashWizard'
import { installHotkeys } from './shell/commands'
import EditorArea from './shell/EditorArea'
import ExamplesPanel from './shell/ExamplesPanel'
import FilesPanel from './shell/FilesPanel'
import SearchPanel from './shell/SearchPanel'
import Header from './shell/Header'
import ProHeader from './pro/ProHeader'
import ProActivityBar, { ProSidePanel } from './pro/ProSidebar'
import ProBuildDialogs from './pro/BuildDialogs'
import { useProStore } from './pro/proStore'
import { Icon } from './shell/icons'
import { DialogHost, Splitter, Toast, TooltipHost } from './shell/kit'
import { HelpDialog, Tour } from './shell/Help'
import ProjectWizard from './shell/ProjectWizard'
import Palette from './shell/Palette'
import { baseName } from './shell/problems'
import { isDirty, useProject } from './shell/project'
import StartScreen, { Notice } from './shell/StartScreen'
import StatusBar from './shell/StatusBar'
import { applyTheme, clamp, useUi } from './shell/ui'
import CircuitPythonDialog from './circuitpython/CircuitPythonDialog'
import { confirmCircuitPythonDiscard, useCircuitPython } from './circuitpython/store'

export default function App(): ReactNode {
  const { sideVisible, sideView, sideWidth, set } = useUi()
  const theme = useUi((s) => s.settings.theme)
  const proMode = useProStore((s) => s.proMode)
  const projectName = useProject((s) => s.name)
  const hasProject = useProject((s) => !!s.root)
  const ready = useProject((s) => s.ready)
  const activePath = useProject((s) => s.tabs.find((t) => t.id === s.activeId)?.path)
  const anyDirty = useProject((s) => Object.values(s.docs).some(isDirty))

  useEffect(() => { applyTheme(theme) }, [theme])

  // Для конструкторов и справочника освобождаем рабочую область.
  const toolMode = useProject((s) => { const k = s.tabs.find((t) => t.id === s.activeId)?.kind; return k === 'ref' || k === 'ui' || k === 'web' })
  const fullscreen = useUi((s) => s.fullscreen)
  const savedSide = useRef<boolean | null>(null)
  useEffect(() => {
    const ui = useUi.getState()
    if (toolMode && savedSide.current === null) {
      savedSide.current = ui.sideVisible
      ui.set({ sideVisible: false })
    } else if (!toolMode && savedSide.current !== null) {
      const wasVisible = savedSide.current
      savedSide.current = null
      ui.set({ sideVisible: ui.sideVisible || wasVisible })
      if (ui.fullscreen) ui.setFullscreen(false)
    }
  }, [toolMode])
  useEffect(() => {
    if (!fullscreen) return
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape' && !e.defaultPrevented) useUi.getState().setFullscreen(false) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [fullscreen])

  useEffect(() => {
    initBuild()
    initMonitor()
    void useBuild.getState().recheck()
    void useProject.getState().init()
    const offKeys = installHotkeys()
    // Закрытие окна: сначала предлагаем сохранить изменения
    const offClose = window.api.app.onCloseRequest(async () => {
      if (!(await confirmCircuitPythonDiscard())) return
      const circuitPython = useCircuitPython.getState()
      if (circuitPython.open) useCircuitPython.setState({ open: false, dirty: false })
      if (await useProject.getState().confirmDiscard()) await window.api.app.quit()
    })
    const onFocus = (): void => { void useProject.getState().syncFromDisk() }
    window.addEventListener('focus', onFocus)
    // Список портов обновляется сам (подключили плату — она появится)
    const poll = setInterval(() => {
      const b = useBuild.getState()
      if (document.visibilityState === 'visible' && b.status?.found && !b.busy) void b.refreshPorts()
    }, 5000)
    return () => { offKeys(); offClose(); window.removeEventListener('focus', onFocus); clearInterval(poll) }
  }, [])

  useEffect(() => {
    const file = activePath ? baseName(activePath) : ''
    document.title = [anyDirty ? '● ' + (file || '') : file, projectName, 'AVR IDE'].filter(Boolean).join(' — ')
  }, [activePath, projectName, anyDirty])

  // До открытия проекта — только стартовый экран: ни панелей, ни активити-бара, ни строки состояния
  if (!hasProject) {
    return (
      <div className="app start-app">
        {ready && <StartScreen />}
        <ProjectWizard />
        <CircuitPythonDialog />
        <DialogHost />
        <Notice />
        <HelpDialog />
        <TooltipHost />
      </div>
    )
  }

  return (
    <div className={'app' + (fullscreen && toolMode ? ' fs' : '')}>
      {proMode ? <ProHeader /> : <Header />}
      <div className="workbench">
        {proMode ? <ProActivityBar /> : <ActivityBar />}
        {sideVisible && (
          <>
            <aside className="side" style={{ width: sideWidth }}>
              {sideView === 'files' && <FilesPanel />}
              {sideView === 'search' && <SearchPanel />}
              {!proMode && sideView === 'examples' && <ExamplesPanel />}
              {proMode && <ProSidePanel view={sideView} />}
              {!proMode && (sideView === 'boards' || sideView === 'libs') && (
                <>
                  <div className="side-title">
                    <span className="grow">{sideView === 'boards' ? 'Платы' : 'Библиотеки'}</span>
                    <button className="icon-btn" title="Обновить списки" onClick={() => void useBuild.getState().recheck()}><Icon name="refresh" size={15} /></button>
                  </div>
                  <p className="side-sub">{sideView === 'boards' ? 'Ядро — это поддержка платы. Без него скетч для неё не соберётся.' : 'Готовый код для датчиков, дисплеев и модулей.'}</p>
                  <div className="side-scroll"><ManagerPanel key={sideView} view={sideView === 'libs' ? 'lib' : 'core'} /></div>
                </>
              )}
            </aside>
            <Splitter axis="x" onDelta={(d) => set({ sideWidth: clamp(useUi.getState().sideWidth + d, 180, 560) })} />
          </>
        )}
        <div className="main-col">
          <EditorArea />

        </div>
      </div>
      <StatusBar />
      <Palette />
      <ProjectWizard />
      <CircuitPythonDialog />
      <FlashWizard />
      <ProBuildDialogs />
      <DialogHost />
      <Toast />
      <HelpDialog />
      <Tour />
      <TooltipHost />
    </div>
  )
}

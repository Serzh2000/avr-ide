import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { initBuild, useBuild } from './build/useBuild'
import ManagerPanel from './build/ManagerPanel'
import ActivityBar from './shell/ActivityBar'
import BottomPanel from './shell/BottomPanel'
import { installHotkeys } from './shell/commands'
import EditorArea from './shell/EditorArea'
import FilesPanel from './shell/FilesPanel'
import Header from './shell/Header'
import { Icon } from './shell/icons'
import { DialogHost, Splitter } from './shell/kit'
import NewProjectWizard from './shell/NewProjectWizard'
import Palette from './shell/Palette'
import { baseName } from './shell/problems'
import { isDirty, useProject } from './shell/project'
import StartScreen, { Notice } from './shell/StartScreen'
import StatusBar from './shell/StatusBar'
import { applyTheme, clamp, useUi } from './shell/ui'

export default function App(): ReactNode {
  const { sideVisible, sideView, sideWidth, bottomVisible, bottomHeight, set } = useUi()
  const theme = useUi((s) => s.settings.theme)
  const projectName = useProject((s) => s.name)
  const hasProject = useProject((s) => !!s.root)
  const ready = useProject((s) => s.ready)
  const activePath = useProject((s) => s.tabs.find((t) => t.id === s.activeId)?.path)
  const anyDirty = useProject((s) => Object.values(s.docs).some(isDirty))

  useEffect(() => { applyTheme(theme) }, [theme])

  // Вкладки справочника и конструкторов: боковая и нижняя панели по умолчанию свёрнуты, чтобы рабочая область была крупной.
  // Прежнее состояние возвращается при уходе на вкладку кода, если пользователь сам не открывал панель.
  const toolMode = useProject((s) => { const k = s.tabs.find((t) => t.id === s.activeId)?.kind; return k === 'ref' || k === 'ui' || k === 'web' })
  const fullscreen = useUi((s) => s.fullscreen)
  const savedPanels = useRef<{ side: boolean; bottom: boolean } | null>(null)
  useEffect(() => {
    const ui = useUi.getState()
    if (toolMode && !savedPanels.current) {
      savedPanels.current = { side: ui.sideVisible, bottom: ui.bottomVisible }
      ui.set({ sideVisible: false, bottomVisible: false })
    } else if (!toolMode && savedPanels.current) {
      const sv = savedPanels.current
      savedPanels.current = null
      ui.set({ sideVisible: ui.sideVisible || sv.side, bottomVisible: ui.bottomVisible || sv.bottom })
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
    void useBuild.getState().recheck()
    void useProject.getState().init()
    const offKeys = installHotkeys()
    // Закрытие окна: сначала предлагаем сохранить изменения
    const offClose = window.api.app.onCloseRequest(async () => {
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
        <NewProjectWizard />
        <DialogHost />
        <Notice />
      </div>
    )
  }

  return (
    <div className={'app' + (fullscreen && toolMode ? ' fs' : '')}>
      <Header />
      <div className="workbench">
        <ActivityBar />
        {sideVisible && (
          <>
            <aside className="side" style={{ width: sideWidth }}>
              {sideView === 'files' && <FilesPanel />}
              {sideView === 'boards' && (
                <>
                  <div className="side-title">
                    <span className="grow">Платы и библиотеки</span>
                    <button className="icon-btn" title="Обновить списки" onClick={() => void useBuild.getState().recheck()}><Icon name="refresh" size={15} /></button>
                  </div>
                  <div className="side-scroll"><ManagerPanel /></div>
                </>
              )}
            </aside>
            <Splitter axis="x" onDelta={(d) => set({ sideWidth: clamp(useUi.getState().sideWidth + d, 180, 560) })} />
          </>
        )}
        <div className="main-col">
          <EditorArea />
          {bottomVisible && (
            <>
              <Splitter axis="y" onDelta={(d) => set({ bottomHeight: clamp(useUi.getState().bottomHeight - d, 90, Math.max(160, window.innerHeight - 260)) })} />
              <div className="bottom-wrap" style={{ height: bottomHeight }}><BottomPanel /></div>
            </>
          )}
        </div>
      </div>
      <StatusBar />
      <Palette />
      <NewProjectWizard />
      <DialogHost />
    </div>
  )
}

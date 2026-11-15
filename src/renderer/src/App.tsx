import { useEffect } from 'react'
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
import NewSketchDialog from './shell/NewSketchDialog'
import Palette from './shell/Palette'
import { baseName } from './shell/problems'
import { isDirty, useProject } from './shell/project'
import StatusBar from './shell/StatusBar'
import { applyTheme, clamp, useUi } from './shell/ui'

export default function App(): ReactNode {
  const { sideVisible, sideView, sideWidth, bottomVisible, bottomHeight, set } = useUi()
  const theme = useUi((s) => s.settings.theme)
  const projectName = useProject((s) => s.name)
  const activePath = useProject((s) => s.tabs.find((t) => t.id === s.activeId)?.path)
  const anyDirty = useProject((s) => Object.values(s.docs).some(isDirty))

  useEffect(() => { applyTheme(theme) }, [theme])

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

  return (
    <div className="app">
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
      <NewSketchDialog />
      <DialogHost />
    </div>
  )
}

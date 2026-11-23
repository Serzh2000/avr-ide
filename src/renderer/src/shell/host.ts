// Реализация контракта UiBuilderHost для конструкторов (ESPUI и веб-дизайнер).
import { useMemo } from 'react'
import type { UiBuilderHost } from '../contracts'
import { platformOf } from '../build/boards'
import { useProject } from './project'
import { useUi } from './ui'

/** Записывает файл в папку скетча; если он открыт в редакторе — обновляет и его, чтобы не затереть записанное. Возвращает путь или null. */
export async function writeSketchFileSynced(root: string | null, name: string, content: string, previous?: string | null): Promise<string | null> {
  if (!root) {
    useUi.getState().notify('Откройте или создайте скетч, чтобы сохранить файл в его папку.')
    return null
  }
  if (useProject.getState().root !== root) return null
  const r = await window.api.fs.writeSketchFile(root, name, content, previous)
  if (!r.ok) {
    if (useProject.getState().root === root) useUi.getState().notify(r.error, { kind: 'error' })
    return null
  }
  const p = r.data
  if (useProject.getState().root === root) {
    useProject.setState((s) => (s.docs[p] ? { docs: { ...s.docs, [p]: { content, saved: content, mtime: Date.now() } } } : {}))
    if (/\.(?:h|hpp|c|cpp|ino)$/i.test(name)) useProject.getState().invalidateBuild()
    void useProject.getState().refreshTree()
  }
  return p
}

export function useUiHost(): UiBuilderHost {
  const root = useProject((s) => s.root)
  const mainFile = useProject((s) => s.mainFile)
  const sketchCode = useProject((s) => (s.mainFile ? s.docs[s.mainFile]?.content ?? '' : ''))
  const fqbn = useUi((s) => s.fqbn)

  return useMemo<UiBuilderHost>(() => ({
    sketchCode,
    sketchPath: mainFile,
    sketchDir: root,
    platform: platformOf(fqbn),
    writeFile: (name, content) => writeSketchFileSynced(root, name, content),
    replaceSketchCode: (code) => {
      if (root && useProject.getState().root === root && mainFile) useProject.getState().setContent(mainFile, code)
    },
    goToLine: (line) => {
      const m = useProject.getState().mainFile
      if (m) void useProject.getState().openFile(m, { line, column: 1 })
    }
  }), [root, mainFile, sketchCode, fqbn])
}

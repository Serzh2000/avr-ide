// Скетч для веб-дизайнера: разбор текста .ino, найденные по нему проблемы переменных и доступ к хосту IDE.
import { createContext, useContext } from 'react'
import type { UiBuilderHost } from '../contracts'
import type { SketchInfo } from '../uibuilder/sketch/parse'
import type { Issue } from './core/index'

export interface WdSketchCtx {
  host?: UiBuilderHost
  sketch: SketchInfo | null
  /** Проблемы, найденные по скетчу (переменная исчезла, const, двойное объявление). */
  issues: Issue[]
}

export const WdSketch = createContext<WdSketchCtx>({ sketch: null, issues: [] })
export const useWdSketch = (): WdSketchCtx => useContext(WdSketch)

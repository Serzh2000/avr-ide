import { createContext, useContext } from 'react'
import type { UiBuilderHost } from '../../contracts'
import type { CodeRegion, Issue, UiElement, UiProject } from '../core/index'
import type { SketchInfo } from '../sketch/parse'

/** Всё, что вычисляется из модели и скетча и нужно многим панелям. */
export interface BuilderCtx {
  host?: UiBuilderHost
  /** Разобранный скетч (null — хоста нет). */
  sketch: SketchInfo | null
  /** Модель с применёнными данными скетча (для превью/проверок/генерации). */
  effective: UiProject
  ledcApi: 'v2' | 'v3'
  /** Проблемы: проверка модели + проверка по скетчу. */
  issues: Issue[]
  /** Сгенерированный ui_generated.h и разметка «строки кода ↔ элементы». */
  code: string
  regions: CodeRegion[]
}

export const BuilderContext = createContext<BuilderCtx | null>(null)

export function useBuilder(): BuilderCtx {
  const c = useContext(BuilderContext)
  if (!c) throw new Error('BuilderContext отсутствует')
  return c
}

export function findElement(p: UiProject, id: string | null): UiElement | undefined {
  if (!id) return undefined
  for (const t of p.tabs) for (const e of t.elements) if (e.id === id) return e
  return undefined
}

export function tabOfElement(p: UiProject, id: string): string | undefined {
  return p.tabs.find((t) => t.elements.some((e) => e.id === id))?.id
}

export function isEditableTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el || !el.tagName) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

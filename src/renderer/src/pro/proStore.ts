import { create } from 'zustand'
import type { ProviderStatus } from '../../../main/pro/interfaces'
import type { ProActionKind } from '../../../main/pro/ipc'
import type { ProProject } from '../../../main/pro/project/types'
import { useProject } from '../shell/project'
import { lsGet, lsSet, useUi } from '../shell/ui'
import { openBottom, useHw } from './hwStore'
import { runProBuild, runProClean } from './buildStore'
import type { SideView } from '../shell/ui'

const KEY = 'avride.pro.v1'
const PRO_ONLY: SideView[] = ['project', 'chips']
const ARDUINO_ONLY: SideView[] = ['examples', 'boards', 'libs']

interface Persisted { config: string }

function load(): Persisted {
  try {
    const j = JSON.parse(lsGet(KEY) ?? '{}') as Partial<Persisted>
    return { config: typeof j.config === 'string' ? j.config : 'Debug' }
  } catch { return { config: 'Debug' } }
}

let requestId = 0

interface ProState extends Persisted {
  /** Оболочка STM32 определяется форматом открытой папки. */
  proMode: boolean
  /** Проект открытой папки (null — папка без avride.project.json или проект не открыт) */
  project: ProProject | null
  /** Текст ошибки, если avride.project.json есть, но некорректен */
  projectError: string | null
  providers: ProviderStatus | null
  setConfig: (name: string) => void
  reloadProject: () => Promise<void>
}

/** Режим меняет доступные разделы боковой панели: Pro-разделы скрыты в Arduino и наоборот. */
function fixSideView(pro: boolean): void {
  const ui = useUi.getState()
  if (pro && ARDUINO_ONLY.includes(ui.sideView)) ui.set({ sideView: 'project' })
  if (!pro && PRO_ONLY.includes(ui.sideView)) ui.set({ sideView: 'files' })
}

export const useProStore = create<ProState>((set) => ({
  ...load(),
  proMode: false,
  project: null,
  projectError: null,
  providers: null,

  setConfig: (name) => set({ config: name }),

  reloadProject: async () => {
    const id = ++requestId
    const { root, kind } = useProject.getState()
    if (!root || kind !== 'stm32') return
    let r: Awaited<ReturnType<typeof window.api.pro.readProject>>
    try {
      r = await window.api.pro.readProject()
    } catch {
      r = { ok: false, error: 'Не удалось прочитать файл avride.project.json.' }
    }
    if (id !== requestId || useProject.getState().root !== root) return
    if (!r.ok) { set({ project: null, projectError: r.error }); return }
    const d = r.data
    if (!d.found) set({ project: null, projectError: 'В папке нет файла avride.project.json.' })
    else if (!d.ok) set({ project: null, projectError: d.error })
    else set((state) => ({ project: d.project, projectError: null, config: d.project.configurations[state.config] ? state.config : 'Debug' }))
  }
}))

let timer: ReturnType<typeof setTimeout> | undefined
useProStore.subscribe((s, previous) => {
  if (s.config === previous.config) return
  clearTimeout(timer)
  timer = setTimeout(() => lsSet(KEY, JSON.stringify({ config: s.config } satisfies Persisted)), 200)
})

useProject.subscribe((s, previous) => {
  if (s.root === previous.root && s.kind === previous.kind) return
  ++requestId
  const proMode = s.kind === 'stm32'
  useProStore.setState({ proMode, project: null, projectError: null })
  if (!s.root) return
  fixSideView(proMode)
  if (proMode) void useProStore.getState().reloadProject()
})

export const PROVIDER_FOR: Record<ProActionKind, keyof ProviderStatus> = { build: 'build', clean: 'build', flash: 'programmer', debug: 'debug' }
export const NOT_READY: Record<ProActionKind, string> = {
  build: 'Сборка ARM-проектов ещё не реализована.',
  clean: 'Сборка ARM-проектов ещё не реализована.',
  flash: 'Прошивка через ST-Link ещё не реализована.',
  debug: 'Отладка ещё не реализована.'
}

/** Короткое имя кристалла без корпуса и температурного диапазона: STM32F103C8T6 → STM32F103C8. */
export const shortChip = (chip: string): string => chip.replace(/^(STM32[A-Z]\d{3}[A-Z][0-9A-Z])[A-Z]\d$/, '$1')
export const PROGRAMMER_LABEL: Record<string, string> = { stlink: 'ST-Link', jlink: 'J-Link', 'cmsis-dap': 'CMSIS-DAP' }

export function providersReady(p: ProviderStatus | null, kind: ProActionKind): boolean {
  return !!p && p[PROVIDER_FOR[kind]].implemented
}

/** Кнопки шапки и горячие клавиши в Pro-режиме: собрать, очистить, прошить, отладка. Нереализованное объясняется всплывающим сообщением. */
export async function runProAction(kind: ProActionKind): Promise<void> {
  const ui = useUi.getState()
  const st = useProStore.getState()
  if (!st.project) { ui.notify(st.projectError ?? 'В открытой папке нет файла проекта STM32 (avride.project.json).'); return }
  if (!providersReady(st.providers, kind)) { ui.notify(NOT_READY[kind]); return }
  // Прошивка и отладка — с подробным ходом и ошибками в панелях «Прошивка» и «Отладка»
  if (kind === 'flash') { openBottom('hw'); return }
  if (kind === 'debug') {
    const d = useHw.getState().debug.status
    if (d === 'off') await useHw.getState().startDebug(st.config)
    else openBottom('debug')
    return
  }
  // Сборка и очистка: свой ход с журналом, проблемами, карточками установки (buildStore)
  if (kind === 'build') { await runProBuild(); return }
  if (kind === 'clean') { await runProClean(); return }

}

/** Подгружает сводку провайдеров (один раз; провайдеры подключаются при старте main). */
export async function loadProviders(): Promise<void> {
  const r = await window.api.pro.providers()
  if (r.ok) useProStore.setState({ providers: r.data })
}

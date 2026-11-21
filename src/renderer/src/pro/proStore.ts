// Состояние Профессионального режима: переключатель режима (сохраняется), загруженный avride.project.json, активная конфигурация,
// сводка провайдеров (что реализовано). Режим переключается сам при открытии проекта: есть avride.project.json — Pro, нет — Arduino.
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

interface Persisted { proMode: boolean; config: string }

function load(): Persisted {
  try {
    const j = JSON.parse(lsGet(KEY) ?? '{}') as Partial<Persisted>
    return { proMode: j.proMode === true, config: typeof j.config === 'string' ? j.config : 'Debug' }
  } catch { return { proMode: false, config: 'Debug' } }
}

interface ProState extends Persisted {
  /** Проект открытой папки (null — папка без avride.project.json или проект не открыт) */
  project: ProProject | null
  /** Текст ошибки, если avride.project.json есть, но некорректен */
  projectError: string | null
  providers: ProviderStatus | null
  setProMode: (v: boolean) => void
  setConfig: (name: string) => void
  reloadProject: () => Promise<void>
}

/** Режим меняет доступные разделы боковой панели: Pro-разделы скрыты в Arduino и наоборот. */
function fixSideView(pro: boolean): void {
  const ui = useUi.getState()
  if (pro && ARDUINO_ONLY.includes(ui.sideView)) ui.set({ sideView: 'project' })
  if (!pro && PRO_ONLY.includes(ui.sideView)) ui.set({ sideView: 'files' })
}

export const useProStore = create<ProState>((set, get) => ({
  ...load(),
  project: null,
  projectError: null,
  providers: null,

  setProMode: (v) => {
    if (get().proMode === v) return
    set({ proMode: v })
    fixSideView(v)
    // Вкладки конструкторов и примеров относятся к Arduino-режиму
    if (v) {
      const p = useProject.getState()
      for (const t of p.tabs) if (t.kind === 'ui' || t.kind === 'web' || t.kind === 'example') void p.closeTab(t.id)
    }
    if (!v) { const p = useProject.getState(); for (const t of p.tabs) if (t.kind === 'pins') void p.closeTab(t.id) }
    if (useProject.getState().root) void get().reloadProject()
  },

  setConfig: (name) => set({ config: name }),

  reloadProject: async () => {
    if (!useProject.getState().root) { set({ project: null, projectError: null }); return }
    const r = await window.api.pro.readProject()
    if (!r.ok) { set({ project: null, projectError: r.error }); return }
    const d = r.data
    if (!d.found) set({ project: null, projectError: null })
    else if (!d.ok) set({ project: null, projectError: d.error })
    else set((s) => ({ project: d.project, projectError: null, config: d.project.configurations[s.config] ? s.config : 'Debug' }))
  }
}))

fixSideView(useProStore.getState().proMode)

let timer: ReturnType<typeof setTimeout> | undefined
useProStore.subscribe((s) => {
  clearTimeout(timer)
  timer = setTimeout(() => lsSet(KEY, JSON.stringify({ proMode: s.proMode, config: s.config } satisfies Persisted)), 200)
})

/** Открыли/закрыли проект: подгружаем avride.project.json и при необходимости переключаем режим с уведомлением. */
let lastRoot: string | null = null
useProject.subscribe((s) => {
  if (s.root === lastRoot) return
  lastRoot = s.root
  const st = useProStore.getState()
  if (!s.root) { useProStore.setState({ project: null, projectError: null }); return }
  void (async () => {
    const r = await window.api.pro.readProject()
    if (lastRoot !== s.root) return
    const d = r.ok ? r.data : null
    const isPro = !!d?.found
    if (isPro) {
      useProStore.setState(d.ok
        ? { project: d.project, projectError: null, config: d.project.configurations[st.config] ? st.config : 'Debug' }
        : { project: null, projectError: d.error })
      if (!useProStore.getState().proMode) {
        useProStore.getState().setProMode(true)
        useUi.getState().notify(d.ok ? `Открыт проект STM32 (avride.project.json): включён профессиональный режим.` : `Открыт проект STM32, но файл проекта с ошибкой: включён профессиональный режим.`)
      } else if (!d.ok) useUi.getState().notify(d.error, { kind: 'error' })
    } else {
      useProStore.setState({ project: null, projectError: null })
      if (useProStore.getState().proMode) {
        useProStore.getState().setProMode(false)
        useUi.getState().notify('Открыт проект Arduino: включён режим Arduino.')
      }
    }
  })()
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
  if (!st.project) { ui.notify(st.projectError ?? 'В открытой папке нет файла avride.project.json — это не проект профессионального режима.'); return }
  if (!providersReady(st.providers, kind)) { ui.notify(NOT_READY[kind]); return }
  // Прошивка и отладка — с подробным ходом и ошибками в панелях «Прошивка» и «Отладка»
  if (kind === 'flash') { await useHw.getState().flashNow(st.config); return }
  if (kind === 'debug') {
    const d = useHw.getState().debug.status
    if (d === 'off') await useHw.getState().startDebug(st.config)
    else openBottom('debug')
    return
  }
  // Сборка и очистка: свой ход с журналом, проблемами, карточками установки (buildStore)
  if (kind === 'build') { await runProBuild(); return }
  if (kind === 'clean') { await runProClean(); return }
  const r = await window.api.pro.action(kind, st.config)
  // Итог прошивки уже виден в открытой вкладке «Прошивка» — отдельное сообщение его дублирует
  const here = kind === 'flash' && ui.bottomVisible && ui.bottomTab === 'hw'
  if (!here) ui.notify(r.ok ? r.data.message : r.error, { kind: r.ok ? 'ok' : 'error' })
}

/** Подгружает сводку провайдеров (один раз; провайдеры подключаются при старте main). */
export async function loadProviders(): Promise<void> {
  const r = await window.api.pro.providers()
  if (r.ok) useProStore.setState({ providers: r.data })
}

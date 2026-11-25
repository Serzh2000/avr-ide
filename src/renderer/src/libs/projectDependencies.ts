import { create } from 'zustand'
import type { DependencyPlan } from '../../../main/libs/dependencies'
import { useBuild } from '../build/useBuild'
import { useProject } from '../shell/project'
import { useUi } from '../shell/ui'
import { useProStore } from '../pro/proStore'
import { refreshLibs } from './store'

interface State {
  key: string
  pending: boolean
  plan: DependencyPlan | null
  error: string
}

export const useProjectDependencies = create<State>(() => ({ key: '', pending: false, plan: null, error: '' }))
export const dependencyKey = (root: string, fqbn: string): string => `${root}\n${fqbn}`

let inFlight: { key: string; work: Promise<'cancelled' | void> } | undefined

function showDependencies(): void { useUi.getState().set({ sideView: 'libs', sideVisible: true }) }

export function checkDependencies(action: 'auto' | 'build' | 'scan' | 'install' | 'refresh', choice: string | null = null): Promise<'cancelled' | void> {
  const { root, mainFile, kind } = useProject.getState()
  const { fqbn } = useUi.getState()
  if (!root || !mainFile || kind !== 'arduino' || !fqbn || useProStore.getState().proMode) return Promise.resolve()
  const key = dependencyKey(root, fqbn)
  if (inFlight?.key === key) return inFlight.work
  const current = (): boolean => {
    const p = useProject.getState()
    return p.root === root && p.mainFile === mainFile && p.kind === 'arduino' && useUi.getState().fqbn === fqbn && !useProStore.getState().proMode
  }
  const work = async (): Promise<'cancelled' | void> => {
    const store = useProjectDependencies
    const previous = store.getState()
    store.setState({ key, pending: true, plan: previous.key === key ? previous.plan : null, error: '' })
    const apply = (plan: DependencyPlan | null, error = ''): void => {
      if (current()) store.setState({ plan, error })
    }
    const notify = useUi.getState().notify
    const actionLink = { label: 'Зависимости', run: showDependencies }
    try {
      const r = await window.api.libs.dependencyPlan(root, fqbn)
      if (!current()) return
      if (!r.ok) {
        apply(null, r.error)
        if (action !== 'auto' || !previous.error) notify('Не удалось проверить зависимости скетча.', { kind: 'error', action: actionLink })
        return
      }
      const plan = r.data
      const samePlan = previous.key === key && JSON.stringify(previous.plan) === JSON.stringify(plan)
      if (action === 'build' && previous.error && samePlan) {
        apply(plan, previous.error)
        return
      }
      apply(plan)
      const manual = action === 'install' || action === 'refresh'
      const auto = (action === 'auto' || action === 'build') && useUi.getState().settings.autoRestoreLibraries
      if (!plan.profile && (manual || auto) && !useBuild.getState().busy &&
          (plan.install.length || plan.needsIndex || choice || action === 'refresh')) {
        const done = await useBuild.getState().run(
          window.api.libs.restoreDependencies(root, fqbn, action === 'refresh', choice),
          'lib-install', 'Восстановление библиотек скетча…'
        )
        void refreshLibs()
        if (!current()) return
        const restored = await window.api.libs.dependencyPlan(root, fqbn)
        if (!current()) return
        if (!done || done.cancelled || done.code !== 0 || !restored.ok) {
          const error = done?.cancelled ? 'Установка отменена.' : 'Не удалось восстановить библиотеки. Проверьте сеть и вывод Arduino CLI.'
          apply(restored.ok ? restored.data : plan, error)
          notify(error, { kind: done?.cancelled ? 'info' : 'error', action: actionLink })
          return done?.cancelled ? 'cancelled' : undefined
        }
        const next = restored.data
        apply(next)
        if (next.choose.length || next.unknown.length || next.conflicts.length || next.install.length || next.needsIndex) {
          notify('Часть зависимостей требует проверки.', { action: actionLink })
        } else if (action !== 'refresh' && (plan.install.length || plan.needsIndex || choice)) {
          notify('Библиотеки скетча восстановлены.', { kind: 'ok', action: actionLink })
        }
      } else if (action === 'auto' && !plan.profile && (plan.choose.length || plan.unknown.length || plan.conflicts.length ||
          plan.install.length || plan.needsIndex) && !samePlan) {
        notify('У скетча есть недостающие или неоднозначные зависимости.', { action: actionLink })
      }
    } catch (e) {
      apply(null, e instanceof Error ? e.message : String(e))
    } finally {
      if (store.getState().key === key) store.setState({ pending: false })
    }
  }
  const task = work().finally(() => { if (inFlight?.work === task) inFlight = undefined })
  inFlight = { key, work: task }
  return task
}

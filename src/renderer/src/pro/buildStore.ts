// Состояние сборки Pro-режима: компилятор, отчёт о размере, диалоги (установка компилятора, скачивание CMSIS, скрипт компоновки) и сам процесс «Собрать».
import { create } from 'zustand'
import type { BuildReportDto, SupportStatus, ToolchainStatus } from '../../../main/pro/build/types'
import { useBuild } from '../build/useBuild'
import { confirmDialog } from '../shell/dialogs'
import { useProject } from '../shell/project'
import { useUi } from '../shell/ui'
import { useProStore } from './proStore'

export type BuildDialog =
  | { kind: 'toolchain'; resume: boolean }
  | { kind: 'support'; status: SupportStatus }
  | { kind: 'linker'; message: string }
  | { kind: 'configs' }
  | null

interface ProBuildState {
  toolchain: ToolchainStatus | null
  toolchainLoading: boolean
  report: BuildReportDto | null
  reportError: string | null
  /** Итог последней сборки: для строки состояния и вкладки «Размер» */
  last: { ok: boolean; cancelled: boolean; config: string; at: number } | null
  dialog: BuildDialog
  /** Идёт установка компилятора / скачивание CMSIS (операция в main, прогресс — в useBuild.progress) */
  installing: 'toolchain' | 'support' | null
  setDialog: (d: BuildDialog) => void
  refreshToolchain: () => Promise<ToolchainStatus | null>
  loadReport: () => Promise<void>
}

export const useProBuild = create<ProBuildState>((set, get) => ({
  toolchain: null,
  toolchainLoading: false,
  report: null,
  reportError: null,
  last: null,
  dialog: null,
  installing: null,
  setDialog: (dialog) => set({ dialog }),
  refreshToolchain: async () => {
    set({ toolchainLoading: true })
    const r = await window.api.pro.toolchain()
    set({ toolchainLoading: false, ...(r.ok ? { toolchain: r.data } : {}) })
    return r.ok ? r.data : null
  },
  loadReport: async () => {
    const cfg = useProStore.getState().config
    if (!useProStore.getState().project) { set({ report: null, reportError: null }); return }
    const r = await window.api.pro.report(cfg)
    set(r.ok ? { report: r.data, reportError: null } : { report: null, reportError: r.error })
  }
}))

let inited = false
/** Подписки на события main (один раз): ход операций Pro (подпись и процент). */
export function initProBuild(): void {
  if (inited) return
  inited = true
  window.api.pro.onProgress((e) => useBuild.setState({ progress: { label: e.label, pct: e.pct } }))
  // Отчёт относится к выбранной конфигурации и открытому проекту
  useProStore.subscribe((s, p) => { if (s.config !== p.config || s.project !== p.project) { useProBuild.setState({ report: null, reportError: null }); if (s.project && s.proMode) void useProBuild.getState().loadReport() } })
}

// Формат — как в строке состояния Arduino-режима («1.5 КБ»), чтобы цифры на одном экране не расходились
const kb = (n: number): string => (n >= 1024 ? (n / 1024).toFixed(1) + ' КБ' : n + ' Б')
export const fmtKb = kb

/** Итог в формате строки состояния: «Flash 12,4 КБ (19%) · RAM 2,1 КБ (10%)». */
export function sizeSummary(r: BuildReportDto): string {
  const s = r.size
  const pct = (a: number, b: number): number => (b ? Math.round((a / b) * 100) : 0)
  return `Flash ${kb(s.flashUsed)} (${pct(s.flashUsed, s.flashTotal)}%) · RAM ${kb(s.ramUsed)} (${pct(s.ramUsed, s.ramTotal)}%)`
}

/** Сборка: проверка → при нехватке чего-либо карточка с одним главным действием → запуск → итог. */
export async function runProBuild(): Promise<void> {
  const ui = useUi.getState()
  const st = useProStore.getState()
  const b = useBuild.getState()
  if (!st.project) { ui.notify(st.projectError ?? 'В открытой папке нет файла проекта STM32 (avride.project.json).'); return }
  if (b.busy) { ui.notify('Уже выполняется другая операция. Дождитесь окончания или нажмите «Остановить».'); return }
  initProBuild()
  if (!(await useProject.getState().saveAll())) return
  const pre = await window.api.pro.preflight(st.config)
  if (!pre.ok) { ui.notify(pre.error, { kind: 'error' }); return }
  if (!pre.data.ok) {
    const { code, message } = pre.data
    if (code === 'no-toolchain') { await useProBuild.getState().refreshToolchain(); useProBuild.getState().setDialog({ kind: 'toolchain', resume: true }); return }
    if (code === 'no-support') {
      const s = await window.api.pro.support()
      if (s.ok) { useProBuild.getState().setDialog({ kind: 'support', status: s.data }); return }
    }
    if (code === 'no-linker') { useProBuild.getState().setDialog({ kind: 'linker', message }); return }
    useBuild.getState().append(`\nerror: ${message}\n`)
    ui.notify(message, { kind: 'error', action: { label: 'Открыть вывод', run: () => ui.showBottom('output') } })
    return
  }
  b.append(`\n=== Сборка: ${st.project.name} [${st.config}] ===\n`)
  const done = await useBuild.getState().run(window.api.pro.build(st.config), 'compile', 'Сборка…')
  if (!done) return
  const ok = done.code === 0 && !done.cancelled
  useProBuild.setState({ last: { ok, cancelled: done.cancelled, config: st.config, at: Date.now() } })
  if (ok) {
    await useProBuild.getState().loadReport()
    const rep = useProBuild.getState().report
    if (rep) {
      // Итог для общей строки состояния и баннеров сборки: те же поля, что у Arduino-режима
      const pct = (a: number, t: number): number => (t ? Math.round((a / t) * 100) : 0)
      useBuild.setState((s) => (s.result ? { result: { ...s.result, size: { flash: { used: rep.size.flashUsed, pct: pct(rep.size.flashUsed, rep.size.flashTotal), max: rep.size.flashTotal }, ram: { used: rep.size.ramUsed, pct: pct(rep.size.ramUsed, rep.size.ramTotal), max: rep.size.ramTotal } } } } : {}))
      ui.notify(`Собрано · ${sizeSummary(rep)}`, { kind: 'ok', action: { label: 'Размер', run: () => useUi.getState().showBottom('size') } })
    }
  } else if (!done.cancelled) {
    const first = useBuild.getState().problems.find((x) => x.severity === 'error')
    const tab = first ? 'problems' : 'output'
    ui.notify(first?.message ?? 'Сборка завершилась с ошибкой.', { kind: 'error', action: { label: first ? 'Открыть проблемы' : 'Открыть вывод', run: () => ui.showBottom(tab) } })
  }
}

/** Продолжить сборку после установки компилятора или файлов CMSIS. */
export const resumeBuild = (): void => { void runProBuild() }

/** Очистка результатов сборки выбранной конфигурации. */
export async function runProClean(): Promise<void> {
  const st = useProStore.getState()
  const ui = useUi.getState()
  if (!st.project) return
  const r = await window.api.pro.clean(st.config)
  ui.notify(r.ok ? r.data.message : r.error, { kind: r.ok ? 'ok' : 'error' })
  if (r.ok) useProBuild.setState({ report: null, reportError: null, last: null })
}

/** Экспорт Makefile и CMakeLists.txt; чужие файлы с такими именами заменяются только после подтверждения. */
export async function runExportBuild(): Promise<void> {
  const ui = useUi.getState()
  let r = await window.api.pro.exportBuild(false)
  if (!r.ok && /Подтвердите замену/.test(r.error)) {
    const a = await confirmDialog({ title: 'Заменить Makefile и CMakeLists.txt?', message: r.error, buttons: [{ id: 'no', label: 'Отмена' }, { id: 'yes', label: 'Заменить', kind: 'danger' }] })
    if (a !== 'yes') return
    r = await window.api.pro.exportBuild(true)
  }
  if (r.ok) {
    await useProject.getState().refreshTree()
    ui.notify('Экспорт сборки: созданы Makefile и CMakeLists.txt в папке проекта. Собирайте вне IDE: make или cmake.', { kind: 'ok' })
  } else ui.notify(r.error, { kind: 'error' })
}

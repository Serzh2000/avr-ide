// Состояние источника «GitHub»: статус каталога, прогресс обновления, результат последней установки.
// Хранится вне компонента, чтобы не терялось при переключении вкладок боковой панели.
import { create } from 'zustand'
import type { CatalogStatus, InstallResult } from '../../../main/libsource/types'

interface GhStore {
  status: CatalogStatus | null
  refreshing: boolean
  progress: string
  /** Ошибки последнего обновления каталога */
  refreshErrors: string[]
  lastResult: InstallResult | null
  loadStatus: () => Promise<CatalogStatus | null>
  refresh: () => Promise<void>
  setResult: (r: InstallResult | null) => void
}

export const useGh = create<GhStore>((set, get) => ({
  status: null,
  refreshing: false,
  progress: '',
  refreshErrors: [],
  lastResult: null,

  loadStatus: async () => {
    const r = await window.api.libsource.status()
    if (r.ok) set({ status: r.data })
    return r.ok ? r.data : null
  },

  refresh: async () => {
    if (get().refreshing) return
    set({ refreshing: true, progress: 'Подключение…', refreshErrors: [] })
    const r = await window.api.libsource.refresh()
    if (r.ok) set({ status: r.data.status, refreshErrors: r.data.errors })
    else set({ refreshErrors: [r.error] })
    set({ refreshing: false, progress: '' })
  },

  setResult: (r) => set({ lastResult: r })
}))

let inited = false
export function initGithub(): void {
  if (inited) return
  inited = true
  window.api.libsource.onProgress((e) => useGh.setState({ progress: e.text }))
  window.api.libsource.onResult((r) => useGh.setState({ lastResult: r }))
}

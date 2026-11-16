// Пакеты ядер («комплект»): список найденных пакетов и установка из пакета без интернета.
import { create } from 'zustand'
import type { PackInfo, PacksState } from '../../../main/cores/types'
import { useBuild } from './useBuild'
import { useSetup } from './setup'

interface CoresStore {
  state: PacksState | null
  loading: boolean
  error: string | null
  /** Ключ пакета, который ставится прямо сейчас */
  installing: string | null
  refresh: () => Promise<void>
}

export const useCores = create<CoresStore>((set) => ({
  state: null,
  loading: false,
  error: null,
  installing: null,
  refresh: async () => {
    set({ loading: true })
    const r = await window.api.cores.list()
    if (r.ok) set({ state: r.data, loading: false, error: null })
    else set({ loading: false, error: r.error })
  }
}))

const GB = 1024 ** 3
export const fmtBytes = (n: number): string => (n >= GB ? (n / GB).toFixed(1).replace('.', ',') + ' ГБ' : Math.max(1, Math.round(n / 1048576)) + ' МБ')

/** Пакет, из которого можно поставить ядро (новое или обновить до версии комплекта). */
export const packFor = (packs: PackInfo[] | undefined, core: string): PackInfo | undefined =>
  packs?.find((p) => p.coreId === core && (p.status === 'ready' || p.status === 'upgrade'))

/** Честная оценка времени: распаковка ESP32 (≈ 5 ГБ) идёт заметно дольше, чем AVR. */
export const packTime = (p: PackInfo): string => (p.bytes > 500 * 1048576 ? 'обычно 5–15 минут' : 'обычно меньше минуты')

/**
 * Установка ядер из пакетов по очереди: шаги видны в карточке установки (useSetup), ход — в журнале и строке прогресса.
 * Возвращает true, если все установились.
 */
export async function installPacks(list: PackInfo[]): Promise<boolean> {
  const b = useBuild.getState()
  if (b.busy || useSetup.getState().running || list.length === 0) return false
  const steps = list.map((p) => ({ id: p.coreId, label: `Установка ${p.title} ${p.version} из комплекта`, status: 'wait' as 'wait' | 'run' | 'ok' | 'fail' }))
  const patch = (i: number, status: 'run' | 'ok' | 'fail'): void => useSetup.setState((st) => ({ steps: st.steps.map((x, j) => (j === i ? { ...x, status } : x)) }))
  useSetup.setState({ running: true, steps, error: null })
  let good = true
  for (let i = 0; i < list.length; i++) {
    const p = list[i]
    patch(i, 'run')
    useCores.setState({ installing: p.key })
    const d = await useBuild.getState().run(window.api.cores.installPack(p.key), 'core-install', steps[i].label)
    if (!d || d.code !== 0) {
      patch(i, 'fail')
      useSetup.setState({ error: d?.cancelled ? 'Установка отменена.' : 'Не удалось установить ядро из комплекта. Подробности — во вкладке «Вывод».' })
      good = false
      break
    }
    patch(i, 'ok')
  }
  useCores.setState({ installing: null })
  useSetup.setState({ running: false })
  await useBuild.getState().refreshInstalled()
  await useCores.getState().refresh()
  return good
}

export const installFromKit = (p: PackInfo): Promise<boolean> => installPacks([p])

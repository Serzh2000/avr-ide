// Установка базовых ядер «в один клик» (первый запуск). Шаги видны в карточке установки.
import { create } from 'zustand'
import { BASE_CORES } from './boards'
import { useBuild } from './useBuild'

export interface SetupStep { id: string; label: string; status: 'wait' | 'run' | 'ok' | 'fail' }

interface SetupState {
  running: boolean
  steps: SetupStep[]
  error: string | null
}

export const useSetup = create<SetupState>(() => ({ running: false, steps: [], error: null }))

const patch = (id: string, status: SetupStep['status']): void =>
  useSetup.setState((s) => ({ steps: s.steps.map((x) => (x.id === id ? { ...x, status } : x)) }))

/**
 * Устанавливает выбранные ядра. Для ESP предварительно добавляет официальные адреса пакетов
 * в конфиг arduino-cli — вызывать только после явного согласия пользователя.
 */
export async function installBaseCores(ids: string[], addEspUrls: boolean): Promise<boolean> {
  const b = useBuild.getState()
  if (b.busy || useSetup.getState().running) return false
  const needEsp = addEspUrls && ids.some((id) => BASE_CORES.find((c) => c.id === id)?.esp)
  const steps: SetupStep[] = [
    { id: 'index', label: needEsp ? 'Добавление адресов пакетов ESP и обновление индекса' : 'Обновление индекса плат', status: 'wait' },
    ...ids.map((id) => ({ id, label: `Установка ядра ${BASE_CORES.find((c) => c.id === id)?.label ?? id}`, status: 'wait' as const }))
  ]
  useSetup.setState({ running: true, steps, error: null })
  let good = true
  patch('index', 'run')
  const idx = await b.run(needEsp ? window.api.cli.addEspUrls() : window.api.cli.updateIndex(), 'index-update', steps[0].label)
  if (!idx || idx.code !== 0) {
    patch('index', 'fail')
    useSetup.setState({ error: 'Не удалось обновить индекс плат. Проверьте подключение к интернету.' })
    good = false
  } else {
    patch('index', 'ok')
    for (const id of ids) {
      patch(id, 'run')
      const d = await useBuild.getState().run(window.api.cli.installCore(id), 'core-install', `Установка ${id}`)
      if (!d || d.code !== 0) {
        patch(id, 'fail')
        useSetup.setState({ error: d?.cancelled ? 'Установка отменена.' : `Не удалось установить ${id}. Подробности — во вкладке «Вывод».` })
        good = false
        break
      }
      patch(id, 'ok')
    }
  }
  useSetup.setState({ running: false })
  await useBuild.getState().refreshInstalled()
  return good
}

// Для e2e-сценариев (имитация состояний установки)
;(window as unknown as { __avrStores?: Record<string, unknown> }).__avrStores = { ...((window as unknown as { __avrStores?: Record<string, unknown> }).__avrStores ?? {}), useSetup }

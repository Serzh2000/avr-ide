// Состояние «Источников плат» и сценарий подключения/отключения (с обязательным согласием пользователя).
import { create } from 'zustand'
import type { SourceView, SourcesState } from '../../../main/boardsources/types'
import { confirmDialog } from '../shell/dialogs'
import { useUi } from '../shell/ui'
import { useBuild } from './useBuild'

interface SourcesStore {
  state: SourcesState | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export const useSources = create<SourcesStore>((set) => ({
  state: null,
  loading: false,
  error: null,
  refresh: async () => {
    set({ loading: true })
    const r = await window.api.boardsources.list()
    if (r.ok) set({ state: r.data, loading: false, error: null })
    else set({ loading: false, error: r.error })
  }
}))

export interface ConnectTarget { name: string; url: string; https: boolean }

/**
 * Подключение источника: предупреждение → (для http ещё одно) → config add + update-index [+ установка ядра].
 * Возвращает true при успехе, false при ошибке и null при отмене.
 */
export async function connectSource(t: ConnectTarget, installCore?: string, opts: { openOutput?: boolean } = {}): Promise<boolean | null> {
  const first = await confirmDialog({
    title: `Подключить источник «${t.name}»?`,
    message:
      'Это адрес стороннего источника плат. Ядра из него ставят программы и компиляторы на ваш компьютер, ' +
      'поэтому подключайте только те источники, которым доверяете.\n\n' +
      `Адрес будет записан в настройки arduino-cli (board_manager.additional_urls), затем обновится список ядер:\n${t.url}` +
      (installCore ? `\n\nПосле этого сразу установится ядро ${installCore}.` : ''),
    buttons: [{ id: 'ok', label: installCore ? 'Подключить и установить' : 'Подключить', kind: 'primary' }, { id: 'cancel', label: 'Отмена' }]
  })
  if (first !== 'ok') return null
  if (!t.https) {
    const second = await confirmDialog({
      title: 'Адрес без шифрования (http)',
      message:
        'Этот источник работает по http, без шифрования: по пути к вам файлы могут быть подменены. ' +
        'Подключайте его, только если иначе никак, и понимаете риск.',
      buttons: [{ id: 'ok', label: 'Всё равно подключить', kind: 'danger' }, { id: 'cancel', label: 'Отмена', kind: 'primary' }]
    })
    if (second !== 'ok') return null
  }
  if (opts.openOutput !== false) useUi.getState().showBottom('output')
  const d = await useBuild.getState().run(
    window.api.boardsources.connect(t.url, true, !t.https, installCore),
    'index-update',
    installCore ? `Подключение «${t.name}» и установка ${installCore}` : `Подключение «${t.name}»`
  )
  await useSources.getState().refresh()
  return d?.cancelled ? null : d?.code === 0
}

/** Отключение: подтверждение → config remove. Установленные ядра остаются. */
export async function disconnectSource(t: { name: string; url: string }): Promise<boolean> {
  const a = await confirmDialog({
    title: `Отключить источник «${t.name}»?`,
    message:
      'Адрес будет убран из настроек arduino-cli. Уже установленные из него ядра останутся на месте и продолжат работать, ' +
      'но обновить их или найти новые из этого источника не получится, пока он не подключён снова.',
    buttons: [{ id: 'ok', label: 'Отключить', kind: 'danger' }, { id: 'cancel', label: 'Отмена' }]
  })
  if (a !== 'ok') return false
  useUi.getState().showBottom('output')
  const d = await useBuild.getState().run(window.api.boardsources.disconnect(t.url), 'config', `Отключение «${t.name}»`)
  await useSources.getState().refresh()
  return !!d && d.code === 0
}

/** Источник по id ядра (для подписи «откуда ядро»). */
export function sourceOfCore(sources: SourceView[] | undefined, coreId: string): SourceView | undefined {
  return sources?.find((s) => s.cores.some((c) => c.id === coreId))
}

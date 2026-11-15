// Модальные диалоги (подтверждение и ввод строки) в виде промисов. Отрисовывает DialogHost.
import { create } from 'zustand'

export interface DialogButton {
  id: string
  label: string
  kind?: 'primary' | 'danger' | 'default'
}

export type DialogRequest =
  | { type: 'confirm'; title: string; message?: string; buttons: DialogButton[]; resolve: (id: string | null) => void }
  | {
      type: 'prompt'
      title: string
      label?: string
      value: string
      okLabel: string
      validate?: (v: string) => string | null
      resolve: (v: string | null) => void
    }

interface DialogState {
  current: DialogRequest | null
  queue: DialogRequest[]
  push: (r: DialogRequest) => void
  close: () => void
}

export const useDialogs = create<DialogState>((set, get) => ({
  current: null,
  queue: [],
  push: (r) => (get().current ? set({ queue: [...get().queue, r] }) : set({ current: r })),
  close: () => {
    const [next, ...rest] = get().queue
    set({ current: next ?? null, queue: rest })
  }
}))

/** Спрашивает пользователя; возвращает id нажатой кнопки или null (Esc / клик мимо). */
export function confirmDialog(opts: { title: string; message?: string; buttons: DialogButton[] }): Promise<string | null> {
  return new Promise((resolve) => useDialogs.getState().push({ type: 'confirm', ...opts, resolve }))
}

/** Запрашивает строку; null — отмена. */
export function promptDialog(opts: {
  title: string
  label?: string
  value?: string
  okLabel?: string
  validate?: (v: string) => string | null
}): Promise<string | null> {
  return new Promise((resolve) =>
    useDialogs.getState().push({ type: 'prompt', title: opts.title, label: opts.label, value: opts.value ?? '', okLabel: opts.okLabel ?? 'OK', validate: opts.validate, resolve })
  )
}

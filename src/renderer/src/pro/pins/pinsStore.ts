// Состояние конфигуратора «Пины и тактирование»: рабочая копия avride.pins.json, выбор, вкладка, автосохранение.
import { create } from 'zustand'
import type { PinsState } from '../../../../main/pro/pinconfig/ipc'
import { getChip } from '../../../../shared/pro/chipdb'
import type { ChipRecord } from '../../../../shared/pro/chipdb'
import { serializePins } from '../../../../shared/pro/pinconfig/schema'
import type { PinsConfig } from '../../../../shared/pro/pinconfig/types'
import { useProject } from '../../shell/project'
import { useUi } from '../../shell/ui'

export type PinsTab = 'pinout' | 'clock' | 'table'
export type PinsSel = { kind: 'pin'; pin: string } | { kind: 'periph'; name: string } | null

interface PinsStore {
  loading: boolean
  /** Ответ main: чип, наличие файла, HAL … null — ещё не загружено или нет проекта */
  state: PinsState | null
  error: string | null
  cfg: PinsConfig | null
  tab: PinsTab
  sel: PinsSel
  /** Рабочая копия отличается от сохранённой на диске */
  dirty: boolean
  saveError: string | null
  load: () => Promise<void>
  create: () => Promise<void>
  edit: (fn: (c: PinsConfig) => PinsConfig) => void
  setTab: (t: PinsTab) => void
  select: (s: PinsSel) => void
  flush: () => Promise<boolean>
}

let timer: ReturnType<typeof setTimeout> | undefined
let savedText = ''

export const usePins = create<PinsStore>((set, get) => ({
  loading: false, state: null, error: null, cfg: null, tab: 'pinout', sel: null, dirty: false, saveError: null,

  load: async () => {
    if (!useProject.getState().root) { set({ state: null, cfg: null, error: null, sel: null }); return }
    set({ loading: true })
    const r = await window.api.pins.read()
    if (!r.ok) { set({ loading: false, state: null, cfg: null, error: r.error }); return }
    const st = r.data
    const f = st.file
    const cfg = f.exists && f.ok ? f.config : null
    savedText = cfg ? serializePins(cfg) : ''
    // правки пользователя на экране важнее перечитанного файла, пока они не сохранены
    const keep = get().dirty && get().cfg && cfg && get().cfg!.chip === cfg.chip
    set({ loading: false, state: st, error: null, cfg: keep ? get().cfg : cfg, dirty: keep ? true : false, sel: keep ? get().sel : null })
  },

  create: async () => {
    const r = await window.api.pins.defaultConfig()
    if (!r.ok) { useUi.getState().notify(r.error, { kind: 'error' }); return }
    set({ cfg: r.data, dirty: true, sel: null })
    await get().flush()
    await get().load()
  },

  edit: (fn) => {
    const cur = get().cfg
    if (!cur) return
    const next = fn(cur)
    if (next === cur) return
    set({ cfg: next, dirty: serializePins(next) !== savedText, saveError: null })
    clearTimeout(timer)
    timer = setTimeout(() => { void get().flush() }, 700)
  },

  setTab: (t) => set({ tab: t }),
  select: (s) => set({ sel: s }),

  flush: async () => {
    clearTimeout(timer)
    const cfg = get().cfg
    if (!cfg) return true
    const text = serializePins(cfg)
    if (text === savedText) { set({ dirty: false }); return true }
    const r = await window.api.pins.save(cfg)
    if (!r.ok) { set({ saveError: r.error }); return false }
    savedText = text
    set({ dirty: get().cfg ? serializePins(get().cfg!) !== savedText : false, saveError: null })
    void useProject.getState().refreshTree()
    return true
  }
}))

// Открыли другой проект — старую конфигурацию и отложенное сохранение сбрасываем, чтобы они не попали в чужой проект
let lastRoot = useProject.getState().root
useProject.subscribe((s) => {
  if (s.root === lastRoot) return
  lastRoot = s.root
  clearTimeout(timer)
  savedText = ''
  usePins.setState({ state: null, cfg: null, error: null, sel: null, dirty: false, saveError: null })
})

/** Запись базы чипов для текущего состояния. */
export function chipOf(st: PinsState | null): ChipRecord | undefined { return st?.chipId ? getChip(st.chipId) : undefined }

/** Открывает вкладку конфигуратора. */
export function openPins(): void {
  useProject.getState().openPanel('pins')
  void usePins.getState().load()
}

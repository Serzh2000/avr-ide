// Состояние раскладки и настроек интерфейса. Хранится в localStorage (с try/catch).
import { create } from 'zustand'

export type SideView = 'files' | 'search' | 'examples' | 'boards' | 'libs' | 'project' | 'chips'
export type BottomTab = 'output' | 'problems' | 'monitor' | 'plotter' | 'hw' | 'debug' | 'size' | 'swo'
export type Picker = 'board' | 'port' | 'options' | null

export interface NoticeOpts { kind?: 'info' | 'ok' | 'error'; action?: { label: string; run: () => void } }
export interface Notice extends NoticeOpts { text: string; id: number }

export interface Settings {
  fontSize: number
  theme: 'dark' | 'light'
  autosave: boolean
  minimap: boolean
  /** Боковая панель слева — только значки, без подписей */
  compactRail: boolean
  /** Перед «Проверить»/«Загрузить» молча обновлять *_generated.h из сохранённой страницы конструктора. */
  autoRegenPage: boolean
  networkBoardDiscovery: boolean
}

interface Persisted {
  sideView: SideView
  sideVisible: boolean
  sideWidth: number
  bottomVisible: boolean
  bottomHeight: number
  bottomTab: BottomTab
  fqbn: string
  port: string
  settings: Settings
}

const KEY = 'avride.ui.v1'

const DEFAULTS: Persisted = {
  sideView: 'files',
  sideVisible: true,
  sideWidth: 260,
  bottomVisible: true,
  bottomHeight: 230,
  bottomTab: 'output',
  fqbn: 'arduino:avr:uno',
  port: '',
  settings: { fontSize: 14, theme: 'dark', autosave: false, minimap: false, compactRail: false, autoRegenPage: true, networkBoardDiscovery: false }
}

export const lsGet = (key: string): string | null => {
  try { return localStorage.getItem(key) } catch { return null }
}
export const lsSet = (key: string, v: string): void => {
  try { localStorage.setItem(key, v) } catch { /* хранилище недоступно */ }
}

function load(): Persisted {
  try {
    const raw = lsGet(KEY)
    if (!raw) return DEFAULTS
    const j = JSON.parse(raw) as Partial<Persisted>
    return { ...DEFAULTS, ...j, settings: { ...DEFAULTS.settings, ...(j.settings ?? {}) } }
  } catch {
    return DEFAULTS
  }
}

export const clamp = (n: number, a: number, b: number): number => Math.min(b, Math.max(a, n))

interface UiState extends Persisted {
  cursor: { line: number; col: number }
  notice: Notice | null
  palette: null | 'files' | 'commands'
  /** Открыт мастер «Создать проект» */
  wizard: boolean
  picker: Picker
  /** Режим «во весь экран» для вкладки конструктора/справочника (не сохраняется) */
  fullscreen: boolean
  /** Растёт при Ctrl+Shift+F: панель поиска ставит фокус в поле ввода */
  searchNonce: number
  /** Открыто окно «Справка» */
  help: boolean
  /** Номер шага первого тура; null — тур не идёт */
  tour: number | null

  set: (p: Partial<Persisted>) => void
  setSettings: (p: Partial<Settings>) => void
  setCursor: (line: number, col: number) => void
  notify: (text: string, opts?: NoticeOpts) => void
  setPalette: (m: UiState['palette']) => void
  setWizard: (v: boolean) => void
  setPicker: (p: Picker) => void
  setHelp: (v: boolean) => void
  /** Запускает тур с шага n (null — закрыть) */
  setTour: (v: number | null) => void
  setFullscreen: (v: boolean) => void
  showSide: (v: SideView) => void
  /** Открывает панель поиска (без сворачивания при повторном вызове) и просит фокус в поле */
  focusSearch: () => void
  toggleSide: () => void
  showBottom: (t?: BottomTab) => void
  toggleBottom: () => void
}

export const useUi = create<UiState>((set, get) => ({
  ...load(),
  cursor: { line: 1, col: 1 },
  notice: null,
  palette: null,
  wizard: false,
  picker: null,
  fullscreen: false,
  searchNonce: 0,
  help: false,
  tour: null,

  set: (p) => set(p),
  setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
  setCursor: (line, col) => {
    const c = get().cursor
    if (c.line !== line || c.col !== col) set({ cursor: { line, col } })
  },
  notify: (text, opts) => {
    const id = Date.now()
    set({ notice: { text, id, ...opts } })
    setTimeout(() => { if (get().notice?.id === id) set({ notice: null }) }, opts?.action ? 9000 : 5000)
  },
  setPalette: (m) => set({ palette: m }),
  setWizard: (v) => set({ wizard: v }),
  setPicker: (p) => set({ picker: p }),
  setHelp: (v) => set({ help: v }),
  setTour: (v) => set({ tour: v }),
  setFullscreen: (v) => set({ fullscreen: v }),
  showSide: (v) => {
    const s = get()
    // Повторный клик по активному значку сворачивает панель, как в VS Code
    if (s.sideVisible && s.sideView === v) set({ sideVisible: false })
    else set({ sideVisible: true, sideView: v })
  },
  focusSearch: () => set((s) => ({ sideVisible: true, sideView: 'search', searchNonce: s.searchNonce + 1 })),
  toggleSide: () => set((s) => ({ sideVisible: !s.sideVisible })),
  showBottom: (t) => set((s) => ({ bottomVisible: true, bottomTab: t ?? s.bottomTab })),
  toggleBottom: () => set((s) => ({ bottomVisible: !s.bottomVisible }))
}))

let timer: ReturnType<typeof setTimeout> | undefined
useUi.subscribe((s) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    const p: Persisted = {
      sideView: s.sideView, sideVisible: s.sideVisible, sideWidth: s.sideWidth,
      bottomVisible: s.bottomVisible, bottomHeight: s.bottomHeight, bottomTab: s.bottomTab,
      fqbn: s.fqbn, port: s.port, settings: s.settings
    }
    lsSet(KEY, JSON.stringify(p))
  }, 200)
})

/** Применяет тему к документу. */
export function applyTheme(theme: 'dark' | 'light'): void {
  document.documentElement.dataset.theme = theme
}

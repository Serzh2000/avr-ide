// Общий поток данных порта для «Монитора» и «Плоттера»: порт открывается один раз (канал monitor:data).
import { create } from 'zustand'
import { lsGet, lsSet, useUi } from '../shell/ui'
import { useBuild } from './useBuild'
import { LineSplitter, PlotBuffer } from './plotter'

const MAX_TEXT = 200_000
const KEY = 'avride.plot.v1'

export const WINDOWS = [100, 200, 500, 1000, 2000, 5000] as const

/** Буфер точек графика: изменяемый объект вне состояния React; о новых данных сообщает plotVersion. */
export const plot = new PlotBuffer(5000)
const splitter = new LineSplitter()

interface Prefs { windowN: number; auto: boolean }
function loadPrefs(): Prefs {
  try {
    const j = JSON.parse(lsGet(KEY) ?? '{}') as Partial<Prefs>
    return { windowN: (WINDOWS as readonly number[]).includes(j.windowN as number) ? (j.windowN as number) : 500, auto: j.auto !== false }
  } catch { return { windowN: 500, auto: true } }
}

interface MonitorStore {
  text: string
  running: boolean
  baud: number
  plotVersion: number
  /** Пауза графика: абсолютный номер точки, на которой график остановлен (null — идёт) */
  pausedAt: number | null
  windowN: number
  auto: boolean

  start: () => Promise<void>
  stop: () => Promise<void>
  send: (text: string) => Promise<boolean>
  setBaud: (b: number) => void
  note: (t: string) => void
  clearText: () => void
  clearPlot: () => void
  togglePause: () => void
  setWindowN: (n: number) => void
  setAuto: (v: boolean) => void
}

export const useMonitor = create<MonitorStore>((set, get) => ({
  text: '',
  running: false,
  baud: 115200,
  plotVersion: 0,
  pausedAt: null,
  ...loadPrefs(),

  start: async () => {
    const port = useUi.getState().port
    if (!port) { get().note('Выберите порт (кнопка с портом вверху окна).'); return }
    if (get().running) return
    splitter.reset()
    const baud = get().baud
    const r = await window.api.monitor.start(port, baud)
    if (r.ok) { set({ running: true }); get().note(`--- ${port} @ ${baud} ---`) }
    else get().note('Ошибка: ' + r.error)
  },
  stop: async () => { await window.api.monitor.stop() },
  send: async (t) => (get().running ? window.api.monitor.send(t) : false),
  setBaud: (baud) => set({ baud }),
  note: (t) => set((s) => ({ text: s.text + t + '\n' })),
  clearText: () => set({ text: '' }),
  clearPlot: () => { plot.clear(); splitter.reset(); set({ plotVersion: plot.version, pausedAt: null }) },
  togglePause: () => set((s) => ({ pausedAt: s.pausedAt === null ? plot.total : null })),
  setWindowN: (windowN) => set({ windowN }),
  setAuto: (auto) => set({ auto })
}))

let inited = false
/** Подписывается на события порта (один раз за жизнь окна). */
export function initMonitor(): void {
  if (inited) return
  inited = true
  window.api.monitor.onData((e) => {
    const s = useMonitor.getState()
    let text = s.text + e.text
    if (text.length > MAX_TEXT) text = text.slice(text.length - MAX_TEXT)
    if (e.stream === 'stdout' && plot.feed(splitter.push(e.text)) > 0) useMonitor.setState({ text, plotVersion: plot.version })
    else useMonitor.setState({ text })
  })
  window.api.monitor.onClosed(() => useMonitor.setState({ running: false }))
  // Прошивка занимает порт — на время операции порт закрываем
  useBuild.subscribe((b, prev) => { if (b.busy && !prev.busy && useMonitor.getState().running) void window.api.monitor.stop() })
  useMonitor.subscribe((s) => lsSet(KEY, JSON.stringify({ windowN: s.windowN, auto: s.auto })))
}

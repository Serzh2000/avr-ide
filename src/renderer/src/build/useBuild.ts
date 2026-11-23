// Состояние arduino-cli: статус, журнал операций, проблемы сборки, ядра, платы и порты.
import { create } from 'zustand'
import type { BoardEntry, CliStatus, CoreInfo, DoneEvent, EspUrlsStatus, LibInfo, OpKind, PortInfo } from '../../../main/cli/types'
import { parseProblems, parseSize, phaseOf } from '../shell/problems'
import type { Problem, SizeInfo } from '../shell/problems'
import { useUi } from '../shell/ui'

const MAX_LOG = 300_000

export interface BuildSource {
  root: string
  fqbn: string
  revision: number
  /** Порт, с которым запускалась загрузка, либо null для DFU/BOOTSEL. */
  port: string | null
}

export interface BuildResult {
  kind: 'compile' | 'upload'
  ok: boolean
  cancelled: boolean
  size: SizeInfo | null
  at: number
  source?: BuildSource
}

type OpResult = { ok: true; data: { opId: number } } | { ok: false; error: string; notFound?: boolean }

interface BuildStore {
  status: CliStatus | null
  log: string
  busy: boolean
  kind: OpKind | null
  /** Подпись текущего этапа и процент (null — неопределённый прогресс) */
  progress: { label: string; pct: number | null } | null
  /** Время запуска текущей операции (мс), для таймера «Сборка идёт 0:42» */
  startedAt: number | null
  lastDone: DoneEvent | null
  result: BuildResult | null
  problems: Problem[]
  cores: CoreInfo[] | null
  libs: LibInfo[] | null
  boards: BoardEntry[]
  ports: PortInfo[]
  espUrls: EspUrlsStatus | null

  append: (text: string) => void
  clear: () => void
  /** Запускает операцию и ждёт её завершения. null — операция не запустилась (ошибка напечатана в журнал). */
  run: (p: Promise<OpResult>, kind: OpKind, label?: string, context?: ArduinoBuildContext) => Promise<DoneEvent | null>
  cancel: () => void
  recheck: () => Promise<CliStatus>
  refreshInstalled: () => Promise<void>
  refreshPorts: () => Promise<PortInfo[] | null>
}

interface ArduinoBuildContext {
  source: BuildSource
  isCurrent: () => boolean
}

let opText = ''
let currentKind: OpKind | null = null
let currentBuildContext: ArduinoBuildContext | undefined
const waiters = new Map<number, (d: DoneEvent) => void>()
const early = new Map<number, DoneEvent>()

export const useBuild = create<BuildStore>((set, get) => ({
  status: null,
  log: '',
  busy: false,
  kind: null,
  progress: null,
  startedAt: null,
  lastDone: null,
  result: null,
  problems: [],
  cores: null,
  libs: null,
  boards: [],
  ports: [],
  espUrls: null,

  append: (text) => set((s) => {
    const n = s.log + text
    return { log: n.length > MAX_LOG ? n.slice(n.length - MAX_LOG) : n }
  }),
  clear: () => set({ log: '' }),

  run: async (p, kind, label, context) => {
    opText = ''
    currentKind = kind
    currentBuildContext = context
    set({ busy: true, kind, startedAt: Date.now(), progress: { label: label ?? 'Выполняется…', pct: null } })
    if (kind === 'compile' || kind === 'upload') set({ problems: [], result: null })
    const r = await p
    if (!r.ok) {
      currentKind = null
      currentBuildContext = undefined
      set({ busy: false, kind: null, progress: null, startedAt: null })
      get().append(`error: ${r.error}\n`)
      if (r.notFound) void get().recheck()
      return null
    }
    const id = r.data.opId
    const prior = early.get(id)
    if (prior) { early.delete(id); return prior }
    return new Promise<DoneEvent>((resolve) => waiters.set(id, resolve))
  },

  cancel: () => { void window.api.cli.cancel(); void window.api.pro.buildCancel() },

  recheck: async () => {
    const st = await window.api.cli.status()
    set({ status: st })
    if (st.found) {
      void get().refreshInstalled()
      void get().refreshPorts()
    }
    return st
  },

  refreshInstalled: async () => {
    await Promise.all([
      Promise.all([window.api.cli.cores(), window.api.cli.allBoards()]).then(([c, b]) => set((s) => ({
        cores: c.ok ? c.data : s.cores ?? [],
        boards: b.ok ? b.data : s.boards
      }))),
      window.api.cli.installedLibs().then((l) => set((s) => ({ libs: l.ok ? l.data : s.libs ?? [] }))),
      window.api.cli.espUrls().then((u) => { if (u.ok) set({ espUrls: u.data }) })
    ])
  },

  refreshPorts: async () => {
    const network = useUi.getState().settings.networkBoardDiscovery
    const r = await window.api.cli.boards(network)
    if (!r.ok || network !== useUi.getState().settings.networkBoardDiscovery) return null
    set({ ports: r.data })
    return r.data
  }
}))

let inited = false
/** Подписка на события main (один раз за жизнь страницы). */
export function initBuild(): void {
  if (inited) return
  inited = true
  const st = useBuild
  window.api.cli.onLog((e) => {
    const s = st.getState()
    s.append(e.text)
    opText += e.text
    if (e.stream === 'info') return
    for (const line of e.text.split(/\r?\n/)) {
      if (currentKind === 'compile' || currentKind === 'upload') {
        const ph = phaseOf(line)
        if (ph) st.setState({ progress: ph })
        const cnt = /файлов обработано:\s*(\d+)/.exec(line)
        if (cnt) { const cur = st.getState().progress; if (cur) st.setState({ progress: { ...cur, label: cur.label.replace(/ · \d+ файл.*$/, '') + ` · ${cnt[1]} файлов` } }) }
      } else {
        const m = /(\d{1,3}(?:\.\d+)?)%/.exec(line)
        if (m) st.setState({ progress: { label: 'Загрузка и установка', pct: Math.min(100, Number(m[1])) } })
      }
    }
  })
  // Этапы установки из пакета ядра (проверка файлов, копирование) — со своими подписями
  window.api.cores.onProgress((e) => st.setState({ progress: { label: e.label, pct: e.pct } }))
  window.api.cli.onDone((e) => {
    const kind = currentKind ?? e.kind
    const context = currentBuildContext
    currentKind = null
    currentBuildContext = undefined
    const s = st.getState()
    s.append(e.cancelled ? '\n--- Отменено ---\n' : e.code === 0 ? '\n--- Готово ---\n' : `\n--- Ошибка: код завершения ${e.code} ---\n`)
    const patch: Partial<BuildStore> = { busy: false, kind: null, progress: null, startedAt: null, lastDone: e }
    if ((kind === 'compile' || kind === 'upload') && (!context || context.isCurrent())) {
      patch.problems = parseProblems(opText)
      patch.result = { kind, ok: e.code === 0 && !e.cancelled, cancelled: e.cancelled, size: parseSize(opText), at: Date.now(), source: context?.source }
    }
    st.setState(patch)
    if (kind !== 'compile' && kind !== 'upload') void s.refreshInstalled()
    const w = waiters.get(e.opId)
    if (w) { waiters.delete(e.opId); w(e) } else early.set(e.opId, e)
  })
}

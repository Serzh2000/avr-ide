// Состояние прошивки и отладки Pro-режима (renderer): ST-Link, инструменты, ход прошивки, сессия отладки, точки останова, данные панели «Отладка».
// Запись в устройство происходит только по явным действиям пользователя (flash, eraseAll, loadProgram, writeMemory) и только после подтверждения там, где оно нужно.
import { create } from 'zustand'
import type { Breakpoint, DebugEvent, DebugVar, DisasmLine, Probe, StackFrame } from '../../../main/pro/interfaces'
import type { FlashOutcome, SvdInfo, SvdPeripheralBrief, ToolsStatus } from '../../../main/pro/hardware'
import type { InstallPlan } from '../../../main/pro/tools/openocdInstall'
import type { SvdPeripheral } from '../../../main/pro/debug/svd'
import type { FlashError } from '../../../main/pro/openocd/logParse'
import { useBuild } from '../build/useBuild'
import { confirmDialog } from '../shell/dialogs'
import { samePath } from '../shell/problems'
import { useProject } from '../shell/project'
import { lsGet, lsSet, useUi } from '../shell/ui'

const KEY = 'avride.pro.hw.v1'

export interface HwPrefs { speedKhz: number; resetMode: 'normal' | 'under-reset'; verify: boolean; reset: boolean; probeId: string; watches: string[] }
export const SPEEDS = [100, 480, 1800, 4000] as const
const DEFAULT_PREFS: HwPrefs = { speedKhz: 1800, resetMode: 'normal', verify: true, reset: true, probeId: '', watches: [] }

function loadPrefs(): HwPrefs {
  try {
    const j = JSON.parse(lsGet(KEY) ?? '{}') as Partial<HwPrefs>
    return {
      speedKhz: typeof j.speedKhz === 'number' && j.speedKhz > 0 ? j.speedKhz : DEFAULT_PREFS.speedKhz,
      resetMode: j.resetMode === 'under-reset' ? 'under-reset' : 'normal',
      verify: j.verify !== false, reset: j.reset !== false,
      probeId: typeof j.probeId === 'string' ? j.probeId : '',
      watches: Array.isArray(j.watches) ? j.watches.filter((w): w is string => typeof w === 'string').slice(0, 30) : []
    }
  } catch { return DEFAULT_PREFS }
}

export interface Bp { file: string; line: number; id?: number; verified?: boolean; condition?: string }
export type DebugStatus = 'off' | 'starting' | 'running' | 'stopped'
export interface Watch { expr: string; value?: string; error?: string }
export interface SvdState { status: 'idle' | 'none' | 'missing' | 'downloading' | 'loading' | 'ready' | 'error'; info?: SvdInfo; list?: SvdPeripheralBrief[]; error?: string }

interface HwState {
  prefs: HwPrefs
  probes: Probe[]
  probesLoaded: boolean
  tools: ToolsStatus | null
  flash: { status: 'idle' | 'running' | 'ok' | 'error'; label: string; fraction: number; error?: FlashError; wrote?: number; seconds?: number; verified?: boolean; at?: number }
  install: { status: 'idle' | 'planning' | 'confirm' | 'running' | 'error'; plan?: InstallPlan; done?: number; total?: number; error?: string }
  debug: { status: DebugStatus; error?: FlashError; reason?: string; stopFile?: string; stopLine?: number; elf?: string; busy: boolean }
  bps: Bp[]
  stack: StackFrame[]
  frame: number
  locals: DebugVar[]
  regs: Record<string, number>
  prevRegs: Record<string, number>
  watches: Watch[]
  mem: { address: number; bytes: number[] } | null
  disasm: DisasmLine[]
  svd: SvdState
  svdPeriph: SvdPeripheral | null
  svdValues: Record<string, number>

  setPrefs: (p: Partial<HwPrefs>) => void
  refreshProbes: () => Promise<void>
  refreshTools: () => Promise<void>
  pickTool: (tool: 'openocd' | 'arm-none-eabi-gdb') => Promise<void>
  planInstall: () => Promise<void>
  cancelInstall: () => void
  confirmInstall: () => Promise<void>
  flashNow: (config: string) => Promise<void>
  cancelFlash: () => void
  eraseAll: (config: string) => Promise<void>
  startDebug: (config: string) => Promise<void>
  stopDebug: () => Promise<void>
  run: (cmd: 'resume' | 'pause' | 'stepOver' | 'stepInto' | 'stepOut') => Promise<void>
  toggleBreakpoint: (file: string, line: number) => Promise<void>
  addFunctionBreakpoint: (name: string) => Promise<void>
  setCondition: (bp: Bp, condition: string) => Promise<void>
  removeBp: (bp: Bp) => Promise<void>
  selectFrame: (i: number) => Promise<void>
  addWatch: (expr: string) => Promise<void>
  removeWatch: (expr: string) => void
  readMem: (address: number, length?: number) => Promise<void>
  writeMem: (address: number, bytes: number[], what: string) => Promise<boolean>
  loadProgram: () => Promise<void>
  loadSvd: (config: string) => Promise<void>
  downloadSvd: (config: string) => Promise<void>
  openPeripheral: (name: string) => Promise<void>
  readPeripheral: () => Promise<void>
}

const unwrap = <T,>(r: { ok: true; data: T } | { ok: false; error: string }): T => { if (!r.ok) throw new Error(r.error); return r.data }
const fail = (e: unknown): string => (e instanceof Error ? e.message : String(e))
const notify = (t: string, kind: 'ok' | 'error' | 'info' = 'info'): void => useUi.getState().notify(t, kind === 'info' ? undefined : { kind })
const log = (t: string): void => useBuild.getState().append(t + '\n')
const api = (): Window['api']['pro'] => window.api.pro

/** Открывает вкладку нижней панели и делает панель достаточно высокой для карточек и таблиц отладки. */
export function openBottom(tab: 'hw' | 'debug'): void {
  const ui = useUi.getState()
  const want = Math.min(360, Math.round(window.innerHeight * 0.5))
  if (ui.bottomHeight < want) ui.set({ bottomHeight: want })
  ui.showBottom(tab)
}

export const useHw = create<HwState>((set, get) => ({
  prefs: loadPrefs(),
  probes: [],
  probesLoaded: false,
  tools: null,
  flash: { status: 'idle', label: '', fraction: 0 },
  install: { status: 'idle' },
  debug: { status: 'off', busy: false },
  bps: [],
  stack: [], frame: 0, locals: [], regs: {}, prevRegs: {}, watches: loadPrefs().watches.map((expr) => ({ expr })),
  mem: null, disasm: [],
  svd: { status: 'idle' }, svdPeriph: null, svdValues: {},

  setPrefs: (p) => { const prefs = { ...get().prefs, ...p }; set({ prefs }); lsSet(KEY, JSON.stringify(prefs)) },

  refreshProbes: async () => {
    const r = await api().probes()
    set({ probes: r.ok ? r.data : [], probesLoaded: true })
    const { probes, prefs } = get()
    if (probes.length && !probes.some((p) => p.id === prefs.probeId)) get().setPrefs({ probeId: probes[0].id })
  },
  refreshTools: async () => { const r = await api().tools(); if (r.ok) set({ tools: r.data }) },
  pickTool: async (tool) => { const r = await api().pickTool(tool); if (r.ok) set({ tools: r.data }); else notify(r.error, 'error') },

  planInstall: async () => {
    set({ install: { status: 'planning' } })
    const r = await api().openocdPlan()
    set({ install: r.ok ? { status: 'confirm', plan: r.data } : { status: 'error', error: r.error } })
  },
  cancelInstall: () => set({ install: { status: 'idle' } }),
  confirmInstall: async () => {
    const plan = get().install.plan
    if (!plan) return
    set({ install: { status: 'running', plan, done: 0, total: plan.size } })
    const r = await api().openocdInstall(plan.sha256)
    if (r.ok) { set({ install: { status: 'idle' } }); notify('OpenOCD установлен.', 'ok'); await get().refreshTools() }
    else set({ install: { status: 'error', plan, error: r.error } })
  },

  flashNow: async (config) => {
    const { flash, prefs, tools } = get()
    if (flash.status === 'running') return
    if (get().debug.status !== 'off') { notify('Идёт отладка: остановите её перед прошивкой.', 'error'); return }
    if (!tools) await get().refreshTools()
    if (!get().tools?.openocd) { openBottom('hw'); await get().planInstall(); return }
    openBottom('hw')
    set({ flash: { status: 'running', label: 'Подключение к плате', fraction: 0.03 } })
    log('--- Прошивка через ST-Link ---')
    const r = await api().flash({ config, probeId: prefs.probeId || undefined, verify: prefs.verify, reset: prefs.reset, speedKhz: prefs.speedKhz, resetMode: prefs.resetMode })
    if (!r.ok) { set({ flash: { status: 'error', label: '', fraction: 0, error: { kind: 'unknown', title: 'Прошивка не выполнена', hint: r.error } } }); notify(r.error, 'error'); return }
    done(r.data)
  },
  cancelFlash: () => { void api().cancel() },

  eraseAll: async (config) => {
    const { prefs, flash } = get()
    if (flash.status === 'running') return
    const c = await confirmDialog({
      title: 'Стереть всю память микроконтроллера?',
      message: 'Вся прошивка в плате будет удалена безвозвратно (программу придётся прошить заново). Это единственный способ снять защиту от чтения (RDP). Продолжить?',
      buttons: [{ id: 'no', label: 'Отмена' }, { id: 'yes', label: 'Стереть всё', kind: 'danger' }]
    })
    if (c !== 'yes') return
    set({ flash: { status: 'running', label: 'Стирание памяти', fraction: 0.2 } })
    log('--- Стирание Flash ---')
    const r = await api().erase({ config, probeId: prefs.probeId || undefined, speedKhz: prefs.speedKhz, resetMode: prefs.resetMode }, true)
    if (!r.ok) { set({ flash: { status: 'error', label: '', fraction: 0, error: { kind: 'unknown', title: 'Стирание не выполнено', hint: r.error } } }); return }
    if (r.data.ok) { set({ flash: { status: 'ok', label: 'Память стёрта', fraction: 1, at: Date.now() } }); notify('Память микроконтроллера стёрта.', 'ok') }
    else { set({ flash: { status: 'error', label: '', fraction: 0, error: r.data.error } }); notify(r.data.error.title, 'error') }
  },

  startDebug: async (config) => {
    const { debug, prefs } = get()
    if (debug.status !== 'off' || debug.busy) return
    if (get().flash.status === 'running') { notify('Дождитесь окончания прошивки.', 'error'); return }
    if (!get().tools) await get().refreshTools()
    const t = get().tools
    if (!t?.openocd) { openBottom('hw'); await get().planInstall(); return }
    if (!t.gdb) { openBottom('hw'); set({ debug: { status: 'off', busy: false, error: { kind: 'unknown', title: 'Не найден arm-none-eabi-gdb', hint: t.gdbHint } } }); return }
    openBottom('debug')
    set({ debug: { status: 'starting', busy: true } })
    log('--- Запуск отладки ---')
    const r = await api().debugStart({ config, probeId: prefs.probeId || undefined, speedKhz: prefs.speedKhz, resetMode: prefs.resetMode, verify: true })
    if (!r.ok) { set({ debug: { status: 'off', busy: false, error: { kind: 'unknown', title: 'Отладка не запущена', hint: r.error } } }); notify(r.error, 'error'); return }
    if (!r.data.ok) { set({ debug: { status: 'off', busy: false, error: r.data.error } }); notify(r.data.error.title, 'error'); return }
    set({ debug: { status: 'stopped', busy: false, elf: r.data.elf } })
    // Применяем точки останова, расставленные до запуска
    const applied: Bp[] = []
    for (const b of get().bps) {
      const x = await api().debug.setBreakpoint(b.file, b.line, b.condition)
      applied.push(x.ok ? { ...b, id: x.data.id, verified: x.data.verified } : { ...b, id: undefined, verified: false })
    }
    set({ bps: applied })
    await refreshData()
    notify('Отладка запущена: программа остановлена в начале. Запись в плату не выполнялась.', 'ok')
  },

  stopDebug: async () => {
    await api().debugStop()
    resetDebug()
  },

  run: async (cmd) => {
    if (get().debug.status === 'off') return
    if (cmd === 'pause' ? get().debug.status !== 'running' : get().debug.status !== 'stopped') return
    const r = await api().debug.run(cmd)
    if (!r.ok) notify(r.error, 'error')
  },

  toggleBreakpoint: async (file, line) => {
    const cur = get().bps.find((b) => b.line === line && samePath(b.file, file))
    if (cur) { await get().removeBp(cur); return }
    const bp: Bp = { file, line }
    if (get().debug.status === 'off') { set({ bps: [...get().bps, bp] }); return }
    const r = await api().debug.setBreakpoint(file, line)
    if (!r.ok) { notify(r.error, 'error'); return }
    set({ bps: [...get().bps, { ...bp, id: r.data.id, verified: r.data.verified }] })
  },
  addFunctionBreakpoint: async (name) => {
    if (get().debug.status === 'off') { notify('Точку по имени функции можно поставить после запуска отладки.'); return }
    const r = await api().debug.setFunctionBreakpoint(name)
    if (!r.ok) { notify(r.error, 'error'); return }
    set({ bps: [...get().bps, { file: r.data.file, line: r.data.line, id: r.data.id, verified: r.data.verified }] })
  },
  setCondition: async (bp, condition) => {
    // условие задаётся пересозданием точки
    if (bp.id !== undefined && get().debug.status !== 'off') await api().debug.removeBreakpoint(bp.id)
    let next: Bp = { ...bp, condition: condition || undefined, id: undefined }
    if (get().debug.status !== 'off') {
      const r = await api().debug.setBreakpoint(bp.file, bp.line, condition || undefined)
      if (!r.ok) { notify(r.error, 'error'); return }
      next = { ...next, id: r.data.id, verified: r.data.verified }
    }
    set({ bps: get().bps.map((b) => (b === bp ? next : b)) })
  },
  removeBp: async (bp) => {
    if (bp.id !== undefined && get().debug.status !== 'off') { const r = await api().debug.removeBreakpoint(bp.id); if (!r.ok) notify(r.error, 'error') }
    set({ bps: get().bps.filter((b) => b !== bp) })
  },

  selectFrame: async (i) => {
    const r = await api().debug.selectFrame(i)
    if (!r.ok) return
    set({ frame: i })
    const [l, w] = await Promise.all([api().debug.locals(), evalWatches(get().watches)])
    set({ locals: l.ok ? l.data : [], watches: w })
    const f = get().stack[i]
    if (f?.file && f.line) void openAt(f.file, f.line)
  },

  addWatch: async (expr) => {
    const e = expr.trim()
    if (!e || get().watches.some((w) => w.expr === e)) return
    const watches = [...get().watches, { expr: e }]
    set({ watches })
    get().setPrefs({ watches: watches.map((w) => w.expr) })
    if (get().debug.status === 'stopped') set({ watches: await evalWatches(watches) })
  },
  removeWatch: (expr) => {
    const watches = get().watches.filter((w) => w.expr !== expr)
    set({ watches })
    get().setPrefs({ watches: watches.map((w) => w.expr) })
  },

  readMem: async (address, length = 256) => {
    const r = await api().debug.readMemory(address, length)
    if (r.ok) set({ mem: { address, bytes: r.data } })
    else notify(r.error, 'error')
  },
  writeMem: async (address, bytes, what) => {
    const c = await confirmDialog({
      title: 'Записать значение в память устройства?',
      message: `${what}\nАдрес 0x${address.toString(16).toUpperCase()}, значение: ${bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ')}. Запись сразу изменит состояние платы (например, включит или выключит вывод).`,
      buttons: [{ id: 'no', label: 'Отмена' }, { id: 'yes', label: 'Записать', kind: 'primary' }]
    })
    if (c !== 'yes') return false
    const r = await api().debug.writeMemory(address, bytes, true)
    if (!r.ok) { notify(r.error, 'error'); return false }
    return true
  },

  loadProgram: async () => {
    if (get().debug.status !== 'stopped') { notify('Сначала остановите программу (кнопка «Пауза»).'); return }
    const c = await confirmDialog({
      title: 'Загрузить программу в устройство?',
      message: 'Файл .elf будет записан во Flash микроконтроллера и заменит то, что там сейчас. Обычная отладка этого не делает: символы берутся из файла, а в плате остаётся прошивка как есть.',
      buttons: [{ id: 'no', label: 'Отмена' }, { id: 'yes', label: 'Загрузить программу', kind: 'danger' }]
    })
    if (c !== 'yes') return
    const r = await api().debug.loadProgram(true)
    if (r.ok) { notify('Программа загружена в устройство.', 'ok'); await refreshData() } else notify(r.error, 'error')
  },

  loadSvd: async (config) => {
    set({ svd: { status: 'loading' } })
    const i = await api().svdInfo(config)
    if (!i.ok) { set({ svd: { status: 'error', error: i.error } }); return }
    if (!i.data) { set({ svd: { status: 'none' } }); return }
    if (!i.data.cached) { set({ svd: { status: 'missing', info: i.data } }); return }
    const l = await api().svdLoad(config)
    set({ svd: l.ok ? { status: 'ready', info: i.data, list: l.data } : { status: 'error', error: l.error } })
  },
  downloadSvd: async (config) => {
    const info = get().svd.info
    const c = await confirmDialog({
      title: 'Скачать описание регистров (SVD)?',
      message: `Файл ${info?.url.split('/').slice(-2).join('/') ?? ''} (около 1 МБ) будет скачан с github.com/modm-io/cmsis-svd-stm32 (лицензия Apache-2.0) и сохранён в папку данных приложения.`,
      buttons: [{ id: 'no', label: 'Отмена' }, { id: 'yes', label: 'Скачать', kind: 'primary' }]
    })
    if (c !== 'yes') return
    set({ svd: { status: 'downloading', info } })
    const r = await api().svdDownload(config, true)
    if (!r.ok) { set({ svd: { status: 'error', info, error: r.error } }); return }
    await get().loadSvd(config)
  },
  openPeripheral: async (name) => {
    const r = await api().svdPeripheral(name)
    set({ svdPeriph: r.ok ? r.data : null, svdValues: {} })
    if (r.ok && get().debug.status === 'stopped') await get().readPeripheral()
  },
  readPeripheral: async () => {
    const p = get().svdPeriph
    if (!p || get().debug.status !== 'stopped') return
    const vals: Record<string, number> = {}
    for (const reg of p.registers) {
      // регистры данных (DR, RDR…) при чтении меняют состояние периферии (сбрасывают флаги): читаем только по явному клику
      if (SIDE_EFFECT.test(reg.name) || reg.size !== 32) continue
      const r = await api().debug.readMemory(p.base + reg.offset, 4)
      if (r.ok && r.data.length === 4) vals[reg.name] = (r.data[0] | (r.data[1] << 8) | (r.data[2] << 16) | (r.data[3] << 24)) >>> 0
    }
    set({ svdValues: vals })
  }
}))

/** Регистры, чтение которых меняет состояние (очередь приёма, сброс флагов). */
export const SIDE_EFFECT = /^(DR|RDR|RXDR|TDR|JDR\d|FIFO|RXFIFO|CLRFR)$/i

function done(o: FlashOutcome): void {
  if (o.ok) {
    useHw.setState({ flash: { status: 'ok', label: 'Готово', fraction: 1, wrote: o.summary.wroteBytes, seconds: o.summary.seconds, verified: o.summary.verified, at: Date.now() } })
    const bytes = o.summary.wroteBytes ? ` (${o.summary.wroteBytes} байт${o.summary.seconds ? ` за ${o.summary.seconds.toFixed(1).replace('.', ',')} с` : ''}${o.summary.verified ? ', проверка пройдена' : ''})` : ''
    notify('Плата прошита' + bytes, 'ok')
    log('--- Прошивка завершена' + bytes + ' ---')
  } else {
    useHw.setState({ flash: { status: 'error', label: '', fraction: 0, error: o.error } })
    notify(`${o.error.title}. ${o.error.hint}`, 'error')
    log('--- Прошивка не выполнена: ' + o.error.title + ' ---')
  }
}

function resetDebug(): void {
  useHw.setState({
    debug: { status: 'off', busy: false }, stack: [], frame: 0, locals: [], regs: {}, prevRegs: {}, disasm: [], mem: null, svdValues: {},
    bps: useHw.getState().bps.map((b) => ({ ...b, id: undefined, verified: undefined })),
    watches: useHw.getState().watches.map((w) => ({ expr: w.expr }))
  })
}

async function evalWatches(list: Watch[]): Promise<Watch[]> {
  const out: Watch[] = []
  for (const w of list) {
    const r = await api().debug.evaluate(w.expr)
    out.push(r.ok ? { expr: w.expr, value: r.data } : { expr: w.expr, error: r.error })
  }
  return out
}

async function openAt(file: string, line: number): Promise<void> {
  const root = useProject.getState().root
  if (!root) return
  const n = (p: string): string => p.replace(/\\/g, '/').toLowerCase()
  if (!n(file).startsWith(n(root) + '/')) return
  await useProject.getState().openFile(file.replace(/\//g, '\\').replace(/^([a-z]):/, (m) => m.toUpperCase()), { line })
}

/** Подтягивает данные панели «Отладка» после остановки. */
async function refreshData(): Promise<void> {
  const s = useHw.getState()
  const [st, loc, reg, dis] = await Promise.all([api().debug.stack(), api().debug.locals(), api().debug.registers(), api().debug.disassemble(null, 24)])
  const watches = await evalWatches(s.watches)
  useHw.setState({
    stack: st.ok ? st.data : [], frame: 0, locals: loc.ok ? loc.data : [],
    prevRegs: s.regs, regs: reg.ok ? reg.data : {}, disasm: dis.ok ? dis.data : [], watches
  })
  const top = st.ok ? st.data[0] : undefined
  if (top) useHw.setState({ debug: { ...useHw.getState().debug, stopFile: top.file, stopLine: top.line } })
  if (top?.file && top.line) void openAt(top.file, top.line)
  const m = useHw.getState().mem
  if (m) void useHw.getState().readMem(m.address, m.bytes.length)
  if (useHw.getState().svdPeriph) void useHw.getState().readPeripheral()
}

let wired = false
/** Подписки на события main (один раз за жизнь окна). */
export function initHw(): void {
  if (wired) return
  wired = true
  api().onLog((l) => log(l))
  api().onFlashPhase((p) => useHw.setState((s) => (s.flash.status === 'running' ? { flash: { ...s.flash, label: p.label, fraction: p.fraction } } : {})))
  api().onInstallProgress((p) => useHw.setState((s) => (s.install.status === 'running' ? { install: { ...s.install, done: p.done, total: p.total } } : {})))
  api().onDebugEvent((e: DebugEvent) => {
    const d = useHw.getState().debug
    if (e.state === 'exited') { resetDebug(); if (d.status !== 'off') notify('Отладка завершена.'); return }
    if (d.status === 'off') return
    if (e.state === 'running') { useHw.setState({ debug: { ...d, status: 'running', stopFile: undefined, stopLine: undefined } }); return }
    useHw.setState({ debug: { ...d, status: 'stopped', reason: e.reason, stopFile: e.file, stopLine: e.line } })
    void refreshData()
  })
}

export type { Breakpoint }

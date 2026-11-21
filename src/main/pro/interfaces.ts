// Публичные интерфейсы Pro-режима. Их реализуют отдельные этапы:
//   B — BuildProvider (сборка arm-none-eabi-gcc), C — ProgrammerProvider и DebugProvider (ST-Link, OpenOCD/GDB),
//   D — ChipDatabase (данные о кристаллах). Чистые типы без Electron: годятся и для main, и для renderer.
// Все методы асинхронные. Нереализованное поведение — исключение NotImplementedError (см. stubs.ts), его текст можно показывать пользователю.
import type { ProProject } from './project/types'

/** Что есть у любого провайдера. implemented=false у заглушек: интерфейс по этому признаку показывает «ещё не реализовано». */
export interface ProviderInfo {
  readonly id: string
  readonly implemented: boolean
}

/** Контекст операции: открытый проект и выбранная конфигурация. */
export interface ProjectContext {
  /** Абсолютный путь к корню проекта */
  root: string
  project: ProProject
  /** Имя конфигурации из project.configurations (Debug, Release …) */
  configuration: string
}

export interface RunOptions {
  /** Построчный вывод для панели «Вывод» */
  onLog?: (line: string) => void
  signal?: AbortSignal
}

// ---------- B: сборка ----------

export interface Diagnostic {
  severity: 'error' | 'warning' | 'note'
  message: string
  /** Путь относительно корня проекта */
  file?: string
  line?: number
  column?: number
}

export interface BuildPlan {
  /** Папка результатов, относительно корня проекта (соглашение: build/<Configuration>) */
  outDir: string
  /** Файлы, которые будут скомпилированы (относительно корня) */
  sourceFiles: string[]
  compiler: string
  /** Общие ключи компиляции для этой конфигурации */
  cflags: string[]
  ldflags: string[]
}

export interface BuildArtifacts { elf: string; bin?: string; hex?: string; map?: string }

export interface BuildResult {
  ok: boolean
  cancelled?: boolean
  artifacts?: BuildArtifacts
  diagnostics: Diagnostic[]
  durationMs: number
}

export interface SizeReport {
  /** Как у arm-none-eabi-size: text — код и константы, data — инициализированные данные, bss — обнулённые */
  textBytes: number
  dataBytes: number
  bssBytes: number
  /** Flash = text + data, RAM = data + bss */
  flashUsed: number
  ramUsed: number
  flashTotal: number
  ramTotal: number
}

export interface MapSection { name: string; origin: number; size: number; region?: string }
export interface MapSymbol { name: string; size: number; section: string; file?: string }
export interface MapReport { sections: MapSection[]; /** Самые большие символы, по убыванию размера */ topSymbols: MapSymbol[] }

export interface BuildProvider extends ProviderInfo {
  /** Проверяет инструментарий и проект, возвращает план сборки (ничего не компилирует). */
  configure(ctx: ProjectContext): Promise<BuildPlan>
  build(ctx: ProjectContext, opts?: RunOptions): Promise<BuildResult>
  clean(ctx: ProjectContext, opts?: RunOptions): Promise<void>
  /** Размеры секций последней сборки выбранной конфигурации */
  size(ctx: ProjectContext): Promise<SizeReport>
  /** Разбор .map последней сборки */
  map(ctx: ProjectContext): Promise<MapReport>
}

// ---------- C: программатор и отладка ----------

export interface Probe {
  /** Стабильный идентификатор для выбора (серийный номер, если есть) */
  id: string
  kind: 'stlink' | 'jlink' | 'cmsis-dap'
  /** Человекочитаемое имя, например «ST-Link V2-1» */
  name: string
  serial?: string
  /** USB VID:PID, например «0D28:0204» (для диагностики) */
  usbId?: string
  /** Состояние драйвера Windows: ok — OpenOCD сможет открыть устройство; missing — устройство видно, но драйвера (WinUSB / ST-Link) нет */
  driver?: 'ok' | 'missing' | 'unknown'
  /** Есть виртуальный COM-порт (ST-Link V2-1 и V3 на Nucleo): им можно пользоваться как UART-монитором */
  vcp?: boolean
}

export interface FlashOptions {
  /** Путь к .elf/.bin/.hex (абсолютный) */
  file: string
  /** Для .bin: адрес записи, hex-строка (по умолчанию начало Flash из проекта) */
  address?: string
  verify?: boolean
  reset?: boolean
  /** Скорость SWD, кГц (по умолчанию 1800) */
  speedKhz?: number
  /** under-reset — подключаться при удержании NRST (для плат, где прошивка отключает SWD) */
  resetMode?: 'normal' | 'under-reset'
  /** Фаза операции для индикатора: подключение, запись, проверка, перезапуск */
  onPhase?: (phase: string, label: string, fraction: number) => void
}

export interface GdbServerHandle {
  /** TCP-порт GDB-сервера на localhost */
  port: number
  stop(): Promise<void>
}

export interface ProgrammerProvider extends ProviderInfo {
  listProbes(): Promise<Probe[]>
  flash(ctx: ProjectContext, probe: Probe | null, opts: FlashOptions & RunOptions): Promise<void>
  /** mass=true — полное стирание кристалла, иначе только страницы под прошивку */
  erase(ctx: ProjectContext, probe: Probe | null, opts: { mass?: boolean } & RunOptions): Promise<void>
  startGdbServer(ctx: ProjectContext, probe: Probe | null, opts?: RunOptions): Promise<GdbServerHandle>
}

export type DebugState = 'running' | 'stopped' | 'exited'
export interface DebugEvent { state: DebugState; reason?: string; file?: string; line?: number }
export interface Breakpoint {
  id: number; file: string; line: number; verified: boolean
  /** Точка по имени функции */
  function?: string
  condition?: string
  address?: number
}
export interface DebugVar { name: string; value: string; type?: string }
export interface DisasmLine { address: number; text: string; func?: string; offset?: number }
export interface StackFrame { index: number; function: string; file?: string; line?: number; pc: number }

export interface DebugSession {
  readonly id: string
  onEvent(cb: (e: DebugEvent) => void): () => void
  /** Вывод консоли GDB и сообщения (для панели «Вывод») */
  onLog(cb: (line: string) => void): () => void
  state(): DebugState
  resume(): Promise<void>
  pause(): Promise<void>
  stepOver(): Promise<void>
  stepInto(): Promise<void>
  stepOut(): Promise<void>
  /** Аппаратная точка по строке файла (путь относительно проекта или абсолютный) */
  setBreakpoint(file: string, line: number, opts?: { condition?: string }): Promise<Breakpoint>
  setFunctionBreakpoint(name: string, opts?: { condition?: string }): Promise<Breakpoint>
  removeBreakpoint(id: number): Promise<void>
  listBreakpoints(): Promise<Breakpoint[]>
  stack(): Promise<StackFrame[]>
  selectFrame(index: number): Promise<void>
  locals(): Promise<DebugVar[]>
  /** Вычисляет выражение в выбранном кадре (watch) */
  evaluate(expr: string): Promise<string>
  readRegisters(): Promise<Record<string, number>>
  readMemory(address: number, length: number): Promise<Uint8Array>
  /** Запись в память или регистр периферии — только после подтверждения пользователя в интерфейсе */
  writeMemory(address: number, bytes: Uint8Array): Promise<void>
  disassemble(address: number | null, count: number): Promise<DisasmLine[]>
  /** Запись ELF во Flash (gdb load) — ЕДИНСТВЕННЫЙ способ изменить память кода; вызывать только по явной кнопке с подтверждением */
  loadProgram(): Promise<void>
  stop(): Promise<void>
}

export interface DebugProvider extends ProviderInfo {
  /** Запускает GDB-сервер, загружает ELF выбранной конфигурации и останавливается на main. */
  launch(ctx: ProjectContext, probe: Probe | null, opts?: RunOptions): Promise<DebugSession>
}

// ---------- D: база чипов ----------

export interface ChipSummary {
  /** Идентификатор в базе, например «stm32f103c8» */
  id: string
  /** Полное обозначение, например «STM32F103C8T6» */
  name: string
  family: string
  core: string
  flashBytes: number
  ramBytes: number
  package?: string
}

export interface PinFunction {
  /** Периферия и сигнал, например «USART1_TX», «TIM2_CH1», «ADC1_IN0», «GPIO» */
  signal: string
  /** Номер альтернативной функции (AFn) для серий, где он есть */
  af?: number
}
/** Ключ — имя вывода порта («PA9»), значение — доступные функции */
export type PinFunctionMap = Record<string, PinFunction[]>

export interface MemoryRegionInfo { name: string; origin: number; size: number; kind: 'flash' | 'ram' | 'other' }
export interface MemoryMap { regions: MemoryRegionInfo[] }

export interface ChipInfo extends ChipSummary {
  /** Макрос устройства CMSIS, например «STM32F103xB» */
  deviceDefine?: string
  startupFile?: string
  svdFile?: string
  openocdTarget?: string
  memory: MemoryMap
  /** Откуда взяты данные (ссылки на первоисточники) */
  sources: string[]
}

export interface ChipQuery { text?: string; family?: string }

export interface ChipDatabase extends ProviderInfo {
  getChip(id: string): Promise<ChipInfo | null>
  listChips(query?: ChipQuery): Promise<ChipSummary[]>
  pinFunctions(chipId: string): Promise<PinFunctionMap>
  memoryMap(chipId: string): Promise<MemoryMap>
}

export type ProviderKind = 'build' | 'programmer' | 'debug' | 'chips'
export interface ProviderMap {
  build: BuildProvider
  programmer: ProgrammerProvider
  debug: DebugProvider
  chips: ChipDatabase
}
/** Что реализовано сейчас — для интерфейса (кнопки «Собрать», «Прошить», «Отладка»). */
export type ProviderStatus = Record<ProviderKind, { id: string; implemented: boolean }>

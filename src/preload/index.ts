import { contextBridge, ipcRenderer } from 'electron'
import type { BoardDetails, BoardEntry, CliResult, CliStatus, CoreInfo, DoneEvent, EspUrlsStatus, LibInfo, LogEvent, MonitorDataEvent, PortInfo } from '../main/cli/types'
import type { ProjectInfo, RecentItem, TreeNode } from '../main/files/types'
import type { CatalogStatus, InstallResult, RefKind, RefList, RefreshProgress, SearchResult } from '../main/libsource/types'
import type { CatalogHit, CoreSearchResult, Ide2Import, SourcesState, UrlCheck } from '../main/boardsources/types'
import type { PackProgressEvent, PacksState } from '../main/cores/types'
import type { ExamplePreview, ExamplesList } from '../main/examples/scan'
import type { ReplaceResponse, SearchResponse } from '../main/files/search'
import type { SearchOptions } from '../main/files/searchcore'
import type { LibsForSketchOptions, ProjectLibrary } from '../main/libs/types'
import type { ProActionKind, ProActionResult, ProReadResult } from '../main/pro/ipc'
import type { BuildReportDto, PreflightResult, ProProgressEvent, SupportStatus, ToolchainStatus } from '../main/pro/build/types'
import type { ProProject } from '../main/pro/project/types'
import type { Breakpoint, DebugEvent, DebugState, DebugVar, DisasmLine, Probe, ProviderStatus, StackFrame } from '../main/pro/interfaces'
import type { FlashOutcome, FlashRequest, SvdInfo, SvdPeripheralBrief, SwoOutcome, SwoRequest, ToolsStatus } from '../main/pro/hardware'
import type { SwoChunk } from '../main/pro/openocd/swo'
import type { InstallPlan } from '../main/pro/tools/openocdInstall'
import type { PinsState, PinsPlanDto } from '../main/pro/pinconfig/ipc'
import type { PinsConfig } from '../shared/pro/pinconfig/types'
import type { GenNote } from '../shared/pro/pinconfig/gen/support'
import type { SvdPeripheral } from '../main/pro/debug/svd'
import type { FlashError } from '../main/pro/openocd/logParse'

type Op = Promise<CliResult<{ opId: number }>>

/** Подписка на событие main → renderer; возвращает функцию отписки. */
function on<T>(channel: string, cb: (p: T) => void): () => void {
  const h = (_e: unknown, p: T): void => cb(p)
  ipcRenderer.on(channel, h)
  return () => ipcRenderer.removeListener(channel, h)
}

const inv = <T>(channel: string, ...a: unknown[]): Promise<CliResult<T>> => ipcRenderer.invoke(channel, ...a)

const api = {
  app: {
    quit: (): Promise<boolean> => ipcRenderer.invoke('app:quit'),
    /** Открывает страницу репозитория проекта в браузере: repo, readme или issues */
    /** Показывает файл или папку в проводнике (путь должен существовать) */
    revealPath: (p: string): Promise<boolean> => ipcRenderer.invoke('app:reveal-path', p),
    openHelpLink: (kind: 'repo' | 'readme' | 'issues'): Promise<boolean> => ipcRenderer.invoke('app:open-help-link', kind),
    /** true в автотестах (AVRIDE_E2E=1): первый тур и подобные подсказки не показываются */
    isE2E: process.env['AVRIDE_E2E'] === '1',
    onCloseRequest: (cb: () => void) => on<null>('app:close-request', () => cb())
  },

  project: {
    pickOpen: () => inv<ProjectInfo | null>('project:pick-open'),
    pickFile: () => inv<{ project: ProjectInfo; file: string } | null>('project:pick-file'),
    open: (path: string) => inv<ProjectInfo>('project:open', path),
    close: () => inv<boolean>('project:close'),
    tree: () => inv<TreeNode[]>('project:tree'),
    recent: () => inv<RecentItem[]>('project:recent'),
    removeRecent: (path: string) => inv<boolean>('project:recent-remove', path),
    sketchbook: () => inv<string>('project:sketchbook'),
    pickSketchbook: () => inv<string | null>('project:pick-sketchbook'),
    pickFolder: () => inv<string | null>('project:pick-folder'),
    suggestName: (parent?: string) => inv<string>('project:suggest-name', parent),
    /** Ошибка имени нового проекта (формат, занятая папка) или null, если имя свободно. */
    checkName: (name: string, parent?: string) => inv<string | null>('project:check-name', name, parent),
    /** Мастер: создаёт Имя/Имя.ino и sketch.yaml с default_fqbn, открывает проект. */
    create: (name: string, parent: string | undefined, fqbn: string | null) => inv<ProjectInfo>('project:create', name, parent, fqbn),
    /** Записывает default_fqbn в sketch.yaml открытого проекта. */
    setBoard: (fqbn: string) => inv<boolean>('project:set-board', fqbn)
  },

  pins: {
    /** Конфигуратор выводов и тактирования: файл avride.pins.json, чип проекта, наличие HAL, текст main.c */
    read: () => inv<PinsState>('pins:read'),
    defaultConfig: (pkg?: string) => inv<PinsConfig>('pins:default', pkg),
    save: (cfg: PinsConfig) => inv<{ path: string }>('pins:save', cfg),
    plan: (cfg: PinsConfig) => inv<PinsPlanDto>('pins:plan', cfg),
    generate: (cfg: PinsConfig) => inv<{ written: string[]; unchanged: string[]; notes: GenNote[] }>('pins:generate', cfg)
  },

  pro: {
    /** Какие части Pro-режима реализованы (заглушки или настоящие провайдеры) */
    providers: () => inv<ProviderStatus>('pro:providers'),
    /** Умный редактор Pro: запросы к индексу символов C/C++ (дополнение, hover, переход, ссылки, переименование, поиск, форматирование) */
    sym: <T = unknown>(kind: string, args?: Record<string, unknown>) => inv<T>('pro:sym', kind, args ?? {}),
    /** avride.project.json открытой папки: найден ли и корректен ли */
    readProject: () => inv<ProReadResult>('pro:read-project'),
    /** Создаёт папку проекта (структура, avride.project.json) и открывает её в main; дальше renderer вызывает project.open */
    create: (name: string, parent: string | undefined, chip: string, template: 'empty' | 'blink' | 'swo') => inv<{ root: string; mainFile: string; needsSupport?: boolean }>('pro:create', name, parent, chip, template),
    /** Сборка, очистка, прошивка, отладка выбранной конфигурации (пока — понятная ошибка «не реализовано») */
    action: (kind: ProActionKind, configuration: string) => inv<ProActionResult>('pro:action', kind, configuration),
    /** Компилятор ARM: найден ли, где, сведения о пакете для установки одной кнопкой */
    toolchain: () => inv<ToolchainStatus>('pro:toolchain'),
    /** Диалог выбора папки с компилятором; путь сохраняется только если там найден рабочий arm-none-eabi-gcc */
    toolchainPick: () => inv<ToolchainStatus>('pro:toolchain-pick'),
    toolchainClear: () => inv<ToolchainStatus>('pro:toolchain-clear'),
    toolchainUninstall: () => inv<ToolchainStatus>('pro:toolchain-uninstall'),
    /** Скачать и установить компилятор (после подтверждения в интерфейсе); ход — cli:log / cli:done / pro:progress */
    toolchainInstall: (): Op => ipcRenderer.invoke('pro:toolchain-install'),
    /** Проверка перед сборкой: чего не хватает (компилятор, файлы CMSIS, скрипт компоновки) */
    preflight: (configuration: string) => inv<PreflightResult>('pro:preflight', configuration),
    support: () => inv<SupportStatus>('pro:support'),
    supportInstall: (): Op => ipcRenderer.invoke('pro:support-install'),
    /** Сборка выбранной конфигурации; журнал идёт в cli:log, завершение — cli:done */
    build: (configuration: string): Op => ipcRenderer.invoke('pro:build', configuration),
    buildCancel: (): Promise<boolean> => ipcRenderer.invoke('pro:build-cancel'),
    clean: (configuration: string) => inv<{ message: string }>('pro:clean', configuration),
    /** Размеры, использование Flash/RAM, секции и крупнейшие символы последней сборки */
    report: (configuration: string) => inv<BuildReportDto>('pro:report', configuration),
    generateLinker: (force: boolean) => inv<{ path: string; replaced: boolean }>('pro:generate-linker', force),
    exportBuild: (overwrite: boolean) => inv<{ files: string[] }>('pro:export-build', overwrite),
    saveProject: (project: ProProject) => inv<{ warnings: number }>('pro:save-project', project),
    onProgress: (cb: (e: ProProgressEvent) => void) => on<ProProgressEvent>('pro:progress', cb),
    /** Подключённые ST-Link (список USB-устройств, без обращения к ним) */
    probes: () => inv<Probe[]>('pro:probes'),
    tools: () => inv<ToolsStatus>('pro:tools'),
    /** Диалог выбора программы (openocd / arm-none-eabi-gdb) */
    pickTool: (tool: 'openocd' | 'arm-none-eabi-gdb') => inv<ToolsStatus>('pro:tool-pick', tool),
    /** Что будет скачано для установки OpenOCD (имя, размер, источник, SHA-256); ничего не загружает */
    openocdPlan: () => inv<InstallPlan>('pro:openocd-plan'),
    /** Скачать и установить OpenOCD; sha256 — из плана, показанного пользователю */
    openocdInstall: (sha256: string) => inv<{ path: string }>('pro:openocd-install', sha256),
    onInstallProgress: (cb: (p: { done: number; total: number }) => void) => on<{ done: number; total: number }>('pro:install-progress', cb),
    /** Прошивка ELF выбранной конфигурации (по явной кнопке) */
    flash: (req: FlashRequest) => inv<FlashOutcome>('pro:flash', req),
    cancel: () => inv<boolean>('pro:cancel'),
    /** Стирание всей памяти: confirm должен быть true (подтверждение пользователя) */
    erase: (req: FlashRequest, confirm: boolean) => inv<FlashOutcome>('pro:erase', req, confirm),
    onLog: (cb: (line: string) => void) => on<string>('pro:log', cb),
    onFlashPhase: (cb: (p: { phase: string; label: string; fraction: number }) => void) => on<{ phase: string; label: string; fraction: number }>('pro:flash-phase', cb),
    /** Приём SWO/ITM: запуск и остановка отдельного OpenOCD; данные — onSwoData, состояние — onSwoState */
    swoStart: (req: SwoRequest) => inv<SwoOutcome>('pro:swo-start', req),
    swoStop: () => inv<boolean>('pro:swo-stop'),
    /** Сохранить текст консоли SWO в файл (диалог); path=null — отмена */
    swoSave: (text: string) => inv<{ path: string | null }>('pro:swo-save', text),
    onSwoData: (cb: (c: SwoChunk) => void) => on<SwoChunk>('pro:swo-data', cb),
    onSwoState: (cb: (s: { running: boolean; reason?: string }) => void) => on<{ running: boolean; reason?: string }>('pro:swo-state', cb),
    debugStart: (req: FlashRequest & { stopAtMain?: boolean }) => inv<{ ok: true; elf: string; id: string } | { ok: false; error: FlashError }>('pro:debug-start', req),
    debugStop: () => inv<boolean>('pro:debug-stop'),
    onDebugEvent: (cb: (e: DebugEvent) => void) => on<DebugEvent>('pro:debug-event', cb),
    debug: {
      run: (cmd: 'resume' | 'pause' | 'stepOver' | 'stepInto' | 'stepOut') => inv<null>('pro:debug-cmd', cmd, {}),
      state: () => inv<DebugState>('pro:debug-cmd', 'state', {}),
      setBreakpoint: (file: string, line: number, condition?: string) => inv<Breakpoint>('pro:debug-cmd', 'setBreakpoint', { file, line, condition }),
      setFunctionBreakpoint: (name: string, condition?: string) => inv<Breakpoint>('pro:debug-cmd', 'setFunctionBreakpoint', { name, condition }),
      removeBreakpoint: (id: number) => inv<null>('pro:debug-cmd', 'removeBreakpoint', { id }),
      listBreakpoints: () => inv<Breakpoint[]>('pro:debug-cmd', 'listBreakpoints', {}),
      stack: () => inv<StackFrame[]>('pro:debug-cmd', 'stack', {}),
      selectFrame: (index: number) => inv<null>('pro:debug-cmd', 'selectFrame', { index }),
      locals: () => inv<DebugVar[]>('pro:debug-cmd', 'locals', {}),
      evaluate: (expr: string) => inv<string>('pro:debug-cmd', 'evaluate', { expr }),
      registers: () => inv<Record<string, number>>('pro:debug-cmd', 'registers', {}),
      readMemory: (address: number, length: number) => inv<number[]>('pro:debug-cmd', 'readMemory', { address, length }),
      /** Запись в память/регистр устройства: confirm=true только после подтверждения пользователя */
      writeMemory: (address: number, bytes: number[], confirm: boolean) => inv<null>('pro:debug-cmd', 'writeMemory', { address, bytes, confirm }),
      disassemble: (address: number | null, count: number) => inv<DisasmLine[]>('pro:debug-cmd', 'disassemble', { address, count }),
      /** Запись программы во Flash (gdb load): confirm=true только после подтверждения пользователя */
      loadProgram: (confirm: boolean) => inv<null>('pro:debug-cmd', 'loadProgram', { confirm })
    },
    targetInfo: (config: string) => inv<{ openocdTarget: string | null; chip: string; elf: string | null; programmer: 'stlink' | 'jlink' | 'cmsis-dap'; sysclkHz: number | null }>('pro:target-info', config),
    svdInfo: (config: string) => inv<SvdInfo | null>('pro:svd-info', config),
    svdDownload: (config: string, confirm: boolean) => inv<SvdInfo>('pro:svd-download', config, confirm),
    svdLoad: (config: string) => inv<SvdPeripheralBrief[]>('pro:svd-load', config),
    svdPeripheral: (name: string) => inv<SvdPeripheral>('pro:svd-peripheral', name)
  },

  libs: {
    /** Библиотеки, подключённые в скетче (#include), с разобранными функциями. */
    forSketch: (code: string, options?: LibsForSketchOptions) => inv<ProjectLibrary[]>('libs:for-sketch', code, options)
  },

  libsource: {
    status: () => inv<CatalogStatus>('libsource:status'),
    refresh: () => inv<{ status: CatalogStatus; errors: string[] }>('libsource:refresh'),
    search: (q: string, offset = 0, limit = 100) => inv<SearchResult>('libsource:search', q, offset, limit),
    refs: (owner: string, repo: string, force = false) => inv<RefList>('libsource:refs', owner, repo, force),
    install: (owner: string, repo: string, kind: RefKind, ref?: string): Op => ipcRenderer.invoke('libsource:install', owner, repo, kind, ref),
    installDeps: (names: string[]): Op => ipcRenderer.invoke('libsource:install-deps', names),
    setConsent: (v: boolean): Promise<boolean> => ipcRenderer.invoke('libsource:set-consent', v),
    setToken: (t: string | null) => inv<boolean>('libsource:set-token', t),
    addCustom: (input: string) => inv<{ id: string }>('libsource:custom-add', input),
    removeCustom: (owner: string, repo: string): Promise<boolean> => ipcRenderer.invoke('libsource:custom-remove', owner, repo),
    openRepo: (owner: string, repo: string): Promise<boolean> => ipcRenderer.invoke('libsource:open', owner, repo),
    onProgress: (cb: (e: RefreshProgress) => void) => on<RefreshProgress>('libsource:progress', cb),
    onResult: (cb: (e: InstallResult) => void) => on<InstallResult>('libsource:result', cb)
  },

  boardsources: {
    list: () => inv<SourcesState>('bsrc:list'),
    /** Скачивает и разбирает индекс по адресу, ничего не меняя в настройках. */
    check: (url: string) => inv<UrlCheck>('bsrc:check', url),
    /** Подключает источник (после подтверждения в интерфейсе); installCore — сразу поставить ядро. */
    connect: (url: string, ack: boolean, ackHttp: boolean, installCore?: string): Op => ipcRenderer.invoke('bsrc:connect', url, ack, ackHttp, installCore),
    disconnect: (url: string): Op => ipcRenderer.invoke('bsrc:disconnect', url),
    searchCores: (q: string) => inv<CoreSearchResult>('bsrc:search', q),
    catalogSearch: (q: string) => inv<CatalogHit[]>('bsrc:catalog-search', q),
    /** Адреса источников из настроек Arduino IDE 2 (только чтение, ничего не подключается). */
    ide2Urls: () => inv<Ide2Import>('bsrc:ide2-urls')
  },

  cores: {
    /** Пакеты ядер: встроенные в IDE и найденные рядом с установщиком / в выбранных папках */
    list: () => inv<PacksState>('cores:list'),
    /** Диалог выбора папки с пакетом ядра; возвращает выбранную папку (null — отмена) */
    addFolder: () => inv<string | null>('cores:add-folder'),
    clearFolders: (): Promise<boolean> => ipcRenderer.invoke('cores:clear-folders'),
    /** Установка ядра из пакета без интернета; ход — в потоке cli:log / cli:done и cores:progress */
    installPack: (key: string): Op => ipcRenderer.invoke('cores:install-pack', key),
    onProgress: (cb: (e: PackProgressEvent) => void) => on<PackProgressEvent>('cores:progress', cb)
  },

  examples: {
    list: (force = false) => inv<ExamplesList>('examples:list', force),
    preview: (id: string) => inv<ExamplePreview>('examples:preview', id),
    suggestName: (id: string, label: string) => inv<string>('examples:suggest-name', id, label),
    /** Копирует пример в папку скетчей под именем name и открывает как проект. */
    copy: (id: string, name: string) => inv<ProjectInfo>('examples:copy', id, name)
  },

  search: {
    run: (query: string, options: SearchOptions) => inv<SearchResponse>('search:run', query, options),
    replace: (query: string, options: SearchOptions, replacement: string, paths: string[]) => inv<ReplaceResponse>('search:replace', query, options, replacement, paths)
  },

  fs: {
    read: (path: string) => inv<{ content: string; mtime: number }>('fs:read', path),
    write: (path: string, content: string) => inv<{ mtime: number }>('fs:write', path, content),
    mtimes: (paths: string[]) => inv<Record<string, number | null>>('fs:mtimes', paths),
    create: (path: string, kind: 'file' | 'dir') => inv<string>('fs:create', path, kind),
    rename: (path: string, newName: string) => inv<string>('fs:rename', path, newName),
    trash: (path: string) => inv<boolean>('fs:delete', path),
    reveal: (path: string) => inv<boolean>('fs:reveal', path),
    writeSketchFile: (name: string, content: string) => inv<string>('fs:write-sketch-file', name, content)
  },

  cli: {
    status: (): Promise<CliStatus> => ipcRenderer.invoke('cli:status'),
    boards: (): Promise<CliResult<PortInfo[]>> => ipcRenderer.invoke('cli:boards'),
    allBoards: (): Promise<CliResult<BoardEntry[]>> => ipcRenderer.invoke('cli:board-listall'),
    boardDetails: (fqbn: string): Promise<CliResult<BoardDetails>> => ipcRenderer.invoke('cli:board-details', fqbn),
    cores: (): Promise<CliResult<CoreInfo[]>> => ipcRenderer.invoke('cli:cores'),
    searchCores: (q: string): Promise<CliResult<CoreInfo[]>> => ipcRenderer.invoke('cli:core-search', q),
    searchLibs: (q: string): Promise<CliResult<LibInfo[]>> => ipcRenderer.invoke('cli:lib-search', q),
    installedLibs: (): Promise<CliResult<LibInfo[]>> => ipcRenderer.invoke('cli:lib-list'),
    espUrls: (): Promise<CliResult<EspUrlsStatus>> => ipcRenderer.invoke('cli:esp-urls-status'),
    installCore: (id: string): Op => ipcRenderer.invoke('cli:core-install', id),
    upgradeCore: (id: string): Op => ipcRenderer.invoke('cli:core-upgrade', id),
    uninstallCore: (id: string): Op => ipcRenderer.invoke('cli:core-uninstall', id),
    installLib: (name: string): Op => ipcRenderer.invoke('cli:lib-install', name),
    upgradeLib: (name: string): Op => ipcRenderer.invoke('cli:lib-upgrade', name),
    uninstallLib: (name: string): Op => ipcRenderer.invoke('cli:lib-uninstall', name),
    updateIndex: (): Op => ipcRenderer.invoke('cli:update-index'),
    addEspUrls: (): Op => ipcRenderer.invoke('cli:add-esp-urls'),
    pickPath: (): Promise<CliResult<string | null>> => ipcRenderer.invoke('cli:pick-path'),
    resetPath: (): Promise<boolean> => ipcRenderer.invoke('cli:reset-path'),
    compile: (path: string, fqbn: string): Op => ipcRenderer.invoke('cli:compile', path, fqbn),
    upload: (path: string, fqbn: string, port: string | null): Op => ipcRenderer.invoke('cli:upload', path, fqbn, port),
    cancel: (): Promise<boolean> => ipcRenderer.invoke('cli:cancel'),
    onLog: (cb: (e: LogEvent) => void) => on<LogEvent>('cli:log', cb),
    onDone: (cb: (e: DoneEvent) => void) => on<DoneEvent>('cli:done', cb)
  },

  monitor: {
    start: (port: string, baud: number): Promise<CliResult<null>> => ipcRenderer.invoke('monitor:start', port, baud),
    send: (text: string): Promise<boolean> => ipcRenderer.invoke('monitor:send', text),
    stop: (): Promise<boolean> => ipcRenderer.invoke('monitor:stop'),
    onData: (cb: (e: MonitorDataEvent) => void) => on<MonitorDataEvent>('monitor:data', cb),
    onClosed: (cb: () => void) => on<null>('monitor:closed', () => cb())
  }
}
contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api

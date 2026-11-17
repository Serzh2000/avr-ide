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

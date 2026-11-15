import { contextBridge, ipcRenderer } from 'electron'
import type { BoardEntry, CliResult, CliStatus, CoreInfo, DoneEvent, EspUrlsStatus, LibInfo, LogEvent, MonitorDataEvent, PortInfo } from '../main/cli/types'
import type { ProjectInfo, RecentItem, TemplateInfo, TreeNode } from '../main/files/types'
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
    templates: () => inv<TemplateInfo[]>('project:templates'),
    sketchbook: () => inv<string>('project:sketchbook'),
    pickSketchbook: () => inv<string | null>('project:pick-sketchbook'),
    pickFolder: () => inv<string | null>('project:pick-folder'),
    suggestName: (parent?: string) => inv<string>('project:suggest-name', parent),
    create: (template: string, name: string, parent?: string) => inv<ProjectInfo>('project:create', template, name, parent)
  },

  libs: {
    /** Библиотеки, подключённые в скетче (#include), с разобранными функциями. */
    forSketch: (code: string, options?: LibsForSketchOptions) => inv<ProjectLibrary[]>('libs:for-sketch', code, options)
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
    upload: (path: string, fqbn: string, port: string): Op => ipcRenderer.invoke('cli:upload', path, fqbn, port),
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

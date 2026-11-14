import { contextBridge, ipcRenderer } from 'electron'
import type { CliResult, CliStatus, CoreInfo, DoneEvent, LibInfo, LogEvent, MonitorDataEvent, PortInfo } from '../main/cli/types'

type Op = Promise<CliResult<{ opId: number }>>

/** Подписка на событие main → renderer; возвращает функцию отписки. */
function on<T>(channel: string, cb: (p: T) => void): () => void {
  const h = (_e: unknown, p: T): void => cb(p)
  ipcRenderer.on(channel, h)
  return () => ipcRenderer.removeListener(channel, h)
}

const api = {
  openFile: (): Promise<{ path: string; content: string } | null> => ipcRenderer.invoke('file:open'),
  saveFile: (path: string | null, content: string, saveAs?: boolean): Promise<string | null> =>
    ipcRenderer.invoke('file:save', path, content, saveAs),

  cli: {
    status: (): Promise<CliStatus> => ipcRenderer.invoke('cli:status'),
    boards: (): Promise<CliResult<PortInfo[]>> => ipcRenderer.invoke('cli:boards'),
    cores: (): Promise<CliResult<CoreInfo[]>> => ipcRenderer.invoke('cli:cores'),
    searchCores: (q: string): Promise<CliResult<CoreInfo[]>> => ipcRenderer.invoke('cli:core-search', q),
    searchLibs: (q: string): Promise<CliResult<LibInfo[]>> => ipcRenderer.invoke('cli:lib-search', q),
    installedLibs: (): Promise<CliResult<LibInfo[]>> => ipcRenderer.invoke('cli:lib-list'),
    installCore: (id: string): Op => ipcRenderer.invoke('cli:core-install', id),
    installLib: (name: string): Op => ipcRenderer.invoke('cli:lib-install', name),
    updateIndex: (): Op => ipcRenderer.invoke('cli:update-index'),
    addEspUrls: (): Op => ipcRenderer.invoke('cli:add-esp-urls'),
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

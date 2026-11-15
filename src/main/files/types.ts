// Типы IPC для файлов и проектов (используются в main, preload и renderer — только как типы).

export interface TreeNode {
  name: string
  path: string
  dir: boolean
  children?: TreeNode[]
}

export interface ProjectInfo {
  root: string
  name: string
  /** Главный .ino (name.ino, иначе первый .ino в корне) или null */
  mainFile: string | null
}

export interface RecentItem {
  path: string
  name: string
  lastOpened: number
}

export interface TemplateInfo {
  id: string
  name: string
  description: string
  group: 'basic' | 'esp32' | 'esp8266'
}

export interface AppSettings {
  cliPath: string | null
  sketchbookDir: string
}

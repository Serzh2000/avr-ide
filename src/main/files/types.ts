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
  kind: 'arduino' | 'stm32'
  /** Главный .ino (name.ino, иначе первый .ino в корне) или null */
  mainFile: string | null
  /** Плата из sketch.yaml (default_fqbn) или null, если файла/поля нет */
  fqbn: string | null
  /** Порт из sketch.yaml (default_port) или null */
  port: string | null
}

export interface RecentItem {
  path: string
  name: string
  lastOpened: number
  /** Плата проекта, если известна (из sketch.yaml) */
  fqbn?: string
}

export interface AppSettings {
  cliPath: string | null
  sketchbookDir: string
}

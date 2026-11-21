// Поиск внешних программ Pro-режима (openocd, arm-none-eabi-gdb, arm-none-eabi-gcc …). Общая функция для этапов B и C.
// Порядок: переменная окружения → путь из настройки → папка инструментов IDE (userData/pro-tools) → STM32CubeIDE / xPack → PATH.
// Чистая логика без Electron: корни передаются параметрами, файловая система — тоже (для тестов).
import { existsSync, readdirSync, statSync } from 'fs'
import { delimiter, join } from 'path'

export interface FindFs { exists(p: string): boolean; list(dir: string): string[] }
export const realFs: FindFs = {
  exists: (p) => { try { return existsSync(p) && statSync(p).isFile() } catch { return false } },
  list: (d) => { try { return readdirSync(d) } catch { return [] } }
}

export type ToolSource = 'env' | 'custom' | 'ide' | 'cubeide' | 'xpack' | 'path'
export interface FoundTool { path: string; source: ToolSource }

export interface FindOptions {
  /** Путь из настройки пользователя */
  custom?: string | null
  /** Папка данных приложения (userData) */
  userDataDir?: string
  env?: Record<string, string | undefined>
  platform?: NodeJS.Platform
  fs?: FindFs
}

/** Имя переменной окружения, переопределяющей путь: openocd → AVRIDE_PRO_OPENOCD, arm-none-eabi-gdb → AVRIDE_PRO_GDB. */
export function envNameFor(tool: string): string {
  return 'AVRIDE_PRO_' + (tool === 'arm-none-eabi-gdb' ? 'GDB' : tool.replace(/^arm-none-eabi-/, '').replace(/[^A-Za-z0-9]/g, '_').toUpperCase())
}

/** Раскрывает путь со звёздочкой в сегменте (например, plugins/com.st-openocd-звёздочка/tools/bin). Новые версии (по имени) идут первыми. */
export function expandPattern(pattern: string, fs: FindFs): string[] {
  const parts = pattern.replace(/\\/g, '/').split('/')
  let cur: string[] = [parts[0] === '' ? '/' : parts[0] + '/']
  for (const seg of parts.slice(1)) {
    const next: string[] = []
    for (const base of cur) {
      if (!seg.includes('*')) { next.push(join(base, seg)); continue }
      const re = new RegExp('^' + seg.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i')
      for (const n of fs.list(base).filter((x) => re.test(x)).sort().reverse()) next.push(join(base, n))
    }
    cur = next
  }
  return cur
}

/** Шаблоны папок с программами по источникам (Windows; на остальных системах только PATH и папка IDE). */
export function searchPatterns(opts: FindOptions): { source: ToolSource; pattern: string }[] {
  const env = opts.env ?? process.env
  const out: { source: ToolSource; pattern: string }[] = []
  if (opts.userDataDir) {
    const t = join(opts.userDataDir, 'pro-tools').replace(/\\/g, '/')
    for (const sub of ['*/bin', '*/*/bin', '*/*/.content/bin', '*/*/*/bin']) out.push({ source: 'ide', pattern: `${t}/${sub}` })
  }
  if ((opts.platform ?? process.platform) === 'win32') {
    const bases = [env['ProgramFiles'], env['ProgramFiles(x86)'], 'C:/ST', env['SystemDrive'] ? env['SystemDrive'] + '/ST' : undefined]
    for (const base of bases) {
      if (!base) continue
      const b = base.replace(/\\/g, '/')
      out.push({ source: 'cubeide', pattern: `${b}/STMicroelectronics/STM32Cube/STM32CubeIDE*/plugins/*/tools/bin` })
      out.push({ source: 'cubeide', pattern: `${b}/STM32CubeIDE*/STM32CubeIDE/plugins/*/tools/bin` })
      out.push({ source: 'cubeide', pattern: `${b}/STM32CubeIDE*/plugins/*/tools/bin` })
      out.push({ source: 'cubeide', pattern: `${b}/Arm GNU Toolchain arm-none-eabi/*/bin` })
    }
    const ad = (env['APPDATA'] ?? (env['USERPROFILE'] ? env['USERPROFILE'] + '/AppData/Roaming' : undefined))?.replace(/\\/g, '/')
    if (ad) out.push({ source: 'xpack', pattern: `${ad}/xPacks/@xpack-dev-tools/*/*/.content/bin` })
  }
  return out
}

export function findTool(tool: string, opts: FindOptions = {}): FoundTool | null {
  const fs = opts.fs ?? realFs
  const env = opts.env ?? process.env
  const platform = opts.platform ?? process.platform
  const exe = platform === 'win32' && !/\.(exe|js|mjs)$/i.test(tool) ? tool + '.exe' : tool
  const fromEnv = env[envNameFor(tool)]
  if (fromEnv && fs.exists(fromEnv)) return { path: fromEnv, source: 'env' }
  if (opts.custom && fs.exists(opts.custom)) return { path: opts.custom, source: 'custom' }
  for (const { source, pattern } of searchPatterns({ ...opts, platform, env })) {
    for (const dir of expandPattern(pattern, fs)) {
      const p = join(dir, exe)
      if (fs.exists(p)) return { path: p, source }
    }
  }
  for (const dir of (env['PATH'] ?? env['Path'] ?? '').split(delimiter)) {
    if (!dir) continue
    const p = join(dir.replace(/^"|"$/g, ''), exe)
    if (fs.exists(p)) return { path: p, source: 'path' }
  }
  return null
}

/** Для имитаторов в тестах: .js/.mjs запускаются самим Electron/Node в режиме Node. */
export function spawnSpec(toolPath: string, args: string[], execPath = process.execPath): { command: string; args: string[]; env: Record<string, string> } {
  if (/\.(mjs|cjs|js)$/i.test(toolPath)) return { command: execPath, args: [toolPath, ...args], env: { ELECTRON_RUN_AS_NODE: '1' } }
  return { command: toolPath, args, env: {} }
}

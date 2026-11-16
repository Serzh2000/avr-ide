// IPC файлов и проектов. Все пути от renderer проверяются: запись, переименование, удаление
// и чтение разрешены только внутри открытой папки проекта (с учётом симлинков).
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { lstat, mkdir, readdir, readFile, realpath, rename, stat, writeFile } from 'fs/promises'
import { basename, dirname, join, resolve } from 'path'
import { suggestSketchName, validateSketchName } from './naming'
import { isInside, isSketchFileName, isValidEntryName } from './paths'
import { SKETCH_YAML, buildSketchYaml, isFqbn, parseSketchYaml, updateSketchYaml } from './sketchyaml'
import { addRecent, getRecent, getSketchbook, removeRecent, setRecentBoard, setSketchbook } from './store'
import { EMPTY_SKETCH } from './templates'
import type { CliResult } from '../cli/types'
import type { ProjectInfo, TreeNode } from './types'

const MAX_READ = 4 * 1024 * 1024
const MAX_TREE_ENTRIES = 4000
const MAX_TREE_DEPTH = 8
const HIDDEN = new Set(['.git', 'node_modules', '.DS_Store', 'Thumbs.db'])
const NAME_HELP = 'Недопустимое имя: нельзя использовать \\ / : * ? " < > | и зарезервированные имена Windows.'

let root: string | null = null
/** Папки, которые пользователь выбрал сам (диалогом) в этой сессии — их можно открывать/использовать как родителя. */
const picked = new Set<string>()
const norm = (p: string): string => (process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p))

const ok = <T>(data: T): CliResult<T> => ({ ok: true, data })
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

export class UserError extends Error {}

/** Оборачивает обработчик: UserError → понятная ошибка, прочее → общее сообщение. */
export async function guard<T>(fn: () => Promise<T>): Promise<CliResult<T>> {
  try {
    return ok(await fn())
  } catch (e) {
    if (e instanceof UserError) return fail(e.message)
    const code = (e as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') return fail('Файл или папка не найдены.')
    if (code === 'EACCES' || code === 'EPERM') return fail('Нет доступа (файл занят или защищён от записи).')
    if (code === 'EEXIST') return fail('Файл или папка с таким именем уже существует.')
    return fail('Ошибка файловой операции: ' + String((e as Error)?.message ?? e))
  }
}

export function needRoot(): string {
  if (!root) throw new UserError('Сначала откройте папку проекта.')
  return root
}

/** Реальный путь ближайшего существующего предка + остаток (для ещё не созданных файлов). */
async function realOf(p: string): Promise<string> {
  const abs = resolve(p)
  let cur = abs
  for (;;) {
    try {
      return join(await realpath(cur), abs.slice(cur.length))
    } catch {
      const up = dirname(cur)
      if (up === cur) return abs
      cur = up
    }
  }
}

/** Путь должен быть внутри проекта (лексически и по реальному пути). */
export async function inside(p: unknown, allowRoot = false): Promise<string> {
  const r = needRoot()
  if (typeof p !== 'string' || !p || !isInside(r, p)) throw new UserError('Путь вне папки проекта — операция запрещена.')
  const abs = resolve(p)
  if (!allowRoot && norm(abs) === norm(r)) throw new UserError('Нельзя выполнить операцию над корневой папкой проекта.')
  const realRoot = await realpath(r)
  if (!isInside(realRoot, await realOf(abs))) throw new UserError('Путь выходит за пределы проекта (символическая ссылка).')
  return abs
}

async function findMain(dir: string): Promise<string | null> {
  try {
    const names = (await readdir(dir)).filter((n) => n.toLowerCase().endsWith('.ino'))
    const want = basename(dir).toLowerCase() + '.ino'
    const n = names.find((x) => x.toLowerCase() === want) ?? names.sort()[0]
    return n ? join(dir, n) : null
  } catch {
    return null
  }
}

export async function openRoot(dir: string): Promise<ProjectInfo> {
  const abs = resolve(dir)
  const s = await stat(abs).catch(() => null)
  if (!s?.isDirectory()) throw new UserError('Папка не найдена.')
  root = abs
  const cfg = await readConfig(abs)
  addRecent(abs, cfg.fqbn)
  return { root: abs, name: basename(abs), mainFile: await findMain(abs), fqbn: cfg.fqbn, port: cfg.port }
}

/** Плата и порт проекта из sketch.yaml (нет файла или он нечитаем — пусто). */
async function readConfig(dir: string): Promise<{ fqbn: string | null; port: string | null }> {
  try {
    const f = join(dir, SKETCH_YAML)
    const s = await stat(f)
    if (!s.isFile() || s.size > 256 * 1024) return { fqbn: null, port: null }
    return parseSketchYaml(await readFile(f, 'utf8'))
  } catch {
    return { fqbn: null, port: null }
  }
}

async function buildTree(dir: string, depth: number, budget: { n: number }): Promise<TreeNode[]> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const out: TreeNode[] = []
  entries.sort((a, b) =>
    a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name, 'ru', { numeric: true }) : a.isDirectory() ? -1 : 1
  )
  for (const e of entries) {
    if (HIDDEN.has(e.name) || e.isSymbolicLink()) continue
    if (budget.n-- <= 0) break
    const path = join(dir, e.name)
    if (e.isDirectory()) {
      out.push({ name: e.name, path, dir: true, children: depth < MAX_TREE_DEPTH ? await buildTree(path, depth + 1, budget) : [] })
    } else if (e.isFile()) {
      out.push({ name: e.name, path, dir: false })
    }
  }
  return out
}

export function parentAllowed(parent: unknown): string {
  if (parent === undefined || parent === null || parent === '') return getSketchbook()
  if (typeof parent !== 'string') throw new UserError('Недопустимая папка.')
  if (norm(parent) === norm(getSketchbook()) || picked.has(norm(parent))) return resolve(parent)
  throw new UserError('Выберите папку через кнопку «Обзор…».')
}

const exists = async (p: string): Promise<boolean> => !!(await stat(p).catch(() => null))

async function uniqueName(parent: string): Promise<string> {
  const taken = new Set<string>()
  for (const n of await readdir(parent).catch(() => [] as string[])) taken.add(n.toLowerCase())
  return suggestSketchName((n) => taken.has(n.toLowerCase()))
}

const winOf = (e: Electron.IpcMainInvokeEvent): BrowserWindow | undefined => BrowserWindow.fromWebContents(e.sender) ?? undefined

export function registerFilesIpc(): void {
  // ---- Проект ----
  ipcMain.handle('project:pick-open', async (e) => {
    const r = await dialog.showOpenDialog(winOf(e)!, { title: 'Открыть папку проекта', properties: ['openDirectory'] })
    if (r.canceled || !r.filePaths[0]) return ok<ProjectInfo | null>(null)
    return guard(async () => {
      picked.add(norm(r.filePaths[0]))
      return openRoot(r.filePaths[0])
    })
  })

  /** Открыть файл: проектом становится его папка; возвращает проект и путь файла. */
  ipcMain.handle('project:pick-file', async (e) => {
    const r = await dialog.showOpenDialog(winOf(e)!, {
      title: 'Открыть файл скетча',
      properties: ['openFile'],
      filters: [
        { name: 'Файлы Arduino / C++', extensions: ['ino', 'h', 'hpp', 'c', 'cpp', 'txt', 'json'] },
        { name: 'Все файлы', extensions: ['*'] }
      ]
    })
    if (r.canceled || !r.filePaths[0]) return ok<{ project: ProjectInfo; file: string } | null>(null)
    return guard(async () => {
      const file = r.filePaths[0]
      picked.add(norm(dirname(file)))
      return { project: await openRoot(dirname(file)), file }
    })
  })

  ipcMain.handle('project:open', (_e, path: unknown) =>
    guard(async () => {
      if (typeof path !== 'string') throw new UserError('Недопустимый путь.')
      const known = getRecent().some((x) => norm(x.path) === norm(path)) || picked.has(norm(path))
      if (!known) throw new UserError('Эта папка не в списке недавних. Откройте её через «Открыть папку».')
      return openRoot(path)
    })
  )

  ipcMain.handle('project:close', () => {
    root = null
    return ok(true)
  })

  ipcMain.handle('project:tree', () => guard(async () => buildTree(needRoot(), 0, { n: MAX_TREE_ENTRIES })))

  ipcMain.handle('project:recent', () => ok(getRecent()))
  ipcMain.handle('project:recent-remove', (_e, p: unknown) => {
    if (typeof p === 'string') removeRecent(p)
    return ok(true)
  })
  ipcMain.handle('project:sketchbook', () => ok(getSketchbook()))

  /** Сменить папку скетчей (выбирается диалогом). Возвращает новый путь или null. */
  ipcMain.handle('project:pick-sketchbook', async (e) => {
    const r = await dialog.showOpenDialog(winOf(e)!, {
      title: 'Папка для новых скетчей',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: getSketchbook()
    })
    if (r.canceled || !r.filePaths[0]) return ok<string | null>(null)
    picked.add(norm(r.filePaths[0]))
    setSketchbook(r.filePaths[0])
    return ok<string | null>(r.filePaths[0])
  })

  /** Выбрать произвольную папку как место для нового скетча. */
  ipcMain.handle('project:pick-folder', async (e) => {
    const r = await dialog.showOpenDialog(winOf(e)!, {
      title: 'Где создать скетч',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: getSketchbook()
    })
    if (r.canceled || !r.filePaths[0]) return ok<string | null>(null)
    picked.add(norm(r.filePaths[0]))
    return ok<string | null>(r.filePaths[0])
  })

  ipcMain.handle('project:suggest-name', (_e, parent?: unknown) => guard(async () => uniqueName(parentAllowed(parent))))

  /** Проверка имени нового проекта: понятная ошибка или null, если имя свободно. */
  ipcMain.handle('project:check-name', (_e, name: unknown, parent?: unknown) =>
    guard(async () => {
      if (typeof name !== 'string') return 'Введите имя проекта.'
      const bad = validateSketchName(name)
      if (bad) return bad
      const base = parentAllowed(parent)
      return (await exists(join(base, name))) ? `Папка «${name}» уже существует в «${base}». Выберите другое имя.` : null
    })
  )

  /** Мастер: папка Имя/Имя.ino с пустым скетчем и sketch.yaml с default_fqbn; проект открывается. */
  ipcMain.handle('project:create', (_e, name: unknown, parent: unknown, fqbn: unknown) =>
    guard(async () => {
      if (typeof name !== 'string') throw new UserError('Введите имя проекта.')
      const bad = validateSketchName(name)
      if (bad) throw new UserError(bad)
      if (fqbn != null && fqbn !== '' && !isFqbn(fqbn)) throw new UserError('Недопустимый идентификатор платы.')
      const base = parentAllowed(parent)
      const dir = join(base, name)
      await mkdir(base, { recursive: true })
      if (await exists(dir)) throw new UserError(`Папка «${name}» уже существует в «${base}». Выберите другое имя.`)
      await mkdir(dir)
      await writeFile(join(dir, name + '.ino'), EMPTY_SKETCH, 'utf8')
      if (fqbn) await writeFile(join(dir, SKETCH_YAML), buildSketchYaml(fqbn as string), 'utf8')
      return openRoot(dir)
    })
  )

  /** Сменили плату сверху: default_fqbn записывается в sketch.yaml открытого проекта (остальные поля сохраняются). */
  ipcMain.handle('project:set-board', (_e, fqbn: unknown) =>
    guard(async () => {
      if (!isFqbn(fqbn)) throw new UserError('Недопустимый идентификатор платы.')
      const r = needRoot()
      const file = await inside(join(r, SKETCH_YAML))
      const old = await readFile(file, 'utf8').catch(() => '')
      const next = updateSketchYaml(old, { fqbn })
      if (next !== old) await writeFile(file, next, 'utf8')
      setRecentBoard(r, fqbn)
      return true
    })
  )

  // ---- Файлы внутри проекта ----
  ipcMain.handle('fs:read', (_e, path: unknown) =>
    guard(async () => {
      const p = await inside(path)
      const s = await stat(p)
      if (!s.isFile()) throw new UserError('Это не файл.')
      if (s.size > MAX_READ) throw new UserError('Файл слишком большой для редактора (более 4 МБ).')
      const buf = await readFile(p)
      if (buf.subarray(0, 8000).includes(0)) throw new UserError('Бинарный файл нельзя открыть в редакторе.')
      return { content: buf.toString('utf8').replace(/^﻿/, ''), mtime: s.mtimeMs }
    })
  )

  ipcMain.handle('fs:write', (_e, path: unknown, content: unknown) =>
    guard(async () => {
      const p = await inside(path)
      if (typeof content !== 'string') throw new UserError('Недопустимое содержимое.')
      await writeFile(p, content, 'utf8')
      return { mtime: (await stat(p)).mtimeMs }
    })
  )

  ipcMain.handle('fs:mtimes', (_e, paths: unknown) =>
    guard(async () => {
      const out: Record<string, number | null> = {}
      if (!Array.isArray(paths)) return out
      for (const p of paths.slice(0, 200)) {
        try {
          out[p as string] = (await stat(await inside(p))).mtimeMs
        } catch {
          out[String(p)] = null
        }
      }
      return out
    })
  )

  ipcMain.handle('fs:create', (_e, path: unknown, kind: unknown) =>
    guard(async () => {
      const p = await inside(path)
      if (!isValidEntryName(basename(p))) throw new UserError(NAME_HELP)
      if (await lstat(p).catch(() => null)) throw new UserError('Файл или папка с таким именем уже существует.')
      if (kind === 'dir') await mkdir(p)
      else if (kind === 'file') await writeFile(p, '', { flag: 'wx' })
      else throw new UserError('Недопустимый тип.')
      return p
    })
  )

  ipcMain.handle('fs:rename', (_e, path: unknown, newName: unknown) =>
    guard(async () => {
      const p = await inside(path)
      if (!isValidEntryName(newName)) throw new UserError(NAME_HELP)
      const target = join(dirname(p), newName)
      await inside(target)
      if (norm(target) !== norm(p) && (await lstat(target).catch(() => null))) {
        throw new UserError('Файл или папка с таким именем уже существует.')
      }
      await rename(p, target)
      return target
    })
  )

  /** Удаление — только в корзину. */
  ipcMain.handle('fs:delete', (_e, path: unknown) =>
    guard(async () => {
      await shell.trashItem(await inside(path))
      return true
    })
  )

  ipcMain.handle('fs:reveal', (_e, path: unknown) =>
    guard(async () => {
      shell.showItemInFolder(await inside(path, true))
      return true
    })
  )

  /** Для конструкторов: записать файл (только имя, без пути, расширение из белого списка) в папку проекта. */
  ipcMain.handle('fs:write-sketch-file', (_e, name: unknown, content: unknown) =>
    guard(async () => {
      const r = needRoot()
      if (!isSketchFileName(name)) {
        throw new UserError('Недопустимое имя файла (разрешены .h .hpp .c .cpp .ino .json .html .css .js .txt .md, без пути).')
      }
      if (typeof content !== 'string' || content.length > 8 * 1024 * 1024) throw new UserError('Недопустимое содержимое файла.')
      const p = await inside(join(r, name))
      await writeFile(p, content, 'utf8')
      return p
    })
  )
}

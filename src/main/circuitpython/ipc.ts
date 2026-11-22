import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { IpcMainInvokeEvent, MessageBoxOptions, OpenDialogOptions, SaveDialogOptions } from 'electron'
import { randomUUID } from 'node:crypto'
import { lstat, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { PICO_BOARDS } from '../../shared/circuitpython/boards'
import type { CliResult } from '../cli/types'

const MAX_SOURCE_SIZE = 1024 * 1024
const pythonFilter = { name: 'Python', extensions: ['py'] }

interface Program { path: string; text: string }

function parent(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

function openDialog(event: IpcMainInvokeEvent, options: OpenDialogOptions) {
  const win = parent(event)
  return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options)
}

function saveDialog(event: IpcMainInvokeEvent, options: SaveDialogOptions) {
  const win = parent(event)
  return win ? dialog.showSaveDialog(win, options) : dialog.showSaveDialog(options)
}

function messageBox(event: IpcMainInvokeEvent, options: MessageBoxOptions) {
  const win = parent(event)
  return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)
}

async function action<T>(fn: () => Promise<T>): Promise<CliResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') {
      return { ok: false, error: 'Не удалось записать файл. Проверьте доступ на запись и подключение платы.' }
    }
    if (code === 'ENOSPC') return { ok: false, error: 'На диске недостаточно места.' }
    if (code === 'ENOENT') return { ok: false, error: 'Файл или диск больше недоступен.' }
    return { ok: false, error: error instanceof Error && !code ? error.message : 'Не удалось выполнить операцию с файлом.' }
  }
}

function validateSource(text: unknown): string {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > MAX_SOURCE_SIZE || text.includes('\0')) {
    throw new Error('Поддерживаются текстовые файлы Python в UTF-8 размером до 1 МБ.')
  }
  return text
}

async function readText(path: string, limit: number): Promise<string> {
  const info = await lstat(path)
  if (!info.isFile() || info.size > limit) throw new Error('Нужен обычный текстовый файл подходящего размера.')
  const bytes = await readFile(path)
  if (bytes.length > limit) throw new Error('Файл слишком большой.')
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('Файл нужно сохранить в кодировке UTF-8.')
  }
}

async function writeProgram(path: string, text: string): Promise<void> {
  // Файл создаётся рядом с целью, чтобы при сбое записи предыдущий код остался на диске.
  const tmp = join(dirname(path), '.avride-' + randomUUID() + '.tmp')
  try {
    await writeFile(tmp, text, { encoding: 'utf8', flag: 'wx', flush: true })
    await rename(tmp, path)
  } finally {
    await unlink(tmp).catch(() => {})
  }
}

async function identifyBoard(root: string) {
  let boot: string
  try {
    boot = await readText(join(root, 'boot_out.txt'), 16 * 1024)
  } catch {
    throw new Error('Выберите корень диска CIRCUITPY с файлом boot_out.txt. Если виден только загрузочный диск, сначала установите CircuitPython.')
  }
  const id = /^Board ID:\s*([^\s]+)\s*$/im.exec(boot)?.[1]
  const board = PICO_BOARDS.find((item) => item.id === id)
  if (!/\bCircuitPython\b/i.test(boot) || !board) {
    throw new Error('Выбранный диск не распознан как Raspberry Pi Pico, Pico W, Pico 2 или Pico 2 W с CircuitPython.')
  }
  return { board, boot }
}

/** Пути для чтения и записи получают только из системных диалогов. */
export function registerCircuitPythonIpc(): void {
  let current: Program | null = null
  let pending = false
  const run = <T>(fn: () => Promise<T>): Promise<CliResult<T>> => action(async () => {
    if (pending) throw new Error('Дождитесь окончания предыдущей операции.')
    pending = true
    try {
      return await fn()
    } finally {
      pending = false
    }
  })

  ipcMain.handle('circuitpython:open', (event) => run(async (): Promise<Program | null> => {
    const result = await openDialog(event, { title: 'Открыть программу CircuitPython', properties: ['openFile'], filters: [pythonFilter] })
    const path = result.filePaths[0]
    if (result.canceled || !path) return null
    if (extname(path).toLowerCase() !== '.py') throw new Error('Выберите файл Python (.py).')
    const text = validateSource(await readText(path, MAX_SOURCE_SIZE))
    current = { path, text }
    return current
  }))

  ipcMain.handle('circuitpython:save', (event, value: unknown, saveAs: unknown) => run(async (): Promise<Program | null> => {
    const text = validateSource(value)
    let path = current?.path
    if (saveAs === true || !path) {
      const result = await saveDialog(event, {
        title: 'Сохранить программу CircuitPython',
        defaultPath: path ?? 'code.py', filters: [pythonFilter], properties: ['showOverwriteConfirmation']
      })
      if (result.canceled || !result.filePath) return null
      path = result.filePath
      if (extname(path).toLowerCase() !== '.py') throw new Error('Укажите имя с расширением .py.')
    } else if (await readText(path, MAX_SOURCE_SIZE) !== current?.text) {
      throw new Error('Файл изменился вне AVR IDE. Сохраните редакцию под другим именем или откройте файл заново.')
    }
    await writeProgram(path, text)
    current = { path, text }
    return current
  }))

  ipcMain.handle('circuitpython:deploy', (event, value: unknown) => run(async () => {
    const text = validateSource(value)
    const result = await openDialog(event, { title: 'Выберите корень диска CIRCUITPY', properties: ['openDirectory'] })
    const root = result.filePaths[0]
    if (result.canceled || !root) return null
    const { board, boot } = await identifyBoard(root)
    const existing = await lstat(join(root, 'code.py')).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    if (existing && !existing.isFile()) throw new Error('В корне диска уже есть объект code.py, который не является обычным файлом.')
    if (existing) {
      const answer = await messageBox(event, {
        type: 'question', title: 'Заменить программу на плате?',
        message: `Заменить code.py на ${board.name}?`, detail: root,
        buttons: ['Отмена', 'Заменить'], defaultId: 0, cancelId: 0, noLink: true
      })
      if (answer.response !== 1) return null
    }
    if ((await identifyBoard(root)).boot !== boot) throw new Error('Плата на выбранном диске изменилась. Выберите её заново.')
    await writeProgram(join(root, 'code.py'), text)
    return { board: board.name, path: join(root, 'code.py') }
  }))

  ipcMain.handle('circuitpython:firmware', (_event, id: unknown) => action(async () => {
    const board = PICO_BOARDS.find((item) => item.id === id)
    if (!board) throw new Error('Выберите модель Raspberry Pi Pico.')
    await shell.openExternal(`https://circuitpython.org/board/${board.id}/`)
    return true
  }))

  ipcMain.handle('circuitpython:discard', (event) => action(async () => {
    const result = await messageBox(event, {
      type: 'warning', title: 'Несохранённая программа CircuitPython',
      message: 'В программе есть несохранённые изменения.',
      buttons: ['Продолжить редактирование', 'Отбросить изменения'], defaultId: 0, cancelId: 0, noLink: true
    })
    return result.response === 1
  }))
}

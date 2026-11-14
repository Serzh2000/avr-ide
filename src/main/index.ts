import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { basename, dirname, extname } from 'path'
import { registerCliIpc, shutdownCli } from './cli/ipc'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'AVR IDE',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  win.setMenuBarVisibility(false)
  if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

ipcMain.handle('file:open', async () => {
  const r = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Arduino / C++', extensions: ['ino', 'h', 'hpp', 'c', 'cpp', 'txt', 'json'] }, { name: 'All', extensions: ['*'] }]
  })
  if (r.canceled || !r.filePaths[0]) return null
  const path = r.filePaths[0]
  return { path, content: await readFile(path, 'utf8') }
})

// Имя скетча Arduino: буквы, цифры, _ и -, не с дефиса, до 63 символов
const SKETCH_NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,62}$/

ipcMain.handle('file:save', async (_e, path: string | null, content: string, saveAs?: boolean) => {
  let target = path
  if (!target || saveAs) {
    const r = await dialog.showSaveDialog({
      title: 'Сохранить скетч (будет создана папка с тем же именем)',
      defaultPath: 'sketch.ino',
      filters: [{ name: 'Arduino sketch', extensions: ['ino'] }]
    })
    if (r.canceled || !r.filePath) return null
    let file = r.filePath
    if (extname(file).toLowerCase() !== '.ino') file += '.ino'
    const name = basename(file, '.ino')
    if (!SKETCH_NAME_RE.test(name)) {
      await dialog.showMessageBox({
        type: 'error',
        message: 'Недопустимое имя скетча',
        detail: 'Используйте латинские буквы, цифры, «_» и «-» (не начинайте с «-»).'
      })
      return null
    }
    // arduino-cli требует папку sketch/sketch.ino — создаём её, если пользователь выбрал просто файл
    const dir = dirname(file)
    if (basename(dir) !== name) {
      const sub = join(dir, name)
      await mkdir(sub, { recursive: true })
      file = join(sub, name + '.ino')
    }
    target = file
  }
  await writeFile(target, content, 'utf8')
  return target
})

registerCliIpc()

app.whenReady().then(createWindow)
app.on('before-quit', shutdownCli)
app.on('window-all-closed', () => app.quit())

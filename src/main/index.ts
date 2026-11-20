import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import { join } from 'path'
import { registerCliIpc, shutdownCli } from './cli/ipc'
import { registerFilesIpc } from './files/ipc'
import { registerSearchIpc } from './files/search'
import { registerExamplesIpc } from './examples/ipc'
import { registerLibsIpc } from './libs/ipc'
import { registerLibsourceIpc } from './libsource/ipc'
import { registerBoardSourcesIpc } from './boardsources/ipc'
import { registerCoresIpc } from './cores/ipc'

let allowClose = false

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 720,
    minHeight: 560,
    title: 'AVR IDE',
    backgroundColor: '#1f1f1f',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  // Автотесты (scripts/e2e) запускают окно без захвата фокуса, чтобы не перехватывать ввод пользователя
  win.once('ready-to-show', () => (process.env['AVRIDE_E2E'] === '1' ? win.showInactive() : win.show()))
  // Закрытие окна: сначала спрашиваем renderer, нет ли несохранённых файлов
  win.on('close', (e) => {
    if (allowClose || win.webContents.isDestroyed()) return
    e.preventDefault()
    win.webContents.send('app:close-request')
  })
  // Без встроенного меню; в режиме разработки оставляем F12 и Ctrl+R
  win.webContents.on('before-input-event', (_e, input) => {
    if (app.isPackaged || input.type !== 'keyDown') return
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) win.webContents.toggleDevTools()
    if (input.control && !input.shift && input.key.toLowerCase() === 'r') win.webContents.reload()
  })
  // Внешние ссылки и новые окна не открываем внутри приложения
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

// Ссылки справки: только страницы репозитория проекта (список фиксирован, произвольные адреса не открываются)
const HELP_LINKS: Record<string, string> = {
  repo: 'https://github.com/Serzh2000/avr-ide',
  readme: 'https://github.com/Serzh2000/avr-ide#readme',
  issues: 'https://github.com/Serzh2000/avr-ide/issues'
}
ipcMain.handle('app:open-help-link', async (_e, kind: unknown): Promise<boolean> => {
  const url = typeof kind === 'string' ? HELP_LINKS[kind] : undefined
  if (!url) return false
  await shell.openExternal(url)
  return true
})

ipcMain.handle('app:quit', () => {
  allowClose = true
  app.quit()
  return true
})

Menu.setApplicationMenu(null)
registerCliIpc()
registerFilesIpc()
registerSearchIpc()
registerExamplesIpc()
registerLibsIpc()
registerLibsourceIpc()
registerBoardSourcesIpc()
registerCoresIpc()

app.whenReady().then(createWindow)
app.on('before-quit', () => {
  allowClose = true
  shutdownCli()
})
app.on('window-all-closed', () => app.quit())

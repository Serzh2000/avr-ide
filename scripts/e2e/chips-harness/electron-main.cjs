// Окно Electron для пробы: electron electron-main.cjs <url>
const { app, BrowserWindow } = require('electron')
app.whenReady().then(() => {
  const w = new BrowserWindow({ width: 1280, height: 800, show: true, webPreferences: { backgroundThrottling: false } })
  w.loadURL(process.argv[process.argv.length - 1])
})
app.on('window-all-closed', () => app.quit())

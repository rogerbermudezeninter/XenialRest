const { app, BrowserWindow, globalShortcut } = require('electron')
const path = require('path')

const isDev = !app.isPackaged
const VITE_PORT = process.env.VITE_PORT || 5180

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#252525',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    titleBarStyle: 'default',
    show: false,
  })

  if (isDev) {
    win.loadURL(`http://localhost:${VITE_PORT}`)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.once('ready-to-show', () => win.show())

  // F12 para abrir DevTools (útil para depurar)
  globalShortcut.register('F12', () => win.webContents.toggleDevTools())
  globalShortcut.register('CommandOrControl+Shift+I', () => win.webContents.toggleDevTools())
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

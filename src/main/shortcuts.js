import { globalShortcut } from 'electron'

export function registerShortcuts(getWindow) {
  const failed = []

  if (!globalShortcut.register('CommandOrControl+Shift+R', () => {
    getWindow()?.webContents.send('toggle-recording')
  })) failed.push('CommandOrControl+Shift+R')

  if (!globalShortcut.register('CommandOrControl+Shift+D', () => {
    getWindow()?.webContents.send('send-message')
  })) failed.push('CommandOrControl+Shift+D')

  return failed
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll()
}

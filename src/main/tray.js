import { Tray, Menu, app } from 'electron'
import { APP_NAME, getTrayIcon } from './assets'

let tray = null

export function createTray(mainWindow, onImportChrome) {
  tray = new Tray(getTrayIcon())
  tray.setToolTip(APP_NAME)

  const items = [
    {
      label: 'Show / Hide',
      click: () => {
        if (mainWindow.isVisible()) mainWindow.hide()
        else { mainWindow.show(); mainWindow.focus() }
      }
    },
    { type: 'separator' },
    ...(process.platform === 'darwin'
      ? [{ label: 'Connect Browser Session', click: onImportChrome }, { type: 'separator' }]
      : []),
    { label: 'Quit', click: () => app.quit() }
  ]

  const menu = Menu.buildFromTemplate(items)

  tray.setContextMenu(menu)
  tray.on('click', () => {
    if (mainWindow.isVisible()) mainWindow.hide()
    else { mainWindow.show(); mainWindow.focus() }
  })

  return tray
}

export function updateTrayState(tone) {
  if (!tray || tray.isDestroyed()) return
  tray.setTitle(tone === 'recording' ? '⏺' : '')
}

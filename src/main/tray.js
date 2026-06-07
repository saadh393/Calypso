import { Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let tray = null

function getIcon() {
  const iconPath = is.dev
    ? join(process.cwd(), 'resources/microphoneTemplate.png')
    : join(process.resourcesPath, 'microphoneTemplate.png')

  const icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) return icon
  icon.setTemplateImage(true)
  return icon
}

export function createTray(mainWindow, onImportChrome) {
  tray = new Tray(getIcon())
  tray.setToolTip('Voice Input')

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

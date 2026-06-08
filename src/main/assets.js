import { app, nativeImage } from 'electron'
import { join } from 'path'

export const APP_NAME = 'Calypso'

export function getResourcePath(file) {
  return app.isPackaged ? join(process.resourcesPath, file) : join(process.cwd(), 'resources', file)
}

export function getAppIcon() {
  return nativeImage.createFromPath(getResourcePath('Logo_.png'))
}

export function getTrayIcon() {
  const icon = nativeImage.createFromPath(getResourcePath('Icon_Black.svg'))
  if (!icon.isEmpty()) icon.setTemplateImage(true)
  return icon
}

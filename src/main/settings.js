import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const DEFAULTS = { outputMode: 'clipboard' }

function settingsPath() {
  return join(app.getPath('userData'), 'settings.json')
}

export function readSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(settingsPath(), 'utf8')) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeSettings(patch) {
  const next = { ...readSettings(), ...patch }
  writeFileSync(settingsPath(), JSON.stringify(next, null, 2))
  return next
}

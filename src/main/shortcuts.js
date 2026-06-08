import { globalShortcut } from 'electron'

export const DEFAULT_RECORD_SHORTCUT = 'CommandOrControl+Shift+R'

const SEND_SHORTCUT = 'CommandOrControl+Shift+D'
const CANCEL_SHORTCUT = 'Escape'

let currentRecordShortcut = null
let escapeRegistered = false

export function registerCancelShortcut(getWindow) {
  if (escapeRegistered) return
  try {
    if (globalShortcut.register(CANCEL_SHORTCUT, () => {
      getWindow()?.webContents.send('cancel-recording')
    })) escapeRegistered = true
  } catch {
    escapeRegistered = false
  }
}

export function unregisterCancelShortcut() {
  if (!escapeRegistered) return
  try {
    globalShortcut.unregister(CANCEL_SHORTCUT)
  } catch {
    void 0
  }
  escapeRegistered = false
}

function registerRecordShortcut(getWindow, shortcut) {
  if (!shortcut) return false
  if (shortcut === currentRecordShortcut) return true

  try {
    if (!globalShortcut.register(shortcut, () => {
      getWindow()?.webContents.send('toggle-recording')
    })) return false
  } catch {
    return false
  }

  if (currentRecordShortcut) globalShortcut.unregister(currentRecordShortcut)
  currentRecordShortcut = shortcut
  return true
}

export function registerShortcuts(getWindow, recordShortcut = DEFAULT_RECORD_SHORTCUT) {
  const failed = []

  if (!globalShortcut.register(SEND_SHORTCUT, () => {
    getWindow()?.webContents.send('send-message')
  })) failed.push(SEND_SHORTCUT)

  if (!registerRecordShortcut(getWindow, recordShortcut)) {
    failed.push(recordShortcut)
    registerRecordShortcut(getWindow, DEFAULT_RECORD_SHORTCUT)
  }

  return failed
}

export function updateRecordShortcut(getWindow, shortcut) {
  if (!shortcut) return { ok: false, shortcut: currentRecordShortcut, error: 'Shortcut is empty' }
  if (shortcut === SEND_SHORTCUT) {
    return { ok: false, shortcut: currentRecordShortcut, error: 'Shortcut is already used by Send' }
  }
  if (shortcut === currentRecordShortcut) return { ok: true, shortcut }
  if (!registerRecordShortcut(getWindow, shortcut)) {
    return { ok: false, shortcut: currentRecordShortcut, error: 'Shortcut is unavailable' }
  }
  return { ok: true, shortcut }
}

export function getRegisteredRecordShortcut() {
  return currentRecordShortcut || DEFAULT_RECORD_SHORTCUT
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll()
  currentRecordShortcut = null
  escapeRegistered = false
}

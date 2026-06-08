import { app, BrowserWindow, ipcMain, clipboard, session, systemPreferences, dialog, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createTray, updateTrayState } from './tray'
import { getRegisteredRecordShortcut, registerShortcuts, unregisterShortcuts, updateRecordShortcut } from './shortcuts'
import { createOverlay, showMessage, confirmMessage, resolveChoice } from './overlay'
import { listAllProfiles, extractCookiesFromProfile } from './chrome-cookies'
import { readSettings, writeSettings } from './settings'
import { pasteAtCursor } from './paste'
import { APP_NAME, getAppIcon } from './assets'

const ACCESSIBILITY_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

function promptAccessibility() {
  dialog
    .showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Accessibility Permission Needed',
      message: `${APP_NAME} needs Accessibility permission to paste at the cursor.`,
      detail:
        'Your text is on the clipboard, so nothing is lost. Grant access in System Settings → Privacy & Security → Accessibility, then try again.',
      buttons: ['Open System Settings', 'OK'],
      defaultId: 0,
      cancelId: 1
    })
    .then(({ response }) => {
      if (response === 0) shell.openExternal(ACCESSIBILITY_SETTINGS_URL)
    })
}

function deliverText(text) {
  clipboard.writeText(text)
  if (readSettings().outputMode !== 'paste') return { ok: true, pasted: false }

  const result = pasteAtCursor()
  if (!result.ok && result.reason === 'accessibility') promptAccessibility()
  return { ok: result.ok, pasted: result.ok, reason: result.reason }
}

let mainWindow = null
let isQuitting = false

function allowMediaPermission(sess) {
  sess.setPermissionRequestHandler((_, permission, callback) => {
    callback(permission === 'media')
  })
  sess.setPermissionCheckHandler((_, permission) => permission === 'media')
}

async function ensureMicrophoneAccess() {
  if (process.platform !== 'darwin') return true

  const status = systemPreferences.getMediaAccessStatus('microphone')
  if (status === 'granted') return true
  if (status === 'denied') return false

  return systemPreferences.askForMediaAccess('microphone')
}

async function pickProfile(profiles) {
  if (profiles.length === 1) return profiles[0]

  const buttons = [...profiles.map(p => p.label), 'Cancel']
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Select Browser Profile',
    message: 'Which Chrome profile is logged into ChatGPT?',
    buttons,
    cancelId: buttons.length - 1,
    defaultId: 0
  })
  return response === buttons.length - 1 ? null : profiles[response]
}

async function confirmImport(profile, cookies) {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Import ChatGPT Cookies',
    message: `Found ${cookies.length} cookie(s) for chatgpt.com in ${profile.label}.`,
    detail: `${cookies.map(c => c.name).join(', ')}\n\nImport these into the app?`,
    buttons: ['Import', 'Cancel'],
    cancelId: 1,
    defaultId: 0
  })
  return response === 0
}

async function importChromeSession() {
  try {
    const profiles = listAllProfiles()

    if (profiles.length === 0) {
      dialog.showErrorBox('No Profiles Found', 'Could not find any Chrome, Brave, or Edge profiles on this machine.')
      return
    }

    const profile = await pickProfile(profiles)
    if (!profile) return

    const cookies = extractCookiesFromProfile(profile)

    if (cookies.length === 0) {
      dialog.showErrorBox('No Cookies Found', `No chatgpt.com cookies found in ${profile.label}. Make sure you are logged into ChatGPT in that profile.`)
      return
    }

    if (!(await confirmImport(profile, cookies))) return

    const sess = session.fromPartition('persist:chatgpt')
    let imported = 0
    for (const c of cookies) {
      try { await sess.cookies.set(c); imported++ }
      catch (e) { console.warn(`[Connect] Skipped "${c.name}": ${e.message}`) }
    }

    mainWindow?.webContents.send('reload-webview')

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Session Connected',
      message: `Connected  ${profile.label}`,
      detail: `${imported} cookies imported. ChatGPT is reloading.`,
      buttons: ['OK']
    })
  } catch (err) {
    console.error('[Connect] Error:', err)
    dialog.showErrorBox('Connect Failed', err.message)
  }
}

function createWindow() {
  const icon = getAppIcon()

  mainWindow = new BrowserWindow({
    width: 520,
    height: 760,
    show: false,
    title: APP_NAME,
    icon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  })

  let didShowInitialWindow = false
  mainWindow.on('ready-to-show', () => {
    if (didShowInitialWindow) return
    didShowInitialWindow = true
    mainWindow.show()
  })

  mainWindow.on('minimize', (e) => {
    e.preventDefault()
    mainWindow.hide()
  })

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  allowMediaPermission(session.defaultSession)
  allowMediaPermission(session.fromPartition('persist:chatgpt'))

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.on('before-quit', () => {
  isQuitting = true
})

app.whenReady().then(async () => {
  app.setName(APP_NAME)
  if (process.platform === 'darwin') app.dock?.setIcon(getAppIcon())
  electronApp.setAppUserModelId('com.calypso.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  mainWindow = createWindow()
  createOverlay()
  createTray(mainWindow, importChromeSession)
  const failedShortcuts = registerShortcuts(() => mainWindow, readSettings().recordShortcut)
  writeSettings({ recordShortcut: getRegisteredRecordShortcut() })
  if (failedShortcuts.length > 0) {
    console.warn('[Shortcuts] Failed to register:', failedShortcuts)
    dialog.showErrorBox('Shortcut Conflict', `Could not register hotkeys: ${failedShortcuts.join(', ')}. Another app may be using them.`)
  }

  await ensureMicrophoneAccess()

  app.on('activate', () => {
    if (!mainWindow) mainWindow = createWindow()
    else if (!mainWindow.isVisible()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
})

app.on('will-quit', unregisterShortcuts)

app.on('window-all-closed', () => {})

ipcMain.on('copy-to-clipboard', (_, text) => clipboard.writeText(text))

ipcMain.handle('deliver-text', (_, text) => deliverText(text))

ipcMain.handle('get-output-mode', () => readSettings().outputMode)

ipcMain.handle('set-output-mode', (_, mode) => writeSettings({ outputMode: mode }).outputMode)

ipcMain.handle('get-record-shortcut', () => readSettings().recordShortcut)

ipcMain.handle('set-record-shortcut', (_, shortcut) => {
  const result = updateRecordShortcut(() => mainWindow, shortcut)
  if (!result.ok) return result
  writeSettings({ recordShortcut: result.shortcut })
  return result
})

ipcMain.handle('ensure-mic-access', () => ensureMicrophoneAccess())

ipcMain.on('overlay:show', (_, msg) => {
  showMessage(msg)
  if (msg.kind === 'status') updateTrayState(msg.tone)
  else if (msg.kind === 'clear') updateTrayState('idle')
})

ipcMain.handle('overlay:confirm', (_, msg) => confirmMessage(msg))

ipcMain.on('overlay:choice', (_, { id, choice }) => resolveChoice(id, choice))

ipcMain.on('quit-app', () => app.quit())

ipcMain.on('notify-error', (_, message) => dialog.showErrorBox(APP_NAME, message))

ipcMain.handle('import-chrome-session', () => importChromeSession())

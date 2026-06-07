import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

const SIZES = {
  default: { width: 300, height: 56 },
  confirm: { width: 360, height: 112 }
}
const TIMEOUTS = { notice: 3000, error: 4500 }
const MARGIN = 20

let win = null
let dismissTimer = null
let pending = null
let seq = 0

function anchor({ height }) {
  const { height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  return { x: MARGIN, y: screenHeight - height - MARGIN }
}

function applySize(kind) {
  const size = kind === 'confirm' ? SIZES.confirm : SIZES.default
  const { x, y } = anchor(size)
  win.setBounds({ x, y, width: size.width, height: size.height })
}

function setInteractive(on) {
  if (!win || win.isDestroyed()) return
  win.setIgnoreMouseEvents(!on)
  win.setFocusable(on)
}

function settlePending(choice) {
  if (!pending) return
  const { resolve } = pending
  pending = null
  resolve(choice)
}

function hideOverlay() {
  clearTimeout(dismissTimer)
  dismissTimer = null
  setInteractive(false)
  if (win && !win.isDestroyed()) win.hide()
}

export function createOverlay() {
  const size = SIZES.default
  const { x, y } = anchor(size)

  win = new BrowserWindow({
    width: size.width,
    height: size.height,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  win.setAlwaysOnTop(true, 'floating', 1)
  win.setIgnoreMouseEvents(true)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/overlay.html')
  } else {
    win.loadFile(join(__dirname, '../renderer/overlay.html'))
  }

  return win
}

export function showMessage(msg) {
  if (!win || win.isDestroyed()) return

  clearTimeout(dismissTimer)
  dismissTimer = null
  settlePending(null)

  if (msg.kind === 'clear') {
    hideOverlay()
    return
  }

  const id = ++seq
  applySize(msg.kind)
  win.webContents.send('overlay:render', { ...msg, id })
  setInteractive(false)
  if (!win.isVisible()) win.showInactive()

  const timeout = msg.timeout != null ? msg.timeout : TIMEOUTS[msg.kind]
  if (timeout) dismissTimer = setTimeout(hideOverlay, timeout)
}

export function confirmMessage(msg) {
  if (!win || win.isDestroyed()) return Promise.resolve(null)

  clearTimeout(dismissTimer)
  dismissTimer = null
  settlePending(null)

  const id = ++seq
  applySize('confirm')
  win.webContents.send('overlay:render', { ...msg, kind: 'confirm', id })
  setInteractive(true)
  if (!win.isVisible()) win.showInactive()

  return new Promise((resolve) => {
    pending = { id, resolve }
  })
}

export function resolveChoice(id, choice) {
  if (!pending || pending.id !== id) return
  const { resolve } = pending
  pending = null
  hideOverlay()
  resolve(choice)
}

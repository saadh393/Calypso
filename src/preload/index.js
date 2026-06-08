import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const overlay = {
  status: (label, tone = 'info', sound = null) =>
    ipcRenderer.send('overlay:show', { kind: 'status', label, tone, sound }),
  notice: (label, timeout, tone = 'success') =>
    ipcRenderer.send('overlay:show', { kind: 'notice', label, timeout, tone }),
  transcripted: (label, timeout, tone = 'success') =>
    ipcRenderer.send('overlay:show', { kind: 'notice', label, timeout, tone, sound: 'transcripted' }),
  error: (label, timeout, tone = 'error') =>
    ipcRenderer.send('overlay:show', { kind: 'error', label, timeout, tone }),
  confirm: (label, actions) => ipcRenderer.invoke('overlay:confirm', { label, actions }),
  clear: () => ipcRenderer.send('overlay:show', { kind: 'clear' })
}

const api = {
  copyToClipboard: (text) => ipcRenderer.send('copy-to-clipboard', text),
  deliverText: (text) => ipcRenderer.invoke('deliver-text', text),
  getOutputMode: () => ipcRenderer.invoke('get-output-mode'),
  setOutputMode: (mode) => ipcRenderer.invoke('set-output-mode', mode),
  getRecordShortcut: () => ipcRenderer.invoke('get-record-shortcut'),
  setRecordShortcut: (shortcut) => ipcRenderer.invoke('set-record-shortcut', shortcut),
  getPrepareSeconds: () => ipcRenderer.invoke('get-prepare-seconds'),
  setPrepareSeconds: (seconds) => ipcRenderer.invoke('set-prepare-seconds', seconds),
  ensureMicAccess: () => ipcRenderer.invoke('ensure-mic-access'),
  overlay,
  setRecordingActive: (active) => ipcRenderer.send('recording-active', active),
  onToggleRecording: (cb) => ipcRenderer.on('toggle-recording', cb),
  onCancelRecording: (cb) => ipcRenderer.on('cancel-recording', cb),
  onSendMessage: (cb) => ipcRenderer.on('send-message', cb),
  onOverlayRender: (cb) => ipcRenderer.on('overlay:render', cb),
  sendOverlayChoice: (id, choice) => ipcRenderer.send('overlay:choice', { id, choice }),
  quit: () => ipcRenderer.send('quit-app'),
  notifyError: (message) => ipcRenderer.send('notify-error', message),
  importChromeSession: () => ipcRenderer.invoke('import-chrome-session'),
  onReloadWebview: (cb) => ipcRenderer.on('reload-webview', cb),
  offToggleRecording: () => ipcRenderer.removeAllListeners('toggle-recording'),
  offCancelRecording: () => ipcRenderer.removeAllListeners('cancel-recording'),
  offSendMessage: () => ipcRenderer.removeAllListeners('send-message'),
  offOverlayRender: () => ipcRenderer.removeAllListeners('overlay:render'),
  offReloadWebview: () => ipcRenderer.removeAllListeners('reload-webview')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (e) {
    console.error(e)
  }
} else {
  window.electron = electronAPI
  window.api = api
}

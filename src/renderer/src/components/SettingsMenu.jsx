import { useEffect, useRef } from 'react'
import OutputModeToggle from './OutputModeToggle'
import ClipboardHistory from './ClipboardHistory'
import ShortcutRecorder from './ShortcutRecorder'

const isMac = navigator.platform.startsWith('Mac')
const mod = isMac ? '⌘' : 'Ctrl'

function SettingsMenu({
  open,
  outputMode,
  onOutputModeChange,
  recordShortcut,
  onRecordShortcutChange,
  shortcutError,
  history,
  onCopyHistoryItem,
  onReloadWebview,
  onClose
}) {
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) onClose()
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="settings-panel" ref={ref}>
      <section className="settings-section">
        <div className="settings-title">Output</div>
        <OutputModeToggle value={outputMode} onChange={onOutputModeChange} />
      </section>

      <section className="settings-section">
        <div className="settings-title">Shortcuts</div>
        <div className="shortcut-row">
          <span>Record</span>
          <ShortcutRecorder
            value={recordShortcut}
            onChange={onRecordShortcutChange}
            error={shortcutError}
          />
        </div>
        <div className="shortcut-row">
          <span>Send</span>
          <kbd>{mod}+Shift+D</kbd>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-title">Session</div>
        <button className="settings-action" onClick={() => window.api.importChromeSession()}>
          Import Cookie
        </button>
        <button
          className="settings-action"
          onClick={() => {
            onReloadWebview()
            onClose()
          }}
        >
          Reload WebView
        </button>
      </section>

      <section className="settings-section">
        <div className="settings-title">Clipboard History</div>
        <ClipboardHistory items={history} onCopy={onCopyHistoryItem} />
      </section>

      <button className="settings-action danger" onClick={() => window.api.quit()}>
        Quit
      </button>
    </div>
  )
}

export default SettingsMenu

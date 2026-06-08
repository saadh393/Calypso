import { useCallback, useState } from 'react'
import SettingsMenu from './SettingsMenu'

const STATUS_LABELS = {
  idle: 'Ready',
  preparing: 'Preparing…',
  recording: 'Recording — speak now',
  listening: 'Listening — speak now',
  transcribing: 'Transcribing...',
  ready: 'Text ready',
  done: 'Copied to clipboard'
}

function VoiceButton({
  status,
  isLoggedIn,
  readiness,
  outputMode,
  onOutputModeChange,
  recordShortcut,
  onRecordShortcutChange,
  shortcutError,
  prepareSeconds,
  onPrepareSecondsChange,
  history,
  onCopyHistoryItem,
  onReloadWebview
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const statusLabel = !isLoggedIn
    ? 'Not logged in'
    : readiness === 'preparing'
      ? 'Preparing ChatGPT…'
    : readiness === 'error'
        ? 'ChatGPT unavailable'
        : (STATUS_LABELS[status] ?? 'Ready')
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  return (
    <div className="controls-bar">
      <span className={`status${!isLoggedIn || readiness === 'error' ? ' login-warning' : ''}`}>
        {statusLabel}
      </span>

      <button
        className="settings-btn"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setSettingsOpen((value) => !value)}
        title="Settings"
      >
        ⚙
      </button>
      <SettingsMenu
        open={settingsOpen}
        outputMode={outputMode}
        onOutputModeChange={onOutputModeChange}
        recordShortcut={recordShortcut}
        onRecordShortcutChange={onRecordShortcutChange}
        shortcutError={shortcutError}
        prepareSeconds={prepareSeconds}
        onPrepareSecondsChange={onPrepareSecondsChange}
        history={history}
        onCopyHistoryItem={onCopyHistoryItem}
        onReloadWebview={onReloadWebview}
        onClose={closeSettings}
      />
    </div>
  )
}

export default VoiceButton

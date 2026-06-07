import OutputModeToggle from './OutputModeToggle'

const STATUS_LABELS = {
  idle: 'Ready',
  preparing: 'Preparing…',
  recording: 'Recording — speak now',
  listening: 'Listening — speak now',
  transcribing: 'Transcribing...',
  ready: 'Text ready',
  done: 'Copied to clipboard'
}

const isMac = navigator.platform.startsWith('Mac')
const mod = isMac ? '⌘' : 'Ctrl'

function VoiceButton({ isRecording, status, isLoggedIn, readiness, outputMode, onOutputModeChange, onToggle, onSend }) {
  const canRecord = isLoggedIn && readiness === 'ready'
  const statusLabel = !isLoggedIn
    ? 'Not logged in — click Import Cookie'
    : readiness === 'preparing'
      ? 'Preparing ChatGPT…'
      : readiness === 'error'
        ? 'ChatGPT unavailable — try Import Cookie'
        : (STATUS_LABELS[status] ?? 'Ready')

  return (
    <div className="controls-bar">
      <button
        className={`mic-btn${isRecording ? ' active' : ''}${!canRecord ? ' disabled' : ''}`}
        onClick={canRecord ? onToggle : undefined}
        title={`Toggle recording  (${mod}+Shift+R)`}
        disabled={!canRecord}
      >
        {isRecording ? '■' : '●'}
      </button>

      <span className={`status${!isLoggedIn || readiness === 'error' ? ' login-warning' : ''}`}>
        {statusLabel}
      </span>

      <button
        className="send-btn"
        onClick={onSend}
        title={`Send to ChatGPT  (${mod}+Shift+D)`}
      >
        &#8593;
      </button>

      <span className="hints">{mod}+Shift+R &nbsp;|&nbsp; {mod}+Shift+D</span>

      <OutputModeToggle value={outputMode} onChange={onOutputModeChange} />

      <button
        className="connect-btn"
        onClick={() => window.api.importChromeSession()}
        title="List Chrome profiles and import chatgpt.com cookies"
      >
        Import Cookie
      </button>

      <button
        className="quit-btn"
        onClick={() => window.api.quit()}
        title="Quit"
      >
        &#x2715;
      </button>
    </div>
  )
}

export default VoiceButton

import { useEffect, useState } from 'react'
import OverlayActions from './OverlayActions'
import './overlay.css'

function Overlay() {
  const [message, setMessage] = useState(null)

  useEffect(() => {
    window.api.onOverlayRender((_, msg) => {
      setMessage(msg && msg.kind !== 'clear' ? msg : null)
    })
    return () => window.api.offOverlayRender()
  }, [])

  if (!message) return null

  const isConfirm = message.kind === 'confirm'
  const tone = message.tone || (message.kind === 'error' ? 'error' : 'info')

  return (
    <div className={`pill ${isConfirm ? 'interactive' : ''}`}>
      <div className="row">
        <span className={`dot ${tone}`} />
        <span className="label">{message.label}</span>
      </div>
      {isConfirm && message.actions?.length > 0 && (
        <OverlayActions
          actions={message.actions}
          onChoose={(choice) => window.api.sendOverlayChoice(message.id, choice)}
        />
      )}
    </div>
  )
}

export default Overlay

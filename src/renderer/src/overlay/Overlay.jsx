import { useEffect, useRef, useState } from 'react'
import OverlayActions from './OverlayActions'
import { playOverlaySound } from './overlaySounds'
import './overlay.css'

function Overlay() {
  const [message, setMessage] = useState(null)
  const lastMessageIdRef = useRef(null)

  useEffect(() => {
    window.api.onOverlayRender((_, msg) => {
      if (!msg || msg.kind === 'clear') {
        setMessage(null)
        return
      }

      setMessage(msg)
    })
    return () => window.api.offOverlayRender()
  }, [])

  useEffect(() => {
    if (!message?.sound || lastMessageIdRef.current === message.id) return
    lastMessageIdRef.current = message.id
    playOverlaySound(message.sound, message.soundUrl)
  }, [message])

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

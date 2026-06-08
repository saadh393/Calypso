import { useEffect, useState } from 'react'
import { displayAccelerator, eventToAccelerator } from '../lib/shortcutAccelerator'

function ShortcutRecorder({ value, onChange, error }) {
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    if (!recording) return

    const handleKeyDown = (event) => {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape') {
        setRecording(false)
        return
      }

      const accelerator = eventToAccelerator(event)
      if (!accelerator) return

      setRecording(false)
      onChange(accelerator)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onChange, recording])

  return (
    <div className="shortcut-recorder">
      <kbd className={`shortcut-value${recording ? ' recording' : ''}`}>
        {recording ? 'Listening...' : displayAccelerator(value)}
      </kbd>
      <button
        className="shortcut-capture"
        onClick={() => setRecording((value) => !value)}
      >
        {recording ? 'Cancel' : 'Change'}
      </button>
      {error && <div className="shortcut-error">{error}</div>}
    </div>
  )
}

export default ShortcutRecorder

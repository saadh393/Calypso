import { useRef, useState, useEffect, useCallback } from 'react'
import WebViewContainer from './components/WebViewContainer'
import VoiceButton from './components/VoiceButton'
import { useChatGptReadiness } from './hooks/useChatGptReadiness'
import './App.css'

const DONE_RESET_MS = 2000
const TRANSCRIBE_WAIT_MS = 5 * 60 * 1000

const WAIT_MORE_ACTIONS = [
  { label: 'Wait', value: 'wait', variant: 'primary' },
  { label: 'No', value: 'cancel', variant: 'neutral' },
  { label: 'Record again', value: 'again', variant: 'neutral' }
]

function App() {
  const webviewRef = useRef(null)
  const [isRecording, setIsRecording] = useState(false)
  const [status, setStatus] = useState('idle')
  const [isLoggedIn, setIsLoggedIn] = useState(true)
  const [outputMode, setOutputMode] = useState('clipboard')
  const isRecordingRef = useRef(false)
  const confirmedRef = useRef(false)
  const isBusyRef = useRef(false)
  const doneTimerRef = useRef(null)
  const readiness = useChatGptReadiness(webviewRef)

  useEffect(() => {
    window.api.ensureMicAccess()
    window.api.getOutputMode().then(setOutputMode)
    return () => clearTimeout(doneTimerRef.current)
  }, [])

  const changeOutputMode = useCallback((mode) => {
    setOutputMode(mode)
    window.api.setOutputMode(mode)
  }, [])

  const resetIdle = useCallback(() => {
    isRecordingRef.current = false
    confirmedRef.current = false
    setIsRecording(false)
    setStatus('idle')
    window.api.overlay.clear()
  }, [])

  const handleStartState = useCallback((state) => {
    if (state === 'preparing') {
      setStatus('preparing')
      window.api.overlay.status('Preparing ChatGPT…', 'processing')
    } else if (state === 'recording') {
      confirmedRef.current = true
      setStatus('recording')
      window.api.overlay.status('Recording — speak now', 'recording')
    }
  }, [])

  const watchExternalStop = useCallback(() => {
    let sawActive = false
    webviewRef.current?.watchDictationState((state) => {
      if (state !== 'idle') {
        sawActive = true
        return
      }
      if (sawActive && isRecordingRef.current) {
        webviewRef.current?.stopDictationState()
        resetIdle()
      }
    })
  }, [resetIdle])

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current || isBusyRef.current) return

    clearTimeout(doneTimerRef.current)
    isRecordingRef.current = true
    confirmedRef.current = false
    setIsRecording(true)
    setStatus('preparing')
    window.api.overlay.status('Preparing ChatGPT…', 'processing')

    const started = await webviewRef.current?.startRecording({ onState: handleStartState })

    if (!isRecordingRef.current) return

    if (!started) {
      isRecordingRef.current = false
      confirmedRef.current = false
      setIsRecording(false)
      setStatus('idle')
      window.api.overlay.error("Couldn't start recording — ChatGPT may have changed")
      return
    }

    watchExternalStop()
  }, [handleStartState, watchExternalStop])

  const deliverTranscription = useCallback(async (text) => {
    const result = await window.api.deliverText(text)
    webviewRef.current?.clearAndReload()
    setStatus('done')
    window.api.overlay.notice(result?.pasted ? 'Pasted at cursor' : 'Copied to clipboard', DONE_RESET_MS)
    doneTimerRef.current = setTimeout(() => {
      setStatus('idle')
      window.api.overlay.clear()
    }, DONE_RESET_MS)
  }, [])

  const transcribe = useCallback(async () => {
    while (true) {
      setStatus('transcribing')
      window.api.overlay.status('Transcribing…', 'processing')

      const text = await webviewRef.current?.readTranscription({ timeout: TRANSCRIBE_WAIT_MS })
      if (text) {
        deliverTranscription(text)
        return
      }

      const choice = await window.api.overlay.confirm('No transcription yet — wait more?', WAIT_MORE_ACTIONS)
      if (choice === 'wait') continue

      if (choice === 'again') {
        isBusyRef.current = false
        await webviewRef.current?.clearAndReload()
        resetIdle()
        startRecordingRef.current?.()
        return
      }

      resetIdle()
      return
    }
  }, [deliverTranscription, resetIdle])

  const startRecordingRef = useRef(startRecording)
  startRecordingRef.current = startRecording

  const stopRecording = useCallback(() => {
    const wasConfirmed = confirmedRef.current
    isRecordingRef.current = false
    confirmedRef.current = false
    webviewRef.current?.cancelRecording()
    webviewRef.current?.stopDictationState()

    if (!wasConfirmed) {
      resetIdle()
      return
    }

    isBusyRef.current = true
    setIsRecording(false)
    webviewRef.current?.triggerDictation()

    transcribe().finally(() => {
      isBusyRef.current = false
    })
  }, [resetIdle, transcribe])

  const toggleRecording = useCallback(() => {
    if (isBusyRef.current) return
    if (isRecordingRef.current) stopRecording()
    else startRecording()
  }, [startRecording, stopRecording])

  const toggleRecordingRef = useRef(toggleRecording)
  toggleRecordingRef.current = toggleRecording

  const sendMessage = useCallback(() => {
    webviewRef.current?.send()
  }, [])

  useEffect(() => {
    window.api.onToggleRecording(() => toggleRecordingRef.current?.())
    window.api.onSendMessage(() => sendMessage())
    window.api.onReloadWebview(() => webviewRef.current?.reload())
    return () => {
      window.api.offToggleRecording()
      window.api.offSendMessage()
      window.api.offReloadWebview()
    }
  }, [sendMessage])

  return (
    <div className="app">
      <WebViewContainer ref={webviewRef} onLoginState={setIsLoggedIn} />
      <VoiceButton
        isRecording={isRecording}
        status={status}
        isLoggedIn={isLoggedIn}
        readiness={readiness}
        outputMode={outputMode}
        onOutputModeChange={changeOutputMode}
        onToggle={toggleRecording}
        onSend={sendMessage}
      />
    </div>
  )
}

export default App

const sounds = new Map()

export function playOverlaySound(sound, soundUrl) {
  if (!sound || !soundUrl) return

  const current = sounds.get(sound)
  if (current) {
    current.pause()
    current.currentTime = 0
    current.play().catch(() => {})
    return
  }

  const audio = new Audio(soundUrl)
  audio.preload = 'auto'
  audio.volume = 1
  sounds.set(sound, audio)
  audio.play().catch(() => {
    sounds.delete(sound)
  })
}

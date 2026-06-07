import { execFileSync } from 'child_process'

const PASTE_SCRIPT = 'tell application "System Events" to keystroke "v" using command down'

export function pasteAtCursor() {
  try {
    execFileSync('osascript', ['-e', PASTE_SCRIPT])
    return { ok: true }
  } catch (err) {
    const message = String(err.stderr || err.message || '')
    const denied = /not allowed|assistive access|1002|-25211/i.test(message)
    return { ok: false, reason: denied ? 'accessibility' : message }
  }
}

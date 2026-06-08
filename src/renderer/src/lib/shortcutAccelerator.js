const isMac = navigator.platform.startsWith('Mac')
const MODIFIER_KEYS = new Set(['Alt', 'Control', 'Meta', 'Shift'])
const KEY_NAMES = {
  ' ': 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Esc',
  Delete: 'Delete',
  Backspace: 'Backspace',
  Enter: 'Enter',
  Tab: 'Tab'
}

export function eventToAccelerator(event) {
  if (MODIFIER_KEYS.has(event.key)) return null

  const key = KEY_NAMES[event.key] || (event.key.length === 1 ? event.key.toUpperCase() : event.key)
  const modifiers = []

  if (isMac ? event.metaKey : event.ctrlKey) modifiers.push('CommandOrControl')
  if (isMac && event.ctrlKey) modifiers.push('Control')
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')

  if (modifiers.length === 0 || !key) return null
  return [...modifiers, key].join('+')
}

export function displayAccelerator(accelerator) {
  return accelerator
    .replaceAll('CommandOrControl', isMac ? '⌘' : 'Ctrl')
    .replaceAll('Control', 'Ctrl')
    .replaceAll('Alt', isMac ? 'Option' : 'Alt')
}

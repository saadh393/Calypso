const MAX_HISTORY_ITEMS = 10
const STORAGE_KEY = 'calypso.clipboardHistory'

export function addClipboardHistoryItem(items, text) {
  const value = text.trim()
  if (!value) return items

  return [value, ...items.filter((item) => item !== value)].slice(0, MAX_HISTORY_ITEMS)
}

export function loadClipboardHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(0, MAX_HISTORY_ITEMS) : []
  } catch {
    return []
  }
}

export function saveClipboardHistory(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)))
}

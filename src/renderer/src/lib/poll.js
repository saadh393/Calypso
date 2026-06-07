export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function pollUntil(fn, { timeout, interval = 300, active } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (active && !active()) return false
    try {
      if (await fn()) return true
    } catch {
      void 0
    }
    await delay(interval)
  }
  return false
}

export async function pollForValue(fn, { timeout, interval = 300, active } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (active && !active()) return null
    try {
      const value = await fn()
      if (value) return value
    } catch {
      void 0
    }
    await delay(interval)
  }
  return null
}

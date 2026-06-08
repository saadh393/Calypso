export function withTimeout(promise, timeout, fallback) {
  let timer = null

  return Promise.race([
    Promise.resolve(promise),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), timeout)
    })
  ]).finally(() => clearTimeout(timer))
}

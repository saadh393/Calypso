const EXEC_TIMEOUT_MS = 2000;

export function execJS(webview, script) {
  if (!webview) return Promise.resolve(null);

  return Promise.race([
    webview.executeJavaScript(script).catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), EXEC_TIMEOUT_MS)),
  ]);
}

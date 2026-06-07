# Voice Input — App Knowledge Graph

> Read this first in any new session. It is the source of truth for "where we are."
> Stack: **Electron + React** (electron-vite). macOS-first. Runs via `npm run dev`, builds via `npm run build`.

---

## 1. What the app is

A desktop app that wraps **chatgpt.com** in an Electron `<webview>` and drives ChatGPT's
**native voice dictation** via global hotkeys, showing the user a floating status pill.
It can also **import ChatGPT cookies from a local Chrome/Brave/Edge profile** so the
webview is logged in without manual sign-in.

Two pillars:
- **A. Cookie import** — log the webview into ChatGPT using the desktop browser's session.
- **B. Voice dictation control + status hints** — start/stop ChatGPT dictation by hotkey, reflect real state.

---

## 2. File map (nodes)

```
src/
  main/
    index.js          Main process. Window, IPC, importChromeSession() orchestration, mic perms.
    chrome-cookies.js  Cookie extraction + decryption (Chrome/Brave/Edge). THE crypto lives here.
    tray.js           System tray menu (Show/Hide, Connect Browser Session, Quit).
    shortcuts.js      Global hotkeys: Ctrl+Shift+R = toggle record, Ctrl+Shift+D = send.
    overlay.js        Floating always-on-top status pill BrowserWindow (280x52, bottom-left).
  preload/
    index.js          contextBridge `window.api`: copyToClipboard, ensureMicAccess, sendStatus,
                      onToggleRecording, onSendMessage, onStatusUpdate, importChromeSession,
                      onReloadWebview, quit (+ matching off* removers).
  renderer/src/
    App.jsx           Coordinator. Wires hotkeys -> webview methods, owns `status` state.
    components/
      WebViewContainer.jsx  The <webview>. Imperative API (see §5). Dictation + send + state watcher.
      VoiceButton.jsx       Bottom control bar: mic, send, status label, "Import Cookie", quit.
    overlay/
      Overlay.jsx     Renders the status pill from STATUS_CONFIG.
      overlay.css     Pill + dot styles (dot classes: recording/processing/done).
    lib/
      dictationState.js  buildDictationStateScript() -> returns 'listening'|'transcribing'|'ready'|'idle'.
```

---

## 3. Pillar A — Cookie import (DONE, working: 23/23 cookies)

**Flow** (`main/index.js` → `importChromeSession()`):
1. `listAllProfiles()` scans Chrome/Brave/Edge support dirs, reads `Local State` → profile list.
2. `pickProfile()` — native dialog to choose a profile (auto-selects if only one).
3. `extractCookiesFromProfile()` — copies the SQLite `Cookies` DB to tmp, queries chatgpt.com rows, decrypts.
4. `confirmImport()` — **preview dialog** lists cookie names, Import / Cancel.
5. On confirm, each cookie `session.fromPartition('persist:chatgpt').cookies.set(c)`; then reload webview.

UI entry points: **"Import Cookie"** button in `VoiceButton.jsx` (calls `window.api.importChromeSession()`)
and tray item "Connect Browser Session". Both hit the same `importChromeSession()`.

### Decryption — CRITICAL GOTCHAS (do not regress)
In `chrome-cookies.js` `decrypt()`:
- macOS **v10** scheme: AES-128-CBC. Key = `pbkdf2(security-keychain-password, 'saltysalt', 1003, 16, sha1)`.
  Password from `security find-generic-password -w -s "<Browser> Safe Storage" -a "<Browser>"`. IV = 16 bytes of 0x20.
- **Modern Chrome (M130+) prepends a 32-byte SHA-256 domain hash to every plaintext value.**
  After PKCS-unpadding you MUST `slice(32)` or every cookie fails Electron's
  `cookies.set` with *"ASCII control characters"*. (Verified: `oai-gn` = 32-byte hash + "Naimur".)
- **`__Host-`-prefixed cookies must NOT carry a `domain` attribute** (and must be secure). We omit `domain`
  for those in `extractCookiesFromProfile()`; otherwise they fail with *"invalid __Host- prefix"*.
- Cookie query is scoped to **chatgpt.com only** (host `chatgpt.com` / `%.chatgpt.com`). openai.com
  was intentionally removed per spec — if login ever needs openai.com auth cookies, re-add them here.

### Diagnosing cookie import
The throwaway `diag.mjs` used to test this is deleted. To re-test: copy `chrome-cookies.js` to `/tmp/cc.mjs`,
write a tiny Electron `.mjs` that calls `extractCookiesFromProfile` then `session.fromPartition('persist:chatgpt').cookies.set`
in a loop and logs failures, run with `./node_modules/.bin/electron <file>.mjs`. (The source `.js` can't be
`import`ed directly under Electron because the repo is CommonJS — hence the `.mjs` copy.)

---

## 4. Pillar B — Voice dictation + status hints (DONE)

**Hotkeys** (`shortcuts.js`, registered globally):
- `Ctrl+Shift+R` → `toggle-recording` IPC → `App.toggleRecording()`.
- `Ctrl+Shift+D` → `send-message` IPC → `WebViewContainer.send()`.

**toggleRecording()** (`App.jsx`):
- Always calls `webviewRef.triggerDictation()` (sends Ctrl+Shift+D into the webview to toggle ChatGPT's mic).
- **Start**: status `listening`; starts `watchDictationState(cb)` poller. Poller ignores `idle` so the pill
  doesn't flicker before the waveform renders.
- **Stop**: `stopDictationState()`; status `transcribing`; `readAndCopyInputText()` polls `#prompt-textarea`,
  copies text to clipboard via IPC, clears the box, reloads webview; then status `done` → `idle` after 2s.

**State detection** (`lib/dictationState.js`, polled every 300ms) — maps ChatGPT DOM → status:
| DOM signal                                   | status         | pill label            |
|----------------------------------------------|----------------|-----------------------|
| `canvas.h-14` (waveform) present             | `listening`    | "Listening — speak now" (red blink) |
| `[aria-label="Submit dictation"]` present    | `transcribing` | "Transcribing..." (amber) |
| text in composer + `[data-testid=send-button]` | `ready`      | "Text ready" (green)  |
| else                                         | `idle`         | (pill hidden)         |
| (after copy)                                 | `done`         | "Copied to clipboard" |

**Reference DOM (ChatGPT composer), for selector maintenance:**
- ready/idle mic: `<button aria-label="Start dictation" class="composer-btn ...">`
- listening: `<canvas class="w-full h-14">` inside composer
- finish dictation: `<button aria-label="Submit dictation" ...>`
- send: `<button id="composer-submit-button" data-testid="send-button" aria-label="Send prompt">`

These are brittle (ChatGPT can change classes/labels). If status hints break, re-capture these and
update `dictationState.js` + the `send`/`readAndCopyInputText` selectors in `WebViewContainer.jsx`.

---

## 5. WebViewContainer imperative API (the integration surface)

`useImperativeHandle` exposes:
- `reload()`
- `triggerDictation()` — toggles ChatGPT mic (sendInputEvent + dispatched KeyboardEvent Ctrl+Shift+D).
- `watchDictationState(onState)` / `stopDictationState()` — 300ms poller over `buildDictationStateScript()`.
- `readAndCopyInputText()` — polls `#prompt-textarea` (≤20×200ms), copies, clears, reloads.
- `insertText(text)` / `send()` — `send()` clicks `[data-testid=send-button]` then polls for the new
  `[data-message-author-role="assistant"]` message (every 600ms, 120s cap) and auto-copies its innerText.

Webview config: `src=https://chatgpt.com`, `partition="persist:chatgpt"` (keeps login),
spoofed Chrome `useragent`, `allowpopups`.

---

## 6. Status vocabulary (keep these 4 files in sync)

`listening | transcribing | ready | done | idle` are produced in `App.jsx`, consumed by:
- `VoiceButton.jsx` `STATUS_LABELS` (in-app bar)
- `overlay/Overlay.jsx` `STATUS_CONFIG` (floating pill)
- `main/overlay.js` `showOverlayStatus()` — shows pill for any non-`idle`, hides on `idle`.

If you add a status, update all of: App.jsx, VoiceButton.jsx, Overlay.jsx (and a dot class in overlay.css).

---

## 7. Current git / build state (as of this session)

- Git repo initialized. **1 commit**: `feat: import chatgpt.com cookies from Chrome profile`.
- **Uncommitted** (the Pillar B dictation-state work): `App.jsx`, `VoiceButton.jsx`,
  `WebViewContainer.jsx`, `overlay/Overlay.jsx`, and new `lib/dictationState.js`. Build is green
  (`npm run build` passes). Commit these when ready.
- Platform: macOS only paths in `chrome-cookies.js` (returns `[]` on non-darwin).

---

## 8. Known open items / next candidates

- [ ] Commit the dictation-state changes (see §7).
- [ ] openai.com cookies are not imported — only re-add if a login edge case needs them.
- [ ] Selectors in `dictationState.js` / `WebViewContainer.jsx` are ChatGPT-DOM-dependent and may rot.
- [ ] No tests; verification is manual via `npm run dev` + diag scripts.

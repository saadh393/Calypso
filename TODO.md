# TODO — Voice Input

> Source of truth for what is implemented and what is left. Keep this file updated as work lands.
> Stack: Electron + React (electron-vite), macOS-first. ChatGPT webview drives native dictation.

---

## Confirmed decisions

- **Paste at cursor** → AppleScript keystroke (`osascript` Cmd+V to frontmost app, needs Accessibility permission).
- **"Wait more?" prompt** → interactive overlay; the overlay becomes multi-purpose (status pill + action prompts), not a native dialog.
- **"Reload the app" on not-ready** → reload the webview (`webview.reload()`), keep session.
- **Send-to-ChatGPT feature** (Cmd+Shift+D + reply polling) → keep as-is, additive only.

---

## Resolved questions / risks

- **Transcription read** → robust id-based: read `#prompt-textarea` as `value || innerText || textContent`. Works with the real contenteditable div; do NOT use strict `[name="prompt-textarea"]`.
- **Selector rot** → centralize ALL ChatGPT selectors in one module (e.g. `src/renderer/src/lib/chatgptSelectors.js`). If readiness/recording probes never resolve within their timeouts, surface a clear error ("ChatGPT layout may have changed") via overlay/notification instead of hanging silently.
- **AppleScript Accessibility denied** → detect the failure, show a message with a link/button to open System Settings → Privacy & Security → Accessibility, and fall back to leaving the text on the clipboard so nothing is lost.

---

## A. Readiness gate (DONE)

- [x] Centralize ChatGPT selectors in one module (`src/renderer/src/lib/chatgptSelectors.js`) — holds canonical selectors + `READINESS_SCRIPT`. (Recording/transcription probes in `WebViewContainer`/`dictationState` migrate to it as B/C land.)
- [x] Readiness probe script: ready when `#prompt-textarea` exists AND `button[aria-label="Start dictation"]` exists. (`chatgptSelectors.READINESS_SCRIPT`, `WebViewContainer.checkReady`)
- [x] Poll readiness every 3s after launch. (`hooks/useChatGptReadiness.js`)
- [x] If not ready within 60s (20 polls) → `webview.reload()` and resume polling.
- [x] Cap reloads at 5 attempts.
- [x] After 5 failed attempts → `window.api.notifyError` → `dialog.showErrorBox` and stop polling.
- [x] Expose readiness state (`preparing`/`ready`/`error`) to renderer; surfaced in `VoiceButton` (mic disabled until ready) and available to `App` for the record trigger (B).

## B. Record trigger — start (Cmd+Shift+R) (DONE)

- [x] On trigger, check readiness first. (`WebViewContainer.startRecording`, `App.startRecording`)
- [x] If not ready → overlay shows "Preparing", keep polling until ready, then auto-start. (`startRecording` ready-poll, `RECORDING_STARTED_SCRIPT`)
- [x] If ready → trigger dictation, then confirm recording actually started:
      no `button[aria-label="Start dictation"]` AND a `canvas` present → started. (`chatgptSelectors.RECORDING_STARTED_SCRIPT`)
- [x] Update overlay label to the recording state once confirmed.
- [x] Confirm timeout 40s → reload + re-trigger; up to 3 attempts; then reset to idle + overlay error.
- [x] Global hotkey Cmd+Shift+R wired to toggle. (`shortcuts.js`, `App.jsx`)
- [x] Mic permission request on launch. (`index.js` `ensureMicrophoneAccess`)

## C. Record trigger — stop (Cmd+Shift+R again) (DONE)

- [x] On stop, toggle dictation off and watch the transcription output: read `#prompt-textarea` as `value || innerText || textContent` (not `[name="prompt-textarea"]`). (`App.stopRecording` → `triggerDictation`, `WebViewContainer.readTranscription` → `buildReadInputScript`)
- [x] Poll for output up to 5 minutes. (`App.TRANSCRIBE_WAIT_MS`, `poll.pollForValue`)
- [x] If output arrives → deliver to clipboard. (`App.deliverTranscription`; paste mode pending F)
- [x] If no output within 5 min → overlay prompt "Wait more?" with Wait / No / Record again. (`App.transcribe` + `WAIT_MORE_ACTIONS`)
      - Wait → keep watching.
      - No → abort, reset to idle.
      - Record again → reload + restart the record flow.
- [x] Read text from composer + copy to clipboard. (`WebViewContainer.readTranscription`/`deliverTranscription`)
- [x] After Each Record + Transcription + Copy/Pasting the transcription, Reload the Webview. (`WebViewContainer.clearAndReload`)

## D. Multi-purpose overlay (extend existing pill)

- [x] Overlay supports two modes: passive status label, and interactive action prompt with buttons. (`overlay.js` `showMessage`/`confirmMessage`, `Overlay.jsx`, `OverlayActions.jsx`)
- [x] Make overlay focusable + accept mouse events when showing an action prompt; revert to click-through for status. (`overlay.js` `setInteractive`)
- [x] IPC: overlay → main → renderer to relay the user's choice. (`overlay:confirm`/`overlay:choice`, `resolveChoice`)
- [x] New status labels: `preparing`, `recording` (synced across App.jsx, VoiceButton.jsx, Overlay.jsx, overlay.css, main/overlay.js).
- [x] Generic per-type overlay API: `window.api.overlay.status/notice/error/confirm/clear` with kind-based dismissal (status persists, notice/error auto-dismiss, confirm awaits choice). (`preload`, `overlay.js`)
- [x] Floating always-on-top pill, bottom-left, status-driven. (`overlay.js`, `Overlay.jsx`)
- [x] Wire the `confirm` prompt into the stop flow ("Wait more? Wait / No / Record again"). (`App.transcribe`)

## E. Menubar / tray (mostly done)

- [x] Minimize hides window to tray. (`index.js` `minimize` → hide)
- [x] Tray menu: Show/Hide, Connect Browser Session, Quit. (`tray.js`)
- [x] Use a microphone tray icon. (`resources/microphoneTemplate.png` + `@2x`, monochrome template image; `tray.js` `getIcon` sets `setTemplateImage(true)`)

## F. Output mode toggle — clipboard vs paste (DONE)

- [x] UI toggle (in `VoiceButton.jsx`) to choose Clipboard or Paste-at-cursor. (`OutputModeToggle.jsx`)
- [x] Persist the choice (small settings file/IPC). (`src/main/settings.js`, `get-output-mode`/`set-output-mode` IPC)
- [x] Clipboard mode → existing copy behavior. (`index.js` `deliverText`)
- [x] Paste mode → copy to clipboard, then AppleScript Cmd+V into the frontmost app. (`paste.js` `pasteAtCursor`)
- [x] Pure paste function in its own main-process file (`src/main/paste.js`).
- [x] Accessibility-denied path: detect failure, show message with a link to open System Settings → Privacy & Security → Accessibility, and fall back to leaving text on the clipboard. (`index.js` `promptAccessibility`)

## G. Quit (done)

- [x] Quit fully closes the app. (`isQuitting` flag + tray Quit + `quit-app` IPC → `app.quit()`)

---

## Already implemented (carried over)

- [x] Cookie import from Chrome/Brave/Edge (decrypt + inject into `persist:chatgpt`). (`chrome-cookies.js`, `index.js`)
- [x] Send-to-ChatGPT + reply polling on Cmd+Shift+D. (`WebViewContainer.send`, `shortcuts.js`)
- [x] Re-entrancy guard during transcribe. (`App.jsx` `isBusyRef`)
- [x] Optimistic recording-state reconciliation via dictation watcher. (`App.jsx`)

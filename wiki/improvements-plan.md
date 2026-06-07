# Improvements — Implementation Plan

> Handoff spec. Follow exactly. No code comments. Prefer pure functions in their own files; reuse before creating. Keep React components one-per-file.

---

## 1. Re-entrancy guard during transcribe — `renderer/src/App.jsx`

**Problem:** `toggleRecording` has no guard. `readAndCopyInputText()` is async and reloads the webview mid-flight; a second hotkey press desyncs `isRecordingRef`.

**Do:**
- Add a `isBusyRef = useRef(false)` (or reuse `status`).
- At the top of `toggleRecording`, return early if `status === 'transcribing'` (busy).
- Set busy = true when entering the stop branch; clear it inside the `.then()` after copy completes (and on error via `.catch`/`.finally`).
- Apply the same guard to the in-app button and the global-hotkey path (both already route through `toggleRecording`, so one guard covers both).

**Accept:** Pressing `Ctrl+Shift+R` repeatedly while "Transcribing..." is shown does nothing until copy finishes.

---

## 2. Stale `mainWindow` closure — `main/shortcuts.js`

**Problem:** callbacks capture the `mainWindow` passed once at startup. If the window is ever recreated (`index.js:161` `activate` branch), shortcuts target a dead reference.

**Do:**
- Change `registerShortcuts` to accept a **getter** instead of the window instance: `registerShortcuts(getWindow)`.
- Inside each callback call `getWindow()?.webContents.send(...)`.
- Update the caller `index.js:156` to pass `() => mainWindow`.

**Accept:** Recreating the main window keeps hotkeys working.

---

## 3. Check `globalShortcut.register` return values — `main/shortcuts.js`

**Problem:** `register` returns `false` when the combo is owned by another app; current code ignores it, hotkeys silently dead.

**Do:**
- Capture each `register(...)` boolean.
- If any is `false`, log a warning and surface a non-blocking notice (reuse the existing `dialog` import in `index.js`, or return a list of failed accelerators from `registerShortcuts` and let `index.js` show `dialog.showErrorBox` / a console warn). Keep it simple — a `console.warn` plus a single `dialog` line for the failed set is enough.

**Accept:** When a hotkey can't bind, the user sees a message instead of silence.

---

## 4. Reconcile optimistic recording state — `renderer/src/App.jsx`

**Problem:** `isRecording` is a blind toggle. If ChatGPT dictation never actually starts, the UI is stuck on "Listening".

**Do:**
- In the `watchDictationState` callback (start branch), if `s === 'idle'` arrives **after** we've already seen a non-idle state, treat it as "dictation ended": set `isRecordingRef.current = false`, `setIsRecording(false)`, stop the watcher. (Track a `sawActive` local/ref so the initial idle ticks before the waveform renders are still ignored — preserve current behavior of ignoring leading `idle`.)

**Accept:** If dictation drops on ChatGPT's side, the mic button returns to idle automatically.

---

## 5. Remove key-material + sensitive logging — `main/chrome-cookies.js`

**Problem:** `chrome-cookies.js:118` logs AES key length + first 4 bytes; other `[Connect]` lines print profile labels / cookie counts.

**Do:**
- Delete the `Key bytes:` log line entirely (line ~118).
- Remove or gate behind `is.dev` the remaining `console.log` lines that print profile paths and cookie data in `chrome-cookies.js` and `index.js` (`[Connect] ...`). Keep `console.error`/`console.warn` for genuine failures but without dumping values.

**Accept:** No key bytes or cookie contents in production logs.

---

## 6. Delete dead code — `renderer/src/hooks/useVoiceRecognition.js`

**Do:** Delete the file. Confirm no imports reference it (grep `useVoiceRecognition`). Remove the `hooks/` dir if now empty. Update `wiki/index.md` §2 and §8 to drop the dead-code note.

---

## 7. Split the `status-update` IPC channel — preload + main + overlay

**Problem:** one channel name carries both renderer→main (`sendStatus`) and main→overlay (`onStatusUpdate`); both preloads expose both directions.

**Do:**
- Rename the renderer→main send to channel `status-set` (preload `sendStatus`, main `ipcMain.on('status-set', ...)`).
- Keep main→overlay broadcast on `status-update` (overlay `onStatusUpdate` / `offStatusUpdate` unchanged).
- Update `main/index.js:177` handler and `main/overlay.js` send accordingly.

**Accept:** No channel shared across two directions; behavior identical.

---

## 8. Minor cleanups

- **Extract inline scripts** in `WebViewContainer.jsx` `readAndCopyInputText` into builder functions `buildReadInputScript()` and `buildClearInputScript()`, colocated with the other `build*Script` helpers (top of file). Pure functions, no comments.
- **`lib/dictationState.js`:** the function returns a constant string. Export a `const DICTATION_STATE_SCRIPT = \`...\`` and update the single caller in `WebViewContainer.jsx:83`. (Keep the file; just stop rebuilding the string each tick.)
- **Overlay minimal preload (optional):** the overlay window only needs `onStatusUpdate`/`offStatusUpdate`. If trivial, give `main/overlay.js` a dedicated small preload exposing just those; otherwise leave as-is.
- **`sqlite3` PATH guard — `chrome-cookies.js`:** wrap the `sqlite3 -json` `execSync` so a missing binary throws a clear "sqlite3 not found" error surfaced via the existing `dialog.showErrorBox` in `importChromeSession`, instead of a raw ENOENT.

---

## 9. Connect button not readable — `renderer/src/App.css`

**Problem:** `.connect-btn` resting `color: #555` on `#111` bar (`App.css:92`) is near-invisible. `.quit-btn` `#444` (line 112) and `.hints` `#333` (line 82) have the same issue but are lower priority.

**Do:**
- Raise `.connect-btn` resting `color` to `#bbb` (keep the green `#4caf50` on `:hover`). Optionally lighten its `border-color` from `#2a2a2a` to `#3a3a3a` for a visible edge.
- (Optional, same pass) bump `.quit-btn` resting `color` `#444 → #999`.

**Accept:** "Import Cookie" label is clearly legible at rest.

---

## Suggested order
5 → 1 → 9 → 2 → 3 → 4 → 7 → 6 → 8. Run `npm run build` after each group; verify `npm run dev` once at the end.

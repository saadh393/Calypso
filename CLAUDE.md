## Overview

This is a macOS Electron app that wraps ChatGPT in a webview and controls its voice dictation via global hotkeys. Pressing Cmd+Shift+R toggles ChatGPT's built-in microphone on and off without touching the main window. When recording stops, the transcribed text is delivered to the clipboard or pasted at the focused cursor, and the webview reloads. A floating multi-purpose overlay shows the current state (and can prompt the user) even when the app is hidden. Users log into ChatGPT by importing cookies from their local Chrome, Brave, or Edge profile via the Import Cookie button.

---

## Progress tracking

**TODO.md is the source of truth for what is implemented and what is left.** Before starting work, read `TODO.md`. As features land, check off the matching items and keep the open-questions/decisions sections current. Do not duplicate task status into this file — record it in `TODO.md`.

---

## Files

**src/main/index.js** — App entry point. Creates the main window, tray, overlay, registers IPC handlers, and orchestrates cookie import.

**src/main/chrome-cookies.js** — Reads and decrypts ChatGPT cookies from a Chrome/Brave/Edge SQLite database using macOS Keychain keys.

**src/main/shortcuts.js** — Registers global hotkeys Cmd+Shift+R (toggle recording) and Cmd+Shift+D (send message).

**src/main/tray.js** — System tray menu with Show/Hide, Import Cookie, and Quit. Shows ⏺ in the menu bar while recording.

**src/main/overlay.js** — Creates the always-on-top transparent status pill window positioned at the bottom-left of the screen.

**src/preload/index.js** — Exposes a safe `window.api` bridge between the renderer and main process via contextBridge.

**src/renderer/src/App.jsx** — Coordinator component. Owns recording state, wires hotkey IPC events to webview methods, and drives status updates.

**src/renderer/src/components/WebViewContainer.jsx** — Renders the ChatGPT webview. Exposes imperative methods: toggle dictation, poll DOM state, copy text, send message.

**src/renderer/src/components/VoiceButton.jsx** — Bottom controls bar: mic button, status label, send button, hotkey hints, Import Cookie button, quit.

**src/renderer/src/overlay/Overlay.jsx** — Renders the floating status pill from a status string sent via IPC.

**src/renderer/src/lib/dictationState.js** — Script injected into the webview to read ChatGPT's current dictation state from the DOM.

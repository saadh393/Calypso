import {forwardRef, useRef, useImperativeHandle, useEffect} from "react";
import {DICTATION_STATE_SCRIPT} from "../lib/dictationState";
import {READINESS_SCRIPT, RECORDING_STARTED_SCRIPT} from "../lib/chatgptSelectors";
import {pollUntil, pollForValue, delay} from "../lib/poll";
import {withTimeout} from "../lib/withTimeout";

const CHATGPT_URL = "https://chatgpt.com";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const POLL_INTERVAL_MS = 300;
const READY_TIMEOUT_MS = 60_000;
const CONFIRM_TIMEOUT_MS = 40_000;
const MAX_START_ATTEMPTS = 3;
const EXECUTE_TIMEOUT_MS = 1_500;

function executeWebviewScript(wv, script, fallback = false) {
  if (!wv || wv.isLoading?.()) return Promise.resolve(fallback);
  return withTimeout(wv.executeJavaScript(script), EXECUTE_TIMEOUT_MS, fallback);
}

function buildInsertScript(text) {
  const escaped = JSON.stringify(text);
  return `
    (() => {
      const text = ${escaped};
      const el =
        document.querySelector('#prompt-textarea') ||
        document.querySelector('[contenteditable="true"][data-placeholder]') ||
        document.querySelector('[contenteditable="true"]');
      if (!el) return false;
      el.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
      return true;
    })()
  `;
}

function buildSendScript() {
  return `
    (() => {
      const btn = document.querySelector('[data-testid="send-button"]');
      if (btn && !btn.disabled) { btn.click(); return 'clicked'; }
      const el = document.querySelector('#prompt-textarea, [contenteditable="true"]');
      if (el) {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        return 'enter';
      }
      return 'not-found';
    })()
  `;
}

function buildReadInputScript() {
  return `
    (() => {
      const el = document.getElementById('prompt-textarea');
      if (!el) return '';
      return (el.value || el.innerText || el.textContent || '').trim();
    })()
  `;
}

function buildClearInputScript() {
  return `
    (() => {
      const el = document.getElementById('prompt-textarea');
      if (!el) return;
      el.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    })()
  `;
}

function buildPollScript(beforeCount) {
  return `
    (() => {
      const msgs = document.querySelectorAll('[data-message-author-role="assistant"]');
      const stop = document.querySelector('[data-testid="stop-button"]');
      if (msgs.length > ${beforeCount} && !stop) {
        return msgs[msgs.length - 1].innerText || null;
      }
      return null;
    })()
  `;
}

const WebViewContainer = forwardRef(({onLoginState}, ref) => {
  const domRef = useRef(null);
  const watcherRef = useRef(null);
  const stateWatcherRef = useRef(null);
  const startTokenRef = useRef(0);

  const clearWatcher = () => {
    if (watcherRef.current) {
      clearInterval(watcherRef.current);
      watcherRef.current = null;
    }
  };

  const clearStateWatcher = () => {
    if (stateWatcherRef.current) {
      clearInterval(stateWatcherRef.current);
      stateWatcherRef.current = null;
    }
  };

  const triggerDictation = () => {
    const wv = domRef.current;
    if (!wv) return;

    wv.sendInputEvent({type: "keyDown", keyCode: "D", modifiers: ["control", "shift"]});
    wv.sendInputEvent({type: "keyUp", keyCode: "D", modifiers: ["control", "shift"]});

    wv.executeJavaScript(
      `
      (() => {
        const opts = { key: 'd', code: 'KeyD', keyCode: 68, ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true };
        document.dispatchEvent(new KeyboardEvent('keydown', opts));
        window.dispatchEvent(new KeyboardEvent('keydown', opts));
      })()
    `,
    ).catch(() => {});
  };

  useEffect(
    () => () => {
      startTokenRef.current++;
      clearWatcher();
      clearStateWatcher();
    },
    [],
  );

  useEffect(() => {
    const wv = domRef.current;
    if (!wv) return;
    const handleLoad = () => {
      const url = wv.getURL();
      onLoginState?.(url.startsWith("https://chatgpt.com") && !url.includes("/auth"));
    };
    wv.addEventListener("did-finish-load", handleLoad);
    return () => wv.removeEventListener("did-finish-load", handleLoad);
  }, [onLoginState]);

  useImperativeHandle(ref, () => ({
    reload: () => domRef.current?.reload(),

    checkReady: async () => {
      const wv = domRef.current;
      if (!wv) return false;
      try {
        return Boolean(await executeWebviewScript(wv, READINESS_SCRIPT));
      } catch {
        return false;
      }
    },

    watchDictationState: (onState) => {
      clearStateWatcher();
      let last = null;
      stateWatcherRef.current = setInterval(async () => {
        try {
          const state = await domRef.current?.executeJavaScript(DICTATION_STATE_SCRIPT);
          if (state && state !== last) {
            last = state;
            onState(state);
          }
        } catch {
          clearStateWatcher();
        }
      }, 300);
    },

    stopDictationState: clearStateWatcher,

    triggerDictation,

    cancelRecording: () => {
      startTokenRef.current++;
      clearStateWatcher();
    },

    startRecording: async ({onState} = {}) => {
      if (!domRef.current) return false;

      const token = ++startTokenRef.current;
      const alive = () => token === startTokenRef.current && Boolean(domRef.current);
      const probe = (script) => executeWebviewScript(domRef.current, script);

      await domRef.current.executeJavaScript(buildClearInputScript()).catch(() => {});
      await delay(300);

      for (let attempt = 0; attempt < MAX_START_ATTEMPTS; attempt++) {
        if (!alive()) return false;
        onState?.("preparing");

        const ready = await pollUntil(() => probe(READINESS_SCRIPT), {
          timeout: READY_TIMEOUT_MS,
          interval: POLL_INTERVAL_MS,
          active: alive,
        });

        if (!alive()) return false;
        if (!ready) {
          domRef.current?.reload();
          continue;
        }

        triggerDictation();

        const started = await pollUntil(() => probe(RECORDING_STARTED_SCRIPT), {
          timeout: CONFIRM_TIMEOUT_MS,
          interval: POLL_INTERVAL_MS,
          active: alive,
        });
        if (!alive()) return false;
        if (started) {
          onState?.("recording");
          return true;
        }

        domRef.current?.reload();
      }

      return false;
    },

    readTranscription: ({timeout, active} = {}) => {
      const wv = domRef.current;
      if (!wv) return Promise.resolve(null);
      return pollForValue(() => executeWebviewScript(wv, buildReadInputScript(), ""), {
        timeout,
        interval: POLL_INTERVAL_MS,
        active,
      });
    },

    clearAndReload: async () => {
      const wv = domRef.current;
      if (!wv) return;
      await wv.executeJavaScript(buildClearInputScript()).catch(() => {});
      await delay(400);
      wv.reload();
    },

    insertText: (text) => {
      domRef.current?.executeJavaScript(buildInsertScript(text)).catch(() => {});
    },

    send: async () => {
      const wv = domRef.current;
      if (!wv) return;

      clearWatcher();

      let beforeCount = 0;
      try {
        beforeCount = await wv.executeJavaScript(
          `document.querySelectorAll('[data-message-author-role="assistant"]').length`,
        );
      } catch {
        return;
      }

      try {
        await wv.executeJavaScript(buildSendScript());
      } catch {
        return;
      }

      watcherRef.current = setInterval(async () => {
        try {
          const text = await wv.executeJavaScript(buildPollScript(beforeCount));
          if (text) {
            clearWatcher();
            window.api.copyToClipboard(text);
          }
        } catch {
          clearWatcher();
        }
      }, 600);

      setTimeout(clearWatcher, 120_000);
    },
  }));

  return (
    <webview
      ref={domRef}
      src={CHATGPT_URL}
      partition="persist:chatgpt"
      useragent={USER_AGENT}
      allowpopups="true"
      webpreferences="backgroundThrottling=false"
      style={{flex: 1, width: "100%", height: "100%"}}
    />
  );
});

WebViewContainer.displayName = "WebViewContainer";
export default WebViewContainer;

import {forwardRef, useRef, useImperativeHandle, useEffect} from "react";
import {delay} from "../lib/poll";
import {randomUserAgent} from "../lib/userAgents";

const CHATGPT_URL = "https://chatgpt.com";

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
  const initialUserAgent = useRef(randomUserAgent());

  const rotateUserAgent = () => {
    try {
      domRef.current?.setUserAgent(randomUserAgent());
    } catch {
      void 0;
    }
  };

  const clearWatcher = () => {
    if (watcherRef.current) {
      clearInterval(watcherRef.current);
      watcherRef.current = null;
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

  useEffect(() => () => clearWatcher(), []);

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
    getDomNode: () => domRef.current,

    reload: () => {
      rotateUserAgent();
      domRef.current?.reload();
    },

    triggerDictation,

    clearInput: () => {
      domRef.current?.executeJavaScript(buildClearInputScript()).catch(() => {});
    },

    clearAndReload: async () => {
      const wv = domRef.current;
      if (!wv) return;
      await wv.executeJavaScript(buildClearInputScript()).catch(() => {});
      await delay(400);
      rotateUserAgent();
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
      useragent={initialUserAgent.current}
      allowpopups="true"
      webpreferences="backgroundThrottling=false"
      style={{flex: 1, width: "100%", height: "100%"}}
    />
  );
});

WebViewContainer.displayName = "WebViewContainer";
export default WebViewContainer;

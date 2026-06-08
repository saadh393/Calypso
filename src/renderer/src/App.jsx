import {useRef, useState, useEffect, useCallback} from "react";
import WebViewContainer from "./components/WebViewContainer";
import VoiceButton from "./components/VoiceButton";
import {useChatGptSensor} from "./hooks/useChatGptSensor";
import {useChatGptReadiness} from "./hooks/useChatGptReadiness";
import {useRecordingWorkflow} from "./hooks/useRecordingWorkflow";
import {addClipboardHistoryItem, loadClipboardHistory, saveClipboardHistory} from "./lib/clipboardHistory";
import "./App.css";

const DONE_RESET_MS = 2000;
const DEFAULT_RECORD_SHORTCUT = "CommandOrControl+Shift+R";

function App() {
  const webviewRef = useRef(null);
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [outputMode, setOutputMode] = useState("clipboard");
  const [recordShortcut, setRecordShortcut] = useState(DEFAULT_RECORD_SHORTCUT);
  const [shortcutError, setShortcutError] = useState("");
  const [clipboardHistory, setClipboardHistory] = useState(loadClipboardHistory);
  const [webviewKey, setWebviewKey] = useState(0);

  const sensor = useChatGptSensor(webviewRef);
  const readiness = useChatGptReadiness(sensor, webviewRef, webviewKey);

  const addClipboardHistory = useCallback((text) => {
    setClipboardHistory((items) => {
      const nextItems = addClipboardHistoryItem(items, text);
      saveClipboardHistory(nextItems);
      return nextItems;
    });
  }, []);

  const {status, toggle, reset} = useRecordingWorkflow({
    webviewRef,
    sensor,
    readiness,
    addHistory: addClipboardHistory,
  });

  useEffect(() => {
    window.api.ensureMicAccess();
    window.api.getOutputMode().then(setOutputMode);
    window.api.getRecordShortcut().then((shortcut) => setRecordShortcut(shortcut || DEFAULT_RECORD_SHORTCUT));
  }, []);

  const changeOutputMode = useCallback((mode) => {
    setOutputMode(mode);
    window.api.setOutputMode(mode);
  }, []);

  const changeRecordShortcut = useCallback(async (shortcut) => {
    const result = await window.api.setRecordShortcut(shortcut);
    if (!result?.ok) {
      setShortcutError(result?.error || "Shortcut is unavailable");
      return;
    }

    setShortcutError("");
    setRecordShortcut(result.shortcut);
  }, []);

  const copyHistoryItem = useCallback(
    (text) => {
      window.api.copyToClipboard(text);
      addClipboardHistory(text);
      window.api.overlay.notice("Copied to clipboard", DONE_RESET_MS);
    },
    [addClipboardHistory],
  );

  const reloadWebviewInstance = useCallback(() => {
    reset();
    setIsLoggedIn(true);
    setWebviewKey((value) => value + 1);
  }, [reset]);

  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;

  const sendMessage = useCallback(() => {
    webviewRef.current?.send();
  }, []);

  useEffect(() => {
    window.api.onToggleRecording(() => toggleRef.current?.());
    window.api.onSendMessage(() => sendMessage());
    window.api.onReloadWebview(() => reloadWebviewInstance());
    return () => {
      window.api.offToggleRecording();
      window.api.offSendMessage();
      window.api.offReloadWebview();
    };
  }, [reloadWebviewInstance, sendMessage]);

  return (
    <div className="app">
      <WebViewContainer key={webviewKey} ref={webviewRef} onLoginState={setIsLoggedIn} />
      <VoiceButton
        status={status}
        isLoggedIn={isLoggedIn}
        readiness={readiness}
        outputMode={outputMode}
        onOutputModeChange={changeOutputMode}
        recordShortcut={recordShortcut}
        onRecordShortcutChange={changeRecordShortcut}
        shortcutError={shortcutError}
        history={clipboardHistory}
        onCopyHistoryItem={copyHistoryItem}
        onReloadWebview={reloadWebviewInstance}
      />
    </div>
  );
}

export default App;

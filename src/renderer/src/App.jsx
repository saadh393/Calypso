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
const DEFAULT_PREPARE_SECONDS = 7;

function App() {
  const webviewRef = useRef(null);
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [outputMode, setOutputMode] = useState("clipboard");
  const [recordShortcut, setRecordShortcut] = useState(DEFAULT_RECORD_SHORTCUT);
  const [shortcutError, setShortcutError] = useState("");
  const [prepareSeconds, setPrepareSeconds] = useState(DEFAULT_PREPARE_SECONDS);
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

  const {status, toggle, cancel, reset} = useRecordingWorkflow({
    webviewRef,
    sensor,
    readiness,
    addHistory: addClipboardHistory,
    prepareSeconds,
  });

  useEffect(() => {
    window.api.ensureMicAccess();
    window.api.getOutputMode().then(setOutputMode);
    window.api.getRecordShortcut().then((shortcut) => setRecordShortcut(shortcut || DEFAULT_RECORD_SHORTCUT));
    window.api.getPrepareSeconds().then((seconds) => setPrepareSeconds(seconds || DEFAULT_PREPARE_SECONDS));
  }, []);

  const changePrepareSeconds = useCallback((seconds) => {
    setPrepareSeconds(seconds);
    window.api.setPrepareSeconds(seconds);
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
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;

  const sendMessage = useCallback(() => {
    webviewRef.current?.send();
  }, []);

  useEffect(() => {
    window.api.onToggleRecording(() => toggleRef.current?.());
    window.api.onCancelRecording(() => cancelRef.current?.());
    window.api.onSendMessage(() => sendMessage());
    window.api.onReloadWebview(() => reloadWebviewInstance());
    return () => {
      window.api.offToggleRecording();
      window.api.offCancelRecording();
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
        prepareSeconds={prepareSeconds}
        onPrepareSecondsChange={changePrepareSeconds}
        history={clipboardHistory}
        onCopyHistoryItem={copyHistoryItem}
        onReloadWebview={reloadWebviewInstance}
      />
    </div>
  );
}

export default App;

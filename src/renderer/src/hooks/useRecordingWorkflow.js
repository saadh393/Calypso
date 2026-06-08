import {useCallback, useEffect, useRef, useState} from "react";
import {createRecordingWorkflow} from "../lib/recordingWorkflow";

export function useRecordingWorkflow({webviewRef, sensor, readiness, addHistory}) {
  const [status, setStatus] = useState("idle");
  const addHistoryRef = useRef(addHistory);
  addHistoryRef.current = addHistory;

  const ctrlRef = useRef(null);
  if (!ctrlRef.current) {
    ctrlRef.current = createRecordingWorkflow({
      setStatus,
      overlay: window.api.overlay,
      getSnapshot: () => sensor.getSnapshot(),
      actions: {
        triggerDictation: () => webviewRef.current?.triggerDictation(),
        clearInput: () => webviewRef.current?.clearInput(),
        clearAndReload: () => webviewRef.current?.clearAndReload(),
        reload: () => webviewRef.current?.reload(),
        deliverText: (text) => window.api.deliverText(text),
        addHistory: (text) => addHistoryRef.current?.(text),
      },
    });
  }

  useEffect(() => sensor.subscribe((snap) => ctrlRef.current.handleSnapshot(snap)), [sensor]);
  useEffect(() => ctrlRef.current.setReadiness(readiness), [readiness]);
  useEffect(() => () => ctrlRef.current.dispose(), []);

  const toggle = useCallback(() => ctrlRef.current.toggle(), []);
  const reset = useCallback(() => ctrlRef.current.reset(), []);

  return {status, toggle, reset};
}

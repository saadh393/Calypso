const DONE_RESET_MS = 2000;
const TRANSCRIBE_WAIT_MS = 5 * 60 * 1000;
const CONFIRM_START_MS = 40 * 1000;
const MAX_START_ATTEMPTS = 3;

const WAIT_MORE_ACTIONS = [
  {label: "Wait", value: "wait", variant: "primary"},
  {label: "No", value: "cancel", variant: "neutral"},
  {label: "Record again", value: "again", variant: "neutral"},
];

const UI_STATUS = {
  idle: "idle",
  preparing: "preparing",
  recording: "recording",
  transcribing: "transcribing",
  delivering: "transcribing",
  done: "done",
};

export function createRecordingWorkflow({setStatus, overlay, actions, getSnapshot}) {
  let state = "idle";
  let triggered = false;
  let delivered = false;
  let attempts = 0;
  let confirmTimer = null;
  let transcribeTimer = null;
  let doneTimer = null;
  let readiness = "preparing";

  const enter = (next) => {
    state = next;
    setStatus(UI_STATUS[next] ?? "idle");
  };

  const clearConfirm = () => {
    clearTimeout(confirmTimer);
    confirmTimer = null;
  };
  const clearTranscribe = () => {
    clearTimeout(transcribeTimer);
    transcribeTimer = null;
  };
  const clearDone = () => {
    clearTimeout(doneTimer);
    doneTimer = null;
  };
  const clearAll = () => {
    clearConfirm();
    clearTranscribe();
    clearDone();
  };

  const reset = () => {
    clearAll();
    triggered = false;
    delivered = false;
    attempts = 0;
    enter("idle");
    overlay.clear();
  };

  const fail = (message) => {
    clearAll();
    triggered = false;
    enter("idle");
    overlay.error(message);
  };

  const start = () => {
    clearAll();
    triggered = false;
    delivered = false;
    attempts = 0;
    enter("preparing");
    overlay.status("Preparing ChatGPT…", "processing", "preparing");
    actions.clearInput();
    pump();
  };

  const armConfirm = () => {
    clearConfirm();
    confirmTimer = setTimeout(() => {
      attempts += 1;
      if (attempts >= MAX_START_ATTEMPTS) {
        fail("Couldn't start recording — ChatGPT may have changed");
        return;
      }
      triggered = false;
      actions.reload();
    }, CONFIRM_START_MS);
  };

  const toRecording = () => {
    clearConfirm();
    enter("recording");
    overlay.status("Recording — speak now", "recording", "recording");
  };

  const armTranscribe = () => {
    clearTranscribe();
    transcribeTimer = setTimeout(onWaitTimeout, TRANSCRIBE_WAIT_MS);
  };

  const toTranscribing = () => {
    clearConfirm();
    delivered = false;
    enter("transcribing");
    overlay.status("Transcribing…", "processing", "transcripted");
    armTranscribe();
    pump();
  };

  async function onWaitTimeout() {
    const choice = await overlay.confirm("No transcription yet — wait more?", WAIT_MORE_ACTIONS);
    if (state !== "transcribing") return;
    if (choice === "wait") {
      overlay.status("Transcribing…", "processing", "transcripted");
      armTranscribe();
      return;
    }
    if (choice === "again") {
      actions.clearAndReload();
      reset();
      start();
      return;
    }
    reset();
  }

  async function deliver(text) {
    if (delivered) return;
    delivered = true;
    clearTranscribe();
    enter("delivering");
    const result = await actions.deliverText(text);
    actions.addHistory(text);
    actions.clearAndReload();
    enter("done");
    overlay.transcripted(result?.pasted ? "Pasted at cursor" : "Copied to clipboard", DONE_RESET_MS);
    clearDone();
    doneTimer = setTimeout(reset, DONE_RESET_MS);
  }

  const handleSnapshot = (snap) => {
    if (state === "preparing") {
      if (!triggered && snap.ready) {
        actions.triggerDictation();
        triggered = true;
        armConfirm();
      } else if (triggered && snap.dictation === "listening") {
        toRecording();
      }
    } else if (state === "recording") {
      if (snap.dictation !== "listening") toTranscribing();
    } else if (state === "transcribing") {
      if (snap.hasText && snap.text) deliver(snap.text);
    }
  };

  const pump = () => handleSnapshot(getSnapshot());

  const toggle = () => {
    if (state === "idle" || state === "done") {
      start();
    } else if (state === "preparing") {
      if (triggered) actions.triggerDictation();
      reset();
    } else if (state === "recording") {
      actions.triggerDictation();
      toTranscribing();
    }
  };

  const setReadiness = (value) => {
    readiness = value;
    if (state === "preparing" && readiness === "error") {
      fail("ChatGPT is unavailable — try Import Cookie, then reload");
    }
  };

  return {handleSnapshot, toggle, reset, setReadiness, dispose: clearAll};
}

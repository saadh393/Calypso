import {SNAPSHOT_SCRIPT} from "./chatgptSelectors";
import {withTimeout} from "./withTimeout";

const TICK_INTERVAL_MS = 400;
const EXECUTE_TIMEOUT_MS = 1500;

export const UNKNOWN_SNAPSHOT = {ready: false, dictation: "idle", hasText: false, text: ""};

const sameSnapshot = (a, b) =>
  a.ready === b.ready && a.dictation === b.dictation && a.hasText === b.hasText && a.text === b.text;

export function createChatGptSensor({getWebview, interval = TICK_INTERVAL_MS} = {}) {
  let snapshot = UNKNOWN_SNAPSHOT;
  let timer = null;
  const listeners = new Set();

  const probe = async () => {
    const wv = getWebview?.();
    if (!wv || wv.isLoading?.()) return UNKNOWN_SNAPSHOT;
    const result = await withTimeout(wv.executeJavaScript(SNAPSHOT_SCRIPT), EXECUTE_TIMEOUT_MS, null);
    if (!result || typeof result !== "object") return UNKNOWN_SNAPSHOT;
    return {
      ready: Boolean(result.ready),
      dictation: result.dictation || "idle",
      hasText: Boolean(result.hasText),
      text: result.text || "",
    };
  };

  const tick = async () => {
    let next = UNKNOWN_SNAPSHOT;
    try {
      next = await probe();
    } catch {
      next = UNKNOWN_SNAPSHOT;
    }
    if (sameSnapshot(next, snapshot)) return;
    snapshot = next;
    listeners.forEach((fn) => fn(snapshot));
  };

  return {
    start() {
      if (timer) return;
      timer = setInterval(tick, interval);
      tick();
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

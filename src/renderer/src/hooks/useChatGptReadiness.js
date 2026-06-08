import {useEffect, useState} from "react";

const POLL_INTERVAL_MS = 3000;
const POLLS_PER_ATTEMPT = 20;
const MAX_RELOADS = 5;

const READINESS_ERROR =
  "ChatGPT did not become ready. The page may have changed or you may be signed out. Try Import Cookie, then restart the app.";

export function useChatGptReadiness(sensor, webviewRef, reloadKey = 0) {
  const [readiness, setReadiness] = useState("preparing");

  useEffect(() => {
    setReadiness("preparing");
    let polls = 0;
    let reloads = 0;
    let stopped = false;
    let id = null;

    const tick = () => {
      if (stopped) return;

      if (sensor.getSnapshot()?.ready) {
        stopped = true;
        clearInterval(id);
        setReadiness("ready");
        return;
      }

      polls += 1;
      if (polls < POLLS_PER_ATTEMPT) return;

      polls = 0;
      if (reloads >= MAX_RELOADS) {
        stopped = true;
        clearInterval(id);
        setReadiness("error");
        window.api.notifyError(READINESS_ERROR);
        return;
      }

      reloads += 1;
      webviewRef.current?.reload();
    };

    tick();
    id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [sensor, webviewRef, reloadKey]);

  return readiness;
}

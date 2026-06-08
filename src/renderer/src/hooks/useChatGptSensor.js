import {useEffect, useRef} from "react";
import {createChatGptSensor} from "../lib/chatgptSensor";

export function useChatGptSensor(webviewRef) {
  const sensorRef = useRef(null);
  if (!sensorRef.current) {
    sensorRef.current = createChatGptSensor({getWebview: () => webviewRef.current?.getDomNode()});
  }

  useEffect(() => {
    const sensor = sensorRef.current;
    sensor.start();
    return () => sensor.stop();
  }, []);

  return sensorRef.current;
}

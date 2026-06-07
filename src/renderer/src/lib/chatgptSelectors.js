export const SELECTORS = {
  composer: '#prompt-textarea',
  startDictation: 'button[aria-label="Start dictation"]',
  submitDictation: '[aria-label="Submit dictation"]',
  canvas: 'canvas',
  sendButton: '[data-testid="send-button"]',
  stopButton: '[data-testid="stop-button"]',
  assistantMessage: '[data-message-author-role="assistant"]'
}

const exists = (selector) => `document.querySelector(${JSON.stringify(selector)})`
const missing = (selector) => `!document.querySelector(${JSON.stringify(selector)})`

export const READINESS_SCRIPT = `(() => Boolean(${exists(SELECTORS.composer)} && ${exists(SELECTORS.startDictation)}))()`

export const RECORDING_STARTED_SCRIPT = `(() => Boolean(${missing(SELECTORS.startDictation)} && ${exists(SELECTORS.canvas)}))()`

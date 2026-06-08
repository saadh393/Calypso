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

export const SNAPSHOT_SCRIPT = `
  (() => {
    const composer = ${exists(SELECTORS.composer)};
    const ready = Boolean(composer && ${exists(SELECTORS.startDictation)});
    const el = composer || ${exists('[contenteditable="true"]')};
    const text = el ? (el.value || el.innerText || el.textContent || '').trim() : '';
    let dictation = 'idle';
    if (${exists('canvas.h-14')}) dictation = 'listening';
    else if (${exists(SELECTORS.submitDictation)}) dictation = 'transcribing';
    return { ready, dictation, hasText: Boolean(text && ${exists(SELECTORS.sendButton)}), text };
  })()
`

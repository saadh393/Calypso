export const DICTATION_STATE_SCRIPT = `
  (() => {
    if (document.querySelector('canvas.h-14')) return 'listening';
    if (document.querySelector('[aria-label="Submit dictation"]')) return 'transcribing';
    const el = document.querySelector('#prompt-textarea, [contenteditable="true"]');
    const text = el ? (el.value || el.innerText || el.textContent || '').trim() : '';
    if (text && document.querySelector('[data-testid="send-button"]')) return 'ready';
    return 'idle';
  })()
`

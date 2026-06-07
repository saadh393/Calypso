const MODES = [
  { value: 'clipboard', label: 'Clipboard' },
  { value: 'paste', label: 'Paste' }
]

function OutputModeToggle({ value, onChange }) {
  return (
    <div className="output-toggle" role="group" title="Where transcribed text goes">
      {MODES.map((mode) => (
        <button
          key={mode.value}
          className={`output-toggle-btn${value === mode.value ? ' active' : ''}`}
          onClick={() => onChange(mode.value)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  )
}

export default OutputModeToggle

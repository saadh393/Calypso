const MIN_SECONDS = 5;
const MAX_SECONDS = 20;

function PrepareTimeoutSlider({value, onChange}) {
  return (
    <div className="slider-row" title="How long to wait before reloading and retrying">
      <input
        type="range"
        className="slider-input"
        min={MIN_SECONDS}
        max={MAX_SECONDS}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="slider-value">{value}s</span>
    </div>
  );
}

export default PrepareTimeoutSlider;

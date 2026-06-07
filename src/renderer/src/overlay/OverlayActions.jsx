function OverlayActions({ actions, onChoose }) {
  return (
    <div className="actions">
      {actions.map((action) => (
        <button
          key={action.value}
          className={`action ${action.variant || 'neutral'}`}
          onClick={() => onChoose(action.value)}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}

export default OverlayActions

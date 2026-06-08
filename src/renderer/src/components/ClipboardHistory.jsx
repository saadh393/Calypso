function ClipboardHistory({ items, onCopy }) {
  if (items.length === 0) {
    return <div className="history-empty">No copied text yet</div>
  }

  return (
    <div className="history-list">
      {items.map((item) => (
        <div key={item} className="history-row">
          <div className="history-item">{item}</div>
          <button className="history-copy" onClick={() => onCopy(item)}>
            Copy
          </button>
        </div>
      ))}
    </div>
  )
}

export default ClipboardHistory

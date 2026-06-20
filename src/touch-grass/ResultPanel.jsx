const TIER_LABEL = {
  common:    { text: 'Common',    color: null },
  uncommon:  { text: 'Uncommon',  color: '#3ab0c0' },
  rare:      { text: 'Rare',      color: '#c49830' },
  legendary: { text: 'Legendary', color: '#c060e0' },
}

function formatDuration(minutes) {
  if (minutes < 1) return 'less than a minute'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function ResultPanel({ lastWalk, onGoBack }) {
  const { durationMinutes, tier, discovery, isStatic, apiAttempted } = lastWalk
  const { text: tierText, color: tierColor } = TIER_LABEL[tier] ?? TIER_LABEL.common

  return (
    <div style={{ position: 'relative' }}>
      <h1>Your find.</h1>
      <p>
        {formatDuration(durationMinutes)} · {tierColor
          ? <span style={{ color: tierColor }}>{tierText}</span>
          : tierText}
      </p>
      <h2>{discovery.name}</h2>
      <p>{discovery.description}</p>
      <button onClick={onGoBack}>Step inside</button>
      {isStatic && apiAttempted && (
        <p style={{ position: 'absolute', bottom: 0, right: 0, fontSize: '11px', opacity: 0.4, margin: 0, whiteSpace: 'nowrap' }}>
          ⚠ the oracle was silent
        </p>
      )}
    </div>
  )
}

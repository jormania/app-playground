const TIER_LABEL = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
}

function formatDuration(minutes) {
  if (minutes < 1) return 'less than a minute'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function ResultPanel({ lastWalk, onDepart }) {
  const { durationMinutes, tier, discovery } = lastWalk

  return (
    <div>
      <h1>You found something.</h1>
      <p>Walk: {formatDuration(durationMinutes)} · {TIER_LABEL[tier]}</p>
      <h2>{discovery.name}</h2>
      <p>{discovery.description}</p>
      <button onClick={onDepart}>Head outside again</button>
    </div>
  )
}

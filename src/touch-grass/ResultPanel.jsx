import { starPath } from './Sparkle.jsx'

const TIER_LABEL = {
  common:    { text: 'Common',    color: null },
  uncommon:  { text: 'Uncommon',  color: '#3ab0c0' },
  rare:      { text: 'Rare',      color: '#c49830' },
  legendary: { text: 'Legendary', color: '#c060e0' },
}

// rarity rises with the star's points (a seed, then 4-, 6-, 8-pointed); the sigil
// sits between the rarity and its esoteric auspice, doubling as the divider
const TIER_STAR = { uncommon: [4, 6.6, 2.0], rare: [6, 6.9, 2.7], legendary: [8, 7.0, 2.7] }
const AUSPICE = { common: 'a faint omen', uncommon: 'a stirring', rare: 'a true sign', legendary: 'an omen of the deep' }
function TierSigil({ tier }) {
  const color = (TIER_LABEL[tier] || TIER_LABEL.common).color || '#c7cdba'
  const s = TIER_STAR[tier]
  return (
    <svg className="tg-auspice-sigil" viewBox="0 0 16 16" aria-hidden="true">
      {s ? <path d={starPath(...s)} fill={color} /> : <circle cx="8" cy="8" r="2.3" fill={color} />}
    </svg>
  )
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
    <div style={{ position: 'relative' }} role="status" aria-live="polite">
      <h1>Your find.</h1>
      <p>
        {formatDuration(durationMinutes)}<TierSigil tier={tier} />{tierColor
          ? <span style={{ color: tierColor }}>{tierText}</span>
          : tierText}<TierSigil tier={tier} /><span className="tg-auspice">{AUSPICE[tier] || AUSPICE.common}</span>
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

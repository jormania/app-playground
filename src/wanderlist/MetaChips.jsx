import { PlaceIcon, CoinIcon } from './icons.jsx'
import { categoryGlyph } from './categoryIcons.js'
import { mapsLink } from './links.js'

// Shared presentation of an item's chips, used in list rows and the detail view. An optional
// Cost line (in lei) sits just above the chips — shown whenever a cost is set EXCEPT on
// anything tagged `free` (a price on a free thing is a contradiction, so it's hidden there).
// Category and Tags merge onto one line, in that order (colour tells them apart — Category
// is plum, Tags blue — and Category also carries a small type icon), and Place always sits
// on its own row underneath, last — its pin icon doubles as a Maps link. When `onChip` is
// given, each value is a button that filters the list by it. Renders nothing when empty.
export default function MetaChips({ category, place, placeUrl, tags = [], cost = null, onChip }) {
  const topChips = [
    ...(category ? [{ scope: 'category', kind: 'category', value: category }] : []),
    ...(tags || []).map(t => ({ scope: 'tags', kind: 'tag', value: t })),
  ]
  const isFree = (tags || []).includes('free')
  const showCost = cost != null && cost !== '' && !isFree
  if (topChips.length === 0 && !place && !showCost) return null

  const chip = ({ scope, kind, value }) => {
    const content = <>{kind === 'category' && categoryGlyph(value)}{value}</>
    return onChip
      ? <button key={`${kind}-${value}`} type="button" className={`chip ${kind}`}
          onClick={e => { e.stopPropagation(); onChip(scope, value) }} title={`Filter by ${value}`}>{content}</button>
      : <span key={`${kind}-${value}`} className={`chip ${kind}`}>{content}</span>
  }

  return (
    <div className="meta">
      {showCost && (
        <div className="meta-row cost-row">
          <span className="field-label"><CoinIcon /></span>
          <span className="cost-value">{cost} lei</span>
        </div>
      )}
      {topChips.length > 0 && <div className="meta-row">{topChips.map(chip)}</div>}
      {place && (
        <div className="meta-row place-row">
          {(() => {
            const href = mapsLink(place, placeUrl)
            return href
              ? <a className="field-label place-pin" href={href} target="_blank" rel="noopener"
                  title="Open in Maps" onClick={e => e.stopPropagation()}><PlaceIcon /></a>
              : <span className="field-label"><PlaceIcon /></span>
          })()}
          {chip({ scope: 'place', kind: 'place', value: place })}
        </div>
      )}
    </div>
  )
}

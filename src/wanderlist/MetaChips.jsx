import { PlaceIcon, CoinIcon } from './icons.jsx'
import { categoryGlyph } from './categoryIcons.js'
import { mapsLink } from './links.js'

// Shared presentation of an item's chips, used in list rows, the calendar agenda, the map
// and the detail view. Two rows at most:
//   1. Cost · Category · Tags — Cost (in lei) leads as a gold chip, shown whenever a cost
//      is set EXCEPT on anything tagged `free` (a price on a free thing is a contradiction,
//      so it's hidden there). Cost is never a filter, so it stays a plain span. Colour
//      tells the rest apart: Category is plum (plus a small type icon), Tags blue.
//   2. Place — the pin and the chip share the row, the pin doubling as a Maps link. With
//      `compact` (list/agenda cards) the chip is one line, ellipsized, the full address in
//      its tooltip; without it (detail view) the chip wraps beside the pin.
// When `onChip` is given, each Category/Tag/Place value is a button that filters the list
// by it. Renders nothing when empty.
export default function MetaChips({ category, place, placeUrl, tags = [], cost = null, onChip, compact = false }) {
  const topChips = [
    ...(category ? [{ scope: 'category', kind: 'category', value: category }] : []),
    ...(tags || []).map(t => ({ scope: 'tags', kind: 'tag', value: t })),
  ]
  const isFree = (tags || []).includes('free')
  const showCost = cost != null && cost !== '' && !isFree
  if (topChips.length === 0 && !place && !showCost) return null

  const chip = ({ scope, kind, value }) => {
    const content = kind === 'place'
      ? <span className="chip-text">{value}</span>
      : <>{kind === 'category' && categoryGlyph(value)}{value}</>
    const title = onChip ? `Filter by ${value}` : kind === 'place' ? value : undefined
    return onChip
      ? <button key={`${kind}-${value}`} type="button" className={`chip ${kind}`}
          onClick={e => { e.stopPropagation(); onChip(scope, value) }} title={title}>{content}</button>
      : <span key={`${kind}-${value}`} className={`chip ${kind}`} title={title}>{content}</span>
  }

  const href = place ? mapsLink(place, placeUrl) : null

  return (
    <div className={`meta${compact ? ' compact' : ''}`}>
      {(showCost || topChips.length > 0) && (
        <div className="meta-row">
          {showCost && <span className="chip cost" title="Cost"><CoinIcon />{cost} lei</span>}
          {topChips.map(chip)}
        </div>
      )}
      {place && (
        <div className="meta-row place-row">
          {href
            ? <a className="field-label place-pin" href={href} target="_blank" rel="noopener"
                title="Open in Maps" aria-label="Open in Maps" onClick={e => e.stopPropagation()}><PlaceIcon /></a>
            : <span className="field-label"><PlaceIcon /></span>}
          {chip({ scope: 'place', kind: 'place', value: place })}
        </div>
      )}
    </div>
  )
}

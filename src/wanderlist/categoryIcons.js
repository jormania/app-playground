// A small icon per known Category value, so the list scans by type at a glance without
// relying on colour alone. Categories are freeform (you can add your own inline in the
// editor) — anything outside this curated set falls back to the generic folder glyph.
import { createElement } from 'react'
import { CalendarIcon, PlaceIcon, TextIcon, BulbIcon, FilmIcon, PaletteIcon, CompassIcon, MaskIcon, MusicIcon, CategoryIcon } from './icons.jsx'

const MAP = {
  event: CalendarIcon,
  venue: PlaceIcon,
  idea: BulbIcon,
  movie: FilmIcon,
  art: PaletteIcon,
  discovery: CompassIcon,
  culture: TextIcon,
  play: MaskIcon,
  concert: MusicIcon,
}

export function categoryIcon(category) {
  const key = String(category || '').trim().toLowerCase()
  return MAP[key] || CategoryIcon
}

// The rendered element for a category's glyph. Callers use this rather than holding the
// component in a local (`const Icon = categoryIcon(x); <Icon />`) — the components here
// are static module-level references, but that pattern is indistinguishable from creating
// a component during render, which the react-hooks/static-components lint rule rejects.
export function categoryGlyph(category, props) {
  return createElement(categoryIcon(category), props)
}

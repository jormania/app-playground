// A small icon per known Category value, so the list scans by type at a glance without
// relying on colour alone. Categories are freeform (you can add your own inline in the
// editor) — anything outside this curated set falls back to the generic folder glyph.
import { CalendarIcon, PlaceIcon, TextIcon, BulbIcon, FilmIcon, PaletteIcon, CompassIcon, CategoryIcon } from './icons.jsx'

const MAP = {
  event: CalendarIcon,
  venue: PlaceIcon,
  idea: BulbIcon,
  movie: FilmIcon,
  art: PaletteIcon,
  discovery: CompassIcon,
  culture: TextIcon,
}

export function categoryIcon(category) {
  const key = String(category || '').trim().toLowerCase()
  return MAP[key] || CategoryIcon
}

import type { Category, Colour, Home, Mood, Style, Verdict, Warmth } from './vocabulary.ts'

/** One item of clothing. Mirrors the "Fit Check — Garments" Notion database. */
export interface Garment {
  id: string
  name: string
  /** Notion's file URL. Signed and short-lived — never persist it, see lib/imageCache. */
  photoUrl: string | null
  /** Tiny placeholder (base64 LQIP, or an `#rrggbb` average colour) for instant paint. */
  thumb: string | null
  category: Category | null
  colours: Colour[]
  warmth: Warmth | null
  styles: Style[]
  home: Home
  favourite: boolean
  wearCount: number
  /** YYYY-MM-DD, or null if never worn. */
  lastWorn: string | null
  /** False = archived out of suggestions, but not deleted. */
  active: boolean
}

/** One outfit that was suggested and acted on. Mirrors "Fit Check — Outfits". */
export interface Outfit {
  id: string
  name: string
  /** YYYY-MM-DD. */
  date: string
  garmentIds: string[]
  mood: Mood | null
  /** Human-readable snapshot, e.g. "8°C, rain". */
  weather: string
  verdict: Verdict | null
  favourite: boolean
}

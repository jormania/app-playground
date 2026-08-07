import type { Category, Colour, Mood, Style, Verdict, Warmth } from './vocabulary.ts'

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
  /**
   * Which wardrobes this garment lives in — Notion page ids, many-to-many.
   * Two ids is the old "Both"; zero is allowed and means unfiled (see
   * lib/wardrobes.ts for why that state is supported rather than prevented).
   */
  wardrobeIds: string[]
  favourite: boolean
  wearCount: number
  /** YYYY-MM-DD, or null if never worn. */
  lastWorn: string | null
  /**
   * True = put away: out of the grid and out of suggestions, but not deleted.
   *
   * Named for the negative on purpose. It was `active`, which collided with
   * `Wardrobe.active` (a different idea — "temporarily hidden") and read
   * identically at a glance. Inverting also fixes a real wart: Notion can't
   * distinguish an unset checkbox from `false`, so `active` needed an explicit
   * `true` on every create, whereas `archived` wants exactly the default.
   */
  archived: boolean
  /**
   * True = lost, gifted, or permanently retired. Excluded from grid and suggestions.
   */
  retired: boolean
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
  /**
   * Which wardrobe(s) this was worn in, by page id — usually zero or one:
   * empty when the suggestion was made under "All", populated with the
   * wardrobe being filtered to otherwise. Added alongside Garments' own
   * relation (M5) while the table was still empty, so "what did I wear at
   * Dad's?" is answerable without a later migration.
   */
  wardrobeIds: string[]
}

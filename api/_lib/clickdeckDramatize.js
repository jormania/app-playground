// JS twin of scripts/dramatize-journal.py's keyword-highlight logic — kept
// in sync the same deliberate-duplication way scripts/backfill-steam-ids.py
// mirrors steamMatch.js. This copy is what the nightly cron
// (api/clickdeck-pricing.js) actually runs; the Python script remains for
// ad-hoc manual runs against the same DB. Keep both in sync if the THEMES
// table or the matching/merge rules change.

export const THEMES = [
  { keywords: ['horror', 'terrifying', 'creepy', 'macabre', 'murder', 'death', 'blood', 'fear', 'scare', 'scary', 'gruesome', 'tension', 'claustrophobic'], format: { color: 'red', bold: true } },
  { keywords: ['cyberpunk', 'hacking', 'neon', 'sci-fi', 'future', 'robot', 'ai', 'technology', 'dystopian', 'space', 'synth', 'cyber'], format: { color: 'purple', italic: true } },
  { keywords: ['mystery', 'detective', 'puzzle', 'clue', 'enigma', 'investigation', 'noir', 'secret', 'hidden', 'truth'], format: { color: 'blue' } },
  { keywords: ['classic', 'masterpiece', 'brilliant', 'beautiful', 'gorgeous', 'stunning', 'amazing', 'incredible', 'masterclass'], format: { color: 'orange', bold: true } },
  { keywords: ['funny', 'comedy', 'hilarious', 'humor', 'satire', 'sarcastic', 'cynical', 'laugh', 'joke', 'witty'], format: { color: 'green', italic: true } },
  { keywords: ['atmospheric', 'vibe', 'mood', 'soundtrack', 'music', 'art', 'pixel', 'isometric', 'graphics', 'visuals'], format: { color: 'pink' } },
  { keywords: ['story', 'narrative', 'plot', 'writing', 'characters', 'dialogue', 'choice', 'consequence'], format: { color: 'yellow', underline: true } }
]

const keywordToTheme = {}
for (const theme of THEMES) {
  for (const kw of theme.keywords) keywordToTheme[kw.toLowerCase()] = theme.format
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const allKeywords = Object.keys(keywordToTheme).sort((a, b) => b.length - a.length)
const keywordRegex = new RegExp(`\\b(${allKeywords.map(escapeRegExp).join('|')})\\b`, 'gi')

// The theme table above only ever assigns one of these colors — a run
// carrying any of them is proof a prior dramatize pass already highlighted
// this entry. Anything else (plain bold from an unrelated editorial pass,
// a color outside this set, or no formatting at all) is NOT proof of a
// prior run and should still be processed.
export const THEME_COLORS = new Set(THEMES.map(t => t.format.color))

export function alreadyHasThemeHighlight(richTextArray) {
  return (richTextArray || []).some(rt => THEME_COLORS.has(rt.annotations?.color))
}

const MAX_HIGHLIGHTS_PER_ENTRY = 3

function buildSegment(content, annots, link) {
  const seg = { type: 'text', text: { content } }
  if (link) seg.text.link = link
  seg.annotations = {
    bold: Boolean(annots.bold),
    italic: Boolean(annots.italic),
    strikethrough: Boolean(annots.strikethrough),
    underline: Boolean(annots.underline),
    code: Boolean(annots.code),
    color: annots.color || 'default'
  }
  return seg
}

// Walks the EXISTING rich_text runs (not a flattened plain-text rebuild) so
// an entry with prior manual formatting (e.g. bold emphasis from an
// editorial pass unrelated to this logic) keeps that formatting on every
// segment this function doesn't touch — only matched keyword spans get the
// theme's color/extra emphasis layered on top (bold/italic/underline are
// OR'd with whatever the run already had, never cleared).
export function dramatizeRichText(richTextArray) {
  const segments = []
  let highlighted = 0
  for (const rt of richTextArray) {
    const text = rt.text?.content || ''
    const baseAnnots = rt.annotations || {}
    const link = rt.text?.link
    let lastEnd = 0
    keywordRegex.lastIndex = 0
    let match
    while ((match = keywordRegex.exec(text)) !== null) {
      if (highlighted >= MAX_HIGHLIGHTS_PER_ENTRY) break
      const start = match.index
      const end = start + match[0].length
      const matchedWord = match[1]
      if (start > lastEnd) segments.push(buildSegment(text.slice(lastEnd, start), baseAnnots, link))
      const fmt = keywordToTheme[matchedWord.toLowerCase()]
      const merged = {
        bold: Boolean(baseAnnots.bold) || Boolean(fmt.bold),
        italic: Boolean(baseAnnots.italic) || Boolean(fmt.italic),
        strikethrough: Boolean(baseAnnots.strikethrough),
        underline: Boolean(baseAnnots.underline) || Boolean(fmt.underline),
        code: Boolean(baseAnnots.code),
        color: fmt.color || 'default'
      }
      segments.push(buildSegment(matchedWord, merged, link))
      lastEnd = end
      highlighted++
    }
    if (lastEnd < text.length) segments.push(buildSegment(text.slice(lastEnd), baseAnnots, link))
  }
  return { segments, highlighted }
}

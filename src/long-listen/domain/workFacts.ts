/**
 * A work's facts, said for a listener rather than a musicologist. The
 * curator gives a catalogue number ("FS 76"), a date ("1914–16") and a form
 * ("symphony"); this turns them into "Symphony · written 1914–16, about 110
 * years ago" and "No. 76 in Nielsen's catalogue (FS)". Nothing is added that
 * the curator didn't give: an unknown catalogue prefix is shown as given, and
 * a date that doesn't parse gets no "years ago".
 */

/** Catalogue prefixes a listener meets on album covers, with whose list they are. */
const CATALOGUES: { re: RegExp; whose: string }[] = [
  { re: /^BWV\b/i, whose: 'Bach’s' },
  { re: /^BuxWV\b/i, whose: 'Buxtehude’s' },
  { re: /^HWV\b/i, whose: 'Handel’s' },
  { re: /^TWV\b/i, whose: 'Telemann’s' },
  { re: /^RV\b/i, whose: 'Vivaldi’s' },
  { re: /^SWV\b/i, whose: 'Schütz’s' },
  { re: /^Kk?\.?\s?(?=\d)/, whose: '' }, // resolved below: K. Mozart (Köchel), Kk. Scarlatti (Kirkpatrick)
  { re: /^KV\b/i, whose: 'Mozart’s' },
  { re: /^Hob\b/i, whose: 'Haydn’s' },
  { re: /^D\.?\s?(?=\d)/, whose: 'Schubert’s' },
  { re: /^WAB\b/i, whose: 'Bruckner’s' },
  { re: /^WWV\b/i, whose: 'Wagner’s' },
  { re: /^MWV\b/i, whose: 'Mendelssohn’s' },
  { re: /^TrV\b/i, whose: 'Richard Strauss’s' },
  { re: /^(S|LW)\.?\s?(?=[A-Z]?\d)/, whose: 'Liszt’s' },
  { re: /^B\.?\s?(?=\d)/, whose: 'Dvořák’s' },
  { re: /^JW\b/i, whose: 'Janáček’s' },
  { re: /^FS\b/i, whose: 'Nielsen’s' },
  { re: /^JS\b/i, whose: 'Sibelius’s' },
  { re: /^(Sz|BB)\.?\s?(?=\d)/, whose: 'Bartók’s' },
  { re: /^L\.?\s?(?=\d)/, whose: 'Debussy’s' },
  { re: /^M\.?\s?(?=\d)/, whose: 'Ravel’s' },
  { re: /^Z\.?\s?(?=\d)/, whose: 'Purcell’s' },
  { re: /^TH\b/i, whose: 'Tchaikovsky’s' },
]

/** One catalogue reference, e.g. "FS 76" → "No. 76 in Nielsen's catalogue (FS)". */
export function catalogueWords(raw: string, composer = ''): string {
  const ref = raw.trim()
  if (!ref) return ''
  // Opus: the composer's own publication number.
  const op = /^Op(?:us|\.)?\s*(\d+[a-z]?)(?:,?\s*No\.?\s*(\d+))?/i.exec(ref)
  if (op) return op[2] ? `Opus ${op[1]}, no. ${op[2]}` : `Opus ${op[1]}`
  if (/^WoO\b/i.test(ref)) {
    const n = /(\d+)/.exec(ref)?.[1]
    return n ? `No. ${n} among the works without an opus number (WoO)` : ref
  }
  for (const c of CATALOGUES) {
    const m = c.re.exec(ref)
    if (!m) continue
    const code = ref.slice(0, m[0].length).replace(/[.\s]+$/, '')
    const num = ref.slice(m[0].length).replace(/^[.\s]+/, '')
    if (!/\d/.test(num)) return ref
    let whose = c.whose
    if (!whose) whose = /^Kk/i.test(code) || /scarlatti/i.test(composer) ? 'Domenico Scarlatti’s' : 'Mozart’s'
    return `No. ${num} in ${whose} catalogue (${code})`
  }
  return ref
}

/** All the references in a catalogue field ("Op. 29, FS 76"), each in words. */
export function catalogueLine(catalogue: string | undefined, composer = ''): string {
  if (!catalogue?.trim()) return ''
  return catalogue.split(/\s*[;,]\s*(?=[A-Za-z])/).map((part) => catalogueWords(part, composer)).filter(Boolean).join(' · ')
}

/** "symphony", "1914–16" → "Symphony · written 1914–16, about 110 years ago". */
export function whatAndWhen(form: string | undefined, composed: string | undefined, now: Date = new Date()): string {
  const what = form?.trim() ? form.trim().charAt(0).toUpperCase() + form.trim().slice(1) : ''
  let when = ''
  if (composed?.trim()) {
    const year = Number(/\b(1[0-9]{3}|20[0-9]{2})\b/.exec(composed)?.[1])
    const ago = year ? now.getFullYear() - year : NaN
    when = `written ${composed.trim()}`
    if (ago >= 2) when += `, about ${ago >= 30 ? Math.round(ago / 5) * 5 : ago} years ago`
    else if (ago >= 0) when += ', just recently'
  }
  return [what, when].filter(Boolean).join(' · ')
}

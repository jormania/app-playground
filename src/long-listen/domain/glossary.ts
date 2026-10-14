/**
 * Words on tap (release four): the terms in the curator's notes a listener
 * might stop at — forms, techniques, textures — each found once per passage
 * and given a faint dotted underline. A tap asks the curator for two lines,
 * once per term (journey.define), kept and shown wherever the term recurs.
 *
 * A closed list, not the model's guess: what is underlined has to be
 * predictable, and a list costs nothing to find in a passage. Longer terms
 * first, so "sonata form" wins over "sonata" and "double bass" isn't "bass".
 * Everyday words that are also terms (tempo, texture, development, march,
 * grave) are left out: underlined in "the development of his style" they'd be
 * wrong, and nobody stops at them.
 */
const TERMS = [
  // forms and genres
  'sonata form', 'sonata-allegro', 'rondo', 'scherzo', 'minuet', 'trio section', 'passacaglia', 'chaconne', 'fugue', 'fugato', 'canon',
  'theme and variations', 'symphonic poem', 'tone poem', 'concerto grosso', 'sinfonia concertante', 'divertimento', 'serenade',
  'overture', 'prelude', 'intermezzo', 'nocturne', 'rhapsody', 'cantata', 'oratorio', 'requiem', 'song cycle', 'ballade',
  'toccata', 'fantasia', 'waltz', 'ländler', 'siciliano', 'barcarolle', 'habanera', 'bolero', 'polonaise', 'mazurka', 'tarantella',
  // structure
  'exposition', 'recapitulation', 'coda', 'codetta', 'cadenza', 'cadence', 'second subject', 'first subject',
  'leitmotif', 'motif', 'idée fixe', 'cyclic form', 'ostinato', 'pedal point', 'ground bass', 'cantus firmus', 'chorale',
  // harmony and line
  'counterpoint', 'polyphony', 'homophony', 'canonic', 'modulation', 'chromaticism', 'dissonance', 'consonance', 'atonal', 'atonality',
  'twelve-tone', 'serialism', 'tonality', 'major key', 'minor key', 'pentatonic', 'whole-tone',
  'polytonality', 'tone cluster', 'microtonal', 'spectralism', 'minimalism', 'neoclassicism', 'impressionism',
  'hemiola', 'syncopation', 'polyrhythm', 'rubato', 'appoggiatura', 'tremolo', 'trill', 'glissando', 'portamento',
  // tempo and dynamics
  'adagio', 'andante', 'allegro', 'presto', 'largo', 'lento', 'moderato', 'allegretto', 'vivace', 'accelerando', 'ritardando',
  'crescendo', 'diminuendo', 'decrescendo', 'sforzando', 'pianissimo', 'fortissimo', 'tutti', 'ritornello', 'sostenuto', 'staccato', 'legato',
  // the orchestra's sounds
  'pizzicato', 'col legno', 'sul ponticello', 'sul tasto', 'con sordino', 'divisi', 'double stops', 'arpeggio',
  'stopped horn', 'flutter-tongue', 'cor anglais', 'english horn', 'contrabassoon', 'bass clarinet', 'celesta', 'glockenspiel', 'timpani',
  'double bass', 'ondes martenot', 'continuo', 'basso continuo', 'obbligato', 'concertino', 'ripieno', 'orchestration',
  // performance
  'period instruments', 'historically informed', 'vibrato', 'timbre',
]

const SORTED = [...new Set(TERMS)].sort((a, b) => b.length - a.length)
// A space in a term matches any run of spaces, a no-break space included ("idée\u00a0fixe").
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
const FINDER = new RegExp(`(?<![\\p{L}\\p{N}-])(${SORTED.map(escape).join('|')})(?![\\p{L}\\p{N}-])`, 'giu')

/** A passage, cut into plain text and terms. */
export type Piece = string | { term: string; text: string }

/**
 * The passage with its terms marked: each term once per passage (the first
 * time), in the passage's own case. `skip` holds terms already marked, for a
 * caller that wants one mark across several passages (none does yet: each
 * paragraph and each "listen for" point is a passage of its own).
 */
export function glossPieces(raw: string, skip: Set<string> = new Set()): Piece[] {
  // Composed accents first: "idée" typed as e + combining accent is the same word.
  const text = raw.normalize('NFC')
  const out: Piece[] = []
  let at = 0
  for (const m of text.matchAll(FINDER)) {
    const term = m[1].toLowerCase().replace(/\s+/g, ' ')
    if (skip.has(term)) continue
    skip.add(term)
    if (m.index > at) out.push(text.slice(at, m.index))
    out.push({ term, text: m[1] })
    at = m.index + m[1].length
  }
  if (at < text.length) out.push(text.slice(at))
  return out
}

/** The sentence around a term, for the curator to choose the sense meant (a "development" is not always sonata form's). */
export function sentenceAround(text: string, term: string): string {
  const sentences = text.normalize('NFC').split(/(?<=[.!?])\s+/)
  // As a word, as the finder reads it: "lied" is not in "relied".
  const word = new RegExp(`(?<![\\p{L}\\p{N}-])${escape(term)}(?![\\p{L}\\p{N}-])`, 'iu')
  return (sentences.find((x) => word.test(x)) ?? text).slice(0, 400)
}

/** The store's key for a term's definition, per language. */
export const termMark = (term: string, language: string) => `term:${language}:${term.toLowerCase()}`

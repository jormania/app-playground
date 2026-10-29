import { fold, nameKey, surname, workTitleKey } from '../domain/identity'
import type { ProposedRecording } from '../domain/types'

/**
 * Does a Spotify track carry the recording the curator proposed?
 *
 * This is the factual check behind every Spotify link in the app. The curator
 * names a work and its performers; Spotify returns tracks with a title and an
 * artist list. A track only counts if it is the right WORK *and* the right
 * PERFORMERS — "Beethoven 5" by anyone is not "Beethoven 5, Kleiber / Vienna".
 *
 *   strong   — the composer is named, the work title matches, and every named
 *              performer is credited. Accepted as the recording.
 *   probable — composer named, work mostly matches, the conductor (or first
 *              soloist) is credited but someone else isn't. Might be the same
 *              recording credited differently, might be another one by the
 *              same conductor; only the listener can say, so it is held as
 *              `unconfirmed` and never linked, played or counted until they do.
 *   none     — anything less, or a track that contradicts the proposal (another
 *              catalogue number, a release older than the recording). The UI
 *              says "not found on Spotify" rather than link a different
 *              interpretation.
 */
export interface SpotifyTrackLike {
  id: string
  name: string
  uri: string
  artists: { name: string; id?: string }[]
  album?: { id: string; name: string; release_date?: string }
  track_number?: number
  disc_number?: number
  duration_ms?: number
  /** The id that was asked for, when Spotify relinked the track for the listener's market. */
  linked_from?: { id?: string }
}

export type MatchLevel = 'strong' | 'probable' | 'none'

// Orchestras are billed in several languages, and German runs a band's words together
// ("Gewandhausorchester", Dutch "Concertgebouworkest"): one spelling for both sides.
const ORCHESTRA_WORDS: [RegExp, string][] = [
  [/\b(\w+?)(?:orchester|orkest)\b/g, '$1 orchestra'],
  [/\bsaint\b|\bsankt\b/g, 'st'],
  [/\bwiener\b/g, 'vienna'],
  [/\bberliner\b/g, 'berlin'],
  [/\bleningrader\b/g, 'leningrad'],
  [/\bmunchner\b/g, 'munich'],
  [/\bbayerisch(?:e|en|es|er)?\b/g, 'bavarian'],
  [/\brundfunks?\b/g, 'radio'],
  [/\bceska\b/g, 'czech'],
  [/\bstaats\b/g, 'state'],
  [/\bkammer\b/g, 'chamber'],
  [/\bphilharmoniker\b/g, 'philharmonic'],
  [/\bphilharmonie\b/g, 'philharmonic'],
  [/\bphilharmonique\b/g, 'philharmonic'],
  [/\bfil(?:h)?armoni(?:a|ca|e|c)\b/g, 'philharmonic'],
  [/\bsymphoniker\b/g, 'symphony'],
  [/\bsinfonie\b/g, 'symphony'],
  [/\bsymphonie\b/g, 'symphony'],
  [/\bsymphonique\b/g, 'symphony'],
  [/\bsinfonica\b/g, 'symphony'],
  [/\borchestre\b/g, 'orchestra'],
  [/\borchester\b/g, 'orchestra'],
  [/\borquesta\b/g, 'orchestra'],
  [/\borkest\b/g, 'orchestra'],
  // Chamber groups too: the "Alban Berg Quartett" is the Alban Berg Quartet.
  [/\b(?:quartett|quatuor|quartetto|cuarteto|kvartet)\b/g, 'quartet'],
  [/\b(?:quintett|quintette|quintetto)\b/g, 'quintet'],
  [/\b(?:ensemble|ensemblet)\b/g, 'ensemble'],
]
const band = (folded: string) => ORCHESTRA_WORDS.reduce((acc, [re, to]) => acc.replace(re, to), folded)
// Words every orchestra's name may carry: not what tells one from another. "royal" goes too
// ("Concertgebouw Orchestra" was "Royal" only from 1988), unless nothing else is left.
const FILLER = new Set(['the', 'of', 'de', 'des', 'du', 'la', 'le', 'and', 'et', 'und', 'orchestra', 'radio', 'royal', 'symphony', 'philharmonic', 'national', 'chamber'])
// …but these say which of a city's orchestras it is: the London Symphony is not the London
// Philharmonic, the Orchestre National de France not Radio France's Philharmonique.
const KIND = new Set(['symphony', 'philharmonic', 'national', 'chamber'])

export function orchestraTokens(name: string): string[] {
  const all = band(fold(name)).split(' ').filter(Boolean)
  const distinctive = all.filter((t) => !FILLER.has(t))
  // "London Symphony Orchestra" → [london, symphony]; "Cleveland Orchestra" → [cleveland];
  // "Orchestre de Paris" → [paris]. Nothing distinctive ("Royal Philharmonic Orchestra"): the name itself.
  if (!distinctive.length) return all.filter((t) => t !== 'orchestra' && t !== 'the' && t !== 'of')
  return [...new Set([...distinctive, ...all.filter((t) => KIND.has(t))])]
}

function credited(artists: { name: string }[]): string {
  return ` ${artists.map((a) => band(fold(a.name))).join(' | ')} `
}

const tokens = (s: string) => s.split(' ').filter(Boolean)

/**
 * Bumped whenever matching gets better, so recordings an older matcher
 * decided about are looked at once more.
 *   2 — bracketed version notes no longer count as title words
 *   3 — the composer must be named; a contradicting catalogue number or a
 *       release older than the recording rules a track out; a near miss is
 *       held for the listener to confirm instead of being linked. Matches an
 *       older matcher accepted are re-checked (it once passed Beethoven's 7th
 *       for Sibelius's, same conductor, same orchestra).
 *   4 — "violoncello" is "cello" in a title, so "Concerto for Violoncello"
 *       is found for a cello concerto.
 *   5 — a movement number after the colon no longer passes for the work's
 *       number ("Symphony No. 2: 4. Urlicht" is not the fourth); another
 *       work's opus on a coupling album no longer rules a track out; "BWV1048"
 *       and "KV 550" read as "BWV 1048" and "K. 550"; a track naming the
 *       proposal's catalogue number is the work despite a nickname; albums
 *       past their 200th track are read to the end.
 *   6 — a work no longer runs on into a neighbour of the same title with
 *       another catalogue number (Grieg's Op. 16 beside Schumann's Op. 54).
 *   7 — a count spelt as a word is the figure ("Quattro pezzi" is "4 pezzi"),
 *       and Spotify is also searched with the figure.
 *       The album no longer speaks for a track that names another work on it
 *       (Pärt's Cantus taken for Fratres from "Tabula Rasa, Fratres, Cantus …").
 *       And the audit that followed (LONG_LISTEN.md §40): names under another
 *       transliteration; orchestras in another language or run together, and two
 *       of one city kept apart; titles in German, French and Italian, "&" for
 *       "and"; a movement after " - "; a work in another key; an excerpt on a
 *       compilation passed over; a last search by composer and work alone.
 */
export const MATCHER_VERSION = 7

/**
 * The curator often adds a version note in brackets — "(original piano
 * version)", "[orch. Ravel]" — that Spotify's track names never carry. They
 * describe the recording, not the work's title, so matching ignores them.
 * (`workTitleKey` drops them too now; this stays for the catalogue spelling, which runs first.)
 */
function matchTitle(title: string): string {
  return title.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
}

/**
 * One word for one thing, whatever language the title is billed in: DG bills
 * "Klavierkonzert Nr. 5", Erato "Quatuor à cordes", the curator "Piano Concerto
 * No. 5" and "String Quartet". German compounds come apart first. Applied to
 * both sides, on folded text, so only the spelling changes, never the claim.
 */
const SAME_WORD: [RegExp, string][] = [
  [/\b(klavier|violin|violoncello|cello|bratschen|viola|horn|klarinetten|floten|oboen|trompeten|fagott|harfen|orgel|doppel|tripel)(konzert|sonate|trio|quartett|quintett)\b/g, '$1 $2'],
  [/\bstreich(quartett|quintett|sextett|trio|orchester)\b/g, 'string $1'],
  [/\bviolon(?:cello|celle|cel)\b/g, 'cello'],
  [/\bvioloncelo\b/g, 'cello'],
  [/\bklavier\b|\bpianoforte\b/g, 'piano'],
  [/\bviolin[eo]?\b|\bviolon\b/g, 'violin'],
  [/\bbratschen?\b/g, 'viola'],
  [/\bklarinetten?\b|\bclarinette\b|\bclarinetto\b/g, 'clarinet'],
  [/\bfloten?\b|\bflote\b|\bflauto\b/g, 'flute'],
  [/\boboen\b/g, 'oboe'],
  [/\btrompeten?\b|\btromba\b|\btrompette\b/g, 'trumpet'],
  [/\bfagott\b|\bbasson\b|\bfagotto\b/g, 'bassoon'],
  [/\bharfen?\b|\bharpe\b|\barpa\b/g, 'harp'],
  [/\borgel\b|\borgue\b|\borgano\b/g, 'organ'],
  [/\bdoppel\b/g, 'double'],
  [/\btripel\b/g, 'triple'],
  [/\b(?:sinfonie|symphonie|sinfonia|symfonie|simfonia|symphonia|szimfonia)\b/g, 'symphony'],
  [/\b(?:konzert|concierto|concert|koncert|koncerto)\b/g, 'concerto'],
  [/\b(?:sonate|sonaten)\b/g, 'sonata'],
  [/\b(?:quartett|quatuor|quartetto|cuarteto|kvartet)\b/g, 'quartet'],
  [/\b(?:quintett|quintette|quintetto)\b/g, 'quintet'],
  [/\b(?:sextett|sextuor|sestetto)\b/g, 'sextet'],
  [/\b(?:messe|missa|messa|misa)\b/g, 'mass'],
  [/\b(?:ouverture|overtura|obertura)\b/g, 'overture'],
  [/\b(?:prelude|praludium|preludio|preludium)\b/g, 'prelude'],
  [/\b(?:fuge|fuga)\b/g, 'fugue'],
  [/\b(?:variationen|variazioni|variaciones|variacoes)\b/g, 'variations'],
  [/\b(?:cordes|archi|streicher|strings)\b/g, 'string'],
  [/\b(?:orchester|orchestre|orchestra|orquesta)\b/g, 'orchestra'],
]
const SAME_WORD_KEYS = (s: string) => SAME_WORD.reduce((acc, [re, to]) => acc.replace(re, to), s)
const sameWords = (s: string) => numerals(SAME_WORD_KEYS(stripKeys(s)))

/**
 * Words a title is held together with, in any language, and the single letters
 * left of an apostrophe: they say nothing of which work it is, so a title isn't
 * a lesser match for "&" where the curator wrote "and", or "für" for "for".
 */
const GLUE = new Set(['and', 'und', 'et', 'e', 'y', 'the', 'a', 'an', 'of', 'de', 'des', 'du', 'la', 'le', 'les', 'il', 'lo', 'der', 'die', 'das', 'dem', 'den', 'for', 'fur', 'pour', 'per', 'para', 'in', 'en', 'on', 'to', 'von', 'zu', 'di', 'del', 'della', 'da', 'op', 'no', 'nr'])
const significant = (ts: string[]) => {
  const kept = ts.filter((t) => !GLUE.has(t) && (t.length > 1 || /\d/.test(t)))
  return kept.length ? kept : ts
}

/**
 * The key a title names, as one spelling: "c#m", "ebM", or "c" when no mode is
 * said ("Symphony in C"). Read from English ("in E-flat major"), German ("Es-Dur",
 * "h-Moll": H is B, B is B-flat), French ("en sol mineur") and Italian ("in re
 * maggiore"). Folded text; ♭ and ♯ are spelt out before folding (`spelt`).
 */
const SOLFEGE: Record<string, string> = { ut: 'c', do: 'c', re: 'd', mi: 'e', fa: 'f', sol: 'g', la: 'a', si: 'b' }
const MODE: Record<string, string> = { major: 'M', dur: 'M', majeur: 'M', maggiore: 'M', minor: 'm', moll: 'm', mineur: 'm', minore: 'm' }
const KEY_PATTERNS: { re: RegExp; read: (m: RegExpMatchArray) => string }[] = [
  { re: /\b([a-h])(is|es|s)? (dur|moll)\b/, read: (m) => germanKey(m[1], m[2]) + MODE[m[3]] },
  { re: /\b(?:en )?(ut|do|re|mi|fa|sol|la|si)(?: (diese|bemol))? (majeur|mineur)\b/, read: (m) => SOLFEGE[m[1]] + (m[2] === 'diese' ? '#' : m[2] ? 'b' : '') + MODE[m[3]] },
  { re: /\b(?:in )?(do|re|mi|fa|sol|la|si)(?: (diesis|bemolle))? (maggiore|minore)\b/, read: (m) => SOLFEGE[m[1]] + (m[2] === 'diesis' ? '#' : m[2] ? 'b' : '') + MODE[m[3]] },
  { re: /\b(?:in )?([a-g])(?: (sharp|flat))? (major|minor)\b/, read: (m) => m[1] + (m[2] === 'sharp' ? '#' : m[2] ? 'b' : '') + MODE[m[3]] },
  { re: /\bin ([a-g])(?: (sharp|flat))?\b(?! (?:major|minor))/, read: (m) => m[1] + (m[2] === 'sharp' ? '#' : m[2] ? 'b' : '') },
]
function germanKey(letter: string, suffix?: string): string {
  if (letter === 'h') return 'b'
  if (letter === 'b' && !suffix) return 'bb'
  if (suffix === 'is') return `${letter}#`
  if (suffix === 'es' || suffix === 's') return `${letter}b`
  return letter
}
const spelt = (s: string) => s.replace(/♭/g, ' flat').replace(/♯/g, ' sharp')

export function keyOf(title: string): string | undefined {
  const t = fold(spelt(title))
  for (const { re, read } of KEY_PATTERNS) {
    const m = t.match(re)
    if (m) return read(m)
  }
  return undefined
}
function stripKeys(folded: string): string {
  return KEY_PATTERNS.reduce((acc, { re }) => acc.replace(new RegExp(re.source, 'g'), ' '), folded)
}

/** Two keys that can't both be right: another tonic, or another mode where both say one. */
export function keysDiffer(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  const tonic = (k: string) => k.replace(/[Mm]$/, '')
  const mode = (k: string) => (/[Mm]$/.test(k) ? k.slice(-1) : '')
  return tonic(a) !== tonic(b) || Boolean(mode(a) && mode(b) && mode(a) !== mode(b))
}

/**
 * A count is spelt as a word in one title and a figure in another: the curator's
 * "Quattro pezzi su una nota sola" is Spotify's "4 pezzi (su una nota sola)", "Vier
 * letzte Lieder" is often "4 letzte Lieder". The words, in the languages titles are
 * written in, read as figures. "One" isn't among them: un, uno, ein are as often articles.
 */
const NUMERALS: [RegExp, string][] = [
  [/\b(?:due|two|zwei|deux|dos)\b/gi, '2'],
  [/\b(?:tre|three|drei|trois|tres)\b/gi, '3'],
  [/\b(?:quattro|four|vier|quatre|cuatro)\b/gi, '4'],
  [/\b(?:cinque|five|f(?:u|ü)nf|cinq|cinco)\b/gi, '5'],
  [/\b(?:sei|six|sechs|seis)\b/gi, '6'],
  [/\b(?:sette|seven|sieben|sept|siete)\b/gi, '7'],
  [/\b(?:otto|eight|acht|huit|ocho)\b/gi, '8'],
  [/\b(?:nove|nine|neun|neuf|nueve)\b/gi, '9'],
  [/\b(?:dieci|ten|zehn|dix|diez)\b/gi, '10'],
  [/\b(?:dodici|twelve|zw(?:o|ö)lf|douze|doce)\b/gi, '12'],
]
export const numerals = (s: string): string => NUMERALS.reduce((acc, [re, to]) => acc.replace(re, to), s)

/**
 * Spotify spells catalogue numbers several ways — "BWV1048" for "BWV 1048",
 * "KV 550" for "K. 550" — and each spelling folds to different words, so the
 * same number would count as missing from the title. One spelling for both
 * sides before the words are compared.
 */
function catalogueSpelling(title: string): string {
  return title
    .replace(/\b(bwv|kv|k|hob|rv|wwv|op|d|l)\.?(?=\d)/gi, '$1 ')
    .replace(/\bkv\b/gi, 'K')
}

/**
 * Where a track name's movement begins: at the first colon, dash or slash set off
 * by spaces that a numbered movement follows ("…: IV. Adagietto", "… Op. 92 - 2.
 * Allegretto", as older and budget releases bill them). The first, so a dash inside
 * the movement's own name ("I. Adagio - Moderato") is never taken for the break.
 * -1 when no numbered movement follows any.
 */
function movementAt(trackName: string): { at: number; width: number } {
  for (const m of trackName.matchAll(/\s*:\s*|\s+[-–—/]\s+/g)) {
    const at = m.index ?? -1
    if (movementNumber(trackName.slice(at + m[0].length)) !== undefined) return { at, width: m[0].length }
  }
  return { at: -1, width: 0 }
}

/**
 * The part of a track name that names the work. "Symphony No. 2 in C Minor:
 * 4. Urlicht" is the second symphony's fourth movement, and the "4" must not
 * pass for "Symphony No. 4" — so a numbered movement after the last colon (or
 * " - ") is left out. Only a numbered movement: in "Bach: Brandenburg Concerto
 * No. 3" or "Pictures at an Exhibition: Promenade I" what follows the colon is
 * the work, or part of its name, and stays.
 */
export function workPart(trackName: string): string {
  const { at } = movementAt(trackName)
  return at < 0 ? trackName : trackName.slice(0, at)
}

/** The track's own movement number, when it names one after its work: "…: IV. Adagietto" → 4. */
function movementOf(trackName: string): number | undefined {
  const { at, width } = movementAt(trackName)
  return movementNumber(at < 0 ? trackName : trackName.slice(at + width))
}

/** The title's words that identify the work, both spellings considered. */
function titleWords(title: string): string[] {
  return significant(tokens(sameWords(workTitleKey(catalogueSpelling(matchTitle(spelt(title)))))))
}

/** How much of the work's identifying title appears in a track (or album) name, 0..1. */
export function workOverlap(workTitle: string, trackName: string): number {
  const want = titleWords(workTitle)
  if (want.length === 0) return 0
  const name = catalogueSpelling(spelt(workPart(trackName)))
  const have = new Set(tokens(sameWords(workTitleKey(name))).concat(tokens(sameWords(fold(name)))))
  return want.filter((t) => have.has(t)).length / want.length
}

// Catalogue schemes and billing notes a track adds to a title: never a title of its own.
const CATALOGUE_WORDS = new Set(['op', 'opus', 'bwv', 'k', 'kv', 'd', 'l', 'hob', 'rv', 'wwv', 'hwv', 'woo', 'sz', 'bb', 'trv', 'jw', 'fs', 'b', 's', 'm', 'z', 'posth', 'version', 'live', 'remastered', 'remaster', 'arr', 'orch', 'ed', 'edition'])

// What a title is made of when it says only what kind of piece it is: "Symphony in C",
// "Cello Concerto", "String Quartet in G minor". Such a title is the work only with its key.
const GENRE = new Set(['symphony', 'concerto', 'sonata', 'quartet', 'quintet', 'sextet', 'trio', 'octet', 'suite', 'mass', 'overture', 'serenade', 'piano', 'violin', 'cello', 'viola', 'flute', 'oboe', 'clarinet', 'horn', 'trumpet', 'bassoon', 'harp', 'organ', 'string', 'double', 'triple', 'chamber', 'orchestra', 'small'])

/**
 * A track whose work is in another key than the proposal's ("Piano Concerto No. 26
 * in D Major" for "Piano Concerto in D minor"), or — when the proposal's title is
 * only a genre and a key ("Symphony in C") — whose title names something more and
 * no key ("Symphony in Three Movements"): another work, whatever else agrees. A
 * track naming the proposal's own catalogue number is the work, whatever key the
 * proposal gave it.
 */
export function keyContradicts(p: Pick<ProposedRecording, 'work' | 'catalogue' | 'composer'>, trackName: string): boolean {
  const want = keyOf(p.work)
  if (!want || catalogueAgrees({ ...p, soloists: [] }, trackName)) return false
  const have = keyOf(workPart(trackName))
  if (have) return keysDiffer(want, have)
  if (!titleWords(p.work).every((t) => GENRE.has(t)) || keyOf(trackName)) return false
  // The title as the track bills it, before any movement and without the composer's name ("Elgar: Cello Concerto").
  const composer = nameKey(surname(p.composer))
  const head = trackName.split(/\s*:\s*|\s+[-–—/]\s+/).find((part) => !tokens(fold(part)).every((t) => nameKey(t) === composer)) ?? trackName
  return significant(tokens(sameWords(workTitleKey(catalogueSpelling(spelt(head))))))
    .some((t) => !GENRE.has(t) && !CATALOGUE_WORDS.has(t) && !/^\d+$/.test(t) && nameKey(t) !== composer)
}

/** Is this person credited among these artists (by surname)? */
export function isCredited(name: string, artists: { name: string }[]): boolean {
  return personCredited(name, credited(artists))
}

function personCredited(name: string, credits: string): boolean {
  const last = surname(name)
  if (last.length < 2) return false
  // Spelt as credited, or under another transliteration ("Rachmaninoff", "Tschaikowsky", "Oistrach").
  const key = nameKey(last)
  return credits.split(/[\s|]+/).some((w) => w === last || (w.length > 1 && nameKey(w) === key))
}

function orchestraCredited(name: string, credits: string): boolean {
  const toks = orchestraTokens(name)
  return toks.length > 0 && toks.every((t) => new RegExp(`\\b${t}\\b`).test(credits))
}

export interface MatchResult {
  level: MatchLevel
  work: number
  composer: boolean
  missing: string[]
}

// Catalogue schemes common in track titles: "Op. 92", "BWV 1048", "K. 550", "D. 944", "L. 109", "Hob. I:104".
const CATALOGUE = /\b(op|opus|bwv|k|kv|d|l|hob|s|rv|wwv)\.?\s*([ivx]+:)?\s*(\d+)/gi

/** Catalogue numbers named in a text, as "op 92", "bwv 1048" … */
function catalogueNumbers(text: string): Set<string> {
  const out = new Set<string>()
  for (const m of text.matchAll(CATALOGUE)) {
    const scheme = m[1].toLowerCase().replace(/^opus$/, 'op').replace(/^kv$/, 'k')
    out.add(`${scheme} ${(m[2] ?? '').toLowerCase()}${Number(m[3])}`)
  }
  return out
}

/**
 * Does the track name the proposal's own catalogue number? "Concerto for
 * Violin, Cello and Orchestra in A minor, Op. 102" shares one word with
 * "Double Concerto", and is the same work: the number says so.
 */
export function catalogueAgrees(p: ProposedRecording, trackText: string): boolean {
  const want = catalogueNumbers(`${p.catalogue ?? ''} ${p.work}`)
  if (!want.size) return false
  for (const h of catalogueNumbers(trackText)) if (want.has(h)) return true
  return false
}

const schemeOf = (n: string) => n.split(' ')[0]

/**
 * Does the track name a catalogue number of the same scheme as the proposal's,
 * but a different one?
 *
 * The album is a weaker witness than the track. A coupling is billed with
 * both works' numbers — "Symphony No. 5, Op. 67 & Symphony No. 7, Op. 92" —
 * so another opus on the album says nothing against this track. It is only
 * heard for a scheme the track's own name doesn't use (a track named "I. Poco
 * sostenuto" leaves the album to say which work it is), and only when none of
 * the album's numbers of that scheme is the proposal's.
 */
export function catalogueContradicts(p: ProposedRecording, trackText: string, albumText = ''): boolean {
  const want = catalogueNumbers(`${p.catalogue ?? ''} ${p.work}`)
  if (!want.size) return false
  const wanted = (scheme: string) => [...want].filter((w) => schemeOf(w) === scheme)
  const have = catalogueNumbers(trackText)
  for (const h of have) {
    const same = wanted(schemeOf(h))
    if (same.length && !same.includes(h)) return true
  }
  const named = new Set([...have].map(schemeOf))
  const onAlbum = [...catalogueNumbers(albumText)].filter((h) => !named.has(schemeOf(h)))
  for (const scheme of new Set(onAlbum.map(schemeOf))) {
    const same = wanted(scheme)
    if (same.length && !onAlbum.some((h) => schemeOf(h) === scheme && same.includes(h))) return true
  }
  return false
}

/** The numbers after "No." in a title: "String Quartet No. 7, Op. 59 No. 1" → 7, 1. */
function numberedAs(text: string): Set<number> {
  return new Set([...text.matchAll(/\b(?:no|nr|nos)\.?\s*(\d+)/gi)].map((m) => Number(m[1])))
}

/**
 * Does the track's own name identify the proposal's work by its catalogue
 * number? Then a title spelt differently — a nickname the curator added
 * ("Eroica"), a key left out — doesn't make it a lesser match. Guarded twice:
 * nothing may contradict it, and a numbered work must not be another of the
 * same opus (Op. 59 No. 1 and No. 2 are two quartets under one number).
 */
function catalogueIdentifies(p: ProposedRecording, trackName: string, albumName = ''): boolean {
  const name = workPart(trackName)
  if (!catalogueAgrees(p, name) || catalogueContradicts(p, trackName, albumName)) return false
  const want = numberedAs(`${p.work} ${p.catalogue ?? ''}`)
  const have = numberedAs(name)
  return !want.size || !have.size || [...want].every((n) => have.has(n))
}

/** A release can't come before the recording on it: a proposed 1987 recording isn't on a 1964 album. */
function releasedTooEarly(p: ProposedRecording, track: SpotifyTrackLike): boolean {
  const recorded = Number(/\b(1[89]\d\d|20\d\d)\b/.exec(p.year ?? '')?.[1])
  const released = Number(track.album?.release_date?.slice(0, 4))
  return Boolean(recorded && released && released < recorded - 1)
}

/**
 * The album speaks for a track named only by its movement ("I. Allegro"). It doesn't for a
 * track that names another work the album also lists: on "Arvo Pärt: Tabula Rasa, Fratres,
 * Cantus in memoriam Benjamin Britten", the track "Cantus in memoriam Benjamin Britten" is
 * not Fratres, though the album names both (29 October 2026; it was offered as a near match).
 */
export function namesAnotherWork(p: Pick<ProposedRecording, 'work'>, track: Pick<SpotifyTrackLike, 'name' | 'album'>): boolean {
  if (!track.album) return false
  return workOverlap(p.work, track.name) < 0.5 && workOverlap(workPart(track.name), track.album.name) >= 0.75
}

export function matchTrack(track: SpotifyTrackLike, p: ProposedRecording): MatchResult {
  const credits = credited(track.artists)
  // Classical tracks often carry the work in the album name and only the
  // movement in the track name ("I. Allegro con brio"); take the better of the two.
  // A track whose own name carries the proposal's catalogue number is the work,
  // however else its title is spelt.
  const work = catalogueIdentifies(p, track.name, track.album?.name)
    ? 1
    : Math.max(workOverlap(p.work, track.name), track.album && !namesAnotherWork(p, track) ? workOverlap(p.work, track.album.name) * 0.95 : 0)
  // The composer is credited as an artist on nearly every classical track; a
  // few older uploads only name them in the title. Either will do — but one of
  // them must, or "Symphony No. 7" by the right conductor could be anyone's.
  const titles = `${track.name} ${track.album?.name ?? ''}`
  const composer = personCredited(p.composer, credits) || personCredited(p.composer, ` ${fold(titles)} `)
  const missing: string[] = []
  if (p.conductor && !personCredited(p.conductor, credits)) missing.push(p.conductor)
  if (p.orchestra && !orchestraCredited(p.orchestra, credits)) missing.push(p.orchestra)
  if (p.ensemble && !orchestraCredited(p.ensemble, credits)) missing.push(p.ensemble)
  for (const s of p.soloists) if (!personCredited(s.name, credits)) missing.push(s.name)

  const lead = p.conductor ?? p.soloists[0]?.name ?? p.ensemble ?? p.orchestra
  const leadOk = lead ? !missing.includes(lead) : false

  let level: MatchLevel = 'none'
  if (!composer || catalogueContradicts(p, track.name, track.album?.name) || keyContradicts(p, track.name) || releasedTooEarly(p, track)) level = 'none'
  else if (work >= 0.99 && missing.length === 0) level = 'strong'
  else if (work >= 0.75 && leadOk) level = 'probable'
  return { level, work, composer, missing }
}

const RANK: Record<MatchLevel, number> = { none: 0, probable: 1, strong: 2 }

/** The best candidate, or null when none is good enough to link. */
export function bestTrack(candidates: SpotifyTrackLike[], p: ProposedRecording): { track: SpotifyTrackLike; result: MatchResult } | null {
  let best: { track: SpotifyTrackLike; result: MatchResult } | null = null
  for (const track of candidates) {
    const result = matchTrack(track, p)
    if (result.level === 'none') continue
    if (!best || RANK[result.level] > RANK[best.result.level] || (result.level === best.result.level && result.work > best.result.work)) {
      best = { track, result }
    }
  }
  return best
}

/**
 * Of an album's tracks, the ones that make up the work: the run of
 * consecutive tracks around the matched one that carry the work's title.
 * Falls back to the matched track alone. Given the proposal, a track naming
 * its catalogue number carries the work too, as it does for `matchTrack` —
 * otherwise a work matched that way would shrink to the one movement found.
 */
export function workTracks(albumTracks: SpotifyTrackLike[], matched: SpotifyTrackLike, workTitle: string, p?: ProposedRecording): SpotifyTrackLike[] {
  const ordered = [...albumTracks].sort((a, b) => (a.disc_number ?? 1) - (b.disc_number ?? 1) || (a.track_number ?? 0) - (b.track_number ?? 0))
  const at = ordered.findIndex((t) => t.id === matched.id)
  if (at < 0) return [matched]
  const fits = (t: SpotifyTrackLike) => workOverlap(workTitle, t.name) >= 0.99 || Boolean(p && catalogueIdentifies(p, t.name))
  if (!fits(ordered[at])) return movementRun(ordered, at) ?? [matched]
  // A neighbour with the same title can still be another work: Grieg's and Schumann's piano
  // concertos are both "in A minor" on one album, Brahms's and Tchaikovsky's violin concertos
  // both "in D". A different number of the matched track's own scheme (Op. 54 beside Op. 16),
  // or one the proposal rules out, ends the run.
  const own = catalogueNumbers(ordered[at].name)
  const sameWork = (t: SpotifyTrackLike) => {
    for (const h of catalogueNumbers(t.name)) {
      const mine = [...own].filter((o) => schemeOf(o) === schemeOf(h))
      if (mine.length && !mine.includes(h)) return false
    }
    // Another key is another work too: Mozart's D minor concerto beside his D major.
    if (keysDiffer(keyOf(workPart(t.name)), keyOf(workPart(ordered[at].name)))) return false
    return !(p && catalogueContradicts(p, t.name))
  }
  const joins = (t: SpotifyTrackLike) => fits(t) && sameWork(t)
  let start = at
  let end = at
  while (start > 0 && joins(ordered[start - 1])) start--
  while (end < ordered.length - 1 && joins(ordered[end + 1])) end++
  return ordered.slice(start, end + 1)
}

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 }

/**
 * A run of the work's tracks that begins past its first movement: the Adagietto
 * alone on a compilation, not the symphony. Such an album is passed over for the
 * work. Not when the proposal is that movement ("the Adagietto from Symphony No.
 * 5"), and never for a work with no numbered movements.
 */
export function isExcerpt(run: SpotifyTrackLike[], p?: Pick<ProposedRecording, 'work'>): boolean {
  if (!run.length) return false
  const first = movementOf(run[0].name)
  if (first === undefined || first <= 1) return false
  if (!p) return true
  const movement = new Set(significant(tokens(sameWords(fold(movementTitle(run[0].name))))).filter((t) => !/^\d+$/.test(t) && !(t in ROMAN)))
  return !titleWords(p.work).some((t) => movement.has(t))
}

/** "III. Allegro" → 3, "2. Andante" → 2; anything else, undefined. */
function movementNumber(name: string): number | undefined {
  const m = /^\s*([ivx]+|\d{1,2})[.:)]\s/i.exec(name)
  if (!m) return undefined
  return /\d/.test(m[1]) ? Number(m[1]) : ROMAN[m[1].toLowerCase()]
}

/**
 * Tracks named only by their movement ("I. Allegro", "II. Andante"), as some
 * albums name them — the work's title is on the album, not the track. The run
 * is the matched track and its neighbours numbered one up and one down, so it
 * stops where the next work's "I." begins.
 */
function movementRun(ordered: SpotifyTrackLike[], at: number): SpotifyTrackLike[] | undefined {
  const n = movementNumber(ordered[at].name)
  if (n === undefined) return undefined
  let start = at
  let end = at
  while (start > 0 && movementNumber(ordered[start - 1].name) === (movementNumber(ordered[start].name) ?? 0) - 1) start--
  while (end < ordered.length - 1 && movementNumber(ordered[end + 1].name) === (movementNumber(ordered[end].name) ?? 0) + 1) end++
  return end > start ? ordered.slice(start, end + 1) : undefined
}

/** Search queries, most specific first. Spotify's search caps a page at ten results. */
export function searchQueries(p: ProposedRecording): string[] {
  const work = workTitleKey(matchTitle(p.work)).split(' ').slice(0, 6).join(' ')
  const composer = surname(p.composer)
  const lead = p.conductor ? surname(p.conductor) : p.soloists[0] ? surname(p.soloists[0].name) : ''
  const group = p.orchestra ?? p.ensemble
  const bandWords = group ? orchestraTokens(group).slice(0, 2).join(' ') : ''
  const qs = [
    [composer, work, lead].filter(Boolean).join(' '),
    [work, lead, bandWords].filter(Boolean).join(' '),
    [composer, work, bandWords].filter(Boolean).join(' '),
    // Spotify's search is literal: "quattro" doesn't find "4 pezzi". Asked only when the title counts in words.
    ...(numerals(work) !== work ? [[composer, numerals(work), lead].filter(Boolean).join(' ')] : []),
    // Last, and only when nothing better turned up: the composer and the work alone. It finds
    // what the performer-led queries miss — a stand-in chosen from just this search's results
    // (spotifyCandidates), or performers Spotify bills under another spelling.
    [composer, work].filter(Boolean).join(' '),
  ]
  return [...new Set(qs.filter((q) => q.trim().length > 0))]
}

/** "La mer, L. 109: II. Jeux de vagues" → "II. Jeux de vagues". A single-track work keeps its name. */
export function movementTitle(trackName: string): string {
  // The numbered movement wherever it begins ("…: IV. Adagietto", "… Op. 92 - 2. Allegretto"); else what follows the last colon.
  const { at, width } = movementAt(trackName)
  if (at >= 0) return trackName.slice(at + width).trim()
  const colon = trackName.lastIndexOf(':')
  return colon >= 0 && colon < trackName.length - 1 ? trackName.slice(colon + 1).trim() : trackName.trim()
}

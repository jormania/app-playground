import { TERM_GROUPS } from './glossary'
import { ALIASES, DEFINITIONS_EN } from './glossaryDefinitions'

/**
 * The dictionary (screens/Words.tsx, 9 November 2026): every term the notes
 * underline (glossary.ts, defined in glossaryDefinitions.ts), and beside them
 * the everyday words of orchestral music that are never underlined — the
 * instruments, the people on the stage, the periods, the basics of a score,
 * and words like "tempo" and "development" that the notes use in their plain
 * sense too. All written in the app, in English; nothing here is asked for.
 */
export type WordKind = 'basics' | 'forms' | 'structure' | 'harmony' | 'tempo' | 'orchestra' | 'performance' | 'periods'

export const KIND_LABEL: Record<WordKind, string> = {
  basics: 'The basics',
  forms: 'Forms and genres',
  structure: 'How a piece is built',
  harmony: 'Harmony, line and rhythm',
  tempo: 'Tempo, loudness, touch',
  orchestra: 'The orchestra and its sounds',
  performance: 'Performance',
  periods: 'Periods and styles',
}

/** The order the kinds are offered in, as filters. */
export const KINDS: WordKind[] = ['basics', 'orchestra', 'forms', 'structure', 'harmony', 'tempo', 'periods', 'performance']

export interface Word {
  term: string
  kind: WordKind
  definition: string
  /** Underlined in the curator's notes (glossary.ts), so it can be tapped where it appears. */
  inNotes: boolean
  /** Its other names, listed with it rather than as entries of their own: "also english horn". */
  aka: string[]
}

/** Every second name, the notes' (glossaryDefinitions.ts) and the dictionary's own, to the word it names. */
const SECOND_NAMES: Record<string, string> = { ...ALIASES, mute: 'con sordino' }

/** A word by any of its names: "english horn" is the cor anglais. */
export const mainTerm = (term: string): string => SECOND_NAMES[term] ?? term

/** Words of orchestral music the notes don't underline: defined here only. */
const MORE: Record<WordKind, Record<string, string>> = {
  basics: {
    'score': 'The written music of a piece with every instrument’s part stacked on the page, read by the conductor. Each player reads only their own part.',
    'movement': 'A self-contained section of a larger work, with its own tempo and character, like a chapter in a book. Audiences traditionally wait until the last one to applaud.',
    'symphony': 'A large work for orchestra, usually in four movements: a weighty fast first movement, a slow one, a dance (minuet or scherzo) and a lively finale.',
    'concerto': 'A work for a soloist (or several) and orchestra, usually in three movements, fast–slow–fast. Listen for the dialogue, rivalry and partnership between soloist and orchestra.',
    'suite': 'A set of pieces played as a sequence: in the Baroque, a group of dances; later, often highlights from a ballet, opera or film score arranged for concert use.',
    'opus': 'Latin for “work”: a number given to a composer’s works, usually in order of publication (Opus 67, shortened to Op 67), which tells one piece from another of the same kind.',
    'catalogue number': 'A number given to a composer’s works by a later scholar where opus numbers are missing or misleading: BWV for Bach, K for Mozart (Köchel), D for Schubert (Deutsch), Hob for Haydn, L for Debussy.',
    'key': 'The home scale and home note a piece is built around, such as C major or D minor. A title often names it, as in Beethoven’s Fifth Symphony in C minor.',
    'theme': 'The main musical idea of a piece or section, a melody substantial enough to be developed. A work is often heard as the story of its themes.',
    'melody': 'A sequence of notes heard as a single line, the part you could sing or hum. Also called the tune.',
    'harmony': 'Notes sounded together, and the way chords follow one another beneath a melody. It gives music its colour and its sense of tension and rest.',
    'chord': 'Three or more notes sounded together. The basic unit of harmony.',
    'texture': 'How the strands of a piece are woven together: thin or dense, one tune with accompaniment or many lines at once. Listen for how many things are happening.',
    'development': 'The working-out of a theme: breaking it into pieces, changing its key and character, combining it with others. Also the name of the middle section of sonata form.',
    'tempo': 'The speed of the music, given at the top of a movement in Italian (allegro, adagio) or by metronome mark.',
    'dynamics': 'How loud or soft the music is, and how that changes: from pianissimo (very soft) to fortissimo (very loud).',
    'forte': 'Loud, marked f. Its partner is piano, soft.',
    'piano': 'As a marking, soft (p); also the instrument, whose full name, pianoforte, means “soft-loud”.',
    'phrase': 'A musical sentence: a group of notes that makes sense together and comes to a point of rest. Listen for where the music seems to breathe.',
    'bar': 'A small unit of time in written music, holding a set number of beats, marked off by vertical lines in the score. Also called a measure.',
    'beat': 'The regular pulse underlying the music, what you tap your foot to.',
    'metre': 'The grouping of beats into a regular pattern, such as two, three or four to a bar. A waltz is in three; a march in two or four.',
    'octave': 'The distance between a note and the next note of the same name above or below, at double or half the frequency. The two sound like versions of the same note.',
    'interval': 'The distance in pitch between two notes, such as a third or a fifth. Each has its own colour, open or tense, bright or dark.',
    'semitone': 'The smallest step in Western music, the distance between two neighbouring keys on a piano. Two semitones make a whole tone.',
    'scale': 'A set of notes in order, going up or down, on which a piece is built. The major and minor scales are the commonest.',
    'unison': 'Several instruments or voices playing the same notes at the same pitch, or in octaves. A unison passage sounds bare and strong.',
    'fermata': 'A pause sign over a note or rest: hold it longer than written, at the performer’s discretion. Listen for the music suspended in mid-air.',
    'da capo': '“From the beginning”: an instruction to repeat the opening section. A da capo aria returns to its first part, often decorated the second time.',
    'harmonics': 'High, pure, whistling notes produced on a string instrument by touching the string lightly at certain points instead of pressing it down.',
    'overtones': 'The fainter higher pitches sounding inside any musical note above its main pitch. Their balance is what gives each instrument its colour.',
    'drone': 'A note or chord held continuously beneath the music, like the sound of bagpipes. It gives a sense of stillness or of folk music.',
    'sequence': 'The same short phrase repeated several times, each time starting a step higher or lower. Listen for the music climbing or descending in stages.',
    'programme music': 'Instrumental music that tells a story or depicts a scene, often named in its title or explained in a note: symphonic poems are the classic case.',
    'absolute music': 'Instrumental music with no story or picture behind it, meant to be heard for its own sake: symphonies, sonatas and quartets usually are.',
    'arrangement': 'A piece adapted for different forces from the original, such as a piano work orchestrated, as Ravel did with Mussorgsky’s Pictures at an Exhibition.',
    'premiere': 'The first public performance of a work. Some, like The Rite of Spring in 1913, are famous in their own right.',
  },
  forms: {
    'ballet': 'A stage work told through dance and music, without words. Many concert suites are drawn from ballet scores, such as Stravinsky’s Firebird and Tchaikovsky’s Nutcracker.',
    'opera': 'A drama set to music and sung, with orchestra, costumes and staging. Its overtures and interludes are often played on their own in concerts.',
    'mass': 'A setting of the main Catholic service in sung sections (Kyrie, Gloria, Credo, Sanctus, Agnus Dei), from plainchant to grand works for chorus and orchestra.',
    'string quartet': 'Two violins, a viola and a cello, and the music written for them: the most intimate and conversational form of classical chamber music.',
    'chamber music': 'Music for a small group, one player to a part, originally for a room rather than a hall: trios, quartets, quintets and duo sonatas.',
    'sinfonietta': 'A “little symphony”: a shorter, lighter symphonic work, or a small orchestra that plays such music.',
    'sonata': 'A work for one or two instruments, usually in three or four movements, such as a piano sonata or a violin sonata with piano.',
    'march': 'Music in a steady two or four beats with a strong tread, for marching or in that spirit. In symphonies it can be triumphant or funereal.',
    'lied': 'A German art song for voice and piano, setting a poem (plural lieder). Schubert, Schumann and Brahms wrote hundreds; Mahler and Strauss gave some to orchestra.',
    'aria': 'A solo song in an opera, oratorio or cantata, where the action pauses and a character expresses feeling at length.',
    'recitative': 'Speech-like singing that moves the story forward in an opera or oratorio, following the rhythms of words, lightly accompanied.',
    'libretto': 'The text of an opera or oratorio, the words the music sets.',
  },
  structure: {
    'introduction': 'A slow or preparatory opening before the main part of a movement begins. Listen for a sense of expectation before the real start.',
    'transition': 'A passage that links two themes or sections, often moving from one key to another. Listen for the music on the move, between destinations.',
    'finale': 'The last movement of a multi-movement work, usually fast and decisive, where the whole piece reaches its conclusion.',
    'variation': 'One of a set of transformations of a theme, keeping something of it (its melody, harmony or bass) while changing the rest.',
  },
  harmony: {
    'resolution': 'The move from a dissonance to a consonance, from tension to rest. Listen for the release when a clashing chord settles.',
    'unresolved': 'A dissonance left hanging, without moving to rest. Wagner’s Tristan chord is the famous case: the ear keeps waiting.',
  },
  tempo: {
    'accent': 'A note played with extra emphasis, marked > in the score. Listen for the stress that gives a rhythm its shape.',
    'articulation': 'How notes are begun, joined or separated: smooth (legato), short (staccato), accented. It shapes how a phrase speaks.',
    'mezzo': '“Half” or “moderately”: mezzo forte (mf) is moderately loud, mezzo piano (mp) moderately soft.',
  },
  orchestra: {
    'conductor': 'The musician who leads the orchestra without playing, setting tempo and balance and shaping the interpretation in rehearsal. Two conductors can make the same score sound very different.',
    'concertmaster': 'The leader of the first violins, who plays the violin solos, tunes the orchestra and acts as the link between conductor and players. In Britain called the leader.',
    'principal': 'The lead player of a section, such as principal oboe or principal horn, who plays its solos.',
    'soloist': 'The featured performer in a concerto or other solo work, standing apart from the orchestra.',
    'strings': 'The largest section of the orchestra: first and second violins, violas, cellos and double basses, usually played with a bow.',
    'woodwind': 'Flutes, oboes, clarinets and bassoons, with their relatives (piccolo, cor anglais, bass clarinet, contrabassoon). Each has a distinct voice for solos and colour.',
    'brass': 'Horns, trumpets, trombones and tuba: the orchestra’s power and brilliance, though the horns can be soft and warm too.',
    'percussion': 'Instruments struck, shaken or scraped: timpani, bass drum, cymbals, triangle, glockenspiel and many more, for rhythm, colour and climax.',
    'violin': 'The highest member of the string family, and the orchestra’s main melodic voice, split into first and second violins.',
    'viola': 'Slightly larger and lower than the violin, with a darker, warmer tone. It usually fills in the inner harmony, with occasional solos.',
    'cello': 'The tenor and bass of the strings, played seated with the instrument between the knees. Its warm, singing tone carries many great melodies.',
    'flute': 'A high woodwind played across a hole, with a clear, airy tone, often used for birdsong and light. The piccolo is its smaller, higher sibling.',
    'piccolo': 'A small flute sounding an octave higher, the highest instrument in the orchestra. Listen for a piercing, glittering top line.',
    'oboe': 'A double-reed woodwind with a penetrating, plaintive tone. The orchestra tunes to its A before every concert.',
    'clarinet': 'A single-reed woodwind with a wide range, from a dark, velvety low register to a bright, clear top. Mozart and Brahms loved its warmth.',
    'bassoon': 'The bass of the woodwind, a long double-reed instrument with a dry, reedy, sometimes comic and sometimes mournful tone.',
    'horn': 'The French horn: a coiled brass instrument with a round, noble tone that blends with both woodwind and brass. Listen for its calls and its warmth.',
    'trumpet': 'The highest brass instrument, bright and brilliant, for fanfares, climaxes and, muted, distant or plaintive calls.',
    'trombone': 'A brass instrument with a slide, from soft and chorale-like to blazing. Often heard in solemn or climactic moments.',
    'tuba': 'The lowest brass instrument, the foundation of the brass section, with a deep, round tone.',
    'harp': 'A large plucked string instrument with forty-seven strings, used for rippling arpeggios, glissandos and delicate colour.',
    'chamber orchestra': 'A small orchestra of about fifteen to forty players, suited to music from before Beethoven or to lighter, transparent textures.',
    'symphony orchestra': 'A full orchestra of around seventy to a hundred players, with strings, woodwind, brass and percussion. Philharmonic means the same.',
    'section': 'A group of the same or related instruments, such as the cellos or the brass, which plays and rehearses as a team.',
    'bow': 'The stick strung with horsehair that string players draw across the strings. How it is used (near the bridge, on the fingerboard, bouncing) changes the sound.',
  },
  performance: {
    'interpretation': 'How performers bring a score to life: tempo, balance, phrasing and character. The reason two recordings of the same work can sound so different.',
    'intonation': 'Playing in tune: how precisely each note is pitched. Listen for the purity of chords and unisons.',
    'phrasing': 'How a performer shapes a phrase: where it breathes, swells and falls away, like the inflection of a spoken sentence.',
    'balance': 'The relative loudness of the parts, so that what matters is heard. A conductor’s balance decides what comes to the front.',
    'encore': 'An extra piece played after the scheduled programme, in answer to applause, usually short.',
    'tuning': 'The orchestra matching its pitch before playing, to an A from the oboe, usually at 440 to 443 vibrations a second.',
  },
  periods: {
    'baroque': 'European music of about 1600 to 1750: Monteverdi, Vivaldi, Bach, Handel. Listen for a steady drive, ornamented lines, counterpoint and the continuo underneath.',
    'classical period': 'About 1750 to 1820: Haydn, Mozart, early Beethoven. Listen for clarity, balance and the sonata form that became the backbone of the symphony.',
    'romanticism': 'The nineteenth century: Schubert to Brahms, Tchaikovsky and Wagner. Listen for personal expression, rich harmony, bigger orchestras and music drawn from poetry, nature and nation.',
    'late romanticism': 'The end of the nineteenth century into the twentieth: Mahler, Strauss, Elgar, early Schoenberg. Huge orchestras, stretched harmony and long, intense spans.',
    'nationalism': 'Nineteenth- and twentieth-century music drawing on a country’s folk songs, dances and stories: Dvořák, Smetana, Grieg, Sibelius, Bartók, Enescu.',
    'expressionism': 'Early-twentieth-century music of extreme emotion and distorted harmony, with Schoenberg and Berg in Vienna. Expect anguish, fragments and the breaking of tonality.',
    'modernism': 'The twentieth-century break with tradition in many directions: new harmony, rhythm and sound, from Stravinsky and Bartók to Ligeti and Boulez.',
    'avant-garde': 'Music that pushes past existing conventions, especially the experimental composers of the 1950s and 1960s, such as Stockhausen, Ligeti and Xenakis.',
  },
}

/** Every word, in alphabetical order (accents ignored): the notes' terms and the rest. */
export function allWords(): Word[] {
  const words: Word[] = []
  const akaOf = (term: string) => Object.keys(SECOND_NAMES).filter((a) => SECOND_NAMES[a] === term)
  for (const [kind, terms] of Object.entries(TERM_GROUPS) as [WordKind, readonly string[]][]) {
    // One entry a thing: a second name is listed with its word, never as a word of its own.
    for (const term of new Set(terms)) if (!SECOND_NAMES[term]) words.push({ term, kind, definition: DEFINITIONS_EN[term], inNotes: true, aka: akaOf(term) })
  }
  for (const [kind, defs] of Object.entries(MORE) as [WordKind, Record<string, string>][]) {
    for (const [term, definition] of Object.entries(defs)) words.push({ term, kind, definition, inNotes: false, aka: akaOf(term) })
  }
  return words.sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }))
}

/** The letter a word is filed under: its first, without its accent. */
export const letterOf = (term: string): string => term.normalize('NFD').charAt(0).toUpperCase()

/** Words whose term or definition holds every word of the query, accents and case ignored. */
export function searchWords(words: Word[], query: string): Word[] {
  const fold = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const parts = fold(query).split(/\s+/).filter(Boolean)
  if (!parts.length) return words
  return words.filter((w) => {
    const hay = fold(`${w.term} ${w.aka.join(' ')} ${w.definition}`)
    return parts.every((p) => hay.includes(p))
  })
}

/** A definition cut into plain text and the other words of the dictionary it names, each once, never the word itself. */
export type DefinitionPiece = string | { term: string; text: string }

let finder: RegExp | undefined
function wordFinder(): RegExp {
  if (finder) return finder
  // The specialist words only, as the notes underline them: "key", "bar" or "theme" linked in every line would be noise.
  const terms = [...new Set(allWords().filter((w) => w.inNotes).flatMap((w) => [w.term, ...w.aka]))].sort((a, b) => b.length - a.length)
  const escape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
  finder = new RegExp(`(?<![\\p{L}\\p{N}-])(${terms.map(escape).join('|')})(?![\\p{L}\\p{N}-])`, 'giu')
  return finder
}

/**
 * The specialist words a definition names that have entries of their own
 * ("…set out (the exposition)…"), to be followed from it: each once, the first
 * time, and never the entry's own word. Plurals and other forms aren't guessed at.
 */
export function crossReferences(definition: string, self: string): DefinitionPiece[] {
  const seen = new Set([self])
  const out: DefinitionPiece[] = []
  let at = 0
  for (const m of definition.matchAll(wordFinder())) {
    // By any name, to the word itself: "the English horn" in the cor anglais's own line is no reference.
    const term = mainTerm(m[1].toLowerCase().replace(/\s+/g, ' '))
    if (seen.has(term)) continue
    seen.add(term)
    if (m.index > at) out.push(definition.slice(at, m.index))
    out.push({ term, text: m[1] })
    at = m.index + m[1].length
  }
  if (at < definition.length) out.push(definition.slice(at))
  return out
}

/** An entry's id on the page, for a jump to it from another word or the letter index. */
export const wordAnchor = (term: string): string => `word-${term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`

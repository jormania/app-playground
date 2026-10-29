import { describe, it, expect } from 'vitest'
import { matchTrack, workTracks, isExcerpt, workPart, movementTitle, orchestraTokens, searchQueries, type SpotifyTrackLike } from './match'
import type { ProposedRecording } from '../domain/types'

/**
 * The matching audit (29 October 2026): each case is a way a real Spotify
 * billing differs from the curator's, found in review after three misses in one
 * evening. Track names and credits are written as Spotify bills them.
 */
let n = 0
const tr = (name: string, artists: string[], album = 'Album', albumId = 'alb', extra: Partial<SpotifyTrackLike> = {}): SpotifyTrackLike =>
  ({ id: `t${++n}`, name, uri: `spotify:track:t${n}`, artists: artists.map((a) => ({ name: a })), album: { id: albumId, name: album }, ...extra })
const level = (t: SpotifyTrackLike, p: ProposedRecording) => matchTrack(t, p).level

describe('names spelt another way', () => {
  it('knows a composer under another transliteration', () => {
    const p: ProposedRecording = { composer: 'Sergei Rachmaninov', work: 'Piano Concerto No. 2', conductor: 'Stanisław Wisłocki', orchestra: 'Warsaw Philharmonic Orchestra', soloists: [{ name: 'Sviatoslav Richter', instrument: 'piano' }] }
    expect(level(tr('Piano Concerto No. 2 in C Minor, Op. 18: I. Moderato', ['Sergei Rachmaninoff', 'Sviatoslav Richter', 'Warsaw Philharmonic Orchestra', 'Stanisław Wisłocki']), p)).toBe('strong')
    const t: ProposedRecording = { composer: 'Pyotr Ilyich Tchaikovsky', work: 'Symphony No. 6', conductor: 'Evgeny Mravinsky', orchestra: 'Leningrad Philharmonic Orchestra', soloists: [] }
    expect(level(tr('Sinfonie Nr. 6 h-Moll, Op. 74 "Pathétique": I. Adagio', ['Peter Iljitsch Tschaikowsky', 'Leningrader Philharmoniker', 'Jewgeni Mrawinski']), t)).toBe('strong')
    const s: ProposedRecording = { composer: 'Dmitri Shostakovich', work: 'Symphony No. 5', conductor: 'Kurt Sanderling', orchestra: 'Berlin Symphony Orchestra', soloists: [] }
    expect(level(tr('Symphonie Nr. 5 d-Moll, Op. 47: I. Moderato', ['Dmitri Schostakowitsch', 'Berliner Sinfonie-Orchester', 'Kurt Sanderling']), s)).toBe('strong')
  })

  it('knows a performer under another transliteration', () => {
    const p: ProposedRecording = { composer: 'Aram Khachaturian', work: 'Violin Concerto', conductor: 'Aram Khachaturian', orchestra: 'Philharmonia Orchestra', soloists: [{ name: 'David Oistrakh', instrument: 'violin' }] }
    expect(level(tr('Violinkonzert d-Moll: I. Allegro con fermezza', ['Aram Chatschaturjan', 'David Oistrach', 'Philharmonia Orchestra']), p)).toBe('strong')
  })

  it('still tells two different people apart', () => {
    const p: ProposedRecording = { composer: 'Johann Sebastian Bach', work: 'Goldberg Variations', soloists: [{ name: 'Glenn Gould', instrument: 'piano' }] }
    expect(level(tr('Goldberg Variations, BWV 988: Aria', ['Johann Sebastian Bach', 'Murray Perahia']), p)).toBe('none')
  })
})

describe('orchestras billed another way', () => {
  const p = (orchestra: string): ProposedRecording => ({ composer: 'Ludwig van Beethoven', work: 'Symphony No. 7', conductor: 'Herbert Blomstedt', orchestra, soloists: [] })
  const t = (band: string) => tr('Symphony No. 7 in A Major, Op. 92: I. Poco sostenuto', ['Ludwig van Beethoven', band, 'Herbert Blomstedt'])

  it('reads a German compound or another language as the same band', () => {
    expect(level(t('Gewandhausorchester Leipzig'), p('Leipzig Gewandhaus Orchestra'))).toBe('strong')
    expect(level(t('Concertgebouworkest'), p('Royal Concertgebouw Orchestra'))).toBe('strong')
    expect(level(t('Symphonieorchester des Bayerischen Rundfunks'), p('Bavarian Radio Symphony Orchestra'))).toBe('strong')
    expect(level(t('Česká filharmonie'), p('Czech Philharmonic'))).toBe('strong')
    expect(level(t('Stuttgart State Orchestra'), p('Staatsorchester Stuttgart'))).toBe('strong')
    expect(level(t('Wiener Symphoniker'), p('Vienna Symphony Orchestra'))).toBe('strong')
  })

  it('keeps two orchestras of one city apart', () => {
    expect(level(t('London Philharmonic Orchestra'), p('London Symphony Orchestra'))).not.toBe('strong')
    expect(level(t('Wiener Philharmoniker'), p('Vienna Symphony Orchestra'))).not.toBe('strong')
    expect(level(t('BBC Philharmonic'), p('BBC Symphony Orchestra'))).not.toBe('strong')
    expect(level(t('Orchestre Philharmonique de Radio France'), p('Orchestre National de France'))).not.toBe('strong')
    expect(orchestraTokens('Royal Philharmonic Orchestra')).toEqual(['royal', 'philharmonic'])
  })
})

describe('titles in another language', () => {
  const who = { conductor: 'Claudio Abbado', orchestra: 'Berliner Philharmoniker', soloists: [] }
  it('reads German and French titles as the English ones', () => {
    expect(level(tr('Klavierkonzert Nr. 5 Es-Dur, Op. 73: I. Allegro', ['Ludwig van Beethoven', 'Maurizio Pollini', 'Berliner Philharmoniker', 'Claudio Abbado']),
      { composer: 'Ludwig van Beethoven', work: 'Piano Concerto No. 5 in E-flat major', ...who, soloists: [{ name: 'Maurizio Pollini' }] })).toBe('strong')
    expect(level(tr('Streichquartett Nr. 14 d-Moll, D. 810: I. Allegro', ['Franz Schubert', 'Alban Berg Quartett']),
      { composer: 'Franz Schubert', work: 'String Quartet No. 14 in D minor', ensemble: 'Alban Berg Quartet', soloists: [] })).toBe('strong')
    expect(level(tr('Konzert für Orchester, Sz. 116: I. Introduzione', ['Béla Bartók', 'Berliner Philharmoniker', 'Claudio Abbado']),
      { composer: 'Béla Bartók', work: 'Concerto for Orchestra', ...who })).toBe('strong')
    expect(level(tr('Quatuor à cordes en sol mineur, Op. 10: I. Animé et très décidé', ['Claude Debussy', 'Quatuor Ébène']),
      { composer: 'Claude Debussy', work: 'String Quartet in G minor', ensemble: 'Quatuor Ébène', soloists: [] })).toBe('strong')
  })

  it('reads "&" as "and"', () => {
    expect(level(tr('Prelude & Fugue in A Minor, BWV 543', ['Johann Sebastian Bach', 'Ton Koopman']),
      { composer: 'Johann Sebastian Bach', work: 'Prelude and Fugue in A minor', soloists: [{ name: 'Ton Koopman', instrument: 'organ' }] })).toBe('strong')
  })
})

describe('the work, not a neighbour', () => {
  const beethoven = (work: string): ProposedRecording => ({ composer: 'Ludwig van Beethoven', work, conductor: 'Carlos Kleiber', orchestra: 'Wiener Philharmoniker', soloists: [] })
  const credits = ['Ludwig van Beethoven', 'Wiener Philharmoniker', 'Carlos Kleiber']

  it('never takes a movement number after " - " for the work’s number', () => {
    expect(workPart('Symphony No. 7 in A Major, Op. 92 - 2. Allegretto')).toBe('Symphony No. 7 in A Major, Op. 92')
    expect(level(tr('Symphony No. 7 in A Major, Op. 92 - 2. Allegretto', credits), beethoven('Symphony No. 2'))).toBe('none')
    expect(movementTitle('Symphony No. 7 in A Major, Op. 92 - 2. Allegretto')).toBe('2. Allegretto')
  })

  it('keeps a dash inside the movement’s own name in the movement', () => {
    expect(workPart('Cello Concerto in E Minor, Op. 85: I. Adagio - Moderato')).toBe('Cello Concerto in E Minor, Op. 85')
    expect(movementTitle('Cello Concerto in E Minor, Op. 85: I. Adagio - Moderato')).toBe('I. Adagio - Moderato')
    // And the old rule holds: "Urlicht" is the second symphony's fourth movement, not Symphony No. 4.
    expect(workPart('Symphony No. 2 in C Minor: 4. Urlicht - Sehr feierlich')).toBe('Symphony No. 2 in C Minor')
  })

  it('takes a genre-and-key title billed without its key, or after the composer’s name', () => {
    const elgar: ProposedRecording = { composer: 'Edward Elgar', work: 'Cello Concerto in E minor', conductor: 'John Barbirolli', orchestra: 'London Symphony Orchestra', soloists: [{ name: 'Jacqueline du Pré', instrument: 'cello' }] }
    const by = ['Edward Elgar', 'Jacqueline du Pré', 'London Symphony Orchestra', 'Sir John Barbirolli']
    expect(level(tr('Cello Concerto, Op. 85: I. Adagio - Moderato', by), elgar)).toBe('strong')
    expect(level(tr('Elgar: Cello Concerto, Op. 85: I. Adagio - Moderato', by), elgar)).toBe('strong')
  })

  it('never takes a work in another key', () => {
    const mozart: ProposedRecording = { composer: 'Wolfgang Amadeus Mozart', work: 'Piano Concerto in D minor', conductor: 'Claudio Abbado', orchestra: 'Berliner Philharmoniker', soloists: [{ name: 'Maurizio Pollini' }] }
    const by = ['Wolfgang Amadeus Mozart', 'Maurizio Pollini', 'Berliner Philharmoniker', 'Claudio Abbado']
    expect(level(tr('Piano Concerto No. 26 in D Major, K. 537 "Coronation": I. Allegro', by), mozart)).toBe('none')
    expect(level(tr('Piano Concerto No. 20 in D Minor, K. 466: I. Allegro', by), mozart)).toBe('strong')
    // German key names: "Es-Dur" is E-flat major, "h-Moll" B minor, "B-Dur" B-flat major.
    expect(level(tr('Sinfonie Nr. 3 Es-Dur, Op. 55 "Eroica": I. Allegro con brio', credits), beethoven('Symphony No. 3 in E-flat major'))).toBe('strong')
    expect(level(tr('Sinfonie Nr. 4 B-Dur, Op. 60: I. Adagio', credits), beethoven('Symphony No. 4 in B-flat major'))).toBe('strong')
  })

  it('never takes a work of another title for a title that is only a genre and a key', () => {
    const p: ProposedRecording = { composer: 'Igor Stravinsky', work: 'Symphony in C', conductor: 'Igor Stravinsky', orchestra: 'CBC Symphony Orchestra', soloists: [] }
    const by = ['Igor Stravinsky', 'CBC Symphony Orchestra']
    expect(level(tr('Symphony in Three Movements: I. Overture', by), p)).toBe('none')
    expect(level(tr('Symphony in C: I. Moderato alla breve', by), p)).toBe('strong')
  })
})

describe('a movement on a compilation is not the work', () => {
  const p: ProposedRecording = { composer: 'Gustav Mahler', work: 'Symphony No. 5', conductor: 'Herbert von Karajan', orchestra: 'Berliner Philharmoniker', soloists: [] }
  const by = ['Gustav Mahler', 'Berliner Philharmoniker', 'Herbert von Karajan']

  it('calls a run that starts past the first movement an excerpt', () => {
    const adagietto = tr('Symphony No. 5 in C-Sharp Minor: IV. Adagietto', by, 'Adagio Karajan', 'comp', { track_number: 3 })
    const others = [tr('Canon in D', ['Johann Pachelbel', 'Berliner Philharmoniker', 'Herbert von Karajan'], 'Adagio Karajan', 'comp', { track_number: 2 }), adagietto]
    expect(isExcerpt(workTracks(others, adagietto, p.work, p), p)).toBe(true)
  })

  it('takes the movement when the proposal is that movement', () => {
    const adagietto = tr('Symphony No. 5 in C-Sharp Minor: IV. Adagietto', by, 'Adagio Karajan', 'comp')
    expect(isExcerpt([adagietto], { work: 'Adagietto from Symphony No. 5' })).toBe(false)
  })

  it('takes the whole symphony as the work', () => {
    const tracks = ['I. Trauermarsch', 'II. Stürmisch bewegt', 'III. Scherzo', 'IV. Adagietto', 'V. Rondo-Finale'].map((m, i) =>
      tr(`Symphony No. 5 in C-Sharp Minor: ${m}`, by, 'Mahler: Symphony No. 5', 'full', { track_number: i + 1 }))
    expect(isExcerpt(workTracks(tracks, tracks[3], p.work, p), p)).toBe(false)
    expect(workTracks(tracks, tracks[3], p.work, p)).toHaveLength(5)
  })
})

describe('the search', () => {
  it('ends with the composer and the work alone, which finds a stand-in the curator chose from that list', () => {
    const p: ProposedRecording = { composer: 'György Ligeti', work: 'Lontano', conductor: 'Jonathan Nott', orchestra: 'Berlin Philharmonic', soloists: [] }
    expect(searchQueries(p).at(-1)).toBe('ligeti lontano')
  })
})

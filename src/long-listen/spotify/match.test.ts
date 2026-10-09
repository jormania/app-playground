import { describe, it, expect } from 'vitest'
import { matchTrack, bestTrack, workTracks, searchQueries, orchestraTokens, workOverlap, catalogueAgrees } from './match'
import type { ProposedRecording } from '../domain/types'
import type { SpotifyTrackLike } from './match'

const kleiber: ProposedRecording = { composer: 'Ludwig van Beethoven', work: 'Symphony No. 5 in C minor', catalogue: 'Op. 67', conductor: 'Carlos Kleiber', orchestra: 'Vienna Philharmonic', soloists: [] }

const track = (id: string, name: string, artists: string[], album = 'Beethoven: Symphonies Nos. 5 & 7', n = 1): SpotifyTrackLike =>
  ({ id, name, uri: `spotify:track:${id}`, artists: artists.map((a) => ({ name: a })), album: { id: 'alb', name: album }, track_number: n, disc_number: 1 })

describe('matching a proposed recording to Spotify', () => {
  it('accepts the right work by the right performers, across billing languages', () => {
    const t = track('t1', 'Symphony No. 5 in C Minor, Op. 67: I. Allegro con brio', ['Ludwig van Beethoven', 'Wiener Philharmoniker', 'Carlos Kleiber'])
    expect(matchTrack(t, kleiber)).toMatchObject({ level: 'strong', missing: [] })
  })

  it('refuses the right work by someone else — a recording is not interchangeable', () => {
    const t = track('t2', 'Symphony No. 5 in C Minor, Op. 67: I. Allegro con brio', ['Ludwig van Beethoven', 'Berliner Philharmoniker', 'Herbert von Karajan'])
    expect(matchTrack(t, kleiber).level).toBe('none')
  })

  it('refuses a different work by the right performers', () => {
    const t = track('t3', 'Symphony No. 7 in A Major, Op. 92: I. Poco sostenuto', ['Ludwig van Beethoven', 'Wiener Philharmoniker', 'Carlos Kleiber'])
    expect(matchTrack(t, kleiber).level).toBe('none')
  })

  it('does not let No. 15 pass for No. 5', () => {
    expect(workOverlap('Symphony No. 5', 'Symphony No. 15 in A Major: I. Allegretto')).toBeLessThan(1)
  })

  it('refuses the same performers in another composer’s work of the same name', () => {
    // A real one: Karajan's Berlin Sibelius 7 was matched to his Beethoven 7.
    const sibelius: ProposedRecording = { composer: 'Jean Sibelius', work: 'Symphony No. 7 in C major', catalogue: 'Op. 105', conductor: 'Herbert von Karajan', orchestra: 'Berlin Philharmonic', soloists: [] }
    const t = track('b7', 'Symphony No. 7 in A Major, Op. 92: III. Presto', ['Ludwig van Beethoven', 'Berliner Philharmoniker', 'Herbert von Karajan'], 'Beethoven: Symphonies Nos.4 & 7')
    expect(matchTrack(t, sibelius).level).toBe('none')
    const right = track('s7', 'Symphony No. 7 in C Major, Op. 105', ['Jean Sibelius', 'Berliner Philharmoniker', 'Herbert von Karajan'], 'Sibelius: Symphonies Nos. 4 & 7')
    expect(matchTrack(right, sibelius).level).toBe('strong')
  })

  it('accepts a composer named only in the title, and refuses a contradicting catalogue number', () => {
    const t = track('t9', 'Beethoven: Symphony No. 5 in C Minor, Op. 67: I. Allegro con brio', ['Wiener Philharmoniker', 'Carlos Kleiber'])
    expect(matchTrack(t, kleiber).level).toBe('strong')
    const wrongOpus = track('t10', 'Symphony No. 5, Op. 68: I. Allegro', ['Ludwig van Beethoven', 'Wiener Philharmoniker', 'Carlos Kleiber'])
    expect(matchTrack(wrongOpus, kleiber).level).toBe('none')
  })

  it('refuses an album released before the proposed recording was made', () => {
    const later: ProposedRecording = { ...kleiber, year: '1982' }
    const t = { ...track('t11', 'Symphony No. 5 in C Minor, Op. 67: I. Allegro con brio', ['Ludwig van Beethoven', 'Wiener Philharmoniker', 'Carlos Kleiber']), album: { id: 'old', name: 'Beethoven 5', release_date: '1975-03-01' } }
    expect(matchTrack(t, later).level).toBe('none')
    expect(matchTrack({ ...t, album: { ...t.album, release_date: '1995' } }, later).level).toBe('strong') // a reissue is fine
  })

  it('ignores a bracketed version note Spotify never prints', () => {
    const richter: ProposedRecording = { composer: 'Modest Mussorgsky', work: 'Pictures at an Exhibition (original piano version)', soloists: [{ name: 'Sviatoslav Richter', instrument: 'piano' }] }
    const t = track('r1', 'Pictures at an Exhibition: Promenade I', ['Modest Mussorgsky', 'Sviatoslav Richter'], 'Mussorgsky: Pictures at an Exhibition (Live in Sofia, 1958)')
    expect(matchTrack(t, richter).level).toBe('strong')
    expect(searchQueries(richter)[0]).not.toMatch(/original|version/)
  })

  it('reads the work from the album when the track names only a movement', () => {
    const t = track('t4', 'I. Allegro con brio', ['Ludwig van Beethoven', 'Wiener Philharmoniker', 'Carlos Kleiber'], 'Beethoven: Symphony No. 5')
    expect(matchTrack(t, kleiber).level).not.toBe('none')
  })

  it('calls it probable when the conductor is right but the orchestra is not credited', () => {
    const t = track('t5', 'Symphony No. 5 in C Minor, Op. 67: II. Andante con moto', ['Ludwig van Beethoven', 'Carlos Kleiber'])
    expect(matchTrack(t, kleiber)).toMatchObject({ level: 'probable', missing: ['Vienna Philharmonic'] })
  })

  it('handles soloists and ensembles', () => {
    const p: ProposedRecording = { composer: 'Jean Sibelius', work: 'Violin Concerto in D minor', conductor: 'Esa-Pekka Salonen', orchestra: 'Los Angeles Philharmonic', soloists: [{ name: 'Hilary Hahn', instrument: 'violin' }] }
    const t = track('s1', 'Violin Concerto in D Minor, Op. 47: I. Allegro moderato', ['Jean Sibelius', 'Hilary Hahn', 'Los Angeles Philharmonic', 'Esa-Pekka Salonen'], 'Schoenberg & Sibelius: Violin Concertos')
    expect(matchTrack(t, p).level).toBe('strong')
  })

  it('picks the strongest candidate, and nothing when none fits', () => {
    const good = track('g', 'Symphony No. 5 in C Minor, Op. 67: I. Allegro con brio', ['Ludwig van Beethoven', 'Wiener Philharmoniker', 'Carlos Kleiber'])
    const near = track('n', 'Symphony No. 5 in C Minor, Op. 67: I. Allegro con brio', ['Ludwig van Beethoven', 'Carlos Kleiber'])
    const wrong = track('w', 'Symphony No. 5', ['Ludwig van Beethoven', 'Other Orchestra', 'Someone Else'])
    expect(bestTrack([wrong, near, good], kleiber)?.track.id).toBe('g')
    expect(bestTrack([wrong], kleiber)).toBeNull()
  })
})

describe('the tracks of a work on an album', () => {
  it('takes the consecutive movements around the match and stops at the next work', () => {
    const artists = ['Ludwig van Beethoven', 'Wiener Philharmoniker', 'Carlos Kleiber']
    const album = [
      track('a1', 'Symphony No. 5 in C Minor, Op. 67: I. Allegro con brio', artists, undefined, 1),
      track('a2', 'Symphony No. 5 in C Minor, Op. 67: II. Andante con moto', artists, undefined, 2),
      track('a3', 'Symphony No. 5 in C Minor, Op. 67: III. Allegro', artists, undefined, 3),
      track('a4', 'Symphony No. 5 in C Minor, Op. 67: IV. Allegro', artists, undefined, 4),
      track('a5', 'Symphony No. 7 in A Major, Op. 92: I. Poco sostenuto', artists, undefined, 5),
    ]
    expect(workTracks(album, album[1], kleiber.work).map((t) => t.id)).toEqual(['a1', 'a2', 'a3', 'a4'])
  })
})

describe('search', () => {
  it('builds specific queries first, without key signatures', () => {
    expect(searchQueries(kleiber)[0]).toBe('beethoven symphony 5 kleiber')
    expect(searchQueries(kleiber)).toContain('symphony 5 kleiber vienna')
  })

  it('reduces orchestra names to what distinguishes them', () => {
    expect(orchestraTokens('London Symphony Orchestra')).toEqual(['london'])
    expect(orchestraTokens('Orchestre de Paris')).toEqual(['paris'])
    expect(orchestraTokens('Wiener Philharmoniker')).toEqual(['vienna'])
  })
})

describe('one work, named two ways', () => {
  it('reads violoncello as cello', () => {
    expect(workOverlap('Cello Concerto', 'Concerto for Violoncello and Orchestra')).toBe(1)
    expect(workOverlap('Cello Concerto No. 1', 'Concerto pour violoncelle n° 1')).toBe(1)
  })

  it('agrees on a catalogue number only when it is the same one', () => {
    const p = { composer: 'Johannes Brahms', work: 'Double Concerto in A minor', catalogue: 'Op. 102', soloists: [] }
    expect(catalogueAgrees(p, 'Concerto for Violin, Cello and Orchestra in A minor, Op. 102: I. Allegro')).toBe(true)
    expect(catalogueAgrees(p, 'Violin Concerto in D major, Op. 77')).toBe(false)
    expect(catalogueAgrees({ ...p, catalogue: '' }, 'Op. 102')).toBe(false)
  })
})

describe('a work whose tracks are named only by movement', () => {
  const tr = (id: string, name: string, n: number) => ({ id, name, uri: `spotify:track:${id}`, artists: [], track_number: n, disc_number: 1 })
  it('takes the run of numbered movements around the match, and stops at the next work', () => {
    const album = [tr('a', 'I. Allegro', 1), tr('b', 'II. Andante', 2), tr('c', 'III. Finale', 3), tr('d', 'I. Moderato', 4), tr('e', 'II. Presto', 5)]
    expect(workTracks(album, album[1], 'Symphony No. 4').map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })
  it('keeps the matched track alone when nothing is numbered', () => {
    const album = [tr('a', 'Prelude', 1), tr('b', 'Nocturne', 2)]
    expect(workTracks(album, album[0], 'Suite').map((t) => t.id)).toEqual(['a'])
  })
})

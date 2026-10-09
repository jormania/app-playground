import { describe, it, expect } from 'vitest'
import { matchTrack, bestTrack, workTracks, searchQueries, orchestraTokens, workOverlap } from './match'
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

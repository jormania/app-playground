// Audit: matcher scenarios normal use doesn't hit. Each test asserts the
// correct behaviour and fails against the current matcher.
import { describe, it, expect } from 'vitest'
import { matchTrack } from '../spotify/match'
import type { ProposedRecording } from '../domain/types'
import type { SpotifyTrackLike } from '../spotify/match'

const track = (id: string, name: string, artists: string[], album: string): SpotifyTrackLike =>
  ({ id, name, uri: `spotify:track:${id}`, artists: artists.map((a) => ({ name: a })), album: { id: 'alb', name: album }, track_number: 1, disc_number: 1 })

describe('audit: catalogue numbers in an ALBUM name rule out the right track', () => {
  it('a coupling album naming the other work’s opus does not contradict this work', () => {
    // Very common billing: the album names both works with their opus numbers.
    const p: ProposedRecording = { composer: 'Ludwig van Beethoven', work: 'Symphony No. 7 in A major, Op. 92', conductor: 'Carlos Kleiber', orchestra: 'Vienna Philharmonic', soloists: [] }
    const t = track('t7', 'Symphony No. 7 in A Major, Op. 92: I. Poco sostenuto - Vivace',
      ['Ludwig van Beethoven', 'Wiener Philharmoniker', 'Carlos Kleiber'],
      'Beethoven: Symphony No. 5, Op. 67 & Symphony No. 7, Op. 92')
    // The track itself names exactly Op. 92; only the album also names Op. 67.
    expect(matchTrack(t, p).level).toBe('strong')
  })
})

describe('audit: catalogue spellings Spotify uses defeat the title overlap', () => {
  it('"BWV1048" (no space) is the same as "BWV 1048"', () => {
    const p: ProposedRecording = { composer: 'Johann Sebastian Bach', work: 'Brandenburg Concerto No. 3 in G major, BWV 1048', conductor: 'Trevor Pinnock', ensemble: 'The English Concert', soloists: [] }
    const t = track('b3', 'Brandenburg Concerto No. 3 in G Major, BWV1048: I. Allegro',
      ['Johann Sebastian Bach', 'The English Concert', 'Trevor Pinnock'], 'Bach: The Brandenburg Concertos')
    expect(matchTrack(t, p).level).toBe('strong')
  })

  it('"KV 550" is the same as "K. 550"', () => {
    const p: ProposedRecording = { composer: 'Wolfgang Amadeus Mozart', work: 'Symphony No. 40 in G minor, K. 550', conductor: 'Karl Böhm', orchestra: 'Vienna Philharmonic', soloists: [] }
    const t = track('m40', 'Symphony No. 40 in G Minor, KV 550: I. Molto allegro',
      ['Wolfgang Amadeus Mozart', 'Wiener Philharmoniker', 'Karl Böhm'], 'Mozart: Symphonies Nos. 40 & 41')
    expect(matchTrack(t, p).level).toBe('strong')
  })

  it('a nickname in the proposal, absent from the track, does not demote a track whose catalogue number agrees', () => {
    const p: ProposedRecording = { composer: 'Ludwig van Beethoven', work: 'Symphony No. 3 in E-flat major, Op. 55 "Eroica"', conductor: 'Carlos Kleiber', orchestra: 'Vienna Philharmonic', soloists: [] }
    const t = track('e1', 'Symphony No. 3 in E-Flat Major, Op. 55: I. Allegro con brio',
      ['Ludwig van Beethoven', 'Wiener Philharmoniker', 'Carlos Kleiber'], 'Beethoven: Symphonies Nos. 3 & 4')
    expect(matchTrack(t, p).level).toBe('strong')
  })
})

describe('audit: an Arabic movement number passes for the work number', () => {
  it('"Symphony No. 2 …: 4. Urlicht" is not Symphony No. 4', () => {
    // Mahler symphonies carry no catalogue number, so nothing else contradicts it.
    const p: ProposedRecording = { composer: 'Gustav Mahler', work: 'Symphony No. 4', conductor: 'Simon Rattle', orchestra: 'Berlin Philharmonic', soloists: [] }
    const t = track('m2', 'Symphony No. 2 in C Minor "Resurrection": 4. Urlicht',
      ['Gustav Mahler', 'Berliner Philharmoniker', 'Sir Simon Rattle'], 'Mahler: Symphony No. 2')
    expect(matchTrack(t, p).level).toBe('none')
  })
})

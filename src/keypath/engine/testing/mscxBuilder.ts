// Tiny MuseScore scores for tests, laid out the way MuseScore 4 and
// MuseScore 2 write them (checked against files each version wrote). No
// music files in the repo: every score here is a few made-up notes.

export interface MNote {
  pitch: number
  finger?: number
  /** Tied to the next note of this pitch. */
  tie?: boolean
}

/** A chord or rest: its value ('quarter', 'eighth'…), dots, notes (none is a rest). */
export interface MChord {
  type: string
  dots?: number
  notes?: MNote[]
  grace?: boolean
  /** MuseScore 2: the voice's track, and the tuplet it's in. */
  track?: number
  tupletId?: string
}

function note4(n: MNote): string {
  const finger = n.finger ? `<Fingering><text>${n.finger}</text></Fingering>` : ''
  const tie = n.tie ? '<Spanner type="Tie"><Tie></Tie><next><location><fractions>1/4</fractions></location></next></Spanner>' : ''
  return `<Note>${finger}${tie}<pitch>${n.pitch}</pitch><tpc>14</tpc></Note>`
}

function note2(n: MNote): string {
  const finger = n.finger ? `<Fingering><text>${n.finger}</text></Fingering>` : ''
  const tie = n.tie ? '<Tie id="9"></Tie>' : ''
  return `<Note>${tie}${finger}<pitch>${n.pitch}</pitch><tpc>14</tpc></Note>`
}

export function chord(c: MChord, version: 2 | 4 = 4): string {
  const inner = `${c.track !== undefined ? `<track>${c.track}</track>` : ''}${c.tupletId ? `<Tuplet>${c.tupletId}</Tuplet>` : ''}${c.dots ? `<dots>${c.dots}</dots>` : ''}<durationType>${c.type}</durationType>${c.grace ? '<acciaccatura/>' : ''}`
  if (!c.notes?.length) return `<Rest>${inner}</Rest>`
  return `<Chord>${inner}${c.notes.map(version === 4 ? note4 : note2).join('')}</Chord>`
}

export const tempo = (bpm: number) => `<Tempo><tempo>${bpm / 60}</tempo><followText>1</followText><text>= ${bpm}</text></Tempo>`
export const timeSig = (n: number, d: number) => `<TimeSig><sigN>${n}</sigN><sigD>${d}</sigD></TimeSig>`
export const tuplet4 = (normal: number, actual: number) => `<Tuplet><normalNotes>${normal}</normalNotes><actualNotes>${actual}</actualNotes><baseNote>eighth</baseNote></Tuplet>`
export const volta4 = (endings: string, measures = 1) => `<Spanner type="Volta"><Volta><endings>${endings}</endings></Volta><next><location><measures>${measures}</measures></location></next></Spanner>`

/** A MuseScore 4 bar: optional repeat signs, then each voice's contents. */
export function measure4(voices: string[], o: { len?: string; start?: boolean; end?: number } = {}): string {
  return `<Measure${o.len ? ` len="${o.len}"` : ''}>${o.len ? '<irregular>1</irregular>' : ''}${o.start ? '<startRepeat/>' : ''}${o.end ? `<endRepeat>${o.end}</endRepeat>` : ''}${voices.map((v) => `<voice>${v}</voice>`).join('')}</Measure>`
}

/** A MuseScore 2 bar: numbered, no <voice>; a second voice follows a <tick> back to the bar's start. */
export const measure2 = (number: number, body: string, o: { start?: boolean; end?: number } = {}) => `<Measure number="${number}">${o.start ? '<startRepeat/>' : ''}${o.end ? `<endRepeat>${o.end}</endRepeat>` : ''}${body}</Measure>`

export interface MPart {
  name: string
  /** Each staff's bars. */
  staves: string[][]
  /** 'pitched' (the default), 'tablature' or 'percussion' for each staff. */
  groups?: string[]
}

export function mscx(o: { version: '2.06' | '3.02' | '4.20'; title?: string; parts: MPart[] }): string {
  let id = 0
  const decl: string[] = []
  const bodies: string[] = []
  for (const p of o.parts) {
    const staffDecl = p.staves.map((bars, k) => {
      id++
      bodies.push(`<Staff id="${id}">${bars.join('')}</Staff>`)
      return `<Staff id="${id}"><StaffType group="${p.groups?.[k] ?? 'pitched'}"><name>stdNormal</name></StaffType></Staff>`
    })
    decl.push(`<Part>${staffDecl.join('')}<trackName>${p.name}</trackName><Instrument><longName>${p.name}</longName></Instrument></Part>`)
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<museScore version="${o.version}"><programVersion>x</programVersion><Score><Division>480</Division>${o.title ? `<metaTag name="workTitle">${o.title}</metaTag>` : ''}${decl.join('')}${bodies.join('')}</Score></museScore>`
}

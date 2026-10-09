import type {
  CompanionResponse, CompareResponse, ContinuityResponse, CuratedItem, CuratorClient, ExplainResponse, ProgrammeResponse, ResourcesResponse, TasteResponse, ThemesResponse,
} from '../curation/api'
import { CuratorUnavailable } from '../curation/api'

/**
 * DEVELOPMENT ONLY — a canned curator, so the app can be built and looked at
 * without an Anthropic key. It is reachable only when `import.meta.env.DEV` is
 * true (see app/settings.ts) and every screen shows a "demo" ribbon while it is
 * on. Nothing here is curation: the same few programmes come back whatever you
 * do. The recordings are real ones, so Spotify verification can be tried
 * against them, but they are not checked here.
 */
const it = (composer: string, workTitle: string, performers: Partial<CuratedItem>, extra: Partial<CuratedItem> = {}): CuratedItem => ({
  composer, workTitle, soloists: [], character: ['clear'], why: '', whyThisRecording: '', listenFor: [], ...performers, ...extra,
})

const COLOUR: ProgrammeResponse = {
  programme: {
    title: 'The orchestra becomes colour',
    dek: 'Around 1900, French composers stopped treating the orchestra as a machine for argument and began to use it as a palette.',
    introduction: 'Something shifted in Paris at the turn of the century. Where the German symphony built its meaning from themes and their development, Debussy and the composers who followed him asked a different question: what does this chord, on these instruments, at this dynamic, sound like — and what does it make you see?\n\nThis week moves from the sea to a ballet to a spring morning. None of these works argues. Each one paints, and each asks you to listen to the surface of the sound as if it were the subject.',
    whyNow: 'You have spent time with music that builds; this is music that glows. A good week to listen for texture rather than tune.',
    historicalPlace: 'La mer was first heard in 1905, the same year as Strauss’s Salome. Ravel’s Daphnis followed in 1912 for Diaghilev’s Ballets Russes, a year before The Rite of Spring. Lili Boulanger, the first woman to win the Prix de Rome, wrote her spring piece in 1918, the year she and Debussy both died.',
    howTheyRelate: 'Debussy invents the language; Ravel, more precise and more theatrical, perfects its engineering; Boulanger, younger than both, uses it with a darker urgency that points beyond them.',
    sections: [
      { role: 'start', heading: 'Start here', items: [it('Claude Debussy', 'La mer', { conductor: 'Pierre Boulez', orchestra: 'The Cleveland Orchestra' }, {
        catalogue: 'L. 109', composed: '1903–05', form: 'symphonic sketches', workContext: 'Debussy called it “three symphonic sketches” and wrote much of it far from the sea, in Burgundy and in Eastbourne.',
        character: ['transparent', 'exact', 'cool'],
        why: 'The founding text of orchestral colour: three movements in which the sea is never described, only felt through changing light and motion.',
        whyThisRecording: 'Boulez makes every layer audible. You hear how the effects are built — which is the best way to hear how new they were.',
        listenFor: ['The cellos divided into four parts near the end of the first movement', 'How the second movement never settles on a downbeat', 'The chorale for brass that breaks through at the close'],
      })] },
      { role: 'then', heading: 'Where it leads', items: [it('Maurice Ravel', 'Daphnis et Chloé', { conductor: 'Pierre Monteux', orchestra: 'London Symphony Orchestra' }, {
        composed: '1909–12', form: 'ballet', workContext: 'Written for the Ballets Russes; Monteux conducted the premiere in 1912.',
        character: ['warm', 'theatrical'],
        why: 'Ravel’s largest score, and the one where colour becomes narrative. The dawn scene is the most famous sunrise in the repertoire.',
        whyThisRecording: 'Monteux conducted the first performance. His recording has the pacing of someone who knows where the dancers are.',
        listenFor: ['The murmuring flutes and harps that open Daybreak', 'The wordless chorus', 'How the final dance accelerates without losing clarity'],
      })] },
      { role: 'contrast', heading: 'A different perspective', items: [it('Lili Boulanger', "D'un matin de printemps", { conductor: 'Yan Pascal Tortelier', orchestra: 'BBC Philharmonic' }, {
        composed: '1918', form: 'orchestral piece',
        character: ['urgent', 'luminous'],
        why: 'Five minutes of spring written by a composer who knew she was dying. The palette is French; the energy is entirely her own.',
        whyThisRecording: 'Tortelier keeps it light on its feet, which makes the darker harmonies underneath more striking.',
        listenFor: ['The skipping opening rhythm', 'The sudden shadow in the middle section'],
      })] },
    ],
    comparisons: [{
      composer: 'Claude Debussy', workTitle: 'La mer', framing: 'Two ideas of what the sea should sound like.',
      whyBoth: 'If you want to hear how interpretation turns a seascape into a storm or a study, listen to both.',
      perspectives: [
        { conductor: 'Pierre Boulez', orchestra: 'The Cleveland Orchestra', soloists: [], character: 'Analytical, transparent, never sentimental.', listenFor: 'The balance of the divided strings.' },
        { conductor: 'Herbert von Karajan', orchestra: 'Berliner Philharmoniker', soloists: [], character: 'Sumptuous, blended, oceanic.', listenFor: 'The weight of the final climax.' },
      ],
    }],
  },
  removedRepeats: 0, promptVersion: 'demo', model: 'demo',
}

const AFTER_THE_WAR: ProgrammeResponse = {
  programme: {
    title: 'The orchestra after the war',
    dek: 'After 1945, composers took the orchestra apart and rebuilt it as texture, cloud and mass.',
    introduction: 'The war left a generation of composers suspicious of the grand gesture. Some turned to strict systems; others, especially in the 1960s, discovered that an orchestra could be used like a single instrument of enormous complexity, its individual lines dissolved into a sound.\n\nThis week begins with that dissolution and moves towards composers who found new ways to make the orchestra speak again.',
    whyNow: 'An adventurous turn. Hear it as weather rather than argument.',
    historicalPlace: 'Ligeti’s Atmosphères dates from 1961; Lutosławski’s Concerto for Orchestra from 1954, when he was still writing within the limits Polish socialist realism allowed; Boulez’s orchestral Notations grew from piano miniatures of 1945 across five decades.',
    howTheyRelate: 'Ligeti erases melody; Lutosławski keeps the folk tune and builds a cathedral on it; Boulez shows how a single idea can be orchestrated into a whole world.',
    sections: [
      { role: 'start', heading: 'Start here', items: [it('György Ligeti', 'Atmosphères', { conductor: 'Claudio Abbado', orchestra: 'Wiener Philharmoniker' }, {
        composed: '1961', character: ['vast', 'still'],
        why: 'No melody, no rhythm, no harmony in the usual sense — just slowly shifting clusters. It changed what an orchestra could be.',
        whyThisRecording: 'From Abbado’s Wien Modern album: the Vienna strings make the clusters glow rather than buzz.',
        listenFor: ['The opening cluster of every chromatic note at once', 'The moment the sound seems to drain upwards'],
      })] },
      { role: 'then', heading: 'Where it leads', items: [it('Witold Lutosławski', 'Concerto for Orchestra', { conductor: 'Edward Gardner', orchestra: 'BBC Symphony Orchestra' }, {
        composed: '1950–54', form: 'concerto for orchestra', character: ['muscular', 'bright'],
        why: 'Folk melodies from Mazovia, transformed into a showpiece that every section of the orchestra has to earn.',
        whyThisRecording: 'Gardner is fleet and precise; the passacaglia builds without bluster.',
        listenFor: ['The pedal note in the timpani that opens the work', 'The passacaglia theme in the basses at the start of the finale'],
      })] },
      { role: 'deeper', heading: 'Go deeper', items: [it('Pierre Boulez', 'Notations I–IV', { conductor: 'Daniel Barenboim', orchestra: 'Chicago Symphony Orchestra' }, {
        composed: '1945/1978', character: ['brilliant', 'compressed'],
        why: 'Twelve-bar piano pieces from a twenty-year-old Boulez, re-imagined decades later for an enormous orchestra.',
        whyThisRecording: 'Barenboim gives them a Romantic sweep Boulez himself would not — useful for hearing their drama.',
        listenFor: ['How fast the second Notation flies', 'The tolling bass of the third'],
      })] },
    ],
    comparisons: [],
  },
  removedRepeats: 0, promptVersion: 'demo', model: 'demo',
}

export const DEMO_RECORDINGS = { COLOUR, AFTER_THE_WAR }

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function demoCurator(): CuratorClient {
  return {
    async call<T>(op: string, payload: any): Promise<T> {
      await delay(op === 'programme' ? 900 : 400)
      switch (op) {
        case 'ping':
          return { ok: true, model: 'demo' } as T
        case 'themes': {
          const thread = payload?.context?.threads?.[0]
          const res: ThemesResponse = {
            options: [
              { mood: 'immersive', title: 'The orchestra becomes colour', pitch: 'French orchestral colour around 1900: Debussy, Ravel and Lili Boulanger, and what it means for an orchestra to paint rather than argue.', character: ['atmospheric', 'luminous', 'early 20th century'], why: 'A gentle way in, and a foundation for much that came later.', angle: 'Colour as the subject.' },
              thread
                ? { mood: 'curious', title: `${thread.title}, by another door`, pitch: 'A return to an earlier thread through composers and recordings it did not reach last time.', character: ['continuity', 'depth'], why: 'The thread left questions open.', angle: 'The composers who came after.', returning: { themeId: thread.themeId, note: `We first explored this ${thread.since}. This time we go where it pointed next.` } }
                : { mood: 'curious', title: 'One work, several interpretations', pitch: 'A single symphony heard through three conductors who disagree about what it means.', character: ['comparative', 'focused'], why: 'A way to hear interpretation itself.', angle: 'Interpretation as the subject.' },
              { mood: 'adventurous', title: 'The orchestra after the war', pitch: 'Ligeti, Lutosławski and Boulez rebuild the orchestra as texture, cloud and mass.', character: ['textural', 'post-1945', 'bracing'], why: 'New ground, approached from what you already like about colour.', angle: 'Texture over theme.' },
            ],
            promptVersion: 'demo', model: 'demo',
          }
          return res as T
        }
        case 'programme': {
          // "More of this theme" in the demo: the other canned programme, as a continuation.
          const base = payload?.extension
            ? { ...AFTER_THE_WAR, programme: { ...AFTER_THE_WAR.programme, title: `More: ${AFTER_THE_WAR.programme.title}`, continuityNote: 'Carrying on from where the week began.' } }
            : /war/i.test(payload?.option?.title ?? '') ? AFTER_THE_WAR : COLOUR
          // Like the real curator: a side-by-side pair only when the listener asked for them.
          return (payload?.preferences?.pairs ? base : { ...base, programme: { ...base.programme, comparisons: [] } }) as T
        }
        case 'taste':
          return { observations: payload.feedback.filter((f: any) => f.note).slice(0, 1).map((f: any) => ({ facet: 'orchestral-sound', subject: 'colour', statement: 'Drawn to orchestral colour and texture.', stance: 'drawn-to', confidence: 'tentative', evidence: [f.id] })), questions: [], promptVersion: 'demo' } satisfies TasteResponse as T
        case 'continuity':
          return { reaction: 'A good first visit.', openQuestions: ['Where does colour go after Debussy?'], adjacentTopics: ['Spectral music'], nextDirections: ['Roussel and Dutilleux carry the palette into the mid-century'], closingNote: 'You listened for the light.', promptVersion: 'demo' } satisfies ContinuityResponse as T
        case 'explain':
          return { heading: 'A little more context', body: 'Demo mode: the curator would write a short note here, pitched to what it knows of you.\n\nConnect the real curator to read one.', promptVersion: 'demo' } satisfies ExplainResponse as T
        case 'compare':
          return { framing: 'A conductor who knew the composer, set beside a modern analyst.', whyBoth: 'If you want to hear what tradition adds, listen to both.', current: { character: 'Analytical', listenFor: 'Balance' }, other: { conductor: 'Jean Martinon', orchestra: "Orchestre National de l'ORTF", soloists: [], character: 'Idiomatic, airy', listenFor: 'The woodwind phrasing' }, promptVersion: 'demo' } satisfies CompareResponse as T
        case 'resources':
          return { resources: [], dropped: 0, promptVersion: 'demo' } satisfies ResourcesResponse as T
        case 'companion':
          return {
            works: (payload?.works ?? []).map((w: { key: string; tracks: string[] }) => ({
              key: w.key,
              movements: w.tracks.map((name, i) => `Demo note for ${name}: ${i === 0 ? 'listen for how the opening gathers itself before the first theme arrives.' : 'notice what returns from the movement before, and what has changed in it.'}`),
            })),
            promptVersion: 'demo',
          } satisfies CompanionResponse as T
        default:
          throw new CuratorUnavailable('failed', 'The demo curator doesn’t know that request.')
      }
    },
  }
}

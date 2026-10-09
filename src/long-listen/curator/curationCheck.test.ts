import { describe, it, expect } from 'vitest'
import { PROFILES, curationReport, runCurationCheck } from './curationCheck'

// A stand-in for the API: answers each job with a small valid reply, and the
// programme once with a broken one first, so a retry shows in the report.
function fakeSend() {
  let programmeCalls = 0
  return async (body: Record<string, unknown>) => {
    const system = JSON.stringify(body.system)
    const reply = (o: unknown) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(o) }] })
    if (/three possible directions/.test(system)) {
      return reply({ options: (['immersive', 'curious', 'adventurous'] as const).map((mood, i) => ({
        mood, title: `Direction ${i + 1}`, pitch: 'A pitch.', character: ['x'], why: 'Why.', angle: 'Angle.', returningThemeId: '', continuityNote: '', form: i === 1 ? 'dialogue' : 'theme',
      })) })
    }
    programmeCalls++
    const item = (composer: string, workTitle: string, composed: string) => ({
      composer, workTitle, catalogue: '', composed, form: 'symphony', workContext: '', conductor: 'A Conductor', orchestra: 'An Orchestra', ensemble: '', soloists: [], year: '',
      character: ['clear'], why: `Why ${workTitle}.`, whyThisRecording: 'This one.', listenFor: ['the opening'], revisitReason: '',
    })
    if (programmeCalls === 1) return reply({ title: '', dek: '', introduction: '', whyNow: '', historicalPlace: '', howTheyRelate: '', continuityNote: '', sections: [], comparisons: [] })
    return reply({
      title: 'Programme', dek: 'Dek.', introduction: 'First paragraph.\n\nSecond.', whyNow: '', historicalPlace: '', howTheyRelate: '', continuityNote: '',
      sections: [{ role: 'start', heading: 'Start here', note: '', items: [item('Jean Sibelius', 'Symphony No. 5', '1915'), item('Carl Nielsen', 'Symphony No. 5', '1922'), item('Kaija Saariaho', 'Orion', '2002'), item('Arvo Pärt', 'Fratres', '1977'), item('Per Nørgård', 'Symphony No. 3', '1975')] }],
      comparisons: [],
    })
  }
}

describe('the curation check', () => {
  it('runs a profile through directions and a programme, and reports verdicts and writing', async () => {
    const results = await runCurationCheck(fakeSend(), [PROFILES[0]], '2026-11-23')
    expect(results[0].error).toBeUndefined()
    expect(results[0].attempts).toEqual({ themes: 1, programme: 2 })
    const report = curationReport(results, { programme: 'programme@test' })
    expect(report).toContain('## Narrow and familiar')
    expect(report).toContain('Attempts: directions 1, programme 2 — a retry means the first answer broke a rule')
    expect(report).toContain('5 works in 1 sections')
    expect(report).toContain('centuries 20, 21')
    expect(report).toContain('**Direction 1** — A pitch.')
    expect(report).toContain('First paragraph.')
  })

  it('has the four profiles the roadmap names', () => {
    expect(PROFILES.map((p) => p.name)).toEqual(['Narrow and familiar', 'Broad and obscure', 'A returning theme', 'Romanian'])
  })
})

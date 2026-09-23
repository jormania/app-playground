// Guardrail: private music never enters the repository.
//
// KeyPath's lesson engine is public code; the songs it will teach from mostly
// aren't (see KEYPATH.md, "Content"). Anything tracked here ships twice — to
// GitHub, and via Vite's public/ dir or an import into the Vercel bundle — so
// the only safe place for a MIDI or MusicXML file is outside this repo.
// .gitignore blocks the common cases; this test catches what slips past it
// (a `git add -f`, a new extension, a file renamed into public/).
//
// A genuinely public-domain test fixture may be added deliberately: put it in
// ALLOWED with the work, the edition, and why its status is certain.
import { execSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const MUSIC = /\.(mid|midi|kar|rmi|smf|musicxml|mxl|mscz|mscx|sib|gp|gpx|gp3|gp4|gp5|ly|abc|mei)$/i
// Scores are often PDFs; none belong under the app or its public assets.
const SCORE_PDF = /^(src\/keypath\/|public\/keypath).*\.pdf$/i

/** path → provenance note. Empty on purpose. */
const ALLOWED = {}

function tracked() {
  try {
    return execSync('git ls-files -z', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\0').filter(Boolean)
  } catch {
    return null // not a git checkout (e.g. an exported tarball) — nothing to police
  }
}

describe('KeyPath content boundary', () => {
  const files = tracked()

  it.skipIf(files === null)('no music or score files are tracked anywhere in the repo', () => {
    const offenders = files.filter((f) => (MUSIC.test(f) || SCORE_PDF.test(f)) && !(f in ALLOWED))
    expect(offenders, `music content is tracked — move it to private storage:\n${offenders.join('\n')}`).toEqual([])
  })
})

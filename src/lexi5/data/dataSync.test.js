import { describe, it, expect } from 'vitest'
import words from './words.json'
import lite from './dict-lite.json'
import standard from './dict-standard.json'
import expanded from './dict-expanded.json'
import expert from './dict-expert.json'
import guesses from './guesses.json'

/**
 * `words.json` remains the single hand-maintained source (and what
 * scripts/curate-lexi5-dictionary.mjs writes). The app loads the per-dictionary splits
 * instead, so only the selected list ships. Two copies of the same data can drift, and
 * drift here means the app serves a different word than the source says — so they're
 * pinned together.
 *
 * Regenerate the splits from words.json if this fails:
 *   node -e "const fs=require('fs'),w=require('./src/lexi5/data/words.json'); \
 *     for(const [k,l] of Object.entries(w.dictionaries)) \
 *       fs.writeFileSync(`src/lexi5/data/dict-${k}.json`, JSON.stringify(l)); \
 *     fs.writeFileSync('src/lexi5/data/guesses.json', JSON.stringify(w.guesses))"
 */
describe('word data splits stay in sync with words.json', () => {
  const splits = { lite, standard, expanded, expert }

  for (const [name, list] of Object.entries(splits)) {
    it(`dict-${name}.json matches words.json`, () => {
      expect(list).toEqual(words.dictionaries[name])
    })
  }

  it('guesses.json matches words.json', () => {
    expect(guesses).toEqual(words.guesses)
  })

  it('every answer is still a legal guess', () => {
    const guessSet = new Set(guesses)
    for (const [name, list] of Object.entries(splits)) {
      const missing = list.filter(w => !guessSet.has(w))
      expect(missing, `${name} has answers absent from the guess list`).toEqual([])
    }
  })
})

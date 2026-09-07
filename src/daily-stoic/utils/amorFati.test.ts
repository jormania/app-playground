import { describe, it, expect } from 'vitest';
import { ENTRY_SEPARATOR, splitEntries, normalizeFateInput } from './amorFati';

describe('a day can hold more than one obstacle', () => {
  it('reads an empty day as one empty entry', () => {
    expect(splitEntries('')).toEqual({ previous: [], current: '' });
  });

  it('treats a single obstacle as the one being edited', () => {
    expect(splitEntries('the heat')).toEqual({ previous: [], current: 'the heat' });
  });

  it('puts everything but the last entry behind the box', () => {
    const list = ['the heat', 'a cancelled train', 'the meeting'].join(ENTRY_SEPARATOR);
    expect(splitEntries(list)).toEqual({
      previous: ['the heat', 'a cancelled train'],
      current: 'the meeting',
    });
  });

  it('leaves the box empty right after "Add another"', () => {
    expect(splitEntries(`the heat${ENTRY_SEPARATOR}`)).toEqual({
      previous: ['the heat'],
      current: '',
    });
  });

  it('drops the empty tail and tidies the entries when saving', () => {
    expect(normalizeFateInput(`the heat${ENTRY_SEPARATOR}`)).toBe('the heat');
    expect(normalizeFateInput(`  the heat ${ENTRY_SEPARATOR} the train  `)).toBe(
      `the heat${ENTRY_SEPARATOR}the train`
    );
    expect(normalizeFateInput('')).toBe('');
    expect(normalizeFateInput(ENTRY_SEPARATOR)).toBe('');
  });

  it('leaves a plain sentence — what Full writes — untouched', () => {
    const sentence = 'I cannot control the heat, but I embrace it as it is.';
    expect(normalizeFateInput(sentence)).toBe(sentence);
    expect(splitEntries(sentence).current).toBe(sentence);
  });
});

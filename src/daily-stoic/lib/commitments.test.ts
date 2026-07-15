import { describe, it, expect } from 'vitest';
import {
  parseCommitments,
  serializeCommitments,
  createCommitment,
  addCommitment,
  updateCommitment,
  resolveCommitment,
  reopenCommitment,
  removeCommitment,
  openCommitments,
  dueCommitments,
  commitmentsCreatedOn,
  commitmentsResolvedOn,
  ledgerStats,
  Commitment,
} from './commitments';

const NOW = new Date('2026-07-15T09:00:00.000Z');

function make(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: overrides.id ?? 'c1',
    text: overrides.text ?? 'Answer the hard email',
    createdDay: overrides.createdDay ?? 3,
    createdAt: overrides.createdAt ?? NOW.toISOString(),
    status: overrides.status ?? 'open',
    resolvedDay: overrides.resolvedDay,
    resolvedAt: overrides.resolvedAt,
    linkedWorryId: overrides.linkedWorryId,
    virtue: overrides.virtue,
    note: overrides.note,
    source: overrides.source ?? 'self',
  };
}

describe('parseCommitments', () => {
  it('returns [] for empty, null, or malformed input', () => {
    expect(parseCommitments(null)).toEqual([]);
    expect(parseCommitments('')).toEqual([]);
    expect(parseCommitments('not json')).toEqual([]);
    expect(parseCommitments('{"not":"array"}')).toEqual([]);
  });

  it('drops entries missing id or text, keeps valid ones', () => {
    const raw = JSON.stringify([
      { id: 'a', text: 'keep me', createdDay: 1, status: 'open' },
      { id: 'b' }, // no text
      { text: 'no id' },
      null,
      'string',
    ]);
    const out = parseCommitments(raw);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a');
  });

  it('coerces an unknown status to open and defaults source to self', () => {
    const raw = JSON.stringify([{ id: 'a', text: 't', status: 'nonsense', source: 'weird' }]);
    const [c] = parseCommitments(raw);
    expect(c.status).toBe('open');
    expect(c.source).toBe('self');
  });

  it('round-trips through serialize', () => {
    const list = [make({ id: 'x', status: 'kept', resolvedDay: 4 })];
    expect(parseCommitments(serializeCommitments(list))).toEqual(list);
  });
});

describe('createCommitment / addCommitment', () => {
  it('creates an open commitment with injected id and timestamp', () => {
    const c = createCommitment({ text: '  do the thing  ', createdDay: 5 }, NOW, 'fixed-id');
    expect(c).toMatchObject({
      id: 'fixed-id',
      text: 'do the thing',
      createdDay: 5,
      status: 'open',
      source: 'self',
      createdAt: NOW.toISOString(),
    });
  });

  it('prepends new commitments (newest first) and ignores blank text', () => {
    let list: Commitment[] = [];
    list = addCommitment(list, { text: 'first', createdDay: 1 }, NOW, 'id1');
    list = addCommitment(list, { text: 'second', createdDay: 1 }, NOW, 'id2');
    expect(list.map((c) => c.text)).toEqual(['second', 'first']);
    expect(addCommitment(list, { text: '   ', createdDay: 1 })).toHaveLength(2);
  });
});

describe('resolve / reopen / update / remove', () => {
  it('resolves a promise as kept, stamping the resolved day', () => {
    const list = [make({ id: 'c1', status: 'open' })];
    const next = resolveCommitment(list, 'c1', 'kept', 7, undefined, NOW);
    expect(next[0]).toMatchObject({ status: 'kept', resolvedDay: 7, resolvedAt: NOW.toISOString() });
  });

  it('stores a note when breaking, and reopen clears the resolution', () => {
    let list = [make({ id: 'c1' })];
    list = resolveCommitment(list, 'c1', 'broken', 7, 'ran out of time', NOW);
    expect(list[0]).toMatchObject({ status: 'broken', note: 'ran out of time' });
    list = reopenCommitment(list, 'c1');
    expect(list[0]).toMatchObject({ status: 'open', resolvedDay: undefined, resolvedAt: undefined });
  });

  it('update patches fields but never changes the id', () => {
    const list = [make({ id: 'c1' })];
    const next = updateCommitment(list, 'c1', { id: 'hacked', text: 'new' } as Partial<Commitment>);
    expect(next[0].id).toBe('c1');
    expect(next[0].text).toBe('new');
  });

  it('removes by id', () => {
    const list = [make({ id: 'c1' }), make({ id: 'c2' })];
    expect(removeCommitment(list, 'c1').map((c) => c.id)).toEqual(['c2']);
  });
});

describe('selectors', () => {
  const list = [
    make({ id: 'a', createdDay: 1, status: 'open' }),
    make({ id: 'b', createdDay: 3, status: 'open' }),
    make({ id: 'c', createdDay: 5, status: 'open' }), // future, not yet due
    make({ id: 'd', createdDay: 2, status: 'kept', resolvedDay: 4 }),
    make({ id: 'e', createdDay: 2, status: 'broken', resolvedDay: 4 }),
  ];

  it('openCommitments returns only open', () => {
    expect(openCommitments(list).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('dueCommitments returns open promises on or before the day', () => {
    expect(dueCommitments(list, 4).map((c) => c.id)).toEqual(['a', 'b']);
    expect(dueCommitments(list, 5).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('commitmentsCreatedOn / commitmentsResolvedOn scope by day', () => {
    expect(commitmentsCreatedOn(list, 2).map((c) => c.id)).toEqual(['d', 'e']);
    expect(commitmentsResolvedOn(list, 4).map((c) => c.id)).toEqual(['d', 'e']);
  });
});

describe('ledgerStats', () => {
  it('tallies and computes keptRate over reckoned promises only', () => {
    const list = [
      make({ id: 'a', status: 'kept' }),
      make({ id: 'b', status: 'kept' }),
      make({ id: 'c', status: 'broken' }),
      make({ id: 'd', status: 'open' }),
    ];
    expect(ledgerStats(list)).toEqual({ total: 4, kept: 2, broken: 1, open: 1, keptRate: 67 });
  });

  it('keptRate is 0 when nothing is reckoned yet', () => {
    expect(ledgerStats([make({ status: 'open' })]).keptRate).toBe(0);
  });

  it('honours a scoping predicate', () => {
    const list = [
      make({ id: 'a', status: 'kept', createdDay: 1 }),
      make({ id: 'b', status: 'broken', createdDay: 30 }),
    ];
    const stats = ledgerStats(list, (c) => c.createdDay <= 28);
    expect(stats).toMatchObject({ total: 1, kept: 1, broken: 0 });
  });
});

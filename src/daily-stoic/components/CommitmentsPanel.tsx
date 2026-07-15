import { useState } from 'react';
import { Handshake, Check, X, RotateCcw, Clock } from 'lucide-react';
import { Button } from '../../ds';
import { useCommitments } from '../lib/useCommitments';
import {
  Commitment,
  commitmentsCreatedOn,
  commitmentsResolvedOn,
  dueCommitments,
} from '../lib/commitments';
import { triggerHaptic } from '../../shared/haptics';
import { cn } from '../lib/cn';

interface CommitmentsPanelProps {
  today: number;
  mode: 'prepare' | 'reckon';
}

function ageLabel(created: number, today: number): string {
  const age = today - created;
  if (age <= 0) return 'today';
  return `${age} day${age === 1 ? '' : 's'} owed`;
}

/** The Commitments ledger UI — the accountability spine, usable with no AI key.
 *  In "prepare" it takes the morning's promise and surfaces unpaid debts; in
 *  "reckon" it collects on every promise now due, kept or broken. */
export default function CommitmentsPanel({ today, mode }: CommitmentsPanelProps) {
  const { commitments, add, resolve, reopen, remove } = useCommitments();
  const [draft, setDraft] = useState('');

  const madeToday = commitmentsCreatedOn(commitments, today).filter((c) => c.status === 'open');
  const carriedDebts = dueCommitments(commitments, today).filter((c) => c.createdDay < today);
  const due = dueCommitments(commitments, today); // open, createdDay <= today
  const reckonedToday = commitmentsResolvedOn(commitments, today);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    add({ text, createdDay: today, source: 'self' });
    setDraft('');
    triggerHaptic('light');
  };

  const handleReckon = (id: string, status: 'kept' | 'broken') => {
    resolve(id, status, today);
    triggerHaptic(status === 'kept' ? 'success' : 'light');
  };

  const renderReckonRow = (c: Commitment) => (
    <li
      key={c.id}
      className="rounded-lg bg-background-tertiary border border-tertiary p-3 flex flex-col sm:flex-row sm:items-center gap-3"
    >
      <div className="flex-1 min-w-0">
        <span className="text-sm text-text-primary">{c.text}</span>
        {c.createdDay < today && (
          <span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider text-caution/90">
            <Clock size={11} /> {ageLabel(c.createdDay, today)}
          </span>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={() => handleReckon(c.id, 'kept')}
          className="flex items-center gap-1 rounded border border-tertiary bg-background-secondary px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-success hover:border-success hover:bg-success/5 transition-colors"
        >
          <Check size={13} /> Kept
        </button>
        <button
          type="button"
          onClick={() => handleReckon(c.id, 'broken')}
          className="flex items-center gap-1 rounded border border-tertiary bg-background-secondary px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-energy hover:border-energy hover:bg-energy/5 transition-colors"
        >
          <X size={13} /> Broke it
        </button>
      </div>
    </li>
  );

  return (
    <section className="rounded-xl border border-secondary bg-background-secondary p-4 sm:p-6 shadow-md hover:shadow-lg transition-all duration-300">
      <h3 className="font-display text-xl text-text-primary mb-3 border-b border-tertiary pb-3 flex items-center gap-2">
        <Handshake size={20} className="text-text-secondary" />
        {mode === 'prepare' ? 'The Day’s Commitment' : 'Reckoning'}
      </h3>

      {mode === 'prepare' ? (
        <>
          <p className="text-sm text-text-secondary mb-4 leading-relaxed">
            A promise is only Stoic if it is provable. Name one thing you <em>will</em> do today —
            small enough to be certain, real enough to cost something. Tonight you will reckon it.
          </p>

          <form onSubmit={handleAdd} className="flex gap-2 mb-4 min-w-0">
            <span className="hidden sm:flex items-center pl-1 pr-0.5 text-sm text-text-secondary font-medium shrink-0">
              I will
            </span>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="…answer the hard email before noon, without complaint."
              className="min-w-0 flex-1 rounded-md border border-secondary bg-background-tertiary px-3 py-2 text-sm text-text-primary outline-none focus-visible:border-accent"
            />
            <Button type="submit" size="sm" disabled={!draft.trim()} className="shrink-0">
              Commit
            </Button>
          </form>

          {madeToday.length > 0 && (
            <ul className="space-y-2 mb-4">
              {madeToday.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg bg-background-tertiary border border-tertiary p-3 flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-text-primary flex items-start gap-2">
                    <Handshake size={14} className="text-accent mt-0.5 shrink-0" />
                    {c.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      remove(c.id);
                      triggerHaptic('light');
                    }}
                    className="text-text-secondary hover:text-caution px-1 transition-colors text-xs shrink-0"
                    title="Withdraw this commitment"
                    aria-label="Withdraw this commitment"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {carriedDebts.length > 0 && (
            <div className="rounded-lg border border-caution/30 bg-caution/5 p-4">
              <h4 className="text-xs font-semibold text-caution tracking-wider uppercase mb-2 flex items-center gap-1.5">
                <Clock size={13} /> Unreckoned promises
              </h4>
              <p className="text-xs text-text-secondary mb-3">
                You made these earlier and never closed the books. Settle them.
              </p>
              <ul className="space-y-2">{carriedDebts.map(renderReckonRow)}</ul>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-text-secondary mb-4 leading-relaxed">
            Balance the books. For each promise you made, tell the truth: kept, or broken.
          </p>

          {due.length === 0 && reckonedToday.length === 0 && (
            <div className="rounded-lg border border-tertiary border-dashed p-6 text-center bg-background-primary/30">
              <p className="text-sm text-text-secondary">
                No promise to reckon. Make one in the morning’s <strong>Prepare</strong> step and it
                will be waiting here tonight.
              </p>
            </div>
          )}

          {due.length > 0 && <ul className="space-y-2 mb-4">{due.map(renderReckonRow)}</ul>}

          {reckonedToday.length > 0 && (
            <div className="mt-2">
              <h4 className="text-xs font-semibold text-text-secondary tracking-wider uppercase mb-2">
                Reckoned tonight
              </h4>
              <ul className="space-y-2">
                {reckonedToday.map((c) => (
                  <li
                    key={c.id}
                    className={cn(
                      'rounded-lg border p-3 flex items-center justify-between gap-3 text-sm',
                      c.status === 'kept'
                        ? 'border-success/40 bg-success/5'
                        : 'border-energy/40 bg-energy/5',
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {c.status === 'kept' ? (
                        <Check size={14} className="text-success shrink-0" />
                      ) : (
                        <X size={14} className="text-energy shrink-0" />
                      )}
                      <span
                        className={cn(
                          'truncate',
                          c.status === 'kept' ? 'text-text-primary' : 'text-text-secondary line-through decoration-tertiary',
                        )}
                      >
                        {c.text}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        reopen(c.id);
                        triggerHaptic('light');
                      }}
                      className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors shrink-0"
                      title="Undo this reckoning"
                    >
                      <RotateCcw size={12} /> Undo
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

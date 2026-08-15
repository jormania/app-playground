import React from 'react';

/**
 * What just landed in the ledger, said out loud.
 *
 * Every route into the ledger goes through here — the text box, dictation, and
 * the + Add form — because every one of them makes decisions you can't see
 * from the row alone: which category, which account, which trip, and what a
 * foreign amount converted to. Restricting this to trip-linked saves meant the
 * one time the app told you what it had decided was the one time you were
 * abroad; the rest of the year it filed silently.
 *
 * Transient by design. It states the outcome and gets out of the way after
 * `SAVE_NOTICE_MS` — a confirmation you have to dismiss is a chore attached to
 * every single save. The only control is **Change**, for when the figure or
 * the filing is wrong: dismissal isn't a decision worth a button when waiting
 * four seconds does the same thing.
 */
export const SAVE_NOTICE_MS = 4000;

/**
 * The figure as it was actually spent, with the stored one alongside when they
 * differ. Printing `${tx.amount} ${tx.originalCurrency}` pairs the *RON* number
 * with the *foreign* code — a 67 PLN shop that converts to 82 RON announced as
 * "82 PLN" — and both numbers being real is what makes that read as the app
 * disagreeing with itself.
 */
export function formatSavedAmount(tx) {
  const base = Number.isFinite(Number(tx.amount)) ? `${tx.amount} L` : null;
  if (tx.originalCurrency && tx.originalAmount != null) {
    return base ? `${tx.originalAmount} ${tx.originalCurrency} (${base})` : `${tx.originalAmount} ${tx.originalCurrency}`;
  }
  return base || 'no amount';
}

/** The sentence under the description — what was decided, in reading order. */
export function describeSave(tx, { categories = [], accounts = [], trips = [] } = {}) {
  const category = categories.find(c => c.id === tx.categoryId);
  const account = accounts.find(a => a.id === tx.accountId);
  const trip = trips.find(t => t.id === tx.tripId);

  const parts = [];
  if (category) parts.push(`filed under ${category.name}`);
  // The trip link is the one decision invisible everywhere else on the row, and
  // naming the trip isn't the same as saying one was attached — hence the word.
  if (tx.tripId) parts.push(`on your ✈️ ${trip ? trip.name : 'ongoing'} trip`);
  if (account) parts.push(`from ${account.name}`);
  return parts;
}

export default function SaveNotice({ notice, categories = [], accounts = [], trips = [], onChange }) {
  if (!notice || !notice.tx) return null;

  const { tx, id, others = 0, action } = notice;
  const verb = action === 'update' ? 'Updated' : 'Saved';
  const parts = describeSave(tx, { categories, accounts, trips });
  const sentence = parts.length > 0
    ? `${verb} ${formatSavedAmount(tx)} — ${parts.join(', ')}.`
    : `${verb} ${formatSavedAmount(tx)}.`;

  return (
    <>
      {/* Outside the live region below: anything inside it gets read out, and
          a screen reader announcing a keyframes block is not a confirmation. */}
      <style>{`
        @keyframes saveNoticeIn {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
      <div
        // Announced rather than only shown: it leaves on its own, so anyone not
        // watching this corner of the screen would otherwise never get it.
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 'calc(var(--space-md) + env(safe-area-inset-bottom, 0px))',
          width: 'calc(100% - 2 * var(--space-md))',
          maxWidth: '800px',
          padding: '12px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-accent)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          // Above the ledger, deliberately below the modal layer (z-index 50)
          // so opening Change covers it rather than fighting it.
          zIndex: 40,
          animation: 'saveNoticeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tx.description || 'Transaction'}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
            {sentence}
            {others > 0 ? ` Same for ${others} more.` : ''}
          </div>
        </div>
        {id && onChange && (
          <button
            type="button"
            onClick={() => onChange(id)}
            style={{ flexShrink: 0, padding: '6px 12px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-ink)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}
          >
            Change
          </button>
        )}
      </div>
    </>
  );
}

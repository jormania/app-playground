import { useMemo, useState } from 'react';
import { Button } from '../../ds/components/Button';
import { ConfirmModal, AlertModal } from '../../ds';
import { formatCurrency } from '../lib/currency';
import { readJson, writeJson } from '../lib/storage';
import { findDuplicateGroups, withoutDismissed, groupKey, mergeFields } from '../lib/duplicates';

const DISMISS_KEY = 'whereItWent_dupe_dismissed';

/**
 * A review card at the top of the ledger, not a nav destination.
 *
 * Merging archives a real transaction, so nothing here happens in one click:
 * you pick which row survives, then confirm. "Not duplicates" is remembered
 * device-locally rather than in Notion — a Tags-based flag would need the
 * option registered in the multi-select vocabulary first, and an unregistered
 * option 400s the *entire* atomic patch, taking unrelated fields down with it.
 * Re-dismissing once per device is the cheaper trade.
 */
export default function DuplicateReview({ transactions, categoriesById, accountsById, client, onDataChange, onInspect }) {
  const [dismissed, setDismissed] = useState(() => readJson(DISMISS_KEY, []));
  const [expanded, setExpanded] = useState(false);
  const [pendingMerge, setPendingMerge] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const groups = useMemo(
    () => withoutDismissed(findDuplicateGroups(transactions), dismissed),
    [transactions, dismissed],
  );

  if (groups.length === 0) return null;

  const dismissGroup = (group) => {
    const next = [...dismissed, groupKey(group)];
    writeJson(DISMISS_KEY, next);
    setDismissed(next);
  };

  const runMerge = async () => {
    const { group, survivor } = pendingMerge;
    setPendingMerge(null);
    setBusy(true);
    try {
      const losers = group.txs.filter(t => t.id !== survivor.id);
      // Rescue anything the survivor is missing before the other rows go.
      for (const loser of losers) {
        const updates = mergeFields(survivor, loser);
        if (Object.keys(updates).length > 0) {
          await client.updateTransaction(survivor.id, updates);
        }
      }
      for (const loser of losers) {
        await client.deleteTransaction(loser.id);
      }
      if (onDataChange) await onDataChange();
    } catch (e) {
      console.error('Failed to merge duplicates:', e);
      setError(e.message || 'Could not merge these transactions.');
    } finally {
      setBusy(false);
    }
  };

  const tone = 'var(--color-warning)';

  return (
    <div style={{
      marginBottom: 'var(--space-md)',
      padding: 'var(--space-md)',
      backgroundColor: `color-mix(in srgb, ${tone} 10%, var(--color-surface))`,
      border: `1px solid color-mix(in srgb, ${tone} 35%, transparent)`,
      borderRadius: 'var(--radius-lg)',
      minWidth: 0, boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <span aria-hidden style={{ fontSize: '18px' }}>🔍</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', color: 'var(--color-ink)' }}>
          {groups.length} possible duplicate{groups.length === 1 ? '' : 's'} found
        </span>
        <Button size="sm" variant="secondary" onClick={() => setExpanded(v => !v)}>
          {expanded ? 'Hide' : 'Review'}
        </Button>
      </div>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
          {groups.map(group => (
            <div key={group.id} style={{
              padding: 'var(--space-sm)', backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', minWidth: 0
            }}>
              <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center', marginBottom: 'var(--space-sm)', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 'var(--weight-bold)', padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)', textTransform: 'uppercase', letterSpacing: '0.5px',
                  backgroundColor: group.confidence === 'high'
                    ? `color-mix(in srgb, ${tone} 20%, transparent)`
                    : 'color-mix(in srgb, var(--color-muted) 18%, transparent)',
                  color: group.confidence === 'high' ? tone : 'var(--color-muted)'
                }}>
                  {group.confidence}
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                  {formatCurrency(group.amount)} · {group.reason}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {group.txs.map(t => {
                  const cat = categoriesById?.get(t.categoryId);
                  const acc = accountsById?.get(t.accountId);
                  return (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                      padding: '6px 8px', backgroundColor: 'var(--color-surface-2)',
                      borderRadius: 'var(--radius-sm)', minWidth: 0, flexWrap: 'wrap'
                    }}>
                      {/* Deciding which copy to keep means seeing what each one
                          actually is. Opening the full editor beats guessing
                          from a truncated description. */}
                      <button
                        type="button"
                        onClick={() => onInspect && onInspect(t)}
                        title="Open this transaction"
                        style={{
                          flex: 1, minWidth: '120px', textAlign: 'left', background: 'none',
                          border: 'none', padding: 0, font: 'inherit', cursor: onInspect ? 'pointer' : 'default'
                        }}
                      >
                        <div style={{
                          fontSize: 'var(--text-sm)', color: 'var(--color-ink)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          textDecoration: onInspect ? 'underline dotted' : 'none',
                          textUnderlineOffset: '3px'
                        }}>
                          {cat?.icon ? `${cat.icon} ` : ''}{t.description}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.date} · {cat?.name || 'Uncategorized'}
                          {acc?.name ? ` · ${acc.name}` : ''}
                          {t.notes ? ` · ${t.notes}` : ''}
                        </div>
                      </button>
                      <Button
                        size="sm" variant="secondary" disabled={busy}
                        onClick={() => setPendingMerge({ group, survivor: t })}
                      >
                        Keep this
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 'var(--space-sm)', display: 'flex', justifyContent: 'flex-end' }}>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => dismissGroup(group)}>
                  Not duplicates
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!pendingMerge}
        title="Merge duplicates?"
        message={pendingMerge
          ? `Keep "${pendingMerge.survivor.description}" (${pendingMerge.survivor.date}) and archive the other ${pendingMerge.group.txs.length - 1} row${pendingMerge.group.txs.length - 1 === 1 ? '' : 's'}. Any notes, trip or tags they carry that this one lacks will be copied over first. Archived pages stay recoverable from Notion's trash.`
          : ''}
        confirmText="Merge"
        variant="danger"
        onConfirm={runMerge}
        onCancel={() => setPendingMerge(null)}
      />

      <AlertModal
        isOpen={!!error}
        title="Could not merge"
        message={error || ''}
        onClose={() => setError(null)}
      />
    </div>
  );
}

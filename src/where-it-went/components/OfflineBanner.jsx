import { Button } from '../../ds/components/Button';

/**
 * Says out loud when the ledger on screen isn't live.
 *
 * The app used to show an error card offline, which implied the data was gone
 * — it wasn't, it just couldn't be refreshed. Showing the cached copy is the
 * right call, but only if it never pretends to be current.
 *
 * Shares the banner slot with UpcomingBanner rather than stacking beneath it.
 */
export default function OfflineBanner({ staleAt, pendingCount = 0, failedCount = 0, onOpenSettings }) {
  if (staleAt === null && pendingCount === 0 && failedCount === 0) return null;

  // A rejected write is a problem the user has to resolve; everything else is
  // just "we'll catch up".
  const tone = failedCount > 0 ? 'var(--color-danger)' : 'var(--color-warning)';

  const parts = [];
  if (staleAt) {
    const when = new Date(staleAt);
    const time = Number.isNaN(when.getTime())
      ? 'earlier'
      : when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    parts.push(`Showing data from ${time} — offline`);
  }
  if (pendingCount > 0) {
    parts.push(`${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync`);
  }
  if (failedCount > 0) {
    parts.push(`${failedCount} change${failedCount === 1 ? '' : 's'} Notion rejected`);
  }
  const message = parts.join(' · ');

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        padding: 'var(--space-sm) var(--space-md)',
        marginBottom: 'var(--space-md)',
        backgroundColor: `color-mix(in srgb, ${tone} 12%, var(--color-surface))`,
        border: `1px solid color-mix(in srgb, ${tone} 40%, transparent)`,
        borderRadius: 'var(--radius-lg)',
        minWidth: 0
      }}
    >
      <span aria-hidden style={{ fontSize: '16px', flex: 'none' }}>
        {failedCount > 0 ? '⚠️' : staleAt ? '☁️' : '⏳'}
      </span>
      <span
        title={message}
        style={{
          flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', color: 'var(--color-ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        }}
      >
        {message}
      </span>
      {failedCount > 0 && onOpenSettings && (
        <Button size="sm" variant="secondary" onClick={onOpenSettings} style={{ flex: 'none' }}>
          Fix
        </Button>
      )}
    </div>
  );
}

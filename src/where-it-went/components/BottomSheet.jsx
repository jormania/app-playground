import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function BottomSheet({ isOpen, onClose, title, children }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  // Focus trap, focus restore and body-scroll lock — mirrors ds/Modal. The sheet
  // previously had neither: Tab walked into the page behind it, closing didn't
  // return focus to whatever opened it, and the page scrolled behind the sheet
  // on iOS.
  useEffect(() => {
    if (!isOpen) return undefined;

    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement;
    const focusables = () => Array.from(dialog?.querySelectorAll(FOCUSABLE) ?? []);
    (focusables()[0] ?? dialog)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        dialog?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
      <div
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          position: 'relative',
          backgroundColor: 'var(--color-bg)',
          width: '100%',
          maxWidth: '500px',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          padding: 'var(--space-md) var(--space-lg) var(--space-xl)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border)',
          borderBottom: 'none',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-sm)' }}>
          <div style={{ width: '40px', height: '4px', backgroundColor: 'var(--color-border)', borderRadius: '2px' }} />
        </div>
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
            <h2 id={titleId} style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-medium)' }}>{title}</h2>
          </div>
        )}
        <div>{children}</div>
      </div>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes slideUp { from { transform: none; } to { transform: none; } }
        }
      `}</style>
    </div>,
    document.body
  );
}

import { useState, useEffect, useId, useRef } from 'react';
import { Field } from '../../ds/components/Field';
import { Button } from '../../ds/components/Button';
import { ConfirmModal } from '../../ds';
import { SegmentedControl } from '../../ds/components/SegmentedControl';
import { sortTrips } from '../services/trips';
import { toDateString } from '../lib/period';

const selectStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-ink)',
  fontSize: 'var(--text-base)',
  fontFamily: 'inherit'
};

const BASE_CURRENCY = 'RON';

export default function TransactionForm({ categories, accounts, trips = [], onSave, onCancel, initialTx, onDelete, allowTransfer = false }) {
  const [type, setType] = useState(initialTx?.type || 'Expense');
  const [description, setDescription] = useState(initialTx?.description || '');
  const [amount, setAmount] = useState(initialTx?.amount ?? '');
  const [date, setDate] = useState(initialTx?.date ? String(initialTx.date).slice(0, 10) : toDateString(new Date()));
  const [categoryId, setCategoryId] = useState(initialTx?.categoryId || '');
  const [accountId, setAccountId] = useState(initialTx?.accountId || accounts[0]?.id || '');
  const [tripId, setTripId] = useState(initialTx?.tripId || '');
  const [notes, setNotes] = useState(initialTx?.notes || '');
  const [originalAmount, setOriginalAmount] = useState(initialTx?.originalAmount ?? '');
  const [originalCurrency, setOriginalCurrency] = useState(initialTx?.originalCurrency || '');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const categorySelectId = useId();
  const accountSelectId = useId();
  const tripSelectId = useId();
  const originalAmountId = useId();
  const originalCurrencyId = useId();

  // The account auto-picker must never fire for a transaction that already has one:
  // opening an existing row and saving it used to silently rewrite its Account to
  // whatever the keyword heuristic preferred.
  const skipAutoAccount = useRef(!!initialTx);

  const sortedAccounts = [...accounts].sort((a, b) => a.name.localeCompare(b.name));
  const isTransfer = type === 'Transfer';
  // Offer the Transfer option when the feature is on, or when we're editing a
  // transaction that's already a Transfer — toggling the feature off later must
  // not force an existing transfer's type to silently change out from under it.
  const canUseTransferType = allowTransfer || initialTx?.type === 'Transfer';
  // A Transfer moves money between the user's own accounts/pockets rather than
  // being earned or spent, so it has no natural Income/Expense category — the
  // Notion schema doesn't type any category "Transfer".
  const availableCategories = categories
    .filter(c => c.type === type)
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectedCat = categories.find(c => c.id === categoryId);
  const isTravelCategory = !!selectedCat && (selectedCat.name || '').toLowerCase().includes('travel');
  const selectedAccount = accounts.find(a => a.id === accountId);
  const accountCurrency = selectedAccount?.currency || BASE_CURRENCY;
  // Only worth asking about a foreign amount when the account itself isn't RON —
  // otherwise this section would clutter the form for the common case.
  const showForeignCurrency = accountCurrency !== BASE_CURRENCY;
  const today = toDateString(new Date());

  useEffect(() => {
    if (skipAutoAccount.current) {
      // Consume the skip once, so a *deliberate* category change still helps.
      skipAutoAccount.current = false;
      return;
    }
    if (isTransfer) return; // no category-based signal to auto-pick an account from
    if (!selectedCat || !accounts || accounts.length === 0) return;

    let keywords = [];
    if (selectedCat.type === 'Expense') {
      keywords = ['revolut', 'card', 'checking', 'bank', 'cash'];
    } else if (selectedCat.type === 'Income') {
      const catName = selectedCat.name.toLowerCase();
      if (catName.includes('salary')) keywords = ['checking', 'bank', 'revolut', 'main'];
      else if (catName.includes('rent') || catName.includes('gift')) keywords = ['cash', 'revolut', 'checking'];
      else if (catName.includes('freelance') || catName.includes('loan')) keywords = ['revolut', 'checking', 'bank'];
      else keywords = ['checking', 'revolut', 'cash'];
    }

    let targetAcc = null;
    for (const kw of keywords) {
      targetAcc = accounts.find(a => a.name.toLowerCase().includes(kw));
      if (targetAcc) break;
    }
    if (!targetAcc) targetAcc = accounts[0];
    if (targetAcc) setAccountId(targetAcc.id);
  }, [categoryId, selectedCat, accounts, isTransfer]);

  // Default the foreign-currency field to the account's own currency the moment
  // it becomes relevant, but only while the user hasn't typed one in already —
  // never clobber a value they set (e.g. paying a EUR account in USD abroad).
  useEffect(() => {
    if (showForeignCurrency && !originalCurrency) setOriginalCurrency(accountCurrency);
  }, [showForeignCurrency, accountCurrency, originalCurrency]);

  const parsedAmount = parseFloat(amount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const parsedOriginalAmount = originalAmount === '' ? null : parseFloat(originalAmount);
  const originalAmountValid = parsedOriginalAmount === null || (Number.isFinite(parsedOriginalAmount) && parsedOriginalAmount > 0);
  const canSubmit = !!description.trim() && amountValid && (isTransfer || !!categoryId) && !!accountId && !!date && originalAmountValid;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!canSubmit) {
      if (!amountValid) setFormError('Enter an amount greater than zero.');
      else if (!originalAmountValid) setFormError('Enter a foreign-currency amount greater than zero, or leave it blank.');
      else setFormError('Fill in every required field.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(initialTx ? initialTx.id : null, {
        description: description.trim(),
        amount: parsedAmount,
        date,
        type,
        categoryId: isTransfer ? '' : categoryId,
        accountId,
        tripId: isTravelCategory && tripId ? tripId : '',
        notes: notes.trim(),
        originalAmount: showForeignCurrency ? parsedOriginalAmount : null,
        originalCurrency: showForeignCurrency && parsedOriginalAmount !== null ? (originalCurrency || accountCurrency) : '',
        tags: initialTx?.tags || []
      });
    } catch (err) {
      // The parent shows its own dialog; keep the form open with the values intact.
      setFormError(err?.message || 'Could not save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', overflowX: 'hidden', boxSizing: 'border-box', minWidth: 0 }}>
      <SegmentedControl
        value={type}
        onChange={(val) => { setType(val); setCategoryId(''); }}
        options={[
          { value: 'Expense', label: 'Expense' },
          { value: 'Income', label: 'Income' },
          ...(canUseTransferType ? [{ value: 'Transfer', label: 'Transfer' }] : [])
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-sm)' }}>
        <Field label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required max={today} />
        <Field label="Amount" type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" />
      </div>

      <Field label="Description" type="text" value={description} onChange={e => setDescription(e.target.value)} required placeholder={isTransfer ? 'e.g. Revolut top-up' : 'e.g. Groceries'} />

      {/* Category — Transfers skip this: moving money between your own accounts
          isn't income or an expense, so there's nothing to categorize. */}
      {isTransfer ? (
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-muted)', fontStyle: 'italic' }}>
          Transfers aren't categorized or counted in your income/expense totals — they're just money moving between your own accounts.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label htmlFor={categorySelectId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>
            Category <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <select id={categorySelectId} value={categoryId} onChange={e => setCategoryId(e.target.value)} required style={selectStyle}>
            <option value="" disabled>Select category...</option>
            {availableCategories.map(c => (
              <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ${c.name}` : c.name}</option>
            ))}
          </select>
          {selectedCat?.description && (
            <details style={{ marginTop: '2px' }}>
              <summary style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', cursor: 'pointer', userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10px' }}>▶</span> Category description
              </summary>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '4px', fontStyle: 'italic', lineHeight: '1.4', paddingLeft: '14px' }}>
                {selectedCat.description}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Assign to Trip — only for Travel category */}
      {isTravelCategory && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)' }}>
          <label htmlFor={tripSelectId} style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span>✈️</span> Assign to Trip (Optional)
          </label>
          <select id={tripSelectId} value={tripId} onChange={e => setTripId(e.target.value)} style={{ ...selectStyle, padding: '8px 10px', fontSize: 'var(--text-sm)' }}>
            <option value="">No specific trip (unassigned)</option>
            {sortTrips(trips || []).map(t => (
              <option key={t.id} value={t.id}>{t.name}{t.destination ? ` (${t.destination})` : ''}</option>
            ))}
          </select>
        </div>
      )}

      {/* Account */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor={accountSelectId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>
          Account <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <select id={accountSelectId} value={accountId} onChange={e => setAccountId(e.target.value)} required style={selectStyle}>
          {sortedAccounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}{a.currency && a.currency !== BASE_CURRENCY ? ` (${a.currency})` : ''}</option>
          ))}
        </select>
      </div>

      {/* Foreign-currency amount — only offered when the chosen account isn't RON.
          The RON amount above stays the source of truth for every total; this is
          purely informational, "what did this actually cost in the card's own
          currency", since nothing here does live FX conversion. */}
      {showForeignCurrency && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--color-muted)' }}>
            Optional — what {selectedAccount.name} actually charged
          </div>
          {/* Same track sizing as the Date/Amount row above: a bare `2fr 1fr`
              can't shrink below the inputs' intrinsic ~180px min-content width,
              so both columns overflowed the modal and clipped the Currency
              field off the right edge on a phone. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
            <Field
              id={originalAmountId}
              label="Original amount"
              type="number" step="0.01" min="0"
              value={originalAmount}
              onChange={e => setOriginalAmount(e.target.value)}
              placeholder="0.00"
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor={originalCurrencyId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>Currency</label>
              <input
                id={originalCurrencyId}
                type="text"
                value={originalCurrency}
                onChange={e => setOriginalCurrency(e.target.value.toUpperCase().slice(0, 3))}
                placeholder={accountCurrency}
                maxLength={3}
                style={{ ...selectStyle, padding: '10px 12px', textTransform: 'uppercase' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Notes — read by the Travel / Property / Family classifiers */}
      <Field label="Notes (optional)" type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Context for later" />

      {formError && (
        <div role="alert" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)', backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)' }}>
          {formError}
        </div>
      )}

      {/* Wraps because Delete + Cancel + Save don't fit on one line at 375px —
          the Save button was being clipped off the right edge of the edit form
          (the add form has no Delete, which is why it looked fine there). */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
        {initialTx && onDelete && (
          <div style={{ marginRight: 'auto' }}>
            <Button type="button" variant="danger" disabled={isSaving} onClick={() => setShowConfirmDelete(true)}>Delete</Button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginLeft: (initialTx && onDelete) ? 0 : 'auto' }}>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={isSaving || !canSubmit}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirmDelete}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? It will be archived in Notion and can be restored from the trash there."
        confirmText="Delete"
        variant="danger"
        onConfirm={async () => {
          setShowConfirmDelete(false);
          setIsSaving(true);
          try {
            await onDelete(initialTx.id);
          } catch (err) {
            setFormError(err?.message || 'Could not delete this transaction.');
          } finally {
            setIsSaving(false);
          }
        }}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </form>
  );
}

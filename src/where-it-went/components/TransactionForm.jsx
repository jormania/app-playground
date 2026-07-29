import { useState, useEffect, useId, useRef } from 'react';
import { Field } from '../../ds/components/Field';
import { Button } from '../../ds/components/Button';
import { ConfirmModal } from '../../ds';
import { SegmentedControl } from '../../ds/components/SegmentedControl';
import { sortTrips } from '../services/trips';
import { toDateString } from '../lib/period';
import { BASE_CURRENCY, CURRENCIES, fetchRate, convert, impliedRate, formatRateNote, canConvert } from '../lib/fx';

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

export default function TransactionForm({ categories, accounts, trips = [], onSave, onCancel, initialTx, onDelete, allowTransfer = false }) {
  const [type, setType] = useState(initialTx?.type || 'Expense');
  const [description, setDescription] = useState(initialTx?.description || '');
  const [amount, setAmount] = useState(
    initialTx?.originalCurrency && initialTx?.originalAmount != null
      ? initialTx.originalAmount
      : (initialTx?.amount ?? ''),
  );
  const [date, setDate] = useState(initialTx?.date ? String(initialTx.date).slice(0, 10) : toDateString(new Date()));
  const [categoryId, setCategoryId] = useState(initialTx?.categoryId || '');
  const [accountId, setAccountId] = useState(initialTx?.accountId || accounts[0]?.id || '');
  const [tripId, setTripId] = useState(initialTx?.tripId || '');
  const [notes, setNotes] = useState(initialTx?.notes || '');
  // One amount field, whose currency is selectable. When it isn't RON the typed
  // figure is the *original* amount and the RON total is derived from it — which
  // is the way a foreign charge is actually experienced ("I paid 8.50 EUR"),
  // rather than asking for the converted figure you don't know yet.
  const [currency, setCurrency] = useState(initialTx?.originalCurrency || '');
  const [baseAmount, setBaseAmount] = useState(initialTx?.originalCurrency ? (initialTx?.amount ?? '') : '');
  const [rate, setRate] = useState(null);
  const [rateDate, setRateDate] = useState(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const categorySelectId = useId();
  const accountSelectId = useId();
  const tripSelectId = useId();
  const amountId = useId();
  const currencySelectId = useId();
  const baseAmountId = useId();

  // Once the RON total is edited by hand it must stop being overwritten by the
  // rate — a card's own fee is exactly the kind of thing worth recording.
  const baseTouched = useRef(false);
  // Reopening an existing foreign transaction must keep the RON figure that was
  // actually saved, rather than silently restating it at today's rate. But as
  // soon as the foreign amount is *changed*, the stored RON is stale and has to
  // follow — leaving it put implied a nonsense rate (20 EUR shown as 42 L).
  const initialAmount = useRef(
    initialTx?.originalCurrency && initialTx?.originalAmount != null
      ? String(initialTx.originalAmount)
      : String(initialTx?.amount ?? ''),
  );

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
  const selectedTrip = (trips || []).find(t => t.id === tripId);
  // Trip beats account: on a trip you spend the destination's money, whatever
  // card it settles against. Falling back to the account currency, then RON.
  const suggestedCurrency = selectedTrip?.currency || accountCurrency || BASE_CURRENCY;
  const activeCurrency = currency || suggestedCurrency;
  const isForeign = activeCurrency !== BASE_CURRENCY;
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

  // Look up the rate whenever the currency or the date changes. Failures are
  // silent by design: no rate simply means no suggested conversion, and must
  // never stand between the user and recording what they spent.
  useEffect(() => {
    let cancelled = false;
    if (!isForeign || !canConvert(activeCurrency)) {
      setRate(null);
      setRateDate(null);
      return undefined;
    }
    setRateLoading(true);
    fetchRate(activeCurrency, BASE_CURRENCY, date)
      .then(result => {
        if (cancelled) return;
        setRate(result?.rate ?? null);
        setRateDate(result?.date ?? null);
      })
      .finally(() => { if (!cancelled) setRateLoading(false); });
    return () => { cancelled = true; };
  }, [isForeign, activeCurrency, date]);

  // Keep the RON total in step with the typed amount — until it's edited by hand.
  useEffect(() => {
    if (!isForeign || baseTouched.current || rate == null) return;
    // Comparing against the amount the form opened with (rather than using a
    // "first run" flag) keeps this correct however the async rate lookup races
    // with typing.
    if (String(amount) === String(initialAmount.current)) return;
    const converted = convert(amount, rate);
    if (converted != null) setBaseAmount(String(converted));
  }, [amount, rate, isForeign]);

  const parsedAmount = parseFloat(amount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const parsedBase = parseFloat(baseAmount);
  const baseValid = Number.isFinite(parsedBase) && parsedBase > 0;
  // In RON the single amount is the total. In any other currency the RON figure
  // is what every total is built from, so it has to be present and positive.
  const canSubmit = !!description.trim() && amountValid && (!isForeign || baseValid)
    && (isTransfer || !!categoryId) && !!accountId && !!date;

  const effectiveRate = isForeign && amountValid && baseValid
    ? impliedRate(parsedBase, parsedAmount)
    : null;
  const rateNote = isForeign
    ? formatRateNote(activeCurrency, effectiveRate ?? rate, rateDate, { stale: effectiveRate != null && rate == null })
    : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!canSubmit) {
      if (!amountValid) setFormError('Enter an amount greater than zero.');
      else if (isForeign && !baseValid) setFormError(`Enter the ${BASE_CURRENCY} amount — no exchange rate was available to work it out automatically.`);
      else setFormError('Fill in every required field.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(initialTx ? initialTx.id : null, {
        description: description.trim(),
        // RON stays the source of truth for every total, whichever currency
        // was typed in.
        amount: isForeign ? parsedBase : parsedAmount,
        date,
        type,
        categoryId: isTransfer ? '' : categoryId,
        accountId,
        tripId: isTravelCategory && tripId ? tripId : '',
        notes: notes.trim(),
        originalAmount: isForeign ? parsedAmount : null,
        originalCurrency: isForeign ? activeCurrency : '',
        tags: initialTx?.tags || []
      });
    } catch (err) {
      // The parent shows its own dialog; keep the form open with the values intact.
      setFormError(err?.message || 'Could not save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Row gap is 8px rather than the usual --space-sm (12px): with the FX rate
  // line added, eight stacked rows need every spare pixel to fit a short
  // browser window without a scrollbar — the actual failure case, not just a
  // phone. Fields keep their own internal spacing; only the gap between rows
  // is tightened.
  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowX: 'hidden', boxSizing: 'border-box', minWidth: 0 }}>
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

        {/* Amount + currency share one control rather than sitting in separate
            rows. This replaced a dashed "original amount" box below Account, so
            the form is shorter with this feature than it was without it — the
            modal must never need a scrollbar just to reach Save. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          <label htmlFor={amountId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>
            Amount <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <div style={{
            display: 'flex', alignItems: 'stretch', minWidth: 0,
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg)', overflow: 'hidden'
          }}>
            <input
              id={amountId} type="number" inputMode="decimal" step="0.01" min="0" required placeholder="0.00"
              className="wiw-no-spinner"
              value={amount} onChange={e => setAmount(e.target.value)}
              style={{
                flex: 1, minWidth: 0, width: '100%', padding: '10px 0 10px 12px',
                border: 'none', outline: 'none', background: 'transparent',
                color: 'var(--color-ink)', fontSize: 'var(--text-base)', fontFamily: 'inherit'
              }}
            />
            <select
              id={currencySelectId}
              aria-label="Currency"
              value={activeCurrency}
              onChange={e => {
                setCurrency(e.target.value);
                // A new currency invalidates both the manual override and the
                // "unchanged since open" guard — the RON figure must re-derive.
                baseTouched.current = false;
                initialAmount.current = null;
              }}
              style={{
                flex: 'none', border: 'none', outline: 'none', background: 'transparent',
                color: 'var(--color-muted)', fontSize: 'var(--text-sm)', fontFamily: 'inherit',
                padding: '0 6px 0 2px', cursor: 'pointer'
              }}
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* The editable RON total (a card's own fee beats any published rate)
          and the rate that produced it, on their own line each — cramming
          both into one line was unreadable at the font size this has to fit
          at. Both still individually clamp to one line and ellipsise rather
          than wrap, so this never grows past two short lines. */}
      {isForeign && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
            <span style={{ flex: 'none' }}>≈</span>
            <input
              id={baseAmountId}
              aria-label={`Amount in ${BASE_CURRENCY}`}
              type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
              className="wiw-no-spinner"
              value={baseAmount}
              onChange={e => { baseTouched.current = true; setBaseAmount(e.target.value); }}
              style={{
                flex: 'none', width: '84px', padding: '3px 6px',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-bg)', color: 'var(--color-ink)',
                fontSize: 'var(--text-xs)', fontFamily: 'inherit'
              }}
            />
            <span style={{ flex: 'none' }}>L</span>
          </div>
          <div
            title={rateNote || undefined}
            style={{
              fontSize: '11px', color: 'var(--color-muted)', minWidth: 0,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }}
          >
            {rateLoading
              ? 'Fetching exchange rate…'
              : rateNote
                ? `Rate: ${rateNote}`
                : `No rate available for ${activeCurrency} — enter the ${BASE_CURRENCY} amount yourself`}
          </div>
        </div>
      )}

      <Field label="Description" type="text" value={description} onChange={e => setDescription(e.target.value)} required placeholder={isTransfer ? 'e.g. Revolut top-up' : 'e.g. Groceries'} />

      {/* Category and Account share a row: two dropdowns that classify the same
          transaction, and stacking them cost a whole row the modal couldn't
          spare. `auto-fit` with a minimum lets them drop to one column on a
          genuinely narrow screen rather than being crushed. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-sm)', alignItems: 'start' }}>
      {isTransfer ? (
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-muted)', fontStyle: 'italic' }}>
          Transfers aren't categorized or counted in your income/expense totals — they're just money moving between your own accounts.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
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

      {/* Account */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
        <label htmlFor={accountSelectId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>
          Account <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <select id={accountSelectId} value={accountId} onChange={e => setAccountId(e.target.value)} required style={selectStyle}>
          {sortedAccounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}{a.currency && a.currency !== BASE_CURRENCY ? ` (${a.currency})` : ''}</option>
          ))}
        </select>
      </div>
      </div>

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
      {/* No extra marginTop here — the form's own row gap already separates
          this from Notes above it, and the FX line above needed the room more
          than this did once it grew to two lines. */}
      <div className="tx-form-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
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

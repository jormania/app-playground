import React, { useState, useRef, useEffect } from 'react';
import { Wand2, Loader2, Mic, MicOff } from 'lucide-react';
import { ConfirmModal } from '../../ds';
import { parseSmartText } from '../lib/smartParser';
import { parseTextWithAI, hardenTransactions } from '../lib/aiParser';
import { parseNoraSplitGroup, stripNoraGroup } from '../lib/noraSplit';

export default function SmartTextEntry({ onAdd, onUpdate, onDelete, onAddSubscription, onSuccess, onEditTransaction, accounts, categories, trips, config, recentTransactions, transactions = [] }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [detectedSubscription, setDetectedSubscription] = useState(null);
  // Holds a whole parsed batch when it contains a delete action, so it can be
  // reviewed before anything runs. Creates/updates alone still execute
  // instantly — deleting is the one action here with no undo, so it's the one
  // that gets a checkpoint, matching how the rest of the app treats delete
  // (single and bulk delete both confirm; adding never has).
  const [pendingDeleteBatch, setPendingDeleteBatch] = useState(null);
  // What the parser decided for you rather than read off your words — the
  // trip, the currency, the category. Shown because three silent corrections
  // at once is the kind of help that becomes mistrust the first time it's
  // wrong; the card carries a one-tap way to fix it.
  const [inferenceNotice, setInferenceNotice] = useState(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        // Explicit rather than left to the engine's own default, which some
        // browsers resolve from the OS locale and others from the page's own
        // <html lang>, inconsistently — the device's own language setting is
        // the one signal that's actually meaningful here.
        recognitionRef.current.lang = navigator.language || 'en-US';
        recognitionRef.current.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setText(prev => prev ? `${prev} ${transcript}` : transcript);
        };
        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
        recognitionRef.current.onerror = (event) => {
          setIsListening(false);
          // "no-speech" is just silence — not worth interrupting with an error.
          if (event.error === 'no-speech' || event.error === 'aborted') return;
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setError('Microphone access was denied. Enable it in your browser settings to dictate.');
          } else {
            setError('Dictation failed. Please try again or type instead.');
          }
        };
      }
    }
  }, []);

  const toggleListen = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 3500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  /**
   * Runs one already-parsed batch against Notion, sequentially so an error
   * midway leaves earlier items in place rather than reordering writes.
   *
   * Reports exactly how far it got. The previous version wrapped the whole
   * loop in one try/catch: a failure on item 2 of 3 reported a flat "Failed
   * to save changes" with no sign the first item had already landed, no
   * ledger refresh to show it, and an open invitation to resubmit the same
   * text and duplicate it.
   */
  const executeBatch = async (txs, { withNora, withNoraCount }) => {
    const addedIds = [];
    const inferences = [];
    let subToPrompt = null;
    let added = 0, updated = 0, deleted = 0;
    let failure = null;

    for (const t of txs) {
      if (t.isSubscription) subToPrompt = t;

      // `_inferred` is annotation for the UI, not part of the record — it must
      // never reach a write (demo mode stores whatever it is handed verbatim).
      const { _inferred, ...tx } = t;

      // Stamp the group count so applyNoraSplit calculates the correct fraction.
      // withNoraCount=2 → 50/50, withNoraCount=3 → 1/3 Nora / 2/3 you, etc.
      const tWithFlag = withNora ? { ...tx, withNoraCount } : tx;

      try {
        if (tx.action === 'update' && tx.id) {
          await onUpdate(tx.id, tx);
          updated++;
        } else if (tx.action === 'delete' && tx.id) {
          if (onDelete) {
            await onDelete(tx.id);
            deleted++;
          }
        } else {
          const saved = await onAdd(tWithFlag);
          if (saved && saved.id) addedIds.push(saved.id);
          added++;
          if (_inferred && Object.keys(_inferred).length > 0) {
            inferences.push({ id: saved && saved.id ? saved.id : null, tx, inferred: _inferred });
          }
        }
      } catch (err) {
        failure = err;
        break;
      }
    }

    const settled = added + updated + deleted;

    if (failure) {
      const parts = [];
      if (added) parts.push(`${added} added`);
      if (updated) parts.push(`${updated} updated`);
      if (deleted) parts.push(`${deleted} deleted`);
      setError(settled > 0
        ? `${parts.join(', ')} before this failed: ${failure.message || 'could not save the rest.'}`
        : (failure.message || 'Failed to save changes.'));
    } else if (settled === 1) {
      if (updated) setSuccess('Updated transaction.');
      else if (deleted) setSuccess('Deleted transaction.');
      else setSuccess(`Added: ${txs[0].amount} ${txs[0].originalCurrency || 'RON'} for ${txs[0].description}`);
      setText('');
    } else {
      const parts = [];
      if (added) parts.push(`${added} added`);
      if (updated) parts.push(`${updated} updated`);
      if (deleted) parts.push(`${deleted} deleted`);
      setSuccess(parts.length > 0 ? `${parts.join(', ')}.` : `Processed ${txs.length} items.`);
      setText('');
    }

    if (inferences.length > 0) {
      setInferenceNotice({ ...inferences[0], others: inferences.length - 1 });
    }

    // Refresh on any partial progress too, not only a clean run — otherwise a
    // batch that half-succeeded before failing shows nothing for it until the
    // next unrelated reload.
    if (settled > 0 && onSuccess) onSuccess(addedIds);
    if (!failure && subToPrompt) setDetectedSubscription(subToPrompt);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || isParsing) return;
    setDetectedSubscription(null);
    setInferenceNotice(null);

    // Detect and strip the full "with Nora [and ...]" group BEFORE AI parsing.
    // If the AI sees names it maps them as categories, swallowing the split signal.
    const rawText = text.trim();
    const { found: withNora, totalPeople: withNoraCount } = parseNoraSplitGroup(rawText);
    const cleanedText = withNora ? stripNoraGroup(rawText) : rawText;

    const useAI = config?.features?.aiParser === true;
    let txs = [];

    try {
      if (useAI) {
        if (!config?.claudeApiKey) {
          setError("Claude API Key is missing. Please add it in Settings.");
          return;
        }
        setIsParsing(true);
        txs = await parseTextWithAI(cleanedText, accounts, categories, trips, config.claudeApiKey, recentTransactions, transactions);
      } else {
        const tx = parseSmartText(cleanedText, accounts, categories);
        // The keyword parser knows nothing about trips, vendor history or
        // exchange rates. Running its result through the same hardening the
        // AI path uses gives it all three, and keeps the two paths from
        // filing the same sentence differently.
        if (tx) txs = await hardenTransactions([tx], { categories, accounts, trips, transactions });
      }
    } catch (err) {
      setError(err.message || "Failed to parse text.");
      setIsParsing(false);
      return;
    } finally {
      setIsParsing(false);
    }

    if (!txs || txs.length === 0) {
      setError("Couldn't find an amount in that text.");
      return;
    }

    // A delete is the one action here with no undo — hold the whole batch for
    // an explicit confirmation rather than running it straight through the
    // way an add or an update does. Any accompanying creates/updates in the
    // same message wait too, so nothing in the batch runs out of order.
    if (txs.some(t => t.action === 'delete' && t.id)) {
      setPendingDeleteBatch({ txs, withNora, withNoraCount });
      return;
    }

    await executeBatch(txs, { withNora, withNoraCount });
  };

  const confirmPendingDelete = async () => {
    const batch = pendingDeleteBatch;
    setPendingDeleteBatch(null);
    if (batch) await executeBatch(batch.txs, { withNora: batch.withNora, withNoraCount: batch.withNoraCount });
  };

  return (
    <form 
      onSubmit={handleSubmit}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '99px',
        boxShadow: 'var(--shadow-sm)',
        padding: '8px 16px',
        marginBottom: 'var(--space-xl)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      className="smart-text-entry"
    >
      {isParsing ? (
        <Loader2 size={20} color="var(--color-accent)" style={{ marginRight: '12px', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
      ) : (
        <Wand2 size={20} color={config?.features?.aiParser ? "var(--color-accent)" : "var(--color-muted)"} style={{ marginRight: '12px', flexShrink: 0 }} />
      )}
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={isParsing}
        placeholder={config?.features?.aiParser ? "✨ Describe a transaction..." : "Describe a transaction..."}
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          fontSize: 'var(--text-base)',
          color: 'var(--color-ink)',
          outline: 'none',
          fontFamily: 'inherit',
          minWidth: 0,
        }}
      />
      {success && (
        <div style={{
          position: 'absolute',
          right: '16px',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-success)',
          fontWeight: 'var(--weight-medium)',
          animation: 'fadeIn 0.3s'
        }}>
          {success}
        </div>
      )}
      {error && !success && (
        <div style={{
          position: 'absolute',
          right: '16px',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-danger)',
          fontWeight: 'var(--weight-medium)',
          animation: 'fadeIn 0.3s'
        }}>
          {error}
        </div>
      )}
      
      {!success && !error && recognitionRef.current && (
        <button
          type="button"
          onClick={toggleListen}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: isListening ? 'var(--color-danger)' : 'var(--color-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: isListening ? 'pulse 1.5s infinite' : 'none'
          }}
          title="Dictate expense"
        >
          {isListening ? <Mic size={20} /> : <MicOff size={20} />}
        </button>
      )}

      {detectedSubscription && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '8px',
          padding: '12px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-accent)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'fadeIn 0.3s',
          zIndex: 10
        }}>
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-accent)' }}>Recurring Bill Detected</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>Do you want to add "{detectedSubscription.description}" to your Subscriptions?</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setDetectedSubscription(null)}
              style={{ padding: '6px 12px', border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}
            >
              Skip
            </button>
            <button
              type="button"
              onClick={async () => {
                if (onAddSubscription) {
                  await onAddSubscription({
                    name: detectedSubscription.description,
                    amount: detectedSubscription.amount,
                    originalAmount: detectedSubscription.originalAmount,
                    originalCurrency: detectedSubscription.originalCurrency,
                    categoryId: detectedSubscription.categoryId,
                    accountId: detectedSubscription.accountId,
                    active: true,
                    type: detectedSubscription.type || 'Expense',
                    frequency: 'Monthly',
                    dayOfMonth: new Date().getDate(),
                  });
                  setSuccess("Added to Subscriptions!");
                }
                setDetectedSubscription(null);
              }}
              style={{ padding: '6px 12px', border: 'none', background: 'var(--color-accent)', color: 'var(--color-on-accent)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {inferenceNotice && !detectedSubscription && (() => {
        const { tx, inferred, id, others } = inferenceNotice;
        const parts = [];
        if (inferred.trip) parts.push(`linked it to ✈️ ${inferred.trip.name}`);
        if (inferred.currency) parts.push(`read the amount as ${inferred.currency}`);
        if (inferred.category) parts.push(`filed it under ${inferred.category.name}`);
        // "and" before the last clause — three comma-separated fragments read
        // as a list of fields rather than a sentence about one transaction.
        const sentence = parts.length > 1
          ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
          : parts[0];

        return (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '8px',
            padding: '12px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-accent)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            animation: 'fadeIn 0.3s',
            zIndex: 10
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-accent)' }}>
                {tx.description || 'Transaction added'}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                {`Because you're on a trip, I ${sentence}.`}
                {others > 0 ? ` Same for ${others} more.` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              {id && onEditTransaction && (
                <button
                  type="button"
                  onClick={() => {
                    setInferenceNotice(null);
                    onEditTransaction(id);
                  }}
                  style={{ padding: '6px 12px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-ink)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}
                >
                  Change
                </button>
              )}
              <button
                type="button"
                onClick={() => setInferenceNotice(null)}
                style={{ padding: '6px 12px', border: 'none', background: 'var(--color-accent)', color: 'var(--color-on-accent)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}
              >
                Got it
              </button>
            </div>
          </div>
        );
      })()}

      {pendingDeleteBatch && (() => {
        const deletes = pendingDeleteBatch.txs.filter(t => t.action === 'delete' && t.id);
        const others = pendingDeleteBatch.txs.length - deletes.length;
        const targets = deletes.map(t => {
          const match = recentTransactions.find(rt => rt.id === t.id);
          return match ? `"${match.description}" (${match.amount} L)` : 'a transaction';
        });
        return (
          <ConfirmModal
            isOpen={true}
            title={deletes.length === 1 ? 'Delete this transaction?' : `Delete ${deletes.length} transactions?`}
            message={`${targets.join(', ')} will be archived in Notion and can be restored from its trash there.`
              + (others > 0 ? ` The other ${others} change${others !== 1 ? 's' : ''} in this message will still be saved.` : '')}
            confirmText="Delete"
            variant="danger"
            onConfirm={confirmPendingDelete}
            onCancel={() => setPendingDeleteBatch(null)}
          />
        );
      })()}

      <style dangerouslySetInnerHTML={{ __html: `
        .smart-text-entry:focus-within {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px var(--color-accent);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}} />
    </form>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { Wand2, Loader2, Mic, MicOff, CheckCircle } from 'lucide-react';
import { parseSmartText } from '../lib/smartParser';
import { parseTextWithAI } from '../lib/aiParser';
import { parseNoraSplitGroup, stripNoraGroup } from '../lib/noraSplit';

export default function SmartTextEntry({ onAdd, onUpdate, onAddSubscription, onSuccess, accounts, categories, trips, config, recentTransactions }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [detectedSubscription, setDetectedSubscription] = useState(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setText(prev => prev ? `${prev} ${transcript}` : transcript);
        };
        recognitionRef.current.onend = () => {
          setIsListening(false);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || isParsing) return;
    setDetectedSubscription(null);

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
        txs = await parseTextWithAI(cleanedText, accounts, categories, trips, config.claudeApiKey, recentTransactions);
      } else {
        const tx = parseSmartText(cleanedText, accounts, categories);
        if (tx) txs = [tx];
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

    try {
      const addedIds = [];
      let subToPrompt = null;

      for (const t of txs) {
        if (t.isSubscription) {
          subToPrompt = t;
        }

        // Stamp the group count so applyNoraSplit calculates the correct fraction.
        // withNoraCount=2 → 50/50, withNoraCount=3 → 1/3 Nora / 2/3 you, etc.
        const tWithFlag = withNora ? { ...t, withNoraCount } : t;

        let saved;
        if (t.action === 'update' && t.id) {
          saved = await onUpdate(t.id, t);
        } else if (t.action === 'delete' && t.id) {
          // skip — delete not fully implemented
        } else {
          saved = await onAdd(tWithFlag);
        }
        
        if (saved && saved.id) addedIds.push(saved.id);
      }
      
      if (txs.length === 1 && txs[0].action === 'update') {
        setSuccess(`Updated transaction.`);
      } else if (txs.length === 1) {
        setSuccess(`Added: ${txs[0].amount} ${txs[0].originalCurrency || 'RON'} for ${txs[0].description}`);
      } else {
        setSuccess(`Processed ${txs.length} items.`);
      }
      
      setText('');
      if (onSuccess) onSuccess(addedIds);
      if (subToPrompt) setDetectedSubscription(subToPrompt);
      // Optional: keep focus if they want to add multiple in a row
      // inputRef.current?.focus();
    } catch (err) {
      setError("Failed to save changes.");
    }
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
        <Loader2 size={20} color="var(--color-primary)" style={{ marginRight: '12px', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
      ) : (
        <Wand2 size={20} color={config?.features?.aiParser ? "var(--color-primary)" : "var(--color-muted)"} style={{ marginRight: '12px', flexShrink: 0 }} />
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
          border: '1px solid var(--color-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'fadeIn 0.3s',
          zIndex: 10
        }}>
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-primary)' }}>Recurring Bill Detected</div>
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
              style={{ padding: '6px 12px', border: 'none', background: 'var(--color-primary)', color: 'var(--color-on-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}
            >
              Add
            </button>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{ __html: `
        .smart-text-entry:focus-within {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px var(--color-primary-muted);
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

import React, { useState, useRef, useEffect } from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { parseSmartText } from '../lib/smartParser';
import { parseTextWithAI } from '../lib/aiParser';
import { enqueue } from '../lib/outbox'; // Or we just take addTransaction as a prop

export default function SmartTextEntry({ onAdd, onSuccess, accounts, categories, trips, config }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 2500);
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

    const useAI = config?.features?.aiParser === true;
    let txs = [];

    try {
      if (useAI) {
        if (!config?.claudeApiKey) {
          setError("Claude API Key is missing. Please add it in Settings.");
          return;
        }
        setIsParsing(true);
        txs = await parseTextWithAI(text, accounts, categories, trips, config.claudeApiKey);
      } else {
        const tx = parseSmartText(text, accounts, categories);
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
      for (const t of txs) {
        const saved = await onAdd(t);
        if (saved && saved.id) addedIds.push(saved.id);
      }
      if (txs.length === 1) {
        setSuccess(`Added: ${txs[0].amount} ${txs[0].originalCurrency || 'RON'} for ${txs[0].description}`);
      } else {
        setSuccess(`Added ${txs.length} transactions.`);
      }
      setText('');
      if (onSuccess) onSuccess(addedIds);
      // Optional: keep focus if they want to add multiple in a row
      // inputRef.current?.focus();
    } catch (err) {
      setError("Failed to save transaction.");
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
        borderRadius: 'var(--radius-lg)',
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
        placeholder={config?.features?.aiParser ? "✨ AI: Describe an expense (e.g. '15 for lunch yesterday')" : "Type a quick expense (e.g. '15 for lunch yesterday')"}
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
      `}} />
    </form>
  );
}

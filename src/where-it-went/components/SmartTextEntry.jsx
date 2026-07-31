import React, { useState, useRef, useEffect } from 'react';
import { Wand2 } from 'lucide-react';
import { parseSmartText } from '../lib/smartParser';
import { enqueue } from '../lib/outbox'; // Or we just take addTransaction as a prop

export default function SmartTextEntry({ onAdd, accounts, categories }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
    if (!text.trim()) return;

    const tx = parseSmartText(text, accounts, categories);
    
    if (!tx) {
      setError("Couldn't find an amount in that text.");
      return;
    }

    try {
      await onAdd(tx);
      setSuccess(`Added: ${tx.amount} RON for ${tx.description}`);
      setText('');
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
      <Wand2 size={20} color="var(--color-primary)" style={{ marginRight: '12px', flexShrink: 0 }} />
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a quick expense (e.g. '15 for lunch yesterday')"
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
      `}} />
    </form>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, Mic, MicOff } from 'lucide-react';
import { askInsightsAI } from '../lib/aiParser';

export default function SmartInsightsChat({ transactions, categories, config }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [response, setResponse] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isListening, setIsListening] = useState(false);
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
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || isParsing) return;
    setResponse('');
    setError('');

    if (!config?.claudeApiKey) {
      setError("Claude API Key is missing. Please add it in Settings.");
      return;
    }

    setIsParsing(true);
    try {
      const answer = await askInsightsAI(text, transactions, categories, config.claudeApiKey);
      setResponse(answer);
      setText(''); // clear input on success
    } catch (err) {
      setError(err.message || "Failed to get an answer.");
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div style={{
      marginBottom: 'var(--space-lg)',
      animation: 'fadeIn 0.5s ease-out'
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-primary)',
          borderRadius: '99px',
          padding: '8px 16px',
          boxShadow: 'var(--shadow-md)',
          position: 'relative',
          transition: 'box-shadow 0.2s',
          ...(config?.features?.flairHover !== false ? {
            ':hover': { boxShadow: 'var(--shadow-lg)' }
          } : {})
        }}
      >
        {isParsing ? (
          <Loader2 size={20} color="var(--color-primary)" style={{ marginRight: '12px', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
        ) : (
          <Sparkles size={20} color="var(--color-primary)" style={{ marginRight: '12px', flexShrink: 0 }} />
        )}
        
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isParsing}
          placeholder="✨ Ask your data a question..."
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

        {error && !isParsing && (
          <div style={{
            position: 'absolute',
            right: '50px',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-danger)',
            fontWeight: 'var(--weight-medium)',
            animation: 'fadeIn 0.3s'
          }}>
            {error}
          </div>
        )}

        {recognitionRef.current && !isParsing && !error && (
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
            title="Dictate question"
          >
            {isListening ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
        )}
      </form>

      {response && (
        <div style={{
          marginTop: '12px',
          padding: '16px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          fontSize: 'var(--text-base)',
          color: 'var(--color-ink)',
          lineHeight: '1.5',
          animation: 'fadeIn 0.3s'
        }}>
          {/* Very basic markdown rendering for bold text **like this** */}
          <p style={{ margin: 0 }} dangerouslySetInnerHTML={{ 
            __html: response.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')
          }} />
        </div>
      )}
    </div>
  );
}

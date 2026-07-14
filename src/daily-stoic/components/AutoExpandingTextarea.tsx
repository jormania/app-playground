import React, { useRef, useEffect, useState } from 'react';
import { cn } from '../lib/cn';

interface AutoExpandingTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onValueChange: (val: string) => void;
  onCtrlEnter?: () => void;
}

export function AutoExpandingTextarea({
  value,
  onValueChange,
  onCtrlEnter,
  className,
  placeholder,
  disabled,
  ...props
}: AutoExpandingTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState<'typing' | 'saved' | 'idle'>('idle');

  // Adjust height to fit content
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  // Handle Ctrl/Cmd + Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (onCtrlEnter) {
        onCtrlEnter();
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onValueChange(e.target.value);
    setStatus('typing');
  };

  useEffect(() => {
    if (status !== 'typing') return;

    const timer = setTimeout(() => {
      setStatus('saved');
      const idleTimer = setTimeout(() => {
        setStatus('idle');
      }, 2000);
      return () => clearTimeout(idleTimer);
    }, 1000);

    return () => clearTimeout(timer);
  }, [value, status]);

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-full rounded-lg bg-background-tertiary border border-tertiary p-4 pb-8 text-text-primary placeholder:text-text-secondary/60 outline-none focus:border-accent transition-colors resize-none overflow-hidden min-h-[100px]",
          className
        )}
        {...props}
      />
      {status !== 'idle' && (
        <span 
          className={cn(
            "absolute bottom-2.5 right-3 text-[10px] select-none font-mono transition-opacity duration-300 pointer-events-none",
            status === 'typing' ? "text-text-secondary/40 opacity-100" : "text-success/70 opacity-100"
          )}
        >
          {status === 'typing' ? 'Saving draft...' : 'Draft saved on this device'}
        </span>
      )}
    </div>
  );
}

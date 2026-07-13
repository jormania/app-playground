import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';
import { cn } from '../lib/cn';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

// Global emitter function to trigger a toast from anywhere
export const showToast = (message: string, type: ToastType = 'info', duration = 4000) => {
  const event = new CustomEvent('stoic-toast', {
    detail: { message, type, duration }
  });
  window.dispatchEvent(event);
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type: ToastType; duration?: number }>;
      const { message, type, duration = 4000 } = customEvent.detail;
      const id = Date.now().toString() + Math.random().toString();
      
      setToasts((prev) => [...prev, { id, message, type, duration }]);

      setTimeout(() => {
        removeToast(id);
      }, duration);
    };

    window.addEventListener('stoic-toast', handleEvent);
    return () => window.removeEventListener('stoic-toast', handleEvent);
  }, [removeToast]);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none p-4">
      {toasts.map((toast) => {
        const Icon = toast.type === 'success' 
          ? CheckCircle2 
          : toast.type === 'error' 
          ? AlertCircle 
          : toast.type === 'warning' 
          ? AlertCircle 
          : Info;

        return (
          <div
            key={toast.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-4 shadow-lg pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-bottom-2",
              toast.type === 'success' && "bg-background-secondary border-success/30 text-text-primary",
              toast.type === 'error' && "bg-background-secondary border-energy/30 text-text-primary",
              toast.type === 'warning' && "bg-background-secondary border-caution/30 text-text-primary",
              toast.type === 'info' && "bg-background-secondary border-tertiary text-text-primary"
            )}
            role="alert"
          >
            <Icon 
              className={cn(
                "h-5 w-5 shrink-0 mt-0.5",
                toast.type === 'success' && "text-success",
                toast.type === 'error' && "text-energy",
                toast.type === 'warning' && "text-caution",
                toast.type === 'info' && "text-accent"
              )}
            />
            <div className="flex-1 text-sm leading-relaxed">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-text-secondary hover:text-text-primary p-0.5 rounded-full hover:bg-background-tertiary transition-colors shrink-0"
              aria-label="Close notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Button } from './Button';
import { cn } from '../lib/cn';
import { Scale, CheckCircle2, CloudFog, X } from 'lucide-react';
import { triggerHaptic } from '../../shared/haptics';

interface Worry {
  id: string;
  text: string;
  category: 'unassigned' | 'up-to-me' | 'not-up-to-me';
  isResolved?: boolean;
}

export function DichotomyOfControl() {
  const [worries, setWorries] = useState<Worry[]>(() => {
    const saved = localStorage.getItem('daily-stoic:dichotomy');
    return saved ? JSON.parse(saved) : [];
  });
  const [newWorry, setNewWorry] = useState('');
  const [dissolvingId, setDissolvingId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('daily-stoic:dichotomy', JSON.stringify(worries));
  }, [worries]);

  const handleAddWorry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorry.trim()) return;
    setWorries([{ id: Date.now().toString(), text: newWorry.trim(), category: 'unassigned' }, ...worries]);
    setNewWorry('');
    triggerHaptic('light');
  };

  const handleCategorize = (id: string, category: 'up-to-me' | 'not-up-to-me') => {
    if (category === 'not-up-to-me') {
      setDissolvingId(id);
      triggerHaptic('success');
      setTimeout(() => {
        setWorries((prev) => prev.filter((w) => w.id !== id));
        setDissolvingId(null);
      }, 800); // Wait for dissolve animation
    } else {
      setWorries((prev) => prev.map((w) => w.id === id ? { ...w, category } : w));
      triggerHaptic('medium');
    }
  };

  const handleResolve = (id: string) => {
    setWorries((prev) => prev.map((w) => w.id === id ? { ...w, isResolved: true } : w));
    triggerHaptic('light');
    setTimeout(() => {
      setWorries((prev) => prev.filter((w) => w.id !== id));
    }, 400);
  };

  const unassigned = worries.filter((w) => w.category === 'unassigned');
  const upToMe = worries.filter((w) => w.category === 'up-to-me');

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-10">
      <div className="text-center flex flex-col items-center gap-6">
        <h2 className="font-display text-3xl text-text-primary flex items-center justify-center gap-3">
          <Scale size={32} className="text-text-secondary" />
          Spheres of Choice
        </h2>
        <p className="text-text-secondary leading-relaxed max-w-xl italic text-lg">
          "Some things are in our control and others not. Things in our control are opinion, pursuit, desire, aversion... Things not in our control are body, property, reputation, command..." — Epictetus
        </p>
      </div>

      <form onSubmit={handleAddWorry} className="flex gap-4">
        <input
          type="text"
          value={newWorry}
          onChange={(e) => setNewWorry(e.target.value)}
          placeholder="What is troubling you right now?"
          className="flex-1 rounded-lg border border-tertiary bg-background-secondary px-4 py-3 text-text-primary outline-none focus-visible:border-accent transition-colors"
        />
        <Button type="submit" disabled={!newWorry.trim()}>Record</Button>
      </form>

      {unassigned.length > 0 && (
        <div className="flex flex-col gap-6">
          <h3 className="font-display text-xl text-text-primary mb-4 border-b border-tertiary pb-4">Unsorted Anxieties</h3>
          {unassigned.map((worry) => (
            <div 
              key={worry.id} 
              className={cn(
                "rounded-xl bg-background-secondary border border-tertiary p-5 shadow-sm transition-all duration-700",
                dissolvingId === worry.id ? "opacity-0 scale-95 blur-md translate-y-4" : "opacity-100 scale-100 blur-0 translate-y-0"
              )}
            >
              <p className="text-lg text-text-primary mb-4 font-medium">{worry.text}</p>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 py-2 text-text-secondary hover:text-success hover:border-success hover:bg-success/5"
                  onClick={() => handleCategorize(worry.id, 'up-to-me')}
                >
                  <CheckCircle2 size={18} className="mr-2" />
                  Up to Me
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 py-2 text-text-secondary hover:text-energy hover:border-energy hover:bg-energy/5"
                  onClick={() => handleCategorize(worry.id, 'not-up-to-me')}
                >
                  <CloudFog size={18} className="mr-2" />
                  Not Up to Me
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {upToMe.length > 0 && (
        <div className="flex flex-col gap-6">
          <h3 className="font-display text-xl text-text-primary mb-4 border-b border-tertiary pb-4">Actionable Concerns</h3>
          {upToMe.map((worry) => (
            <div 
              key={worry.id} 
              className={cn(
                "group flex items-start gap-4 rounded-lg bg-background-tertiary border border-tertiary p-4 transition-all",
                worry.isResolved ? "opacity-0 scale-95" : "opacity-100 scale-100"
              )}
            >
              <button 
                onClick={() => handleResolve(worry.id)}
                className="mt-1 shrink-0 text-text-secondary hover:text-success transition-colors"
                title="Mark as resolved"
              >
                <div className="h-5 w-5 rounded-full border-2 border-current group-hover:bg-success group-hover:border-success" />
              </button>
              <p className="text-text-primary flex-1">{worry.text}</p>
              <button 
                onClick={() => setWorries((prev) => prev.filter((w) => w.id !== worry.id))}
                className="shrink-0 text-text-secondary hover:text-energy opacity-0 group-hover:opacity-100 transition-opacity"
                title="Discard"
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {unassigned.length === 0 && upToMe.length === 0 && (
        <div className="text-center py-12 px-6 rounded-xl border border-dashed border-tertiary bg-background-secondary/50">
          <Scale size={48} className="mx-auto text-text-secondary/50 mb-4" strokeWidth={1} />
          <p className="text-text-secondary">Your mind is clear. Add a worry above to practice the dichotomy of control.</p>
        </div>
      )}
    </div>
  );
}

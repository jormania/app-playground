import { Compass, Loader2, RefreshCw, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '../../ds';
import { useMentor } from '../lib/useMentor';
import type { MentorPrompt } from '../lib/mentor';
import { triggerHaptic } from '../../shared/haptics';
import { cn } from '../lib/cn';

interface MentorPanelProps {
  title: string;
  intro: string;
  /** Button label used to summon the first reply (e.g. "Ask for today's challenge"). */
  cta: string;
  /** The assembled prompt, or null when there isn't enough yet to ask about. */
  prompt: MentorPrompt | null;
  /** Shown in place of the button when `prompt` is null. */
  disabledHint?: string;
  /** Whether a key is present and the mentor is switched on (isMentorEnabled()). */
  enabled: boolean;
  onGoToSettings: () => void;
  icon?: LucideIcon;
}

/** The Socratic mentor's voice — a driver, not a witness. Visually distinct from
 *  the reflective cards around it. Ephemeral: the reply lives only in this view,
 *  and is never written to the record. Renders a quiet "asleep" invitation when
 *  no key is configured, so the surface is discoverable without ever nagging. */
export default function MentorPanel({
  title,
  intro,
  cta,
  prompt,
  disabledHint,
  enabled,
  onGoToSettings,
  icon: Icon = Compass,
}: MentorPanelProps) {
  const mentor = useMentor();
  const reply = mentor.reply;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent-soft p-4 sm:p-6 shadow-sm">
      <header className="flex items-center gap-2">
        <Icon size={18} className="text-accent shrink-0" aria-hidden />
        <h3 className="font-display text-lg text-text-primary">{title}</h3>
        <span className="ml-auto text-[10px] uppercase font-mono tracking-widest font-semibold text-accent/70 shrink-0">
          Mentor
        </span>
      </header>

      <p className="text-sm text-text-secondary leading-relaxed">{intro}</p>

      {!enabled ? (
        <div className="rounded-lg border border-tertiary bg-background-secondary/60 p-4 flex flex-col gap-3 items-start">
          <p className="text-sm text-text-secondary leading-relaxed flex items-start gap-2">
            <Lock size={15} className="text-text-secondary mt-0.5 shrink-0" aria-hidden />
            <span>
              The mentor is asleep. Add your own Anthropic API key to wake a Socratic guide who
              reads your practice and drives it forward — never a witness, always a challenge.
            </span>
          </p>
          <Button variant="secondary" size="sm" onClick={onGoToSettings}>
            Wake the mentor in Settings
          </Button>
        </div>
      ) : (
        <>
          {reply && (
            <blockquote className="border-l-2 border-accent/50 pl-4 py-1 font-display text-[15px] leading-relaxed text-text-primary whitespace-pre-wrap">
              {reply}
            </blockquote>
          )}

          {mentor.error && (
            <p role="alert" className="text-sm text-caution">
              {mentor.error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {prompt ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  triggerHaptic('light');
                  void mentor.ask(prompt);
                }}
                disabled={mentor.isPending}
                className="flex items-center gap-2"
              >
                {mentor.isPending ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                ) : reply ? (
                  <RefreshCw size={16} aria-hidden />
                ) : (
                  <Compass size={16} aria-hidden />
                )}
                {mentor.isPending ? 'Thinking…' : reply ? 'Press me further' : cta}
              </Button>
            ) : (
              <p className={cn('text-xs text-text-secondary italic')}>
                {disabledHint || 'Add a little more first, then ask the mentor.'}
              </p>
            )}
            {reply && (
              <span className="font-mono text-[11px] text-text-secondary">
                Not saved — spoken for this moment only.
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import { exercises } from './exercises.js';
import { Pose, StrongmanIcon } from './poses.jsx';
import './kettlebell.css';

// Difficulty rating — one ported strongman pip per level (1–3).
function Difficulty({ level }) {
  const labels = ['', 'Beginner', 'Intermediate', 'Advanced'];
  return (
    <div className="difficulty" title={labels[level]} aria-label={`Difficulty: ${labels[level]}`}>
      {Array.from({ length: level }).map((_, i) => (
        <StrongmanIcon key={i} />
      ))}
    </div>
  );
}

function Filmstrip({ phases, accent }) {
  return (
    <div className="filmstrip" style={{ '--accent': accent }}>
      {phases.map((p, i) => (
        <div className="frame-wrap" key={p.pose + i}>
          <div className="frame">
            <span className="frame-num">{i + 1}</span>
            <Pose name={p.pose} flip={p.flip} label={p.label} />
          </div>
          {i < phases.length - 1 && (
            <svg className="flow-arrow" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 12 H17 M12 6 L18 12 L12 18" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

function ExerciseCard({ ex }) {
  return (
    <article className="card" id={`ex-${ex.id}`} style={{ '--accent': ex.accent }}>
      <header className="card-head">
        <span className="card-num">Move {String(ex.num).padStart(2, '0')}</span>
        <div className="card-titlerow">
          <h2 className="card-title">{ex.name}</h2>
          <Difficulty level={ex.difficulty} />
        </div>
        <p className="card-tagline">{ex.tagline}</p>
      </header>

      <Filmstrip phases={ex.phases} accent={ex.accent} />

      <ol className="steps">
        {ex.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>

      <div className="card-foot">{ex.tag}</div>
    </article>
  );
}

function Nav({ active }) {
  const railRef = useRef(null);
  const userScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef(null);

  // A trackpad's horizontal swipe over the rail often bleeds a little
  // vertical delta into the page, which can flip `active` mid-gesture — if
  // the effect below reacted to that, it'd yank the rail back to the
  // previously-active chip right as someone's trying to reach the last one.
  // Suppress auto-recentring while the rail itself is being touched.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const markUserScrolling = () => {
      userScrollingRef.current = true;
      clearTimeout(userScrollTimeoutRef.current);
      userScrollTimeoutRef.current = setTimeout(() => {
        userScrollingRef.current = false;
      }, 1200);
    };
    rail.addEventListener('wheel', markUserScrolling, { passive: true });
    rail.addEventListener('touchstart', markUserScrolling, { passive: true });
    rail.addEventListener('pointerdown', markUserScrolling);
    return () => {
      rail.removeEventListener('wheel', markUserScrolling);
      rail.removeEventListener('touchstart', markUserScrolling);
      rail.removeEventListener('pointerdown', markUserScrolling);
      clearTimeout(userScrollTimeoutRef.current);
    };
  }, []);

  // Keep the active chip centred in the horizontal rail. We scroll the
  // rail's own scrollLeft rather than calling scrollIntoView — the chips
  // live inside the sticky nav, and scrollIntoView would hijack the page's
  // vertical scroll, fighting the trackpad and mis-landing anchor clicks.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || userScrollingRef.current) return;
    const el = rail.querySelector(`[data-id="${active}"]`);
    if (!el) return;
    const railRect = rail.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const target =
      rail.scrollLeft + (elRect.left - railRect.left) - (rail.clientWidth - el.clientWidth) / 2;
    rail.scrollTo({ left: target, behavior: 'auto' });
  }, [active]);

  return (
    <nav className="topnav">
      <span className="brand">⬤ KB</span>
      <div className="rail" ref={railRef}>
        {exercises.map((ex) => (
          <a
            key={ex.id}
            href={`#ex-${ex.id}`}
            data-id={ex.id}
            className={'chip' + (active === ex.id ? ' active' : '')}
            style={{ '--accent': ex.accent }}
          >
            {String(ex.num).padStart(2, '0')} {ex.name.replace('Kettlebell ', '')}
          </a>
        ))}
      </div>
    </nav>
  );
}

export default function App() {
  const [active, setActive] = useState(exercises[0].id);

  // Highlight the nav chip for whichever card is in view.
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id.replace('ex-', ''));
        });
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );
    document.querySelectorAll('.card').forEach((c) => obs.observe(c));
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <Nav active={active} />

      <header className="hero">
        <div className="hero-inner">
          <p className="hero-eyebrow">Pop-Art Kettlebell Field Guide</p>
          <h1 className="hero-title">
            Swing<span className="amp">·</span><wbr />Press<span className="amp">·</span><wbr />Carry
          </h1>
          <p className="hero-sub">
            Twelve foundational kettlebell movements, each drawn as a sequence of bold,
            radiating Keith&nbsp;Haring figures so you can <em>see</em> the motion — not
            just one frozen pose.
          </p>
          <div className="hero-pills">
            <span className="pill">12 Movements</span>
            <span className="pill">Phase-by-Phase Art</span>
            <span className="pill">Form Cues That Bite</span>
          </div>
        </div>
      </header>

      <main className="cards">
        {exercises.map((ex) => (
          <ExerciseCard key={ex.id} ex={ex} />
        ))}
      </main>

      <footer className="site-foot">
        <p>
          Built with hip drive and questionable jokes. Form first — when in doubt, go lighter.
        </p>
        <a href="/">↑ Cone of Cold — back to all apps</a>
      </footer>
    </>
  );
}

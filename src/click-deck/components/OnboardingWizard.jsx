import React, { useState } from 'react'

export function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(0)

  return (
    <div className="cd-onboarding cd-panel">
      <h2>INITIALIZE_SYSTEM_PROTOCOL</h2>
      <div className="cd-onboarding-content">
        {step === 0 && (
          <>
            <p>Welcome to Click Deck. Your personal catalogue of graphic narrative and point-and-click history.</p>
            <p>To begin, we will establish your foundational dataset.</p>
            <div className="cd-onboarding-actions">
              <button className="primary" onClick={() => setStep(1)}>PROCEED_WITH_SETUP</button>
            </div>
          </>
        )}
        
        {step === 1 && (
          <>
            <p>Connecting to external data node (Simulated MCP)...</p>
            <p>Preparing batch payload of canonical pivot titles.</p>
            <ul className="cd-terminal-list">
              <li>&gt; The Curse of Monkey Island... queued.</li>
              <li>&gt; Blade Runner... queued.</li>
              <li>&gt; Firewatch... queued.</li>
              <li>&gt; Pentiment... queued.</li>
            </ul>
            <div className="cd-onboarding-actions">
              <button className="primary" onClick={onComplete}>EXECUTE_BATCH_INSERT</button>
            </div>
          </>
        )}
      </div>

      <style>{`
        .cd-onboarding {
          max-width: 600px;
          margin: 10vh auto;
          border-color: var(--cd-accent-cyan);
          box-shadow: 0 0 20px var(--cd-accent-cyan-dim);
          animation: fadeIn 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .cd-onboarding h2 {
          border-bottom: 1px solid var(--cd-accent-cyan);
          padding-bottom: 1rem;
          margin-bottom: 2rem;
          word-break: break-word;
          font-size: 1.5rem;
        }
        @media (max-width: 480px) {
          .cd-onboarding h2 {
            font-size: 1.25rem;
          }
        }
        .cd-onboarding-content p {
          font-family: var(--cd-font-terminal);
          font-size: 1.2rem;
          line-height: 1.5;
        }
        .cd-terminal-list {
          list-style: none;
          padding: 0;
          font-family: var(--cd-font-terminal);
          color: var(--cd-accent-amber);
          background: #0a0b0e;
          padding: 1rem;
          border: 1px solid var(--cd-border-color);
          margin: 2rem 0;
        }
        .cd-terminal-list li {
          margin-bottom: 0.5rem;
        }
        .cd-onboarding-actions {
          margin-top: 2rem;
          display: flex;
          justify-content: flex-end;
        }
      `}</style>
    </div>
  )
}

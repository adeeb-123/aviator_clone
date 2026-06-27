'use client';

import { useCallback, useEffect, useState } from 'react';

interface Step { target?: string; title: string; body: string }

const STEPS: Step[] = [
  { title: '✈️ Welcome to Aviator!', body: 'A 20-second tour of how to play. You can replay this anytime from the “?” button in the header.' },
  { target: '[data-tour="game"]', title: 'Watch the multiplier', body: 'A plane takes off and the multiplier climbs. The longer it flies, the bigger your win — but it can crash at any moment!' },
  { target: '[data-tour="bet"]', title: 'Place your bet', body: 'Set your stake and bet during the betting window. Switch to Auto for strategies like Martingale, Fibonacci or D’Alembert.' },
  { target: '[data-tour="bet"]', title: 'Cash out in time', body: 'When the round is running, hit Cash Out before the plane flies away. Use the ½ button to bank half and let the rest ride!' },
  { target: '[data-tour="rewards"]', title: 'Earn rewards', body: 'Claim daily bonuses, spin the wheel, level up, redeem promo codes and join tournaments.' },
  { target: '[data-tour="chat"]', title: 'Join the table', body: 'Chat with players, react to messages and make it rain. Good luck! 🍀' },
];

export default function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const start = useCallback(() => { setI(0); setActive(true); }, []);
  const finish = useCallback(() => { localStorage.setItem('aviatorTourDone', '1'); setActive(false); setRect(null); }, []);

  // auto-show once for new visitors
  useEffect(() => {
    if (localStorage.getItem('aviatorTourDone') !== '1') {
      const id = setTimeout(start, 1300);
      return () => clearTimeout(id);
    }
  }, [start]);

  // allow re-launch from the header "?" button
  useEffect(() => {
    const onStart = () => start();
    window.addEventListener('start-tour', onStart);
    return () => window.removeEventListener('start-tour', onStart);
  }, [start]);

  // track the highlighted element for the current step
  useEffect(() => {
    if (!active) return;
    const sync = () => {
      const sel = STEPS[i].target;
      const el = sel ? document.querySelector(sel) : null;
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setRect(el.getBoundingClientRect()); }
      else setRect(null);
    };
    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => { window.removeEventListener('resize', sync); window.removeEventListener('scroll', sync, true); };
  }, [active, i]);

  if (!active) return null;
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  // tooltip position: below the target if room, else above; centered if no target
  const pad = 8;
  const tipW = 300, tipH = 168;
  let tipStyle: React.CSSProperties;
  if (rect) {
    const below = rect.bottom + tipH + 16 < window.innerHeight;
    const top = below ? rect.bottom + 12 : Math.max(pad, rect.top - tipH - 12);
    const left = Math.min(Math.max(pad, rect.left), window.innerWidth - tipW - pad);
    tipStyle = { top, left, width: tipW };
  } else {
    tipStyle = { top: '50%', left: '50%', width: tipW, transform: 'translate(-50%,-50%)' };
  }

  return (
    <div className="fixed inset-0 z-[300]">
      {/* spotlight: a transparent box over the target with a huge shadow dimming everything else */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-accent-glow transition-all"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/72" />
      )}

      {/* tooltip */}
      <div className="absolute rounded-2xl border border-white/10 bg-base-800 p-4 shadow-glow" style={tipStyle}>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-accent-glow">Step {i + 1} / {STEPS.length}</div>
        <h3 className="text-lg font-black">{step.title}</h3>
        <p className="mt-1 text-sm text-white/70">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button onClick={finish} className="text-xs text-white/40 hover:text-white">Skip tour</button>
          <div className="flex gap-2">
            {i > 0 && <button onClick={() => setI((n) => n - 1)} className="btn bg-base-700 px-3 py-1.5 text-sm text-white/70">Back</button>}
            {last ? (
              <button onClick={finish} className="btn-primary px-4 py-1.5 text-sm">Let’s play! 🚀</button>
            ) : (
              <button onClick={() => setI((n) => n + 1)} className="btn-primary px-4 py-1.5 text-sm">Next</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { dismissCelebration, useCelebration, type Celebration } from '../../utils/celebrate';

const BIG_MS = 2600;
const PIGGY_MS = 3000; // coin drop + fill need a little longer to read
const TOAST_MS = 2600;
const PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#7c3aed', '#ef4444', '#06b6d4'];

// Pure pseudo-random so particle layout is stable across re-renders of the same celebration.
const rnd = (seed: number, i: number, k: number) => {
  const x = Math.sin(seed * 999.13 + i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Mounted once at the app root. Plays whatever `celebrate()` last asked for, then dismisses itself. */
export const CelebrationHost: React.FC = () => {
  const c = useCelebration();

  useEffect(() => {
    if (!c) return;
    const asToast = c.kind === 'toast' || reducedMotion();
    const ms = asToast ? TOAST_MS : c.kind === 'piggy' ? PIGGY_MS : BIG_MS;
    const timer = window.setTimeout(() => dismissCelebration(c.id), ms);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismissCelebration(c.id);
    window.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(timer); window.removeEventListener('keydown', onKey); };
  }, [c]);

  if (!c) return null;
  // Reduce Motion: every celebration becomes a plain toast.
  const body = c.kind === 'toast' || reducedMotion() ? <CelebrationToast key={c.id} c={c} /> : <BigCelebration key={c.id} c={c} />;
  return createPortal(body, document.body);
};

const TOAST_ICON = { success: Check, warning: AlertTriangle, error: X, info: Info } as const;

const CelebrationToast: React.FC<{ c: Celebration }> = ({ c }) => {
  const tone = c.tone ?? 'success';
  const Icon = TOAST_ICON[tone];
  return (
    <div className="cele-toast-wrap">
      <button type="button" className="cele-toast" role="status" aria-live="polite" onClick={() => dismissCelebration(c.id)}>
        <span className={`cele-toast-icon tone-${tone}`}><Icon size={16} strokeWidth={3} /></span>
        <span className="cele-toast-text">
          <strong>{c.title}</strong>
          {c.subtitle && <span>{c.subtitle}</span>}
        </span>
      </button>
    </div>
  );
};

const BigCelebration: React.FC<{ c: Celebration }> = ({ c }) => (
  <div className="cele-backdrop" onClick={() => dismissCelebration(c.id)}>
    {c.kind === 'fireworks' && <Fireworks seed={c.id} />}
    {(c.kind === 'confetti' || c.kind === 'trophy') && <Confetti seed={c.id} />}
    {c.kind === 'trophy' && <Fireworks seed={c.id} />}
    {c.kind === 'coins' && <CoinRain seed={c.id} />}
    <div className="cele-card" role="status" aria-live="polite">
      <Visual c={c} />
      <h2 className="cele-title">{c.title}</h2>
      {c.subtitle && <p className="cele-subtitle">{c.subtitle}</p>}
      <button type="button" className="cele-continue" onClick={() => dismissCelebration(c.id)} autoFocus>Continue</button>
    </div>
  </div>
);

const Visual: React.FC<{ c: Celebration }> = ({ c }) => {
  switch (c.kind) {
    case 'piggy':
      return (
        <div className="cele-piggy">
          <PiggyBank from={c.from ?? 0} to={c.to ?? 0} />
          <CountUp from={Math.round((c.from ?? 0) * 100)} to={Math.round((c.to ?? 0) * 100)} />
        </div>
      );
    case 'trophy':
      return (
        <div className="cele-trophy" aria-hidden="true">
          <div className="cele-rays">{Array.from({ length: 12 }, (_, i) => <span key={i} style={{ transform: `rotate(${i * 30}deg)` }} />)}</div>
          <span className="cele-trophy-emoji">🏆</span>
        </div>
      );
    case 'coins':
      return <span className="cele-emoji" aria-hidden="true">💰</span>;
    case 'fireworks':
      return <span className="cele-emoji" aria-hidden="true">📈</span>;
    default:
      return <span className="cele-emoji" aria-hidden="true">🎉</span>;
  }
};

const CountUp: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const [n, setN] = useState(from);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + 550; // wait for the coin to land
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / 1100));
      setN(Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to]);
  return <span className="cele-pct">{n}% saved</span>;
};

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/** Piggy bank whose green fill level is the savings progress; a coin drops in first. */
const PiggyBank: React.FC<{ from: number; to: number }> = ({ from, to }) => (
  <svg className="piggy" viewBox="0 0 220 180" width="184" height="150" aria-hidden="true"
    style={{ '--fill-from': clamp(from), '--fill-to': clamp(to) } as React.CSSProperties}>
    <defs>
      <clipPath id="piggy-body"><ellipse cx="104" cy="98" rx="82" ry="60" /></clipPath>
    </defs>
    <g className="piggy-wobble">
      <path d="M24 92 q-18 -6 -12 -22 q6 -12 16 -2" fill="none" stroke="#7c3aed" strokeWidth="6" strokeLinecap="round" />
      <rect x="52" y="140" width="24" height="26" rx="7" fill="#7c3aed" />
      <rect x="124" y="140" width="24" height="26" rx="7" fill="#7c3aed" />
      <rect x="62" y="34" width="30" height="30" rx="6" fill="#7c3aed" transform="rotate(45 77 49)" />
      <ellipse cx="104" cy="98" rx="82" ry="60" fill="#f3e8ff" />
      <g clipPath="url(#piggy-body)">
        <rect className="piggy-fill" x="18" y="38" width="172" height="120" fill="#10b981" />
      </g>
      <ellipse cx="104" cy="98" rx="82" ry="60" fill="none" stroke="#7c3aed" strokeWidth="5" />
      <ellipse cx="72" cy="66" rx="24" ry="8" fill="#ffffff" opacity="0.7" transform="rotate(-12 72 66)" />
      <rect x="92" y="38" width="36" height="8" rx="4" fill="#0f172a" />
      <circle cx="150" cy="80" r="5" fill="#0f172a" />
      <rect x="172" y="88" width="34" height="28" rx="10" fill="#e9d5ff" stroke="#7c3aed" strokeWidth="3.5" />
      <ellipse cx="183" cy="102" rx="3" ry="4.5" fill="#7c3aed" />
      <ellipse cx="195" cy="102" rx="3" ry="4.5" fill="#7c3aed" />
    </g>
    <g className="piggy-coin">
      <circle cx="110" cy="20" r="14" fill="#fbbf24" stroke="#f59e0b" strokeWidth="2.5" />
      <text x="110" y="25.5" textAnchor="middle" fontSize="15" fontWeight="900" fill="#b45309">₹</text>
    </g>
  </svg>
);

const Fireworks: React.FC<{ seed: number }> = ({ seed }) => (
  <div className="cele-layer" aria-hidden="true">
    {Array.from({ length: 5 }, (_, b) => (
      <div key={b} className="cele-burst" style={{ left: `${12 + rnd(seed, b, 1) * 76}%`, top: `${10 + rnd(seed, b, 2) * 45}%`, animationDelay: `${b * 260}ms` }}>
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{
            '--angle': `${(i / 14) * 360}deg`,
            '--dist': `${70 + rnd(seed, b * 14 + i, 3) * 60}px`,
            background: PALETTE[(b + i) % PALETTE.length],
            animationDelay: `${b * 260}ms`,
          } as React.CSSProperties} />
        ))}
      </div>
    ))}
  </div>
);

const Confetti: React.FC<{ seed: number }> = ({ seed }) => (
  <div className="cele-layer" aria-hidden="true">
    {Array.from({ length: 60 }, (_, i) => (
      <span key={i} className="cele-confetti" style={{
        left: `${rnd(seed, i, 1) * 100}%`,
        width: `${6 + rnd(seed, i, 2) * 5}px`,
        height: `${10 + rnd(seed, i, 3) * 7}px`,
        background: PALETTE[i % PALETTE.length],
        '--drift': `${(rnd(seed, i, 4) - 0.5) * 160}px`,
        '--spin': `${360 + rnd(seed, i, 5) * 540}deg`,
        animationDelay: `${rnd(seed, i, 6) * 600}ms`,
        animationDuration: `${2000 + rnd(seed, i, 7) * 900}ms`,
      } as React.CSSProperties} />
    ))}
  </div>
);

const CoinRain: React.FC<{ seed: number }> = ({ seed }) => (
  <div className="cele-layer" aria-hidden="true">
    {Array.from({ length: 26 }, (_, i) => {
      const size = 24 + rnd(seed, i, 2) * 12;
      return (
        <span key={i} className="cele-coin" style={{
          left: `${rnd(seed, i, 1) * 96}%`,
          width: size, height: size, fontSize: size * 0.5,
          animationDelay: `${rnd(seed, i, 3) * 800}ms`,
          animationDuration: `${1700 + rnd(seed, i, 4) * 700}ms`,
        }}>₹</span>
      );
    })}
  </div>
);

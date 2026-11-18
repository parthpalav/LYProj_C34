import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';

export interface ImportProgressOverlayProps {
  /** The request finished: the ring fills to 100% and shows the result line. */
  done: boolean;
  fileName: string;
  /** Longer files (PDF) take longer: sets how fast the ring creeps while waiting. */
  slow: boolean;
  doneLabel: string;
  onCancel: () => void;
  /** Called once the finish animation has played. */
  onFinished: () => void;
}

const SIZE = 220;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const FINISH_MS = 1100;

// Stage text follows elapsed time; the server reports nothing until it is done.
const stageFor = (ms: number, slow: boolean) => {
  if (!slow) return ms < 400 ? 'Reading the statement' : ms < 900 ? 'Classifying transactions' : 'Checking for duplicates';
  if (ms < 3000) return 'Reading the PDF';
  if (ms < 8000) return 'Finding transactions';
  if (ms < 15000) return 'Classifying transactions';
  return 'Taking longer than usual. If Gemini is slow, the offline reader takes over.';
};

/**
 * Full-screen, blurred wait screen for statement reading + classification. Mount it while
 * reading; unmount it in onFinished. The server answers in one response, so the ring eases
 * toward 92% while waiting and completes when the response arrives.
 */
export const ImportProgressOverlay: React.FC<ImportProgressOverlayProps> = ({ done, fileName, slow, doneLabel, onCancel, onFinished }) => {
  const [elapsed, setElapsed] = useState(0);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const onFinishedRef = useRef(onFinished);
  useEffect(() => { onCancelRef.current = onCancel; onFinishedRef.current = onFinished; });

  // Creep: p(t) = 0.92 · (1 − e^(−t/τ)). τ is about a third of the expected wait.
  useEffect(() => {
    if (done) return undefined;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      setElapsed(now - start);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [done]);

  useEffect(() => {
    if (!done) return undefined;
    const t = window.setTimeout(() => onFinishedRef.current(), FINISH_MS);
    return () => window.clearTimeout(t);
  }, [done]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancelRef.current(); }
      // Only one control: keep focus on it so Tab cannot reach the page behind.
      if (e.key === 'Tab') { e.preventDefault(); cancelRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  const shown = done ? 1 : 0.92 * (1 - Math.exp(-elapsed / (slow ? 7000 : 900)));
  const pct = Math.round(shown * 100);
  const stage = done ? doneLabel : stageFor(elapsed, slow);

  return createPortal(
    <div className={`import-overlay${done ? ' is-done' : ''}`} role="dialog" aria-modal="true" aria-labelledby="import-overlay-title" aria-describedby="import-overlay-stage">
      <div className="import-overlay-center">
        <div className="import-ring" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Statement progress">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
            <defs>
              <linearGradient id="import-ring-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--accent-primary)" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
            <circle className="import-ring-track" cx={SIZE / 2} cy={SIZE / 2} r={R} strokeWidth={STROKE} fill="none" />
            <circle
              className="import-ring-bar"
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              strokeWidth={STROKE}
              fill="none"
              stroke={done ? 'var(--success)' : 'url(#import-ring-grad)'}
              strokeLinecap={done ? 'butt' : 'round'} // round caps overlap into a notch on a full circle
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - shown)}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          </svg>
          <div className="import-ring-label">
            {done ? <Check size={64} strokeWidth={2.6} className="import-ring-check" aria-hidden="true" /> : <span>{pct}<small>%</small></span>}
          </div>
        </div>
        <h2 id="import-overlay-title" className="import-overlay-title">{done ? 'All set' : 'Importing your statement'}</h2>
        <p id="import-overlay-stage" className="import-overlay-stage" aria-live="polite">{stage}</p>
        <p className="import-overlay-file" title={fileName}>{fileName}</p>
      </div>
      {!done && (
        <button ref={cancelRef} type="button" className="import-overlay-cancel" onClick={onCancel}>
          <X size={16} aria-hidden="true" /> Cancel
        </button>
      )}
    </div>,
    document.body,
  );
};

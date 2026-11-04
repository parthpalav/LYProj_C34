import React, { useCallback, useEffect, useState } from 'react';
import { PiggyBank, Sparkles } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Toast } from '../components/ui/Toast';
import { ProgressBar } from '../components/ui/ProgressBar';
import { SectionError } from '../components/dashboard/SectionError';
import { SkeletonCard } from '../components/ui/SkeletonCard';
import { getEnvelopes, getRoundupPreview, vaultRoundup } from '../services/api';
import { formatCurrencyINR } from '../utils/formatters';
import type { EnvelopeData } from '../types';
import { celebrate } from '../utils/celebrate';

const QUICK = [20, 50, 100, 500];

/** Round-up vault: tuck away the loose change from purchases (web version of mobile Envelopes). */
export const RoundupsPage: React.FC = () => {
  const [envelope, setEnvelope] = useState<EnvelopeData | null>(null);
  const [preview, setPreview] = useState<{ amount: number; previewText: string } | null>(null);
  const [custom, setCustom] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string | null; type: 'success' | 'error' | 'warning' }>({ message: null, type: 'success' });

  const load = useCallback(async () => {
    const [env, pre] = await Promise.allSettled([getEnvelopes(), getRoundupPreview()]);
    if (env.status === 'fulfilled') setEnvelope(env.value);
    if (pre.status === 'fulfilled') setPreview(pre.value);
    setFailed(env.status === 'rejected');
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!toast.message) return;
    const t = setTimeout(() => setToast({ message: null, type: 'success' }), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const vault = async (amount: number) => {
    if (!(amount > 0)) return setToast({ message: 'Enter an amount greater than zero.', type: 'warning' });
    setBusy(true);
    try {
      const before = envelope?.savings ?? 0;
      const target = envelope?.targetSavings ?? 0;
      await vaultRoundup(amount);
      setCustom('');
      await load();
      celebrate(target > 0
        ? { kind: 'piggy', from: Math.min(1, before / target), to: Math.min(1, (before + amount) / target), title: `${formatCurrencyINR(amount)} vaulted`, subtitle: 'Small amounts add up.' }
        : { kind: 'coins', title: `${formatCurrencyINR(amount)} vaulted`, subtitle: 'Small amounts add up.' });
    } catch {
      setToast({ message: "Couldn't move that into the vault.", type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const saved = envelope?.savings ?? 0;
  const target = envelope?.targetSavings ?? 0;

  return (
    <div className="parity-page">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: null, type: 'success' })} />
      <PageHeader title="Round-ups" category="SAVINGS" description="Save the loose change from everyday spending." />

      {failed && !envelope ? (
        <div className="parity-card"><SectionError message="Your round-up vault is unavailable right now." onRetry={load} /></div>
      ) : !envelope ? (
        <div className="parity-card"><SkeletonCard height={140} /></div>
      ) : (
        <>
          <section className="parity-card">
            <div className="parity-row">
              <PiggyBank size={40} aria-hidden="true" color="var(--accent-primary)" />
              <div>
                <p className="parity-muted">In your vault</p>
                <div className="parity-hero-value">{formatCurrencyINR(saved)}</div>
                <p className="parity-muted">{target > 0 ? `of ${formatCurrencyINR(target)} target` : 'Every round-up lands here'}</p>
              </div>
            </div>
            {target > 0 && <div style={{ marginTop: 16 }}><ProgressBar value={Math.min(100, (saved / target) * 100)} /></div>}
          </section>

          {preview && preview.amount > 0 && (
            <section className="parity-card">
              <h2>Suggested round-up</h2>
              <div className="parity-row" style={{ justifyContent: 'space-between' }}>
                <div className="parity-row">
                  <Sparkles size={18} aria-hidden="true" color="var(--accent-primary)" />
                  <div>
                    <strong>{formatCurrencyINR(preview.amount)}</strong>
                    <p className="parity-muted">{preview.previewText}</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => vault(preview.amount)} isLoading={busy}>Vault it</Button>
              </div>
            </section>
          )}

          <section className="parity-card">
            <h2>Add your own</h2>
            <form onSubmit={(e) => { e.preventDefault(); vault(Number(custom)); }}>
              <label htmlFor="roundup-amount" className="form-label">Amount to vault (₹)</label>
              <div className="input-currency-wrapper" style={{ maxWidth: 320 }}>
                <span className="input-prefix">₹</span>
                <input id="roundup-amount" className="form-input with-prefix" inputMode="numeric" placeholder="0" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, ''))} />
              </div>
              <div className="parity-actions">
                {QUICK.map((v) => (
                  <button key={v} type="button" className="parity-chip" aria-pressed={custom === String(v)} onClick={() => setCustom(String(v))}>{formatCurrencyINR(v)}</button>
                ))}
              </div>
              <div className="parity-actions"><Button type="submit" isLoading={busy}>Move to vault</Button></div>
            </form>
          </section>
        </>
      )}
    </div>
  );
};

export default RoundupsPage;

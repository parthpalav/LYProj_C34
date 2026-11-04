import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Toast } from '../components/ui/Toast';
import { SkeletonCard } from '../components/ui/SkeletonCard';
import { EmptyState } from '../components/dashboard/EmptyState';
import { getTransactions, updateTransaction } from '../services/api';
import { formatCurrencyINR, getTransactionDate } from '../utils/formatters';
import { CANONICAL_CATEGORIES, VALID_TRANSACTION_TYPES } from '../types';
import type { Transaction, TransactionType } from '../types';
import { getAppTimezone } from '../utils/timezone';

/**
 * One card at a time for transactions the classifier flagged as unsure. Confirming or correcting sends a
 * manual label, which clears the flag and teaches merchant memory for next time.
 */
export const ReviewPage: React.FC = () => {
  const [queue, setQueue] = useState<Transaction[] | null>(null);
  const [category, setCategory] = useState('');
  const [type, setType] = useState<TransactionType>('Need');
  const [done, setDone] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string | null; type: 'success' | 'error' }>({ message: null, type: 'success' });

  const pick = (tx?: Transaction) => {
    setCategory(tx?.category ?? '');
    setType(tx?.type ?? 'Need');
  };

  const load = useCallback(async () => {
    try {
      const all = await getTransactions();
      const pending = all.filter((t) => t.needsReview).sort((a, b) => getTransactionDate(b).getTime() - getTransactionDate(a).getTime());
      setQueue(pending);
      pick(pending[0]);
    } catch {
      setQueue([]);
      setToast({ message: "Couldn't load transactions.", type: 'error' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!toast.message) return;
    const t = setTimeout(() => setToast({ message: null, type: 'success' }), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const current = queue?.[0];
  const corrected = current && (category !== current.category || type !== current.type);

  const submit = async () => {
    if (!current || !queue) return;
    setSaving(true);
    try {
      // Always send the label: the server marks it manual, clears needsReview and remembers the merchant.
      await updateTransaction(current.id, { category, type });
      const rest = queue.slice(1);
      setQueue(rest);
      pick(rest[0]);
      setDone((n) => n + 1);
      if (!rest.length) setToast({ message: 'All caught up. FINAURA will remember these merchants.', type: 'success' });
    } catch {
      setToast({ message: "Couldn't save that.", type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const skip = () => {
    if (!queue || queue.length < 2) return;
    const rest = [...queue.slice(1), queue[0]];
    setQueue(rest);
    pick(rest[0]);
  };

  return (
    <div className="parity-page">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: null, type: 'success' })} />
      <PageHeader
        title="Check AI guesses"
        category="ACTIVITY"
        description="Confirm or correct labels FINAURA wasn't sure about."
        actions={<Link className="next-step-action" to="/app/activity">Back to Activity</Link>}
      />
      <section className="parity-card">
        {queue === null ? (
          <SkeletonCard height={220} />
        ) : !current ? (
          <EmptyState icon={CheckCircle2} title={done ? 'All caught up' : 'Nothing to check'} message="When FINAURA isn't sure how to label a transaction, it lands here." />
        ) : (
          <>
            <p className="parity-muted">{queue.length} left{done ? ` · ${done} done` : ''}</p>
            <h2 style={{ marginTop: 12 }}>{current.description || 'Transaction'}</h2>
            <div className="review-amount">{formatCurrencyINR(Math.abs(current.amount))}</div>
            <p className="parity-muted">
              {getTransactionDate(current).toLocaleDateString('en-IN', { timeZone: getAppTimezone(), weekday: 'short', day: 'numeric', month: 'short' })}
              {' · '}FINAURA guessed <strong>{current.category} · {current.type ?? 'Need'}</strong>
            </p>

            <h3 className="form-label" style={{ marginTop: 20 }}>Category</h3>
            <div className="review-cats" role="group" aria-label="Category">
              {CANONICAL_CATEGORIES.map((cat) => (
                <button key={cat} type="button" className="parity-chip" aria-pressed={category === cat} onClick={() => setCategory(cat)}>{cat}</button>
              ))}
            </div>

            <h3 className="form-label">Type</h3>
            <div className="parity-actions" role="group" aria-label="Type" style={{ marginTop: 8 }}>
              {VALID_TRANSACTION_TYPES.map((t) => (
                <button key={t} type="button" className="parity-chip" aria-pressed={type === t} onClick={() => setType(t)}>{t}</button>
              ))}
            </div>

            <div className="parity-actions" style={{ marginTop: 24 }}>
              <Button onClick={submit} isLoading={saving}>{corrected ? 'Save correction' : 'Looks right'}</Button>
              {queue.length > 1 && <Button variant="ghost" onClick={skip} disabled={saving}>Skip for now</Button>}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default ReviewPage;

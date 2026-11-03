import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { formatCurrencyINR } from '../../utils/formatters';
import type { Goal } from '../../types';
import { celebrate, toast } from '../../utils/celebrate';
import { goalProgress, milestoneCrossed, MILESTONE_COPY } from '../../utils/goalProgress';

interface FundGoalModalProps {
  goal: Goal | null;
  onClose: () => void;
  onSave: (goal: Goal, newSaved: number) => Promise<void>;
}

/** Add to, or take money out of, a goal (mobile Goals "fund" sheet). */
export const FundGoalModal: React.FC<FundGoalModalProps> = ({ goal, onClose, onSave }) => {
  const [amount, setAmount] = useState('');
  const [withdraw, setWithdraw] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (goal) { setAmount(''); setWithdraw(false); setError(''); }
  }, [goal]);

  if (!goal) return null;
  const saved = Number(goal.savedAmount) || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError('Enter an amount greater than zero.');
    if (withdraw && value > saved) return setError(`You can take out up to ${formatCurrencyINR(saved)}.`);
    setSaving(true);
    try {
      // shortcut: read-modify-write like mobile, can lose a concurrent contribution; switch to a $inc endpoint if multi-device use matters
      const target = Number(goal.targetAmount) || 0;
      const p = goalProgress(saved, withdraw ? -value : value, target);
      await onSave(goal, Math.max(0, p.newSaved));
      onClose();
      if (withdraw) {
        toast(`${formatCurrencyINR(value)} taken out`, { tone: 'info', subtitle: `${goal.name} now has ${formatCurrencyINR(p.newSaved)}.` });
      } else if (p.completed) {
        celebrate({ kind: 'trophy', title: `${goal.name} goal reached!`, subtitle: `You saved ${formatCurrencyINR(p.newSaved)} of ${formatCurrencyINR(target)}.` });
      } else {
        const milestone = milestoneCrossed(p.from, p.to);
        celebrate({
          kind: 'piggy', from: p.from, to: p.to,
          title: milestone ? `${MILESTONE_COPY[milestone]}!` : `${formatCurrencyINR(value)} saved`,
          subtitle: `${formatCurrencyINR(Math.max(0, target - p.newSaved))} to go for ${goal.name}.`,
        });
      }
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`${goal.emoji || '🎯'} ${goal.name}`} subtitle={`${formatCurrencyINR(saved)} of ${formatCurrencyINR(goal.targetAmount)} saved`} maxWidth="440px">
      <form onSubmit={submit} className="activity-form">
        {error && <p className="parity-error" role="alert">{error}</p>}
        <div className="parity-actions" role="group" aria-label="Direction" style={{ marginTop: 0 }}>
          <button type="button" className="parity-chip" aria-pressed={!withdraw} onClick={() => setWithdraw(false)}>Add money</button>
          <button type="button" className="parity-chip" aria-pressed={withdraw} onClick={() => setWithdraw(true)} disabled={saved <= 0}>Take out</button>
        </div>
        <div className="form-group">
          <label htmlFor="fund-amount" className="form-label">Amount (₹)</label>
          <div className="input-currency-wrapper">
            <span className="input-prefix">₹</span>
            <input id="fund-amount" className="form-input with-prefix" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, '')); setError(''); }} />
          </div>
        </div>
        <div className="modal-footer">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" isLoading={saving}>{withdraw ? 'Take out' : 'Add to goal'}</Button>
        </div>
      </form>
    </Modal>
  );
};

import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { updateCurrentBalance } from '../../services/api';
import { formatCurrencyINR } from '../../utils/formatters';

interface AdjustBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  onUpdated: (message: string) => void;
}

/** Credit or debit the bank balance directly (mobile "Adjust Bank Balance"). */
export const AdjustBalanceModal: React.FC<AdjustBalanceModalProps> = ({ isOpen, onClose, currentBalance, onUpdated }) => {
  const { user, setUser } = useAuth();
  const [operation, setOperation] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) { setOperation('credit'); setAmount(''); setError(''); }
  }, [isOpen]);

  const parsed = parseFloat(amount) || 0;
  const projected = operation === 'credit' ? currentBalance + parsed : currentBalance - parsed;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return setError('Please sign in again.');
    if (!(parsed > 0)) return setError('Enter an amount greater than zero.');
    setSaving(true);
    try {
      const res = await updateCurrentBalance(user.id, operation, parsed);
      setUser({ ...user, currentBalance: res.currentBalance });
      onUpdated(`${operation === 'credit' ? 'Added' : 'Deducted'} ${formatCurrencyINR(parsed)}. New balance ${formatCurrencyINR(res.currentBalance)}.`);
      onClose();
    } catch {
      setError("Couldn't update your balance. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Adjust bank balance" subtitle={`Current balance ${formatCurrencyINR(currentBalance)}`} maxWidth="440px">
      <form onSubmit={submit} className="activity-form">
        {error && <p className="parity-error" role="alert">{error}</p>}
        <div className="parity-actions" role="group" aria-label="Adjustment type" style={{ marginTop: 0 }}>
          {(['credit', 'debit'] as const).map((op) => (
            <button key={op} type="button" className="parity-chip" aria-pressed={operation === op} onClick={() => setOperation(op)}>
              {op === 'credit' ? 'Credit' : 'Debit'}
            </button>
          ))}
        </div>
        <div className="form-group">
          <label htmlFor="bal-amount" className="form-label">Amount (₹)</label>
          <div className="input-currency-wrapper">
            <span className="input-prefix">₹</span>
            <input id="bal-amount" className="form-input with-prefix" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, '')); setError(''); }} />
          </div>
          <span className="form-help-text">New balance preview: <strong>{formatCurrencyINR(projected)}</strong></span>
        </div>
        <div className="modal-footer">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" isLoading={saving}>Confirm update</Button>
        </div>
      </form>
    </Modal>
  );
};

import React, { useState, useEffect } from 'react';
import type { IncomeRecord, IncomePayload } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export interface IncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: IncomePayload) => Promise<void>;
  initialIncome?: IncomeRecord | null;
}

const COMMON_INCOME_SOURCES = [
  'salary',
  'freelance',
  'investments',
  'bonus',
  'business',
  'rental',
  'consulting',
  'gift',
  'other',
];

export const IncomeModal: React.FC<IncomeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialIncome,
}) => {
  const isEditing = Boolean(initialIncome);

  const [amount, setAmount] = useState<string>('');
  const [source, setSource] = useState<string>('salary');
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (isOpen && mounted) {
        if (initialIncome) {
          setAmount(String(initialIncome.amount));
          setSource(initialIncome.source || 'salary');
          setDescription(initialIncome.description || '');
          const d = initialIncome.timestamp ? new Date(initialIncome.timestamp) : new Date();
          setDate(d.toISOString().slice(0, 10));
        } else {
          setAmount('');
          setSource('salary');
          setDescription('');
          setDate(new Date().toISOString().slice(0, 10));
        }
        setFormError(null);
        setIsLoading(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [isOpen, initialIncome]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Please enter a valid income amount greater than 0.');
      return;
    }

    setIsLoading(true);
    try {
      const payload: IncomePayload = {
        amount: parsedAmount,
        source: source.trim() || 'salary',
        description: description.trim() || 'Income',
        timestamp: date ? new Date(date).toISOString() : new Date().toISOString(),
      };

      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      console.error('Failed to save income record:', err);
      setFormError(err?.response?.data?.error || err?.response?.data?.message || 'Unable to save income record.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Income Entry' : 'Record New Income'}
      subtitle={isEditing ? 'Update your income record and balance adjustment' : 'Log received earnings to increase your operating balance'}
      maxWidth="500px"
    >
      <form onSubmit={handleSubmit} className="activity-form">
        {formError && (
          <div className="form-error-banner animate-fade-in" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{formError}</span>
          </div>
        )}

        {/* Amount */}
        <div className="form-group">
          <label htmlFor="inc-amount" className="form-label">
            Income Amount (₹) <span className="text-danger">*</span>
          </label>
          <div className="input-currency-wrapper">
            <span className="input-prefix">₹</span>
            <input
              id="inc-amount"
              type="number"
              step="any"
              min="0.01"
              placeholder="0"
              className="form-input with-prefix"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus={!isEditing}
            />
          </div>
          <span className="form-help-text">Directly credits your available current balance.</span>
        </div>

        {/* Source & Date in 2 cols */}
        <div className="form-grid-2">
          <div className="form-group">
            <label htmlFor="inc-source" className="form-label">
              Income Source <span className="text-danger">*</span>
            </label>
            <select
              id="inc-source"
              className="form-select"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              {COMMON_INCOME_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="inc-date" className="form-label">
              Date Received
            </label>
            <input
              id="inc-date"
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {/* Description */}
        <div className="form-group">
          <label htmlFor="inc-desc" className="form-label">
            Description / Memo
          </label>
          <input
            id="inc-desc"
            type="text"
            placeholder="e.g. Monthly salary, client advance invoice..."
            className="form-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
          >
            {isEditing ? 'Save Changes' : 'Record Income'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

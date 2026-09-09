/* oxlint-disable react/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import type { Goal } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: any) => Promise<any>;
  goalToEdit?: Goal | null;
}

const EMOJI_OPTIONS = ['🎯', '🏖️', '🚗', '🏠', '💍', '🎓', '🛡️', '💻', '👶', '🌴'];

export const GoalModal: React.FC<GoalModalProps> = ({
  isOpen,
  onClose,
  onSave,
  goalToEdit,
}) => {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [targetAmount, setTargetAmount] = useState<string>('');
  const [savedAmount, setSavedAmount] = useState<string>('0');
  const [targetDate, setTargetDate] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (goalToEdit) {
      setName(goalToEdit.name || '');
      setEmoji(goalToEdit.emoji || '🎯');
      setTargetAmount(String(goalToEdit.targetAmount || ''));
      setSavedAmount(String(goalToEdit.savedAmount || '0'));
      setTargetDate(goalToEdit.targetDate || '');
      setMonthlyContribution(
        goalToEdit.monthlyContribution !== undefined && goalToEdit.monthlyContribution > 0
          ? String(goalToEdit.monthlyContribution)
          : ''
      );
    } else {
      setName('');
      setEmoji('🎯');
      setTargetAmount('');
      setSavedAmount('0');
      setTargetDate('');
      setMonthlyContribution('');
    }
    setError(null);
  }, [goalToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Goal name is required');
      return;
    }

    const numTarget = parseFloat(targetAmount);
    if (isNaN(numTarget) || numTarget <= 0) {
      setError('Target amount must be a positive number');
      return;
    }

    const numSaved = parseFloat(savedAmount);
    if (isNaN(numSaved) || numSaved < 0) {
      setError('Saved amount must be a non-negative number');
      return;
    }

    const numMonthly = monthlyContribution.trim() !== '' ? parseFloat(monthlyContribution) : 0;
    if (isNaN(numMonthly) || numMonthly < 0) {
      setError('Monthly contribution must be non-negative');
      return;
    }

    try {
      setSaving(true);
      if (goalToEdit) {
        await onSave({
          name: name.trim(),
          emoji,
          targetAmount: numTarget,
          savedAmount: numSaved,
          targetDate,
          monthlyContribution: numMonthly,
        });
      } else {
        // Correction #3: Single atomic create request using verified backend schema
        await onSave({
          name: name.trim(),
          emoji,
          targetAmount: numTarget,
          targetDate,
          monthlyContribution: numMonthly,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={goalToEdit ? 'Edit Financial Goal' : 'Create Financial Goal'}
      subtitle={
        goalToEdit
          ? 'Update target corpus, target timeline, or monthly commitment'
          : 'Define a measurable target to track progress alongside retirement'
      }
      maxWidth="540px"
    >
      <form onSubmit={handleSubmit} className="plan-modal-form">
        {error && (
          <div className="form-error-banner" role="alert">
            <span>{error}</span>
          </div>
        )}

        <div className="form-row emoji-name-row">
          <div className="form-group emoji-picker-group" style={{ maxWidth: '80px' }}>
            <label htmlFor="goal-emoji-select" className="form-label">
              Icon
            </label>
            <select
              id="goal-emoji-select"
              className="form-select emoji-select"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              style={{ fontSize: '1.25rem', textAlign: 'center', padding: '8px' }}
            >
              {EMOJI_OPTIONS.map((em) => (
                <option key={em} value={em}>
                  {em}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group flex-1">
            <label htmlFor="goal-name" className="form-label">
              Goal Name <span className="text-danger">*</span>
            </label>
            <input
              id="goal-name"
              type="text"
              className="form-input"
              placeholder="e.g. Emergency Fund, Eurotrip, Home Downpayment"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group flex-1">
            <label htmlFor="target-amount" className="form-label">
              Target Amount (₹) <span className="text-danger">*</span>
            </label>
            <div className="input-currency-wrapper">
              <span className="currency-prefix">₹</span>
              <input
                id="target-amount"
                type="number"
                step="any"
                min="1"
                className="form-input currency-input"
                placeholder="0.00"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                required
              />
            </div>
          </div>

          {goalToEdit && (
            <div className="form-group flex-1">
              <label htmlFor="saved-amount" className="form-label">
                Already Saved (₹)
              </label>
              <div className="input-currency-wrapper">
                <span className="currency-prefix">₹</span>
                <input
                  id="saved-amount"
                  type="number"
                  step="any"
                  min="0"
                  className="form-input currency-input"
                  placeholder="0.00"
                  value={savedAmount}
                  onChange={(e) => setSavedAmount(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="form-row">
          <div className="form-group flex-1">
            <label htmlFor="target-date" className="form-label">
              Target Completion Date
            </label>
            <input
              id="target-date"
              type="date"
              className="form-input"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          <div className="form-group flex-1">
            <label htmlFor="monthly-contribution" className="form-label">
              Monthly Saving (₹ / mo)
            </label>
            <div className="input-currency-wrapper">
              <span className="currency-prefix">₹</span>
              <input
                id="monthly-contribution"
                type="number"
                step="any"
                min="0"
                className="form-input currency-input"
                placeholder="Optional"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving...' : goalToEdit ? 'Save Changes' : 'Create Goal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

/* oxlint-disable react/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import type { Goal } from '../../types';

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

  if (!isOpen) return null;

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
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3 className="modal-title">{goalToEdit ? 'Edit Financial Goal' : 'Create Financial Goal'}</h3>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="form-error-banner">{error}</div>}

          <div className="form-row emoji-name-row">
            <div className="form-group emoji-picker-group">
              <label htmlFor="goal-emoji-select" className="form-label">Icon</label>
              <select
                id="goal-emoji-select"
                className="form-select emoji-select"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
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
                Goal Name *
              </label>
              <input
                id="goal-name"
                type="text"
                className="form-input"
                placeholder="e.g. Emergency Fund, Eurotrip, Car Downpayment"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="target-amount" className="form-label">
                Target Amount (₹) *
              </label>
              <input
                id="target-amount"
                type="number"
                step="any"
                min="1"
                className="form-input"
                placeholder="₹ Target"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                required
              />
            </div>

            {goalToEdit && (
              <div className="form-group flex-1">
                <label htmlFor="saved-amount" className="form-label">
                  Already Saved (₹)
                </label>
                <input
                  id="saved-amount"
                  type="number"
                  step="any"
                  min="0"
                  className="form-input"
                  placeholder="₹ Saved"
                  value={savedAmount}
                  onChange={(e) => setSavedAmount(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="target-date" className="form-label">
                Target Date (Optional)
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
                Planned Monthly Saving (₹)
              </label>
              <input
                id="monthly-contribution"
                type="number"
                step="any"
                min="0"
                className="form-input"
                placeholder="₹ / month"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : goalToEdit ? 'Save Changes' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

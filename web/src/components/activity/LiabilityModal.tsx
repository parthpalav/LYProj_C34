import React, { useState, useEffect } from 'react';
import type { Liability, LiabilityPayload, TransactionType } from '../../types';
import { CANONICAL_CATEGORIES, VALID_TRANSACTION_TYPES } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export interface LiabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: LiabilityPayload) => Promise<void>;
  initialLiability?: Liability | null;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export const LiabilityModal: React.FC<LiabilityModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialLiability,
}) => {
  const isEditing = Boolean(initialLiability);

  const [name, setName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('Debt & Loan Payments');
  const [type, setType] = useState<TransactionType>('Need');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [startDate, setStartDate] = useState<string>('');
  const [autoDeduct, setAutoDeduct] = useState<boolean>(true);
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [monthOfYear, setMonthOfYear] = useState<number>(1);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (isOpen && mounted) {
        if (initialLiability) {
          setName(initialLiability.name || '');
          setAmount(String(initialLiability.amount));
          setCategory(initialLiability.category || 'Debt & Loan Payments');
          setType(initialLiability.type || 'Need');
          setFrequency(initialLiability.frequency || 'monthly');
          const d = initialLiability.startDate ? new Date(initialLiability.startDate) : new Date();
          setStartDate(d.toISOString().slice(0, 10));
          setAutoDeduct(initialLiability.autoDeduct ?? true);
          setDayOfWeek(initialLiability.dayOfWeek ?? 1);
          setDayOfMonth(initialLiability.dayOfMonth ?? 1);
          setMonthOfYear(initialLiability.monthOfYear ?? 1);
        } else {
          setName('');
          setAmount('');
          setCategory('Debt & Loan Payments');
          setType('Need');
          setFrequency('monthly');
          setStartDate(new Date().toISOString().slice(0, 10));
          setAutoDeduct(true);
          setDayOfWeek(1);
          setDayOfMonth(new Date().getDate());
          setMonthOfYear(new Date().getMonth() + 1);
        }
        setFormError(null);
        setIsLoading(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [isOpen, initialLiability]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Please enter a valid liability amount greater than 0.');
      return;
    }

    if (!name.trim()) {
      setFormError('Obligation name is required.');
      return;
    }

    setIsLoading(true);
    try {
      const payload: LiabilityPayload = {
        name: name.trim(),
        amount: parsedAmount,
        category,
        type,
        frequency,
        startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
        autoDeduct,
        dayOfWeek: frequency === 'weekly' ? Number(dayOfWeek) : null,
        dayOfMonth: frequency === 'monthly' || frequency === 'yearly' ? Number(dayOfMonth) : null,
        monthOfYear: frequency === 'yearly' ? Number(monthOfYear) : null,
      };

      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      console.error('Failed to save liability:', err);
      setFormError(err?.response?.data?.error || err?.response?.data?.message || 'Unable to save liability.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Recurring Obligation' : 'Add Recurring Liability'}
      subtitle={isEditing ? 'Modify schedule, recurrence frequency, or auto-deduct status' : 'Track recurring bills, loan EMIs, or regular payments'}
      maxWidth="540px"
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

        {/* Name */}
        <div className="form-group">
          <label htmlFor="liab-name" className="form-label">
            Obligation Name <span className="text-danger">*</span>
          </label>
          <input
            id="liab-name"
            type="text"
            placeholder="e.g. Home Loan EMI, Apartment Rent, Netflix, WiFi..."
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus={!isEditing}
          />
        </div>

        {/* Amount & Frequency in 2 cols */}
        <div className="form-grid-2">
          <div className="form-group">
            <label htmlFor="liab-amount" className="form-label">
              Amount (₹) <span className="text-danger">*</span>
            </label>
            <div className="input-currency-wrapper">
              <span className="input-prefix">₹</span>
              <input
                id="liab-amount"
                type="number"
                step="any"
                min="0.01"
                placeholder="0"
                className="form-input with-prefix"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="liab-freq" className="form-label">
              Frequency <span className="text-danger">*</span>
            </label>
            <select
              id="liab-freq"
              className="form-select"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as any)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        {/* Dynamic Recurrence Fields */}
        {frequency === 'weekly' && (
          <div className="form-group">
            <label htmlFor="liab-dow" className="form-label">
              Day of the Week
            </label>
            <select
              id="liab-dow"
              className="form-select"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
            >
              {DAYS_OF_WEEK.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {frequency === 'monthly' && (
          <div className="form-group">
            <label htmlFor="liab-dom" className="form-label">
              Due Day of Month (1 - 31)
            </label>
            <input
              id="liab-dom"
              type="number"
              min="1"
              max="31"
              className="form-input"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value))))}
            />
          </div>
        )}

        {frequency === 'yearly' && (
          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="liab-moy" className="form-label">
                Month of Year
              </label>
              <select
                id="liab-moy"
                className="form-select"
                value={monthOfYear}
                onChange={(e) => setMonthOfYear(Number(e.target.value))}
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="liab-dom-yearly" className="form-label">
                Day of Month (1 - 31)
              </label>
              <input
                id="liab-dom-yearly"
                type="number"
                min="1"
                max="31"
                className="form-input"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value))))}
              />
            </div>
          </div>
        )}

        {/* Category & Type in 2 cols */}
        <div className="form-grid-2">
          <div className="form-group">
            <label htmlFor="liab-cat" className="form-label">
              Category <span className="text-danger">*</span>
            </label>
            <select
              id="liab-cat"
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CANONICAL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="liab-type" className="form-label">
              Spend Type <span className="text-danger">*</span>
            </label>
            <select
              id="liab-type"
              className="form-select"
              value={type}
              onChange={(e) => setType(e.target.value as TransactionType)}
            >
              {VALID_TRANSACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Start Date */}
        <div className="form-group">
          <label htmlFor="liab-start" className="form-label">
            Schedule Start Date <span className="text-danger">*</span>
          </label>
          <input
            id="liab-start"
            type="date"
            className="form-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>

        {/* Auto Deduct Toggle & Explanation */}
        <div className="autodeduct-toggle-card">
          <label className="autodeduct-toggle-label">
            <input
              type="checkbox"
              className="autodeduct-checkbox"
              checked={autoDeduct}
              onChange={(e) => setAutoDeduct(e.target.checked)}
            />
            <span className="autodeduct-title">Enable Auto-Deduct</span>
          </label>
          <p className="autodeduct-description">
            When enabled, FINAURA automatically creates the scheduled transaction and adjusts your balance when this liability becomes due.
          </p>
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
            {isEditing ? 'Save Changes' : 'Create Liability'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

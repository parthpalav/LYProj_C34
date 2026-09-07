import React, { useState, useEffect, useRef } from 'react';
import type { Transaction, TransactionPayload, TransactionType, ClassifierSuggestion } from '../../types';
import { CANONICAL_CATEGORIES, VALID_TRANSACTION_TYPES } from '../../types';
import { classifyExpense } from '../../services/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: TransactionPayload) => Promise<void>;
  initialTransaction?: Transaction | null;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialTransaction,
}) => {
  const isEditing = Boolean(initialTransaction);

  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<string>(CANONICAL_CATEGORIES[0]);
  const [type, setType] = useState<TransactionType>('Need');
  const [date, setDate] = useState<string>('');
  const [userTouchedCategory, setUserTouchedCategory] = useState<boolean>(false);

  // Classification assistance
  const [suggestion, setSuggestion] = useState<ClassifierSuggestion | null>(null);
  const [isClassifying, setIsClassifying] = useState<boolean>(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize form
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (isOpen && mounted) {
        if (initialTransaction) {
          setAmount(String(initialTransaction.amount));
          setDescription(initialTransaction.description || '');
          setCategory(initialTransaction.category || CANONICAL_CATEGORIES[0]);
          setType(initialTransaction.type || 'Need');
          const txDate = initialTransaction.timestamp ? new Date(initialTransaction.timestamp) : new Date();
          setDate(txDate.toISOString().slice(0, 10));
          setUserTouchedCategory(true);
        } else {
          setAmount('');
          setDescription('');
          setCategory(CANONICAL_CATEGORIES[0]);
          setType('Need');
          setDate(new Date().toISOString().slice(0, 10));
          setUserTouchedCategory(false);
        }
        setSuggestion(null);
        setFormError(null);
        setIsLoading(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [isOpen, initialTransaction]);

  // Debounced classifier call on description change (in Add mode)
  useEffect(() => {
    if (!isOpen || isEditing) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = description.trim();
    if (trimmed.length < 3) {
      const clearSug = async () => {
        setSuggestion(null);
      };
      clearSug();
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsClassifying(true);
      try {
        const result = await classifyExpense(trimmed);
        if (result && result.category) {
          setSuggestion(result);
          // If user hasn't explicitly chosen a category, apply suggestion automatically
          if (!userTouchedCategory) {
            setCategory(result.category);
            if (result.type) {
              setType(result.type);
            }
          }
        }
      } catch (err) {
        console.warn('Live classifier failed silently:', err);
      } finally {
        setIsClassifying(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [description, isOpen, isEditing, userTouchedCategory]);

  const handleApplySuggestion = () => {
    if (suggestion) {
      setCategory(suggestion.category);
      if (suggestion.type) {
        setType(suggestion.type);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Please enter a valid expense amount greater than 0.');
      return;
    }

    if (!category) {
      setFormError('Please select a category.');
      return;
    }

    setIsLoading(true);
    try {
      const payload: TransactionPayload = {
        amount: parsedAmount,
        category,
        type,
        description: description.trim() || 'Expense',
        timestamp: date ? new Date(date).toISOString() : new Date().toISOString(),
        classificationSource: isEditing ? 'manual' : (userTouchedCategory ? 'manual' : (suggestion?.classificationSource || 'manual')),
      };

      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      console.error('Failed to save transaction:', err);
      setFormError(err?.response?.data?.error || err?.response?.data?.message || 'Unable to save transaction.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Transaction' : 'Record New Transaction'}
      subtitle={isEditing ? 'Update transaction details or correct classification' : 'Add an expense to your financial ledger'}
      maxWidth="520px"
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

        {/* Amount Input */}
        <div className="form-group">
          <label htmlFor="tx-amount" className="form-label">
            Expense Amount (₹) <span className="text-danger">*</span>
          </label>
          <div className="input-currency-wrapper">
            <span className="input-prefix">₹</span>
            <input
              id="tx-amount"
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
          <span className="form-help-text">Recorded as positive outflow; deducted from your balance.</span>
        </div>

        {/* Description Input */}
        <div className="form-group">
          <label htmlFor="tx-desc" className="form-label">
            Description / Merchant
          </label>
          <input
            id="tx-desc"
            type="text"
            placeholder="e.g. Swiggy dinner, Metro card recharge..."
            className="form-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Classification Suggestion Card */}
        {suggestion && !isEditing && (
          <div className="classification-suggestion-card animate-fade-in">
            <div className="suggestion-head">
              <span className="suggestion-badge">
                💡 FINAURA Suggestion {isClassifying && '(updating...)'}
              </span>
              {suggestion.confidence ? (
                <span className="suggestion-confidence">
                  {Math.round(suggestion.confidence * 100)}% match
                </span>
              ) : null}
            </div>
            <div className="suggestion-body">
              <span>
                <strong>{suggestion.category}</strong> · <em>{suggestion.type}</em>
              </span>
              {category !== suggestion.category && (
                <button
                  type="button"
                  className="apply-suggestion-link"
                  onClick={handleApplySuggestion}
                >
                  Apply
                </button>
              )}
            </div>
          </div>
        )}

        {/* Category & Type in 2 cols */}
        <div className="form-grid-2">
          <div className="form-group">
            <label htmlFor="tx-category" className="form-label">
              Category <span className="text-danger">*</span>
            </label>
            <select
              id="tx-category"
              className="form-select"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setUserTouchedCategory(true);
              }}
            >
              {CANONICAL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="tx-type" className="form-label">
              Spend Type <span className="text-danger">*</span>
            </label>
            <select
              id="tx-type"
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

        {/* Date Input */}
        <div className="form-group">
          <label htmlFor="tx-date" className="form-label">
            Date
          </label>
          <input
            id="tx-date"
            type="date"
            className="form-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Form Actions */}
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
            {isEditing ? 'Save Changes' : 'Add Transaction'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

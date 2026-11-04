import React, { useState, useEffect, useRef } from 'react';
import type { Transaction, TransactionPayload, TransactionType, ClassifierSuggestion, Liability, PaymentMethod } from '../../types';
import { CANONICAL_CATEGORIES, VALID_TRANSACTION_TYPES, CASH_METHOD_ID } from '../../types';
import { PAYMENT_KIND_LABEL, paymentMethodLabel } from '../../utils/paymentMethods';
import { classifyExpense, getLiabilities } from '../../services/api';
import { formatCurrencyINR } from '../../utils/formatters';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Sparkles } from 'lucide-react';
import { dateInputToISO, dateKey, getAppTimezone, todayKey } from '../../utils/timezone';

export interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: TransactionPayload) => Promise<void>;
  initialTransaction?: Transaction | null;
  /** Saved payment methods (archived included, so an old transaction's method still shows). */
  paymentMethods?: PaymentMethod[];
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialTransaction,
  paymentMethods = [],
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

  // Optional link to a recurring bill (mobile QuickAdd parity)
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [liabilityId, setLiabilityId] = useState<string>('');
  const [markAsPaid, setMarkAsPaid] = useState<boolean>(true);
  const linked = liabilities.find((l) => l.id === liabilityId) ?? null;

  // How it was paid: '' = unspecified (bank balance), 'cash', or a saved method id
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const originalMethodId = initialTransaction?.paymentMethodId ?? '';
  const methodOptions = paymentMethods.filter((m) => m.status === 'active' || m.id === originalMethodId);
  const chosenCard = paymentMethods.find((m) => m.id === paymentMethodId && m.kind === 'credit_card');
  // When editing a purchase already on this card, its old amount is part of what's been used.
  const cardAvailable = chosenCard?.credit
    ? chosenCard.credit.available + (isEditing && originalMethodId === chosenCard.id ? initialTransaction?.amount ?? 0 : 0)
    : null;

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const amountError = amount !== '' && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
    ? 'Enter an amount greater than ₹0.' : null;

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
          setDate(dateKey(txDate));
          setUserTouchedCategory(true);
        } else {
          setAmount('');
          setDescription('');
          setCategory(CANONICAL_CATEGORIES[0]);
          setType('Need');
          setDate(todayKey());
          setUserTouchedCategory(false);
        }
        setSuggestion(null);
        setFormError(null);
        setIsLoading(false);
        setLiabilityId('');
        setMarkAsPaid(true);
        setPaymentMethodId(initialTransaction?.paymentMethodId ?? '');
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [isOpen, initialTransaction]);

  // Active bills for the optional link; only offered when adding.
  useEffect(() => {
    if (!isOpen || isEditing) return;
    let mounted = true;
    getLiabilities()
      .then((list) => mounted && setLiabilities(list.filter((l) => l.status === 'active' || !l.status)))
      .catch(() => mounted && setLiabilities([]));
    return () => { mounted = false; };
  }, [isOpen, isEditing]);

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

    if (cardAvailable !== null && parsedAmount > cardAvailable) {
      setFormError(`This is more than the ${formatCurrencyINR(cardAvailable)} available on ${chosenCard?.nickname}. Pick another payment method or pay the card bill first.`);
      return;
    }

    setIsLoading(true);
    try {
      const payload: TransactionPayload = {
        amount: parsedAmount,
        category,
        type,
        description: description.trim() || 'Expense',
        timestamp: dateInputToISO(date),
        classificationSource: isEditing ? 'manual' : (userTouchedCategory ? 'manual' : (suggestion?.classificationSource || 'manual')),
      };
      // On edit, only send it when changed: a removed card can't be re-selected, only kept.
      if (!isEditing || paymentMethodId !== originalMethodId) payload.paymentMethodId = paymentMethodId || null;
      // Tell the server where the label came from: only a real user pick is learned as a merchant correction.
      if (!isEditing) {
        const usedSuggestion = !userTouchedCategory && suggestion?.category === category;
        if (userTouchedCategory) {
          Object.assign(payload, { categorySource: 'manual', typeSource: 'manual', categoryConfidence: 1, typeConfidence: 1, needsReview: false });
        } else if (usedSuggestion && suggestion) {
          const src = suggestion.classificationSource || 'ml';
          Object.assign(payload, {
            categorySource: suggestion.categorySource || src,
            typeSource: suggestion.typeSource || src,
            categoryConfidence: suggestion.categoryConfidence ?? suggestion.confidence ?? 0,
            typeConfidence: suggestion.typeConfidence ?? suggestion.confidence ?? 0,
            needsReview: Boolean(suggestion.needsReview),
          });
        } else {
          Object.assign(payload, { categorySource: 'default', typeSource: 'default', categoryConfidence: 0, typeConfidence: 0 });
        }
        if (linked) {
          payload.liabilityId = linked.id;
          // Covers the scheduled auto-deduction so the server doesn't charge it twice.
          if (linked.autoDeduct && markAsPaid && linked.nextDueDate) payload.expectedScheduledFor = String(linked.nextDueDate);
        }
      }

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
      title={isEditing ? 'Edit Transaction' : 'Record an expense'}
      subtitle={isEditing ? 'Update transaction details or correct classification' : 'Add an expense to your financial ledger'}
      maxWidth="560px"
    >
      <form onSubmit={handleSubmit} className="activity-form">
        <div className="entry-section-title"><span>1</span> Payment details <small>Fields marked * are required</small></div>
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
              aria-invalid={amountError ? true : undefined}
              aria-describedby={amountError ? 'tx-amount-error' : 'tx-amount-help'}
            />
          </div>
          {amountError ? <span id="tx-amount-error" className="entry-field-error" role="status">{amountError}</span> : <span id="tx-amount-help" className="form-help-text">Enter the amount paid. It will be recorded as an expense.</span>}
        </div>

        {/* Payment method */}
        <div className="form-group">
          <label htmlFor="tx-method" className="form-label">Paid with</label>
          <select id="tx-method" className="form-select" value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
            <option value="">Not specified (bank balance)</option>
            <option value={CASH_METHOD_ID}>Cash</option>
            {methodOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {PAYMENT_KIND_LABEL[m.kind]} · {paymentMethodLabel(m)}{m.status === 'archived' ? ' (removed)' : ''}
              </option>
            ))}
          </select>
          <span className="form-help-text">
            {cardAvailable !== null
              ? `Charged to the card, not your bank balance. ${formatCurrencyINR(cardAvailable)} available.`
              : paymentMethods.length === 0
                ? 'Add UPI or cards in your profile to pick them here.'
                : 'Comes out of your bank balance.'}
          </span>
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
                <Sparkles size={12} aria-hidden="true" />
                <span>FINAURA Classification {isClassifying && '(updating...)'}</span>
              </span>
              {typeof suggestion.confidence === 'number' && suggestion.confidence > 0 ? (
                <span className="suggestion-confidence tabular-nums">
                  {Math.round(suggestion.confidence * 100)}% match
                </span>
              ) : null}
            </div>
            <div className="suggestion-body">
              <div className="suggestion-category-pair">
                <span className="sug-cat">{suggestion.category}</span>
                <span className="sug-dot">·</span>
                <span className="sug-type">{suggestion.type}</span>
              </div>
              {category !== suggestion.category && (
                <button
                  type="button"
                  className="apply-suggestion-link"
                  onClick={handleApplySuggestion}
                >
                  Apply suggestion
                </button>
              )}
            </div>
          </div>
        )}

        {/* Category & Type in 2 cols */}
        <div className="entry-section-title"><span>2</span> Review classification</div>
        <p className="entry-section-help">Check the category and spend type before saving. You can correct them at any time.</p>
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
              onChange={(e) => { setType(e.target.value as TransactionType); setUserTouchedCategory(true); }}
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

        {/* Optional bill link */}
        {!isEditing && liabilities.length > 0 && (
          <div className="form-group">
            <label htmlFor="tx-liability" className="form-label">Link to a bill (optional)</label>
            <select
              id="tx-liability"
              className="form-select"
              value={liabilityId}
              onChange={(e) => setLiabilityId(e.target.value)}
            >
              <option value="">Not a bill payment</option>
              {liabilities.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {formatCurrencyINR(l.amount)} · {l.frequency}{l.autoDeduct ? ' · Auto deduct' : ''}
                </option>
              ))}
            </select>
            {linked?.autoDeduct && linked.nextDueDate && (
              <label className="form-help-text" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                <input type="checkbox" checked={markAsPaid} onChange={(e) => setMarkAsPaid(e.target.checked)} />
                {markAsPaid
                  ? `Covers the payment due ${new Date(linked.nextDueDate).toLocaleDateString('en-IN', { timeZone: getAppTimezone(), day: 'numeric', month: 'short' })}, so it won't auto-deduct twice.`
                  : 'Record as an extra payment. The scheduled deduction still runs.'}
              </label>
            )}
          </div>
        )}

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

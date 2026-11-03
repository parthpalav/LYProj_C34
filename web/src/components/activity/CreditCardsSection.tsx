import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import { payCreditCardBill, setCreditCardBalance } from '../../services/api';
import { formatCurrencyINR, formatDateFull } from '../../utils/formatters';
import type { PaymentMethod } from '../../types';

type Notify = (message: string, type: 'success' | 'error' | 'warning') => void;

export interface CreditCardsSectionProps {
  cards: PaymentMethod[];
  onChanged: () => void;
  notify: Notify;
}

export const CreditCardsSection: React.FC<CreditCardsSectionProps> = ({ cards, onChanged, notify }) => {
  const { refreshUser } = useAuth();
  const [paying, setPaying] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [adjusting, setAdjusting] = useState<PaymentMethod | null>(null);
  const [used, setUsed] = useState('');
  const [billedUnpaid, setBilledUnpaid] = useState('');

  if (cards.length === 0) {
    return (
      <p className="text-secondary text-sm" style={{ marginBottom: 16 }}>
        Credit cards you add in <Link to="/app/profile">your profile</Link> show up here with their limit and due date.
      </p>
    );
  }

  const openPay = (card: PaymentMethod) => {
    const c = card.credit!;
    setPaying(card);
    setAmount(String(c.amountDue > 0 ? c.amountDue : c.outstanding));
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paying?.credit) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError('Enter an amount greater than ₹0.');
    if (value > paying.credit.outstanding) return setError(`You owe ${formatCurrencyINR(paying.credit.outstanding)} on this card. Pay that much or less.`);
    setBusy(true);
    try {
      await payCreditCardBill(paying.id, value);
      setPaying(null);
      notify(`Paid ${formatCurrencyINR(value)} towards ${paying.nickname} from your bank balance.`, 'success');
      onChanged();
      refreshUser().catch(() => undefined);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Payment not recorded. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const openAdjust = (card: PaymentMethod) => {
    const c = card.credit!;
    setAdjusting(card);
    setUsed(String(Math.max(0, c.outstanding)));
    setBilledUnpaid(String(c.amountDue));
    setError('');
  };

  const submitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjusting?.credit) return;
    const u = Number(used || 0);
    const b = Number(billedUnpaid || 0);
    if (!Number.isFinite(u) || u < 0) return setError('Amount used must be ₹0 or more.');
    if (u > adjusting.credit.creditLimit) return setError(`Amount used cannot be more than the ${formatCurrencyINR(adjusting.credit.creditLimit)} limit.`);
    if (!Number.isFinite(b) || b < 0) return setError('Unpaid statement amount must be ₹0 or more.');
    if (b > u) return setError('Unpaid statement amount cannot be more than the amount used.');
    setBusy(true);
    try {
      await setCreditCardBalance(adjusting.id, u, b);
      setAdjusting(null);
      notify(`${adjusting.nickname} balance updated.`, 'success');
      onChanged();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Balance not saved. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const total = cards.reduce((s, c) => s + Math.max(0, c.credit?.outstanding ?? 0), 0);

  return (
    <section className="cc-section" aria-label="Credit cards">
      <div className="cc-card-head">
        <h2>Credit cards</h2>
        <span className="text-secondary text-sm">Total owed {formatCurrencyINR(total)}</span>
      </div>
      <div className="cc-grid">
        {cards.map((card) => {
          const c = card.credit;
          if (!c) return null;
          const usedPct = c.creditLimit > 0 ? Math.min(100, Math.max(0, (c.outstanding / c.creditLimit) * 100)) : 0;
          return (
            <article key={card.id} className="cc-card">
              <div className="cc-card-head">
                <div>
                  <strong>{card.nickname}</strong>
                  <br />
                  <span>•••• {card.last4}</span>
                </div>
                {c.overdueAmount > 0 ? (
                  <span className="cc-badge is-overdue">Overdue {formatCurrencyINR(c.overdueAmount)}</span>
                ) : c.amountDue > 0 ? (
                  <span className="cc-badge is-due">Due {formatDateFull(c.dueDate)}</span>
                ) : null}
              </div>

              <div
                className={`cc-bar${usedPct >= 80 ? ' is-high' : ''}`}
                role="meter"
                aria-label={`${Math.round(usedPct)}% of credit limit used`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(usedPct)}
              >
                <span style={{ width: `${usedPct}%` }} />
              </div>

              <dl className="cc-facts">
                <div><dt>Used</dt><dd>{formatCurrencyINR(c.outstanding)}</dd></div>
                <div><dt>Available</dt><dd>{formatCurrencyINR(c.available)}</dd></div>
                <div><dt>Amount due</dt><dd>{formatCurrencyINR(c.amountDue)}</dd></div>
                <div><dt>{c.amountDue > 0 ? 'Due date' : 'Next due date'}</dt><dd>{formatDateFull(c.dueDate)}</dd></div>
                <div><dt>Unbilled</dt><dd>{formatCurrencyINR(c.unbilled)}</dd></div>
                <div><dt>Limit</dt><dd>{formatCurrencyINR(c.creditLimit)}</dd></div>
              </dl>

              <div className="cc-card-foot">
                <span className="text-secondary text-sm">Next statement {formatDateFull(c.nextStatementDate)}</span>
                <div className="parity-actions">
                  <Button size="sm" variant="ghost" onClick={() => openAdjust(card)}>Update balance</Button>
                  <Button size="sm" variant="outline" disabled={c.outstanding <= 0} onClick={() => openPay(card)}>Pay bill</Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Modal isOpen={Boolean(paying)} onClose={() => setPaying(null)} title={`Pay ${paying?.nickname ?? 'card'} bill`} subtitle="The payment comes out of your bank balance and frees up credit on the card." maxWidth="460px">
        <form onSubmit={submit} className="activity-form">
          {error && <div className="form-error-banner" role="alert"><span>{error}</span></div>}
          <div className="form-group">
            <label htmlFor="cc-pay-amount" className="form-label">Amount (₹)</label>
            <div className="input-currency-wrapper">
              <span className="input-prefix">₹</span>
              <input id="cc-pay-amount" className="form-input with-prefix" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setError(''); }} />
            </div>
            {paying?.credit && (
              <div className="parity-actions" style={{ marginTop: 8 }}>
                {paying.credit.amountDue > 0 && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setAmount(String(paying.credit!.amountDue))}>
                    Amount due {formatCurrencyINR(paying.credit.amountDue)}
                  </Button>
                )}
                <Button type="button" size="sm" variant="ghost" onClick={() => setAmount(String(paying.credit!.outstanding))}>
                  Full balance {formatCurrencyINR(paying.credit.outstanding)}
                </Button>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <Button type="button" variant="outline" onClick={() => setPaying(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" isLoading={busy}>Pay</Button>
          </div>
        </form>
      </Modal>
      <Modal isOpen={Boolean(adjusting)} onClose={() => setAdjusting(null)} title={`Update ${adjusting?.nickname ?? 'card'} balance`} subtitle="Enter what your card app or statement shows. Use this for spending you did not record here. Your bank balance does not change." maxWidth="460px">
        <form onSubmit={submitAdjust} className="activity-form">
          {error && <div className="form-error-banner" role="alert"><span>{error}</span></div>}
          <div className="form-group">
            <label htmlFor="cc-used" className="form-label">Total used now (₹)</label>
            <div className="input-currency-wrapper">
              <span className="input-prefix">₹</span>
              <input id="cc-used" className="form-input with-prefix" inputMode="decimal" value={used} onChange={(e) => { setUsed(e.target.value); setError(''); }} />
            </div>
            <span className="parity-hint">Everything owed on the card, billed or not</span>
          </div>
          <div className="form-group">
            <label htmlFor="cc-billed" className="form-label">Unpaid from last statement (₹)</label>
            <div className="input-currency-wrapper">
              <span className="input-prefix">₹</span>
              <input id="cc-billed" className="form-input with-prefix" inputMode="decimal" value={billedUnpaid} onChange={(e) => { setBilledUnpaid(e.target.value); setError(''); }} />
            </div>
            <span className="parity-hint">
              {adjusting?.credit ? `Billed on ${formatDateFull(adjusting.credit.lastStatementDate)} and not paid yet. ` : ''}
              The rest is billed on your next statement.
            </span>
          </div>
          <div className="modal-footer">
            <Button type="button" variant="outline" onClick={() => setAdjusting(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" isLoading={busy}>Save</Button>
          </div>
        </form>
      </Modal>
    </section>
  );
};

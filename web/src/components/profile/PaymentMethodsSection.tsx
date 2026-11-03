import React, { useState } from 'react';
import { CreditCard, Pencil, Plus, Smartphone, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { usePaymentMethods } from '../../hooks/usePaymentMethods';
import { createPaymentMethod, deletePaymentMethod, updatePaymentMethod } from '../../services/api';
import { formatCurrencyINR } from '../../utils/formatters';
import { PAYMENT_KIND_LABEL, ordinalDay, paymentMethodLabel } from '../../utils/paymentMethods';
import type { PaymentMethod, PaymentMethodKind, PaymentMethodPayload } from '../../types';

type Notify = (message: string, type: 'success' | 'error' | 'warning') => void;

const EMPTY = { kind: 'upi' as PaymentMethodKind, nickname: '', last4: '', upiId: '', creditLimit: '', statementDay: '', dueDay: '', used: '', billedUnpaid: '' };

export const PaymentMethodsSection: React.FC<{ notify: Notify }> = ({ notify }) => {
  const { active, isLoading, error, refetch } = usePaymentMethods();
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<PaymentMethod | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const set = (key: keyof typeof EMPTY, value: string) => { setForm((p) => ({ ...p, [key]: value })); setFormError(''); };

  const openAdd = () => { setEditing(null); setForm(EMPTY); setFormError(''); setOpen(true); };
  const openEdit = (m: PaymentMethod) => {
    setEditing(m);
    setForm({
      kind: m.kind,
      nickname: m.nickname,
      last4: m.last4 ?? '',
      upiId: m.upiId ?? '',
      creditLimit: m.creditLimit != null ? String(m.creditLimit) : '',
      statementDay: m.statementDay != null ? String(m.statementDay) : '',
      dueDay: m.dueDay != null ? String(m.dueDay) : '',
      used: '',
      billedUnpaid: '',
    });
    setFormError('');
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: PaymentMethodPayload = { kind: form.kind, nickname: form.nickname.trim() };
    if (!payload.nickname) return setFormError('Give this payment method a nickname.');
    if (form.kind === 'upi') {
      payload.upiId = form.upiId.trim();
    } else {
      if (!/^\d{4}$/.test(form.last4)) return setFormError('Enter the last 4 digits of the card.');
      payload.last4 = form.last4;
    }
    if (form.kind === 'credit_card') {
      const limit = Number(form.creditLimit);
      const stmt = Number(form.statementDay);
      const due = Number(form.dueDay);
      if (!Number.isFinite(limit) || limit <= 0) return setFormError('Enter a credit limit greater than ₹0.');
      if (!Number.isInteger(stmt) || stmt < 1 || stmt > 31) return setFormError('Statement day must be a date from 1 to 31.');
      if (!Number.isInteger(due) || due < 1 || due > 31) return setFormError('Due day must be a date from 1 to 31.');
      Object.assign(payload, { creditLimit: limit, statementDay: stmt, dueDay: due });
      if (!editing) {
        const used = Number(form.used || 0);
        const billedUnpaid = Number(form.billedUnpaid || 0);
        if (!Number.isFinite(used) || used < 0) return setFormError('Amount already used must be ₹0 or more.');
        if (used > limit) return setFormError('Amount already used cannot be more than the credit limit.');
        if (!Number.isFinite(billedUnpaid) || billedUnpaid < 0) return setFormError('Unpaid statement amount must be ₹0 or more.');
        if (billedUnpaid > used) return setFormError('Unpaid statement amount cannot be more than the amount already used.');
        if (used > 0) Object.assign(payload, { used, billedUnpaid });
      }
    }
    setSaving(true);
    try {
      if (editing) {
        const { kind: _kind, ...changes } = payload;
        await updatePaymentMethod(editing.id, changes);
      } else {
        await createPaymentMethod(payload);
      }
      setOpen(false);
      notify(editing ? 'Payment method updated.' : 'Payment method added.', 'success');
      refetch();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || "Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await deletePaymentMethod(removing.id);
      notify('Payment method removed.', 'success');
      refetch();
    } catch (err: any) {
      notify(err?.response?.data?.error || "Couldn't remove it. Try again.", 'error');
    } finally {
      setRemoveBusy(false);
      setRemoving(null);
    }
  };

  return (
    <section className="parity-card">
      <div className="parity-row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2>Payment methods</h2>
          <p className="parity-muted">UPI and cards you pay with. Pick one when you record an expense.</p>
        </div>
        <Button variant="outline" leftIcon={<Plus size={15} />} onClick={openAdd}>Add method</Button>
      </div>

      {error && <p className="parity-error" role="alert">{error}</p>}
      {!isLoading && !error && active.length === 0 && (
        <p className="parity-muted" style={{ marginTop: 12 }}>No payment methods yet. Expenses come out of your bank balance until you add one.</p>
      )}
      {active.length > 0 && (
        <ul className="pm-list">
          {active.map((m) => (
            <li key={m.id} className="pm-item">
              <span className="pm-icon" aria-hidden="true">{m.kind === 'upi' ? <Smartphone size={16} /> : <CreditCard size={16} />}</span>
              <div className="pm-text">
                <strong>{paymentMethodLabel(m)}</strong>
                <span className="parity-muted">
                  {PAYMENT_KIND_LABEL[m.kind]}
                  {m.kind === 'credit_card' && m.credit && ` · ${formatCurrencyINR(m.credit.available)} of ${formatCurrencyINR(m.credit.creditLimit)} available · statement ${ordinalDay(m.statementDay!)}, due ${ordinalDay(m.dueDay!)}`}
                </span>
              </div>
              <div className="parity-actions">
                <Button size="sm" variant="ghost" leftIcon={<Pencil size={14} />} onClick={() => openEdit(m)} aria-label={`Edit ${m.nickname}`}>Edit</Button>
                <Button size="sm" variant="ghost" leftIcon={<Trash2 size={14} />} onClick={() => setRemoving(m)} aria-label={`Remove ${m.nickname}`}>Remove</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit payment method' : 'Add payment method'} subtitle="Only a nickname and the last 4 digits are saved. Never enter a full card number or CVV." maxWidth="520px">
        <form onSubmit={save} className="activity-form">
          {formError && <p className="parity-error" role="alert">{formError}</p>}
          <div className="form-group">
            <label htmlFor="pm-kind" className="form-label">Type</label>
            <select id="pm-kind" className="form-select" value={form.kind} disabled={Boolean(editing)} onChange={(e) => set('kind', e.target.value)}>
              {(Object.keys(PAYMENT_KIND_LABEL) as PaymentMethodKind[]).map((k) => <option key={k} value={k}>{PAYMENT_KIND_LABEL[k]}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="pm-nickname" className="form-label">Nickname</label>
            <input id="pm-nickname" className="form-input" maxLength={50} placeholder={form.kind === 'upi' ? 'e.g. GPay' : 'e.g. HDFC Regalia'} value={form.nickname} onChange={(e) => set('nickname', e.target.value)} />
          </div>
          {form.kind === 'upi' ? (
            <div className="form-group">
              <label htmlFor="pm-upi" className="form-label">UPI ID</label>
              <input id="pm-upi" className="form-input" placeholder="name@okhdfc" autoComplete="off" value={form.upiId} onChange={(e) => set('upiId', e.target.value)} />
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="pm-last4" className="form-label">Last 4 digits</label>
              <input id="pm-last4" className="form-input" inputMode="numeric" maxLength={4} autoComplete="off" placeholder="1234" value={form.last4} onChange={(e) => set('last4', e.target.value.replace(/\D/g, ''))} />
            </div>
          )}
          {form.kind === 'credit_card' && (
            <>
              <div className="form-group">
                <label htmlFor="pm-limit" className="form-label">Credit limit (₹)</label>
                <input id="pm-limit" className="form-input" inputMode="decimal" value={form.creditLimit} onChange={(e) => set('creditLimit', e.target.value)} />
              </div>
              <div className="parity-grid-2">
                <div className="form-group">
                  <label htmlFor="pm-stmt" className="form-label">Statement day</label>
                  <input id="pm-stmt" className="form-input" inputMode="numeric" placeholder="e.g. 20" value={form.statementDay} onChange={(e) => set('statementDay', e.target.value)} />
                  <span className="parity-hint">Day of the month your bill is generated</span>
                </div>
                <div className="form-group">
                  <label htmlFor="pm-due" className="form-label">Payment due day</label>
                  <input id="pm-due" className="form-input" inputMode="numeric" placeholder="e.g. 10" value={form.dueDay} onChange={(e) => set('dueDay', e.target.value)} />
                  <span className="parity-hint">Day of the month the bill must be paid</span>
                </div>
              </div>
              {!editing && (
                <div className="parity-grid-2">
                  <div className="form-group">
                    <label htmlFor="pm-used" className="form-label">Already used (₹, optional)</label>
                    <input id="pm-used" className="form-input" inputMode="decimal" placeholder="0" value={form.used} onChange={(e) => set('used', e.target.value)} />
                    <span className="parity-hint">Total owed on the card right now</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="pm-billed" className="form-label">Unpaid from last statement (₹)</label>
                    <input id="pm-billed" className="form-input" inputMode="decimal" placeholder="0" value={form.billedUnpaid} onChange={(e) => set('billedUnpaid', e.target.value)} />
                    <span className="parity-hint">Part of it already billed and not yet paid</span>
                  </div>
                </div>
              )}
            </>
          )}
          <div className="modal-footer">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" isLoading={saving}>{editing ? 'Save changes' : 'Add method'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        title={`Remove ${removing?.nickname ?? 'payment method'}?`}
        message="It will no longer appear when you record an expense. Past transactions keep their label."
        warningNote={removing?.kind === 'credit_card' ? 'A credit card can only be removed once its outstanding balance is paid off.' : undefined}
        confirmLabel="Remove"
        variant="danger"
        isLoading={removeBusy}
      />
    </section>
  );
};

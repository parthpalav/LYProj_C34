import crypto from 'crypto';
import PaymentMethod, { PAYMENT_METHOD_KINDS } from '../models/PaymentMethod.js';
import User from '../models/User.js';
import { cardBalanceFields, withCreditSummaries } from '../services/PaymentMethodService.js';

const UPI_ID_RE = /^[a-z0-9._-]{2,256}@[a-z][a-z0-9.-]{1,63}$/i;
const LAST4_RE = /^\d{4}$/;

function bad(res, error) {
  return res.status(400).json({ success: false, error });
}

function isDay(v) {
  return Number.isInteger(v) && v >= 1 && v <= 31;
}

// Validates editable fields for `kind`; returns an error string or the clean fields.
function validateFields(kind, payload, { partial }) {
  const out = {};
  const has = (k) => payload[k] !== undefined;

  if (!partial || has('nickname')) {
    const nickname = typeof payload.nickname === 'string' ? payload.nickname.trim() : '';
    if (!nickname) return 'Nickname is required';
    if (nickname.length > 50) return 'Nickname cannot exceed 50 characters';
    out.nickname = nickname;
  }

  if (kind === 'upi') {
    if (!partial || has('upiId')) {
      const upiId = typeof payload.upiId === 'string' ? payload.upiId.trim().toLowerCase() : '';
      if (!UPI_ID_RE.test(upiId)) return 'Enter a valid UPI ID, e.g. name@okhdfc';
      out.upiId = upiId;
    }
    return out;
  }

  if (!partial || has('last4')) {
    const last4 = String(payload.last4 ?? '').trim();
    if (!LAST4_RE.test(last4)) return 'Enter the last 4 digits of the card';
    out.last4 = last4;
  }

  if (kind === 'credit_card') {
    if (!partial || has('creditLimit')) {
      const creditLimit = Number(payload.creditLimit);
      if (!Number.isFinite(creditLimit) || creditLimit <= 0) return 'Credit limit must be a positive number';
      out.creditLimit = creditLimit;
    }
    for (const key of ['statementDay', 'dueDay']) {
      if (!partial || has(key)) {
        const day = Number(payload[key]);
        if (!isDay(day)) return `${key === 'dueDay' ? 'Due day' : 'Statement day'} must be a whole number from 1 to 31`;
        out[key] = day;
      }
    }
  }
  return out;
}

// Validates a reported card balance: total used and the part still unpaid from
// the latest statement. Returns an error string or { used, billedUnpaid }.
function validateBalance(payload, creditLimit) {
  const used = Number(payload.used ?? 0);
  const billedUnpaid = Number(payload.billedUnpaid ?? 0);
  if (!Number.isFinite(used) || used < 0) return 'Amount used must be 0 or more';
  if (used > creditLimit) return `Amount used cannot exceed the credit limit (${creditLimit})`;
  if (!Number.isFinite(billedUnpaid) || billedUnpaid < 0) return 'Unpaid statement amount must be 0 or more';
  if (billedUnpaid > used) return 'Unpaid statement amount cannot be more than the total used';
  const round2 = (n) => Math.round(n * 100) / 100;
  return { used: round2(used), billedUnpaid: round2(billedUnpaid) };
}

// Archived methods are included so old transactions can still show their label.
export const getPaymentMethods = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const methods = await PaymentMethod.find({ userId }).sort({ createdAt: 1 }).lean();
    res.json({ success: true, data: await withCreditSummaries(userId, methods) });
  } catch (error) { next(error); }
};

export const createPaymentMethod = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const payload = req.body || {};
    if (!PAYMENT_METHOD_KINDS.includes(payload.kind)) {
      return bad(res, 'Type must be one of: ' + PAYMENT_METHOD_KINDS.join(', '));
    }
    const fields = validateFields(payload.kind, payload, { partial: false });
    if (typeof fields === 'string') return bad(res, fields);

    if (payload.kind === 'credit_card' && (payload.used !== undefined || payload.billedUnpaid !== undefined)) {
      const balance = validateBalance(payload, fields.creditLimit);
      if (typeof balance === 'string') return bad(res, balance);
      if (balance.used > 0) {
        Object.assign(fields, await cardBalanceFields(userId, fields, balance.used, balance.billedUnpaid));
      }
    }

    const method = await PaymentMethod.create({ id: crypto.randomUUID(), userId, kind: payload.kind, ...fields });
    const [data] = await withCreditSummaries(userId, [method.toObject()]);
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
};

export const updatePaymentMethod = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const method = await PaymentMethod.findOne({ id: req.params.id, userId, status: 'active' });
    if (!method) return res.status(404).json({ success: false, error: 'Payment method not found' });

    const fields = validateFields(method.kind, req.body || {}, { partial: true });
    if (typeof fields === 'string') return bad(res, fields);
    if (Object.keys(fields).length === 0) return bad(res, 'No editable fields provided');

    const filter = { id: method.id, userId, status: 'active' };
    if (fields.creditLimit !== undefined) {
      // Atomic so a purchase landing mid-edit cannot leave the card over its new limit.
      filter.outstanding = { $lte: fields.creditLimit };
    }
    const updated = await PaymentMethod.findOneAndUpdate(filter, { $set: fields }, { new: true, runValidators: true }).lean();
    if (!updated) return bad(res, `Credit limit cannot be below the amount already used (${method.outstanding})`);

    const [data] = await withCreditSummaries(userId, [updated]);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

// Archives rather than deletes, so past transactions keep their label.
export const deletePaymentMethod = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const archived = await PaymentMethod.findOneAndUpdate(
      { id: req.params.id, userId, status: 'active', $or: [{ kind: { $ne: 'credit_card' } }, { outstanding: { $lte: 0 } }] },
      { $set: { status: 'archived' } },
      { new: true }
    ).lean();
    if (archived) return res.json({ success: true, id: archived.id });

    const exists = await PaymentMethod.exists({ id: req.params.id, userId, status: 'active' });
    if (!exists) return res.status(404).json({ success: false, error: 'Payment method not found' });
    return bad(res, 'Pay off the outstanding balance before removing this card');
  } catch (error) { next(error); }
};

// Sets the used amount on a card to what the user reports (no bank balance change).
export const setCreditCardBalance = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const card = await PaymentMethod.findOne({ id: req.params.id, userId, kind: 'credit_card', status: 'active' }).lean();
    if (!card) return res.status(404).json({ success: false, error: 'Credit card not found' });

    const balance = validateBalance(req.body || {}, card.creditLimit);
    if (typeof balance === 'string') return bad(res, balance);

    const fields = await cardBalanceFields(userId, card, balance.used, balance.billedUnpaid);
    // Matching the old outstanding means a purchase or payment that landed mid-update is not overwritten.
    const updated = await PaymentMethod.findOneAndUpdate(
      { id: card.id, userId, status: 'active', outstanding: card.outstanding },
      { $set: fields },
      { new: true }
    ).lean();
    if (!updated) return res.status(409).json({ success: false, error: 'The card changed while saving. Try again.' });

    const [data] = await withCreditSummaries(userId, [updated]);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

// Pays a credit card bill from the bank balance.
export const payCreditCardBill = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return bad(res, 'Payment amount must be a positive number');

    const card = await PaymentMethod.findOneAndUpdate(
      { id: req.params.id, userId, kind: 'credit_card', status: 'active', outstanding: { $gte: amount } },
      { $inc: { outstanding: -amount } },
      { new: true }
    ).lean();
    if (!card) {
      const exists = await PaymentMethod.findOne({ id: req.params.id, userId, kind: 'credit_card', status: 'active' }).lean();
      if (!exists) return res.status(404).json({ success: false, error: 'Credit card not found' });
      return bad(res, `Payment cannot exceed the outstanding balance (${exists.outstanding})`);
    }

    try {
      await User.findOneAndUpdate({ id: userId }, { $inc: { currentBalance: -amount } });
    } catch (err) {
      await PaymentMethod.findOneAndUpdate({ id: card.id, userId }, { $inc: { outstanding: amount } });
      throw err;
    }

    const [data] = await withCreditSummaries(userId, [card]);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

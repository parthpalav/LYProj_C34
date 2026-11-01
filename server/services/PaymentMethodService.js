import PaymentMethod, { CASH_METHOD_ID } from '../models/PaymentMethod.js';
import Transaction from '../models/Transaction.js';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { balanceAdjustments, creditCardSummary, recentStatementCloses } from '../utils/creditCycle.js';
import { toZoned, fromZoned } from '../utils/userTime.js';
import { getUserTimezone } from './userTimezone.js';

// Same lookup as controllers/index.js userFilter: legacy users may only match on _id.
function userFilter(userId) {
  const conditions = [{ id: userId }];
  if (mongoose.isValidObjectId(userId)) conditions.push({ _id: userId });
  return { $or: conditions };
}

export class PaymentMethodError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Validates a client-supplied paymentMethodId for a new or edited transaction.
// Returns the id to store: null (unspecified, bank), 'cash', or an active method's id.
export async function resolvePaymentMethodId(userId, rawId) {
  if (rawId === undefined || rawId === null || rawId === '') return null;
  if (rawId === CASH_METHOD_ID) return CASH_METHOD_ID;
  const method = await PaymentMethod.findOne({ id: String(rawId), userId: String(userId), status: 'active' }).lean();
  if (!method) throw new PaymentMethodError(400, 'Invalid or inactive payment method');
  return method.id;
}

// The credit card a stored paymentMethodId points at, or null when the money comes
// from the bank balance (unspecified, cash, UPI, debit card). Archived cards count,
// so editing or deleting an old purchase still settles against the right card.
async function creditCardFor(userId, paymentMethodId) {
  if (!paymentMethodId || paymentMethodId === CASH_METHOD_ID) return null;
  return PaymentMethod.findOne({ id: paymentMethodId, userId: String(userId), kind: 'credit_card' }).lean();
}

// Takes `amount` from the transaction's source. Credit card purchases are blocked
// past the limit unless `force` (used only to restore a charge during rollback).
export async function chargeSource(userId, paymentMethodId, amount, { force = false } = {}) {
  const card = await creditCardFor(userId, paymentMethodId);
  if (!card) {
    await User.findOneAndUpdate(userFilter(userId), { $inc: { currentBalance: -amount } });
    return;
  }
  if (!force && card.status !== 'active') {
    throw new PaymentMethodError(400, `${card.nickname} was removed. Pick another payment method.`);
  }
  const filter = { id: card.id, userId: String(userId) };
  if (!force) {
    filter.status = 'active';
    filter.$expr = { $lte: [{ $add: ['$outstanding', amount] }, '$creditLimit'] };
  }
  const updated = await PaymentMethod.findOneAndUpdate(filter, { $inc: { outstanding: amount } });
  if (!updated) {
    const available = Math.max(0, card.creditLimit - card.outstanding);
    throw new PaymentMethodError(400, `Exceeds available credit on ${card.nickname} (available ${available})`);
  }
}

// Gives `amount` back to the transaction's source (edit or delete of a purchase).
export async function refundSource(userId, paymentMethodId, amount) {
  const card = await creditCardFor(userId, paymentMethodId);
  if (!card) {
    await User.findOneAndUpdate(userFilter(userId), { $inc: { currentBalance: amount } });
    return;
  }
  await PaymentMethod.findOneAndUpdate({ id: card.id, userId: String(userId) }, { $inc: { outstanding: -amount } });
}

// Tracked purchases on a card since `zonedFrom`, with zoned timestamps.
async function zonedChargesSince(userId, cardId, zonedFrom, tz) {
  const charges = await Transaction.find(
    { userId: String(userId), paymentMethodId: cardId, timestamp: { $gte: fromZoned(zonedFrom, tz) } },
    { amount: 1, timestamp: 1, _id: 0 }
  ).lean();
  return charges.map((c) => ({ amount: c.amount, timestamp: toZoned(c.timestamp, tz) }));
}

// Fields that set a card's used amount to what the user reports, e.g. debt carried
// from before they started tracking. `card` needs statementDay, and id once saved.
export async function cardBalanceFields(userId, card, used, billedUnpaid, now = new Date()) {
  const tz = await getUserTimezone(userId);
  const zonedNow = toZoned(now, tz);
  const [, prevClose] = recentStatementCloses(card.statementDay, zonedNow);
  const charges = card.id ? await zonedChargesSince(userId, card.id, prevClose, tz) : [];
  const adjustments = balanceAdjustments(card.statementDay, used, billedUnpaid, charges, zonedNow)
    .map((a) => ({ amount: a.amount, timestamp: fromZoned(a.timestamp, tz) }));
  return { outstanding: used, balanceAdjustments: adjustments };
}

// Adds limit/outstanding/due-date figures to credit cards for the API response.
// Cycles run in the user's timezone: dates are zoned for the math, then unzoned.
export async function withCreditSummaries(userId, methods, now = new Date()) {
  if (!methods.some((m) => m.kind === 'credit_card')) return methods;
  const tz = await getUserTimezone(userId);
  const zonedNow = toZoned(now, tz);
  return Promise.all(methods.map(async (m) => {
    if (m.kind !== 'credit_card') return m;
    const [, prevClose] = recentStatementCloses(m.statementDay, zonedNow);
    const charges = await zonedChargesSince(userId, m.id, prevClose, tz);
    const adjustments = (m.balanceAdjustments || []).map((a) => ({ amount: a.amount, timestamp: toZoned(a.timestamp, tz) }));
    const credit = creditCardSummary(m, [...charges, ...adjustments], zonedNow);
    for (const key of ['lastStatementDate', 'dueDate', 'nextStatementDate']) credit[key] = fromZoned(credit[key], tz);
    return { ...m, credit };
  }));
}

export async function totalCreditCardOutstanding(userId) {
  const cards = await PaymentMethod.find({ userId: String(userId), kind: 'credit_card', status: 'active' }, { outstanding: 1 }).lean();
  return cards.reduce((sum, c) => sum + Math.max(0, c.outstanding || 0), 0);
}

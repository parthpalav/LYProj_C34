import mongoose from 'mongoose';

// A user-saved way to pay. Only a nickname and the last 4 digits are kept:
// full card numbers and CVVs are never stored.
export const PAYMENT_METHOD_KINDS = ['upi', 'debit_card', 'credit_card'];

// Built-in mode that needs no saved record; it debits the bank balance like UPI/debit.
export const CASH_METHOD_ID = 'cash';

const dayOfMonth = { type: Number, min: 1, max: 31, default: null };

const paymentMethodSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, immutable: true },
    userId: { type: String, required: true, immutable: true },
    kind: { type: String, required: true, enum: PAYMENT_METHOD_KINDS, immutable: true },
    nickname: { type: String, required: true, trim: true, maxlength: 50 },
    last4: { type: String, default: null, match: /^\d{4}$/ },
    upiId: { type: String, default: null, trim: true, lowercase: true, maxlength: 100 },
    // Credit cards only
    creditLimit: { type: Number, default: null, min: 0 },
    // Amount used on the card and not yet paid back. Can dip below 0 if a paid
    // purchase is later deleted (a credit balance on the card).
    outstanding: { type: Number, default: 0 },
    statementDay: dayOfMonth,
    dueDay: dayOfMonth,
    // Synthetic charges from a balance the user typed in (debt from before they
    // started tracking). They count in billing cycles like purchases but are not
    // transactions, so they never show up in spending.
    balanceAdjustments: { type: [{ amount: Number, timestamp: Date, _id: false }], default: [] },
    status: { type: String, enum: ['active', 'archived'], default: 'active' }
  },
  { timestamps: true, versionKey: false }
);

paymentMethodSchema.index({ userId: 1, status: 1 });

export default mongoose.model('PaymentMethod', paymentMethodSchema);

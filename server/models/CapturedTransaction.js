import mongoose from 'mongoose';

// A bank SMS sent in by the user's iOS Shortcut, waiting for a one-tap confirm.
// The raw SMS is not kept: only the parsed fields and a hash to drop repeats.
const capturedTransactionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, immutable: true },
    userId: { type: String, required: true, immutable: true },
    textHash: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    direction: { type: String, required: true, enum: ['debit', 'credit'] },
    merchant: { type: String, default: null },
    description: { type: String, default: '' },
    date: { type: Date, required: true },
    last4: { type: String, default: null },
    upiId: { type: String, default: null },
    paymentMethodId: { type: String, default: null },
    category: { type: String, default: null },
    type: { type: String, default: null },
    parser: { type: String, default: 'regex' },
    status: { type: String, enum: ['pending', 'confirmed', 'dismissed'], default: 'pending' }
  },
  { timestamps: true, versionKey: false }
);

capturedTransactionSchema.index({ userId: 1, textHash: 1 }, { unique: true });
capturedTransactionSchema.index({ userId: 1, status: 1, createdAt: -1 });

export default mongoose.model('CapturedTransaction', capturedTransactionSchema);

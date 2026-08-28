import mongoose from 'mongoose';

// Canonical FINAURA V3 expense categories
const CANONICAL_V3_CATEGORIES = [
  'Food & Dining', 'Groceries', 'Transport & Travel', 'Housing',
  'Utilities & Bills', 'Debt & Loan Payments', 'Shopping', 'Entertainment',
  'Health', 'Education', 'Personal Care', 'Insurance', 'Investments', 'Misc'
];

// Legacy categories accepted for backward-compatibility with unmigrated historical records
const LEGACY_CATEGORIES = ['Food', 'Travel', 'Bills', 'Party'];

const VALID_CATEGORIES = [...CANONICAL_V3_CATEGORIES, ...LEGACY_CATEGORIES];

// Canonical spend-type classification
const VALID_TYPES = ['Need', 'Want', 'Investment'];

const transactionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, immutable: true },
    userId: { type: String, required: true, immutable: true },
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: (v) => Number.isFinite(v) && v > 0,
        message: 'Amount must be a finite positive number'
      }
    },
    category: {
      type: String,
      required: true,
      enum: {
        values: VALID_CATEGORIES,
        message: 'Category must be one of: ' + VALID_CATEGORIES.join(', ')
      }
    },
    sentiment: { type: String, default: 'neutral' },
    sentimentScore: { type: Number, default: 0, min: -1, max: 1 },
    type: {
      type: String,
      required: true,
      enum: {
        values: VALID_TYPES,
        message: 'Type must be one of: ' + VALID_TYPES.join(', ')
      }
    },
    confidenceScore: { type: Number, min: 0, max: 1, default: 0 },
    description: { type: String, default: '' },
    timestamp: { type: Date, required: true },
    tags: { type: [String], default: [] },
    isAnomaly: { type: Boolean, default: false },
    classificationSource: {
      type: String,
      enum: ['ml', 'merchant_rule', 'tfidf', 'tfidf_v2', 'minilm', 'fallback', 'manual', 'liability', 'unknown'],
      default: 'unknown'
    },
    categorySource: { type: String, default: 'unknown' },
    typeSource: { type: String, default: 'unknown' },
    categoryConfidence: { type: Number, default: 0 },
    typeConfidence: { type: Number, default: 0 },
    needsReview: { type: Boolean, default: false },
    liabilityId: { type: String },
    scheduledFor: { type: Date }
  },
  { timestamps: true, versionKey: false }
);

// Compound index to support time-series by type queries
transactionSchema.index({ timestamp: 1, type: 1 });

// Unique compound index with partial filter to guarantee idempotency for scheduled auto-deduct transactions
transactionSchema.index(
  { liabilityId: 1, scheduledFor: 1 },
  {
    unique: true,
    partialFilterExpression: {
      liabilityId: { $exists: true },
      scheduledFor: { $type: 'date' }
    }
  }
);

// Compound index to support fast liability payment history and summary queries
transactionSchema.index({ userId: 1, liabilityId: 1, timestamp: -1 });

// Export schema constants for use in controllers/validators
export { VALID_CATEGORIES, VALID_TYPES };
export default mongoose.model('Transaction', transactionSchema);

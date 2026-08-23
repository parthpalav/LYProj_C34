import mongoose from 'mongoose';

// Canonical FINAURA expense categories
const VALID_CATEGORIES = [
  'Food', 'Travel', 'Entertainment', 'Shopping', 'Bills',
  'Groceries', 'Health', 'Party', 'Education', 'Misc'
];

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
      enum: ['ml', 'merchant_rule', 'tfidf', 'fallback', 'manual', 'unknown'],
      default: 'unknown'
    }
  },
  { timestamps: true, versionKey: false }
);

// Compound index to support time-series by type queries
transactionSchema.index({ timestamp: 1, type: 1 });

// Export schema constants for use in controllers/validators
export { VALID_CATEGORIES, VALID_TYPES };
export default mongoose.model('Transaction', transactionSchema);

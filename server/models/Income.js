import mongoose from 'mongoose';

const incomeSchema = new mongoose.Schema(
  {
    id:          { type: String, required: true, unique: true },
    userId:      { type: String, required: true },
    amount:      { type: Number, required: true },
    source:      { type: String, default: 'salary' },
    description: { type: String, default: '' },
    timestamp:   { type: Date, required: true },
    // Set only on rows created by a bank statement import (history only, never touched balances)
    importBatchId: { type: String, default: null },
    importHash:    { type: String, default: null }
  },
  { versionKey: false }
);

// Compound index to support fast user and household date-range time-series queries
incomeSchema.index({ userId: 1, timestamp: -1 });

incomeSchema.index(
  { userId: 1, importHash: 1 },
  { unique: true, partialFilterExpression: { importHash: { $type: 'string' } } }
);
incomeSchema.index({ userId: 1, importBatchId: 1 }, { partialFilterExpression: { importBatchId: { $type: 'string' } } });

export default mongoose.model('Income', incomeSchema);

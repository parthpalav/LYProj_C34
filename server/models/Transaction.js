import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    sentiment: { type: String, default: 'neutral' },
    type: { type: String, enum: ['Need', 'Want', 'Investment'], required: true },
    confidenceScore: { type: Number, min: 0, max: 1, default: 0 },
    description: { type: String, default: '' },
    timestamp: { type: Date, required: true }
  },
  { versionKey: false }
);

// Compound index to support time-series by type queries
transactionSchema.index({ timestamp: 1, type: 1 });

export default mongoose.model('Transaction', transactionSchema);

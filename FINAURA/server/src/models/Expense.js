import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    description: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
    classification: { type: String, enum: ['NEED', 'WANT', 'INVESTMENT'], required: true },
    confidence: { type: Number, min: 0, max: 1, default: 0.5 },
    reasons: { type: [String], default: [] }
  },
  { timestamps: true }
);

expenseSchema.index({ userId: 1, timestamp: -1 });

export default mongoose.model('Expense', expenseSchema);

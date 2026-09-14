import mongoose from 'mongoose';

const incomeSchema = new mongoose.Schema(
  {
    id:          { type: String, required: true, unique: true },
    userId:      { type: String, required: true },
    amount:      { type: Number, required: true },
    source:      { type: String, default: 'salary' },
    description: { type: String, default: '' },
    timestamp:   { type: Date, required: true }
  },
  { versionKey: false }
);

// Compound index to support fast user and household date-range time-series queries
incomeSchema.index({ userId: 1, timestamp: -1 });

export default mongoose.model('Income', incomeSchema);

import mongoose from 'mongoose';

const fmiHistorySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    score: { type: Number, required: true },
    factors: { type: [String], default: [] },
    timestamp: { type: Date, required: true },
    snapshotDate: { type: String, default: null } // "YYYY-MM-DD" UTC date key for daily idempotency
  },
  { versionKey: false }
);

// Unique compound index for daily idempotency (partialFilterExpression ensures legacy records without snapshotDate are not indexed)
fmiHistorySchema.index(
  { userId: 1, snapshotDate: 1 },
  { unique: true, partialFilterExpression: { snapshotDate: { $type: 'string' } } }
);

export default mongoose.model('FMIHistory', fmiHistorySchema);

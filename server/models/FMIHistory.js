import mongoose from 'mongoose';

const fmiHistorySchema = new mongoose.Schema(
  {
    score: { type: Number, required: true },
    factors: { type: [String], default: [] },
    timestamp: { type: Date, required: true }
  },
  { versionKey: false }
);

export default mongoose.model('FMIHistory', fmiHistorySchema);

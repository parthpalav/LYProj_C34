import mongoose from 'mongoose';

const fmiSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, required: true },
    band: { type: String, required: true },
    dimensions: {
      D1: { type: Number, required: true },
      D2: { type: Number, required: true },
      D3: { type: Number, required: true },
      D4: { type: Number, required: true },
      D5: { type: Number, required: true }
    },
    reasons: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

fmiSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('FMI', fmiSchema);

import mongoose from 'mongoose';

const envelopeSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    rent: { type: Number, required: true },
    food: { type: Number, required: true },
    savings: { type: Number, required: true },
    targetSavings: { type: Number, required: true }
  },
  { versionKey: false }
);

export default mongoose.model('Envelope', envelopeSchema);

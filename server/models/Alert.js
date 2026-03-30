import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, required: true },
    severity: { type: String, required: true }
  },
  { versionKey: false }
);

export default mongoose.model('Alert', alertSchema);

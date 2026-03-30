import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    incomeType: { type: String, required: true },
    goals: { type: [String], default: [] }
  },
  { versionKey: false }
);

export default mongoose.model('User', userSchema);

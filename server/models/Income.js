import mongoose from 'mongoose';

const incomeSchema = new mongoose.Schema(
  {
    id:          { type: String, required: true, unique: true },
    userId:      { type: String, required: true },
    amount:      { type: Number, required: true },
    source:      { type: String, enum: ['salary', 'gig', 'freelance', 'other'], default: 'salary' },
    description: { type: String, default: '' },
    timestamp:   { type: Date, required: true }
  },
  { versionKey: false }
);

export default mongoose.model('Income', incomeSchema);

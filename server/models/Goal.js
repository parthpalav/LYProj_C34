import mongoose from 'mongoose';

const goalSchema = new mongoose.Schema(
  {
    id:                  { type: String, required: true, unique: true },
    userId:              { type: String, required: true },
    name:                { type: String, required: true },
    emoji:               { type: String, default: '🎯' },
    targetAmount:        { type: Number, required: true },
    savedAmount:         { type: Number, default: 0 },
    targetDate:          { type: String, default: '' },
    monthlyContribution: { type: Number, default: 0 },
    createdAt:           { type: Date, default: Date.now }
  },
  { versionKey: false }
);

export default mongoose.model('Goal', goalSchema);

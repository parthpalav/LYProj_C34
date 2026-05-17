import mongoose from 'mongoose';

const goalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    deadline: { type: Date },
    priority: { type: Number, default: 3 }
  },
  { timestamps: true }
);

export default mongoose.model('Goal', goalSchema);

import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: String, enum: ['user', 'bot'], required: true },
    message: { type: String, required: true },
    response: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

chatMessageSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('ChatMessage', chatMessageSchema);

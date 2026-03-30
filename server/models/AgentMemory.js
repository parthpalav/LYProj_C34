import mongoose from 'mongoose';

const agentMemorySchema = new mongoose.Schema(
  {
    userId:    { type: String, required: true },
    role:      { type: String, enum: ['user', 'assistant'], required: true },
    content:   { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

export default mongoose.model('AgentMemory', agentMemorySchema);

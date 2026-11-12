import mongoose from 'mongoose';

const agentMemorySchema = new mongoose.Schema(
  {
    userId:    { type: String, required: true },
    // Conversation this turn belongs to. Turns saved before sessions existed have none.
    sessionId: { type: String, index: true },
    role:      { type: String, enum: ['user', 'assistant'], required: true },
    content:   { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

export default mongoose.model('AgentMemory', agentMemorySchema);

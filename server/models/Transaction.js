const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    sentiment: { type: String, default: 'neutral' },
    description: { type: String, default: '' },
    timestamp: { type: Date, required: true }
  },
  { versionKey: false }
);

module.exports = mongoose.model('Transaction', transactionSchema);

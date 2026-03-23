const mongoose = require('mongoose');

const fmiHistorySchema = new mongoose.Schema(
  {
    score: { type: Number, required: true },
    factors: { type: [String], default: [] },
    timestamp: { type: Date, required: true }
  },
  { versionKey: false }
);

module.exports = mongoose.model('FMIHistory', fmiHistorySchema);

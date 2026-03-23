const mongoose = require('mongoose');

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

module.exports = mongoose.model('Alert', alertSchema);

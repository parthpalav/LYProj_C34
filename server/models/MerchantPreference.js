import mongoose from 'mongoose';

// Per-user memory of how a merchant was labelled by the user. Written on manual
// corrections, read before ML so the same merchant is never asked about twice.
const merchantPreferenceSchema = new mongoose.Schema(
  {
    userId:      { type: String, required: true },
    merchantKey: { type: String, required: true },
    category:    { type: String, required: true },
    type:        { type: String, required: true },
    hits:        { type: Number, default: 1 }
  },
  { timestamps: true, versionKey: false }
);

merchantPreferenceSchema.index({ userId: 1, merchantKey: 1 }, { unique: true });

export default mongoose.model('MerchantPreference', merchantPreferenceSchema);

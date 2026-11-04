import mongoose from 'mongoose';

const assetSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    assetType: { type: String, required: true }, // e.g. Equity, Mutual Fund, Gold, Real Estate, Cash
    assetClass: {
      type: String,
      required: true,
      enum: ['FIRE_INVESTABLE', 'SEMI_LIQUID', 'NON_INVESTABLE']
    },
    currentValue: {
      type: Number,
      required: true,
      validate: {
        validator: (v) => Number.isFinite(v) && v >= 0,
        message: 'Current value must be a non-negative finite number'
      }
    },
    annualReturnRate: {
      type: Number,
      default: null,
      validate: {
        validator: (v) => v === null || v === undefined || (Number.isFinite(v) && v >= 0 && v <= 1),
        message: 'Annual return rate must be a decimal fraction between 0 and 1'
      }
    },
    includedInFireCorpus: {
      type: Boolean,
      default: false
    },
    // SIP amount for market assets; installment for a Recurring Deposit.
    monthlyContribution: {
      type: Number,
      default: null,
      validate: {
        validator: (v) => v === null || v === undefined || (Number.isFinite(v) && v >= 0),
        message: 'Monthly contribution must be a non-negative finite number'
      }
    },
    // FD / RD only: with annualReturnRate these let the server compute currentValue (utils/fixedIncome.js).
    principal: { type: Number, default: null },
    startDate: { type: Date, default: null },
    tenureMonths: { type: Number, default: null },
    // Last time the user confirmed value and return; drives the monthly review prompt for market assets.
    lastReviewedAt: { type: Date, default: null },
    liquidity: { type: String, default: 'liquid' }, // e.g. liquid, locked, restricted
    notes: { type: String, default: '' }
  },
  { timestamps: true, versionKey: false }
);

assetSchema.index({ userId: 1 });

assetSchema.pre('validate', function(next) {
  if (this.assetClass === 'NON_INVESTABLE' && this.includedInFireCorpus) {
    this.invalidate('includedInFireCorpus', 'Non-investable assets cannot be included in the FIRE corpus');
  }
  next();
});

export default mongoose.model('Asset', assetSchema);

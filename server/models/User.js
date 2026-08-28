import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import {
  DEFAULT_RETURN_RATE,
  DEFAULT_INFLATION_RATE,
  DEFAULT_WITHDRAWAL_RATE,
  DEFAULT_LIFESTYLE_RATIO,
  DEFAULT_EMERGENCY_MONTHS
} from '../config/financialRules.js';



const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: false },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: false, select: false },
    passwordHash: { type: String, required: false, select: false },
    isEmailVerified: { type: Boolean, default: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    dateOfBirth: { type: Date, default: null },
    age: { type: Number, default: null },
    retirementAge: { type: Number, default: null, min: 40, max: 100 },
    monthlyIncome: { type: Number, default: null },
    income: { type: Number, default: 0 },
    incomeType: { type: String, default: 'salaried' },
    retirementCorpusGoal: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    expectedReturnRate: {
      type: Number,
      default: DEFAULT_RETURN_RATE,
      validate: {
        validator: (v) => Number.isFinite(v) && v >= 0 && v <= 1,
        message: 'Expected return rate must be a decimal fraction between 0 and 1'
      }
    },
    expectedInflationRate: {
      type: Number,
      default: DEFAULT_INFLATION_RATE,
      validate: {
        validator: (v) => Number.isFinite(v) && v >= 0 && v <= 1,
        message: 'Expected inflation rate must be a decimal fraction between 0 and 1'
      }
    },
    expectedWithdrawalRate: {
      type: Number,
      default: DEFAULT_WITHDRAWAL_RATE,
      validate: {
        validator: (v) => Number.isFinite(v) && v >= 0 && v <= 1,
        message: 'Expected withdrawal rate must be a decimal fraction between 0 and 1'
      }
    },
    lifestyleAdjustmentRatio: {
      type: Number,
      default: DEFAULT_LIFESTYLE_RATIO,
      validate: {
        validator: (v) => Number.isFinite(v) && v >= 0 && v <= 2,
        message: 'Lifestyle adjustment ratio must be a decimal fraction between 0 and 2'
      }
    },
    emergencyFundTargetMonths: {
      type: Number,
      default: DEFAULT_EMERGENCY_MONTHS,
      validate: {
        validator: (v) => Number.isInteger(v) && v >= 0 && v <= 36,
        message: 'Emergency fund target months must be an integer between 0 and 36'
      }
    },
    goals: { type: [String], default: [] },
    processedLiabilityOccurrences: { type: [String], default: [] },
    onboardingComplete: { type: Boolean, default: false },
    onboardingCompleted: { type: Boolean, default: false }
  },
  { timestamps: true, versionKey: false }
);

// Hash password before saving if plain text password is set (avoid double hashing)
userSchema.pre('save', async function(next) {
  if (this.isModified('password') && this.password) {
    if (!this.password.startsWith('$2a$') && !this.password.startsWith('$2b$') && !this.password.startsWith('$2y$')) {
      try {
        const salt = await bcryptjs.genSalt(10);
        const hash = await bcryptjs.hash(this.password, salt);
        this.password = hash;
        this.passwordHash = hash;
      } catch (error) {
        return next(error);
      }
    } else {
      this.passwordHash = this.password;
    }
  } else if (this.isModified('passwordHash') && this.passwordHash) {
    this.password = this.passwordHash;
  }
  next();
});

// Method to compare passwords (supports both password and passwordHash fields)
userSchema.methods.comparePassword = async function(plainPassword) {
  const hash = this.password || this.passwordHash;
  if (!hash) return false;
  return bcryptjs.compare(plainPassword, hash);
};

export default mongoose.model('User', userSchema);

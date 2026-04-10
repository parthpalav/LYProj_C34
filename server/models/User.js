import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    dateOfBirth: { type: Date, default: null },
    retirementAge: { type: Number, default: null, min: 40, max: 100 },
    monthlyIncome: { type: Number, default: null },
    onboardingComplete: { type: Boolean, default: false },
    incomeType: { type: String, required: true },
    goals: { type: [String], default: [] },
    currentBalance: { type: Number, default: 0 }
  },
  { versionKey: false }
);

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(plainPassword) {
  return bcryptjs.compare(plainPassword, this.password);
};

export default mongoose.model('User', userSchema);

import mongoose from 'mongoose';

const obligationSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    amount: { type: Number, required: true }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    age: { type: Number, default: null },
    income: { type: Number, default: 0 },
    incomeType: { type: String, default: 'salaried' },
    retirementAge: { type: Number, default: null },
    retirementCorpusGoal: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    fixedObligations: { type: [obligationSchema], default: [] },
    onboardingCompleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);

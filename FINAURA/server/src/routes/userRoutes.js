import { Router } from 'express';
import User from '../models/User.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

router.post('/onboarding', async (req, res) => {
  const userId = req.user.id;
  const payload = req.body || {};

  const updated = await User.findByIdAndUpdate(
    userId,
    {
      age: payload.age,
      income: payload.income,
      incomeType: payload.incomeType,
      retirementAge: payload.retirementAge,
      retirementCorpusGoal: payload.retirementCorpusGoal,
      currentBalance: payload.currentBalance,
      fixedObligations: payload.fixedObligations || [],
      onboardingCompleted: true
    },
    { new: true }
  );

  res.json({ user: updated });
});

router.get('/profile', async (req, res) => {
  const userId = req.user.id;
  const user = await User.findById(userId).lean();
  res.json(user);
});

router.put('/balance', async (req, res) => {
  const userId = req.user.id;
  const { currentBalance } = req.body || {};
  const updated = await User.findByIdAndUpdate(userId, { currentBalance }, { new: true });
  res.json({ balance: updated.currentBalance });
});

export default router;

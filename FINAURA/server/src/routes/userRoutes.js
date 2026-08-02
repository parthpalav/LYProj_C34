import { Router } from 'express';
import User from '../models/User.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { stripUser } from '../services/authService.js';

const router = Router();

router.use(authMiddleware);

router.post('/onboarding', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const payload = req.body || {};

    const updated = await User.findByIdAndUpdate(
      userId,
      {
        age: payload.age !== undefined ? Number(payload.age) : undefined,
        income: payload.income !== undefined ? Number(payload.income) : undefined,
        incomeType: payload.incomeType ? String(payload.incomeType).trim() : undefined,
        retirementAge: payload.retirementAge !== undefined ? Number(payload.retirementAge) : undefined,
        retirementCorpusGoal: payload.retirementCorpusGoal !== undefined ? Number(payload.retirementCorpusGoal) : undefined,
        currentBalance: payload.currentBalance !== undefined ? Number(payload.currentBalance) : undefined,
        fixedObligations: Array.isArray(payload.fixedObligations) ? payload.fixedObligations : [],
        onboardingCompleted: true
      },
      { new: true }
    );

    return res.json({ success: true, user: stripUser(updated) });
  } catch (error) {
    next(error);
  }
});

router.get('/profile', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, user: stripUser(user) });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const payload = req.body || {};

    const updateFields = {};
    if (payload.name !== undefined) updateFields.name = String(payload.name).trim();
    if (payload.age !== undefined) updateFields.age = Number(payload.age);
    if (payload.income !== undefined) updateFields.income = Number(payload.income);
    if (payload.incomeType !== undefined) updateFields.incomeType = String(payload.incomeType).trim();
    if (payload.retirementAge !== undefined) updateFields.retirementAge = Number(payload.retirementAge);
    if (payload.retirementCorpusGoal !== undefined) updateFields.retirementCorpusGoal = Number(payload.retirementCorpusGoal);
    if (payload.currentBalance !== undefined) updateFields.currentBalance = Number(payload.currentBalance);
    if (Array.isArray(payload.fixedObligations)) updateFields.fixedObligations = payload.fixedObligations;

    const updated = await User.findByIdAndUpdate(userId, updateFields, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, message: 'Profile updated successfully', user: stripUser(updated) });
  } catch (error) {
    next(error);
  }
});

router.put('/balance', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { currentBalance } = req.body || {};
    const updated = await User.findByIdAndUpdate(userId, { currentBalance: Number(currentBalance) }, { new: true });
    return res.json({ success: true, balance: updated.currentBalance, user: stripUser(updated) });
  } catch (error) {
    next(error);
  }
});

export default router;

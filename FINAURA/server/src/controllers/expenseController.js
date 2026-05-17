import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import User from '../models/User.js';
import { classifyExpense } from '../services/expenseClassificationService.js';
import { buildBaseline } from '../services/baselineService.js';
import { startOfMonth, endOfMonth } from '../utils/dateUtils.js';

export async function createExpense(req, res) {
  const userId = req.user.id;
  const { amount, category, description, timestamp } = req.body || {};

  if (!amount || !category) {
    return res.status(400).json({ message: 'Amount and category are required' });
  }

  const user = await User.findById(userId);
  const history = await Expense.find({ userId }).sort({ timestamp: -1 }).limit(120).lean();
  const baseline = buildBaseline(history, user);
  const classification = classifyExpense({
    expense: { amount, category, description, timestamp },
    user,
    baseline,
    history
  });

  const expense = await Expense.create({
    userId,
    amount,
    category,
    description: description || '',
    timestamp: timestamp ? new Date(timestamp) : new Date(),
    classification: classification.label,
    confidence: classification.confidence,
    reasons: classification.reasons
  });

  res.status(201).json(expense);
}

export async function getExpenses(req, res) {
  const userId = req.user.id;
  const expenses = await Expense.find({ userId }).sort({ timestamp: -1 });
  res.json(expenses);
}

export async function getMonthlySummary(req, res) {
  const userId = req.user.id;
  const start = startOfMonth();
  const end = endOfMonth();

  const agg = await Expense.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), timestamp: { $gte: start, $lte: end } } },
    { $group: { _id: '$classification', total: { $sum: '$amount' } } }
  ]);

  const summary = { NEED: 0, WANT: 0, INVESTMENT: 0 };
  agg.forEach((row) => { summary[row._id] = row.total; });
  res.json(summary);
}

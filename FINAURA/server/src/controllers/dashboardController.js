import Expense from '../models/Expense.js';
import User from '../models/User.js';
import FMI from '../models/FMI.js';
import { buildBaseline } from '../services/baselineService.js';
import { computeFmi } from '../services/fmiService.js';
import { evaluateRetirementGoal } from '../services/retirementGoalService.js';
import { buildRecommendations } from '../services/recommendationService.js';
import { startOfMonth, endOfMonth } from '../utils/dateUtils.js';

export async function getDashboard(req, res) {
  const userId = req.user.id;
  const user = await User.findById(userId);
  const expenses = await Expense.find({ userId }).sort({ timestamp: -1 });
  const baseline = buildBaseline(expenses, user);
  const previous = await FMI.findOne({ userId }).sort({ createdAt: -1 });

  const fmiData = computeFmi({ user, expenses, currentBalance: user.currentBalance, previousFmi: previous });
  const retirement = evaluateRetirementGoal(user);

  const start = startOfMonth();
  const end = endOfMonth();
  const monthly = expenses.filter((e) => e.timestamp >= start && e.timestamp <= end);
  const monthlySplit = monthly.reduce((acc, e) => {
    acc[e.classification] = (acc[e.classification] || 0) + e.amount;
    return acc;
  }, { NEED: 0, WANT: 0, INVESTMENT: 0 });

  const recommendations = buildRecommendations({
    user,
    retirement,
    fmi: baseline.ready ? fmiData : null,
    monthlySplit
  });

  const recentAlerts = [];
  if (monthlySplit.WANT > monthlySplit.NEED) {
    recentAlerts.push('Wants spending is higher than needs this month.');
  }
  if (fmiData.reasons?.length) {
    recentAlerts.push(...fmiData.reasons.slice(0, 2));
  }

  res.json({
    balance: user.currentBalance,
    retirement,
    fmi: baseline.ready ? { score: fmiData.score, band: fmiData.band, dimensions: fmiData.dimensions } : null,
    learning: { progress: baseline.progress, phase: baseline.phase, ready: baseline.ready },
    monthlySplit,
    recentAlerts,
    nextActions: recommendations,
    recentExpenses: expenses.slice(0, 5)
  });
}

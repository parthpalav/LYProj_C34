import ChatMessage from '../models/ChatMessage.js';
import Expense from '../models/Expense.js';
import User from '../models/User.js';
import { buildBaseline } from '../services/baselineService.js';
import { computeFmi } from '../services/fmiService.js';
import { generateChatbotResponse } from '../services/chatbotBrainService.js';
import { startOfMonth, endOfMonth } from '../utils/dateUtils.js';

export async function postMessage(req, res) {
  const userId = req.user.id;
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ message: 'Message required' });

  const user = await User.findById(userId);
  const expenses = await Expense.find({ userId }).sort({ timestamp: -1 });
  const baseline = buildBaseline(expenses, user);
  const fmiData = computeFmi({ user, expenses, currentBalance: user.currentBalance });
  const fmi = fmiData.baseline.ready
    ? fmiData
    : { score: null, band: 'Learning', reasons: [] };

  const start = startOfMonth();
  const end = endOfMonth();
  const monthly = expenses.filter((e) => e.timestamp >= start && e.timestamp <= end);
  const monthlySplit = monthly.reduce((acc, e) => {
    acc[e.classification] = (acc[e.classification] || 0) + e.amount;
    return acc;
  }, { NEED: 0, WANT: 0, INVESTMENT: 0 });

  const response = generateChatbotResponse({ user, message, baseline, fmi, monthlySplit });

  await ChatMessage.create({ userId, sender: 'user', message, response });
  res.json({ message, response });
}

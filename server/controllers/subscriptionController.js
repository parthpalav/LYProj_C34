import Liability from '../models/Liability.js';
import Transaction from '../models/Transaction.js';
import { detectRecurring } from '../services/SubscriptionService.js';

const LOOKBACK_DAYS = 120;

export const getSubscriptionSuggestions = async (req, res, next) => {
  try {
    const userId = String(req.user.id || req.user._id);
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const [transactions, liabilities] = await Promise.all([
      Transaction.find({ userId, timestamp: { $gte: since } }).select('description amount timestamp category type liabilityId').lean(),
      Liability.find({ userId, status: 'active' }).select('name').lean(),
    ]);
    res.json({ success: true, data: detectRecurring(transactions, liabilities) });
  } catch (error) {
    next(error);
  }
};

import Transaction from '../models/Transaction.js';
import { getUserTimezone } from '../services/userTimezone.js';
import { buildBaskets, mineRules, predictPurchases, MIN_BASKETS } from '../services/PurchasePredictionService.js';
import { logger } from '../utils/logger.js';

const LOOKBACK_DAYS = 180;

/** GET /api/predictions/purchases — Apriori association rules over the last 180 days of purchases. */
export const getPurchasePredictions = async (req, res, next) => {
  try {
    const userId = String(req.user.id || req.user._id);
    const tz = await getUserTimezone(userId);
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const transactions = await Transaction.find({ userId, timestamp: { $gte: since } })
      .select('description amount timestamp category type classificationSource liabilityId')
      .lean();

    const history = buildBaskets(transactions, tz);
    if (history.baskets.length < MIN_BASKETS) {
      return res.json({ success: true, data: { available: false, reason: 'NOT_ENOUGH_HISTORY', basketCount: history.baskets.length, minBaskets: MIN_BASKETS } });
    }

    let mined;
    try {
      mined = await mineRules(history.baskets);
    } catch (e) {
      logger.warn(`[predictions] association-rules unavailable: ${e.message}`);
      return res.json({ success: true, data: { available: false, reason: 'SERVICE_UNAVAILABLE', basketCount: history.baskets.length } });
    }
    res.json({ success: true, data: predictPurchases(mined.rules, history, { tz }) });
  } catch (error) {
    next(error);
  }
};

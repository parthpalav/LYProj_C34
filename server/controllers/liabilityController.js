import crypto from 'crypto';
import Liability from '../models/Liability.js';
import Transaction from '../models/Transaction.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_TIMEZONE, toZoned, fromZoned } from '../utils/userTime.js';
import { getUserTimezone } from '../services/userTimezone.js';

function userFilter(userId) {
  return { userId: String(userId) };
}

/** Optional loan details (outstanding principal, interest rate in % or fraction, months left). Returns { fields } or { error }. */
function parseLoanFields(payload) {
  const fields = {};
  const blank = (v) => v === null || v === '';
  if (payload.outstandingBalance !== undefined) {
    const v = blank(payload.outstandingBalance) ? null : Number(payload.outstandingBalance);
    if (v !== null && !(Number.isFinite(v) && v >= 0)) return { error: 'Outstanding balance must be a non-negative number' };
    fields.outstandingBalance = v;
  }
  if (payload.interestRate !== undefined) {
    const v = blank(payload.interestRate) ? null : Number(payload.interestRate);
    if (v !== null && !(Number.isFinite(v) && v >= 0 && v <= 100)) return { error: 'Interest rate must be between 0% and 100%' };
    fields.interestRate = v === null ? null : v > 1 ? v / 100 : v;
  }
  if (payload.remainingTermMonths !== undefined) {
    const v = blank(payload.remainingTermMonths) ? null : Number(payload.remainingTermMonths);
    if (v !== null && !(Number.isInteger(v) && v >= 0)) return { error: 'Remaining term must be a whole number of months' };
    fields.remainingTermMonths = v;
  }
  return { fields };
}

export const getLiabilities = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const liabilities = await Liability.find({ ...userFilter(userId), status: 'active' }).sort({ createdAt: -1 });
    res.json({ success: true, data: liabilities });
  } catch (error) {
    next(error);
  }
};

export const createLiability = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const payload = req.body || {};

    if (!payload.name || typeof payload.name !== 'string' || !payload.name.trim()) {
      return res.status(400).json({ success: false, error: 'Liability name is required' });
    }
    if (payload.name.trim().length > 100) {
      return res.status(400).json({ success: false, error: 'Liability name cannot exceed 100 characters' });
    }

    const numAmount = Number(payload.amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be a finite positive number' });
    }

    const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];
    if (!payload.frequency || !VALID_FREQUENCIES.includes(payload.frequency)) {
      return res.status(400).json({ success: false, error: 'Frequency must be one of: ' + VALID_FREQUENCIES.join(', ') });
    }

    if (!payload.startDate || isNaN(new Date(payload.startDate).getTime())) {
      return res.status(400).json({ success: false, error: 'Valid startDate is required' });
    }

    const loan = parseLoanFields(payload);
    if (loan.error) {
      return res.status(400).json({ success: false, error: loan.error });
    }

    const newLiability = new Liability({
      id: crypto.randomUUID(),
      userId: String(userId),
      name: payload.name.trim(),
      amount: numAmount,
      category: payload.category,
      type: payload.type,
      autoDeduct: payload.autoDeduct || false,
      frequency: payload.frequency,
      startDate: new Date(payload.startDate),
      dayOfWeek: payload.dayOfWeek,
      dayOfMonth: payload.dayOfMonth,
      monthOfYear: payload.monthOfYear,
      nextDueDate: null, // Will be calculated by scheduler or initially
      status: 'active',
      ...loan.fields
    });

    // We can pre-calculate nextDueDate or let the scheduler do it.
    // It's safer to pre-calculate it now so the UI shows it immediately.
    newLiability.nextDueDate = calculateNextDueDate(newLiability, new Date(), await getUserTimezone(userId), { inclusive: true });

    await newLiability.save();
    res.status(201).json({ success: true, data: newLiability });
  } catch (error) {
    next(error);
  }
};

export const updateLiability = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;
    const payload = req.body;

    const liability = await Liability.findOne({ id, ...userFilter(userId), status: 'active' });
    if (!liability) {
      return res.status(404).json({ success: false, message: 'Liability not found' });
    }

    // Only update allowed fields
    if (payload.name !== undefined) {
      if (typeof payload.name !== 'string' || !payload.name.trim()) {
        return res.status(400).json({ success: false, error: 'Liability name cannot be empty' });
      }
      if (payload.name.trim().length > 100) {
        return res.status(400).json({ success: false, error: 'Liability name cannot exceed 100 characters' });
      }
      liability.name = payload.name.trim();
    }
    if (payload.amount !== undefined) {
      const numAmount = Number(payload.amount);
      if (!Number.isFinite(numAmount) || numAmount <= 0) {
        return res.status(400).json({ success: false, error: 'Amount must be a finite positive number' });
      }
      liability.amount = numAmount;
    }
    const loan = parseLoanFields(payload);
    if (loan.error) {
      return res.status(400).json({ success: false, error: loan.error });
    }
    liability.set(loan.fields);
    if (payload.category !== undefined) liability.category = payload.category;
    if (payload.type !== undefined) liability.type = payload.type;
    
    let frequencyChanged = false;
    if (payload.frequency !== undefined) {
      const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];
      if (!VALID_FREQUENCIES.includes(payload.frequency)) {
        return res.status(400).json({ success: false, error: 'Frequency must be one of: ' + VALID_FREQUENCIES.join(', ') });
      }
      if (payload.frequency !== liability.frequency) {
        liability.frequency = payload.frequency;
        frequencyChanged = true;
      }
    }
    if (payload.startDate !== undefined) {
      const newStartDate = new Date(payload.startDate);
      if (newStartDate.getTime() !== liability.startDate.getTime()) {
        liability.startDate = newStartDate;
        frequencyChanged = true;
      }
    }
    if (payload.dayOfWeek !== undefined) {
      liability.dayOfWeek = payload.dayOfWeek;
      frequencyChanged = true;
    }
    if (payload.dayOfMonth !== undefined) {
      liability.dayOfMonth = payload.dayOfMonth;
      frequencyChanged = true;
    }
    if (payload.monthOfYear !== undefined) {
      liability.monthOfYear = payload.monthOfYear;
      frequencyChanged = true;
    }

    // If autoDeduct is toggled
    if (payload.autoDeduct !== undefined) {
      const prevAutoDeduct = liability.autoDeduct;
      liability.autoDeduct = payload.autoDeduct;
      
      if (!prevAutoDeduct && payload.autoDeduct) {
        // Re-enabled: calculate next due date from NOW
        liability.nextDueDate = calculateNextDueDate(liability, new Date(), await getUserTimezone(userId), { inclusive: true });
      }
    }

    if (frequencyChanged && liability.autoDeduct) {
      liability.nextDueDate = calculateNextDueDate(liability, new Date(), await getUserTimezone(userId), { inclusive: true });
    }

    await liability.save();
    res.json({ success: true, data: liability });
  } catch (error) {
    next(error);
  }
};

export const deleteLiability = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;

    const liability = await Liability.findOne({ id, ...userFilter(userId), status: 'active' });
    if (!liability) {
      return res.status(404).json({ success: false, message: 'Liability not found' });
    }

    liability.status = 'deleted';
    liability.autoDeduct = false; // Stop deductions
    liability.nextDueDate = null;
    await liability.save();

    res.json({ success: true, message: 'Liability deleted' });
  } catch (error) {
    next(error);
  }
};

export const getLiabilitiesPaymentsSummary = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const summaries = await Transaction.aggregate([
      {
        $match: {
          userId: String(userId),
          liabilityId: { $exists: true, $ne: null }
        }
      },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$liabilityId',
          paymentCount: { $sum: 1 },
          totalPaid: { $sum: '$amount' },
          lastPaymentAmount: { $first: '$amount' },
          lastPaymentDate: { $first: '$timestamp' }
        }
      }
    ]);

    const summaryMap = {};
    for (const s of summaries) {
      if (s._id) {
        summaryMap[s._id] = {
          paymentCount: s.paymentCount,
          totalPaid: s.totalPaid,
          lastPaymentAmount: s.lastPaymentAmount,
          lastPaymentDate: s.lastPaymentDate
        };
      }
    }

    res.json({ success: true, data: summaryMap });
  } catch (error) {
    next(error);
  }
};

export const getLiabilityTransactions = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;

    // Verify liability belongs to the authenticated user (including soft-deleted)
    const liability = await Liability.findOne({ id, ...userFilter(userId) });
    if (!liability) {
      return res.status(404).json({ success: false, message: 'Liability not found' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [transactions, totalCount, summaryAgg] = await Promise.all([
      Transaction.find({ userId: String(userId), liabilityId: id })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments({ userId: String(userId), liabilityId: id }),
      Transaction.aggregate([
        { $match: { userId: String(userId), liabilityId: id } },
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: null,
            totalPaid: { $sum: '$amount' },
            paymentCount: { $sum: 1 },
            lastPaymentAmount: { $first: '$amount' },
            lastPaymentDate: { $first: '$timestamp' }
          }
        }
      ])
    ]);

    const summary = summaryAgg.length > 0 ? {
      totalPaid: summaryAgg[0].totalPaid,
      paymentCount: summaryAgg[0].paymentCount,
      lastPaymentAmount: summaryAgg[0].lastPaymentAmount,
      lastPaymentDate: summaryAgg[0].lastPaymentDate
    } : {
      totalPaid: 0,
      paymentCount: 0,
      lastPaymentAmount: null,
      lastPaymentDate: null
    };

    res.json({
      success: true,
      data: {
        liability: {
          id: liability.id,
          name: liability.name,
          amount: liability.amount,
          category: liability.category,
          type: liability.type,
          frequency: liability.frequency,
          autoDeduct: liability.autoDeduct,
          status: liability.status
        },
        transactions: transactions.map(tx => ({
          id: tx.id,
          amount: tx.amount,
          category: tx.category,
          type: tx.type,
          description: tx.description,
          timestamp: tx.timestamp,
          classificationSource: tx.classificationSource,
          liabilityId: tx.liabilityId,
          scheduledFor: tx.scheduledFor
        })),
        summary,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Helper for recurrence. Due dates fall at 00:00 in the user's timezone `tz`.
//   inclusive: false (default) -> first occurrence strictly after fromDate's day. Used after a
//              charge, where fromDate is the occurrence just processed.
//   inclusive: true            -> today's day counts. Used when a bill is created, re-enabled or
//              rescheduled, so a bill due today is due today, not next cycle.
// The first occurrence is never before the startDate's day.
export function calculateNextDueDate(liability, fromDate = new Date(), tz = DEFAULT_TIMEZONE, { inclusive = false } = {}) {
  if (!liability.autoDeduct) return null;
  const zonedStart = liability.startDate ? toZoned(liability.startDate, tz) : null;
  const plain = liability.toObject?.() ?? liability;
  return fromZoned(calculateNextDueDateUtc({ ...plain, startDate: zonedStart }, toZoned(fromDate, tz), inclusive), tz);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function clampedUtcDate(year, month, day) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

// Recurrence math on UTC calendar fields (inputs pre-shifted by calculateNextDueDate).
function calculateNextDueDateUtc(liability, fromDate, inclusive) {
  const dayStart = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  let earliest = dayStart(fromDate) + (inclusive ? 0 : DAY_MS);
  if (liability.startDate) earliest = Math.max(earliest, dayStart(liability.startDate));
  const min = new Date(earliest);
  const year = min.getUTCFullYear();
  const month = min.getUTCMonth();

  if (liability.frequency === 'weekly') {
    const targetDay = liability.dayOfWeek || 0;
    const daysToAdd = (targetDay - min.getUTCDay() + 7) % 7;
    return new Date(earliest + daysToAdd * DAY_MS);
  }
  if (liability.frequency === 'monthly') {
    const targetDay = liability.dayOfMonth || 1;
    const candidate = clampedUtcDate(year, month, targetDay);
    return candidate >= min ? candidate : clampedUtcDate(year, month + 1, targetDay);
  }
  if (liability.frequency === 'yearly') {
    const targetMonth = (liability.monthOfYear || 1) - 1; // 0-11
    const targetDay = liability.dayOfMonth || 1;
    const candidate = clampedUtcDate(year, targetMonth, targetDay);
    return candidate >= min ? candidate : clampedUtcDate(year + 1, targetMonth, targetDay);
  }
  // daily
  return min;
}

import crypto from 'crypto';
import Liability from '../models/Liability.js';
import { logger } from '../utils/logger.js';

function userFilter(userId) {
  return { userId: String(userId) };
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
    const payload = req.body;

    const newLiability = new Liability({
      id: crypto.randomUUID(),
      userId: String(userId),
      name: payload.name,
      amount: payload.amount,
      category: payload.category,
      type: payload.type,
      autoDeduct: payload.autoDeduct || false,
      frequency: payload.frequency,
      startDate: new Date(payload.startDate),
      dayOfWeek: payload.dayOfWeek,
      dayOfMonth: payload.dayOfMonth,
      monthOfYear: payload.monthOfYear,
      nextDueDate: null, // Will be calculated by scheduler or initially
      status: 'active'
    });

    // We can pre-calculate nextDueDate or let the scheduler do it.
    // It's safer to pre-calculate it now so the UI shows it immediately.
    newLiability.nextDueDate = calculateNextDueDate(newLiability, new Date());

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
    if (payload.name !== undefined) liability.name = payload.name;
    if (payload.amount !== undefined) liability.amount = payload.amount;
    if (payload.category !== undefined) liability.category = payload.category;
    if (payload.type !== undefined) liability.type = payload.type;
    
    let frequencyChanged = false;
    if (payload.frequency !== undefined && payload.frequency !== liability.frequency) {
      liability.frequency = payload.frequency;
      frequencyChanged = true;
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
        liability.nextDueDate = calculateNextDueDate(liability, new Date());
      }
    }

    if (frequencyChanged && liability.autoDeduct) {
      liability.nextDueDate = calculateNextDueDate(liability, new Date());
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

// Helper for recurrence
export function calculateNextDueDate(liability, fromDate = new Date()) {
  if (!liability.autoDeduct) return null;

  // Work strictly in UTC to prevent timezone offsets from shifting dates 
  const baseDate = liability.startDate && liability.startDate > fromDate ? liability.startDate : fromDate;
  const nextDate = new Date(baseDate);

  if (liability.frequency === 'daily') {
    if (nextDate.getTime() <= fromDate.getTime() && liability.startDate.getTime() <= fromDate.getTime()) {
      // If we are calculating after a deduction, or starting today but it's passed
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    }
  } else if (liability.frequency === 'weekly') {
    const targetDay = liability.dayOfWeek || 0;
    const currentDay = nextDate.getUTCDay();
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }
    nextDate.setUTCDate(nextDate.getUTCDate() + daysToAdd);
  } else if (liability.frequency === 'monthly') {
    const targetDay = liability.dayOfMonth || 1;
    let nextMonth = nextDate.getUTCMonth();
    let nextYear = nextDate.getUTCFullYear();

    if (nextDate.getUTCDate() > targetDay || nextDate.getTime() <= fromDate.getTime()) {
      nextMonth++;
      if (nextMonth > 11) {
        nextMonth = 0;
        nextYear++;
      }
    }

    const lastDayOfTargetMonth = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
    const safeDay = Math.min(targetDay, lastDayOfTargetMonth);
    
    nextDate.setUTCFullYear(nextYear, nextMonth, safeDay);
  } else if (liability.frequency === 'yearly') {
    const targetMonth = (liability.monthOfYear || 1) - 1; // 0-11
    const targetDay = liability.dayOfMonth || 1;
    
    let nextYear = nextDate.getUTCFullYear();
    
    if (nextDate.getUTCMonth() > targetMonth || 
       (nextDate.getUTCMonth() === targetMonth && nextDate.getUTCDate() > targetDay) ||
       nextDate.getTime() <= fromDate.getTime()) {
      nextYear++;
    }

    const lastDayOfTargetMonth = new Date(Date.UTC(nextYear, targetMonth + 1, 0)).getUTCDate();
    const safeDay = Math.min(targetDay, lastDayOfTargetMonth);
    
    nextDate.setUTCFullYear(nextYear, targetMonth, safeDay);
  }

  // Ensure time is reset to 00:00:00 UTC for clean comparisons
  nextDate.setUTCHours(0, 0, 0, 0);
  return nextDate;
}

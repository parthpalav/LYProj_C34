import mongoose from 'mongoose';
import User from '../models/User.js';
import { resolveTimezone, toZoned } from '../utils/userTime.js';

/** The user's saved timezone, or the default (IST) when unset or the user isn't found. */
export async function getUserTimezone(userId) {
  const conditions = [{ id: String(userId) }];
  if (mongoose.isValidObjectId(userId)) conditions.push({ _id: userId });
  const user = await User.findOne({ $or: conditions }, { timezone: 1 }).lean();
  return resolveTimezone(user?.timezone);
}

/**
 * Forecast/analytics code buckets by getUTC* fields. This shifts transaction and
 * income timestamps plus the reference date into the user's wall clock so those
 * buckets follow the user's timezone. Returns [data, options] for the engine.
 */
export function zoneForecastInput(data, options = {}) {
  const tz = resolveTimezone(data.user?.timezone);
  const zone = (rows) => (Array.isArray(rows) ? rows.map((r) => (r?.timestamp ? { ...r, timestamp: toZoned(r.timestamp, tz) } : r)) : rows);
  const referenceDate = options.referenceDate ? new Date(options.referenceDate) : new Date();
  return [
    { ...data, transactions: zone(data.transactions), incomes: zone(data.incomes) },
    { ...options, referenceDate: toZoned(referenceDate, tz) }
  ];
}

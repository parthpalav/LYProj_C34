/**
 * Scheduled cash outflows for the current month. Bill totals cover active auto-deduct
 * liabilities. Planned SIPs reserve cash separately until a matching investment posts.
 */
import { getSipSchedule } from './SipSchedule.js';
import Liability from '../models/Liability.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { calculateNextDueDate } from '../controllers/liabilityController.js';
import { zonedDateKey, zonedMonthStart } from '../utils/userTime.js';
import { getUserTimezone } from './userTimezone.js';

const MAX_STEPS = 400; // a daily bill: 31 dues this month plus up to a year of missed ones

/**
 * Pure core.
 * - Paid: scheduler charges this month (Transaction with liabilityId + scheduledFor in the month).
 * - Remaining: dues from the scheduler's own pointer (nextDueDate) until month end, so a
 *   due skipped because the bill was created later is never counted.
 * - Overdue: unpaid dues from earlier months (the scheduler missed them and will catch
 *   up). Kept out of this month's total, but still reserved in freeBalance.
 */
export function buildCommitments({ liabilities, paidTxs, currentBalance, now = new Date(), tz }) {
  const monthStart = zonedMonthStart(now, tz, 0);
  const monthEnd = zonedMonthStart(now, tz, 1);

  const paidBy = new Map();
  for (const tx of paidTxs) {
    const at = new Date(tx.scheduledFor);
    if (at < monthStart || at >= monthEnd) continue;
    const list = paidBy.get(String(tx.liabilityId)) || [];
    list.push({ date: at, amount: Number(tx.amount) || 0 });
    paidBy.set(String(tx.liabilityId), list);
  }

  const items = [];
  for (const l of liabilities) {
    if (!l.autoDeduct || l.status === 'deleted') continue;
    const paid = paidBy.get(String(l.id)) || [];
    const paidKeys = new Set(paid.map((p) => p.date.getTime()));

    const upcoming = [];
    const overdue = [];
    let due = l.nextDueDate ? new Date(l.nextDueDate) : calculateNextDueDate(l, now, tz, { inclusive: true });
    for (let i = 0; due && due < monthEnd && i < MAX_STEPS; i++) {
      if (due < monthStart) overdue.push(due);
      else if (!paidKeys.has(due.getTime())) upcoming.push(due);
      due = calculateNextDueDate(l, due, tz);
    }

    const paidAmount = paid.reduce((s, p) => s + p.amount, 0);
    const remainingAmount = upcoming.length * Number(l.amount);
    const overdueAmount = overdue.length * Number(l.amount);
    if (!paid.length && !upcoming.length && !overdue.length) continue;

    items.push({
      id: l.id,
      name: l.name,
      type: l.type,
      category: l.category,
      amount: Number(l.amount),
      frequency: l.frequency,
      paidDates: paid.map((p) => zonedDateKey(p.date, tz)).sort(),
      dueDates: upcoming.map((d) => zonedDateKey(d, tz)),
      overdueDates: overdue.map((d) => zonedDateKey(d, tz)),
      paidCount: paid.length,
      paidAmount,
      remainingAmount,
      overdueAmount,
      nextDueDate: overdue[0] || upcoming[0] || null,
    });
  }
  const firstDue = (it) => it.overdueDates[0] || it.dueDates[0] || '9999';
  items.sort((a, b) => firstDue(a).localeCompare(firstDue(b)));

  const sum = (rows, key) => rows.reduce((s, r) => s + r[key], 0);
  const remaining = sum(items, 'remainingAmount');
  const overdue = sum(items, 'overdueAmount');
  const paidSoFar = sum(items, 'paidAmount');
  const byType = {};
  for (const it of items) {
    const t = byType[it.type] || (byType[it.type] = { committed: 0, remaining: 0 });
    t.committed += it.paidAmount + it.remainingAmount;
    t.remaining += it.remainingAmount;
  }
  const balance = Number(currentBalance) || 0;

  return {
    month: zonedDateKey(monthStart, tz).slice(0, 7),
    monthEnd: zonedDateKey(new Date(monthEnd.getTime() - 1), tz),
    currentBalance: balance,
    committedTotal: paidSoFar + remaining,
    paidSoFar,
    remaining,
    overdue,
    // Reserve for this month's dues plus missed ones the scheduler will still take.
    freeBalance: balance - remaining - overdue,
    byType,
    items,
  };
}

/** Loads the user's auto-deduct liabilities and this month's scheduler charges. Pass tz/currentBalance when the caller already has them. */
export async function getMonthlyCommitments(userId, { now = new Date(), tz, currentBalance } = {}) {
  const uid = String(userId);
  const zone = tz || await getUserTimezone(uid);
  const liabilities = await Liability.find({ userId: uid, status: 'active', autoDeduct: true }).lean();
  const ids = liabilities.map((l) => l.id);
  const [paidTxs, user, sipSchedule] = await Promise.all([
    ids.length
      ? Transaction.find({
          userId: uid,
          liabilityId: { $in: ids },
          scheduledFor: { $gte: zonedMonthStart(now, zone, 0), $lt: zonedMonthStart(now, zone, 1) },
        }).select('liabilityId scheduledFor amount').lean()
      : [],
    currentBalance === undefined ? User.findOne({ id: uid }).select('currentBalance').lean() : null,
    getSipSchedule(uid, now, zone),
  ]);
  const balance = currentBalance === undefined ? user?.currentBalance : currentBalance;
  const bills = buildCommitments({ liabilities, paidTxs, currentBalance: balance, now, tz: zone });
  return { ...bills, sipSchedule, freeBalance: bills.freeBalance - sipSchedule.remaining };
}

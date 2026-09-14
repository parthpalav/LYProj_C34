/**
 * server/services/FamilyAggregationService.js
 *
 * Household Financial Aggregation Service for FINAURA Family System.
 *
 * Computes privacy-safe, pooled household financial summaries for active families:
 *   - Strictly scoped to active family members
 *   - Per-member income fallback before aggregation
 *   - Type authority (Need / Want / Investment) over Category
 *   - Canonical V3 category normalization
 *   - Budget pacing and savings/investment rate
 *   - Zero individual member financial attribution or raw transaction rows leaked
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Income from '../models/Income.js';
import { getActiveFamilyForUser } from './FamilyService.js';

// ── Calendar Month Boundary Helpers (Aligned with Individual FMI) ────────────

/**
 * Returns number of days in month for given date.
 * Exactly matches FMIService.daysInMonth semantics.
 *
 * @param {Date} date
 * @returns {number}
 */
export function daysInMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Returns day of month for given date.
 * Exactly matches FMIService.dayOfMonth semantics.
 *
 * @param {Date} date
 * @returns {number}
 */
export function dayOfMonth(date = new Date()) {
  return date.getDate();
}

/**
 * Computes calendar-month period boundaries for a reference date.
 *
 * @param {Date} [referenceDate=new Date()]
 * @returns {Object} { month, year, startDate, endDate, daysPassed, daysInMonth }
 */
export function getMonthPeriod(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1; // 1-indexed (1-12)

  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const passed = dayOfMonth(referenceDate);
  const total = daysInMonth(referenceDate);

  return {
    month,
    year,
    startDate,
    endDate,
    daysPassed: passed,
    daysInMonth: total
  };
}

// ── Category Normalization Map ───────────────────────────────────────────────

export const CATEGORY_NORMALIZATION_MAP = {
  'Food': 'Food & Dining',
  'Travel': 'Transport & Travel',
  'Bills': 'Utilities & Bills',
  'Party': 'Entertainment'
};

/**
 * Normalizes legacy or variant category names into canonical V3 taxonomy.
 *
 * @param {string} category
 * @returns {string}
 */
export function normalizeCategory(category) {
  if (!category || typeof category !== 'string') return 'Misc';
  const trimmed = category.trim();
  return CATEGORY_NORMALIZATION_MAP[trimmed] || trimmed;
}

// ── Main Service Method ──────────────────────────────────────────────────────

/**
 * Derives comprehensive household financial aggregates for a user's active family.
 * Returns a clean, plain aggregate DTO with zero raw transactions or user-attributable
 * financial rows.
 *
 * @param {string} userId - Authenticated requesting user's ID
 * @param {Date} [referenceDate=new Date()] - Optional date for time travel/testing
 * @returns {Promise<Object|null>} Plain aggregate DTO, or null if user has no active family
 */
export async function getHouseholdSummary(userId, referenceDate = new Date()) {
  if (!userId) return null;

  // 1. Resolve active Family and validated member roster
  const activeFamily = await getActiveFamilyForUser(userId);
  if (!activeFamily) {
    return null;
  }

  const memberUserIds = activeFamily.members.map((m) => String(m.userId));
  if (memberUserIds.length === 0) {
    return null;
  }

  // 2. Derive calendar month period (using exact FMI semantics)
  const period = getMonthPeriod(referenceDate);

  // 3. Resolve member planning declared income
  const objectIdCandidates = memberUserIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const userDocs = await User.find({
    $or: [
      { id: { $in: memberUserIds } },
      ...(objectIdCandidates.length ? [{ _id: { $in: objectIdCandidates } }] : [])
    ]
  }).select('id _id monthlyIncome income').lean();

  const declaredIncomeMap = new Map();
  for (const u of userDocs) {
    const declared = Number(u.monthlyIncome ?? u.income ?? 0) || 0;
    if (u.id) declaredIncomeMap.set(String(u.id), declared);
    if (u._id) declaredIncomeMap.set(String(u._id), declared);
  }

  // 4. Fetch member Income events for current calendar month
  const incomeDocs = await Income.find({
    userId: { $in: memberUserIds },
    timestamp: { $gte: period.startDate, $lte: period.endDate }
  }).lean();

  const actualIncomeMap = new Map();
  for (const inc of incomeDocs) {
    const uid = String(inc.userId);
    const amount = Number(inc.amount) || 0;
    if (amount > 0) {
      actualIncomeMap.set(uid, (actualIncomeMap.get(uid) || 0) + amount);
    }
  }

  // 5. Calculate per-member income fallback, then sum household figures
  let totalDeclaredIncome = 0;
  let totalActualIncome = 0;
  let totalEffectiveIncome = 0;

  for (const m of activeFamily.members) {
    const uid = String(m.userId);
    const declared = declaredIncomeMap.get(uid) || 0;
    const actual = actualIncomeMap.get(uid) || 0;
    const effective = actual > 0 ? actual : declared;

    totalDeclaredIncome += declared;
    totalActualIncome += actual;
    totalEffectiveIncome += effective;
  }

  // 6. Fetch member Transaction records for current calendar month
  const transactionDocs = await Transaction.find({
    userId: { $in: memberUserIds },
    timestamp: { $gte: period.startDate, $lte: period.endDate }
  }).lean();

  // 7. Aggregate by Type and Category
  let need = 0;
  let want = 0;
  let investment = 0;
  const categoryAmountMap = new Map();

  for (const tx of transactionDocs) {
    const amount = Number(tx.amount) || 0;
    if (amount <= 0) continue;

    // Type authority strictly determines spend bucket
    if (tx.type === 'Need') {
      need += amount;
    } else if (tx.type === 'Want') {
      want += amount;
    } else if (tx.type === 'Investment') {
      investment += amount;
    }

    // Category is descriptive only and normalized
    const canonicalCategory = normalizeCategory(tx.category);
    categoryAmountMap.set(
      canonicalCategory,
      (categoryAmountMap.get(canonicalCategory) || 0) + amount
    );
  }

  const totalNonInvestment = need + want;
  const totalOutflow = need + want + investment;

  // 8. Savings / Investment rate
  const investmentRate = totalEffectiveIncome > 0
    ? (investment / totalEffectiveIncome)
    : 0;
  const investmentRatePercent = totalEffectiveIncome > 0
    ? Number(((investment / totalEffectiveIncome) * 100).toFixed(3))
    : 0;

  // 9. Monthly Net Cash Position (Informational: effective income - current-month outflows)
  const netCashPosition = totalEffectiveIncome - totalOutflow;

  // 10. Budget Pacing
  const daysPassed = period.daysPassed;
  const daysInMonthTotal = period.daysInMonth;
  const avgDailyNonInvestmentSpend = daysPassed > 0
    ? Number((totalNonInvestment / Math.max(daysPassed, 1)).toFixed(2))
    : 0;
  const predictedMonthlyNonInvestmentSpend = Number(
    (avgDailyNonInvestmentSpend * daysInMonthTotal).toFixed(2)
  );

  // 11. Type Breakdown
  const typeBreakdown = {
    need: {
      amount: need,
      percentageOfOutflow: totalOutflow > 0
        ? Number(((need / totalOutflow) * 100).toFixed(1))
        : 0
    },
    want: {
      amount: want,
      percentageOfOutflow: totalOutflow > 0
        ? Number(((want / totalOutflow) * 100).toFixed(1))
        : 0
    },
    investment: {
      amount: investment,
      percentageOfOutflow: totalOutflow > 0
        ? Number(((investment / totalOutflow) * 100).toFixed(1))
        : 0
    }
  };

  // 12. Category Breakdown (descending order by amount)
  const categoryBreakdown = Array.from(categoryAmountMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentageOfOutflow: totalOutflow > 0
        ? Number(((amount / totalOutflow) * 100).toFixed(1))
        : 0,
      percentageOfNonInvestmentSpend: totalNonInvestment > 0
        ? Number(((amount / totalNonInvestment) * 100).toFixed(1))
        : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  // 13. Return plain aggregate DTO (no Mongoose document wrappers, no raw data leakage)
  return {
    period: {
      month: period.month,
      year: period.year,
      startDate: period.startDate,
      endDate: period.endDate,
      daysPassed: period.daysPassed,
      daysInMonth: period.daysInMonth
    },
    family: {
      id: activeFamily.id,
      name: activeFamily.name,
      memberCount: activeFamily.members.length,
      members: activeFamily.members.map((m) => ({
        userId: m.userId,
        name: m.name,
        role: m.role,
        joinedAt: m.joinedAt
      }))
    },
    income: {
      declaredMonthlyIncome: totalDeclaredIncome,
      actualIncomeThisMonth: totalActualIncome,
      effectiveMonthlyIncome: totalEffectiveIncome
    },
    spending: {
      need,
      want,
      totalNonInvestment
    },
    investments: {
      monthlyFlow: investment,
      investmentRate,
      investmentRatePercent
    },
    cashFlow: {
      totalOutflow,
      netCashPosition
    },
    pacing: {
      daysPassed: period.daysPassed,
      daysInMonth: period.daysInMonth,
      avgDailyNonInvestmentSpend,
      predictedMonthlyNonInvestmentSpend
    },
    typeBreakdown,
    categoryBreakdown
  };
}

export default {
  daysInMonth,
  dayOfMonth,
  getMonthPeriod,
  normalizeCategory,
  CATEGORY_NORMALIZATION_MAP,
  getHouseholdSummary
};

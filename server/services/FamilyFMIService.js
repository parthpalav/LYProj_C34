/**
 * server/services/FamilyFMIService.js
 *
 * Family Financial Maturity Index (Family FMI) Engine.
 *
 * Evaluates a pooled household FMI reusing FINAURA's verified mathematical curves:
 *   - D1: Household savings flow vs summed individual retirement obligations
 *   - D2: Household non-investment spend pacing vs pooled available budget
 *   - D3: Household-aware behavioral risk with member-count scaled thresholds
 *
 * PRIVACY GUARANTEES:
 *   - Returns a clean plain DTO with zero raw transactions or member attribution.
 *   - No per-member retirement goals, balances, or individual FMI scores exposed.
 *   - Dynamically calculated (not persisted to FMIHistory in V1).
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import Goal from '../models/Goal.js';
import Transaction from '../models/Transaction.js';
import {
  clamp,
  formatCurrency,
  calculateSavingDisciplineScore,
  calculateSpendingControlScore,
  calculateFinalFMIScore,
  getFMILabel,
  calculateMemberGoalDetail
} from './FMIService.js';
import { normalizeCategory, getHouseholdSummary } from './FamilyAggregationService.js';

/**
 * Computes Family FMI using the Phase 3 household aggregate DTO.
 *
 * @param {string} userId - Authenticated user ID
 * @param {Object} [precomputedAggregate=null] - Precomputed Phase 3 aggregate data
 * @param {Date} [referenceDate=new Date()] - Reference date for time travel/testing
 * @returns {Promise<Object|null>} Plain Family FMI DTO, or null if no active family
 */
export async function getFamilyFMI(userId, precomputedAggregate = null, referenceDate = new Date()) {
  if (!userId) return null;

  // 1. Obtain or reuse Phase 3 household aggregate DTO
  const aggregateData = precomputedAggregate || await getHouseholdSummary(userId, referenceDate);
  if (!aggregateData || !aggregateData.family) {
    return null;
  }

  const { family, income, spending, investments, pacing, period } = aggregateData;
  const memberUserIds = family.members.map((m) => String(m.userId));
  const memberCount = family.memberCount || memberUserIds.length || 1;

  // 2. Fetch member User records and Goals to calculate summed retirement obligations
  const objectIdCandidates = memberUserIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const userFilter = {
    $or: [
      { id: { $in: memberUserIds } },
      ...(objectIdCandidates.length ? [{ _id: { $in: objectIdCandidates } }] : [])
    ]
  };

  const [memberUsers, memberGoals] = await Promise.all([
    User.find(userFilter).lean(),
    Goal.find({ userId: { $in: memberUserIds } }).lean()
  ]);

  const userMap = new Map();
  for (const u of memberUsers) {
    if (u.id) userMap.set(String(u.id), u);
    if (u._id) userMap.set(String(u._id), u);
  }

  // 3. Sum each member's individual required monthly saving
  let householdRequiredMonthlySaving = 0;
  let householdRequiredThisMonth = 0;

  for (const member of family.members) {
    const uid = String(member.userId);
    const u = userMap.get(uid) || { id: uid, monthlyIncome: 0 };
    const goalsForUser = memberGoals.filter((g) => String(g.userId) === uid);

    const goalDetail = calculateMemberGoalDetail(u, goalsForUser);
    householdRequiredMonthlySaving += goalDetail.requiredMonthlySaving;
    householdRequiredThisMonth += goalDetail.requiredThisMonth;
  }

  // 4. Pillar D1: Saving Discipline (40%)
  // Uses household total investment flow from Phase 3 vs summed obligations
  const householdTotalSaved = Number(investments.monthlyFlow || 0);
  const d1Result = calculateSavingDisciplineScore(householdTotalSaved, householdRequiredThisMonth);

  // 5. Pillar D2: Spending Control (30%)
  // Available money = effective income - required savings
  const effectiveHouseholdIncome = Number(income.effectiveMonthlyIncome || 0);
  const availableMoney = Math.max(0, effectiveHouseholdIncome - householdRequiredThisMonth);
  const householdNonInvestmentSpend = Number(spending.totalNonInvestment || 0);
  const predictedMonthlySpend = Number(pacing.predictedMonthlyNonInvestmentSpend || 0);

  const d2Result = calculateSpendingControlScore(
    predictedMonthlySpend,
    availableMoney,
    householdNonInvestmentSpend,
    effectiveHouseholdIncome
  );

  // 6. Pillar D3: Behavioral Risk (30%)
  // Query current-month member transactions internally for risk pattern counts
  const memberTxs = await Transaction.find({
    userId: { $in: memberUserIds },
    timestamp: { $gte: period.startDate, $lte: period.endDate }
  }).lean();

  let riskPenalty = 0;
  const riskFactors = [];

  // Rule 1: Wants > Needs (Unchanged at household level)
  const wantsTotal = Number(spending.want || 0);
  const needsTotal = Number(spending.need || 0);
  if (householdNonInvestmentSpend > 0 && wantsTotal > needsTotal) {
    const wantsPct = Math.round((wantsTotal / householdNonInvestmentSpend) * 100);
    riskPenalty += 15;
    riskFactors.push(`Wants (${wantsPct}%) exceed Needs — high discretionary household spending`);
  }

  // Rule 2: Late-night purchases (Scaled by member count: 2 * N)
  const lateNightTxs = memberTxs.filter((t) => {
    const h = new Date(t.timestamp).getHours();
    return h >= 22 || h <= 4;
  });
  const scaledLateNightThreshold = 2 * memberCount;
  if (lateNightTxs.length >= scaledLateNightThreshold) {
    riskPenalty += 15;
    riskFactors.push(`${lateNightTxs.length} late-night purchases detected across household`);
  }

  // Rule 3: High-frequency shopping / Impulse (Scaled by member count: 4 * N)
  const shoppingTxs = memberTxs.filter((t) => {
    const norm = normalizeCategory(t.category).toLowerCase();
    return ['shopping', 'entertainment'].includes(norm);
  });
  const scaledImpulseThreshold = 4 * memberCount;
  if (shoppingTxs.length >= scaledImpulseThreshold) {
    riskPenalty += 8;
    riskFactors.push(`${shoppingTxs.length} discretionary shopping transactions this period`);
  }

  // Rule 4: Anomaly cluster (Scaled by member count: 2 * N)
  const anomalies = memberTxs.filter((t) => Boolean(t.isAnomaly));
  const scaledAnomalyThreshold = 2 * memberCount;
  if (anomalies.length >= scaledAnomalyThreshold) {
    riskPenalty += 10;
    riskFactors.push(`${anomalies.length} unusually large transactions detected this period`);
  }

  // Rule 5: Food spike (Canonical category compatibility, pooled average comparison)
  const foodTxs = memberTxs.filter((t) => {
    const norm = normalizeCategory(t.category);
    return norm === 'Food & Dining' || norm.toLowerCase() === 'food';
  });
  if (foodTxs.length > 0 && memberTxs.length > 0) {
    const totalAvg = memberTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0) / memberTxs.length;
    const foodAvg = foodTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0) / foodTxs.length;
    if (totalAvg > 0 && foodAvg > totalAvg * 1.3) {
      riskPenalty += 5;
      riskFactors.push(`Household food spending is ${Math.round((foodAvg / totalAvg - 1) * 100)}% above average transaction`);
    }
  }

  const d3Score = clamp(Math.round(100 - riskPenalty));
  const d3Detail = riskFactors.length === 0
    ? 'No risky spending behaviors detected'
    : `${riskFactors.length} risk factor(s) detected`;

  // 7. Final FMI Score & Label
  const { score: fmiScore } = calculateFinalFMIScore(d1Result.score, d2Result.score, d3Score);
  const fmiLabel = getFMILabel(fmiScore);
  const status = d2Result.status;

  // 8. Deterministic Family Insights (Zero LLM, Zero member-attribution)
  const insights = [];

  if (status === 'above') {
    insights.push(`Household is projected to spend ${formatCurrency(predictedMonthlySpend)}, which is ${formatCurrency(predictedMonthlySpend - availableMoney)} over available budget`);
  } else if (status === 'below') {
    insights.push(`Great household discipline! Projected to save ${formatCurrency(availableMoney - predictedMonthlySpend)} extra this month`);
  }

  if (householdRequiredThisMonth > 0) {
    const gap = householdRequiredThisMonth - householdTotalSaved;
    if (gap > 0) {
      insights.push(`Household needs to save ${formatCurrency(gap)} more this month to stay on combined retirement targets`);
    } else {
      insights.push('Household has achieved its combined monthly savings target — excellent progress!');
    }
  }

  if (wantsTotal > needsTotal && householdNonInvestmentSpend > 0) {
    insights.push('Discretionary spending (Wants) exceeds essential living costs (Needs) this month');
  }

  if (riskFactors.length > 0) {
    insights.push(`Household spending pattern indicates ${riskFactors.length} behavioral risk factor(s)`);
  }

  if (investments.investmentRatePercent >= 20) {
    insights.push(`Strong household investment rate of ${investments.investmentRatePercent}% of effective income`);
  }

  // Ensure minimum of 2 insights
  if (insights.length < 2) {
    if (effectiveHouseholdIncome > 0) {
      insights.push(`Household required monthly saving is ${formatCurrency(householdRequiredMonthlySaving)} to meet combined retirement goals`);
    }
    if (insights.length < 2) {
      insights.push('Track family expenses regularly to maintain high Financial Maturity');
    }
  }

  // 9. Plain DTO Return (No Mongoose documents, no raw data, no member attribution)
  return {
    score: fmiScore,
    fmiLabel,
    status,
    pillars: {
      D1_savingDiscipline: {
        score: d1Result.score,
        weight: 0.4,
        detail: d1Result.detail
      },
      D2_spendingControl: {
        score: d2Result.score,
        weight: 0.3,
        detail: d2Result.detail
      },
      D3_behavioralRisk: {
        score: d3Score,
        weight: 0.3,
        detail: d3Detail
      }
    },
    insights,
    householdGoalDetail: {
      householdRequiredMonthlySaving: Math.round(householdRequiredMonthlySaving),
      householdRequiredThisMonth: Math.round(householdRequiredThisMonth),
      householdTotalSaved: Math.round(householdTotalSaved),
      availableMoney: Math.round(availableMoney),
      predictedMonthlySpend: Math.round(predictedMonthlySpend)
    }
  };
}

export default {
  getFamilyFMI
};

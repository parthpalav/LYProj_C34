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
 *   - The `fmi` DTO stays clean: zero raw transactions or member attribution.
 *   - No per-member retirement goals, balances, or individual FMI scores exposed.
 *   - Dynamically calculated (not persisted to FMIHistory in V1).
 *   - buildMemberBreakdown is the one place member attribution leaves this service:
 *     score points and percentage shares go to every member; rupee amounts go only to
 *     the family owner, plus each member's own row.
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
import { shapleyValues } from '../utils/shapley.js';
import { zonedHour } from '../utils/userTime.js';
import { getUserTimezone } from './userTimezone.js';

/** Each member's required monthly saving, keyed by userId (same math as individual FMI). */
async function loadMemberRequirements(memberUserIds) {
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

  const required = new Map();
  for (const uid of memberUserIds) {
    const u = userMap.get(uid) || { id: uid, monthlyIncome: 0 };
    const goalsForUser = memberGoals.filter((g) => String(g.userId) === uid);
    const { requiredMonthlySaving, requiredThisMonth } = calculateMemberGoalDetail(u, goalsForUser);
    required.set(uid, { requiredMonthlySaving, requiredThisMonth });
  }
  return required;
}

/**
 * Pure D1/D2/D3 scoring of a (sub)household from pooled figures.
 * getFamilyFMI scores the whole family with it; buildMemberBreakdown scores every
 * subset of members for the Shapley attribution.
 */
export function scoreHousehold({ totalSaved, requiredThisMonth, effectiveIncome, need, want, predictedMonthlySpend, txs, memberCount, tz }) {
  // 4. Pillar D1: Saving Discipline (40%)
  // Uses household total investment flow from Phase 3 vs summed obligations
  const d1Result = calculateSavingDisciplineScore(totalSaved, requiredThisMonth);

  // 5. Pillar D2: Spending Control (30%)
  // Available money = effective income - required savings
  const availableMoney = Math.max(0, effectiveIncome - requiredThisMonth);
  const householdNonInvestmentSpend = need + want;

  const d2Result = calculateSpendingControlScore(
    predictedMonthlySpend,
    availableMoney,
    householdNonInvestmentSpend,
    effectiveIncome
  );

  // 6. Pillar D3: Behavioral Risk (30%)
  const memberTxs = txs;
  let riskPenalty = 0;
  const riskFactors = [];

  // Rule 1: Wants > Needs (Unchanged at household level)
  const wantsTotal = want;
  const needsTotal = need;
  if (householdNonInvestmentSpend > 0 && wantsTotal > needsTotal) {
    const wantsPct = Math.round((wantsTotal / householdNonInvestmentSpend) * 100);
    riskPenalty += 15;
    riskFactors.push(`Wants (${wantsPct}%) exceed Needs — high discretionary household spending`);
  }

  // Rule 2: Late-night purchases (Scaled by member count: 2 * N)
  const lateNightTxs = memberTxs.filter((t) => {
    const h = zonedHour(new Date(t.timestamp), tz);
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
  return { d1Result, d2Result, d3Score, riskFactors, availableMoney };
}

/** Same pacing rounding as FamilyAggregationService, so the full-family subset reproduces the aggregate. */
function predictedSpend(nonInvestment, period) {
  const avg = period.daysPassed > 0
    ? Number((nonInvestment / Math.max(period.daysPassed, 1)).toFixed(2))
    : 0;
  return Number((avg * period.daysInMonth).toFixed(2));
}

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
  const tz = await getUserTimezone(userId);
  const memberUserIds = family.members.map((m) => String(m.userId));
  const memberCount = family.memberCount || memberUserIds.length || 1;

  // 2-3. Sum each member's individual required monthly saving
  const requiredByMember = await loadMemberRequirements(memberUserIds);
  let householdRequiredMonthlySaving = 0;
  let householdRequiredThisMonth = 0;
  for (const uid of memberUserIds) {
    householdRequiredMonthlySaving += requiredByMember.get(uid).requiredMonthlySaving;
    householdRequiredThisMonth += requiredByMember.get(uid).requiredThisMonth;
  }

  // Query current-month member transactions internally for risk pattern counts
  const memberTxs = await Transaction.find({
    userId: { $in: memberUserIds },
    timestamp: { $gte: period.startDate, $lte: period.endDate }
  }).lean();

  const householdTotalSaved = Number(investments.monthlyFlow || 0);
  const effectiveHouseholdIncome = Number(income.effectiveMonthlyIncome || 0);
  const wantsTotal = Number(spending.want || 0);
  const needsTotal = Number(spending.need || 0);
  const householdNonInvestmentSpend = Number(spending.totalNonInvestment || 0);
  const predictedMonthlySpend = Number(pacing.predictedMonthlyNonInvestmentSpend || 0);

  const { d1Result, d2Result, d3Score, riskFactors, availableMoney } = scoreHousehold({
    totalSaved: householdTotalSaved,
    requiredThisMonth: householdRequiredThisMonth,
    effectiveIncome: effectiveHouseholdIncome,
    need: needsTotal,
    want: wantsTotal,
    predictedMonthlySpend,
    txs: memberTxs,
    memberCount,
    tz
  });

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

const round1 = (x) => Math.round(x * 10) / 10;
const pct = (part, whole) => (whole > 0 ? round1((part / whole) * 100) : 0);

/**
 * Who contributes how much to the family score and metrics.
 *
 * Score: exact Shapley values over members, where v(S) is the raw FMI
 * (0.4·D1 + 0.3·D2 + 0.3·D3) of sub-household S scored by scoreHousehold, and v(∅) = 0.
 * Member points add up to the unrounded family score; a member who drags a pillar
 * down can get negative points for it.
 *
 * Visibility (trust boundary, enforced here): every member gets score points and
 * percentage shares for everyone; `amounts` (rupees) only on the viewer's own row,
 * or on every row when the viewer is the family owner.
 *
 * @param {string} viewerUserId - Authenticated user ID
 * @param {{summary: Object, members: Object[]}} householdData - From FamilyAggregationService.getHouseholdData
 */
export async function buildMemberBreakdown(viewerUserId, { summary, members }) {
  const tz = await getUserTimezone(viewerUserId);
  const required = await loadMemberRequirements(members.map((m) => String(m.userId)));

  const value = (subset) => {
    if (subset.length === 0) return { total: 0, D1: 0, D2: 0, D3: 0 };
    const sum = (key) => subset.reduce((s, m) => s + m[key], 0);
    const need = sum('need');
    const want = sum('want');
    const r = scoreHousehold({
      totalSaved: sum('investment'),
      requiredThisMonth: subset.reduce((s, m) => s + required.get(String(m.userId)).requiredThisMonth, 0),
      effectiveIncome: sum('effectiveIncome'),
      need,
      want,
      predictedMonthlySpend: predictedSpend(need + want, summary.period),
      txs: subset.flatMap((m) => m.txs),
      memberCount: subset.length,
      tz
    });
    // Same weights as calculateFinalFMIScore
    const D1 = 0.4 * r.d1Result.score;
    const D2 = 0.3 * r.d2Result.score;
    const D3 = 0.3 * r.d3Score;
    return { total: D1 + D2 + D3, D1, D2, D3 };
  };

  const shares = shapleyValues(members, value);
  const rawScore = shares.reduce((s, p) => s + p.total, 0);

  const household = {
    income: members.reduce((s, m) => s + m.effectiveIncome, 0),
    need: members.reduce((s, m) => s + m.need, 0),
    want: members.reduce((s, m) => s + m.want, 0),
    investment: members.reduce((s, m) => s + m.investment, 0)
  };
  const viewerIsOwner = members.some((m) => String(m.userId) === String(viewerUserId) && m.role === 'owner');

  return {
    method: 'shapley',
    rawScore: round1(rawScore),
    viewerCanSeeAllAmounts: viewerIsOwner,
    members: members.map((m, i) => {
      const isYou = String(m.userId) === String(viewerUserId);
      const row = {
        userId: m.userId,
        name: m.name,
        role: m.role,
        isYou,
        score: {
          points: round1(shares[i].total),
          pctOfScore: pct(shares[i].total, rawScore),
          pillars: { D1: round1(shares[i].D1), D2: round1(shares[i].D2), D3: round1(shares[i].D3) }
        },
        shares: {
          incomePct: pct(m.effectiveIncome, household.income),
          spendPct: pct(m.need + m.want, household.need + household.want),
          needPct: pct(m.need, household.need),
          wantPct: pct(m.want, household.want),
          investmentPct: pct(m.investment, household.investment)
        }
      };
      if (viewerIsOwner || isYou) {
        row.amounts = {
          effectiveIncome: m.effectiveIncome,
          need: m.need,
          want: m.want,
          investment: m.investment,
          netCash: m.effectiveIncome - (m.need + m.want + m.investment),
          topCategories: Object.entries(m.categories)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([category, amount]) => ({ category, amount }))
        };
      }
      return row;
    })
  };
}

export default {
  getFamilyFMI,
  buildMemberBreakdown
};

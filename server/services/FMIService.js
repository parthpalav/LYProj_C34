/**
 * FMI Service — Deterministic, Goal-Based Financial Maturity Index
 *
 * Fully self-contained scoring engine (no external microservice).
 * Combines:
 *   1. Goal-based retirement tracking
 *   2. Monthly spending prediction (calendar-aware)
 *   3. 3-pillar weighted scoring (Saving Discipline, Spending Control, Behavioral Risk)
 *
 * Inputs:  (user, expenses)
 * Output:  Explainable FMI object with score 0-100, status, pillars, insights, alerts
 *
 * Design rules:
 *   ✔ deterministic — same inputs → same output
 *   ✔ explainable — every sub-score traceable to a formula
 *   ✔ no raw bank-balance scoring — always compares against goal + income
 */

import { detectBehavioralPatterns } from './BehaviorService.js';

// ── Helpers ──────────────────────────────────────────────────

export function clamp(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, val));
}

export function lerp(ratio, low, high) {
  return low + (high - low) * Math.min(1, Math.max(0, ratio));
}

export function daysInMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function dayOfMonth(date = new Date()) {
  return date.getDate();
}

export function formatCurrency(n) {
  return `₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`;
}

// ── Shared FMI Scoring Functions ──────────────────────────────

/**
 * Pillar D1: Saving Discipline (40%)
 * Evaluates savings achieved against required monthly savings.
 *
 * @param {number} totalSaved - Total investment/savings flow
 * @param {number} requiredThisMonth - Target savings required this month
 * @returns {{ score: number, detail: string }}
 */
export function calculateSavingDisciplineScore(totalSaved, requiredThisMonth) {
  let score;
  let detail;
  if (requiredThisMonth <= 0) {
    // No savings requirement (goal met or no goal)
    score = totalSaved > 0 ? 95 : 75;
    detail = 'No savings requirement this month';
  } else {
    const savingRatio = totalSaved / requiredThisMonth;
    if (savingRatio >= 1) {
      score = lerp(Math.min(savingRatio - 1, 0.5) * 2, 90, 100);
      detail = `Saving ${Math.round(savingRatio * 100)}% of target — excellent`;
    } else if (savingRatio >= 0.7) {
      score = lerp((savingRatio - 0.7) / 0.3, 60, 85);
      detail = `Saving ${Math.round(savingRatio * 100)}% of target — on pace`;
    } else {
      score = lerp(savingRatio / 0.7, 20, 60);
      detail = `Only ${Math.round(savingRatio * 100)}% of target saved — falling behind`;
    }
  }
  return { score: clamp(Math.round(score)), detail };
}

/**
 * Pillar D2: Spending Control (30%)
 * Evaluates predicted non-investment spending against available budget.
 *
 * @param {number} predictedMonthlySpend - Paced non-investment spend
 * @param {number} availableMoney - Effective income minus required savings
 * @param {number} totalSpent - Actual non-investment spend so far
 * @param {number} monthlyIncome - Total effective monthly income
 * @returns {{ score: number, detail: string, status: string }}
 */
export function calculateSpendingControlScore(predictedMonthlySpend, availableMoney, totalSpent, monthlyIncome) {
  let score;
  let detail;
  let status;

  if (availableMoney <= 0) {
    status = predictedMonthlySpend > 0 ? 'above' : 'on_track';
    score = totalSpent === 0 ? 80 : clamp(Math.round(40 - (totalSpent / (monthlyIncome || 1)) * 20));
    detail = availableMoney === 0
      ? 'Entire income allocated to savings goal'
      : 'Required savings exceed income — budget under extreme pressure';
  } else {
    if (predictedMonthlySpend > availableMoney) {
      status = 'above';
    } else if (predictedMonthlySpend >= 0.8 * availableMoney) {
      status = 'on_track';
    } else {
      status = 'below';
    }

    const spendRatio = predictedMonthlySpend / availableMoney;
    if (spendRatio <= 0.7) {
      score = lerp(1 - spendRatio / 0.7, 80, 100);
      detail = `Predicted spend is ${Math.round(spendRatio * 100)}% of budget — well controlled`;
    } else if (spendRatio <= 1) {
      score = lerp((1 - spendRatio) / 0.3, 50, 80);
      detail = `Predicted spend is ${Math.round(spendRatio * 100)}% of budget — moderate`;
    } else {
      score = lerp(Math.max(0, 2 - spendRatio), 20, 50);
      detail = `Predicted to overspend by ${formatCurrency(predictedMonthlySpend - availableMoney)}`;
    }
  }

  return { score: clamp(Math.round(score)), detail, status };
}

/**
 * Computes the final weighted FMI score (0–100).
 *
 * @param {number} d1Score
 * @param {number} d2Score
 * @param {number} d3Score
 * @returns {{ score: number, rawFMI: number }}
 */
export function calculateFinalFMIScore(d1Score, d2Score, d3Score) {
  const rawFMI = (d1Score * 0.4) + (d2Score * 0.3) + (d3Score * 0.3);
  const score = clamp(Math.round(rawFMI));
  return { score, rawFMI };
}

/**
 * Derives the qualitative label corresponding to an FMI score.
 *
 * @param {number} score
 * @returns {string}
 */
export function getFMILabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 45) return 'Fair';
  if (score >= 25) return 'Needs Attention';
  return 'Critical';
}

/**
 * Computes an individual member's retirement goal obligation without side effects.
 *
 * @param {Object} user
 * @param {Array} [goals=[]]
 * @returns {Object}
 */
export function calculateMemberGoalDetail(user = {}, goals = []) {
  const currentBalance = Number(user.currentBalance ?? 0);
  const monthlyIncome = Number(user.monthlyIncome ?? user.income ?? 0);

  let currentAge;
  if (user.dateOfBirth) {
    currentAge = Math.max(18, new Date().getFullYear() - new Date(user.dateOfBirth).getFullYear());
  } else {
    currentAge = Number(user.currentAge ?? user.age ?? 25);
  }

  const retirementAge = Number(user.retirementAge ?? 60);

  const retirementGoalObj = goals.find((g) => /retire/i.test(g.name)) || null;
  const retirementGoal = Number(
    user.retirementGoal ||
    retirementGoalObj?.targetAmount ||
    (user.retirementCorpusGoal > 0 ? user.retirementCorpusGoal : 0) ||
    Math.round(monthlyIncome * 12 * 20)
  );

  const previousShortfall = Number(user.previousShortfall ?? 0);

  const yearsLeft = Math.max(1, retirementAge - currentAge);
  const monthsLeft = yearsLeft * 12;
  const remainingGoal = Math.max(0, retirementGoal - currentBalance);
  const requiredMonthlySaving = monthsLeft > 0 ? remainingGoal / monthsLeft : 0;
  const requiredThisMonth = requiredMonthlySaving + previousShortfall;

  return {
    currentBalance,
    monthlyIncome,
    currentAge,
    retirementAge,
    retirementGoal,
    previousShortfall,
    yearsLeft,
    monthsLeft,
    remainingGoal,
    requiredMonthlySaving,
    requiredThisMonth
  };
}

/**
 * calculateFMI
 *
 * @param {Object} user
 * @param {Array} expenses — this month's Transaction documents
 * @returns {Object} full FMI result
 */
function calculateFMI(user = {}, expenses = []) {
  const now = new Date();

  // ── STEP 1: User Goal Model ──────────────────────────────
  const goalDetail = calculateMemberGoalDetail(user);
  const currentBalance    = goalDetail.currentBalance;
  const monthlyIncome     = goalDetail.monthlyIncome;
  const currentAge        = goalDetail.currentAge;
  const retirementAge     = goalDetail.retirementAge;
  const retirementGoal    = goalDetail.retirementGoal;
  const previousShortfall = goalDetail.previousShortfall;

  const yearsLeft  = goalDetail.yearsLeft;
  const monthsLeft = goalDetail.monthsLeft;
  const remainingGoal = goalDetail.remainingGoal;
  const requiredMonthlySaving = goalDetail.requiredMonthlySaving;
  const requiredThisMonth = goalDetail.requiredThisMonth;

  // ── STEP 2: Monthly Tracking ─────────────────────────────
  const totalSpent = expenses
    .filter(tx => tx.type !== 'Investment')
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

  const totalSaved = expenses
    .filter(tx => tx.type === 'Investment')
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

  // ── STEP 3: Prediction Model ─────────────────────────────
  const daysPassed   = dayOfMonth(now);
  const totalDays    = daysInMonth(now);
  const avgDailySpend = daysPassed > 0 ? totalSpent / daysPassed : 0;
  const predictedMonthlySpend = avgDailySpend * totalDays;

  // ── STEP 4: Track Status ─────────────────────────────────
  const availableMoney = Math.max(0, monthlyIncome - requiredThisMonth);

  // ── STEP 5: FMI Calculation (3 Pillars) ──────────────────

  // ▸ D1 — Saving Discipline (40%)
  const d1Result = calculateSavingDisciplineScore(totalSaved, requiredThisMonth);
  const d1Score = d1Result.score;
  const d1Detail = d1Result.detail;

  // ▸ D2 — Spending Control (30%)
  const d2Result = calculateSpendingControlScore(predictedMonthlySpend, availableMoney, totalSpent, monthlyIncome);
  const d2Score = d2Result.score;
  const d2Detail = d2Result.detail;
  const status = d2Result.status;

  // ▸ D3 — Behavioral Risk (30%)
  const patterns = detectBehavioralPatterns(expenses);

  let riskPenalty = 0;
  let riskFactors = [];

  // Late-night spending (> 11 PM or < 5 AM based on existing behavior detection)
  const lateNightPattern = patterns.find(p => p.type === 'late_night');
  if (lateNightPattern) {
    riskPenalty += 15;
    riskFactors.push(lateNightPattern.message);
  }

  // High wants %
  const wantsTxs = expenses.filter(tx => tx.type === 'Want');
  const needsTxs = expenses.filter(tx => tx.type === 'Need');
  const wantsTotal = wantsTxs.reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const needsTotal = needsTxs.reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const totalNonInvestment = wantsTotal + needsTotal;

  if (totalNonInvestment > 0 && wantsTotal > needsTotal) {
    const wantsPct = Math.round((wantsTotal / totalNonInvestment) * 100);
    riskPenalty += 15;
    riskFactors.push(`Wants (${wantsPct}%) exceed Needs — high discretionary spending`);
  }

  // Unusual spikes (anomaly cluster)
  const anomalyPattern = patterns.find(p => p.type === 'anomaly_cluster');
  if (anomalyPattern) {
    riskPenalty += 10;
    riskFactors.push(anomalyPattern.message);
  }

  // Impulse shopping
  const impulsePattern = patterns.find(p => p.type === 'impulse_shopping');
  if (impulsePattern) {
    riskPenalty += 8;
    riskFactors.push(impulsePattern.message);
  }

  // Food spike
  const foodPattern = patterns.find(p => p.type === 'food_spike');
  if (foodPattern) {
    riskPenalty += 5;
    riskFactors.push(foodPattern.message);
  }

  const d3Score = clamp(Math.round(100 - riskPenalty));
  const d3Detail = riskFactors.length === 0
    ? 'No risky spending behaviors detected'
    : `${riskFactors.length} risk factor(s) detected`;

  // ── FINAL FMI ────────────────────────────────────────────
  const { score: FMI, rawFMI } = calculateFinalFMIScore(d1Score, d2Score, d3Score);
  const fmiLabel = getFMILabel(FMI);

  // ── STEP 6: Insights ─────────────────────────────────────
  const insights = [];

  if (status === 'above') {
    insights.push(`You are projected to spend ${formatCurrency(predictedMonthlySpend)}, which is ${formatCurrency(predictedMonthlySpend - availableMoney)} over your budget`);
  } else if (status === 'below') {
    insights.push(`Great discipline! You are on track to save ${formatCurrency(availableMoney - predictedMonthlySpend)} extra this month`);
  }

  if (requiredThisMonth > 0) {
    const gap = requiredThisMonth - totalSaved;
    if (gap > 0) {
      insights.push(`You need to save ${formatCurrency(gap)} more this month to stay on target for retirement`);
    } else {
      insights.push(`You have met your savings target for this month — keep it up!`);
    }
  }

  if (riskFactors.length > 0) {
    insights.push(`Your spending pattern indicates ${riskFactors.length} behavioral risk(s)`);
  }

  // Prediction insight
  if (daysPassed < totalDays) {
    const daysLeft = totalDays - daysPassed;
    const dailyBudgetLeft = availableMoney > predictedMonthlySpend
      ? (availableMoney - totalSpent) / daysLeft
      : 0;
    if (dailyBudgetLeft > 0) {
      insights.push(`You can spend up to ${formatCurrency(dailyBudgetLeft)}/day for the next ${daysLeft} days`);
    }
  }

  // Pad to at least 2 insights
  if (insights.length < 2) {
    if (monthlyIncome > 0) {
      insights.push(`Your required monthly saving is ${formatCurrency(requiredMonthlySaving)} to meet your retirement goal`);
    }
    if (insights.length < 2) {
      insights.push('Track your daily expenses to keep your FMI score accurate');
    }
  }

  // ── STEP 7: Alerts ───────────────────────────────────────
  const alerts = [];

  if (status === 'above') {
    alerts.push({
      type: 'warning',
      severity: 'high',
      message: 'You are projected to overspend this month'
    });
  }

  if (requiredThisMonth > 0 && (totalSaved / requiredThisMonth) < 0.7) {
    alerts.push({
      type: 'warning',
      severity: 'medium',
      message: 'You are behind your savings goal for this month'
    });
  }

  if (totalNonInvestment > 0 && wantsTotal > needsTotal) {
    alerts.push({
      type: 'nudge',
      severity: 'medium',
      message: 'High discretionary spending detected — wants exceed needs'
    });
  }

  if (FMI < 30) {
    alerts.push({
      type: 'critical',
      severity: 'high',
      message: 'Your financial health is in the critical zone — take immediate action'
    });
  }

  // ── Build factors list for backward-compat with FMIHistory ─
  const factors = [
    `FMI: ${FMI}/100 (${fmiLabel})`,
    `D1 Saving: ${d1Score}/100 | D2 Spending: ${d2Score}/100 | D3 Behavior: ${d3Score}/100`,
    `Predicted Spend: ${formatCurrency(predictedMonthlySpend)} / Available: ${formatCurrency(availableMoney)}`,
    `Status: ${status === 'above' ? 'Overspending' : status === 'below' ? 'Safe' : 'On Track'}`,
    ...riskFactors.slice(0, 2)
  ];

  // ── RETURN ───────────────────────────────────────────────
  return {
    // Core metrics (spec shape)
    requiredMonthlySaving: Math.round(requiredMonthlySaving),
    requiredThisMonth:     Math.round(requiredThisMonth),
    totalSpent:            Math.round(totalSpent),
    totalSaved:            Math.round(totalSaved),
    predictedMonthlySpend: Math.round(predictedMonthlySpend),
    availableMoney:        Math.round(availableMoney),
    status,

    // Score
    FMI,
    score: FMI,          // backward compat for FMIHistory + dashboard
    fmiLabel,

    // Pillar breakdown (explainability)
    pillars: {
      D1_savingDiscipline: { score: d1Score, weight: 0.4, detail: d1Detail },
      D2_spendingControl:  { score: d2Score, weight: 0.3, detail: d2Detail },
      D3_behavioralRisk:   { score: d3Score, weight: 0.3, detail: d3Detail }
    },

    // Human-readable
    insights,
    alerts,

    // Backward compat for FMIHistory.factors
    factors,

    // Prediction detail
    prediction: {
      daysPassed,
      daysInMonth: totalDays,
      avgDailySpend: Math.round(avgDailySpend),
      predictedMonthlySpend: Math.round(predictedMonthlySpend)
    },

    // Goal detail
    goalDetail: {
      retirementGoal:  Math.round(retirementGoal),
      remainingGoal:   Math.round(remainingGoal),
      monthsLeft,
      yearsLeft
    }
  };
}

export { calculateFMI };

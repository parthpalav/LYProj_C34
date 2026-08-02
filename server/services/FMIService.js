/**
 * FMI Service — Deterministic, Goal-Based Financial Mood Index
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

function clamp(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, val));
}

function lerp(ratio, low, high) {
  return low + (high - low) * Math.min(1, Math.max(0, ratio));
}

function daysInMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function dayOfMonth(date = new Date()) {
  return date.getDate();
}

function formatCurrency(n) {
  return `₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`;
}

// ── Main Entry Point ─────────────────────────────────────────

/**
 * calculateFMI
 *
 * @param {Object} user
 *   - currentBalance   {number}
 *   - monthlyIncome    {number}
 *   - currentAge       {number}
 *   - retirementAge    {number}
 *   - retirementGoal   {number}
 *   - previousShortfall {number}  (optional, default 0)
 *
 * @param {Array} expenses — this month's Transaction documents
 *   Each: { amount, type, category, timestamp }
 *
 * @returns {Object} full FMI result (see FINAL OUTPUT in spec)
 */
function calculateFMI(user = {}, expenses = []) {
  const now = new Date();

  // ── STEP 1: User Goal Model ──────────────────────────────
  const currentBalance    = Number(user.currentBalance ?? 0);
  const monthlyIncome     = Number(user.monthlyIncome ?? 0);
  const currentAge        = Number(user.currentAge ?? 25);
  const retirementAge     = Number(user.retirementAge ?? 60);
  const retirementGoal    = Number(user.retirementGoal ?? (monthlyIncome * 12 * 20));
  const previousShortfall = Number(user.previousShortfall ?? 0);

  const yearsLeft  = Math.max(1, retirementAge - currentAge);
  const monthsLeft = yearsLeft * 12;
  const remainingGoal = Math.max(0, retirementGoal - currentBalance);
  const requiredMonthlySaving = monthsLeft > 0 ? remainingGoal / monthsLeft : 0;

  // ── STEP 2: Monthly Tracking ─────────────────────────────
  const totalSpent = expenses
    .filter(tx => tx.type !== 'Investment')
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

  const totalSaved = expenses
    .filter(tx => tx.type === 'Investment')
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

  const requiredThisMonth = requiredMonthlySaving + previousShortfall;

  // ── STEP 3: Prediction Model ─────────────────────────────
  const daysPassed   = dayOfMonth(now);
  const totalDays    = daysInMonth(now);
  const avgDailySpend = daysPassed > 0 ? totalSpent / daysPassed : 0;
  const predictedMonthlySpend = avgDailySpend * totalDays;

  // ── STEP 4: Track Status ─────────────────────────────────
  const availableMoney = Math.max(0, monthlyIncome - requiredThisMonth);

  let status;
  if (availableMoney <= 0) {
    // Edge case: required savings exceeds income
    status = predictedMonthlySpend > 0 ? 'above' : 'on_track';
  } else if (predictedMonthlySpend > availableMoney) {
    status = 'above';       // overspending
  } else if (predictedMonthlySpend >= 0.8 * availableMoney) {
    status = 'on_track';
  } else {
    status = 'below';       // safe / saving well
  }

  // ── STEP 5: FMI Calculation (3 Pillars) ──────────────────

  // ▸ D1 — Saving Discipline (40%)
  let d1Score;
  let d1Detail;
  if (requiredThisMonth <= 0) {
    // No savings requirement (goal met or no goal)
    d1Score = totalSaved > 0 ? 95 : 75;
    d1Detail = 'No savings requirement this month';
  } else {
    const savingRatio = totalSaved / requiredThisMonth;
    if (savingRatio >= 1) {
      d1Score = lerp(Math.min(savingRatio - 1, 0.5) * 2, 90, 100);
      d1Detail = `Saving ${Math.round(savingRatio * 100)}% of target — excellent`;
    } else if (savingRatio >= 0.7) {
      d1Score = lerp((savingRatio - 0.7) / 0.3, 60, 85);
      d1Detail = `Saving ${Math.round(savingRatio * 100)}% of target — on pace`;
    } else {
      d1Score = lerp(savingRatio / 0.7, 20, 60);
      d1Detail = `Only ${Math.round(savingRatio * 100)}% of target saved — falling behind`;
    }
  }
  d1Score = clamp(Math.round(d1Score));

  // ▸ D2 — Spending Control (30%)
  let d2Score;
  let d2Detail;
  if (availableMoney <= 0) {
    // All income needed for savings — any spending is over budget
    d2Score = totalSpent === 0 ? 80 : clamp(Math.round(40 - (totalSpent / (monthlyIncome || 1)) * 20));
    d2Detail = availableMoney === 0
      ? 'Entire income allocated to savings goal'
      : 'Required savings exceed income — budget under extreme pressure';
  } else {
    const spendRatio = predictedMonthlySpend / availableMoney;
    if (spendRatio <= 0.7) {
      d2Score = lerp(1 - spendRatio / 0.7, 80, 100);
      d2Detail = `Predicted spend is ${Math.round(spendRatio * 100)}% of budget — well controlled`;
    } else if (spendRatio <= 1) {
      d2Score = lerp((1 - spendRatio) / 0.3, 50, 80);
      d2Detail = `Predicted spend is ${Math.round(spendRatio * 100)}% of budget — moderate`;
    } else {
      d2Score = lerp(Math.max(0, 2 - spendRatio), 20, 50);
      d2Detail = `Predicted to overspend by ${formatCurrency(predictedMonthlySpend - availableMoney)}`;
    }
  }
  d2Score = clamp(Math.round(d2Score));

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
  const rawFMI = (d1Score * 0.4) + (d2Score * 0.3) + (d3Score * 0.3);
  const FMI = clamp(Math.round(rawFMI));

  // Label
  let fmiLabel;
  if (FMI >= 80)      fmiLabel = 'Excellent';
  else if (FMI >= 65) fmiLabel = 'Good';
  else if (FMI >= 45) fmiLabel = 'Fair';
  else if (FMI >= 25) fmiLabel = 'Needs Attention';
  else                fmiLabel = 'Critical';

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

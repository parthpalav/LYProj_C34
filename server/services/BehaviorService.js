/**
 * BehaviorService — Behavioral pattern detection + Financial Integrity Score (FIS)
 */

// ── Behavioral Pattern Detection ────────────────────────────

function detectBehavioralPatterns(transactions = []) {
  const patterns = [];
  if (!transactions.length) return patterns;

  const totalAvg = transactions.reduce((s, t) => s + t.amount, 0) / transactions.length;

  // 1. Food spike
  const foodTxs = transactions.filter((t) =>
    ['food', 'food-drink'].includes((t.category || '').toLowerCase())
  );
  if (foodTxs.length) {
    const foodAvg = foodTxs.reduce((s, t) => s + t.amount, 0) / foodTxs.length;
    if (foodAvg > totalAvg * 1.3) {
      patterns.push({
        type:    'food_spike',
        emoji:   '🍔',
        message: `Food spending is ${Math.round((foodAvg / totalAvg - 1) * 100)}% above your average transaction.`,
        severity: 'medium'
      });
    }
  }

  // 2. Late-night purchases
  const lateNight = transactions.filter((t) => {
    const h = new Date(t.timestamp).getHours();
    return h >= 22 || h <= 4;
  });
  if (lateNight.length >= 2) {
    patterns.push({
      type:    'late_night',
      emoji:   '🌙',
      message: `${lateNight.length} late-night purchases detected — possible impulse spending.`,
      severity: 'medium'
    });
  }

  // 3. High-frequency shopping
  const shoppingTxs = transactions.filter((t) =>
    ['shopping', 'entertainment'].includes((t.category || '').toLowerCase())
  );
  if (shoppingTxs.length >= 4) {
    patterns.push({
      type:    'impulse_shopping',
      emoji:   '🛍️',
      message: `${shoppingTxs.length} shopping transactions this period — consider a spending pause.`,
      severity: 'low'
    });
  }

  // 4. Anomaly cluster
  const anomalies = transactions.filter((t) => t.isAnomaly);
  if (anomalies.length >= 2) {
    patterns.push({
      type:    'anomaly_cluster',
      emoji:   '⚠️',
      message: `${anomalies.length} unusually large transactions detected this period.`,
      severity: 'high'
    });
  }

  return patterns;
}

// ── Financial Integrity Score (FIS) ─────────────────────────

/**
 * Calculates FIS (0–100) — a credit-like behavioral score.
 * Components:
 *   35% → Savings consistency (savings / targetSavings)
 *   35% → FMI stability (average recent FMI)
 *   30% → Positive behavior (proportion of non-anomaly, non-impulse transactions)
 */
function calculateFIS(transactions = [], fmiHistory = [], envelopes = null) {
  // Savings consistency
  const savingsRate = envelopes && envelopes.targetSavings > 0
    ? Math.min(1, envelopes.savings / envelopes.targetSavings)
    : 0;
  const savingsConsistency = Math.round(savingsRate * 100);

  // FMI stability
  const recentFMI = (fmiHistory || []).slice(-7).map((f) => f.score);
  const fmiStability = recentFMI.length
    ? Math.round(recentFMI.reduce((s, v) => s + v, 0) / recentFMI.length)
    : 50;

  // Behavior score
  const anomalyRate = transactions.length
    ? transactions.filter((t) => t.isAnomaly).length / transactions.length
    : 0;
  const impulseRate = transactions.length
    ? transactions.filter((t) => (t.tags || []).includes('impulse')).length / transactions.length
    : 0;
  const behaviorScore = Math.round((1 - anomalyRate * 0.5 - impulseRate * 0.3) * 100);

  const fis = Math.max(0, Math.min(100,
    Math.round(0.35 * savingsConsistency + 0.35 * fmiStability + 0.3 * behaviorScore)
  ));

  let grade = 'D';
  if (fis >= 80) grade = 'A';
  else if (fis >= 65) grade = 'B';
  else if (fis >= 50) grade = 'C';

  return {
    fis,
    grade,
    components: { savingsConsistency, fmiStability, behaviorScore }
  };
}

// ── Weekly Report ────────────────────────────────────────────

function generateWeeklyReport(transactions = [], fmiHistory = []) {
  const totalSpend = transactions.reduce((s, t) => s + t.amount, 0);

  // Category breakdown
  const catMap = {};
  transactions.forEach((t) => {
    const cat = t.category || 'other';
    catMap[cat] = (catMap[cat] || 0) + t.amount;
  });
  const topCategories = Object.entries(catMap)
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount),
      pct: totalSpend ? Math.round((amount / totalSpend) * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // FMI average
  const fmiAvg = fmiHistory.length
    ? Math.round(fmiHistory.reduce((s, f) => s + f.score, 0) / fmiHistory.length)
    : 0;

  // Anomaly count
  const anomalyCount = transactions.filter((t) => t.isAnomaly).length;

  // Behavioral patterns
  const patterns = detectBehavioralPatterns(transactions);

  return {
    totalSpend: Math.round(totalSpend),
    totalIncome: 0, // filled in by route
    topCategories,
    fmiAvg,
    savingsRate: 0, // filled by route
    anomalyCount,
    patterns
  };
}

export { detectBehavioralPatterns, calculateFIS, generateWeeklyReport };

/**
 * PredictionService — Anticipatory Financial Forecasting
 *
 * Uses real calendar math instead of hardcoded day counts.
 */

/**
 * predictMonthlySpend — Project total monthly spend from current-month transactions
 *
 * @param {Array} transactions — this month's expense transactions
 * @param {Date}  today — optional date override for testability
 * @returns {{ daysPassed, daysInMonth, avgDailySpend, predictedMonthlySpend, totalSpentSoFar }}
 */
function predictMonthlySpend(transactions = [], today = new Date()) {
  const daysPassed  = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  const totalSpentSoFar = transactions.reduce((acc, tx) => acc + Math.abs(tx.amount || 0), 0);

  const avgDailySpend = daysPassed > 0 ? totalSpentSoFar / daysPassed : 0;
  const predictedMonthlySpend = avgDailySpend * daysInMonth;

  return {
    daysPassed,
    daysInMonth,
    avgDailySpend:        Math.round(avgDailySpend),
    predictedMonthlySpend: Math.round(predictedMonthlySpend),
    totalSpentSoFar:       Math.round(totalSpentSoFar)
  };
}

/**
 * predictOverspend — Legacy overspend risk detector (used by dashboard + alerts)
 * Now uses real calendar math instead of hardcoded day values.
 */
function predictOverspend(userTransactions = [], currentBalance = 0) {
  if (!userTransactions.length) return { risk: 'low', predictedShortfall: 0 };

  const today      = new Date();
  const daysPassed = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(1, daysInMonth - daysPassed);

  const totalSpend = userTransactions.reduce((acc, tx) => acc + (tx.amount || 0), 0);

  const avgDailySpend = daysPassed > 0 ? totalSpend / daysPassed : 0;
  const predictedRemainingSpend = avgDailySpend * daysRemaining;

  const upcomingBills = currentBalance * 0.25; // Estimated 25% of balance for upcoming fixed costs
  const predictedShortfall = currentBalance - (predictedRemainingSpend + upcomingBills);

  let risk = 'low';
  if (predictedShortfall < 0) risk = 'high';
  else if (predictedShortfall < currentBalance * 0.1) risk = 'medium';

  return {
    risk,
    predictedShortfall: Math.max(0, Math.abs(predictedShortfall)),
    avgDailySpend: Math.round(avgDailySpend),
  };
}

function detectLowBalanceRisk(balance = 0, upcomingBills = 0, fmiScore = 50) {
  // Even if balance > upcomingBills, low FMI indicates high behavioral risk of breaking budget
  const effectiveBuffer = balance - upcomingBills;
  if (effectiveBuffer < 2000 || fmiScore < 45) {
    return true;
  }
  return false;
}

export { predictMonthlySpend, predictOverspend, detectLowBalanceRisk };
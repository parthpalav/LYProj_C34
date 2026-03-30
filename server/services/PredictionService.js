/**
 * PredictionService — Anticipatory Financial Forecasting
 */

function predictOverspend(userTransactions = [], currentBalance = 0) {
  if (!userTransactions.length) return { risk: 'low', predictedShortfall: 0 };
  
  // Calculate average daily spend over last 30 days or available data
  const totalSpend = userTransactions.reduce((acc, tx) => acc + (tx.amount || 0), 0);
  
  // Assuming 7 days of recent data for naive prediction
  const daysTracked = 7;
  const avgDailySpend = totalSpend / daysTracked;
  
  // Project to the end of the month (assume 10 days left for simulation purposes)
  const daysRemainingInMonth = 10;
  const predictedRemainingSpend = avgDailySpend * daysRemainingInMonth;
  
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

export { predictOverspend, detectLowBalanceRisk };
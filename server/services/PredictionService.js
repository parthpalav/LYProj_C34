function predictOverspend(userData) {
  const trend = userData.recentSpending || [];
  const avg = trend.reduce((sum, v) => sum + v, 0) / (trend.length || 1);
  const latest = trend[trend.length - 1] || 0;
  return latest > avg * 1.2;
}

function detectLowBalanceRisk(balance = 0, upcomingBills = 0) {
  return balance - upcomingBills < 3000;
}

// module.exports = {
//   predictOverspend,
//   detectLowBalanceRisk
// };
export { predictOverspend, detectLowBalanceRisk };
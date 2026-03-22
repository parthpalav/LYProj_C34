function calculateFMI({ spendingDeviation, sentimentScore, upcomingBills, incomeStability }) {
  const rawScore =
    100 -
    (0.35 * spendingDeviation * 100 +
      0.25 * (1 - sentimentScore) * 100 +
      0.2 * upcomingBills * 100 +
      0.2 * (1 - incomeStability) * 100);

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  let risk = 'low';

  if (score < 45) risk = 'high';
  else if (score < 70) risk = 'medium';

  const factors = [];
  if (spendingDeviation > 0.5) factors.push('High spending deviation');
  if (upcomingBills > 0.5) factors.push('Upcoming bills pressure');
  if (sentimentScore < 0.5) factors.push('Negative spending sentiment');

  return {
    score,
    risk,
    factors
  };
}

module.exports = {
  calculateFMI
};

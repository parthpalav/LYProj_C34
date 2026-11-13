/**
 * IncomeFlowService — Income smoothing & flow remixing for gig workers
 *
 * Uses a 50-30-20 allocation model:
 *   50% → Essentials (rent, food, bills)
 *   30% → Goals (savings, investments)
 *   20% → Emergency corpus
 */

function smoothIncomeFlow(incomes = []) {
  if (!incomes.length) {
    return {
      total: 0,
      dailySmoothed: 0,
      allocation: { essentials: 0, goals: 0, emergency: 0 },
      sources: {},
      timeline: []
    };
  }

  const total = incomes.reduce((s, i) => s + i.amount, 0);
  // Spread over the period the receipts cover (first to last, plus the month the last one pays for), never less than 30 days.
  const times = incomes.map((i) => new Date(i.timestamp).getTime()).filter(Number.isFinite);
  const spanDays = times.length ? (Math.max(...times) - Math.min(...times)) / 86400000 + 30 : 30;
  const dailySmoothed = Math.round(total / Math.max(30, spanDays));

  // 50-30-20 allocation
  const essentials = Math.round(total * 0.50);
  const goals      = Math.round(total * 0.30);
  const emergency  = Math.round(total * 0.20);

  // Source breakdown
  const sources = incomes.reduce((acc, i) => {
    const src = i.source || 'other';
    acc[src] = (acc[src] || 0) + i.amount;
    return acc;
  }, {});

  // Timeline (sorted by date)
  const timeline = [...incomes]
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((i) => ({
      id:        i.id || i._id?.toString(),
      amount:    i.amount,
      source:    i.source,
      description: i.description,
      timestamp: i.timestamp
    }));

  // Volatility: std dev of income amounts
  const avg = total / incomes.length;
  const variance = incomes.reduce((s, i) => s + Math.pow(i.amount - avg, 2), 0) / incomes.length;
  const stdDev = Math.sqrt(variance);
  const volatility = avg > 0 ? Math.round((stdDev / avg) * 100) : 0;

  return {
    total,
    dailySmoothed,
    allocation: { essentials, goals, emergency },
    sources,
    timeline,
    volatility,
    incomeCount: incomes.length
  };
}

export { smoothIncomeFlow };

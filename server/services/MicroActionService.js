/**
 * MicroActionService — Preventive Nudges & Envelopes
 */

function applyRoundup(tx) {
  // Rounds up to nearest 100
  const rounded = Math.ceil(tx.amount / 100) * 100;
  return rounded - tx.amount;
}

function allocateToEnvelope(envelopes, amount, target = 'savings') {
  if (!envelopes) return null;
  const updated = { ...envelopes };
  updated[target] = (updated[target] || 0) + amount;
  return updated;
}

function generateMicroActions(fmiScore, predictionData = {}) {
  const actions = [];
  
  // Action 1: No Spend Day suggestion if FMI is low or risk is high
  if (fmiScore < 50 || predictionData.risk === 'high') {
    actions.push({
      id: `ma-${Date.now()}-1`,
      type: 'no-spend',
      title: 'Declare a No-Spend Day',
      description: 'Pause all non-essential purchases for 24 hours to stabilize your FMI.',
      actionText: 'Activate Mode',
      impact: '+5 FMI'
    });
  }

  // Action 2: Daily Envelope Constraint
  if (predictionData.avgDailySpend > 1000) {
    actions.push({
      id: `ma-${Date.now()}-2`,
      type: 'daily-cap',
      title: 'Enable Daily Spending Cap',
      description: `Your average is ₹${predictionData.avgDailySpend}/day. Lock an envelope at ₹${Math.max(500, predictionData.avgDailySpend - 300)} to curb deviation.`,
      actionText: 'Set Limit',
      impact: `Save ₹300/day`
    });
  }
  
  // Action 3: Roundup (Always active)
  actions.push({
    id: `ma-${Date.now()}-3`,
    type: 'roundup',
    title: 'Enable Spare Change Roundups',
    description: 'Finaura will intercept loose change on every transaction and route it to your Emergency fund.',
    actionText: 'Enable Roundups',
    impact: 'Automated Savings'
  });

  return actions;
}

export { applyRoundup, allocateToEnvelope, generateMicroActions };
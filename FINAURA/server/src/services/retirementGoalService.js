export function evaluateRetirementGoal(user) {
  // Simple feasibility model based on required monthly savings vs income.
  const age = Number(user?.age || 0);
  const retirementAge = Number(user?.retirementAge || 0);
  const corpus = Number(user?.retirementCorpusGoal || 0);
  const income = Number(user?.income || 0);

  if (!age || !retirementAge || !corpus || !income) {
    return {
      status: 'unknown',
      summary: 'Retirement goal inputs are incomplete.',
      guidance: ['Complete onboarding to unlock retirement feasibility insights.']
    };
  }

  const yearsLeft = Math.max(1, retirementAge - age);
  const monthsLeft = yearsLeft * 12;
  const requiredMonthlySavings = corpus / monthsLeft;
  const savingPct = income > 0 ? requiredMonthlySavings / income : 1;

  let status = 'achievable';
  if (savingPct > 0.35) status = 'unrealistic';
  else if (savingPct > 0.2) status = 'difficult';

  const summary = `You need to save ₹${Math.round(requiredMonthlySavings).toLocaleString('en-IN')} per month to reach ₹${Math.round(corpus).toLocaleString('en-IN')} by age ${retirementAge}.`;
  const guidance = [
    'Consider SIP-style disciplined investing.',
    'Keep an emergency fund before aggressive saving.',
    'Reduce discretionary spending to improve your monthly saving rate.'
  ];

  return {
    yearsLeft,
    monthsLeft,
    requiredMonthlySavings,
    savingPct,
    status,
    summary,
    guidance
  };
}

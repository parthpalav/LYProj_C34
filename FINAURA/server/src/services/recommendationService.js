export function buildRecommendations({ user, retirement, fmi, monthlySplit }) {
  const actions = [];

  if (monthlySplit?.WANT > monthlySplit?.NEED) {
    actions.push('Reduce discretionary spending this month by 10-15%.');
  }

  if (retirement?.status === 'difficult' || retirement?.status === 'unrealistic') {
    actions.push('Consider increasing your monthly saving rate toward retirement.');
  }

  if (fmi?.score && fmi.score < 55) {
    actions.push('Stabilize essentials and build a small emergency buffer.');
  }

  actions.push('Consider SIP-style disciplined investing for long-term goals.');
  actions.push('Keep needs stable and review large wants before committing.');

  return actions.slice(0, 5);
}

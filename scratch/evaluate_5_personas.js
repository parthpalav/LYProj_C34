import { buildPredictabilitySnapshotAsync } from '../server/services/PredictabilityService.js';

async function runPersona(label, data, options = {}) {
  console.log(`\n==================================================`);
  console.log(`  ${label}`);
  console.log(`==================================================`);

  const opts = { referenceDate: '2026-06-15', ...options };
  const finalSnapshot = await buildPredictabilitySnapshotAsync(data, opts);

  const user = data.user || {};
  const income = finalSnapshot.income || {};
  const ret = finalSnapshot.retirement || {};
  const prob = finalSnapshot.probabilistic || {};
  const ef = prob.estimatedFire || {};
  const rec = prob.contributionRecommendation || {};
  const feas = rec.feasibility || {};
  const pg = finalSnapshot.proactiveGuidance || {};

  console.log(`Age:                         ${finalSnapshot.retirement?.currentAge ?? user.age}`);
  console.log(`Retirement Age:              ${finalSnapshot.retirement?.retirementAge ?? user.retirementAge}`);
  console.log(`Months to Retirement:        ${finalSnapshot.retirement?.monthsUntilRetirement}`);
  console.log(`Income (Mean / Stated):      ₹${Math.round(income.meanMonthlyIncome || user.monthlyIncome || 0).toLocaleString('en-IN')}`);
  console.log(`Reliable Monthly Income:     ₹${Math.round(income.reliableMonthlyIncome || income.meanMonthlyIncome || user.monthlyIncome || 0).toLocaleString('en-IN')}`);
  console.log(`Income CV:                   ${income.coefficientOfVariation != null ? income.coefficientOfVariation.toFixed(2) : 'N/A'}`);
  console.log(`Investable Corpus:           ₹${Math.round(finalSnapshot.assets?.fireInvestableCorpus || 0).toLocaleString('en-IN')}`);
  console.log(`Monthly Contribution Used:   ₹${Math.round(ret.monthlyContributionUsed || 0).toLocaleString('en-IN')}`);
  console.log(`FIRE Target:                 ₹${Math.round(ret.estimatedFireCorpus || 0).toLocaleString('en-IN')}`);
  console.log(`Projected Corpus (Base):     ₹${Math.round(ret.projectedCorpusAtRetirement || 0).toLocaleString('en-IN')}`);
  console.log(`Funding Probability:         ${ef.probabilityFundedAtTargetAge != null ? (ef.probabilityFundedAtTargetAge * 100).toFixed(1) + '%' : 'N/A'}`);
  console.log(`Recommended Monthly SIP:     ${rec.recommendedMonthlyContribution != null ? '₹' + Math.round(rec.recommendedMonthlyContribution).toLocaleString('en-IN') : 'N/A'}`);
  console.log(`Additional SIP Required:     ${rec.additionalMonthlyContributionRequired != null ? '₹' + Math.round(rec.additionalMonthlyContributionRequired).toLocaleString('en-IN') : 'N/A'}`);
  console.log(`Feasibility Status:          ${feas.status || 'N/A'}`);
  console.log(`Funded Age (50%):            ${ef.fundedAge50?.reached ? 'Age ' + ef.fundedAge50.ageYears.toFixed(1) : 'Not reached in horizon'}`);
  console.log(`Funded Age (75%):            ${ef.fundedAge75?.reached ? 'Age ' + ef.fundedAge75.ageYears.toFixed(1) : 'Not reached in horizon'}`);
  console.log(`Retirement Alternatives:     ${prob.retirementAlternatives ? prob.retirementAlternatives.map(a => `+${a.yearsExtended}y (age ${a.targetAge}: ₹${Math.round(a.recommendedMonthlyContribution).toLocaleString('en-IN')}/mo)`).join(', ') : 'None (not needed)'}`);
  console.log(`Proactive Status:            ${pg.status}`);
  console.log(`Proactive Priority:          ${pg.priority}`);
  console.log(`Proactive Headline:          "${pg.headline}"`);
  console.log(`Proactive Action Type:       ${pg.actionType}`);
  console.log(`Proactive Variable-Income:   ${pg.isVariableIncome}`);
  console.log(`Proactive Baseline Type:     ${pg.investmentBaseline}`);
}

function makeTxs(months, needs, wants, invest) {
  const txs = [];
  const ref = new Date('2026-06-15');
  for (let m = 1; m <= months; m++) {
    const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - m, 10));
    if (needs > 0) txs.push({ amount: needs, type: 'Need', timestamp: d, category: 'Bills' });
    if (wants > 0) txs.push({ amount: wants, type: 'Want', timestamp: d, category: 'Shopping' });
    if (invest > 0) txs.push({ amount: invest, type: 'Investment', timestamp: d, category: 'Mutual Funds' });
  }
  return txs;
}

async function main() {
  // PERSONA A — ON TRACK (High existing corpus + disciplined savings)
  await runPersona('PERSONA A — ON TRACK (Stable Salaried, Healthy Savings)', {
    user: { age: 30, retirementAge: 60, monthlyIncome: 150000 },
    transactions: makeTxs(6, 35000, 15000, 50000),
    assets: [
      { assetClass: 'FIRE_INVESTABLE', assetType: 'Mutual Funds', currentValue: 4000000, includedInFireCorpus: true, liquidity: 'liquid' },
      { assetClass: 'FIRE_INVESTABLE', assetType: 'EPF', currentValue: 2000000, includedInFireCorpus: true, liquidity: 'semi-liquid' }
    ]
  });

  // PERSONA B — SMALL GAP (Moderate investment, Manageable increase)
  await runPersona('PERSONA B — SMALL GAP (Salaried, Needs Moderate Increase)', {
    user: { age: 30, retirementAge: 60, monthlyIncome: 90000 },
    transactions: makeTxs(6, 30000, 15000, 20000),
    assets: [
      { assetClass: 'FIRE_INVESTABLE', assetType: 'Mutual Funds', currentValue: 1500000, includedInFireCorpus: true, liquidity: 'liquid' }
    ]
  });

  // PERSONA C — LARGE GAP (Underfunded / Shorter horizon, Action Needed)
  await runPersona('PERSONA C — LARGE GAP (Late Starter / High Gap)', {
    user: { age: 48, retirementAge: 58, monthlyIncome: 80000 },
    transactions: makeTxs(6, 45000, 15000, 5000),
    assets: [
      { assetClass: 'FIRE_INVESTABLE', assetType: 'Mutual Funds', currentValue: 200000, includedInFireCorpus: true, liquidity: 'liquid' }
    ]
  });

  // PERSONA D — GIG WORKER (Variable income, elevated CV >= 0.5)
  const gigIncomes = [
    { amount: 35000, timestamp: '2026-01-15' },
    { amount: 120000, timestamp: '2026-02-15' },
    { amount: 25000, timestamp: '2026-03-15' },
    { amount: 130000, timestamp: '2026-04-15' },
    { amount: 30000, timestamp: '2026-05-15' },
    { amount: 95000, timestamp: '2026-06-15' }
  ];
  await runPersona('PERSONA D — GIG WORKER (Multiple sources, Variable Income)', {
    user: { age: 32, retirementAge: 60, monthlyIncome: 72500 },
    incomes: gigIncomes,
    transactions: makeTxs(6, 25000, 10000, 15000),
    assets: [
      { assetClass: 'FIRE_INVESTABLE', assetType: 'Mutual Funds', currentValue: 800000, includedInFireCorpus: true, liquidity: 'liquid' }
    ]
  });

  // PERSONA E — ZERO INVESTOR (Valid spending history, ₹0 current investment)
  await runPersona('PERSONA E — ZERO INVESTOR (No Current Investments)', {
    user: { age: 28, retirementAge: 60, monthlyIncome: 75000 },
    transactions: makeTxs(6, 32000, 18000, 0), // 0 investment transactions
    assets: [
      { assetClass: 'FIRE_INVESTABLE', assetType: 'Bank', currentValue: 100000, includedInFireCorpus: true, liquidity: 'liquid' }
    ]
  });
}

main().catch(console.error);

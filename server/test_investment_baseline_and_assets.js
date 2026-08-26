/**
 * server/test_investment_baseline_and_assets.js
 * 
 * Comprehensive audit & verification test suite for:
 * 1. Explicit zero monthly contribution (KNOWN_ZERO)
 * 2. Unknown monthly contribution (UNKNOWN)
 * 3. Asset classifications (FIRE_INVESTABLE, SEMI_LIQUID, NON_INVESTABLE)
 * 4. Fixed Deposit, Cash, Bank balance, and Mutual Fund asset treatments
 * 5. Separation between startingCorpus (stock) and monthlyContribution (flow)
 * 6. Non-double-counting of currentBalance vs Asset records
 * 7. Predictability & Monte Carlo execution with zero contribution
 * 8. All 8 canonical test personas (A through H)
 */

import assert from 'node:assert/strict';
import { buildPredictabilitySnapshot, buildPredictabilitySnapshotAsync } from './services/PredictabilityService.js';
import { resolveForecastInputs } from './utils/forecastResolver.js';
import { calculateInvestableCorpus } from './utils/financialMath.js';
import { buildMonteCarloPayload, attachMonteCarloSimulation } from './utils/monteCarloAdapter.js';

console.log('================================================================');
console.log('  FINAURA INVESTMENT BASELINE & ASSET TREATMENT AUDIT SUITE');
console.log('================================================================\n');

// Helper to create synthetic monthly transactions for N months
function createTransactions(monthsCount, needsPerMonth, wantsPerMonth, investPerMonth, refDateStr = '2026-06-15') {
  const refDate = new Date(refDateStr);
  const txs = [];
  for (let m = 1; m <= monthsCount; m++) {
    const d = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() - m, 10));
    if (needsPerMonth > 0) {
      txs.push({ amount: needsPerMonth, type: 'Need', timestamp: d, category: 'Bills', description: 'Essential Living' });
    }
    if (wantsPerMonth > 0) {
      txs.push({ amount: wantsPerMonth, type: 'Want', timestamp: d, category: 'Shopping', description: 'Discretionary' });
    }
    if (investPerMonth > 0) {
      txs.push({ amount: investPerMonth, type: 'Investment', timestamp: d, category: 'Misc', description: 'Mutual Fund SIP' });
    }
  }
  return txs;
}

const refDate = new Date('2026-06-15');

// ── TEST 1: ASSET CLASSIFICATION & FIRE ELIGIBILITY MATRIX ─────────
console.log('Running Test 1: Asset Classification & FIRE Eligibility Matrix...');

const testAssets = [
  // 1. Bank Account (SEMI_LIQUID, liquid) - not in FIRE by default
  { id: 'a1', name: 'HDFC Savings', assetType: 'Bank Account', assetClass: 'SEMI_LIQUID', currentValue: 200000, includedInFireCorpus: false, liquidity: 'liquid' },
  // 2. Fixed Deposit (FIRE_INVESTABLE, locked) - in FIRE
  { id: 'a2', name: 'SBI 5-Year FD', assetType: 'Fixed Deposit', assetClass: 'FIRE_INVESTABLE', currentValue: 1000000, includedInFireCorpus: true, liquidity: 'locked' },
  // 3. Mutual Funds (FIRE_INVESTABLE, liquid) - in FIRE
  { id: 'a3', name: 'Nifty 50 Index', assetType: 'Mutual Fund', assetClass: 'FIRE_INVESTABLE', currentValue: 2500000, includedInFireCorpus: true, liquidity: 'liquid' },
  // 4. Primary Residence Real Estate (NON_INVESTABLE) - strictly excluded from FIRE
  { id: 'a4', name: 'Primary Home', assetType: 'Real Estate', assetClass: 'NON_INVESTABLE', currentValue: 15000000, includedInFireCorpus: false, liquidity: 'illiquid' },
  // 5. EPF (FIRE_INVESTABLE, locked) - in FIRE
  { id: 'a5', name: 'EPF Balance', assetType: 'EPF', assetClass: 'FIRE_INVESTABLE', currentValue: 800000, includedInFireCorpus: true, liquidity: 'locked' },
  // 6. Gold Jewelry (NON_INVESTABLE) - excluded
  { id: 'a6', name: 'Family Jewelry', assetType: 'Gold', assetClass: 'NON_INVESTABLE', currentValue: 500000, includedInFireCorpus: false, liquidity: 'semi-liquid' },
  // 7. Sovereign Gold Bond (FIRE_INVESTABLE) - in FIRE
  { id: 'a7', name: 'SGB Tranche 2024', assetType: 'Gold', assetClass: 'FIRE_INVESTABLE', currentValue: 300000, includedInFireCorpus: true, liquidity: 'semi-liquid' }
];

const investableResult = calculateInvestableCorpus(testAssets);
assert.equal(investableResult.includedTotal, 1000000 + 2500000 + 800000 + 300000, 'FIRE corpus = FD (10L) + MF (25L) + EPF (8L) + SGB (3L) = 46L');
assert.equal(investableResult.excludedTotal, 200000 + 15000000 + 500000, 'Excluded = Savings (2L) + Home (1.5Cr) + Jewelry (5L) = 1.57Cr');
assert.equal(investableResult.includedAssets.length, 4);
assert.equal(investableResult.excludedAssets.length, 3);

// Verify liquid emergency buffer calculation
const resolvedAssets = resolveForecastInputs({
  user: { age: 30, retirementAge: 60 },
  assets: testAssets,
  transactions: createTransactions(6, 40000, 20000, 10000)
}, { referenceDate: refDate });

assert.equal(resolvedAssets.fireInvestableCorpus, 4600000, 'FIRE Investable Corpus is exactly 46L');
assert.equal(resolvedAssets.liquidBuffer, 200000, 'Liquid Buffer is exactly 2L (only Bank Account matches isLiquid & liquid)');
assert.equal(resolvedAssets.totalAssetValue, 20300000, 'Total Asset Value is 2.03 Cr');
assert.equal(resolvedAssets.knownNetWorth, 20300000, 'Known Net Worth is 2.03 Cr (no debt)');

console.log('  ✅ Test 1 Passed: Asset classification, FIRE eligibility, and liquid buffer verified\n');


// ── TEST 2: NON-DOUBLE-COUNTING OF CURRENT BALANCE VS ASSETS ─────────
console.log('Running Test 2: Non-Double-Counting Audit (currentBalance vs Assets)...');

const doubleCountCheck = buildPredictabilitySnapshot({
  user: { id: 'u_dc', age: 30, retirementAge: 60, currentBalance: 1000000, monthlyIncome: 100000 },
  assets: [
    { id: 'a_bank', name: 'Bank FD', assetType: 'Fixed Deposit', assetClass: 'FIRE_INVESTABLE', currentValue: 1000000, includedInFireCorpus: true, liquidity: 'locked' }
  ],
  transactions: createTransactions(6, 40000, 10000, 0)
}, { referenceDate: refDate });

assert.equal(doubleCountCheck.currentState.currentBalance, 1000000, 'Operating currentBalance is 10L');
assert.equal(doubleCountCheck.assets.fireInvestableCorpus, 1000000, 'FIRE corpus is 10L from Asset document (NOT 20L)');
assert.equal(doubleCountCheck.assets.totalAssetValue, 1000000, 'Total asset value is 10L (NOT 20L)');
assert.equal(doubleCountCheck.assets.knownNetWorth, 1000000, 'Net worth is 10L (NOT 20L)');

console.log('  ✅ Test 2 Passed: Zero double-counting between User.currentBalance and Asset records\n');


// ── TEST 3: ZERO-CONTRIBUTION MONTE CARLO & PREDICTABILITY ──────────
console.log('Running Test 3: Zero-Contribution Predictability & Monte Carlo Execution...');

const zeroContribData = {
  user: { id: 'u_zero', age: 35, retirementAge: 60, monthlyIncome: 100000 },
  assets: [
    { id: 'a_mf', name: 'Mutual Funds', assetType: 'Mutual Fund', assetClass: 'FIRE_INVESTABLE', currentValue: 2000000, includedInFireCorpus: true, liquidity: 'liquid' }
  ],
  transactions: createTransactions(6, 40000, 20000, 0) // 0 investment transactions
};

const zeroContribSnapshot = await buildPredictabilitySnapshotAsync(zeroContribData, { referenceDate: refDate });

assert.equal(zeroContribSnapshot.forecastStatus.available, true, 'Forecast is available with zero investment');
assert.equal(zeroContribSnapshot.retirement.monthlyContributionUsed, 0, 'monthlyContributionUsed is exactly 0');
assert.equal(zeroContribSnapshot.currentState.observedAverageMonthlyInvestment, 0, 'observed investment is 0');
assert.equal(zeroContribSnapshot.assets.fireInvestableCorpus, 2000000, 'starting corpus is 20L');

// Verify deterministic compound growth with zero contribution
assert.ok(zeroContribSnapshot.retirement.projectedCorpusAtRetirement > 2000000, 'Corpus grows via compounding alone');
assert.ok(zeroContribSnapshot.retirement.requiredMonthlyContributionForEstimatedFire > 0, 'Required contribution is solved positive');

// Verify Monte Carlo simulation execution with zero contribution
assert.equal(zeroContribSnapshot.probabilistic.available, true, 'Monte Carlo runs successfully with 0 contribution');
assert.equal(zeroContribSnapshot.probabilistic.contributionRecommendation.currentMonthlyContribution, 0, 'MC received currentMonthlyContribution = 0');
assert.ok(typeof zeroContribSnapshot.probabilistic.estimatedFire.probabilityFundedAtTargetAge === 'number', 'Calculated valid probability');
assert.ok(zeroContribSnapshot.probabilistic.contributionRecommendation.solved, 'Solver solved required monthly contribution');
assert.ok(zeroContribSnapshot.probabilistic.contributionRecommendation.recommendedMonthlyContribution > 0, 'Recommended contribution > 0');
assert.equal(
  zeroContribSnapshot.probabilistic.contributionRecommendation.recommendedMonthlyContribution,
  zeroContribSnapshot.probabilistic.contributionRecommendation.additionalMonthlyContributionRequired,
  'When current contribution is 0, recommended == additional required'
);

console.log('  ✅ Test 3 Passed: Predictability and Monte Carlo execute seamlessly with monthlyContribution = 0\n');


// ── TEST 4: ALL 8 CANONICAL TEST PERSONAS (A THROUGH H) ──────────────
console.log('Running Test 4: Auditing 8 Canonical Test Personas (A through H)...');

// PERSONA A: No assets (0), No monthly investment (0), but active spending history
const pA_data = {
  user: { id: 'pA', age: 30, retirementAge: 60, monthlyIncome: 60000 },
  assets: [],
  transactions: createTransactions(6, 30000, 15000, 0)
};
const pA_snap = await buildPredictabilitySnapshotAsync(pA_data, { referenceDate: refDate });
assert.equal(pA_snap.forecastStatus.available, true);
assert.equal(pA_snap.assets.fireInvestableCorpus, 0);
assert.equal(pA_snap.retirement.monthlyContributionUsed, 0);
assert.equal(pA_snap.probabilistic.estimatedFire.probabilityFundedAtTargetAge, 0.0, '0 corpus + 0 contribution -> 0% probability');
assert.ok(pA_snap.probabilistic.contributionRecommendation.recommendedMonthlyContribution > 0);
console.log('  ✅ Persona A (0 assets, 0 investment): Handled cleanly (0% probability, positive recommendation)');

// PERSONA B: ₹10L FD, ₹0 monthly investment
const pB_data = {
  user: { id: 'pB', age: 40, retirementAge: 60, monthlyIncome: 80000 },
  assets: [{ id: 'pB_fd', assetType: 'Fixed Deposit', assetClass: 'FIRE_INVESTABLE', currentValue: 1000000, includedInFireCorpus: true, liquidity: 'locked' }],
  transactions: createTransactions(6, 40000, 15000, 0)
};
const pB_snap = await buildPredictabilitySnapshotAsync(pB_data, { referenceDate: refDate });
assert.equal(pB_snap.assets.fireInvestableCorpus, 1000000);
assert.equal(pB_snap.retirement.monthlyContributionUsed, 0);
assert.ok(pB_snap.retirement.projectedCorpusAtRetirement > 1000000);
console.log('  ✅ Persona B (10L FD, 0 investment): FD compounds to retirement with 0 ongoing SIP');

// PERSONA C: ₹10L mutual funds, ₹0 monthly investment
const pC_data = {
  user: { id: 'pC', age: 40, retirementAge: 60, monthlyIncome: 80000 },
  assets: [{ id: 'pC_mf', assetType: 'Mutual Fund', assetClass: 'FIRE_INVESTABLE', currentValue: 1000000, includedInFireCorpus: true, liquidity: 'liquid' }],
  transactions: createTransactions(6, 40000, 15000, 0)
};
const pC_snap = await buildPredictabilitySnapshotAsync(pC_data, { referenceDate: refDate });
assert.equal(pC_snap.assets.fireInvestableCorpus, 1000000);
assert.equal(pC_snap.retirement.monthlyContributionUsed, 0);
console.log('  ✅ Persona C (10L Mutual Funds, 0 investment): Equates identically to investable starting corpus');

// PERSONA D: ₹0 assets, ₹30k monthly investments
const pD_data = {
  user: { id: 'pD', age: 25, retirementAge: 60, monthlyIncome: 80000 },
  assets: [],
  transactions: createTransactions(6, 30000, 10000, 30000)
};
const pD_snap = await buildPredictabilitySnapshotAsync(pD_data, { referenceDate: refDate });
assert.equal(pD_snap.assets.fireInvestableCorpus, 0);
assert.equal(pD_snap.retirement.monthlyContributionUsed, 30000);
assert.ok(pD_snap.probabilistic.estimatedFire.probabilityFundedAtTargetAge > 0.30, '30k SIP over 35 years gives substantial probability (42%)');
console.log('  ✅ Persona D (0 assets, 30k SIP): Starting corpus 0, pure accumulation from monthly flow');

// PERSONA E: ₹10L assets, ₹30k monthly investments
const pE_data = {
  user: { id: 'pE', age: 30, retirementAge: 60, monthlyIncome: 100000 },
  assets: [{ id: 'pE_mf', assetType: 'Mutual Fund', assetClass: 'FIRE_INVESTABLE', currentValue: 1000000, includedInFireCorpus: true, liquidity: 'liquid' }],
  transactions: createTransactions(6, 40000, 15000, 30000)
};
const pE_snap = await buildPredictabilitySnapshotAsync(pE_data, { referenceDate: refDate });
assert.equal(pE_snap.assets.fireInvestableCorpus, 1000000);
assert.equal(pE_snap.retirement.monthlyContributionUsed, 30000);
assert.ok(pE_snap.retirement.projectedCorpusAtRetirement > pD_snap.retirement.projectedCorpusAtRetirement, 'Corpus + SIP > SIP alone');
console.log('  ✅ Persona E (10L assets + 30k SIP): Both stock and flow combined accurately');

// PERSONA F: Investment baseline UNKNOWN (0 transactions, no override)
const pF_data = {
  user: { id: 'pF', age: 30, retirementAge: 60, monthlyIncome: 100000 },
  assets: [{ id: 'pF_mf', assetType: 'Mutual Fund', assetClass: 'FIRE_INVESTABLE', currentValue: 1000000, includedInFireCorpus: true, liquidity: 'liquid' }],
  transactions: [] // 0 transactions
};
const pF_snap = buildPredictabilitySnapshot(pF_data, { referenceDate: refDate });
assert.equal(pF_snap.forecastStatus.available, false);
assert.ok(pF_snap.forecastStatus.missingInputs.includes('MISSING_INVESTMENT_BASELINE'));
assert.ok(pF_snap.forecastStatus.missingInputs.includes('INSUFFICIENT_SPENDING_HISTORY'));
assert.equal(pF_snap.retirement, null, 'retirement is null when forecast inputs are unavailable');
console.log('  ✅ Persona F (UNKNOWN baseline, 0 transactions): Gated cleanly as unavailable');

// PERSONA G: Explicit zero investment baseline via override/profile
const pG_data = {
  user: { id: 'pG', age: 30, retirementAge: 60, monthlyIncome: 100000 },
  assets: [{ id: 'pG_mf', assetType: 'Mutual Fund', assetClass: 'FIRE_INVESTABLE', currentValue: 1000000, includedInFireCorpus: true, liquidity: 'liquid' }],
  transactions: createTransactions(6, 40000, 15000, 0)
};
const pG_snap = buildPredictabilitySnapshot(pG_data, { referenceDate: refDate, monthlyContributionOverride: 0 });
assert.equal(pG_snap.retirement.monthlyContributionUsed, 0, 'Explicit 0 recognized');
assert.ok(!pG_snap.forecastStatus.missingInputs.includes('MISSING_INVESTMENT_BASELINE'), 'MISSING_INVESTMENT_BASELINE cleared by explicit 0');
console.log('  ✅ Persona G (Explicit 0 override): Accepts 0 without forcing fake transactions');

// PERSONA H: Bank balance + Asset record that might duplicate cash
const pH_data = {
  user: { id: 'pH', age: 30, retirementAge: 60, currentBalance: 500000, monthlyIncome: 100000 },
  assets: [
    { id: 'pH_cash_ast', assetType: 'Bank Account', assetClass: 'SEMI_LIQUID', currentValue: 500000, includedInFireCorpus: false, liquidity: 'liquid' },
    { id: 'pH_mf', assetType: 'Mutual Fund', assetClass: 'FIRE_INVESTABLE', currentValue: 1000000, includedInFireCorpus: true, liquidity: 'liquid' }
  ],
  transactions: createTransactions(6, 40000, 10000, 20000)
};
const pH_snap = await buildPredictabilitySnapshotAsync(pH_data, { referenceDate: refDate });
assert.equal(pH_snap.currentState.currentBalance, 500000, 'Operating currentBalance is 5L');
assert.equal(pH_snap.assets.fireInvestableCorpus, 1000000, 'FIRE corpus is 10L (only MF, NOT cash asset or currentBalance)');
assert.equal(pH_snap.assets.liquidBuffer, 500000, 'Liquid emergency buffer is 5L from Bank Asset');
assert.equal(pH_snap.assets.totalAssetValue, 1500000, 'Total recorded assets = 5L + 10L = 15L');
assert.equal(pH_snap.assets.knownNetWorth, 1500000, 'Known Net Worth = 15L');
console.log('  ✅ Persona H (Bank balance + Cash asset): Strict boundary maintained between operating balance and FIRE assets\n');

console.log('================================================================');
console.log('  ALL INVESTMENT BASELINE & ASSET AUDIT TESTS PASSED! 🚀');
console.log('================================================================');

/**
 * server/test_predictability_step_up.js
 * 
 * Comprehensive test suite for STEP_UP SIP / Annual Contribution Escalation
 * in Node PredictabilityService, FinancialMath, and Monte Carlo Adapter.
 */

import assert from 'node:assert/strict';
import {
  futureValueStepUp,
  futureValueStepUpContributions,
  requiredStepUpContribution,
  projectedCorpusAtRetirement,
  monthsToTarget,
  CONTRIBUTION_MODE
} from './utils/financialMath.js';
import {
  buildPredictabilitySnapshot,
  buildPredictabilitySnapshotAsync
} from './services/PredictabilityService.js';
import {
  buildMonteCarloPayload,
  deriveMonteCarloSeed
} from './utils/monteCarloAdapter.js';

console.log('================================================================');
console.log('  FINAURA PREDICTABILITY ENGINE V2.1 — STEP-UP SIP TEST SUITE');
console.log('================================================================\n');

const refDate = new Date('2026-06-15');

function createTransactions(monthsCount, needsPerMonth, wantsPerMonth, investPerMonth, refDateStr = '2026-06-15') {
  const dRef = new Date(refDateStr);
  const txs = [];
  for (let m = 1; m <= monthsCount; m++) {
    const d = new Date(Date.UTC(dRef.getUTCFullYear(), dRef.getUTCMonth() - m, 10));
    if (needsPerMonth > 0) txs.push({ amount: needsPerMonth, type: 'Need', timestamp: d, category: 'Bills' });
    if (wantsPerMonth > 0) txs.push({ amount: wantsPerMonth, type: 'Want', timestamp: d, category: 'Shopping' });
    if (investPerMonth > 0) txs.push({ amount: investPerMonth, type: 'Investment', timestamp: d, category: 'Misc' });
  }
  return txs;
}

// ── TEST 1: PURE DETERMINISTIC MATHEMATICS (financialMath.js) ────────
console.log('Running Test 1: Pure Deterministic Step-Up Math (financialMath.js)...');

// 36 months, 10k starting, 10% annual step-up, zero return & inflation
const fvNoGrowth = futureValueStepUpContributions({
  initialMonthlyContribution: 10000,
  annualContributionGrowthRate: 0.10,
  nominalAnnualReturn: 0,
  inflationRate: 0,
  months: 36
});
// 12 * 10000 + 12 * 11000 + 12 * 12100 = 120000 + 132000 + 145200 = 397,200
assert.equal(fvNoGrowth, 397200, '36-month zero-return step-up matches exact arithmetic sum');

// Analytical solver check: required initial SIP to hit target
const targetReal = 10000000;
const reqInitial = requiredStepUpContribution({
  currentPrincipal: 500000,
  targetFutureValueReal: targetReal,
  annualContributionGrowthRate: 0.10,
  nominalAnnualReturn: 0.08,
  inflationRate: 0.06,
  months: 240
});

// Verify that compounding the solved initial contribution reaches target exactly
const verifiedFv = futureValueStepUp({
  currentPrincipal: 500000,
  initialMonthlyContribution: reqInitial,
  annualContributionGrowthRate: 0.10,
  nominalAnnualReturn: 0.08,
  inflationRate: 0.06,
  months: 240
});
assert.ok(Math.abs(verifiedFv.totalFutureValueReal - targetReal) < 1.0, 'Solved initial contribution produces exact target FV (< ₹1.0 delta)');
console.log(`  Analytical Solved Initial SIP: ₹${reqInitial.toFixed(2)}/mo -> FV Real = ₹${verifiedFv.totalFutureValueReal.toFixed(2)}`);
console.log('  ✅ Test 1 Passed: Pure deterministic Step-Up functions strictly verified\n');


// ── TEST 2: DETERMINISTIC PREDICTABILITY SERVICE INTEGRATION ──────────
console.log('Running Test 2: Deterministic Predictability Service STEP_UP Mode...');

const testData = {
  user: { id: 'u1', age: 25, retirementAge: 60, monthlyIncome: 60000 },
  assets: [{ id: 'a1', currentValue: 500000, assetClass: 'FIRE_INVESTABLE', includedInFireCorpus: true, liquidity: 'liquid' }],
  transactions: createTransactions(6, 25000, 10000, 10000)
};

const snapFlat = buildPredictabilitySnapshot(testData, { referenceDate: refDate, contributionMode: 'NOMINAL_FLAT' });
const snapStepUp10 = buildPredictabilitySnapshot(testData, {
  referenceDate: refDate,
  contributionMode: 'STEP_UP',
  annualContributionGrowthRate: 0.10
});

assert.equal(snapStepUp10.retirement.assumptions.contributionMode, 'STEP_UP');
assert.equal(snapStepUp10.retirement.assumptions.annualContributionGrowthRate, 0.10);
assert.ok(snapStepUp10.retirement.projectedCorpusAtRetirement > snapFlat.retirement.projectedCorpusAtRetirement, 'Step-Up projected corpus > Flat');
assert.ok(snapStepUp10.retirement.requiredMonthlyContributionForEstimatedFire < snapFlat.retirement.requiredMonthlyContributionForEstimatedFire, 'Step-Up required initial SIP < Flat');

console.log(`  NOMINAL_FLAT: Projected Corpus = ₹${(snapFlat.retirement.projectedCorpusAtRetirement/1e5).toFixed(2)}L, Req SIP = ₹${snapFlat.retirement.requiredMonthlyContributionForEstimatedFire.toFixed(0)}/mo`);
console.log(`  STEP_UP 10%:  Projected Corpus = ₹${(snapStepUp10.retirement.projectedCorpusAtRetirement/1e5).toFixed(2)}L, Req Initial SIP = ₹${snapStepUp10.retirement.requiredMonthlyContributionForEstimatedFire.toFixed(0)}/mo`);
console.log('  ✅ Test 2 Passed: Deterministic Predictability Service supports STEP_UP cleanly\n');


// ── TEST 3: MONTE CARLO ASYNC END-TO-END STEP_UP EXECUTION ───────────
console.log('Running Test 3: Monte Carlo Async End-to-End STEP_UP Execution...');

const asyncSnap = await buildPredictabilitySnapshotAsync(testData, {
  referenceDate: refDate,
  contributionMode: 'STEP_UP',
  annualContributionGrowthRate: 0.10
});

assert.equal(asyncSnap.probabilistic.available, true, 'Probabilistic section is available');
assert.equal(asyncSnap.probabilistic.assumptions.contributionMode, 'STEP_UP');
assert.equal(asyncSnap.probabilistic.assumptions.annualContributionGrowthRate, 0.10);
assert.ok(asyncSnap.probabilistic.contributionRecommendation.solved, 'Solver solved initial contribution');
assert.equal(asyncSnap.probabilistic.contributionRecommendation.annualContributionGrowthRate, 0.10);
assert.ok(asyncSnap.probabilistic.contributionRecommendation.recommendedInitialMonthlyContribution > 0);

console.log(`  Monte Carlo STEP_UP 10% Probability: ${(asyncSnap.probabilistic.estimatedFire.probabilityFundedAtTargetAge * 100).toFixed(1)}%`);
console.log(`  Recommended Initial SIP: ₹${asyncSnap.probabilistic.contributionRecommendation.recommendedInitialMonthlyContribution}/mo`);
console.log('  ✅ Test 3 Passed: Monte Carlo end-to-end integration fully supports STEP_UP\n');


// ── TEST 4: YOUNG STARTER PERSONA (AGE 22 -> 60) CALIBRATION ─────────
console.log('Running Test 4: Young Starter Canonical Persona (Age 22 -> 60, 38-year horizon)...');

const youngStarterData = {
  user: { id: 'young_starter', age: 22, retirementAge: 60, monthlyIncome: 40000 },
  assets: [{ id: 'ys_mf', currentValue: 50000, assetClass: 'FIRE_INVESTABLE', includedInFireCorpus: true, liquidity: 'liquid' }],
  transactions: createTransactions(6, 20000, 10000, 5000) // ₹5k/mo current SIP
};

const ys_flat = await buildPredictabilitySnapshotAsync(youngStarterData, { referenceDate: refDate, contributionMode: 'NOMINAL_FLAT' });
const ys_step5 = await buildPredictabilitySnapshotAsync(youngStarterData, { referenceDate: refDate, contributionMode: 'STEP_UP', annualContributionGrowthRate: 0.05 });
const ys_step10 = await buildPredictabilitySnapshotAsync(youngStarterData, { referenceDate: refDate, contributionMode: 'STEP_UP', annualContributionGrowthRate: 0.10 });
const ys_step15 = await buildPredictabilitySnapshotAsync(youngStarterData, { referenceDate: refDate, contributionMode: 'STEP_UP', annualContributionGrowthRate: 0.15 });

console.log(`    Flat (0%):   Prob = ${(ys_flat.probabilistic.estimatedFire.probabilityFundedAtTargetAge*100).toFixed(1)}%, p50 = ₹${(ys_flat.probabilistic.estimatedFire.corpusPercentiles.p50/1e5).toFixed(1)}L, Req SIP = ₹${ys_flat.probabilistic.contributionRecommendation.recommendedMonthlyContribution}/mo`);
console.log(`    Step-Up 5%:  Prob = ${(ys_step5.probabilistic.estimatedFire.probabilityFundedAtTargetAge*100).toFixed(1)}%, p50 = ₹${(ys_step5.probabilistic.estimatedFire.corpusPercentiles.p50/1e5).toFixed(1)}L, Req Initial = ₹${ys_step5.probabilistic.contributionRecommendation.recommendedInitialMonthlyContribution}/mo`);
console.log(`    Step-Up 10%: Prob = ${(ys_step10.probabilistic.estimatedFire.probabilityFundedAtTargetAge*100).toFixed(1)}%, p50 = ₹${(ys_step10.probabilistic.estimatedFire.corpusPercentiles.p50/1e5).toFixed(1)}L, Req Initial = ₹${ys_step10.probabilistic.contributionRecommendation.recommendedInitialMonthlyContribution}/mo`);
console.log(`    Step-Up 15%: Prob = ${(ys_step15.probabilistic.estimatedFire.probabilityFundedAtTargetAge*100).toFixed(1)}%, p50 = ₹${(ys_step15.probabilistic.estimatedFire.corpusPercentiles.p50/1e5).toFixed(1)}L, Req Initial = ₹${ys_step15.probabilistic.contributionRecommendation.recommendedInitialMonthlyContribution}/mo`);

// Validations
assert.ok(ys_step10.probabilistic.estimatedFire.probabilityFundedAtTargetAge >= ys_flat.probabilistic.estimatedFire.probabilityFundedAtTargetAge);
assert.ok(ys_step10.probabilistic.estimatedFire.corpusPercentiles.p50 > ys_flat.probabilistic.estimatedFire.corpusPercentiles.p50);
assert.ok(ys_step10.probabilistic.contributionRecommendation.recommendedInitialMonthlyContribution < ys_flat.probabilistic.contributionRecommendation.recommendedMonthlyContribution);
console.log('  ✅ Test 4 Passed: Young Starter receives dramatically more realistic and actionable initial recommendations under STEP_UP\n');


// ── TEST 5: NEAR-RETIREMENT PERSONA (AGE 55 -> 60) SANITY CHECK ─────
console.log('Running Test 5: Near-Retirement Canonical Persona (Age 55 -> 60, 5-year horizon)...');

const nearRetireeData = {
  user: { id: 'near_retiree', age: 55, retirementAge: 60, monthlyIncome: 150000 },
  assets: [{ id: 'nr_mf', currentValue: 8000000, assetClass: 'FIRE_INVESTABLE', includedInFireCorpus: true, liquidity: 'liquid' }],
  transactions: createTransactions(6, 60000, 30000, 20000)
};

const nr_flat = await buildPredictabilitySnapshotAsync(nearRetireeData, { referenceDate: refDate, contributionMode: 'NOMINAL_FLAT' });
const nr_step10 = await buildPredictabilitySnapshotAsync(nearRetireeData, { referenceDate: refDate, contributionMode: 'STEP_UP', annualContributionGrowthRate: 0.10 });

console.log(`    Flat (0%):   Req SIP = ₹${nr_flat.probabilistic.contributionRecommendation.recommendedMonthlyContribution}/mo`);
console.log(`    Step-Up 10%: Req Initial SIP = ₹${nr_step10.probabilistic.contributionRecommendation.recommendedInitialMonthlyContribution}/mo`);

// Over 5 years (only 4 escalations), the difference is modest
const ratio = nr_step10.probabilistic.contributionRecommendation.recommendedInitialMonthlyContribution / nr_flat.probabilistic.contributionRecommendation.recommendedMonthlyContribution;
console.log(`    Ratio of Step-Up to Flat initial requirement: ${(ratio * 100).toFixed(1)}%`);
assert.ok(ratio > 0.70 && ratio < 1.0, '5-year horizon produces modest, financially realistic step-up difference');
console.log('  ✅ Test 5 Passed: Near-Retirement persona behaves rationally with modest 5-year step-up impact\n');


// ── TEST 6: RETIREMENT ALTERNATIVES PRESERVE STEP_UP MODE ─────────────
console.log('Running Test 6: Retirement Alternatives Preserve STEP_UP Mode & Shared Seed...');

// Create underfunded persona that triggers retirement alternatives
const underfundedData = {
  user: { id: 'alt_test', age: 50, retirementAge: 55, monthlyIncome: 80000 },
  assets: [{ id: 'alt_mf', currentValue: 1000000, assetClass: 'FIRE_INVESTABLE', includedInFireCorpus: true, liquidity: 'liquid' }],
  transactions: createTransactions(6, 40000, 20000, 5000)
};

const altSnap = await buildPredictabilitySnapshotAsync(underfundedData, {
  referenceDate: refDate,
  contributionMode: 'STEP_UP',
  annualContributionGrowthRate: 0.10
});

assert.ok(altSnap.probabilistic.retirementAlternatives && altSnap.probabilistic.retirementAlternatives.length > 0, 'Alternatives generated');
for (const alt of altSnap.probabilistic.retirementAlternatives) {
  assert.equal(alt.annualContributionGrowthRate, 0.10, 'Alternative preserved annualContributionGrowthRate = 0.10');
  assert.ok(alt.recommendedInitialMonthlyContribution > 0, 'Alternative has valid recommendedInitialMonthlyContribution');
  console.log(`    +${alt.yearsExtended}y (Age ${alt.targetAge}): Prob = ${(alt.probabilityFundedAtTargetAge*100).toFixed(1)}%, Req Initial SIP = ₹${alt.recommendedInitialMonthlyContribution}/mo (Feasibility: ${alt.feasibility?.status})`);
}
// ── TEST 7: CONTRACT ENFORCEMENT FOR MISSING STEP_UP RATE ────────────
console.log('Running Test 7: Contract Enforcement for Missing / Invalid STEP_UP Rate...');

// A. buildPredictabilitySnapshot rejects missing/null/invalid rate for STEP_UP
assert.throws(() => {
  buildPredictabilitySnapshot(testData, { contributionMode: 'STEP_UP' });
}, { name: 'TypeError' }, 'buildPredictabilitySnapshot rejects missing annualContributionGrowthRate for STEP_UP');

assert.throws(() => {
  buildPredictabilitySnapshot(testData, { contributionMode: 'STEP_UP', annualContributionGrowthRate: null });
}, { name: 'TypeError' }, 'buildPredictabilitySnapshot rejects null annualContributionGrowthRate for STEP_UP');

assert.throws(() => {
  buildPredictabilitySnapshot(testData, { contributionMode: 'STEP_UP', annualContributionGrowthRate: -0.05 });
}, { name: 'RangeError' }, 'buildPredictabilitySnapshot rejects negative annualContributionGrowthRate for STEP_UP');

assert.throws(() => {
  buildPredictabilitySnapshot(testData, { contributionMode: 'STEP_UP', annualContributionGrowthRate: 0.55 });
}, { name: 'RangeError' }, 'buildPredictabilitySnapshot rejects >0.50 annualContributionGrowthRate for STEP_UP');

// B. buildMonteCarloPayload rejects missing rate for STEP_UP
const resolvedMock = {
  user: { age: 30, retirementAge: 60, expectedReturnRate: 0.08, expectedInflationRate: 0.06 },
  fireInvestableCorpus: 100000,
  monthlyContributionUsed: 10000,
  monthsUntilRetirement: 360,
  contributionMode: 'STEP_UP'
};

assert.throws(() => {
  buildMonteCarloPayload(resolvedMock, { contributionMode: 'STEP_UP' });
}, { name: 'TypeError' }, 'buildMonteCarloPayload rejects missing annualContributionGrowthRate for STEP_UP');

// C. requiredStepUpContribution rejects missing rate
assert.throws(() => {
  requiredStepUpContribution({
    currentPrincipal: 100000,
    targetFutureValueReal: 5000000,
    nominalAnnualReturn: 0.08,
    inflationRate: 0.06,
    months: 240
  });
}, { name: 'TypeError' }, 'requiredStepUpContribution rejects missing annualContributionGrowthRate');

console.log('  ✅ Test 7 Passed: Missing / null / invalid STEP_UP growth rates strictly rejected\n');


// ── TEST 8: LEGACY MODES WITHOUT GROWTH RATE REMAIN VALID ─────────────
console.log('Running Test 8: Legacy Modes Without Growth Rate Remain Fully Valid...');

const legacyFlat = buildPredictabilitySnapshot(testData, { contributionMode: 'NOMINAL_FLAT' });
const legacyReal = buildPredictabilitySnapshot(testData, { contributionMode: 'REAL_CONSTANT' });
const legacyDefault = buildPredictabilitySnapshot(testData);

assert.equal(legacyFlat.retirement.assumptions.contributionMode, 'NOMINAL_FLAT');
assert.equal(legacyReal.retirement.assumptions.contributionMode, 'REAL_CONSTANT');
assert.equal(legacyDefault.retirement.assumptions.contributionMode, 'NOMINAL_FLAT');
console.log('  ✅ Test 8 Passed: Legacy NOMINAL_FLAT and REAL_CONSTANT operate without growth rate\n');

console.log('================================================================');
console.log('  ALL PREDICTABILITY STEP-UP TESTS PASSED SUCCESSFULLY! 🚀');
console.log('================================================================');


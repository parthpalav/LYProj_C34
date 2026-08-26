/**
 * server/test_predictability_service.js
 * 
 * Comprehensive unit test suite for PredictabilityService.
 * Tests pure deterministic snapshot construction without modifying the database.
 * Includes both core user scenarios and exhaustive adversarial edge cases (A through T).
 */

import assert from 'assert';
import { buildPredictabilitySnapshot } from './services/PredictabilityService.js';
import { CONTRIBUTION_MODE } from './config/financialRules.js';

function approxEqual(actual, expected, tol = 0.05, message = '') {
  const diff = Math.abs(actual - expected);
  const relDiff = expected !== 0 ? diff / Math.abs(expected) : diff;
  assert.ok(
    diff < tol || relDiff < 1e-4,
    `${message || 'Value mismatch'}: expected ${expected}, got ${actual} (diff: ${diff}, relDiff: ${relDiff})`
  );
}

function runTests() {
  console.log('============================================================');
  console.log('  FINAURA PREDICTABILITY SERVICE COMPREHENSIVE TEST SUITE');
  console.log('============================================================\n');

  const refDate = new Date('2026-06-01T00:00:00Z');

  // -----------------------------------------------------------------
  // 1. STABLE SALARIED USER SCENARIO
  // -----------------------------------------------------------------
  console.log('Running Scenario 1: Stable Salaried User...');

  const salariedData = {
    user: {
      id: 'u_salaried',
      name: 'Priya Sharma',
      age: 30,
      retirementAge: 55, // 25 years = 300 months
      currentBalance: 50000,
      retirementCorpusGoal: 20000000, // 2 Cr
      expectedReturnRate: 0.08,
      expectedInflationRate: 0.06,
      expectedWithdrawalRate: 0.04,
      lifestyleAdjustmentRatio: 0.8,
      emergencyFundTargetMonths: 6
    },
    incomes: [
      { amount: 100000, timestamp: '2026-01-05T00:00:00Z', source: 'salary' },
      { amount: 100000, timestamp: '2026-02-05T00:00:00Z', source: 'salary' },
      { amount: 100000, timestamp: '2026-03-05T00:00:00Z', source: 'salary' },
      { amount: 100000, timestamp: '2026-04-05T00:00:00Z', source: 'salary' },
      { amount: 100000, timestamp: '2026-05-05T00:00:00Z', source: 'salary' }
    ],
    transactions: [
      { amount: 35000, type: 'Need', timestamp: '2026-01-10T00:00:00Z' },
      { amount: 15000, type: 'Want', timestamp: '2026-01-12T00:00:00Z' },
      { amount: 20000, type: 'Investment', timestamp: '2026-01-15T00:00:00Z' },
      { amount: 35000, type: 'Need', timestamp: '2026-02-10T00:00:00Z' },
      { amount: 15000, type: 'Want', timestamp: '2026-02-12T00:00:00Z' },
      { amount: 20000, type: 'Investment', timestamp: '2026-02-15T00:00:00Z' }
    ],
    assets: [
      { id: 'a1', name: 'Nifty Index Fund', assetClass: 'FIRE_INVESTABLE', assetType: 'Equity', currentValue: 1500000, includedInFireCorpus: true, liquidity: 'liquid' },
      { id: 'a2', name: 'Emergency Savings Account', assetClass: 'SEMI_LIQUID', assetType: 'Cash', currentValue: 300000, includedInFireCorpus: false, liquidity: 'liquid' }
    ],
    liabilities: [
      { id: 'l1', name: 'Auto Loan', amount: 10000, frequency: 'monthly', outstandingBalance: 240000, interestRate: 0.09, remainingTermMonths: 24, status: 'active' }
    ]
  };

  const snap1 = buildPredictabilitySnapshot(salariedData, { referenceDate: refDate });

  assert.strictEqual(snap1.income.meanMonthlyIncome, 100000);
  assert.strictEqual(snap1.income.coefficientOfVariation, 0);
  assert.strictEqual(snap1.currentState.averageMonthlyNeeds, 35000);
  assert.strictEqual(snap1.currentState.averageMonthlyWants, 15000);
  assert.strictEqual(snap1.currentState.liabilityService, 10000);
  assert.strictEqual(snap1.currentState.totalEssentialSpending, 45000); // 35k Needs + 10k EMI
  assert.strictEqual(snap1.currentState.observedAverageMonthlyInvestment, 20000);

  assert.strictEqual(snap1.assets.fireInvestableCorpus, 1500000);
  assert.strictEqual(snap1.assets.liquidBuffer, 300000);
  assert.strictEqual(snap1.assets.knownNetWorth, 1560000); // (1.5M + 300k) - 240k

  // Emergency Fund: 45k essentials * 6 = 270k target, 300k liquid -> 0 funding gap
  assert.strictEqual(snap1.emergencyFund.targetAmount, 270000);
  assert.strictEqual(snap1.emergencyFund.fundingGap, 0);
  approxEqual(snap1.emergencyFund.coverageMonths, 300000 / 45000); // 6.67 months

  // Retirement spending: (35k Needs + 15k Wants) * 12 = 600,000 / yr (excluding car loan)
  assert.strictEqual(snap1.retirement.currentAnnualLifestyleSpending, 600000);
  // Estimated FIRE corpus = (600k * 0.8) / 0.04 = 480k / 0.04 = 12,000,000 (1.2 Cr)
  assert.strictEqual(snap1.retirement.estimatedFireCorpus, 12000000);
  assert.strictEqual(snap1.retirement.userGoalCorpus, 20000000);
  assert.ok(snap1.retirement.projectedCorpusAtRetirement > 1500000);
  console.log('  ✅ Scenario 1: Stable salaried snapshot verified');

  // -----------------------------------------------------------------
  // 2. IRREGULAR BUT RESILIENT USER SCENARIO (ARCHETYPE C)
  // -----------------------------------------------------------------
  console.log('\nRunning Scenario 2: Irregular but Resilient User...');

  const irregularResilientData = {
    user: {
      id: 'u_gig_resilient',
      name: 'Rohan (Freelancer)',
      age: 28,
      retirementAge: 60,
      currentBalance: 80000,
      expectedReturnRate: 0.08,
      expectedInflationRate: 0.06,
      expectedWithdrawalRate: 0.04,
      lifestyleAdjustmentRatio: 0.8,
      emergencyFundTargetMonths: 6
    },
    incomes: [
      { amount: 40000, timestamp: '2026-01-10T00:00:00Z', source: 'freelance' },
      { amount: 80000, timestamp: '2026-02-15T00:00:00Z', source: 'freelance' },
      { amount: 30000, timestamp: '2026-03-20T00:00:00Z', source: 'gig' },
      { amount: 90000, timestamp: '2026-04-12T00:00:00Z', source: 'freelance' },
      { amount: 45000, timestamp: '2026-05-18T00:00:00Z', source: 'gig' }
    ],
    transactions: [
      { amount: 25000, type: 'Need', timestamp: '2026-01-10T00:00:00Z' },
      { amount: 10000, type: 'Want', timestamp: '2026-01-15T00:00:00Z' },
      { amount: 15000, type: 'Investment', timestamp: '2026-01-20T00:00:00Z' }
    ],
    assets: [
      { id: 'a1', name: 'Liquid Mutual Fund', assetClass: 'SEMI_LIQUID', assetType: 'Mutual Fund', currentValue: 180000, includedInFireCorpus: false, liquidity: 'liquid' }
    ],
    liabilities: [
      { id: 'l1', name: 'Credit Line EMI', amount: 5000, frequency: 'monthly', outstandingBalance: 50000, status: 'active' }
    ]
  };

  const snap2 = buildPredictabilitySnapshot(irregularResilientData, { referenceDate: refDate });

  assert.ok(snap2.income.coefficientOfVariation > 0.35, 'CV must reflect variability');
  assert.strictEqual(snap2.currentState.totalEssentialSpending, 30000);
  assert.strictEqual(snap2.resilience.isCoverageAdequate, true, 'Conservative income covers essentials');
  assert.strictEqual(snap2.resilience.bufferRunwayMonths, 6, 'Buffer runway = 180k / 30k = 6 months');

  const covFact = snap2.explanationFacts.find(f => f.code === 'ESSENTIALS_COVERED_BY_CONSERVATIVE_INCOME');
  assert.ok(covFact, 'Must emit covered explanation fact');
  console.log('  ✅ Scenario 2: Irregular but resilient snapshot verified');

  // -----------------------------------------------------------------
  // 3. IRREGULAR VULNERABLE USER SCENARIO (ARCHETYPE D)
  // -----------------------------------------------------------------
  console.log('\nRunning Scenario 3: Irregular Vulnerable User...');

  const irregularVulnerableData = {
    user: {
      id: 'u_gig_vulnerable',
      name: 'Amit',
      age: 26,
      retirementAge: 60,
      currentBalance: 5000
    },
    incomes: [
      { amount: 20000, timestamp: '2026-01-10T00:00:00Z' },
      { amount: 60000, timestamp: '2026-02-10T00:00:00Z' },
      { amount: 10000, timestamp: '2026-03-10T00:00:00Z' },
      { amount: 70000, timestamp: '2026-04-10T00:00:00Z' },
      { amount: 15000, timestamp: '2026-05-10T00:00:00Z' }
    ],
    transactions: [
      { amount: 35000, type: 'Need', timestamp: '2026-01-10T00:00:00Z' }
    ],
    assets: [
      { id: 'a1', name: 'Cash', assetClass: 'SEMI_LIQUID', assetType: 'Cash', currentValue: 10000, liquidity: 'liquid' }
    ],
    liabilities: [
      { id: 'l1', name: 'Personal Loan', amount: 10000, frequency: 'monthly', status: 'active' }
    ]
  };

  const snap3 = buildPredictabilitySnapshot(irregularVulnerableData, { referenceDate: refDate });

  assert.strictEqual(snap3.currentState.totalEssentialSpending, 45000);
  assert.strictEqual(snap3.resilience.isCoverageAdequate, false);
  assert.ok(snap3.resilience.essentialCoverageRatio < 1.0);
  assert.ok(snap3.resilience.bufferRunwayMonths < 1.0);

  const uncovFact = snap3.explanationFacts.find(f => f.code === 'ESSENTIALS_UNCOVERED_BY_CONSERVATIVE_INCOME');
  assert.ok(uncovFact, 'Must emit uncovered explanation fact');
  console.log('  ✅ Scenario 3: Irregular vulnerable snapshot verified');

  // -----------------------------------------------------------------
  // ADVERSARIAL SCENARIOS (A THROUGH T)
  // -----------------------------------------------------------------
  console.log('\nRunning Adversarial Test Cases (A through T)...');

  // Scenario A: Partial current month handling
  const snapA = buildPredictabilitySnapshot({
    user: { id: 'u_a', age: 30, retirementAge: 60 },
    transactions: [
      { amount: 30000, type: 'Need', timestamp: '2026-05-15T00:00:00Z' },
      { amount: 10000, type: 'Need', timestamp: '2026-06-01T12:00:00Z' } // Partial current month
    ]
  }, { referenceDate: refDate });
  assert.strictEqual(snapA.dataQuality.transactionMonthsObserved, 2);
  assert.strictEqual(snapA.currentState.averageMonthlyNeeds, 20000); // (30k + 10k) / 2
  console.log('  ✅ Scenario A: Partial current month handled deterministically');

  // Scenario B: Only 2 months of transaction history inside 6-month lookback
  const snapB = buildPredictabilitySnapshot({
    user: { id: 'u_b', age: 30, retirementAge: 60 },
    transactions: [
      { amount: 40000, type: 'Need', timestamp: '2026-04-10T00:00:00Z' },
      { amount: 40000, type: 'Need', timestamp: '2026-05-10T00:00:00Z' }
    ]
  }, { referenceDate: refDate });
  // Must divide by 2 observed months, NOT 6
  assert.strictEqual(snapB.currentState.averageMonthlyNeeds, 40000);
  console.log('  ✅ Scenario B: 2-month lookback divides by observed months (not lookback window)');

  // Scenario C: One income event 2 months ago (no artificial 12 zero-month inflation)
  const snapC = buildPredictabilitySnapshot({
    user: { id: 'u_c', age: 30, retirementAge: 60 },
    incomes: [{ amount: 50000, timestamp: '2026-04-01T00:00:00Z' }]
  }, { referenceDate: refDate });
  assert.strictEqual(snapC.income.meanMonthlyIncome, 50000);
  assert.strictEqual(snapC.income.zeroIncomeMonthsCount, 0);
  console.log('  ✅ Scenario C: Single income event does not fabricate pre-history zero months');

  // Scenario D: SEMI_LIQUID but genuinely restricted/locked asset
  const snapD = buildPredictabilitySnapshot({
    user: { id: 'u_d', age: 30, retirementAge: 60 },
    assets: [
      { id: 'a_locked', assetClass: 'SEMI_LIQUID', assetType: 'EPF', currentValue: 500000, liquidity: 'locked' },
      { id: 'a_liquid', assetClass: 'SEMI_LIQUID', assetType: 'Savings', currentValue: 50000, liquidity: 'liquid' }
    ]
  }, { referenceDate: refDate });
  assert.strictEqual(snapD.assets.liquidBuffer, 50000, 'Locked semi-liquid asset excluded from liquid buffer');
  console.log('  ✅ Scenario D: Locked/restricted semi-liquid assets excluded from emergency buffer');

  // Scenario E: Cash-equivalent FIRE asset
  const snapE = buildPredictabilitySnapshot({
    user: { id: 'u_e', age: 30, retirementAge: 60 },
    assets: [
      { id: 'a_cash_fire', assetClass: 'FIRE_INVESTABLE', assetType: 'Cash', currentValue: 200000, includedInFireCorpus: true, liquidity: 'liquid' }
    ]
  }, { referenceDate: refDate });
  assert.strictEqual(snapE.assets.fireInvestableCorpus, 200000);
  assert.strictEqual(snapE.assets.liquidBuffer, 200000);
  console.log('  ✅ Scenario E: Cash-equivalent FIRE asset qualifies for both FIRE and liquid buffer');

  // Scenario F: User currentBalance + separate Cash Asset
  const snapF = buildPredictabilitySnapshot({
    user: { id: 'u_f', age: 30, retirementAge: 60, currentBalance: 75000 },
    assets: [{ id: 'a_cash', assetClass: 'SEMI_LIQUID', assetType: 'Bank Account', currentValue: 75000, liquidity: 'liquid' }]
  }, { referenceDate: refDate });
  assert.strictEqual(snapF.assets.liquidBuffer, 75000);
  assert.strictEqual(snapF.currentState.currentBalance, 75000);
  console.log('  ✅ Scenario F: currentBalance and Asset records coexist without double-counting');

  // Scenario G: Liability ending next month
  const snapG = buildPredictabilitySnapshot({
    user: { id: 'u_g', age: 30, retirementAge: 60 },
    liabilities: [
      { id: 'l_end_soon', name: 'Final EMI', amount: 8000, frequency: 'monthly', remainingTermMonths: 1, outstandingBalance: 8000, status: 'active' }
    ]
  }, { referenceDate: refDate });
  assert.strictEqual(snapG.currentState.liabilityService, 8000);
  console.log('  ✅ Scenario G: Expiring liability reported with exact term metadata');

  // Scenario H: Annual/non-monthly liability (e.g. yearly insurance premium)
  const snapH = buildPredictabilitySnapshot({
    user: { id: 'u_h', age: 30, retirementAge: 60 },
    liabilities: [
      { id: 'l_annual', name: 'Term Insurance', amount: 24000, frequency: 'yearly', status: 'active' }
    ]
  }, { referenceDate: refDate });
  assert.strictEqual(snapH.currentState.liabilityService, 2000, '24,000 / 12 = 2,000 monthly');
  console.log('  ✅ Scenario H: Annual liability normalized correctly to monthly outflow');

  // Scenario I: One-time huge Investment transaction
  const snapI = buildPredictabilitySnapshot({
    user: { id: 'u_i', age: 30, retirementAge: 60 },
    transactions: [
      { amount: 1000000, type: 'Investment', timestamp: '2026-01-01T00:00:00Z' }
    ],
    assets: [{ id: 'a1', assetClass: 'FIRE_INVESTABLE', currentValue: 1000000, includedInFireCorpus: true }]
  }, { referenceDate: refDate });
  assert.strictEqual(snapI.currentState.observedAverageMonthlyInvestment, 1000000);
  assert.strictEqual(snapI.assets.fireInvestableCorpus, 1000000, 'Asset balance is exactly asset record, not doubled');
  console.log('  ✅ Scenario I: Large investment transaction treated purely as cash flow');

  // Scenario J: No explicit assets but currentBalance > 0
  const snapJ = buildPredictabilitySnapshot({
    user: { id: 'u_j', currentBalance: 200000, age: 30, retirementAge: 60 },
    assets: []
  }, { referenceDate: refDate });
  assert.strictEqual(snapJ.assets.fireInvestableCorpus, 0);
  assert.strictEqual(snapJ.assets.liquidBuffer, 0);
  console.log('  ✅ Scenario J: Zero explicit assets does not promote currentBalance to FIRE corpus');

  // Scenario K: No liability principal but known monthly payment
  const snapK = buildPredictabilitySnapshot({
    user: { id: 'u_k' },
    liabilities: [{ id: 'l_noprinc', amount: 5000, frequency: 'monthly', outstandingBalance: null, status: 'active' }]
  }, { referenceDate: refDate });
  assert.strictEqual(snapK.currentState.liabilityService, 5000);
  assert.strictEqual(snapK.liabilities.unknownPrincipalCount, 1);
  console.log('  ✅ Scenario K: Liability without principal computes service and emits limitation');

  // Scenario L: Nominal return below inflation (e.g. 5% nominal, 7% inflation)
  const snapL = buildPredictabilitySnapshot({
    user: { id: 'u_l', age: 30, retirementAge: 40, expectedReturnRate: 0.05, expectedInflationRate: 0.07 },
    transactions: [{ amount: 20000, type: 'Need', timestamp: '2026-01-01T00:00:00Z' }],
    assets: [{ id: 'a1', assetClass: 'FIRE_INVESTABLE', currentValue: 1000000, includedInFireCorpus: true }]
  }, { referenceDate: refDate });
  assert.ok(snapL.retirement.assumptions.realReturn < 0, 'Real return is negative');
  assert.ok(snapL.retirement.projectedCorpusAtRetirement > 0, 'Projected corpus remains positive and bounded');
  console.log('  ✅ Scenario L: Nominal return below inflation evaluated without error');

  // Scenario M: User goal already achieved but estimated FIRE target not achieved
  const snapM = buildPredictabilitySnapshot({
    user: { id: 'u_m', age: 30, retirementAge: 60, retirementCorpusGoal: 2000000 },
    transactions: [{ amount: 50000, type: 'Need', timestamp: '2026-01-01T00:00:00Z' }], // FIRE target = 12M
    assets: [{ id: 'a1', assetClass: 'FIRE_INVESTABLE', currentValue: 3000000, includedInFireCorpus: true }] // 3M > 2M goal, but < 12M FIRE
  }, { referenceDate: refDate });
  assert.strictEqual(snapM.retirement.requiredMonthlyContributionForUserGoal, 0);
  assert.ok(snapM.retirement.requiredMonthlyContributionForEstimatedFire > 0);
  console.log('  ✅ Scenario M: User goal requirement is 0 while estimated FIRE requires contribution');

  // Scenario N: Estimated FIRE target achieved but user goal higher
  const snapN = buildPredictabilitySnapshot({
    user: { id: 'u_n', age: 30, retirementAge: 60, retirementCorpusGoal: 25000000 }, // Goal 2.5 Cr
    transactions: [{ amount: 20000, type: 'Need', timestamp: '2026-01-01T00:00:00Z' }], // FIRE target = 4.8M
    assets: [{ id: 'a1', assetClass: 'FIRE_INVESTABLE', currentValue: 5000000, includedInFireCorpus: true }] // 5M > 4.8M FIRE, but < 25M goal
  }, { referenceDate: refDate });
  assert.strictEqual(snapN.retirement.requiredMonthlyContributionForEstimatedFire, 0);
  assert.ok(snapN.retirement.requiredMonthlyContributionForUserGoal > 0);
  console.log('  ✅ Scenario N: Estimated FIRE requirement is 0 while user goal requires contribution');

  // Scenario O: SWR extremely small but valid (e.g. 1% = 0.01)
  const snapO = buildPredictabilitySnapshot({
    user: { id: 'u_o', age: 30, retirementAge: 60, expectedWithdrawalRate: 0.01 },
    transactions: [{ amount: 20000, type: 'Need', timestamp: '2026-01-01T00:00:00Z' }] // Lifestyle 240k -> 240k*0.8/0.01 = 19.2M
  }, { referenceDate: refDate });
  assert.strictEqual(snapO.retirement.estimatedFireCorpus, 19200000);
  console.log('  ✅ Scenario O: Conservative 1% SWR handles gracefully');

  // Scenario P: Lifestyle adjustment 0 (e.g. 100% pension post-retirement)
  const snapP = buildPredictabilitySnapshot({
    user: { id: 'u_p', age: 30, retirementAge: 60, lifestyleAdjustmentRatio: 0.0 },
    transactions: [{ amount: 20000, type: 'Need', timestamp: '2026-01-01T00:00:00Z' }]
  }, { referenceDate: refDate });
  assert.strictEqual(snapP.retirement.estimatedFireCorpus, 0);
  console.log('  ✅ Scenario P: Zero lifestyle adjustment ratio yields zero FIRE corpus');

  // Scenario Q: No Wants (Wants = 0)
  const snapQ = buildPredictabilitySnapshot({
    user: { id: 'u_q', age: 30, retirementAge: 60 },
    transactions: [{ amount: 30000, type: 'Need', timestamp: '2026-01-01T00:00:00Z' }]
  }, { referenceDate: refDate });
  assert.strictEqual(snapQ.currentState.averageMonthlyWants, 0);
  assert.strictEqual(snapQ.retirement.currentAnnualLifestyleSpending, 360000);
  console.log('  ✅ Scenario Q: Zero Wants handled cleanly');

  // Scenario R: No Needs (Needs = 0)
  const snapR = buildPredictabilitySnapshot({
    user: { id: 'u_r', age: 30, retirementAge: 60 },
    transactions: [{ amount: 15000, type: 'Want', timestamp: '2026-01-01T00:00:00Z' }]
  }, { referenceDate: refDate });
  assert.strictEqual(snapR.currentState.averageMonthlyNeeds, 0);
  assert.strictEqual(snapR.retirement.currentAnnualLifestyleSpending, 180000);
  console.log('  ✅ Scenario R: Zero Needs handled cleanly');

  // Scenario S: No income but large FIRE corpus
  const snapS = buildPredictabilitySnapshot({
    user: { id: 'u_s', age: 50, retirementAge: 55 },
    incomes: [],
    transactions: [{ amount: 30000, type: 'Need', timestamp: '2026-01-01T00:00:00Z' }],
    assets: [{ id: 'a1', assetClass: 'FIRE_INVESTABLE', currentValue: 20000000, includedInFireCorpus: true }]
  }, { referenceDate: refDate });
  assert.strictEqual(snapS.income.meanMonthlyIncome, 0);
  assert.ok(snapS.retirement.projectedCorpusAtRetirement > 20000000);
  assert.strictEqual(snapS.retirement.projectedFire.reached, true);
  console.log('  ✅ Scenario S: Zero income with large asset base reaches FIRE cleanly');

  // Scenario T: Empty everything except profile
  const snapT = buildPredictabilitySnapshot({
    user: { id: 'u_t', age: 25, retirementAge: 60 }
  }, { referenceDate: refDate });
  assert.strictEqual(snapT.currentState.totalEssentialSpending, 0);
  assert.strictEqual(snapT.assets.fireInvestableCorpus, 0);
  assert.strictEqual(snapT.forecastStatus.available, false);
  assert.ok(snapT.forecastStatus.missingInputs.length >= 2);
  console.log('  ✅ Scenario T: Completely empty profile returns safe baseline without NaN/crash');

  console.log('\n============================================================');
  console.log('  ALL PREDICTABILITY SERVICE TESTS (INCLUDING A-T) PASSED!');
  console.log('============================================================');
}

try {
  runTests();
  process.exit(0);
} catch (err) {
  console.error('\n❌ UNIT TEST FAILED:', err);
  process.exit(1);
}

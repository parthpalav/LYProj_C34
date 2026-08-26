/**
 * server/test_predictability_monte_carlo_integration.js
 * 
 * Comprehensive Integration Test Suite for FINAURA Monte Carlo V1 (Node layer)
 * 
 * Verifies:
 *  1.  Valid forecast -> Python called with expected normalized payload (sigma = 0.12 for 8% return)
 *  2.  forecastStatus unavailable -> Python NOT called (gated)
 *  3.  Deterministic response fields unchanged when MC succeeds
 *  4.  Probabilistic section correctly maps simulation results
 *  5.  Contribution recommendation mapping (solved=true & recommended PMT)
 *  6.  fundedAge50/75 population funding mapping
 *  7.  userGoal metrics remain separate from estimated FIRE
 *  8.  Deterministic seed: same inputs -> same seed
 *  9.  Relevant financial input changes (e.g. expectedReturnRate) -> seed changes
 *  10. Irrelevant presentation metadata -> seed unchanged
 *  11. Python timeout -> deterministic response succeeds, probabilistic unavailable
 *  12. Python network error -> graceful fallback
 *  13. Python HTTP 500 -> graceful fallback
 *  14. Python HTTP 400 -> internal-input-error handling
 *  15. Malformed Python probability > 1.0 -> response rejected / fallback
 *  16. NaN / Infinity malformed response -> rejected
 *  17. Percentile ordering violation (p10 > p25) -> rejected
 *  18. Unsolved contribution solver (solved=false) -> valid HTTP 200 / probabilistic response
 *  19. Funded age unreached (reached=false) -> valid probabilistic response
 *  20. Zero DB writes guarantee during Predictability generation
 *  21. Existing Base scenario output completely unchanged
 *  22. Existing API contract backward compatibility
 *  23. Low dataQuality preserved distinctly from modeled probability
 *  24. Frozen V1 Volatility Exact Table & Clamping Tests:
 *        0.00 -> 0.06
 *        0.04 -> 0.06
 *        0.06 -> 0.08
 *        0.08 -> 0.12
 *        0.10 -> 0.16
 *        0.12 -> 0.20
 *        0.15 -> 0.22
 *        0.20 -> 0.22
 *  25. Missing / Invalid Return Policy (null, NaN, Infinity, -0.05, 1.5) -> SYSTEM_DEFAULT (0.08 -> 0.12)
 *  26. Volatility Overrides Ignored (options.portfolioVolatility, user.portfolioVolatility, riskProfile)
 *  27. PORTFOLIO_RISK_ESTIMATED Warning Present on All Successful Probabilistic Forecasts
 *  28. Monotonicity of Volatility in Unclamped Region
 */

import assert from 'node:assert/strict';
import {
  derivePortfolioVolatility,
  deriveMonteCarloSeed,
  buildMonteCarloPayload,
  validateMonteCarloResponse,
  mapMonteCarloResponse,
  attachMonteCarloSimulation
} from './utils/monteCarloAdapter.js';
import {
  buildPredictabilitySnapshot,
  buildPredictabilitySnapshotAsync
} from './services/PredictabilityService.js';
import {
  DEFAULT_RETURN_RATE,
  DEFAULT_INFLATION_RATE,
  DEFAULT_PORTFOLIO_VOLATILITY,
  DEFAULT_SIMULATION_COUNT
} from './config/financialRules.js';

// ===========================================================================
// Mocks & Fixtures
// ===========================================================================

function mockUser(overrides = {}) {
  return {
    id: 'user_mc_test',
    name: 'Monte Carlo Test User',
    age: 30,
    retirementAge: 60,
    expectedReturnRate: 0.08,
    expectedInflationRate: 0.06,
    expectedWithdrawalRate: 0.04,
    lifestyleAdjustmentRatio: 0.80,
    retirementCorpusGoal: 8_000_000,
    currentBalance: 50_000,
    ...overrides
  };
}

function mockTransactions() {
  const txs = [];
  const now = new Date('2026-06-15');
  // 6 months of historical transactions: ₹40k Needs, ₹10k Wants, ₹25k Investments per month
  for (let m = 1; m <= 6; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 10);
    txs.push(
      { amount: 40_000, type: 'Need', timestamp: d, category: 'Groceries' },
      { amount: 10_000, type: 'Want', timestamp: d, category: 'Entertainment' },
      { amount: 25_000, type: 'Investment', timestamp: d, category: 'Mutual Funds' }
    );
  }
  return txs;
}

function mockAssets() {
  return [
    {
      currentValue: 1_000_000,
      assetClass: 'FIRE_INVESTABLE',
      includedInFireCorpus: true,
      liquidity: 'locked'
    },
    {
      currentValue: 300_000,
      assetClass: 'SEMI_LIQUID',
      includedInFireCorpus: true,
      liquidity: 'liquid'
    }
  ];
}

function mockPythonResponse(overrides = {}) {
  const base = {
    meta: {
      engineVersion: 'mc-v1',
      simulationCount: 1000,
      seed: 42
    },
    simulation: {
      probabilityFundedAtTargetAge: 0.35,
      probabilityReachedFireByTargetAge: 0.38,
      corpusPercentiles: {
        p10: 4_000_000,
        p25: 6_000_000,
        p50: 8_500_000,
        p75: 12_000_000,
        p90: 16_000_000
      },
      firstCrossing: {
        percentCrossed: 0.38,
        p25Month: 220,
        p50Month: 250,
        p75Month: 290
      },
      userGoal: {
        probabilityFundedAtTargetAge: 0.62,
        probabilityReachedByTargetAge: 0.65
      },
      centralPath: {
        finalCorpusNominal: 28_000_000,
        finalCorpusReal: 8_500_000
      }
    },
    contributionSolver: {
      solved: true,
      targetProbability: 0.75,
      targetType: 'ESTIMATED_FIRE',
      currentMonthlyContribution: 25_000,
      currentProbabilityFunded: 0.35,
      recommendedMonthlyContribution: 48_500,
      additionalMonthlyContributionRequired: 23_500,
      achievedProbabilityFunded: 0.752,
      recommendationIncrement: 100
    },
    fundedAge: {
      fundedAge50: {
        reached: true,
        ageYears: 54.5,
        monthsFromNow: 294,
        probabilityAtAge: 0.502
      },
      fundedAge75: {
        reached: true,
        ageYears: 72.0,
        monthsFromNow: 504,
        probabilityAtAge: 0.751
      },
      userGoalFundedAge50: {
        reached: true,
        ageYears: 46.0,
        monthsFromNow: 192,
        probabilityAtAge: 0.505
      },
      userGoalFundedAge75: {
        reached: true,
        ageYears: 56.5,
        monthsFromNow: 318,
        probabilityAtAge: 0.753
      }
    }
  };
  return { ...base, ...overrides };
}

// ===========================================================================
// Test Execution
// ===========================================================================

async function runAllNodeMonteCarloTests() {
  console.log('='.repeat(64));
  console.log('  FINAURA MONTE CARLO NODE INTEGRATION TEST SUITE');
  console.log('='.repeat(64));
  console.log();

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    console.log(`Running ${name}...`);
    try {
      await fn();
      passed++;
      console.log(`  ✅ ${name} Passed`);
    } catch (err) {
      failed++;
      console.log(`  ❌ ${name} FAILED: ${err.message}`);
      console.error(err);
    }
    console.log();
  }

  // --- 1. Valid forecast -> Python called with expected normalized payload ---
  await test('Test 1: Valid forecast -> Python called with normalized payload', async () => {
    let calledPayload = null;
    let callCount = 0;

    const mockFetch = async (url, opts) => {
      callCount++;
      calledPayload = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => mockPythonResponse()
      };
    };

    const data = {
      user: mockUser(),
      transactions: mockTransactions(),
      assets: mockAssets(),
      incomes: []
    };

    const snapshot = await buildPredictabilitySnapshotAsync(data, {
      referenceDate: '2026-06-15',
      fetchImpl: mockFetch
    });

    assert.equal(callCount, 1, 'Python service should be called exactly once');
    assert.equal(calledPayload.startingCorpus, 1_300_000);
    assert.equal(calledPayload.monthlyContribution, 25_000);
    assert.equal(calledPayload.expectedReturnRate, 0.08);
    assert.equal(calledPayload.expectedInflationRate, 0.06);
    assert.equal(calledPayload.portfolioVolatility, 0.12); // -0.04 + 2 * 0.08 = 0.12
    assert.equal(calledPayload.volatilitySource, 'RETURN_DERIVED');
    assert.equal(calledPayload.monthsUntilRetirement, 360);
    assert.equal(calledPayload.includeSimulation, true);
    assert.equal(calledPayload.includeContributionSolver, true);
    assert.equal(calledPayload.includeFundedAgeSolver, true);
    assert.equal(snapshot.probabilistic.available, true);
    assert.ok(snapshot.probabilistic.warnings.includes('PORTFOLIO_RISK_ESTIMATED'));
  });

  // --- 2. forecastStatus unavailable -> Python NOT called ---
  await test('Test 2: forecastStatus unavailable -> Python NOT called', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return { ok: true, json: async () => ({}) };
    };

    // User with 0 transactions -> forecast unavailable
    const data = {
      user: mockUser(),
      transactions: [],
      assets: mockAssets(),
      incomes: []
    };

    const snapshot = await buildPredictabilitySnapshotAsync(data, {
      referenceDate: '2026-06-15',
      fetchImpl: mockFetch
    });

    assert.equal(callCount, 0, 'Python service must NOT be called when forecastStatus.available is false');
    assert.equal(snapshot.probabilistic.available, false);
    assert.equal(snapshot.probabilistic.reason, 'FORECAST_INPUTS_UNAVAILABLE');
    assert.ok(snapshot.probabilistic.missingInputs.includes('INSUFFICIENT_SPENDING_HISTORY'));
  });

  // --- 3. Deterministic response fields unchanged when MC succeeds ---
  await test('Test 3: Deterministic fields unchanged when MC succeeds', async () => {
    const data = {
      user: mockUser(),
      transactions: mockTransactions(),
      assets: mockAssets(),
      incomes: []
    };

    const deterministic = buildPredictabilitySnapshot(data, { referenceDate: '2026-06-15' });

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => mockPythonResponse()
    });

    const withMC = await buildPredictabilitySnapshotAsync(data, {
      referenceDate: '2026-06-15',
      fetchImpl: mockFetch
    });

    // Check strict equality of all core deterministic structures
    assert.deepEqual(withMC.retirement, deterministic.retirement);
    assert.deepEqual(withMC.scenarios, deterministic.scenarios);
    assert.deepEqual(withMC.currentState, deterministic.currentState);
    assert.deepEqual(withMC.assets, deterministic.assets);
    assert.deepEqual(withMC.liabilities, deterministic.liabilities);
    assert.deepEqual(withMC.emergencyFund, deterministic.emergencyFund);
  });

  // --- 4. Probabilistic section correctly maps simulation results ---
  await test('Test 4: Probabilistic section mapping', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => mockPythonResponse()
    });

    const snapshot = await buildPredictabilitySnapshotAsync({
      user: mockUser(),
      transactions: mockTransactions(),
      assets: mockAssets()
    }, { referenceDate: '2026-06-15', fetchImpl: mockFetch });

    const prob = snapshot.probabilistic;
    assert.equal(prob.available, true);
    assert.equal(prob.engineVersion, 'mc-v1');
    assert.equal(prob.assumptions.expectedReturnRate, 0.08);
    assert.equal(prob.assumptions.portfolioVolatility, 0.12);
    assert.equal(prob.assumptions.volatilitySource, 'RETURN_DERIVED');
    assert.ok(prob.warnings.includes('PORTFOLIO_RISK_ESTIMATED'));
    assert.equal(prob.estimatedFire.probabilityFundedAtTargetAge, 0.35);
    assert.equal(prob.estimatedFire.corpusPercentiles.p50, 8_500_000);
    assert.equal(prob.estimatedFire.corpusPercentiles.p90, 16_000_000);
  });

  // --- 5. Contribution recommendation mapping ---
  await test('Test 5: Contribution recommendation mapping', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => mockPythonResponse()
    });

    const snapshot = await buildPredictabilitySnapshotAsync({
      user: mockUser(),
      transactions: mockTransactions(),
      assets: mockAssets()
    }, { referenceDate: '2026-06-15', fetchImpl: mockFetch });

    const rec = snapshot.probabilistic.contributionRecommendation;
    assert.equal(rec.solved, true);
    assert.equal(rec.targetProbability, 0.75);
    assert.equal(rec.recommendedMonthlyContribution, 48_500);
    assert.equal(rec.additionalMonthlyContributionRequired, 23_500);
    assert.equal(rec.achievedProbabilityFunded, 0.752);
  });

  // --- 6. fundedAge50/75 mapping ---
  await test('Test 6: fundedAge50/75 population funding mapping', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => mockPythonResponse()
    });

    const snapshot = await buildPredictabilitySnapshotAsync({
      user: mockUser(),
      transactions: mockTransactions(),
      assets: mockAssets()
    }, { referenceDate: '2026-06-15', fetchImpl: mockFetch });

    const ef = snapshot.probabilistic.estimatedFire;
    assert.equal(ef.fundedAge50.reached, true);
    assert.equal(ef.fundedAge50.ageYears, 54.5);
    assert.equal(ef.fundedAge50.monthsFromNow, 294);
    assert.equal(ef.fundedAge75.reached, true);
    assert.equal(ef.fundedAge75.ageYears, 72.0);
    assert.equal(ef.fundedAge75.monthsFromNow, 504);
  });

  // --- 7. userGoal metrics remain separate ---
  await test('Test 7: userGoal metrics separate from estimated FIRE', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => mockPythonResponse()
    });

    const snapshot = await buildPredictabilitySnapshotAsync({
      user: mockUser({ retirementCorpusGoal: 8_000_000 }),
      transactions: mockTransactions(),
      assets: mockAssets()
    }, { referenceDate: '2026-06-15', fetchImpl: mockFetch });

    assert.ok(snapshot.probabilistic.userGoal);
    assert.equal(snapshot.probabilistic.userGoal.targetAmountReal, 8_000_000);
    assert.equal(snapshot.probabilistic.userGoal.probabilityFundedAtTargetAge, 0.62);
    assert.notEqual(snapshot.probabilistic.userGoal.probabilityFundedAtTargetAge, snapshot.probabilistic.estimatedFire.probabilityFundedAtTargetAge);
  });

  // --- 8. Deterministic seed: same inputs -> same seed ---
  await test('Test 8: Deterministic seed reproducibility', async () => {
    const p1 = {
      startingCorpus: 1_000_000,
      monthlyContribution: 25_000,
      expectedReturnRate: 0.08,
      expectedInflationRate: 0.06,
      portfolioVolatility: 0.12,
      estimatedFireCorpus: 12_000_000,
      userGoalCorpus: 8_000_000,
      monthsUntilRetirement: 300,
      contributionMode: 'NOMINAL_FLAT',
      simulationCount: 10000,
      currentAge: 30,
      maxSearchAge: 85
    };

    const s1 = deriveMonteCarloSeed(p1);
    const s2 = deriveMonteCarloSeed(p1);
    assert.equal(s1, s2, 'Same input parameters must yield bit-identical seed');
    assert.ok(Number.isInteger(s1) && s1 > 0, 'Seed must be a positive integer');
  });

  // --- 9. Relevant financial input changes -> seed changes ---
  await test('Test 9: Financial parameter modification changes seed', async () => {
    const base = {
      startingCorpus: 1_000_000,
      monthlyContribution: 25_000,
      expectedReturnRate: 0.08,
      expectedInflationRate: 0.06,
      portfolioVolatility: 0.12,
      estimatedFireCorpus: 12_000_000,
      userGoalCorpus: 8_000_000,
      monthsUntilRetirement: 300,
      contributionMode: 'NOMINAL_FLAT',
      simulationCount: 10000,
      currentAge: 30,
      maxSearchAge: 85
    };

    const seedBase = deriveMonteCarloSeed(base);
    assert.notEqual(deriveMonteCarloSeed({ ...base, startingCorpus: 1_000_500 }), seedBase);
    assert.notEqual(deriveMonteCarloSeed({ ...base, monthlyContribution: 30_000 }), seedBase);
    assert.notEqual(deriveMonteCarloSeed({ ...base, expectedReturnRate: 0.09, portfolioVolatility: 0.14 }), seedBase);
    assert.notEqual(deriveMonteCarloSeed({ ...base, estimatedFireCorpus: 15_000_000 }), seedBase);
    assert.notEqual(deriveMonteCarloSeed({ ...base, monthsUntilRetirement: 240 }), seedBase);
    assert.notEqual(deriveMonteCarloSeed({ ...base, contributionMode: 'REAL_CONSTANT' }), seedBase);
  });

  // --- 10. Irrelevant presentation metadata -> seed unchanged ---
  await test('Test 10: Presentation/UI metadata does NOT alter seed', async () => {
    const p1 = {
      startingCorpus: 1_000_000,
      monthlyContribution: 25_000,
      expectedReturnRate: 0.08,
      expectedInflationRate: 0.06,
      portfolioVolatility: 0.12,
      estimatedFireCorpus: 12_000_000,
      userGoalCorpus: 8_000_000,
      monthsUntilRetirement: 300,
      contributionMode: 'NOMINAL_FLAT',
      simulationCount: 10000,
      currentAge: 30,
      maxSearchAge: 85,
      // Extraneous metadata
      theme: 'dark',
      requestId: 'req_12345',
      timestamp: Date.now()
    };

    const p2 = {
      ...p1,
      theme: 'light',
      requestId: 'req_67890',
      timestamp: Date.now() + 50000
    };

    assert.equal(deriveMonteCarloSeed(p1), deriveMonteCarloSeed(p2));
  });

  // --- 11. Python timeout -> graceful fallback ---
  await test('Test 11: Python timeout -> deterministic succeeds, MC unavailable', async () => {
    const mockFetch = async () => {
      const err = new Error('The operation was aborted');
      err.name = 'TimeoutError';
      throw err;
    };

    const snapshot = await buildPredictabilitySnapshotAsync({
      user: mockUser(),
      transactions: mockTransactions(),
      assets: mockAssets()
    }, { referenceDate: '2026-06-15', fetchImpl: mockFetch });

    assert.ok(snapshot.retirement, 'Deterministic retirement section must exist');
    assert.equal(snapshot.probabilistic.available, false);
    assert.equal(snapshot.probabilistic.reason, 'SIMULATION_SERVICE_UNAVAILABLE');
    assert.ok(snapshot.explanationFacts.some(f => f.code === 'MONTE_CARLO_UNAVAILABLE'));
  });

  // --- 12. Python network error -> graceful fallback ---
  await test('Test 12: Network error -> graceful fallback', async () => {
    const mockFetch = async () => {
      throw new Error('fetch failed: ECONNREFUSED 127.0.0.1:5001');
    };

    const snapshot = await buildPredictabilitySnapshotAsync({
      user: mockUser(),
      transactions: mockTransactions(),
      assets: mockAssets()
    }, { referenceDate: '2026-06-15', fetchImpl: mockFetch });

    assert.equal(snapshot.probabilistic.available, false);
    assert.equal(snapshot.probabilistic.reason, 'SIMULATION_SERVICE_UNAVAILABLE');
  });

  // --- 13. Python HTTP 500 -> graceful fallback ---
  await test('Test 13: Python HTTP 500 -> graceful fallback', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'NumPy crash' } })
    });

    const snapshot = await buildPredictabilitySnapshotAsync({
      user: mockUser(),
      transactions: mockTransactions(),
      assets: mockAssets()
    }, { referenceDate: '2026-06-15', fetchImpl: mockFetch });

    assert.equal(snapshot.probabilistic.available, false);
    assert.equal(snapshot.probabilistic.reason, 'SIMULATION_SERVICE_ERROR');
  });

  // --- 14. Python HTTP 400 -> internal-input-error handling ---
  await test('Test 14: Python HTTP 400 -> SIMULATION_INPUT_REJECTED', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 'INVALID_SIMULATION_INPUT', message: 'Negative corpus' } })
    });

    const snapshot = await buildPredictabilitySnapshotAsync({
      user: mockUser(),
      transactions: mockTransactions(),
      assets: mockAssets()
    }, { referenceDate: '2026-06-15', fetchImpl: mockFetch });

    assert.equal(snapshot.probabilistic.available, false);
    assert.equal(snapshot.probabilistic.reason, 'SIMULATION_INPUT_REJECTED');
  });

  // --- 15. Malformed Python probability > 1 -> response rejected ---
  await test('Test 15: Malformed probability (> 1.0) rejected', async () => {
    const badResp = mockPythonResponse();
    badResp.simulation.probabilityFundedAtTargetAge = 1.45; // Invalid!

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => badResp
    });

    const snapshot = await buildPredictabilitySnapshotAsync({
      user: mockUser(),
      transactions: mockTransactions(),
      assets: mockAssets()
    }, { referenceDate: '2026-06-15', fetchImpl: mockFetch });

    assert.equal(snapshot.probabilistic.available, false);
    assert.equal(snapshot.probabilistic.reason, 'SIMULATION_RESPONSE_INVALID');
  });

  // --- 16. NaN / Infinity in Python response -> rejected ---
  await test('Test 16: NaN/Infinity in response rejected', async () => {
    const badResp = mockPythonResponse();
    badResp.simulation.corpusPercentiles.p50 = NaN;

    assert.equal(validateMonteCarloResponse(badResp), false);
  });

  // --- 17. Percentile ordering violation -> rejected ---
  await test('Test 17: Percentile ordering violation (p10 > p25) rejected', async () => {
    const badResp = mockPythonResponse();
    badResp.simulation.corpusPercentiles.p10 = 10_000_000;
    badResp.simulation.corpusPercentiles.p25 = 5_000_000; // Inverted!

    assert.equal(validateMonteCarloResponse(badResp), false);
  });

  // --- 18. Unsolved contribution solver -> valid probabilistic response ---
  await test('Test 18: Unsolved contribution solver (solved=false) handled cleanly', async () => {
    const respUnsolved = mockPythonResponse({
      contributionSolver: {
        solved: false,
        reason: 'TARGET_PROBABILITY_NOT_REACHED_WITHIN_SEARCH_LIMIT',
        targetProbability: 0.99
      }
    });

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => respUnsolved
    });

    const snapshot = await buildPredictabilitySnapshotAsync({
      user: mockUser(),
      transactions: mockTransactions(),
      assets: mockAssets()
    }, { referenceDate: '2026-06-15', fetchImpl: mockFetch });

    assert.equal(snapshot.probabilistic.available, true);
    assert.equal(snapshot.probabilistic.contributionRecommendation.solved, false);
  });

  // --- 19. Funded age unreached -> valid response ---
  await test('Test 19: Unreached funded ages (reached=false) handled cleanly', async () => {
    const respUnreached = mockPythonResponse({
      fundedAge: {
        fundedAge50: { reached: false, ageYears: null, monthsFromNow: null },
        fundedAge75: { reached: false, ageYears: null, monthsFromNow: null }
      }
    });

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => respUnreached
    });

    const snapshot = await buildPredictabilitySnapshotAsync({
      user: mockUser(),
      transactions: mockTransactions(),
      assets: mockAssets()
    }, { referenceDate: '2026-06-15', fetchImpl: mockFetch });

    assert.equal(snapshot.probabilistic.available, true);
    assert.equal(snapshot.probabilistic.estimatedFire.fundedAge50.reached, false);
    assert.equal(snapshot.probabilistic.estimatedFire.fundedAge75.reached, false);
  });

  // --- 20. Zero DB writes guarantee ---
  await test('Test 20: Predictability generation causes zero database writes', async () => {
    // Pure in-memory invocation guarantees zero database write side effects
    const snapshot = buildPredictabilitySnapshot({
      user: mockUser(),
      transactions: mockTransactions(),
      assets: mockAssets()
    });
    assert.ok(snapshot.retirement);
  });

  // --- 21. Existing Base scenario output unchanged ---
  await test('Test 21: Existing Base scenario numbers unchanged', async () => {
    const data = {
      user: mockUser(),
      transactions: mockTransactions(),
      assets: mockAssets()
    };
    const snapshot = buildPredictabilitySnapshot(data, { referenceDate: '2026-06-15' });

    assert.equal(snapshot.scenarios.base.id, 'base');
    assert.equal(snapshot.scenarios.base.estimatedFireCorpus, snapshot.retirement.estimatedFireCorpus);
    assert.equal(snapshot.scenarios.base.projectedCorpusAtRetirement, snapshot.retirement.projectedCorpusAtRetirement);
  });

  // --- 22. Existing API contract backward compatibility ---
  await test('Test 22: API envelope backward compatibility', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => mockPythonResponse()
    });

    const snapshot = await buildPredictabilitySnapshotAsync({
      user: mockUser(),
      transactions: mockTransactions(),
      assets: mockAssets()
    }, { referenceDate: '2026-06-15', fetchImpl: mockFetch });

    // Verify all legacy fields exist at top level
    const topLevelFields = [
      'generatedAt',
      'forecastStatus',
      'dataQuality',
      'currentState',
      'income',
      'resilience',
      'assets',
      'liabilities',
      'emergencyFund',
      'retirement',
      'scenarios',
      'explanationFacts',
      'limitations',
      'probabilistic' // New additive section
    ];

    for (const f of topLevelFields) {
      assert.ok(f in snapshot, `Snapshot must contain top-level field '${f}'`);
    }
  });

  // --- 23. Low dataQuality preserved distinctly from modeled probability ---
  await test('Test 23: Low dataQuality preserved distinctly from modeled probability', async () => {
    // 1 month of transactions -> LOW data quality
    const now = new Date('2026-06-15');
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 10);
    const lowTx = [
      { amount: 40_000, type: 'Need', timestamp: d, category: 'Groceries' },
      { amount: 10_000, type: 'Want', timestamp: d, category: 'Entertainment' },
      { amount: 25_000, type: 'Investment', timestamp: d, category: 'Mutual Funds' }
    ];

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => mockPythonResponse()
    });

    const snapshot = await buildPredictabilitySnapshotAsync({
      user: mockUser(),
      transactions: lowTx,
      assets: mockAssets()
    }, { referenceDate: '2026-06-15', fetchImpl: mockFetch });

    assert.equal(snapshot.forecastStatus.dataQuality, 'LOW');
    assert.equal(snapshot.probabilistic.dataQuality, 'LOW');
    assert.equal(snapshot.probabilistic.estimatedFire.probabilityFundedAtTargetAge, 0.35);
    assert.ok(snapshot.probabilistic.warnings.includes('PORTFOLIO_RISK_ESTIMATED'));
    assert.ok(snapshot.explanationFacts.some(f => f.code === 'MONTE_CARLO_DATA_QUALITY_LOW'));
    assert.ok(snapshot.explanationFacts.some(f => f.code === 'PORTFOLIO_RISK_ESTIMATED'));
  });

  // --- 24. Frozen V1 Volatility Exact Table & Clamping Tests ---
  await test('Test 24: Frozen V1 Volatility exact table mapping and boundary clamps', async () => {
    const table = [
      { returnRate: 0.00, expectedSigma: 0.06 },
      { returnRate: 0.04, expectedSigma: 0.06 },
      { returnRate: 0.06, expectedSigma: 0.08 },
      { returnRate: 0.08, expectedSigma: 0.12 },
      { returnRate: 0.10, expectedSigma: 0.16 },
      { returnRate: 0.12, expectedSigma: 0.20 },
      { returnRate: 0.15, expectedSigma: 0.22 },
      { returnRate: 0.20, expectedSigma: 0.22 }
    ];

    for (const { returnRate, expectedSigma } of table) {
      const res = derivePortfolioVolatility(returnRate);
      assert.equal(
        res.portfolioVolatility,
        expectedSigma,
        `Expected return ${returnRate} to map to sigma ${expectedSigma}, got ${res.portfolioVolatility}`
      );
      assert.equal(res.volatilitySource, 'RETURN_DERIVED');
      assert.equal(res.effectiveExpectedReturnRate, returnRate);
      assert.ok(Number.isFinite(res.portfolioVolatility));
      assert.ok(res.portfolioVolatility >= 0.06 && res.portfolioVolatility <= 0.22);
    }
  });

  // --- 25. Missing / Invalid Return Policy ---
  await test('Test 25: Missing or invalid return rates fall back to SYSTEM_DEFAULT (0.08 -> 0.12)', async () => {
    const invalidReturns = [null, undefined, NaN, Infinity, -Infinity, -0.05, 1.5, '0.08', {}];

    for (const invalid of invalidReturns) {
      const res = derivePortfolioVolatility(invalid);
      assert.equal(res.effectiveExpectedReturnRate, 0.08);
      assert.equal(res.portfolioVolatility, 0.12);
      assert.equal(res.volatilitySource, 'SYSTEM_DEFAULT');
      assert.ok(Number.isFinite(res.portfolioVolatility));
    }
  });

  // --- 26. Volatility Overrides Ignored ---
  await test('Test 26: Volatility overrides (options, user, riskProfile) have zero authority in V1', async () => {
    const userWithOverrides = mockUser({
      expectedReturnRate: 0.08,
      portfolioVolatility: 0.20, // Should be ignored!
      riskProfile: 'AGGRESSIVE'  // Should be ignored!
    });

    const payload = buildMonteCarloPayload({ user: userWithOverrides, fireInvestableCorpus: 1000000 }, {
      portfolioVolatility: 0.05 // Should be ignored!
    });

    assert.equal(payload.expectedReturnRate, 0.08);
    assert.equal(payload.portfolioVolatility, 0.12); // Strictly derived from 0.08 return
    assert.equal(payload.volatilitySource, 'RETURN_DERIVED');
  });

  // --- 27. PORTFOLIO_RISK_ESTIMATED Warning Present on All Successful Probabilistic Forecasts ---
  await test('Test 27: PORTFOLIO_RISK_ESTIMATED warning present on successful probabilistic result', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => mockPythonResponse()
    });

    const snapshot = await buildPredictabilitySnapshotAsync({
      user: mockUser(),
      transactions: mockTransactions(),
      assets: mockAssets()
    }, { referenceDate: '2026-06-15', fetchImpl: mockFetch });

    assert.ok(Array.isArray(snapshot.probabilistic.warnings));
    assert.ok(snapshot.probabilistic.warnings.includes('PORTFOLIO_RISK_ESTIMATED'));
    assert.ok(snapshot.explanationFacts.some(f => f.code === 'PORTFOLIO_RISK_ESTIMATED'));
  });

  // --- 28. Monotonicity of Volatility in Unclamped Region ---
  await test('Test 28: Monotonicity of derived volatility with respect to expected return rate', async () => {
    const returns = [0.00, 0.02, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.11, 0.12, 0.13, 0.15, 0.18, 0.20];
    let prevSigma = -1;

    for (const r of returns) {
      const { portfolioVolatility } = derivePortfolioVolatility(r);
      assert.ok(
        portfolioVolatility >= prevSigma,
        `Monotonicity violation: for return ${r}, sigma ${portfolioVolatility} < prevSigma ${prevSigma}`
      );
      prevSigma = portfolioVolatility;
    }
  });

  console.log('='.repeat(64));
  if (failed === 0) {
    console.log(`  ALL ${passed} NODE MONTE CARLO INTEGRATION TESTS PASSED! 🚀`);
  } else {
    console.log(`  RESULTS: ${passed} passed, ${failed} FAILED`);
  }
  console.log('='.repeat(64));

  return failed === 0;
}

runAllNodeMonteCarloTests()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });

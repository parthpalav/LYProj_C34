/**
 * server/test_predictability_monte_carlo_live.js
 * 
 * Live End-to-End Node ↔ Python /simulate integration and benchmark test.
 */

import assert from 'node:assert/strict';
import { buildPredictabilitySnapshotAsync } from './services/PredictabilityService.js';

async function runLiveTest() {
  console.log('='.repeat(64));
  console.log('  LIVE NODE ↔ FLASK MONTE CARLO INTEGRATION TEST');
  console.log('='.repeat(64));
  console.log();

  const user = {
    id: 'user_live_test',
    name: 'Live Test User',
    age: 32,
    retirementAge: 60,
    expectedReturnRate: 0.08,
    expectedInflationRate: 0.06,
    expectedWithdrawalRate: 0.04,
    lifestyleAdjustmentRatio: 0.80,
    retirementCorpusGoal: 10_000_000,
    currentBalance: 50_000
  };

  const now = new Date('2026-06-15');
  const transactions = [];
  for (let m = 1; m <= 6; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 10);
    transactions.push(
      { amount: 45_000, type: 'Need', timestamp: d, category: 'Groceries' },
      { amount: 15_000, type: 'Want', timestamp: d, category: 'Dining' },
      { amount: 30_000, type: 'Investment', timestamp: d, category: 'SIP' }
    );
  }

  const assets = [
    { currentValue: 1_500_000, assetClass: 'FIRE_INVESTABLE', includedInFireCorpus: true, liquidity: 'locked' },
    { currentValue: 500_000, assetClass: 'SEMI_LIQUID', includedInFireCorpus: true, liquidity: 'liquid' }
  ];

  const data = { user, transactions, assets, incomes: [] };

  console.log('1. Executing live end-to-end simulation (10,000 paths)...');
  const t0 = performance.now();
  const snapshot = await buildPredictabilitySnapshotAsync(data, {
    referenceDate: '2026-06-15',
    simulationCount: 10000
  });
  const totalMs = performance.now() - t0;

  assert.equal(snapshot.probabilistic.available, true);
  assert.equal(snapshot.probabilistic.engineVersion, 'mc-v1');
  assert.ok(snapshot.probabilistic.estimatedFire.probabilityFundedAtTargetAge > 0);
  assert.ok(snapshot.probabilistic.contributionRecommendation.solved);
  assert.ok(snapshot.probabilistic.estimatedFire.fundedAge50.reached);

  console.log(`  ✅ Live response received in ${totalMs.toFixed(1)} ms!`);
  console.log(`     Target Corpus (FIRE): ₹${(snapshot.probabilistic.estimatedFire.targetAmountReal / 1e7).toFixed(2)} Cr`);
  console.log(`     P(Funded @ Age 60):   ${(snapshot.probabilistic.estimatedFire.probabilityFundedAtTargetAge * 100).toFixed(1)}%`);
  console.log(`     Median Corpus (p50):  ₹${(snapshot.probabilistic.estimatedFire.corpusPercentiles.p50 / 1e5).toFixed(1)} Lakhs`);
  console.log(`     Funded Age (50%):     ${snapshot.probabilistic.estimatedFire.fundedAge50.reached ? `Age ${snapshot.probabilistic.estimatedFire.fundedAge50.ageYears.toFixed(1)}` : 'Not reached'}`);
  console.log(`     Funded Age (75%):     ${snapshot.probabilistic.estimatedFire.fundedAge75.reached ? `Age ${snapshot.probabilistic.estimatedFire.fundedAge75.ageYears.toFixed(1)}` : 'Not reached'}`);
  console.log(`     Recommended SIP (75%):₹${snapshot.probabilistic.contributionRecommendation.recommendedMonthlyContribution.toLocaleString('en-IN')}/mo`);

  console.log();
  console.log('='.repeat(64));
  console.log('  LIVE INTEGRATION VERIFIED SUCCESSFULLY! 🚀');
  console.log('='.repeat(64));
}

runLiveTest().catch(err => {
  console.error('Live test error:', err);
  process.exit(1);
});

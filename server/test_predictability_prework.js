import assert from 'assert';
import { resolveForecastInputs } from './utils/forecastResolver.js';
import { CONTRIBUTION_MODE } from './utils/financialMath.js';

/**
 * FINAURA - Deterministic Pre-work / Monte Carlo Input Resolver Tests
 */

function createMockData() {
  return {
    user: {
      id: 'mock_user',
      age: 30,
      retirementAge: 50,
      expectedReturnRate: 0.12,
      expectedInflationRate: 0.06,
      expectedWithdrawalRate: 0.04,
      lifestyleAdjustmentRatio: 1.0,
      currentBalance: 50000
    },
    assets: [
      { id: 'a1', currentValue: 200000, assetClass: 'SEMI_LIQUID', assetType: 'savings' },
      { id: 'a2', currentValue: 500000, assetClass: 'EQUITY', assetType: 'stocks' }
    ],
    liabilities: [
      { 
        id: 'l1', 
        name: 'Car Loan',
        amount: 20000, 
        frequency: 'monthly',
        outstandingBalance: 500000,
        interestRate: 0.09,
        remainingTermMonths: 30 // ends before retirement (240 months)
      },
      { 
        id: 'l2',
        name: 'Home Loan',
        amount: 50000, 
        frequency: 'monthly',
        outstandingBalance: 6000000,
        interestRate: 0.08,
        remainingTermMonths: 300 // ends after retirement
      }
    ],
    transactions: generateHistory(10),
    incomes: [] // ignored for these tests but kept for structure
  };
}

function generateHistory(months) {
  const txs = [];
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 15);
    txs.push({ timestamp: d.toISOString(), amount: 10000, type: 'Need', category: 'groceries' });
    txs.push({ timestamp: d.toISOString(), amount: 5000, type: 'Want', category: 'dining' });
    txs.push({ timestamp: d.toISOString(), amount: 20000, type: 'Investment', category: 'mf' });
  }
  return txs;
}

function runTests() {
  console.log('Running Deterministic Pre-work Tests...\n');

  // Test 1: Full History, Valid Inputs
  const data1 = createMockData();
  const res1 = resolveForecastInputs(data1, { spendingWindowMonths: 6 });
  
  assert.strictEqual(res1.forecastStatus.available, true);
  assert.strictEqual(res1.forecastStatus.dataQuality, 'HIGH');
  assert.strictEqual(res1.activeMonthsCount, 7); // current month + 6 trailing = 7 months usually if in same window
  assert.strictEqual(res1.averageMonthlyNeeds, 10000);
  assert.strictEqual(res1.monthlyLiabilityService, 70000);
  assert.strictEqual(res1.totalEssentialSpending, 80000);
  assert.strictEqual(res1.observedAverageMonthlyInvestment, 20000);
  
  // Liability overhang check
  // L1: 30 months left. Retires in 240 months. Overhang = 0
  // L2: 300 months left. Retires in 240 months. 
  // P = 6000000, PMT = 50000, r = 0.08/12, T = 240
  const r = 0.08 / 12;
  const T = 240;
  const expectedOverhang = 6000000 * Math.pow(1+r, T) - 50000 * (Math.pow(1+r, T) - 1) / r;
  assert(Math.abs(res1.liabilityOverhang - expectedOverhang) < 1);
  console.log('✅ Test 1 Passed: Full history resolves correctly with liability overhang.');

  // Test 2: Insufficient History
  const data2 = createMockData();
  data2.transactions = []; // No history
  const res2 = resolveForecastInputs(data2);
  assert.strictEqual(res2.forecastStatus.available, false);
  assert.strictEqual(res2.forecastStatus.dataQuality, 'INSUFFICIENT');
  assert(res2.forecastStatus.missingInputs.includes('INSUFFICIENT_SPENDING_HISTORY'));
  assert(res2.forecastStatus.missingInputs.includes('MISSING_INVESTMENT_BASELINE'));
  console.log('✅ Test 2 Passed: Insufficient history correctly marked unavailable.');

  // Test 3: History exists but Investment is 0 (no investment txs)
  const data3 = createMockData();
  data3.transactions = data3.transactions.filter(t => t.type !== 'Investment');
  const res3 = resolveForecastInputs(data3);
  assert.strictEqual(res3.forecastStatus.available, true);
  assert.strictEqual(res3.monthlyContributionUsed, 0); // 0 is valid mathematically, user must grow it
  console.log('✅ Test 3 Passed: Zero investment baseline is valid.');

  // Test 4: Missing Retirement Age
  const data4 = createMockData();
  delete data4.user.retirementAge;
  const res4 = resolveForecastInputs(data4);
  assert.strictEqual(res4.forecastStatus.available, true); // fallback is 60
  assert.strictEqual(res4.retirementAge, 60);
  console.log('✅ Test 4 Passed: Missing retirement age falls back to 60.');

  // Test 5: Unknown Liability Maturity
  const data5 = createMockData();
  data5.liabilities[0].remainingTermMonths = null;
  data5.liabilities[0].interestRate = null;
  const res5 = resolveForecastInputs(data5);
  assert.strictEqual(res5.forecastStatus.warnings.includes('UNKNOWN_LIABILITY_MATURITY_EXCLUDED'), true);
  console.log('✅ Test 5 Passed: Unknown maturity liability excluded from overhang with warning.');

  // Test 6: Contribution Override
  const data6 = createMockData();
  const res6 = resolveForecastInputs(data6, { monthlyContributionOverride: 99999 });
  assert.strictEqual(res6.monthlyContributionUsed, 99999);
  console.log('✅ Test 6 Passed: Contribution override overrides history.');

  console.log('\nAll Deterministic Pre-work Tests Passed! 🚀');
}

runTests();

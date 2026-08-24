import mongoose from 'mongoose';
import assert from 'assert';
import dotenv from 'dotenv';
import User from './models/User.js';
import Income from './models/Income.js';
import Transaction from './models/Transaction.js';
import Liability from './models/Liability.js';
import Asset from './models/Asset.js';
import { connectDB } from './config/db.js';
import {
  isConsumption,
  isInvestment,
  isDebtService,
  getCashFlowDirection
} from './utils/financialAccounting.js';
import { calculateFMI } from './services/FMIService.js';
import { smoothIncomeFlow } from './services/IncomeFlowService.js';
import { processLiabilities } from './services/LiabilityScheduler.js';
import controllerRouter from './controllers/index.js';

dotenv.config({ path: '.env' });

// Mock response object
function mockRes() {
  return {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
}

// Helper to find controller route handlers
function getRouteHandler(method, path) {
  for (const layer of controllerRouter.stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
      return layer.route.stack[0].handle;
    }
  }
  throw new Error(`Route handler not found for ${method} ${path}`);
}

async function runTests() {
  console.log('============================================================');
  console.log('  FINAURA PREDICTABILITY FOUNDATION TEST SUITE');
  console.log('============================================================\n');

  await connectDB();

  const testUserId = 'TEST_ACCT_FOUNDATION_USER';
  const testEmail = 'test_acct_foundation@finaura.test';

  // Target-scoped cleanup to prevent wiping actual development data
  console.log('Cleaning up target-scoped test data...');
  await User.deleteMany({ id: testUserId });
  await Income.deleteMany({ userId: testUserId });
  await Transaction.deleteMany({ userId: testUserId });
  await Liability.deleteMany({ userId: testUserId });
  await Asset.deleteMany({ userId: testUserId });

  console.log('Setting up test user...');
  const user = await User.create({
    id: testUserId,
    name: 'Foundation Tester',
    email: testEmail,
    currentBalance: 50000 // base balance
  });

  const postIncomeHandler = getRouteHandler('POST', '/income');
  const putIncomeHandler = getRouteHandler('PUT', '/income/:id');
  const deleteIncomeHandler = getRouteHandler('DELETE', '/income/:id');
  const postTxHandler = getRouteHandler('POST', '/transactions');

  // -----------------------------------------------------------------
  // 1. INCOME RECONCILIATION TESTS
  // -----------------------------------------------------------------
  console.log('\n--- Running Income Reconciliation Tests ---');

  // Test 1.1: Creating income increases balance
  {
    const req = {
      user: { id: testUserId },
      body: { amount: 10000, source: 'salary', description: 'Monthly paycheck' }
    };
    const res = mockRes();
    await postIncomeHandler(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 201, 'Income post should succeed');
    assert.strictEqual(res.data.amount, 10000, 'Income amount matches');

    const updatedUser = await User.findOne({ id: testUserId });
    assert.strictEqual(updatedUser.currentBalance, 60000, 'Balance must increase by 10,000');
    console.log('  ✅ Income creation credits currentBalance successfully');
  }

  // Test 1.2: Updating income updates balance by delta
  {
    const latestIncome = await Income.findOne({ userId: testUserId });
    const req = {
      user: { id: testUserId },
      params: { id: latestIncome.id },
      body: { amount: 12000, description: 'Updated paycheck' }
    };
    const res = mockRes();
    await putIncomeHandler(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.amount, 12000);

    const updatedUser = await User.findOne({ id: testUserId });
    assert.strictEqual(updatedUser.currentBalance, 62000, 'Balance must update by delta of +2000');
    console.log('  ✅ Income modification updates currentBalance by delta successfully');
  }

  // Test 1.3: Deleting income deducts amount from balance
  {
    const latestIncome = await Income.findOne({ userId: testUserId });
    const req = {
      user: { id: testUserId },
      params: { id: latestIncome.id }
    };
    const res = mockRes();
    await deleteIncomeHandler(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 200);

    const updatedUser = await User.findOne({ id: testUserId });
    assert.strictEqual(updatedUser.currentBalance, 50000, 'Balance must return to 50,000');
    console.log('  ✅ Income deletion deducts amount from currentBalance successfully');
  }

  // Test 1.4: Existing expense behavior remains unchanged
  {
    const req = {
      user: { id: testUserId },
      body: { amount: 5000, category: 'Food', type: 'Need', description: 'Grocery shopping' }
    };
    const res = mockRes();
    await postTxHandler(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 201);
    const updatedUser = await User.findOne({ id: testUserId });
    assert.strictEqual(updatedUser.currentBalance, 45000, 'Balance must decrement by 5000');
    console.log('  ✅ Expense posting still decrements currentBalance as expected');
  }

  // Test 1.5: Failed income creation does not credit balance (rollbacks)
  {
    const initialUser = await User.findOne({ id: testUserId });
    const initialBalance = initialUser.currentBalance;

    const req = {
      user: { id: testUserId },
      body: { amount: -5000, source: 'invalid' } // invalid amount
    };
    const res = mockRes();
    await postIncomeHandler(req, res, (err) => { /* Express error middleware */ });

    // Validate bad inputs are caught
    assert.strictEqual(res.statusCode, 400);

    const finalUser = await User.findOne({ id: testUserId });
    assert.strictEqual(finalUser.currentBalance, initialBalance, 'Balance must not change on validation failure');
    console.log('  ✅ Failed income validation leaves balance untouched');
  }

  // -----------------------------------------------------------------
  // 2. ACCOUNTING TAXONOMY HELPER TESTS
  // -----------------------------------------------------------------
  console.log('\n--- Running Accounting Taxonomy Helper Tests ---');

  const needTx = { type: 'Need', category: 'Food', amount: 150 };
  const wantTx = { type: 'Want', category: 'Entertainment', amount: 500 };
  const investTx = { type: 'Investment', category: 'Misc', amount: 1000 };
  const debtTx = { type: 'Need', category: 'Bills', amount: 15000, liabilityId: 'L1' };

  assert.ok(isConsumption(needTx), 'Need is consumption');
  assert.ok(isConsumption(wantTx), 'Want is consumption');
  assert.ok(!isConsumption(investTx), 'Investment is NOT consumption');
  assert.ok(!isConsumption(debtTx), 'Liability payment is NOT consumption');

  assert.ok(isInvestment(investTx), 'Investment type recognized');
  assert.ok(!isInvestment(needTx), 'Need is NOT investment');

  assert.ok(isDebtService(debtTx), 'Liability-linked transaction is debt service');
  assert.ok(!isDebtService(needTx), 'Regular transaction is NOT debt service');

  assert.strictEqual(getCashFlowDirection({ amount: 1000, source: 'salary' }), 'inflow', 'Income record maps to inflow');
  assert.strictEqual(getCashFlowDirection(needTx), 'outflow', 'Transaction maps to outflow');
  console.log('  ✅ All cash-flow taxonomy classifications resolve correctly');

  // -----------------------------------------------------------------
  // 3. ASSETS VALIDATION TESTS
  // -----------------------------------------------------------------
  console.log('\n--- Running Assets Validation Tests ---');

  // Test 3.1: Valid Asset Creation
  try {
    const validAsset = await Asset.create({
      id: 'A1',
      userId: testUserId,
      name: 'Nifty Mutual Fund',
      assetType: 'Mutual Fund',
      assetClass: 'FIRE_INVESTABLE',
      currentValue: 120000,
      includedInFireCorpus: true
    });
    assert.strictEqual(validAsset.name, 'Nifty Mutual Fund');
    console.log('  ✅ FIRE investable asset created successfully');
  } catch (err) {
    assert.fail(`Valid asset creation failed: ${err.message}`);
  }

  // Test 3.2: Negative asset value rejection
  try {
    await Asset.create({
      id: 'A2',
      userId: testUserId,
      name: 'Debt Fund',
      assetType: 'Mutual Fund',
      assetClass: 'FIRE_INVESTABLE',
      currentValue: -50,
      includedInFireCorpus: true
    });
    assert.fail('Negative asset value should have been rejected');
  } catch (err) {
    assert.ok(err.errors.currentValue, 'Validation error expected on currentValue');
    console.log('  ✅ Negative asset value rejected successfully');
  }

  // Test 3.3: Asset ownership required
  try {
    await Asset.create({
      id: 'A3',
      name: 'NPS',
      assetType: 'Retirement Account',
      assetClass: 'SEMI_LIQUID',
      currentValue: 50000
    });
    assert.fail('Missing userId should have been rejected');
  } catch (err) {
    assert.ok(err.errors.userId, 'Validation error expected on userId');
    console.log('  ✅ Missing asset owner (userId) rejected successfully');
  }

  // Test 3.4: Contradictory FIRE inclusion check (NON_INVESTABLE + includedInFireCorpus)
  try {
    await Asset.create({
      id: 'A4',
      userId: testUserId,
      name: 'Primary Vehicle',
      assetType: 'Car',
      assetClass: 'NON_INVESTABLE',
      currentValue: 800000,
      includedInFireCorpus: true // contradictory!
    });
    assert.fail('Contradictory asset options should be rejected');
  } catch (err) {
    assert.ok(err.errors.includedInFireCorpus, 'Validation error expected on includedInFireCorpus');
    console.log('  ✅ Contradictory asset class + FIRE corpus flags rejected successfully');
  }

  // -----------------------------------------------------------------
  // 4. LIABILITY SCHEMAS HARDENING TESTS
  // -----------------------------------------------------------------
  console.log('\n--- Running Liabilities Hardening Tests ---');

  // Test 4.1: Existing liability backward compatibility (projection fields can be null)
  try {
    const lOld = await Liability.create({
      id: 'L_OLD',
      userId: testUserId,
      name: 'Backward Compatibility Test',
      amount: 1500,
      category: 'Bills',
      type: 'Need',
      frequency: 'monthly',
      startDate: new Date()
    });
    assert.strictEqual(lOld.outstandingBalance, null);
    assert.strictEqual(lOld.interestRate, null);
    assert.strictEqual(lOld.remainingTermMonths, null);
    console.log('  ✅ Legacy liabilities function correctly with empty projection fields');
  } catch (err) {
    assert.fail(`Legacy compatibility liability creation failed: ${err.message}`);
  }

  // Test 4.2: Validate invalid ranges
  try {
    await Liability.create({
      id: 'L_BAD',
      userId: testUserId,
      name: 'Bad Liability',
      amount: 1500,
      category: 'Bills',
      type: 'Need',
      frequency: 'monthly',
      startDate: new Date(),
      outstandingBalance: -100, // invalid
      interestRate: 1.5, // invalid (>1)
      remainingTermMonths: -1 // invalid
    });
    assert.fail('Invalid liability ranges should be rejected');
  } catch (err) {
    assert.ok(err.errors.outstandingBalance || err.errors.interestRate || err.errors.remainingTermMonths);
    console.log('  ✅ Invalid liability projection fields range checks succeed');
  }

  // -----------------------------------------------------------------
  // 5. USER ASSUMPTIONS VALIDATION TESTS
  // -----------------------------------------------------------------
  console.log('\n--- Running User Assumptions Tests ---');

  // Test 5.1: Verify Defaults
  const testUserObj = await User.findOne({ id: testUserId });
  assert.strictEqual(testUserObj.expectedReturnRate, 0.08);
  assert.strictEqual(testUserObj.expectedInflationRate, 0.06);
  assert.strictEqual(testUserObj.expectedWithdrawalRate, 0.04);
  assert.strictEqual(testUserObj.lifestyleAdjustmentRatio, 0.80);
  assert.strictEqual(testUserObj.emergencyFundTargetMonths, 6);
  console.log('  ✅ Safe backwards-compatible defaults set successfully');

  // Test 5.2: Decimal validation range checks
  testUserObj.expectedReturnRate = 1.5; // >100% return
  try {
    await testUserObj.save();
    assert.fail('Invalid expectedReturnRate should be rejected');
  } catch (err) {
    assert.ok(err.errors.expectedReturnRate);
    console.log('  ✅ Invalid financial return rates (> 1.0) rejected successfully');
  }

  testUserObj.expectedReturnRate = 0.12; // Restore valid rate
  testUserObj.emergencyFundTargetMonths = 40; // >36 months
  try {
    await testUserObj.save();
    assert.fail('Invalid emergencyFundTargetMonths should be rejected');
  } catch (err) {
    assert.ok(err.errors.emergencyFundTargetMonths);
    console.log('  ✅ Invalid emergency fund target months (> 36) rejected successfully');
  }

  // -----------------------------------------------------------------
  // 6. REGRESSION TESTS
  // -----------------------------------------------------------------
  console.log('\n--- Running Regression Tests ---');

  // Test 6.1: FMIService runs without crashing
  try {
    const fmiResult = calculateFMI(user, []);
    assert.ok(fmiResult.FMI >= 0 && fmiResult.FMI <= 100);
    console.log('  ✅ FMIService runs without crashing');
  } catch (err) {
    assert.fail(`FMIService crashed: ${err.message}`);
  }

  // Test 6.2: IncomeFlowService runs without crashing
  try {
    const incomes = await Income.find({ userId: testUserId });
    const flow = smoothIncomeFlow(incomes);
    assert.ok(flow.allocation !== undefined);
    console.log('  ✅ IncomeFlowService runs without crashing');
  } catch (err) {
    assert.fail(`IncomeFlowService crashed: ${err.message}`);
  }

  // Test 6.3: LiabilityScheduler runs without crashing
  try {
    await processLiabilities();
    console.log('  ✅ LiabilityScheduler processes without crashing');
  } catch (err) {
    assert.fail(`LiabilityScheduler crashed: ${err.message}`);
  }

  // Target-scoped cleanup at the end of tests
  console.log('\nCleaning up target-scoped test data...');
  await User.deleteMany({ id: testUserId });
  await Income.deleteMany({ userId: testUserId });
  await Transaction.deleteMany({ userId: testUserId });
  await Liability.deleteMany({ userId: testUserId });
  await Asset.deleteMany({ userId: testUserId });

  console.log('\n============================================================');
  console.log('  ALL FOUNDATION TESTS PASSED!');
  console.log('============================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\nTest Execution Failed with Error:', err);
  process.exit(1);
});

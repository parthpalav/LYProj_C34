/**
 * server/test_predictability_api.js
 * 
 * Integration test suite for the authenticated GET /api/predictability endpoint.
 * Tests authentication, authorization, response contract, multi-tenancy isolation,
 * read-only guarantees, missing data handling, and numerical safety.
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import assert from 'assert';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Income from './models/Income.js';
import Transaction from './models/Transaction.js';
import Asset from './models/Asset.js';
import Liability from './models/Liability.js';

dotenv.config({ path: '.env' });

const JWT_SECRET = process.env.JWT_SECRET || 'finaura_jwt_s3cr3t_k3y_2026_xK9mP2qL7wN4';

function generateTestToken(user) {
  return jwt.sign(
    {
      id: user.id || user._id?.toString(),
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function checkNoNaNOrInfinity(obj, path = '') {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'number') {
    assert.ok(
      Number.isFinite(obj),
      `Found non-finite number (${obj}) at ${path}`
    );
    assert.ok(
      !Number.isNaN(obj),
      `Found NaN at ${path}`
    );
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => checkNoNaNOrInfinity(item, `${path}[${idx}]`));
    return;
  }
  if (typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      checkNoNaNOrInfinity(val, `${path}.${key}`);
    }
  }
}

async function runTests() {
  console.log('============================================================');
  console.log('  FINAURA PREDICTABILITY API ENDPOINT TEST SUITE');
  console.log('============================================================\n');

  await connectDB();

  // Create test express app
  const app = express();
  app.use(express.json());
  app.use('/api', routes);

  // Start on ephemeral port
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/predictability`;

  const userA_Id = 'TEST_PREDICTABILITY_USER_A';
  const userB_Id = 'TEST_PREDICTABILITY_USER_B';
  const userEmpty_Id = 'TEST_PREDICTABILITY_USER_EMPTY';

  console.log('Setting up test users and financial records...');

  // Cleanup test-scoped users
  const cleanupUsers = async () => {
    const testIds = [userA_Id, userB_Id, userEmpty_Id];
    await User.deleteMany({ id: { $in: testIds } });
    await Income.deleteMany({ userId: { $in: testIds } });
    await Transaction.deleteMany({ userId: { $in: testIds } });
    await Asset.deleteMany({ userId: { $in: testIds } });
    await Liability.deleteMany({ userId: { $in: testIds } });
  };

  await cleanupUsers();

  try {
    // 1. Create User A (Full profile)
    const userA = await User.create({
      id: userA_Id,
      name: 'User A (Salaried)',
      email: 'user_a_predictability@test.com',
      age: 30,
      retirementAge: 55,
      currentBalance: 50000,
      retirementCorpusGoal: 15000000,
      expectedReturnRate: 0.08,
      expectedInflationRate: 0.06,
      expectedWithdrawalRate: 0.04,
      lifestyleAdjustmentRatio: 0.8,
      emergencyFundTargetMonths: 6
    });

    await Income.create([
      { id: 'inc_a_1', userId: userA_Id, amount: 80000, source: 'salary', timestamp: new Date('2026-01-05') },
      { id: 'inc_a_2', userId: userA_Id, amount: 80000, source: 'salary', timestamp: new Date('2026-02-05') }
    ]);

    await Transaction.create([
      { id: 'tx_a_1', userId: userA_Id, amount: 30000, category: 'Bills', type: 'Need', timestamp: new Date('2026-01-10') },
      { id: 'tx_a_2', userId: userA_Id, amount: 10000, category: 'Entertainment', type: 'Want', timestamp: new Date('2026-01-15') },
      { id: 'tx_a_3', userId: userA_Id, amount: 15000, category: 'Misc', type: 'Investment', timestamp: new Date('2026-01-20') }
    ]);

    await Asset.create([
      { id: 'ast_a_1', userId: userA_Id, name: 'Index Fund', assetClass: 'FIRE_INVESTABLE', assetType: 'Equity', currentValue: 1000000, includedInFireCorpus: true, liquidity: 'liquid' },
      { id: 'ast_a_2', userId: userA_Id, name: 'Liquid Savings', assetClass: 'SEMI_LIQUID', assetType: 'Cash', currentValue: 250000, includedInFireCorpus: false, liquidity: 'liquid' }
    ]);

    await Liability.create([
      { id: 'liab_a_1', userId: userA_Id, name: 'Car Loan', amount: 8000, category: 'Bills', type: 'Need', frequency: 'monthly', outstandingBalance: 150000, startDate: new Date('2026-01-01'), status: 'active' }
    ]);

    // 2. Create User B (Different profile)
    const userB = await User.create({
      id: userB_Id,
      name: 'User B (Freelancer)',
      email: 'user_b_predictability@test.com',
      age: 28,
      retirementAge: 60,
      currentBalance: 100000,
      retirementCorpusGoal: 30000000
    });

    await Asset.create([
      { id: 'ast_b_1', userId: userB_Id, name: 'Gold', assetClass: 'FIRE_INVESTABLE', assetType: 'Gold', currentValue: 500000, includedInFireCorpus: true, liquidity: 'liquid' }
    ]);

    // 3. Create User Empty (No financial records)
    const userEmpty = await User.create({
      id: userEmpty_Id,
      name: 'User Empty',
      email: 'user_empty@test.com'
    });

    const tokenA = generateTestToken(userA);
    const tokenB = generateTestToken(userB);
    const tokenEmpty = generateTestToken(userEmpty);

    // -------------------------------------------------------------
    // TEST GROUP 1: AUTHENTICATION & ACCESS CONTROL
    // -------------------------------------------------------------
    console.log('\nRunning Test Group 1: Authentication & Access Control...');

    // T1.1: Unauthenticated request rejected with 401
    const unauthRes = await fetch(baseUrl);
    assert.strictEqual(unauthRes.status, 401);
    const unauthJson = await unauthRes.json();
    assert.strictEqual(unauthJson.success, false);
    assert.strictEqual(unauthJson.code, 'MISSING_TOKEN');
    console.log('  ✅ Unauthenticated request correctly rejected with 401');

    // T1.2: Invalid token rejected with 401
    const invalidRes = await fetch(baseUrl, {
      headers: { Authorization: 'Bearer invalid_garbage_token' }
    });
    assert.strictEqual(invalidRes.status, 401);
    const invalidJson = await invalidRes.json();
    assert.strictEqual(invalidJson.code, 'INVALID_TOKEN');
    console.log('  ✅ Invalid token correctly rejected with 401');

    // T1.3: Authenticated request accepted with 200
    const authRes = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(authRes.status, 200);
    const authJson = await authRes.json();
    assert.strictEqual(authJson.success, true);
    assert.ok(authJson.data);
    console.log('  ✅ Authenticated request accepted with 200');

    // -------------------------------------------------------------
    // TEST GROUP 2: MULTI-TENANCY & IDOR PROTECTION
    // -------------------------------------------------------------
    console.log('\nRunning Test Group 2: Multi-Tenancy & IDOR Protection...');

    // T2.1: Query parameter override attempt is ignored
    const idorQueryRes = await fetch(`${baseUrl}?userId=${userB_Id}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(idorQueryRes.status, 200);
    const idorQueryJson = await idorQueryRes.json();
    // User A's FIRE corpus is 1,000,000 (User B's is 500,000)
    assert.strictEqual(idorQueryJson.data.assets.fireInvestableCorpus, 1000000);
    assert.strictEqual(idorQueryJson.data.currentState.currentBalance, 50000); // User A's balance
    console.log('  ✅ Query parameter userId override ignored (returns authenticated User A data)');

    // T2.2: User B receives only User B data
    const userBRes = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.strictEqual(userBRes.status, 200);
    const userBJson = await userBRes.json();
    assert.strictEqual(userBJson.data.assets.fireInvestableCorpus, 500000);
    assert.strictEqual(userBJson.data.currentState.currentBalance, 100000);
    console.log('  ✅ User B receives strictly User B data');

    // -------------------------------------------------------------
    // TEST GROUP 3: RESPONSE CONTRACT & DATA STRUCTURE
    // -------------------------------------------------------------
    console.log('\nRunning Test Group 3: Response Contract & Structure...');

    const dataA = authJson.data;
    assert.ok(dataA.generatedAt);
    assert.ok(dataA.dataQuality);
    assert.ok(dataA.currentState);
    assert.ok(dataA.income);
    assert.ok(dataA.resilience);
    assert.ok(dataA.assets);
    assert.ok(dataA.liabilities);
    assert.ok(dataA.emergencyFund);
    assert.ok(dataA.retirement);
    assert.ok(Array.isArray(dataA.explanationFacts));
    assert.ok(Array.isArray(dataA.limitations));

    // Check specific calculations for User A:
    assert.strictEqual(dataA.currentState.needsConsumption, 30000);
    assert.strictEqual(dataA.currentState.liabilityService, 8000);
    assert.strictEqual(dataA.currentState.totalEssentialSpending, 38000);
    assert.strictEqual(dataA.assets.fireInvestableCorpus, 1000000);
    assert.strictEqual(dataA.assets.liquidBuffer, 250000);
    assert.strictEqual(dataA.emergencyFund.targetAmount, 38000 * 6); // 228,000
    assert.strictEqual(dataA.emergencyFund.fundingGap, 0); // 250k covers 228k
    assert.strictEqual(dataA.retirement.currentAnnualLifestyleSpending, (30000 + 10000) * 12); // 480,000
    assert.strictEqual(dataA.retirement.estimatedFireCorpus, (480000 * 0.8) / 0.04); // 9,600,000
    console.log('  ✅ Response structure and calculations match verified contract');

    // -------------------------------------------------------------
    // TEST GROUP 4: MISSING DATA HANDLING (RETURNS 200 + LIMITATIONS)
    // -------------------------------------------------------------
    console.log('\nRunning Test Group 4: Missing Data Handling...');

    const emptyRes = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${tokenEmpty}` }
    });
    assert.strictEqual(emptyRes.status, 200);
    const emptyJson = await emptyRes.json();
    assert.strictEqual(emptyJson.success, true);
    assert.strictEqual(emptyJson.data.assets.fireInvestableCorpus, 0);
    assert.strictEqual(emptyJson.data.income.meanMonthlyIncome, 0);
    assert.strictEqual(emptyJson.data.retirement.currentAge, null);
    assert.strictEqual(emptyJson.data.retirement.monthsUntilRetirement, null);
    assert.ok(emptyJson.data.limitations.length >= 3);
    console.log('  ✅ Missing data returns HTTP 200 with clear limitations array');

    // -------------------------------------------------------------
    // TEST GROUP 5: READ-ONLY GUARANTEE (ZERO DB WRITES)
    // -------------------------------------------------------------
    console.log('\nRunning Test Group 5: Read-Only Guarantee...');

    const userCountBefore = await User.countDocuments();
    const incCountBefore = await Income.countDocuments();
    const txCountBefore = await Transaction.countDocuments();
    const astCountBefore = await Asset.countDocuments();
    const liabCountBefore = await Liability.countDocuments();
    const userABefore = await User.findOne({ id: userA_Id }).lean();

    // Call endpoint multiple times
    await fetch(baseUrl, { headers: { Authorization: `Bearer ${tokenA}` } });
    await fetch(baseUrl, { headers: { Authorization: `Bearer ${tokenA}` } });
    await fetch(baseUrl, { headers: { Authorization: `Bearer ${tokenA}` } });

    const userCountAfter = await User.countDocuments();
    const incCountAfter = await Income.countDocuments();
    const txCountAfter = await Transaction.countDocuments();
    const astCountAfter = await Asset.countDocuments();
    const liabCountAfter = await Liability.countDocuments();
    const userAAfter = await User.findOne({ id: userA_Id }).lean();

    assert.strictEqual(userCountBefore, userCountAfter);
    assert.strictEqual(incCountBefore, incCountAfter);
    assert.strictEqual(txCountBefore, txCountAfter);
    assert.strictEqual(astCountBefore, astCountAfter);
    assert.strictEqual(liabCountBefore, liabCountAfter);
    assert.strictEqual(userABefore.currentBalance, userAAfter.currentBalance);
    console.log('  ✅ Multiple GET requests verified: ZERO database mutations occurred');

    // -------------------------------------------------------------
    // TEST GROUP 6: NUMERICAL SAFETY (NO NaN OR INFINITY)
    // -------------------------------------------------------------
    console.log('\nRunning Test Group 6: Numerical Safety...');

    checkNoNaNOrInfinity(authJson);
    checkNoNaNOrInfinity(userBJson);
    checkNoNaNOrInfinity(emptyJson);
    console.log('  ✅ Response JSON verified: completely free of NaN and Infinity');

    // -------------------------------------------------------------
    // TEST GROUP 7: USER NOT FOUND BEHAVIOR (404)
    // -------------------------------------------------------------
    console.log('\nRunning Test Group 7: Non-Existent User Handling...');

    const deletedUserToken = jwt.sign(
      { id: 'NON_EXISTENT_USER_12345', email: 'ghost@test.com' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const ghostRes = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${deletedUserToken}` }
    });
    assert.strictEqual(ghostRes.status, 404);
    const ghostJson = await ghostRes.json();
    assert.strictEqual(ghostJson.success, false);
    assert.strictEqual(ghostJson.code, 'USER_NOT_FOUND');
    console.log('  ✅ Non-existent user correctly returns 404 USER_NOT_FOUND');

    console.log('\n============================================================');
    console.log('  ALL PREDICTABILITY API TESTS PASSED SUCCESSFULLY!');
    console.log('============================================================');

  } finally {
    console.log('\nCleaning up test users...');
    await cleanupUsers();
    server.close();
    await mongoose.disconnect();
  }
}

try {
  runTests().then(() => process.exit(0)).catch((err) => {
    console.error('\n❌ API TEST FAILED:', err);
    process.exit(1);
  });
} catch (err) {
  console.error('\n❌ TEST RUNNER ERROR:', err);
  process.exit(1);
}

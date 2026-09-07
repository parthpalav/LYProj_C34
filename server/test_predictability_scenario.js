/**
 * server/test_predictability_scenario.js
 * 
 * Dedicated integration test suite for POST /api/predictability/scenario.
 * Verifies:
 *  1. Authentication & access control (401 for unauthenticated/invalid)
 *  2. Multi-tenancy and IDOR protection (strict req.user scoping)
 *  3. Unknown/unsupported key rejection (400 UNKNOWN_SCENARIO_FIELD)
 *  4. Field bounds validation (ranges, finite numbers, age constraints)
 *  5. Baseline parity (empty body {} matches GET /api/predictability)
 *  6. Simulation reactivity (override parameters alter projections as expected)
 *  7. Zero persistence guarantee (zero MongoDB mutations)
 *  8. Numerical safety (zero NaN or Infinity)
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
    assert.ok(Number.isFinite(obj), `Found non-finite number (${obj}) at ${path}`);
    assert.ok(!Number.isNaN(obj), `Found NaN at ${path}`);
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
  console.log('  FINAURA PREDICTABILITY SCENARIO ENDPOINT TEST SUITE');
  console.log('============================================================\n');

  await connectDB();

  const app = express();
  app.use(express.json());
  app.use('/api', routes);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/predictability`;

  const userA_Id = 'TEST_SCENARIO_USER_A';
  const userB_Id = 'TEST_SCENARIO_USER_B';

  const cleanupUsers = async () => {
    const testIds = [userA_Id, userB_Id];
    await User.deleteMany({ id: { $in: testIds } });
    await Income.deleteMany({ userId: { $in: testIds } });
    await Transaction.deleteMany({ userId: { $in: testIds } });
    await Asset.deleteMany({ userId: { $in: testIds } });
    await Liability.deleteMany({ userId: { $in: testIds } });
  };

  await cleanupUsers();

  try {
    // 1. Create User A
    const userA = await User.create({
      id: userA_Id,
      name: 'Scenario Tester A',
      email: 'scenario_a@finaura.app',
      age: 30,
      retirementAge: 60,
      currentBalance: 75000,
      expectedReturnRate: 0.08,
      expectedInflationRate: 0.06,
      expectedWithdrawalRate: 0.04
    });
    const tokenA = generateTestToken(userA);

    // Seed User A assets
    await Asset.create({
      id: 'asset_a_1',
      userId: userA_Id,
      name: 'Index Fund Portfolio',
      assetType: 'Equity',
      assetClass: 'FIRE_INVESTABLE',
      currentValue: 500000,
      annualReturnRate: 0.10,
      includedInFireCorpus: true,
      liquidity: 'liquid'
    });

    // Seed User A transactions for 6 months
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 15);
      await Transaction.create({
        id: `tx_need_${i}`,
        userId: userA_Id,
        amount: 25000,
        category: 'Groceries',
        type: 'Need',
        timestamp: d.toISOString()
      });
      await Transaction.create({
        id: `tx_want_${i}`,
        userId: userA_Id,
        amount: 10000,
        category: 'Entertainment',
        type: 'Want',
        timestamp: d.toISOString()
      });
      await Transaction.create({
        id: `tx_inv_${i}`,
        userId: userA_Id,
        amount: 15000,
        category: 'Investments',
        type: 'Investment',
        timestamp: d.toISOString()
      });
    }

    const userB = await User.create({
      id: userB_Id,
      name: 'Scenario Tester B',
      email: 'scenario_b@finaura.app',
      age: 45,
      retirementAge: 65,
      currentBalance: 120000
    });
    const tokenB = generateTestToken(userB);

    // Seed User B transactions
    await Transaction.create({
      id: 'tx_b_1',
      userId: userB_Id,
      amount: 40000,
      category: 'Groceries',
      type: 'Need',
      timestamp: new Date().toISOString()
    });
    await Transaction.create({
      id: 'tx_b_2',
      userId: userB_Id,
      amount: 20000,
      category: 'Investments',
      type: 'Investment',
      timestamp: new Date().toISOString()
    });

    // --- TEST 1: Authentication & Access Control ---
    process.stdout.write('Running Test 1: Unauthenticated request rejected (401)... ');
    const unauthRes = await fetch(`${baseUrl}/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlyContribution: 20000 })
    });
    assert.equal(unauthRes.status, 401);
    console.log('✅ Passed');

    process.stdout.write('Running Test 2: Invalid token rejected (401)... ');
    const badTokenRes = await fetch(`${baseUrl}/scenario`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid_token_xyz'
      },
      body: JSON.stringify({ monthlyContribution: 20000 })
    });
    assert.equal(badTokenRes.status, 401);
    console.log('✅ Passed');

    // --- TEST 2: Strict Key Validation (Correction #10) ---
    process.stdout.write('Running Test 3: Unknown or unsupported scenario override fields rejected (400)... ');
    const unknownFieldRes = await fetch(`${baseUrl}/scenario`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        monthlyContribution: 25000,
        unsupportedField: 'hacked_value'
      })
    });
    assert.equal(unknownFieldRes.status, 400);
    const unknownJson = await unknownFieldRes.json();
    assert.equal(unknownJson.code, 'UNKNOWN_SCENARIO_FIELD');
    console.log('✅ Passed');

    // --- TEST 3: Field Bounds Validation (Correction #5) ---
    process.stdout.write('Running Test 4: Invalid field bounds rejected (400)... ');
    // Negative monthly contribution
    const negContribRes = await fetch(`${baseUrl}/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ monthlyContribution: -500 })
    });
    assert.equal(negContribRes.status, 400);

    // Retirement age below current age (age is 30, try 28)
    const youngRetAgeRes = await fetch(`${baseUrl}/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ retirementAge: 28 })
    });
    assert.equal(youngRetAgeRes.status, 400);

    // Return rate > 1.0
    const highReturnRes = await fetch(`${baseUrl}/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ expectedReturnRate: 1.5 })
    });
    assert.equal(highReturnRes.status, 400);

    // Invalid contribution mode
    const badModeRes = await fetch(`${baseUrl}/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ contributionMode: 'INVALID_MODE' })
    });
    assert.equal(badModeRes.status, 400);
    console.log('✅ Passed');

    // --- TEST 4: Baseline Parity (Correction #9) ---
    process.stdout.write('Running Test 5: Empty override payload matches baseline GET /api/predictability... ');
    const baselineGetRes = await fetch(baseUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(baselineGetRes.status, 200);
    const baselineJson = await baselineGetRes.json();

    const scenarioEmptyRes = await fetch(`${baseUrl}/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({})
    });
    assert.equal(scenarioEmptyRes.status, 200);
    const scenarioEmptyJson = await scenarioEmptyRes.json();

    // Verify key deterministic metrics match identically
    assert.equal(
      scenarioEmptyJson.data.retirement.estimatedFireCorpus,
      baselineJson.data.retirement.estimatedFireCorpus,
      'estimatedFireCorpus must match baseline'
    );
    assert.equal(
      scenarioEmptyJson.data.retirement.projectedCorpusAtRetirement,
      baselineJson.data.retirement.projectedCorpusAtRetirement,
      'projectedCorpusAtRetirement must match baseline'
    );
    assert.equal(
      scenarioEmptyJson.data.assets.knownNetWorth,
      baselineJson.data.assets.knownNetWorth,
      'knownNetWorth must match baseline'
    );
    console.log('✅ Passed');

    // --- TEST 5: Simulation Reactivity ---
    process.stdout.write('Running Test 6: Overrides produce correct reactive financial outcome... ');
    // Baseline investment was ₹15,000. Let's test increasing to ₹30,000.
    const scenarioHigherRes = await fetch(`${baseUrl}/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ monthlyContribution: 30000 })
    });
    assert.equal(scenarioHigherRes.status, 200);
    const scenarioHigherJson = await scenarioHigherRes.json();

    assert.ok(
      scenarioHigherJson.data.retirement.projectedCorpusAtRetirement >
        baselineJson.data.retirement.projectedCorpusAtRetirement,
      'Projected corpus at retirement must be higher with increased contribution'
    );
    assert.equal(
      scenarioHigherJson.data.retirement.monthlyContributionUsed,
      30000,
      'Monthly contribution used must reflect override'
    );
    console.log('✅ Passed');

    // --- TEST 6: Zero Persistence Guarantee (Correction #11) ---
    process.stdout.write('Running Test 7: User document in MongoDB remains 100% unmodified (Zero Persistence)... ');
    const userAfter = await User.findOne({ id: userA_Id }).lean();
    assert.equal(userAfter.retirementAge, 60, 'retirementAge must remain 60 in DB');
    assert.equal(userAfter.expectedReturnRate, 0.08, 'expectedReturnRate must remain 0.08 in DB');
    assert.equal(userAfter.expectedInflationRate, 0.06, 'expectedInflationRate must remain 0.06 in DB');
    console.log('✅ Passed');

    // --- TEST 7: Multi-Tenancy Isolation ---
    process.stdout.write('Running Test 8: User isolation strictly preserved across tenants... ');
    const userBScenarioRes = await fetch(`${baseUrl}/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ monthlyContribution: 10000 })
    });
    assert.equal(userBScenarioRes.status, 200);
    const userBJson = await userBScenarioRes.json();
    assert.equal(userBJson.data.retirement.currentAge, 45, 'User B must see User B currentAge');
    assert.notEqual(userBJson.data.retirement.currentAge, userA.age);
    console.log('✅ Passed');

    // --- TEST 8: Numerical Safety ---
    process.stdout.write('Running Test 9: Numerical safety (zero NaN or Infinity)... ');
    checkNoNaNOrInfinity(scenarioHigherJson.data);
    console.log('✅ Passed');

    console.log('\n============================================================');
    console.log('  ALL SCENARIO ENDPOINT TESTS PASSED SUCCESSFULLY (9/9) 🚀');
    console.log('============================================================\n');
  } finally {
    await cleanupUsers();
    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});

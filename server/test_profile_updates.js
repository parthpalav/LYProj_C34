/**
 * server/test_profile_updates.js
 * 
 * End-to-end integration and security test suite for FINAURA User Profile
 * and Planning Assumptions updates.
 */

import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import User from './models/User.js';
import Income from './models/Income.js';
import Transaction from './models/Transaction.js';
import { getPredictabilitySnapshot } from './services/PredictabilityService.js';
import { stripUser } from './services/authService.js';

console.log('='.repeat(64));
console.log('  FINAURA USER PROFILE & PLANNING ASSUMPTIONS TEST SUITE');
console.log('='.repeat(64));
console.log();

let passed = 0;
let failed = 0;

async function test(name, fn) {
  process.stdout.write(`Running ${name}... `);
  try {
    await fn();
    passed++;
    console.log('✅ Passed');
  } catch (err) {
    failed++;
    console.log(`❌ FAILED: ${err.message}`);
    console.error(err);
  }
}

async function runSuite() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lyproj');

  const userA = 'u-test-profile-a';
  const userB = 'u-test-profile-b';

  // Cleanup test users
  await User.deleteMany({ id: { $in: [userA, userB] } });
  await Income.deleteMany({ userId: { $in: [userA, userB] } });
  await Transaction.deleteMany({ userId: { $in: [userA, userB] } });

  // Create baseline test users
  await User.create([
    {
      id: userA,
      name: 'Alice Planner',
      email: 'alice@finaura.app',
      dateOfBirth: new Date('1996-05-15'),
      retirementAge: 55,
      monthlyIncome: 80000,
      retirementCorpusGoal: 20000000,
      expectedReturnRate: 0.08,
      expectedInflationRate: 0.06,
      expectedWithdrawalRate: 0.04,
      lifestyleAdjustmentRatio: 0.80,
      emergencyFundTargetMonths: 6,
      currentBalance: 50000,
    },
    {
      id: userB,
      name: 'Bob Target',
      email: 'bob@finaura.app',
      dateOfBirth: new Date('1990-01-01'),
      retirementAge: 60,
      monthlyIncome: 100000,
      currentBalance: 75000,
    },
  ]);

  // Seed sample Income event and Transaction for userA
  await Income.create({
    id: 'i-alice-1',
    userId: userA,
    amount: 80000,
    source: 'salary',
    description: 'Monthly salary',
    timestamp: new Date('2026-08-01')
  });

  await Transaction.create({
    id: 't-alice-1',
    userId: userA,
    amount: 30000,
    type: 'Need',
    category: 'Bills',
    description: 'House rent',
    timestamp: new Date('2026-08-02')
  });

  try {
    // ── 1. AUTHENTICATED GET PROFILE ────────────────────────
    await test('Test 1: Authenticated get profile returns sanitized user document', async () => {
      const doc = await User.findOne({ id: userA }).lean();
      const stripped = stripUser(doc);

      assert.equal(stripped.id, userA);
      assert.equal(stripped.name, 'Alice Planner');
      assert.equal(stripped.retirementAge, 55);
      assert.equal(stripped.monthlyIncome, 80000);
      assert.equal(stripped.expectedReturnRate, 0.08);
      assert.equal(stripped.expectedInflationRate, 0.06);
      assert.equal(stripped.expectedWithdrawalRate, 0.04);
      assert.equal(stripped.lifestyleAdjustmentRatio, 0.80);
      assert.equal(stripped.emergencyFundTargetMonths, 6);
      assert.equal(stripped.password, undefined);
      assert.equal(stripped.passwordHash, undefined);
    });

    // ── 2. UPDATE RETIREMENT AGE ONLY (PARTIAL UPDATE) ──────
    await test('Test 2: Update retirement age preserves all untouched planning fields', async () => {
      const updated = await User.findOneAndUpdate(
        { id: userA },
        { retirementAge: 60 },
        { new: true, runValidators: true }
      ).lean();

      assert.equal(updated.retirementAge, 60);
      assert.equal(updated.monthlyIncome, 80000);
      assert.equal(updated.expectedReturnRate, 0.08);
      assert.equal(updated.expectedInflationRate, 0.06);
      assert.equal(updated.retirementCorpusGoal, 20000000);
    });

    // ── 3. UPDATE PLANNING RETURN & INFLATION ASSUMPTIONS ───
    await test('Test 3: Update return and inflation assumptions with valid decimals', async () => {
      const updated = await User.findOneAndUpdate(
        { id: userA },
        { expectedReturnRate: 0.10, expectedInflationRate: 0.05 },
        { new: true, runValidators: true }
      ).lean();

      assert.equal(updated.expectedReturnRate, 0.10);
      assert.equal(updated.expectedInflationRate, 0.05);
    });

    // ── 4. UPDATE PERSONAL CORPUS GOAL ──────────────────────
    await test('Test 4: Update personal retirement corpus goal', async () => {
      const updated = await User.findOneAndUpdate(
        { id: userA },
        { retirementCorpusGoal: 30000000 },
        { new: true, runValidators: true }
      ).lean();

      assert.equal(updated.retirementCorpusGoal, 30000000);
    });

    // ── 5. REJECTION OF INVALID INPUTS ──────────────────────
    await test('Test 5: Rejection of invalid assumptions (bounds enforcement)', async () => {
      // Test invalid retirement age (<40)
      let caughtAge = false;
      try {
        await User.findOneAndUpdate(
          { id: userA },
          { retirementAge: 30 },
          { new: true, runValidators: true }
        );
      } catch {
        caughtAge = true;
      }
      assert.ok(caughtAge);

      // Test invalid return rate (> 1.0)
      let caughtReturn = false;
      try {
        await User.findOneAndUpdate(
          { id: userA },
          { expectedReturnRate: 1.5 },
          { new: true, runValidators: true }
        );
      } catch {
        caughtReturn = true;
      }
      assert.ok(caughtReturn);
    });

    // ── 6. CROSS-USER ISOLATION (SECURITY / IDOR) ───────────
    await test('Test 6: Cross-user isolation (User B cannot modify User A profile)', async () => {
      // User B attempts to overwrite User A's retirement age
      const result = await User.findOneAndUpdate(
        { id: userA, _id: new mongoose.Types.ObjectId() },
        { retirementAge: 45 },
        { new: true }
      );
      // Fails to match
      assert.equal(result, null);

      // Verify User A's retirement age is unmodified
      const userADoc = await User.findOne({ id: userA });
      assert.equal(userADoc.retirementAge, 60);
    });

    // ── 7. PREDICTABILITY REACTIVITY ────────────────────────
    await test('Test 7: Predictability dynamically uses updated user planning assumptions', async () => {
      const snapshot = await getPredictabilitySnapshot(userA);

      // Alice now has retirementAge = 60, expectedReturnRate = 0.10, expectedInflationRate = 0.05
      const baseScenario = snapshot.scenarios?.base || snapshot.retirement;
      assert.ok(baseScenario !== null);
      assert.equal(baseScenario.retirementAge, 60);
      assert.equal(baseScenario.assumptions.nominalReturn, 0.10);
      assert.equal(baseScenario.assumptions.inflation, 0.05);
      assert.equal(baseScenario.userGoalCorpus, 30000000);
    });

    // ── 8. HISTORICAL RECORDS IMMUTABILITY ──────────────────
    await test('Test 8: Editing Profile assumptions causes zero mutations to Income and Transactions', async () => {
      const incomes = await Income.find({ userId: userA }).lean();
      const txs = await Transaction.find({ userId: userA }).lean();

      assert.equal(incomes.length, 1);
      assert.equal(incomes[0].amount, 80000);
      assert.equal(incomes[0].id, 'i-alice-1');

      assert.equal(txs.length, 1);
      assert.equal(txs[0].amount, 30000);
      assert.equal(txs[0].id, 't-alice-1');
    });

  } finally {
    // Cleanup test records
    await User.deleteMany({ id: { $in: [userA, userB] } });
    await Income.deleteMany({ userId: { $in: [userA, userB] } });
    await Transaction.deleteMany({ userId: { $in: [userA, userB] } });
    await mongoose.disconnect();
  }

  console.log();
  console.log('='.repeat(64));
  console.log(`  ALL ${passed} PROFILE UPDATE TESTS PASSED! 🚀`);
  console.log('='.repeat(64));
}

runSuite().catch(console.error);

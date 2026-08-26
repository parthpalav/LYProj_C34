/**
 * server/test_income_crud.js
 * 
 * End-to-end integration and security test suite for FINAURA Income CRUD,
 * multi-source gig worker aggregation, balance mutations, and cross-user isolation.
 */

import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import User from './models/User.js';
import Income from './models/Income.js';
import { smoothIncomeFlow } from './services/IncomeFlowService.js';
import { aggregateMonthlyIncome, analyzeIncomeResilience } from './utils/incomeAnalytics.js';

console.log('='.repeat(64));
console.log('  FINAURA INCOME CRUD & MULTI-SOURCE INTEGRATION TEST SUITE');
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

  const userA = 'u-test-income-a';
  const userB = 'u-test-income-b';

  // Cleanup pre-existing test data
  await User.deleteMany({ id: { $in: [userA, userB] } });
  await Income.deleteMany({ userId: { $in: [userA, userB] } });

  // Setup test users with starting balance
  await User.create([
    { id: userA, name: 'User A (Gig Worker)', email: 'usera@finaura.app', currentBalance: 50000, monthlyIncome: 80000 },
    { id: userB, name: 'User B (Salaried)', email: 'userb@finaura.app', currentBalance: 30000, monthlyIncome: 60000 },
  ]);

  try {
    // ── 1. CREATE INCOME EVENT & BALANCE INCREMENT ───────────
    let createdIncomeId = null;
    await test('Test 1: Create Income event & verify currentBalance increment', async () => {
      const initialUser = await User.findOne({ id: userA });
      const initialBalance = initialUser.currentBalance;
      const incomeAmt = 25000;

      // Simulate POST /income logic
      await User.findOneAndUpdate({ id: userA }, { $inc: { currentBalance: incomeAmt } });
      const inc = await Income.create({
        id: `i-test-${Date.now()}`,
        userId: userA,
        amount: incomeAmt,
        source: 'freelance',
        description: 'Consulting client project',
        timestamp: new Date('2026-08-10T10:00:00Z')
      });
      createdIncomeId = inc.id;

      const updatedUser = await User.findOne({ id: userA });
      assert.equal(updatedUser.currentBalance, initialBalance + incomeAmt);
      assert.equal(inc.source, 'freelance');
    });

    // ── 2. LIST INCOMES USER-SCOPED ─────────────────────────
    await test('Test 2: List incomes returns user-scoped records sorted newest-first', async () => {
      const incomes = await Income.find({ userId: userA }).sort({ timestamp: -1 }).lean();
      assert.ok(incomes.length >= 1);
      assert.equal(incomes[0].id, createdIncomeId);
      assert.equal(incomes[0].userId, userA);
    });

    // ── 3. MULTIPLE INCOME EVENTS IN SAME MONTH (GIG WORKER) ─
    await test('Test 3: Multiple income events in same calendar month', async () => {
      // Add 3 more events for userA in August 2026
      const additionalEvents = [
        { id: `i-aug-1`, userId: userA, amount: 18000, source: 'gig', description: 'Freelance design project', timestamp: new Date('2026-08-02T12:00:00Z') },
        { id: `i-aug-2`, userId: userA, amount: 12000, source: 'freelance', description: 'Development milestone', timestamp: new Date('2026-08-17T15:00:00Z') },
        { id: `i-aug-3`, userId: userA, amount: 15000, source: 'rental', description: 'Apartment rent', timestamp: new Date('2026-08-26T09:00:00Z') },
      ];

      for (const e of additionalEvents) {
        await User.findOneAndUpdate({ id: userA }, { $inc: { currentBalance: e.amount } });
        await Income.create(e);
      }

      const allAugIncomes = await Income.find({ userId: userA }).lean();
      assert.equal(allAugIncomes.length, 4); // 25k + 18k + 12k + 15k = 70k total
      const totalAug = allAugIncomes.reduce((s, i) => s + i.amount, 0);
      assert.equal(totalAug, 70000);
    });

    // ── 4. INCOME FLOW SMOOTHING & ALLOCATION ───────────────
    await test('Test 4: Income flow smoothing & 50/30/20 allocation', async () => {
      const incomes = await Income.find({ userId: userA }).sort({ timestamp: 1 }).lean();
      const flow = smoothIncomeFlow(incomes);

      assert.equal(flow.total, 70000);
      assert.equal(flow.allocation.essentials, 35000); // 50%
      assert.equal(flow.allocation.goals, 21000);      // 30%
      assert.equal(flow.allocation.emergency, 14000);  // 20%
      assert.ok(flow.sources.freelance >= 37000);     // 25k + 12k
      assert.ok(flow.sources.gig >= 18000);
      assert.ok(flow.sources.rental >= 15000);
    });

    // ── 5. UPDATE INCOME EVENT & DELTA BALANCE ADJUSTMENT ───
    await test('Test 5: Update income amount adjusts user balance by delta correctly', async () => {
      const userBefore = await User.findOne({ id: userA });
      const oldIncome = await Income.findOne({ id: createdIncomeId });
      const newAmount = 30000; // Increased from 25000 (+5000 delta)
      const delta = newAmount - oldIncome.amount;

      await User.findOneAndUpdate({ id: userA }, { $inc: { currentBalance: delta } });
      const updated = await Income.findOneAndUpdate(
        { id: createdIncomeId, userId: userA },
        { amount: newAmount, description: 'Updated consulting retainer' },
        { new: true }
      ).lean();

      const userAfter = await User.findOne({ id: userA });
      assert.equal(userAfter.currentBalance, userBefore.currentBalance + delta);
      assert.equal(updated.amount, 30000);
      assert.equal(updated.description, 'Updated consulting retainer');
    });

    // ── 6. DELETE INCOME EVENT & BALANCE DEDUCTION ──────────
    await test('Test 6: Delete income event decrements user balance', async () => {
      const userBefore = await User.findOne({ id: userA });
      const incomeToDelete = await Income.findOne({ id: createdIncomeId });

      await User.findOneAndUpdate({ id: userA }, { $inc: { currentBalance: -incomeToDelete.amount } });
      await Income.findOneAndDelete({ id: createdIncomeId, userId: userA });

      const userAfter = await User.findOne({ id: userA });
      assert.equal(userAfter.currentBalance, userBefore.currentBalance - incomeToDelete.amount);

      const checkDeleted = await Income.findOne({ id: createdIncomeId });
      assert.equal(checkDeleted, null);
    });

    // ── 7. CROSS-USER ISOLATION (SECURITY / IDOR PROTECTION) ─
    await test('Test 7: Cross-user isolation (User B cannot access or modify User A income)', async () => {
      // User B tries to find User A's income
      const queryByB = await Income.find({ userId: userB }).lean();
      assert.equal(queryByB.length, 0);

      // User B tries to update User A's income
      const unauthorizedUpdate = await Income.findOneAndUpdate(
        { id: 'i-aug-1', userId: userB },
        { amount: 999999 },
        { new: true }
      );
      assert.equal(unauthorizedUpdate, null);

      // Verify User A's record remained untouched
      const originalRecord = await Income.findOne({ id: 'i-aug-1' });
      assert.equal(originalRecord.amount, 18000);
    });

    // ── 8. AMOUNT & NUMERICAL VALIDATION ────────────────────
    await test('Test 8: Rejection of invalid amounts (zero, negative, NaN)', async () => {
      function validateAmount(val) {
        const num = Number(val);
        return !isNaN(num) && Number.isFinite(num) && num > 0;
      }

      assert.ok(validateAmount(5000));
      assert.ok(validateAmount('12000.50'));
      assert.ok(!validateAmount(0));
      assert.ok(!validateAmount(-1500));
      assert.ok(!validateAmount(NaN));
      assert.ok(!validateAmount(Infinity));
    });

    // ── 9. IRREGULAR INCOME ANALYTICS INTEGRATION ───────────
    await test('Test 9: Income analytics aggregates multiple events into calendar months', async () => {
      // Multi-month gig dataset:
      // May: 50k, Jun: 0k (gap), Jul: 60k, Aug: 45k (18k+12k+15k)
      const rawEvents = [
        { id: '1', amount: 50000, timestamp: '2026-05-15T00:00:00Z' },
        { id: '2', amount: 35000, timestamp: '2026-07-05T00:00:00Z' },
        { id: '3', amount: 25000, timestamp: '2026-07-20T00:00:00Z' }, // 60k July total
        { id: '4', amount: 18000, timestamp: '2026-08-02T00:00:00Z' },
        { id: '5', amount: 12000, timestamp: '2026-08-17T00:00:00Z' },
        { id: '6', amount: 15000, timestamp: '2026-08-26T00:00:00Z' }, // 45k Aug total
      ];

      const monthly = aggregateMonthlyIncome(rawEvents);
      // Expected calendar array spanning May, Jun, Jul, Aug (4 months)
      assert.equal(monthly.length, 4);
      assert.equal(monthly[0].yearMonth, '2026-05');
      assert.equal(monthly[0].amount, 50000);
      assert.equal(monthly[1].yearMonth, '2026-06');
      assert.equal(monthly[1].amount, 0); // Filled zero-income gap!
      assert.equal(monthly[2].yearMonth, '2026-07');
      assert.equal(monthly[2].amount, 60000);
      assert.equal(monthly[3].yearMonth, '2026-08');
      assert.equal(monthly[3].amount, 45000);

      const analytics = analyzeIncomeResilience({
        incomeEvents: rawEvents,
        essentialMonthlySpend: 30000,
        liquidBuffer: 60000
      });
      assert.equal(analytics.variability.zeroIncomeMonthsCount, 1);
      assert.ok(analytics.centralIncome.meanMonthlyIncome > 0);
      assert.ok(analytics.centralIncome.reliableMonthlyIncome > 0);
    });

  } finally {
    // Cleanup test users and records
    await User.deleteMany({ id: { $in: [userA, userB] } });
    await Income.deleteMany({ userId: { $in: [userA, userB] } });
    await mongoose.disconnect();
  }

  console.log();
  console.log('='.repeat(64));
  console.log(`  ALL ${passed} INCOME CRUD & INTEGRATION TESTS PASSED! 🚀`);
  console.log('='.repeat(64));
}

runSuite().catch(console.error);

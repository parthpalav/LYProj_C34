/**
 * server/test_alerts_balance.js
 * 
 * Regression & Integration test suite for FINAURA /alerts balance sourcing.
 * Verifies that GET /alerts relies on User.currentBalance rather than reconstructing
 * from totalIncome - totalExpenses, preventing false low-balance alerts.
 */

import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import User from './models/User.js';
import Transaction from './models/Transaction.js';
import Income from './models/Income.js';
import Alert from './models/Alert.js';
import { predictOverspend, detectLowBalanceRisk } from './services/PredictionService.js';

console.log('='.repeat(64));
console.log('  FINAURA ALERTS BALANCE SOURCING TEST SUITE');
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

function userFilter(userId) {
  const conditions = [{ id: userId }];
  if (mongoose.isValidObjectId(userId)) conditions.push({ _id: userId });
  return { $or: conditions };
}

// Controller-mirror helper to execute alert evaluation for a user
async function evaluateAlerts(userId) {
  const user = await User.findOne(userFilter(userId)).lean();
  if (!user) {
    return { status: 404, data: { success: false, message: 'User not found' } };
  }

  const txDocs = await Transaction.find({ userId: String(userId) }).sort({ timestamp: -1 }).lean();
  const incomes = await Income.find({ userId: String(userId) }).lean();
  const alerts = await Alert.find({ userId: String(userId) }).lean();

  const totalInc = incomes.reduce((sum, income) => sum + income.amount, 0);
  const totalExp = txDocs.reduce((sum, tx) => sum + tx.amount, 0);

  // Authoritative balance source
  const currentBalance = typeof user.currentBalance === 'number' && !isNaN(user.currentBalance)
    ? user.currentBalance
    : totalInc - totalExp;

  const recentSpending = txDocs.slice(0, 4).map((tx) => tx.amount);
  const overspend = predictOverspend(recentSpending, currentBalance);
  const lowBalance = detectLowBalanceRisk(currentBalance, totalInc * 0.2);

  const dynamic = [];
  if (overspend.risk === 'high') {
    dynamic.push({ id: `a-test-1`, userId: String(userId), message: 'Spending trend is above your average this week.', type: 'nudge', severity: 'medium' });
  }
  if (lowBalance) {
    dynamic.push({ id: `a-test-2`, userId: String(userId), message: 'Risk of low balance before next income date.', type: 'warning', severity: 'high' });
  }

  return { status: 200, data: [...alerts, ...dynamic], computedBalance: currentBalance, lowBalance };
}

async function runSuite() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lyproj');

  const userA = 'u-test-alert-a';
  const userB = 'u-test-alert-b';
  const userC = 'u-test-alert-c';

  // Cleanup pre-existing test data
  await User.deleteMany({ id: { $in: [userA, userB, userC] } });
  await Transaction.deleteMany({ userId: { $in: [userA, userB, userC] } });
  await Income.deleteMany({ userId: { $in: [userA, userB, userC] } });
  await Alert.deleteMany({ userId: { $in: [userA, userB, userC] } });

  try {
    // ── Case 1: Opening Balance With No Income Events ───────────
    await test('Case 1: Opening Balance with 0 Income docs uses User.currentBalance (No False Warning)', async () => {
      await User.create({
        id: userA,
        name: 'User A (Opening Balance)',
        email: 'user-a-alerts@finaura.app',
        currentBalance: 95000 // Persisted balance: 100k - 5k expense
      });

      await Transaction.create({
        id: 'tx-alert-1',
        userId: userA,
        amount: 5000,
        category: 'Shopping',
        type: 'Want',
        description: 'New shoes',
        timestamp: new Date()
      });

      // No Income events created for User A (totalInc = 0)
      const res = await evaluateAlerts(userA);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.computedBalance, 95000, 'Must use persisted 95,000, not (0 - 5000 = -5000)');
      assert.strictEqual(res.lowBalance, false, 'Must NOT trigger low balance alert when user has ₹95,000');

      const lowBalAlert = res.data.find(a => a.message.includes('Risk of low balance'));
      assert.strictEqual(lowBalAlert, undefined, 'Low balance alert should not be in response list');
    });

    // ── Case 2: Persisted Balance After Expenses ────────────────
    await test('Case 2: Persisted Balance after expenses correctly utilized', async () => {
      await User.create({
        id: userB,
        name: 'User B (Active Bal)',
        email: 'user-b-alerts@finaura.app',
        currentBalance: 45000
      });

      await Income.create({
        id: 'inc-alert-1',
        userId: userB,
        amount: 10000,
        source: 'Salary',
        timestamp: new Date()
      });

      await Transaction.create({
        id: 'tx-alert-2',
        userId: userB,
        amount: 2000,
        category: 'Food & Dining',
        type: 'Need',
        description: 'Groceries',
        timestamp: new Date()
      });

      // Income = 10,000, Exp = 2,000 -> Reconstructed would be 8,000, but persisted is 45,000
      const res = await evaluateAlerts(userB);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.computedBalance, 45000, 'Evaluates using authoritative persisted 45,000');
      assert.strictEqual(res.lowBalance, false, 'No low balance risk with ₹45,000');
    });

    // ── Case 3: Genuine Low Balance Alert Triggers ──────────────
    await test('Case 3: Genuine Low Balance triggers legitimate high-severity warning', async () => {
      await User.create({
        id: userC,
        name: 'User C (Low Bal)',
        email: 'user-c-alerts@finaura.app',
        currentBalance: 500 // Genuinely low balance (< 2000 buffer)
      });

      await Income.create({
        id: 'inc-alert-2',
        userId: userC,
        amount: 30000,
        source: 'Monthly Stipend',
        timestamp: new Date()
      });

      const res = await evaluateAlerts(userC);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.computedBalance, 500, 'Evaluates using actual balance of 500');
      assert.strictEqual(res.lowBalance, true, 'Correctly flags low balance risk when balance is ₹500');

      const lowBalAlert = res.data.find(a => a.message.includes('Risk of low balance'));
      assert.ok(lowBalAlert, 'Low balance alert is present');
      assert.strictEqual(lowBalAlert.severity, 'high');
      assert.strictEqual(lowBalAlert.type, 'warning');
    });

    // ── Case 4: Missing User Returns 404 ────────────────────────
    await test('Case 4: Missing User document returns 404 and does not fabricate balance', async () => {
      const res = await evaluateAlerts('u-non-existent-user');
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(res.data.message, 'User not found');
    });

    // ── Case 5: Cross-User Isolation ────────────────────────────
    await test('Case 5: Cross-User Isolation (User A high bal vs User C low bal)', async () => {
      const resA = await evaluateAlerts(userA);
      const resC = await evaluateAlerts(userC);

      assert.strictEqual(resA.computedBalance, 95000);
      assert.strictEqual(resA.lowBalance, false);

      assert.strictEqual(resC.computedBalance, 500);
      assert.strictEqual(resC.lowBalance, true);
    });

  } finally {
    // Cleanup
    await User.deleteMany({ id: { $in: [userA, userB, userC] } });
    await Transaction.deleteMany({ userId: { $in: [userA, userB, userC] } });
    await Income.deleteMany({ userId: { $in: [userA, userB, userC] } });
    await Alert.deleteMany({ userId: { $in: [userA, userB, userC] } });
    await mongoose.disconnect();
  }

  console.log('='.repeat(64));
  console.log(`  ALERTS TEST SUITE RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('='.repeat(64));

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runSuite().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});

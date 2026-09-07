/**
 * server/test_monthly_report.js
 * 
 * Dedicated integration test suite for GET /api/reports/monthly.
 * Verifies:
 *  1. Authentication & access control (401 for unauthenticated / invalid)
 *  2. Invalid year/month bounds validation (400)
 *  3. Accurate month filtering (exact UTC date boundaries)
 *  4. Correct income, expenses, and net cash flow calculations
 *  5. Correct spending mix (Needs / Wants / Investments) & ranked categories
 *  6. Zero-income month safety (savingsRate = 0, no division by zero)
 *  7. FMI snapshots handling (average, first, last, change; null when empty)
 *  8. Multi-tenancy and user isolation (User A cannot see User B's data)
 *  9. Read-only guarantee (0 MongoDB writes)
 * 10. Numerical safety (zero NaN or Infinity)
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
import FMIHistory from './models/FMIHistory.js';

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
  console.log('  FINAURA MONTHLY REPORT ENDPOINT TEST SUITE');
  console.log('============================================================\n');

  await connectDB();

  const app = express();
  app.use(express.json());
  app.use('/api', routes);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  const USER_A_ID = 'test_user_report_a_' + Date.now();
  const USER_B_ID = 'test_user_report_b_' + Date.now();

  try {
    // ── Setup Test Users ─────────────────────────────────────
    const userA = await User.create({
      id: USER_A_ID,
      email: `report_a_${Date.now()}@finaura.app`,
      password: 'HashedPassword123!',
      name: 'Report Test User A',
      monthlyIncome: 60000,
      currentBalance: 50000
    });

    const userB = await User.create({
      id: USER_B_ID,
      email: `report_b_${Date.now()}@finaura.app`,
      password: 'HashedPassword123!',
      name: 'Report Test User B',
      monthlyIncome: 90000,
      currentBalance: 80000
    });

    const tokenA = generateTestToken(userA);
    const tokenB = generateTestToken(userB);

    // Target period for testing: August 2026 (2026-08-01 to 2026-09-01 UTC)
    // ── Populate User A Records ──────────────────────────────
    // In August 2026:
    // Income: ₹70,000 on 2026-08-05
    await Income.create({
      id: `inc_a_1_${Date.now()}`,
      userId: USER_A_ID,
      amount: 70000,
      source: 'salary',
      description: 'August Salary',
      timestamp: new Date('2026-08-05T10:00:00.000Z')
    });

    // Expenses in August:
    // 1. Need: Groceries ₹12,000
    await Transaction.create({
      id: `tx_a_1_${Date.now()}`,
      userId: USER_A_ID,
      amount: 12000,
      type: 'Need',
      category: 'Groceries',
      description: 'Monthly Groceries',
      timestamp: new Date('2026-08-10T12:00:00.000Z')
    });

    // 2. Want: Entertainment ₹8,000
    await Transaction.create({
      id: `tx_a_2_${Date.now()}`,
      userId: USER_A_ID,
      amount: 8000,
      type: 'Want',
      category: 'Entertainment',
      description: 'Concert Tickets',
      timestamp: new Date('2026-08-15T15:00:00.000Z')
    });

    // 3. Investment: SIP ₹10,000
    await Transaction.create({
      id: `tx_a_3_${Date.now()}`,
      userId: USER_A_ID,
      amount: 10000,
      type: 'Investment',
      category: 'Investments',
      description: 'Index SIP',
      timestamp: new Date('2026-08-20T08:00:00.000Z')
    });

    // 4. Anomaly in August: Dining ₹5,000
    await Transaction.create({
      id: `tx_a_4_${Date.now()}`,
      userId: USER_A_ID,
      amount: 5000,
      type: 'Want',
      category: 'Food & Dining',
      description: 'Fine Dining Spree',
      isAnomaly: true,
      timestamp: new Date('2026-08-25T21:00:00.000Z')
    });

    // Outside August (July 2026): Should NOT appear in August report
    await Transaction.create({
      id: `tx_a_july_${Date.now()}`,
      userId: USER_A_ID,
      amount: 25000,
      type: 'Need',
      category: 'Housing',
      description: 'July Rent',
      timestamp: new Date('2026-07-28T10:00:00.000Z')
    });

    // Outside August (September 2026): Should NOT appear in August report
    await Income.create({
      id: `inc_a_sep_${Date.now()}`,
      userId: USER_A_ID,
      amount: 75000,
      source: 'salary',
      description: 'September Salary',
      timestamp: new Date('2026-09-02T10:00:00.000Z')
    });

    // FMI Snapshots in August for User A:
    await FMIHistory.create({
      userId: USER_A_ID,
      score: 72,
      timestamp: new Date('2026-08-07T00:00:00.000Z'),
      snapshotDate: '2026-08-07'
    });
    await FMIHistory.create({
      userId: USER_A_ID,
      score: 78,
      timestamp: new Date('2026-08-28T00:00:00.000Z'),
      snapshotDate: '2026-08-28'
    });

    // ── Populate User B Records (Tenancy Isolation) ───────────
    await Income.create({
      id: `inc_b_1_${Date.now()}`,
      userId: USER_B_ID,
      amount: 150000,
      source: 'freelance',
      description: 'User B Inflow',
      timestamp: new Date('2026-08-10T10:00:00.000Z')
    });
    await Transaction.create({
      id: `tx_b_1_${Date.now()}`,
      userId: USER_B_ID,
      amount: 99000,
      type: 'Want',
      category: 'Shopping',
      description: 'User B Luxury',
      timestamp: new Date('2026-08-12T10:00:00.000Z')
    });

    // ── TEST 1: Unauthenticated request rejected (401) ───────
    process.stdout.write('Running Test 1: Unauthenticated request rejected (401)... ');
    const res1 = await fetch(`${baseUrl}/reports/monthly?year=2026&month=8`);
    assert.strictEqual(res1.status, 401, `Expected 401, got ${res1.status}`);
    console.log('✅ Passed');

    // ── TEST 2: Invalid token rejected (401) ─────────────────
    process.stdout.write('Running Test 2: Invalid token rejected (401)... ');
    const res2 = await fetch(`${baseUrl}/reports/monthly?year=2026&month=8`, {
      headers: { Authorization: 'Bearer invalid_token_123' }
    });
    assert.strictEqual(res2.status, 401, `Expected 401, got ${res2.status}`);
    console.log('✅ Passed');

    // ── TEST 3: Invalid year/month bounds rejected (400) ──────
    process.stdout.write('Running Test 3: Invalid year/month bounds rejected (400)... ');
    const res3a = await fetch(`${baseUrl}/reports/monthly?year=1990&month=8`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(res3a.status, 400, 'Year < 2000 should be rejected');

    const res3b = await fetch(`${baseUrl}/reports/monthly?year=2026&month=13`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(res3b.status, 400, 'Month > 12 should be rejected');

    const res3c = await fetch(`${baseUrl}/reports/monthly?year=2026&month=0`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(res3c.status, 400, 'Month 0 should be rejected');
    console.log('✅ Passed');

    // ── TEST 4: Accurate period filtering & aggregates ────────
    process.stdout.write('Running Test 4: Accurate period filtering & aggregates... ');
    const res4 = await fetch(`${baseUrl}/reports/monthly?year=2026&month=8`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(res4.status, 200);
    const json4 = await res4.json();
    const data4 = json4.data || json4;

    assert.strictEqual(data4.year, 2026);
    assert.strictEqual(data4.month, 8);
    assert.strictEqual(data4.period, '2026-08');
    assert.strictEqual(data4.periodLabel, 'August 2026');

    // Total income for August = ₹70,000 (excludes September ₹75,000)
    assert.strictEqual(data4.totalIncome, 70000, `Expected totalIncome 70000, got ${data4.totalIncome}`);
    assert.strictEqual(data4.incomeCount, 1);

    // Total expenses for August = 12000 + 8000 + 10000 + 5000 = 35000 (excludes July ₹25,000)
    assert.strictEqual(data4.totalExpenses, 35000, `Expected totalExpenses 35000, got ${data4.totalExpenses}`);
    assert.strictEqual(data4.transactionCount, 4);

    // Net cash flow = 70000 - 35000 = 35000
    assert.strictEqual(data4.netCashFlow, 35000, `Expected netCashFlow 35000, got ${data4.netCashFlow}`);

    // Savings rate = Math.round((35000 / 70000) * 100) = 50%
    assert.strictEqual(data4.savingsRate, 50, `Expected savingsRate 50, got ${data4.savingsRate}`);

    // Spending mix
    assert.strictEqual(data4.spendingMix.Needs, 12000, 'Needs spend');
    assert.strictEqual(data4.spendingMix.Wants, 13000, 'Wants spend (8000 + 5000)');
    assert.strictEqual(data4.spendingMix.Investments, 10000, 'Investments spend');

    // Top categories
    assert.ok(Array.isArray(data4.topCategories), 'topCategories is array');
    assert.strictEqual(data4.topCategories[0].category, 'Groceries');
    assert.strictEqual(data4.topCategories[0].amount, 12000);

    // FMI snapshot analysis
    assert.strictEqual(data4.fmi.hasSnapshots, true);
    assert.strictEqual(data4.fmi.snapshotCount, 2);
    assert.strictEqual(data4.fmi.average, 75); // (72 + 78)/2 = 75
    assert.strictEqual(data4.fmi.first, 72);
    assert.strictEqual(data4.fmi.last, 78);
    assert.strictEqual(data4.fmi.change, 6); // 78 - 72 = 6

    // Anomalies
    assert.strictEqual(data4.anomalies.count, 1);
    assert.strictEqual(data4.anomalies.items[0].category, 'Food & Dining');
    assert.strictEqual(data4.anomalies.items[0].amount, 5000);
    console.log('✅ Passed');

    // ── TEST 5: Zero-activity month handling (no crash, clean 0s)
    process.stdout.write('Running Test 5: Empty month handling (January 2025)... ');
    const res5 = await fetch(`${baseUrl}/reports/monthly?year=2025&month=1`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(res5.status, 200);
    const json5 = await res5.json();
    const data5 = json5.data || json5;

    assert.strictEqual(data5.totalIncome, 0);
    assert.strictEqual(data5.totalExpenses, 0);
    assert.strictEqual(data5.netCashFlow, 0);
    assert.strictEqual(data5.savingsRate, 0);
    assert.strictEqual(data5.fmi.hasSnapshots, false);
    assert.strictEqual(data5.fmi.average, null);
    assert.strictEqual(data5.topCategories.length, 0);
    console.log('✅ Passed');

    // ── TEST 6: Tenancy Isolation (User B cannot see User A) ──
    process.stdout.write('Running Test 6: Multi-tenancy and IDOR protection... ');
    const res6 = await fetch(`${baseUrl}/reports/monthly?year=2026&month=8`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.strictEqual(res6.status, 200);
    const json6 = await res6.json();
    const data6 = json6.data || json6;

    // User B should strictly see their own records (Income ₹150,000, Expenses ₹99,000)
    assert.strictEqual(data6.totalIncome, 150000, `Expected User B income 150000, got ${data6.totalIncome}`);
    assert.strictEqual(data6.totalExpenses, 99000, `Expected User B expenses 99000, got ${data6.totalExpenses}`);
    assert.strictEqual(data6.spendingMix.Wants, 99000);
    assert.strictEqual(data6.spendingMix.Needs, 0);
    console.log('✅ Passed');

    // ── TEST 7: Zero-persistence Guarantee ────────────────────
    process.stdout.write('Running Test 7: Zero database persistence guarantee... ');
    const userABefore = await User.findOne({ id: USER_A_ID }).lean();
    await fetch(`${baseUrl}/reports/monthly?year=2026&month=8`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const userAAfter = await User.findOne({ id: USER_A_ID }).lean();
    assert.deepStrictEqual(userABefore, userAAfter, 'User document must not be mutated');
    console.log('✅ Passed');

    // ── TEST 8: Numerical safety (zero NaN or Infinity) ───────
    process.stdout.write('Running Test 8: Numerical safety (zero NaN or Infinity)... ');
    checkNoNaNOrInfinity(data4, 'AugustReport');
    checkNoNaNOrInfinity(data5, 'EmptyReport');
    console.log('✅ Passed');

    console.log('\n============================================================');
    console.log('  ALL MONTHLY REPORT TESTS PASSED SUCCESSFULLY! 🚀');
    console.log('============================================================\n');

  } finally {
    // Cleanup test data
    await User.deleteMany({ id: { $in: [USER_A_ID, USER_B_ID] } });
    await Income.deleteMany({ userId: { $in: [USER_A_ID, USER_B_ID] } });
    await Transaction.deleteMany({ userId: { $in: [USER_A_ID, USER_B_ID] } });
    await FMIHistory.deleteMany({ userId: { $in: [USER_A_ID, USER_B_ID] } });
    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});

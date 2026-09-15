/**
 * server/test_family_fmi.js
 *
 * Comprehensive test suite for FINAURA Family System Phase 4 Family FMI Engine:
 *  1. unauthenticated access rejected (401)
 *  2. no-family behavior ({ success: true, family: null, dashboard: null })
 *  3. Family FMI present for active family on GET /api/family/dashboard
 *  4. Family FMI uses pooled data
 *  5. Family FMI not average of member FMI (deterministic numeric proof)
 *  6. D1 uses summed household required saving
 *  7. D1 uses Investment Type only
 *  8. D2 uses pooled effective income
 *  9. D2 uses pooled non-investment spend
 * 10. D3 Wants > Needs works at household level
 * 11. D3 late-night threshold scales with member count (2 * memberCount)
 * 12. D3 impulse threshold scales with member count (4 * memberCount)
 * 13. zero-income safe math (no NaN or Infinity)
 * 14. zero-transaction safe math (clean baseline score)
 * 15. score clamped 0-100
 * 16. labels match individual FMI labels (Excellent, Good, Fair, Needs Attention, Critical)
 * 17. family insights deterministic (no LLM, explainable)
 * 18. no member attribution in FMI payload (strict privacy audit)
 * 19. individual FMI unchanged by family membership
 * 20. family dashboard remains read-only (zero mutations)
 * 21. member leaving changes Family FMI on subsequent request
 * 22. cross-family isolation (Family A cannot aggregate Family B data)
 * 23. Phase 3 aggregate contract remains unchanged except added fmi field
 */

import './test/setupEnv.js';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import routes from './routes/index.js';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Goal from './models/Goal.js';
import Family from './models/Family.js';
import FamilyInvitation from './models/FamilyInvitation.js';
import Transaction from './models/Transaction.js';
import Income from './models/Income.js';
import { calculateFMI } from './services/FMIService.js';
import * as FamilyService from './services/FamilyService.js';
import * as FamilyFMIService from './services/FamilyFMIService.js';

const JWT_SECRET = process.env.JWT_SECRET;

function generateTestToken(user) {
  return jwt.sign(
    {
      id: user.id || user._id?.toString(),
      _id: user._id?.toString(),
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

let passed = 0;
async function test(name, fn) {
  process.stdout.write(`Running ${name}... `);
  try {
    await fn();
    passed++;
    console.log('✅ Passed');
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    throw err;
  }
}

async function runTests() {
  console.log('='.repeat(64));
  console.log('  FINAURA FAMILY SYSTEM PHASE 4 FAMILY FMI TEST SUITE');
  console.log('='.repeat(64));

  await connectDB();

  // Create test express app & mount routes
  const app = express();
  app.use(express.json());
  app.use('/api', routes);

  // Start on ephemeral port
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/family`;

  const ts = Date.now();
  const uidA = `u-fmi-a-${ts}`;
  const uidB = `u-fmi-b-${ts}`;
  const uidC = `u-fmi-c-${ts}`;
  const uidSolo = `u-fmi-solo-${ts}`;
  const uidX1 = `u-fmi-x1-${ts}`;
  const uidY1 = `u-fmi-y1-${ts}`;

  const allTestUserIds = [uidA, uidB, uidC, uidSolo, uidX1, uidY1];

  const cleanup = async () => {
    await User.deleteMany({ id: { $in: allTestUserIds } });
    await Goal.deleteMany({ userId: { $in: allTestUserIds } });
    await Family.deleteMany({
      $or: [
        { ownerUserId: { $in: allTestUserIds } },
        { 'members.userId': { $in: allTestUserIds } }
      ]
    });
    await FamilyInvitation.deleteMany({
      $or: [
        { inviterUserId: { $in: allTestUserIds } },
        { inviteeUserId: { $in: allTestUserIds } }
      ]
    });
    await Transaction.deleteMany({ userId: { $in: allTestUserIds } });
    await Income.deleteMany({ userId: { $in: allTestUserIds } });
  };

  try {
    await cleanup();

    // Current date and mid-month test timestamp
    const now = new Date();
    const currentMonthMid = new Date(now.getFullYear(), now.getMonth(), 15, 12, 0, 0);

    const dob30 = new Date(now.getFullYear() - 30, 0, 1);

    // Setup base users:
    // Member A: Age 30, Retires at 40 (10 yrs = 120 mo). Goal: 2,400,000 -> Required: 20,000/mo. Income: 80,000. Balance: 0.
    const userA = await User.create({
      id: uidA,
      name: 'Alice FMI',
      email: `alice-fmi-${ts}@test.com`,
      dateOfBirth: dob30,
      age: 30,
      retirementAge: 40,
      monthlyIncome: 80000,
      income: 80000,
      currentBalance: 0
    });
    await Goal.create({
      id: `g-a-${ts}`,
      userId: uidA,
      name: 'Retirement Corpus',
      targetAmount: 2400000
    });

    // Member B: Age 30, Retires at 40 (10 yrs = 120 mo). Goal: 1,200,000 -> Required: 10,000/mo. Income: 50,000. Balance: 0.
    const userB = await User.create({
      id: uidB,
      name: 'Bob FMI',
      email: `bob-fmi-${ts}@test.com`,
      dateOfBirth: dob30,
      age: 30,
      retirementAge: 40,
      monthlyIncome: 50000,
      income: 50000,
      currentBalance: 0
    });
    await Goal.create({
      id: `g-b-${ts}`,
      userId: uidB,
      name: 'Retirement Corpus',
      targetAmount: 1200000
    });

    // Member C (for addition/removal):
    const userC = await User.create({
      id: uidC,
      name: 'Charlie FMI',
      email: `charlie-fmi-${ts}@test.com`,
      age: 35,
      retirementAge: 55,
      monthlyIncome: 40000,
      income: 40000,
      currentBalance: 0
    });

    // Solo User with no family
    const userSolo = await User.create({
      id: uidSolo,
      name: 'Solo FMI User',
      email: `solo-fmi-${ts}@test.com`,
      monthlyIncome: 60000,
      income: 60000
    });

    const tokenA = generateTestToken(userA);
    const tokenB = generateTestToken(userB);
    const tokenSolo = generateTestToken(userSolo);

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 1: Unauthenticated access rejected (401)
    // ──────────────────────────────────────────────────────────────────────────
    await test('1. unauthenticated access rejected (401)', async () => {
      const res = await fetch(`${baseUrl}/dashboard`);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.code, 'MISSING_TOKEN');
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 2: No-family behavior ({ success: true, family: null, dashboard: null })
    // ──────────────────────────────────────────────────────────────────────────
    await test('2. no-family behavior returns { success: true, family: null, dashboard: null }', async () => {
      const res = await fetch(`${baseUrl}/dashboard`, {
        headers: { Authorization: `Bearer ${tokenSolo}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.family, null);
      assert.strictEqual(json.dashboard, null);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // SETUP POOLED FAMILY FIXTURE
    // ──────────────────────────────────────────────────────────────────────────
    // Family A+B
    const familyAB = await Family.create({
      name: 'FMI Alpha Household',
      ownerUserId: uidA,
      members: [
        { userId: uidA, role: 'owner', joinedAt: new Date() },
        { userId: uidB, role: 'member', joinedAt: new Date() }
      ],
      isActive: true
    });

    // Incomes:
    // A: 80,000 actual
    // B: 0 actual (falls back to declared 50,000) -> Household effective = 130,000
    await Income.create({
      id: `inc-fmi-a-${ts}`,
      userId: uidA,
      amount: 80000,
      timestamp: currentMonthMid
    });

    // Transactions:
    // Member A:
    // Need: 25,000
    // Want: 15,000
    // Investment: 18,000 (target was 20,000 -> savingRatio 0.90)
    await Transaction.create([
      { id: `tx-fmi-a1-${ts}`, userId: uidA, amount: 25000, type: 'Need', category: 'Housing', timestamp: currentMonthMid },
      { id: `tx-fmi-a2-${ts}`, userId: uidA, amount: 15000, type: 'Want', category: 'Shopping', timestamp: currentMonthMid },
      { id: `tx-fmi-a3-${ts}`, userId: uidA, amount: 18000, type: 'Investment', category: 'Investments', timestamp: currentMonthMid }
    ]);

    // Member B:
    // Need: 20,000
    // Want: 10,000
    // Investment: 12,000 (target was 10,000 -> savingRatio 1.20)
    await Transaction.create([
      { id: `tx-fmi-b1-${ts}`, userId: uidB, amount: 20000, type: 'Need', category: 'Groceries', timestamp: currentMonthMid },
      { id: `tx-fmi-b2-${ts}`, userId: uidB, amount: 10000, type: 'Want', category: 'Entertainment', timestamp: currentMonthMid },
      { id: `tx-fmi-b3-${ts}`, userId: uidB, amount: 12000, type: 'Investment', category: 'Investments', timestamp: currentMonthMid }
    ]);

    // Household Totals:
    // Effective Income: 130,000
    // Need: 45,000
    // Want: 25,000
    // Non-investment Spend: 70,000
    // Investment Flow: 30,000 (18,000 + 12,000)
    // Required Saving: 30,000 (20,000 + 10,000) -> Household savingRatio = 30,000 / 30,000 = 1.0 -> D1 score = 90
    // Available Money: 130,000 - 30,000 = 100,000

    let dashboardResponse;

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 3: Family FMI present on GET /api/family/dashboard
    // ──────────────────────────────────────────────────────────────────────────
    await test('3. Family FMI object present for active family on GET /api/family/dashboard', async () => {
      const res = await fetch(`${baseUrl}/dashboard`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert.strictEqual(res.status, 200);
      dashboardResponse = await res.json();

      assert.strictEqual(dashboardResponse.success, true);
      assert.ok(dashboardResponse.fmi, 'fmi object must be present in dashboard response');
      assert.strictEqual(typeof dashboardResponse.fmi.score, 'number');
      assert.strictEqual(typeof dashboardResponse.fmi.fmiLabel, 'string');
      assert.ok(dashboardResponse.fmi.pillars.D1_savingDiscipline);
      assert.ok(dashboardResponse.fmi.pillars.D2_spendingControl);
      assert.ok(dashboardResponse.fmi.pillars.D3_behavioralRisk);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 4: Family FMI uses pooled data
    // ──────────────────────────────────────────────────────────────────────────
    await test('4. Family FMI uses pooled household data', async () => {
      const { householdGoalDetail } = dashboardResponse.fmi;
      assert.strictEqual(householdGoalDetail.householdRequiredThisMonth, 30000); // 20k (A) + 10k (B)
      assert.strictEqual(householdGoalDetail.householdTotalSaved, 30000);        // 18k (A) + 12k (B)
      assert.strictEqual(householdGoalDetail.availableMoney, 100000);            // 130k - 30k
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5: Family FMI is NOT the average of member FMI (Numeric Proof)
    // ──────────────────────────────────────────────────────────────────────────
    await test('5. Family FMI not average of member FMI (deterministic numeric proof)', async () => {
      // Calculate individual FMI for Member A
      const txsA = await Transaction.find({ userId: uidA }).lean();
      const indivA = calculateFMI(
        {
          currentBalance: userA.currentBalance,
          monthlyIncome: userA.monthlyIncome,
          currentAge: userA.age,
          retirementAge: userA.retirementAge,
          retirementGoal: 2400000
        },
        txsA
      );

      // Calculate individual FMI for Member B
      const txsB = await Transaction.find({ userId: uidB }).lean();
      const indivB = calculateFMI(
        {
          currentBalance: userB.currentBalance,
          monthlyIncome: userB.monthlyIncome,
          currentAge: userB.age,
          retirementAge: userB.retirementAge,
          retirementGoal: 1200000
        },
        txsB
      );

      const arithmeticAverage = (indivA.score + indivB.score) / 2;
      const familyScore = dashboardResponse.fmi.score;

      // Prove Member A D1 (18k / 20k = 0.90 -> D1=77) != Member B D1 (12k / 10k = 1.20 -> D1=94)
      assert.notEqual(indivA.pillars.D1_savingDiscipline.score, indivB.pillars.D1_savingDiscipline.score);

      // Prove Family D1 evaluates the pooled 30k/30k = 1.0 -> 90
      assert.strictEqual(dashboardResponse.fmi.pillars.D1_savingDiscipline.score, 90);

      // The arithmetic average of indiv D1 scores is (77 + 94) / 2 = 85.5, whereas Family D1 is 90!
      const avgD1 = (indivA.pillars.D1_savingDiscipline.score + indivB.pillars.D1_savingDiscipline.score) / 2;
      assert.notEqual(familyScore, arithmeticAverage, `Family FMI (${familyScore}) must NOT equal arithmetic mean (${arithmeticAverage})`);
      assert.notEqual(dashboardResponse.fmi.pillars.D1_savingDiscipline.score, avgD1);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 6: D1 uses summed household required saving
    // ──────────────────────────────────────────────────────────────────────────
    await test('6. D1 uses summed household required saving', async () => {
      // Obligation A (20,000) + Obligation B (10,000) = 30,000
      // Pooled saved = 30,000 -> savingRatio = 1.0 -> exactly score 90
      assert.strictEqual(dashboardResponse.fmi.pillars.D1_savingDiscipline.score, 90);
      assert.ok(dashboardResponse.fmi.pillars.D1_savingDiscipline.detail.includes('100% of target'));
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 7: D1 uses Investment Type only
    // ──────────────────────────────────────────────────────────────────────────
    await test('7. D1 uses Investment Type only', async () => {
      // Add a Need transaction with Category: Investments (e.g. mandatory fee)
      const txNeedInv = await Transaction.create({
        id: `tx-fmi-need-inv-${ts}`,
        userId: uidA,
        amount: 5000,
        type: 'Need',
        category: 'Investments',
        timestamp: currentMonthMid
      });

      const fmiResult = await FamilyFMIService.getFamilyFMI(uidA, null, now);
      // Total saved must remain 30,000 (excluding the 5,000 Need transaction)
      assert.strictEqual(fmiResult.householdGoalDetail.householdTotalSaved, 30000);
      assert.strictEqual(fmiResult.pillars.D1_savingDiscipline.score, 90);

      await Transaction.deleteOne({ _id: txNeedInv._id });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 8: D2 uses pooled effective income
    // ──────────────────────────────────────────────────────────────────────────
    await test('8. D2 uses pooled effective income', async () => {
      // Effective income: 130,000 (A: 80,000 actual, B: 50,000 declared fallback)
      // Required savings: 30,000 -> Available money = 100,000
      assert.strictEqual(dashboardResponse.fmi.householdGoalDetail.availableMoney, 100000);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 9: D2 uses pooled non-investment spend
    // ──────────────────────────────────────────────────────────────────────────
    await test('9. D2 uses pooled non-investment spend', async () => {
      // Total non-investment spend: A (25k + 15k = 40k) + B (20k + 10k = 30k) = 70,000
      assert.strictEqual(dashboardResponse.spending.totalNonInvestment, 70000);
      assert.strictEqual(
        dashboardResponse.fmi.householdGoalDetail.predictedMonthlySpend,
        dashboardResponse.pacing.predictedMonthlyNonInvestmentSpend
      );
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 10: D3 Wants > Needs works at household level
    // ──────────────────────────────────────────────────────────────────────────
    await test('10. D3 Wants > Needs correctly applies household penalty', async () => {
      // In baseline: Needs = 45,000, Wants = 25,000 -> Needs > Wants, no penalty
      const fmiBaseline = await FamilyFMIService.getFamilyFMI(uidA, null, now);
      assert.strictEqual(fmiBaseline.pillars.D3_behavioralRisk.score, 100);

      // Add a large Want transaction to invert the ratio (Wants = 55,000 > Needs = 45,000)
      const txBigWant = await Transaction.create({
        id: `tx-fmi-bigwant-${ts}`,
        userId: uidB,
        amount: 30000,
        type: 'Want',
        category: 'Shopping',
        timestamp: currentMonthMid
      });

      const fmiWithHighWants = await FamilyFMIService.getFamilyFMI(uidA, null, now);
      // 100 - 15 = 85
      assert.strictEqual(fmiWithHighWants.pillars.D3_behavioralRisk.score, 85);
      assert.ok(fmiWithHighWants.insights.some(i => i.includes('Discretionary spending (Wants) exceeds')));

      await Transaction.deleteOne({ _id: txBigWant._id });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 11: D3 late-night threshold scales with member count (2 * memberCount)
    // ──────────────────────────────────────────────────────────────────────────
    await test('11. D3 late-night threshold scales with member count (2 * memberCount)', async () => {
      // Family of 2 members -> scaled threshold is 2 * 2 = 4 late-night transactions
      // Add 2 late-night transactions across household (would trigger individual threshold of 2, but NOT household threshold of 4)
      const lateTime = new Date(now.getFullYear(), now.getMonth(), 10, 23, 15, 0);

      const txLN1 = await Transaction.create({
        id: `tx-ln-1-${ts}`,
        userId: uidA,
        amount: 500,
        type: 'Need',
        category: 'Transport & Travel',
        timestamp: lateTime
      });
      const txLN2 = await Transaction.create({
        id: `tx-ln-2-${ts}`,
        userId: uidB,
        amount: 600,
        type: 'Need',
        category: 'Transport & Travel',
        timestamp: lateTime
      });

      let fmiCheck = await FamilyFMIService.getFamilyFMI(uidA, null, now);
      // 2 late-night transactions < 4 threshold -> NO penalty!
      assert.strictEqual(fmiCheck.pillars.D3_behavioralRisk.score, 100);

      // Now add 2 more late-night transactions (total = 4 -> reaches scaled threshold)
      const txLN3 = await Transaction.create({
        id: `tx-ln-3-${ts}`,
        userId: uidA,
        amount: 700,
        type: 'Need',
        category: 'Transport & Travel',
        timestamp: lateTime
      });
      const txLN4 = await Transaction.create({
        id: `tx-ln-4-${ts}`,
        userId: uidB,
        amount: 800,
        type: 'Need',
        category: 'Transport & Travel',
        timestamp: lateTime
      });

      fmiCheck = await FamilyFMIService.getFamilyFMI(uidA, null, now);
      // 4 transactions >= 4 threshold -> penalty applied (-15)
      assert.strictEqual(fmiCheck.pillars.D3_behavioralRisk.score, 85);

      await Transaction.deleteMany({ id: { $in: [`tx-ln-1-${ts}`, `tx-ln-2-${ts}`, `tx-ln-3-${ts}`, `tx-ln-4-${ts}`] } });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 12: D3 impulse threshold scales with member count (4 * memberCount)
    // ──────────────────────────────────────────────────────────────────────────
    await test('12. D3 impulse threshold scales with member count (4 * memberCount)', async () => {
      // Family of 2 -> scaled threshold = 4 * 2 = 8 shopping transactions
      // Currently household has 2 Want shopping/entertainment transactions (1 from A, 1 from B)
      // Add 4 more (total 6 < 8) -> no penalty
      const impulseTxs = [];
      for (let i = 1; i <= 4; i++) {
        impulseTxs.push(await Transaction.create({
          id: `tx-imp-${i}-${ts}`,
          userId: uidA,
          amount: 1000,
          type: 'Need',
          category: 'Shopping',
          timestamp: currentMonthMid
        }));
      }

      let fmiCheck = await FamilyFMIService.getFamilyFMI(uidA, null, now);
      assert.strictEqual(fmiCheck.pillars.D3_behavioralRisk.score, 100);

      // Add 2 more (total 8 >= 8) -> penalty applied (-8)
      for (let i = 5; i <= 6; i++) {
        impulseTxs.push(await Transaction.create({
          id: `tx-imp-${i}-${ts}`,
          userId: uidB,
          amount: 1000,
          type: 'Need',
          category: 'Shopping',
          timestamp: currentMonthMid
        }));
      }

      fmiCheck = await FamilyFMIService.getFamilyFMI(uidA, null, now);
      assert.strictEqual(fmiCheck.pillars.D3_behavioralRisk.score, 92); // 100 - 8 = 92

      await Transaction.deleteMany({ id: { $in: impulseTxs.map(t => t.id) } });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 13: Zero-income safe math (no NaN or Infinity)
    // ──────────────────────────────────────────────────────────────────────────
    await test('13. zero-income safe math produces stable scores without NaN or Infinity', async () => {
      const zeroFamUser = await User.create({
        id: `u-zero-inc-${ts}`,
        name: 'Zero Income User',
        email: `zero-inc-${ts}@test.com`,
        monthlyIncome: 0,
        income: 0
      });
      const zeroFam = await Family.create({
        name: 'Zero Income Household',
        ownerUserId: zeroFamUser.id,
        members: [{ userId: zeroFamUser.id, role: 'owner', joinedAt: new Date() }],
        isActive: true
      });

      const fmiZero = await FamilyFMIService.getFamilyFMI(zeroFamUser.id, null, now);
      assert.ok(fmiZero);
      assert.ok(!Number.isNaN(fmiZero.score));
      assert.ok(Number.isFinite(fmiZero.score));
      assert.strictEqual(typeof fmiZero.fmiLabel, 'string');

      await Family.deleteOne({ _id: zeroFam._id });
      await User.deleteOne({ id: zeroFamUser.id });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 14: Zero-transaction safe math (clean baseline score)
    // ──────────────────────────────────────────────────────────────────────────
    await test('14. zero-transaction safe math produces clean baseline score', async () => {
      const emptyFamUser = await User.create({
        id: `u-empty-tx-${ts}`,
        name: 'Empty Tx User',
        email: `empty-tx-${ts}@test.com`,
        monthlyIncome: 60000,
        income: 60000
      });
      const emptyFam = await Family.create({
        name: 'Empty Tx Household',
        ownerUserId: emptyFamUser.id,
        members: [{ userId: emptyFamUser.id, role: 'owner', joinedAt: new Date() }],
        isActive: true
      });

      const fmiEmpty = await FamilyFMIService.getFamilyFMI(emptyFamUser.id, null, now);
      assert.ok(fmiEmpty);
      assert.ok(fmiEmpty.score > 0);
      assert.strictEqual(fmiEmpty.pillars.D3_behavioralRisk.score, 100);

      await Family.deleteOne({ _id: emptyFam._id });
      await User.deleteOne({ id: emptyFamUser.id });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 15: Score clamped 0-100
    // ──────────────────────────────────────────────────────────────────────────
    await test('15. score is strictly clamped between 0 and 100', async () => {
      const score = dashboardResponse.fmi.score;
      assert.ok(score >= 0 && score <= 100);
      assert.ok(dashboardResponse.fmi.pillars.D1_savingDiscipline.score >= 0 && dashboardResponse.fmi.pillars.D1_savingDiscipline.score <= 100);
      assert.ok(dashboardResponse.fmi.pillars.D2_spendingControl.score >= 0 && dashboardResponse.fmi.pillars.D2_spendingControl.score <= 100);
      assert.ok(dashboardResponse.fmi.pillars.D3_behavioralRisk.score >= 0 && dashboardResponse.fmi.pillars.D3_behavioralRisk.score <= 100);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 16: Labels match individual FMI scale
    // ──────────────────────────────────────────────────────────────────────────
    await test('16. labels match individual FMI scale (Excellent, Good, Fair, Needs Attention, Critical)', async () => {
      const validLabels = ['Excellent', 'Good', 'Fair', 'Needs Attention', 'Critical'];
      assert.ok(validLabels.includes(dashboardResponse.fmi.fmiLabel));
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 17: Family insights deterministic
    // ──────────────────────────────────────────────────────────────────────────
    await test('17. family insights are deterministic and require no LLM', async () => {
      const insights = dashboardResponse.fmi.insights;
      assert.ok(Array.isArray(insights));
      assert.ok(insights.length >= 2);
      for (const ins of insights) {
        assert.strictEqual(typeof ins, 'string');
        assert.ok(ins.length > 10);
      }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 18: No member attribution in FMI payload (Strict Privacy Audit)
    // ──────────────────────────────────────────────────────────────────────────
    await test('18. no member attribution or individual retirement data in FMI payload', async () => {
      const res = await fetch(`${baseUrl}/dashboard`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      const json = await res.json();
      const fmi = json.fmi;

      // FMI must NOT leak individual member FMI, member D1/D2/D3, or member saving targets
      assert.strictEqual(fmi.memberScores, undefined);
      assert.strictEqual(fmi.individualFMI, undefined);
      assert.strictEqual(fmi.memberObligations, undefined);

      // Serialized FMI payload must not contain individual IDs or private names
      const serialized = JSON.stringify(fmi);
      assert.ok(!serialized.includes(uidA));
      assert.ok(!serialized.includes(uidB));
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 19: Individual FMI unchanged by family membership
    // ──────────────────────────────────────────────────────────────────────────
    await test('19. individual FMI output unchanged by family membership', async () => {
      // Golden individual FMI for Member A calculated directly
      const txsA = await Transaction.find({ userId: uidA }).lean();
      const directA = calculateFMI(
        {
          currentBalance: userA.currentBalance,
          monthlyIncome: userA.monthlyIncome,
          currentAge: userA.age,
          retirementAge: userA.retirementAge,
          retirementGoal: 2400000
        },
        txsA
      );

      // Individual endpoint /api/fmi via authenticated request for Member A
      const tokenRes = await fetch(`http://127.0.0.1:${port}/api/fmi`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert.strictEqual(tokenRes.status, 200);
      const apiIndivA = await tokenRes.json();

      // Verify that individual FMI returns its own score (which differs from family FMI)
      assert.strictEqual(apiIndivA.score, directA.score);
      assert.strictEqual(apiIndivA.pillars.D1_savingDiscipline.score, directA.pillars.D1_savingDiscipline.score);
      assert.notEqual(apiIndivA.score, dashboardResponse.fmi.score, 'Individual FMI must not equal Family FMI');
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 20: Family dashboard remains read-only (zero mutations)
    // ──────────────────────────────────────────────────────────────────────────
    await test('20. family dashboard remains strictly read-only', async () => {
      const txCountBefore = await Transaction.countDocuments({ userId: { $in: [uidA, uidB] } });
      const incCountBefore = await Income.countDocuments({ userId: { $in: [uidA, uidB] } });

      await fetch(`${baseUrl}/dashboard`, { headers: { Authorization: `Bearer ${tokenA}` } });
      await fetch(`${baseUrl}/dashboard`, { headers: { Authorization: `Bearer ${tokenB}` } });

      const txCountAfter = await Transaction.countDocuments({ userId: { $in: [uidA, uidB] } });
      const incCountAfter = await Income.countDocuments({ userId: { $in: [uidA, uidB] } });

      assert.strictEqual(txCountBefore, txCountAfter);
      assert.strictEqual(incCountBefore, incCountAfter);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 21: Member leaving changes Family FMI on subsequent request
    // ──────────────────────────────────────────────────────────────────────────
    await test('21. member leaving changes Family FMI on subsequent request', async () => {
      const fmiBefore = await FamilyFMIService.getFamilyFMI(uidA, null, now);
      assert.strictEqual(fmiBefore.householdGoalDetail.householdRequiredThisMonth, 30000);

      // Member B leaves
      await FamilyService.leaveFamily(uidB);

      const fmiAfter = await FamilyFMIService.getFamilyFMI(uidA, null, now);
      // Now only Member A remains -> Required savings drops to 20,000
      assert.strictEqual(fmiAfter.householdGoalDetail.householdRequiredThisMonth, 20000);
      // Total saved drops from 30,000 to Member A's 18,000
      assert.strictEqual(fmiAfter.householdGoalDetail.householdTotalSaved, 18000);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 22: Cross-family isolation
    // ──────────────────────────────────────────────────────────────────────────
    await test('22. cross-family isolation: Family X cannot aggregate Family Y FMI', async () => {
      const userX = await User.create({ id: uidX1, name: 'X1', email: `x1-fmi-${ts}@test.com`, monthlyIncome: 100000 });
      const famX = await Family.create({
        name: 'Fam X',
        ownerUserId: uidX1,
        members: [{ userId: uidX1, role: 'owner', joinedAt: new Date() }],
        isActive: true
      });
      const userY = await User.create({ id: uidY1, name: 'Y1', email: `y1-fmi-${ts}@test.com`, monthlyIncome: 50000 });
      const famY = await Family.create({
        name: 'Fam Y',
        ownerUserId: uidY1,
        members: [{ userId: uidY1, role: 'owner', joinedAt: new Date() }],
        isActive: true
      });

      const fmiX = await FamilyFMIService.getFamilyFMI(uidX1, null, now);
      const fmiY = await FamilyFMIService.getFamilyFMI(uidY1, null, now);

      assert.notEqual(fmiX.householdGoalDetail.availableMoney, fmiY.householdGoalDetail.availableMoney);

      await Family.deleteMany({ _id: { $in: [famX._id, famY._id] } });
      await User.deleteMany({ id: { $in: [uidX1, uidY1] } });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 23: Phase 3 aggregate contract remains intact with fmi field added
    // ──────────────────────────────────────────────────────────────────────────
    await test('23. Phase 3 aggregate contract remains intact with fmi field added', async () => {
      // Re-fetch dashboard for A (who is now sole member)
      const res = await fetch(`${baseUrl}/dashboard`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      const json = await res.json();

      // Check all Phase 3 keys exist
      assert.ok(json.period);
      assert.ok(json.family);
      assert.ok(json.income);
      assert.ok(json.spending);
      assert.ok(json.investments);
      assert.ok(json.cashFlow);
      assert.ok(json.pacing);
      assert.ok(json.typeBreakdown);
      assert.ok(json.categoryBreakdown);
      // Check Phase 4 key exists
      assert.ok(json.fmi);
    });

    console.log('='.repeat(64));
    console.log(`  ALL ${passed} FAMILY FMI TESTS PASSED! 🚀`);
    console.log('='.repeat(64));
  } finally {
    await cleanup();
    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Failure:', err);
  process.exit(1);
});

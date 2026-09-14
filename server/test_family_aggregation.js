/**
 * server/test_family_aggregation.js
 *
 * Comprehensive test suite for FINAURA Family System Phase 3 Household Financial Aggregation:
 *  1. unauthenticated dashboard rejected (401)
 *  2. no-family behavior ({ success: true, family: null, dashboard: null })
 *  3. exact household fixture totals (Section 26 canonical fixture)
 *  4. per-member income fallback
 *  5. all members actual income available
 *  6. declared-only income
 *  7. zero-income safe math
 *  8. Need aggregation
 *  9. Want aggregation
 * 10. Investment aggregation
 * 11. Type authority over Category
 * 12. category breakdown
 * 13. legacy category normalization
 * 14. zero transaction behavior
 * 15. category percentages
 * 16. type percentages
 * 17. predicted monthly non-investment spending
 * 18. liability-generated tx counted once
 * 19. no raw financial data in payload
 * 20. cross-family isolation
 * 21. member leave changes future aggregation
 * 22. member removal changes future aggregation
 * 23. individual data unchanged after dashboard request
 */

import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import routes from './routes/index.js';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Family from './models/Family.js';
import FamilyInvitation from './models/FamilyInvitation.js';
import Transaction from './models/Transaction.js';
import Income from './models/Income.js';
import * as FamilyService from './services/FamilyService.js';
import * as FamilyAggregationService from './services/FamilyAggregationService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'finaura_jwt_s3cr3t_k3y_2026_xK9mP2qL7wN4';

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
  console.log('  FINAURA FAMILY SYSTEM PHASE 3 AGGREGATION TEST SUITE');
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
  const uidA = `u-agg-a-${ts}`;
  const uidB = `u-agg-b-${ts}`;
  const uidC = `u-agg-c-${ts}`;
  const uidX1 = `u-agg-x1-${ts}`;
  const uidX2 = `u-agg-x2-${ts}`;
  const uidY1 = `u-agg-y1-${ts}`;
  const uidY2 = `u-agg-y2-${ts}`;
  const uidNoFam = `u-agg-nofam-${ts}`;

  const allTestUserIds = [uidA, uidB, uidC, uidX1, uidX2, uidY1, uidY2, uidNoFam];

  const cleanup = async () => {
    await User.deleteMany({ id: { $in: allTestUserIds } });
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

    // Setup base test users
    const users = {
      A: await User.create({
        id: uidA,
        name: 'Alice Aggregate',
        email: `alice-${ts}@test.com`,
        monthlyIncome: 80000,
        income: 80000,
        currentBalance: 50000
      }),
      B: await User.create({
        id: uidB,
        name: 'Bob Aggregate',
        email: `bob-${ts}@test.com`,
        monthlyIncome: 50000,
        income: 50000,
        currentBalance: 30000
      }),
      C: await User.create({
        id: uidC,
        name: 'Charlie Aggregate',
        email: `charlie-${ts}@test.com`,
        monthlyIncome: 40000,
        income: 40000,
        currentBalance: 20000
      }),
      NoFam: await User.create({
        id: uidNoFam,
        name: 'Solo User',
        email: `solo-${ts}@test.com`,
        monthlyIncome: 60000,
        income: 60000
      })
    };

    const tokenA = generateTestToken(users.A);
    const tokenB = generateTestToken(users.B);
    const tokenC = generateTestToken(users.C);
    const tokenNoFam = generateTestToken(users.NoFam);

    // Current month timestamps
    const now = new Date();
    const period = FamilyAggregationService.getMonthPeriod(now);
    const currentMonthMid = new Date(period.year, period.month - 1, 15, 12, 0, 0);

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 1: Unauthenticated dashboard rejected (401)
    // ──────────────────────────────────────────────────────────────────────────
    await test('1. unauthenticated dashboard rejected (401)', async () => {
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
        headers: { Authorization: `Bearer ${tokenNoFam}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.family, null);
      assert.strictEqual(json.dashboard, null);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // SETUP CANONICAL FIXTURE (Section 26)
    // ──────────────────────────────────────────────────────────────────────────
    // Family A + B
    const familyAB = await Family.create({
      name: 'Alpha Household',
      ownerUserId: uidA,
      members: [
        { userId: uidA, role: 'owner', joinedAt: new Date() },
        { userId: uidB, role: 'member', joinedAt: new Date() }
      ],
      isActive: true
    });

    // Member A:
    // Declared: 80,000
    // Actual: 80,000
    await Income.create({
      id: `inc-a1-${ts}`,
      userId: uidA,
      amount: 80000,
      timestamp: currentMonthMid
    });

    // Member A Transactions:
    // Need: 25,000
    // Want: 15,000
    // Investment: 20,000
    await Transaction.create([
      {
        id: `tx-a-need-${ts}`,
        userId: uidA,
        amount: 25000,
        type: 'Need',
        category: 'Housing',
        timestamp: currentMonthMid
      },
      {
        id: `tx-a-want-${ts}`,
        userId: uidA,
        amount: 15000,
        type: 'Want',
        category: 'Shopping',
        timestamp: currentMonthMid
      },
      {
        id: `tx-a-inv-${ts}`,
        userId: uidA,
        amount: 20000,
        type: 'Investment',
        category: 'Investments',
        timestamp: currentMonthMid
      }
    ]);

    // Member B:
    // Declared: 50,000
    // Actual: NONE
    // Transactions:
    // Need: 20,000
    // Want: 10,000
    // Investment: 15,000
    await Transaction.create([
      {
        id: `tx-b-need-${ts}`,
        userId: uidB,
        amount: 20000,
        type: 'Need',
        category: 'Groceries',
        timestamp: currentMonthMid
      },
      {
        id: `tx-b-want-${ts}`,
        userId: uidB,
        amount: 10000,
        type: 'Want',
        category: 'Entertainment',
        timestamp: currentMonthMid
      },
      {
        id: `tx-b-inv-${ts}`,
        userId: uidB,
        amount: 15000,
        type: 'Investment',
        category: 'Investments',
        timestamp: currentMonthMid
      }
    ]);

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 3: Exact household fixture totals (Section 26 canonical fixture)
    // ──────────────────────────────────────────────────────────────────────────
    let dashboardData;
    await test('3. exact household fixture totals (Section 26 canonical fixture)', async () => {
      const res = await fetch(`${baseUrl}/dashboard`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert.strictEqual(res.status, 200);
      dashboardData = await res.json();

      assert.strictEqual(dashboardData.success, true);
      assert.strictEqual(dashboardData.income.declaredMonthlyIncome, 130000);
      assert.strictEqual(dashboardData.income.actualIncomeThisMonth, 80000);
      assert.strictEqual(dashboardData.income.effectiveMonthlyIncome, 130000);

      assert.strictEqual(dashboardData.spending.need, 45000);
      assert.strictEqual(dashboardData.spending.want, 25000);
      assert.strictEqual(dashboardData.spending.totalNonInvestment, 70000);

      assert.strictEqual(dashboardData.investments.monthlyFlow, 35000);
      assert.strictEqual(dashboardData.cashFlow.totalOutflow, 105000);

      // Expected investment rate = 35,000 / 130,000 = 26.9230769...%
      assert.ok(
        Math.abs(dashboardData.investments.investmentRatePercent - 26.923) < 0.01,
        `Expected ~26.923, got ${dashboardData.investments.investmentRatePercent}`
      );

      // Expected net cash position = 130,000 - 105,000 = 25,000
      assert.strictEqual(dashboardData.cashFlow.netCashPosition, 25000);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 4: Per-member income fallback
    // ──────────────────────────────────────────────────────────────────────────
    await test('4. per-member income fallback isolates non-logging members correctly', async () => {
      // Member A actual (80k) used; Member B declared (50k) used -> sum is 130k, NOT 80k
      assert.strictEqual(dashboardData.income.effectiveMonthlyIncome, 130000);
      assert.strictEqual(dashboardData.income.actualIncomeThisMonth, 80000);
      assert.notEqual(dashboardData.income.effectiveMonthlyIncome, dashboardData.income.actualIncomeThisMonth);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5: All members actual income available
    // ──────────────────────────────────────────────────────────────────────────
    await test('5. all members actual income available', async () => {
      // Add actual income for B
      const incB = await Income.create({
        id: `inc-b-act-${ts}`,
        userId: uidB,
        amount: 60000,
        timestamp: currentMonthMid
      });

      const summary = await FamilyAggregationService.getHouseholdSummary(uidA, now);
      assert.strictEqual(summary.income.actualIncomeThisMonth, 140000); // 80k + 60k
      assert.strictEqual(summary.income.effectiveMonthlyIncome, 140000);

      // Remove the added income record to restore canonical state
      await Income.deleteOne({ _id: incB._id });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 6: Declared-only income
    // ──────────────────────────────────────────────────────────────────────────
    await test('6. declared-only income when zero actual records logged', async () => {
      // Temporarily remove A's actual income
      await Income.deleteMany({ userId: uidA });

      const summary = await FamilyAggregationService.getHouseholdSummary(uidA, now);
      assert.strictEqual(summary.income.actualIncomeThisMonth, 0);
      assert.strictEqual(summary.income.declaredMonthlyIncome, 130000);
      assert.strictEqual(summary.income.effectiveMonthlyIncome, 130000);

      // Restore A's income
      await Income.create({
        id: `inc-a1-restored-${ts}`,
        userId: uidA,
        amount: 80000,
        timestamp: currentMonthMid
      });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 7: Zero-income safe math
    // ──────────────────────────────────────────────────────────────────────────
    await test('7. zero-income safe math prevents NaN and Infinity', async () => {
      // Create family where members have zero income
      const zeroFam = await Family.create({
        name: 'Zero Fam',
        ownerUserId: `u-zero-1-${ts}`,
        members: [
          { userId: `u-zero-1-${ts}`, role: 'owner', joinedAt: new Date() }
        ],
        isActive: true
      });
      await User.create({
        id: `u-zero-1-${ts}`,
        name: 'Zero User',
        email: `zero-${ts}@test.com`,
        monthlyIncome: 0,
        income: 0
      });

      const summary = await FamilyAggregationService.getHouseholdSummary(`u-zero-1-${ts}`, now);
      assert.strictEqual(summary.income.effectiveMonthlyIncome, 0);
      assert.strictEqual(summary.investments.investmentRate, 0);
      assert.strictEqual(summary.investments.investmentRatePercent, 0);
      assert.ok(!Number.isNaN(summary.investments.investmentRate));
      assert.ok(!Number.isNaN(summary.investments.investmentRatePercent));

      // Cleanup
      await Family.deleteOne({ _id: zeroFam._id });
      await User.deleteOne({ id: `u-zero-1-${ts}` });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 8: Need aggregation
    // ──────────────────────────────────────────────────────────────────────────
    await test('8. Need aggregation sums all member Need transactions', async () => {
      // A (25k) + B (20k) = 45k
      assert.strictEqual(dashboardData.spending.need, 45000);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 9: Want aggregation
    // ──────────────────────────────────────────────────────────────────────────
    await test('9. Want aggregation sums all member Want transactions', async () => {
      // A (15k) + B (10k) = 25k
      assert.strictEqual(dashboardData.spending.want, 25000);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 10: Investment aggregation
    // ──────────────────────────────────────────────────────────────────────────
    await test('10. Investment aggregation sums all member Investment transactions', async () => {
      // A (20k) + B (15k) = 35k
      assert.strictEqual(dashboardData.investments.monthlyFlow, 35000);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 11: Type authority over Category
    // ──────────────────────────────────────────────────────────────────────────
    await test('11. Type authority over Category (Category=Investments, Type=Want & Category=Misc, Type=Investment)', async () => {
      // Add transaction: Category = Investments, Type = Want
      const txWant = await Transaction.create({
        id: `tx-type-want-${ts}`,
        userId: uidA,
        amount: 5000,
        type: 'Want',
        category: 'Investments',
        timestamp: currentMonthMid
      });

      // Add transaction: Category = Misc, Type = Investment
      const txInv = await Transaction.create({
        id: `tx-type-inv-${ts}`,
        userId: uidB,
        amount: 8000,
        type: 'Investment',
        category: 'Misc',
        timestamp: currentMonthMid
      });

      const summary = await FamilyAggregationService.getHouseholdSummary(uidA, now);

      // Want increased by 5000 (25k + 5k = 30k)
      assert.strictEqual(summary.spending.want, 30000);

      // Investment increased by 8000 (35k + 8k = 43k)
      assert.strictEqual(summary.investments.monthlyFlow, 43000);

      // Need remained 45000
      assert.strictEqual(summary.spending.need, 45000);

      // Clean up the two test transactions
      await Transaction.deleteOne({ _id: txWant._id });
      await Transaction.deleteOne({ _id: txInv._id });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 12: Category breakdown
    // ──────────────────────────────────────────────────────────────────────────
    await test('12. category breakdown sorts descending by amount', async () => {
      const summary = await FamilyAggregationService.getHouseholdSummary(uidA, now);
      const categories = summary.categoryBreakdown;
      assert.ok(Array.isArray(categories));
      assert.ok(categories.length > 0);

      for (let i = 1; i < categories.length; i++) {
        assert.ok(
          categories[i - 1].amount >= categories[i].amount,
          `Expected descending order: ${categories[i - 1].amount} >= ${categories[i].amount}`
        );
      }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 13: Legacy category normalization
    // ──────────────────────────────────────────────────────────────────────────
    await test('13. legacy category normalization collapses into canonical V3 buckets', async () => {
      // Create transactions with legacy categories:
      // 'Food' -> 'Food & Dining'
      // 'Food & Dining' -> 'Food & Dining'
      const txLegacyFood = await Transaction.create({
        id: `tx-leg-food-${ts}`,
        userId: uidA,
        amount: 3000,
        type: 'Want',
        category: 'Food',
        timestamp: currentMonthMid
      });
      const txV3Food = await Transaction.create({
        id: `tx-v3-food-${ts}`,
        userId: uidB,
        amount: 2000,
        type: 'Want',
        category: 'Food & Dining',
        timestamp: currentMonthMid
      });

      const summary = await FamilyAggregationService.getHouseholdSummary(uidA, now);
      const foodBucket = summary.categoryBreakdown.find((c) => c.category === 'Food & Dining');
      const legacyBucket = summary.categoryBreakdown.find((c) => c.category === 'Food');

      assert.strictEqual(legacyBucket, undefined, 'Legacy "Food" bucket should not exist separately');
      assert.ok(foodBucket, '"Food & Dining" bucket must exist');
      assert.strictEqual(foodBucket.amount, 5000, 'Food (3000) and Food & Dining (2000) must collapse to 5000');

      await Transaction.deleteOne({ _id: txLegacyFood._id });
      await Transaction.deleteOne({ _id: txV3Food._id });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 14: Zero transaction behavior
    // ──────────────────────────────────────────────────────────────────────────
    await test('14. zero transaction behavior returns stable zero values', async () => {
      const emptyFam = await Family.create({
        name: 'Empty Household',
        ownerUserId: `u-empty-${ts}`,
        members: [{ userId: `u-empty-${ts}`, role: 'owner', joinedAt: new Date() }],
        isActive: true
      });
      await User.create({
        id: `u-empty-${ts}`,
        name: 'Empty Member',
        email: `empty-${ts}@test.com`,
        monthlyIncome: 50000,
        income: 50000
      });

      const summary = await FamilyAggregationService.getHouseholdSummary(`u-empty-${ts}`, now);
      assert.strictEqual(summary.spending.need, 0);
      assert.strictEqual(summary.spending.want, 0);
      assert.strictEqual(summary.spending.totalNonInvestment, 0);
      assert.strictEqual(summary.investments.monthlyFlow, 0);
      assert.strictEqual(summary.cashFlow.totalOutflow, 0);
      assert.strictEqual(summary.pacing.avgDailyNonInvestmentSpend, 0);
      assert.strictEqual(summary.pacing.predictedMonthlyNonInvestmentSpend, 0);
      assert.strictEqual(summary.typeBreakdown.need.percentageOfOutflow, 0);
      assert.strictEqual(summary.categoryBreakdown.length, 0);

      await Family.deleteOne({ _id: emptyFam._id });
      await User.deleteOne({ id: `u-empty-${ts}` });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 15: Category percentages
    // ──────────────────────────────────────────────────────────────────────────
    await test('15. category percentages compute safely against total outflow', async () => {
      const summary = await FamilyAggregationService.getHouseholdSummary(uidA, now);
      const totalOutflow = summary.cashFlow.totalOutflow;

      for (const item of summary.categoryBreakdown) {
        const expectedPct = Number(((item.amount / totalOutflow) * 100).toFixed(1));
        assert.strictEqual(item.percentageOfOutflow, expectedPct);
      }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 16: Type percentages
    // ──────────────────────────────────────────────────────────────────────────
    await test('16. type percentages sum to ~100% of total outflow', async () => {
      const summary = await FamilyAggregationService.getHouseholdSummary(uidA, now);
      const { need, want, investment } = summary.typeBreakdown;
      const sum = need.percentageOfOutflow + want.percentageOfOutflow + investment.percentageOfOutflow;
      assert.ok(Math.abs(sum - 100) <= 0.5, `Type percentages should sum to ~100%, got ${sum}`);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 17: Predicted monthly non-investment spending (Budget Pacing)
    // ──────────────────────────────────────────────────────────────────────────
    await test('17. predicted monthly non-investment spending calculates pacing without NaN', async () => {
      const summary = await FamilyAggregationService.getHouseholdSummary(uidA, now);
      const { daysPassed, daysInMonth, avgDailyNonInvestmentSpend, predictedMonthlyNonInvestmentSpend } = summary.pacing;

      assert.ok(daysPassed > 0);
      assert.ok(daysInMonth >= 28 && daysInMonth <= 31);
      assert.strictEqual(
        avgDailyNonInvestmentSpend,
        Number((summary.spending.totalNonInvestment / daysPassed).toFixed(2))
      );
      assert.strictEqual(
        predictedMonthlyNonInvestmentSpend,
        Number((avgDailyNonInvestmentSpend * daysInMonth).toFixed(2))
      );
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 18: Liability-generated transaction counted once
    // ──────────────────────────────────────────────────────────────────────────
    await test('18. liability-generated tx counted once as regular Need transaction', async () => {
      const txLiability = await Transaction.create({
        id: `tx-liab-${ts}`,
        userId: uidA,
        amount: 7500,
        type: 'Need',
        category: 'Debt & Loan Payments',
        classificationSource: 'liability',
        liabilityId: 'L-home-loan',
        timestamp: currentMonthMid
      });

      const summary = await FamilyAggregationService.getHouseholdSummary(uidA, now);
      // Need was 45,000 + 7500 = 52,500
      assert.strictEqual(summary.spending.need, 52500);

      // Verify category Breakdown includes Debt & Loan Payments with 7500
      const debtCat = summary.categoryBreakdown.find((c) => c.category === 'Debt & Loan Payments');
      assert.ok(debtCat);
      assert.strictEqual(debtCat.amount, 7500);

      await Transaction.deleteOne({ _id: txLiability._id });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 19: Strict privacy audit (No raw financial data in payload)
    // ──────────────────────────────────────────────────────────────────────────
    await test('19. no raw financial data or member-attribution in API payload', async () => {
      const res = await fetch(`${baseUrl}/dashboard`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      const json = await res.json();

      // Ensure no raw collections leaked
      assert.strictEqual(json.transactions, undefined);
      assert.strictEqual(json.incomes, undefined);
      assert.strictEqual(json.assets, undefined);
      assert.strictEqual(json.liabilities, undefined);
      assert.strictEqual(json.currentBalance, undefined);

      // Ensure member list in family contains ONLY non-financial public roster fields
      for (const m of json.family.members) {
        assert.ok(m.userId);
        assert.ok(m.name);
        assert.ok(m.role);
        assert.ok(m.joinedAt);
        assert.strictEqual(m.income, undefined);
        assert.strictEqual(m.monthlyIncome, undefined);
        assert.strictEqual(m.spent, undefined);
        assert.strictEqual(m.spending, undefined);
        assert.strictEqual(m.currentBalance, undefined);
      }

      // Check serialized string contains no transaction IDs or private descriptions
      const serialized = JSON.stringify(json);
      assert.ok(!serialized.includes(`tx-a-need-${ts}`));
      assert.ok(!serialized.includes(`inc-a1-${ts}`));
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 20: Cross-family isolation
    // ──────────────────────────────────────────────────────────────────────────
    await test('20. cross-family isolation: Family X cannot aggregate Family Y data', async () => {
      // Setup Family X (X1, X2)
      const userX1 = await User.create({ id: uidX1, name: 'X1', email: `x1-${ts}@test.com`, monthlyIncome: 100000 });
      const userX2 = await User.create({ id: uidX2, name: 'X2', email: `x2-${ts}@test.com`, monthlyIncome: 80000 });
      const famX = await Family.create({
        name: 'Family X',
        ownerUserId: uidX1,
        members: [
          { userId: uidX1, role: 'owner', joinedAt: new Date() },
          { userId: uidX2, role: 'member', joinedAt: new Date() }
        ],
        isActive: true
      });
      await Transaction.create({
        id: `tx-x1-${ts}`,
        userId: uidX1,
        amount: 33000,
        type: 'Need',
        category: 'Housing',
        timestamp: currentMonthMid
      });

      // Setup Family Y (Y1, Y2)
      const userY1 = await User.create({ id: uidY1, name: 'Y1', email: `y1-${ts}@test.com`, monthlyIncome: 50000 });
      const userY2 = await User.create({ id: uidY2, name: 'Y2', email: `y2-${ts}@test.com`, monthlyIncome: 40000 });
      const famY = await Family.create({
        name: 'Family Y',
        ownerUserId: uidY1,
        members: [
          { userId: uidY1, role: 'owner', joinedAt: new Date() },
          { userId: uidY2, role: 'member', joinedAt: new Date() }
        ],
        isActive: true
      });
      await Transaction.create({
        id: `tx-y1-${ts}`,
        userId: uidY1,
        amount: 99000,
        type: 'Need',
        category: 'Housing',
        timestamp: currentMonthMid
      });

      const tokenX1 = generateTestToken(userX1);
      const res = await fetch(`${baseUrl}/dashboard`, {
        headers: { Authorization: `Bearer ${tokenX1}` }
      });
      const jsonX = await res.json();

      assert.strictEqual(jsonX.family.id, famX._id.toString());
      assert.strictEqual(jsonX.spending.need, 33000); // Excludes Y's 99000
      assert.strictEqual(jsonX.income.declaredMonthlyIncome, 180000); // 100k + 80k

      // Cleanup
      await Family.deleteMany({ _id: { $in: [famX._id, famY._id] } });
      await User.deleteMany({ id: { $in: [uidX1, uidX2, uidY1, uidY2] } });
      await Transaction.deleteMany({ id: { $in: [`tx-x1-${ts}`, `tx-y1-${ts}`] } });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 21: Member leave changes future aggregation
    // ──────────────────────────────────────────────────────────────────────────
    await test('21. member leave changes subsequent household aggregation', async () => {
      // Member B leaves Family A+B
      await FamilyService.leaveFamily(uidB);

      const summary = await FamilyAggregationService.getHouseholdSummary(uidA, now);

      // Now only Member A remains
      assert.strictEqual(summary.family.memberCount, 1);
      assert.strictEqual(summary.spending.need, 25000); // B's 20,000 excluded
      assert.strictEqual(summary.spending.want, 15000); // B's 10,000 excluded
      assert.strictEqual(summary.investments.monthlyFlow, 20000); // B's 15,000 excluded
      assert.strictEqual(summary.income.declaredMonthlyIncome, 80000); // B's 50,000 excluded
      assert.strictEqual(summary.income.effectiveMonthlyIncome, 80000);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 22: Member removal changes future aggregation
    // ──────────────────────────────────────────────────────────────────────────
    await test('22. member removal changes subsequent household aggregation', async () => {
      // Re-add Charlie to Family A
      await Family.updateOne(
        { _id: familyAB._id },
        { $push: { members: { userId: uidC, role: 'member', joinedAt: new Date() } } }
      );
      await Transaction.create({
        id: `tx-c-need-${ts}`,
        userId: uidC,
        amount: 12000,
        type: 'Need',
        category: 'Health',
        timestamp: currentMonthMid
      });

      let summary = await FamilyAggregationService.getHouseholdSummary(uidA, now);
      assert.strictEqual(summary.spending.need, 37000); // A (25k) + C (12k)

      // Owner A removes Charlie
      await FamilyService.removeFamilyMember(uidA, uidC);

      summary = await FamilyAggregationService.getHouseholdSummary(uidA, now);
      assert.strictEqual(summary.spending.need, 25000); // C's 12k excluded
      assert.strictEqual(summary.family.memberCount, 1);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 23: Individual data unchanged after dashboard request
    // ──────────────────────────────────────────────────────────────────────────
    await test('23. individual data unchanged after dashboard request (read-only invariance)', async () => {
      const txCountBefore = await Transaction.countDocuments({ userId: uidA });
      const incCountBefore = await Income.countDocuments({ userId: uidA });
      const userBefore = await User.findOne({ id: uidA }).lean();

      // Call dashboard multiple times
      await fetch(`${baseUrl}/dashboard`, { headers: { Authorization: `Bearer ${tokenA}` } });
      await fetch(`${baseUrl}/dashboard`, { headers: { Authorization: `Bearer ${tokenA}` } });

      const txCountAfter = await Transaction.countDocuments({ userId: uidA });
      const incCountAfter = await Income.countDocuments({ userId: uidA });
      const userAfter = await User.findOne({ id: uidA }).lean();

      assert.strictEqual(txCountBefore, txCountAfter, 'Transaction count must not change');
      assert.strictEqual(incCountBefore, incCountAfter, 'Income count must not change');
      assert.strictEqual(userBefore.currentBalance, userAfter.currentBalance, 'User balance must not change');
      assert.strictEqual(userBefore.monthlyIncome, userAfter.monthlyIncome, 'User income must not change');
    });

    console.log('='.repeat(64));
    console.log(`  ALL ${passed} FAMILY AGGREGATION TESTS PASSED! 🚀`);
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

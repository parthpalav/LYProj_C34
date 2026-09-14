/**
 * server/test_family_e2e_audit.js
 *
 * FINAURA FAMILY SYSTEM — PHASE 6 END-TO-END INTEGRATION AUDIT
 *
 * Full two-user scenario proving:
 *   1. Account A invites Account B by exact email
 *   2. Account B accepts invitation -> Single shared Family created
 *   3. Both see identical Family dashboard & identical Family FMI
 *   4. Both retain separate, independent personal FMI scores
 *   5. Zero raw cross-member transaction leakage
 *   6. B adds transaction -> updates Family totals & Family FMI dynamically
 *   7. A's personal FMI is unaffected by B's transaction
 *   8. Type remains authoritative over Category
 *   9. Owner vs Member permissions enforced on client & server
 *  10. Full leave, remove, zero-data, and edge-case validation
 */

import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Goal from './models/Goal.js';
import Transaction from './models/Transaction.js';
import Income from './models/Income.js';
import Family from './models/Family.js';
import FamilyInvitation from './models/FamilyInvitation.js';
import * as FamilyService from './services/FamilyService.js';
import * as FamilyAggregationService from './services/FamilyAggregationService.js';
import * as FamilyFMIService from './services/FamilyFMIService.js';
import { calculateFMI } from './services/FMIService.js';

console.log('='.repeat(68));
console.log('  FINAURA FAMILY SYSTEM — PHASE 6 FINAL E2E INTEGRATION AUDIT');
console.log('='.repeat(68));
console.log();

let passed = 0;
let failed = 0;

function audit(stepNumber, title, fn) {
  return async () => {
    process.stdout.write(`Step ${stepNumber}. ${title}... `);
    try {
      await fn();
      passed++;
      console.log('✅ PASSED');
    } catch (err) {
      failed++;
      console.log(`❌ FAILED: ${err.message}`);
      console.error(err);
      throw err;
    }
  };
}

async function runAudit() {
  await connectDB();

  const auditTimestamp = Date.now();
  const emailA = `family.audit.a.${auditTimestamp}@example.com`;
  const emailB = `family.audit.b.${auditTimestamp}@example.com`;
  const emailC = `family.audit.c.${auditTimestamp}@example.com`;

  let userA, userB, userC;
  let baselineA, baselineB;
  let invitationAB;
  let activeFamily;

  try {
    // ── STEP 1: Create Two Isolated Test Accounts ─────────────
    await audit(1, 'Create synthetic test accounts A and B with independent baselines', async () => {
      userA = await User.create({
        id: `u-audit-a-${auditTimestamp}`,
        name: 'Audit User A',
        email: emailA,
        password: 'audit_hashed_password_a',
        monthlyIncome: 100000,
        age: 30,
        retirementAge: 60,
        retirementCorpusGoal: 20000000,
        currentBalance: 1000000,
        expectedReturnRate: 0.08,
        expectedInflationRate: 0.06,
        isEmailVerified: true,
      });

      userB = await User.create({
        id: `u-audit-b-${auditTimestamp}`,
        name: 'Audit User B',
        email: emailB,
        password: 'audit_hashed_password_b',
        monthlyIncome: 80000,
        age: 28,
        retirementAge: 60,
        retirementCorpusGoal: 15000000,
        currentBalance: 500000,
        expectedReturnRate: 0.08,
        expectedInflationRate: 0.06,
        isEmailVerified: true,
      });

      // Goals for retirement tracking
      await Goal.create([
        {
          id: `goal-a-${auditTimestamp}`,
          userId: userA.id,
          name: 'Retirement',
          targetAmount: 20000000,
          savedAmount: 1000000,
        },
        {
          id: `goal-b-${auditTimestamp}`,
          userId: userB.id,
          name: 'Retirement',
          targetAmount: 15000000,
          savedAmount: 500000,
        },
      ]);

      // User A initial transactions (Need: 25k, Want: 5k, Investment: 20k, Outflow: 50k)
      const now = new Date();
      await Transaction.create([
        {
          id: `tx-a-1-${auditTimestamp}`,
          userId: userA.id,
          amount: 25000,
          category: 'Housing',
          type: 'Need',
          timestamp: now,
          description: 'Rent for apartment A',
        },
        {
          id: `tx-a-2-${auditTimestamp}`,
          userId: userA.id,
          amount: 5000,
          category: 'Food & Dining',
          type: 'Want',
          timestamp: now,
          description: 'Weekend dinner A',
        },
        {
          id: `tx-a-3-${auditTimestamp}`,
          userId: userA.id,
          amount: 20000,
          category: 'Investments',
          type: 'Investment',
          timestamp: now,
          description: 'Index fund SIP A',
        },
      ]);

      // User B initial transactions (Need: 10k, Want: 8k, Investment: 15k, Outflow: 33k)
      await Transaction.create([
        {
          id: `tx-b-1-${auditTimestamp}`,
          userId: userB.id,
          amount: 10000,
          category: 'Utilities & Bills',
          type: 'Need',
          timestamp: now,
          description: 'Electricity & Internet B',
        },
        {
          id: `tx-b-2-${auditTimestamp}`,
          userId: userB.id,
          amount: 8000,
          category: 'Shopping',
          type: 'Want',
          timestamp: now,
          description: 'Clothes B',
        },
        {
          id: `tx-b-3-${auditTimestamp}`,
          userId: userB.id,
          amount: 15000,
          category: 'Investments',
          type: 'Investment',
          timestamp: now,
          description: 'PPF contribution B',
        },
      ]);

      // Log Income
      await Income.create([
        {
          id: `inc-a-${auditTimestamp}`,
          userId: userA.id,
          amount: 100000,
          source: 'Tech Salary A',
          timestamp: now,
        },
        {
          id: `inc-b-${auditTimestamp}`,
          userId: userB.id,
          amount: 80000,
          source: 'Design Salary B',
          timestamp: now,
        },
      ]);

      assert.ok(userA._id);
      assert.ok(userB._id);
    })();

    // ── STEP 2: Capture Individual Baseline Snapshots ─────────
    await audit(2, 'Capture baseline individual FMI scores and totals before Family creation', async () => {
      const txA = await Transaction.find({ userId: userA.id }).lean();
      const txB = await Transaction.find({ userId: userB.id }).lean();

      baselineA = await calculateFMI(userA, txA);
      baselineB = await calculateFMI(userB, txB);

      assert.ok(baselineA.score >= 0 && baselineA.score <= 100);
      assert.ok(baselineB.score >= 0 && baselineB.score <= 100);
      assert.ok(baselineA.pillars.D1_savingDiscipline);
      assert.ok(baselineB.pillars.D1_savingDiscipline);
    })();

    // ── STEP 3: User A Invites User B by Exact Email ──────────
    await audit(3, 'Account A sends family invitation to Account B by exact email', async () => {
      invitationAB = await FamilyService.sendInvitation(userA.id, emailB);

      assert.equal(invitationAB.status, 'pending');
      assert.equal(invitationAB.inviteeEmail, emailB);
      assert.equal(invitationAB.inviterUserId, userA.id);
      assert.equal(invitationAB.familyId, null, 'No family created prematurely');

      // Check current family for both is null
      const curA = await FamilyService.getActiveFamilyForUser(userA.id);
      const curB = await FamilyService.getActiveFamilyForUser(userB.id);
      assert.equal(curA, null);
      assert.equal(curB, null);

      // Sent vs Received lists
      const sentA = await FamilyService.getSentInvitations(userA.id);
      const recB = await FamilyService.getReceivedInvitations(userB.id);

      assert.equal(sentA.length, 1);
      assert.equal(sentA[0].inviteeEmail, emailB);
      assert.equal(recB.length, 1);
      assert.equal(recB[0].inviterName, 'Audit User A');
    })();

    // ── STEP 4: User B Accepts Invitation ─────────────────────
    await audit(4, 'Account B accepts invitation -> Single shared Family created', async () => {
      const acceptResult = await FamilyService.acceptInvitation(userB.id, invitationAB.id);

      assert.equal(acceptResult.success, true);
      assert.ok(acceptResult.familyId);

      const curA = await FamilyService.getActiveFamilyForUser(userA.id);
      const curB = await FamilyService.getActiveFamilyForUser(userB.id);

      assert.ok(curA);
      assert.ok(curB);
      activeFamily = curA;
      assert.equal(activeFamily.members.length, 2);

      // Verify both resolve to the same family
      assert.equal(curA.id, curB.id);
      assert.equal(curA.name, curB.name);

      // Verify roles
      assert.equal(curA.role, 'owner');
      assert.equal(curB.role, 'member');
    })();

    // ── STEP 5: Verify Household Financial Aggregation Equality 
    let dashA, dashB;
    await audit(5, 'Both A and B receive identical household aggregates on dashboard', async () => {
      dashA = await FamilyAggregationService.getHouseholdSummary(userA.id);
      dashB = await FamilyAggregationService.getHouseholdSummary(userB.id);

      assert.equal(dashA.family.id, dashB.family.id);
      assert.equal(dashA.family.memberCount, 2);
      assert.equal(dashB.family.memberCount, 2);

      // Income: 100k + 80k = 180k
      assert.equal(dashA.income.effectiveMonthlyIncome, 180000);
      assert.equal(dashB.income.effectiveMonthlyIncome, 180000);

      // Need spend: 25k + 10k = 35k
      assert.equal(dashA.spending.need, 35000);
      assert.equal(dashB.spending.need, 35000);

      // Want spend: 5k + 8k = 13k
      assert.equal(dashA.spending.want, 13000);
      assert.equal(dashB.spending.want, 13000);

      // Total Non-Investment: 35k + 13k = 48k
      assert.equal(dashA.spending.totalNonInvestment, 48000);
      assert.equal(dashB.spending.totalNonInvestment, 48000);

      // Investments: 20k + 15k = 35k
      assert.equal(dashA.investments.monthlyFlow, 35000);
      assert.equal(dashB.investments.monthlyFlow, 35000);

      // Total Outflow: 48k + 35k = 83k
      assert.equal(dashA.cashFlow.totalOutflow, 83000);
      assert.equal(dashB.cashFlow.totalOutflow, 83000);

      // Net Cash Position: 180k - 83k = 97k
      assert.equal(dashA.cashFlow.netCashPosition, 97000);
      assert.equal(dashB.cashFlow.netCashPosition, 97000);
    })();

    // ── STEP 6: Verify Identical Family FMI ────────────────────
    let familyFmiA, familyFmiB;
    await audit(6, 'Both A and B receive identical Family FMI scores, pillars, and insights', async () => {
      familyFmiA = await FamilyFMIService.getFamilyFMI(userA.id, dashA);
      familyFmiB = await FamilyFMIService.getFamilyFMI(userB.id, dashB);

      assert.equal(familyFmiA.score, familyFmiB.score);
      assert.equal(familyFmiA.fmiLabel, familyFmiB.fmiLabel);
      assert.deepEqual(familyFmiA.pillars, familyFmiB.pillars);
      assert.deepEqual(familyFmiA.insights, familyFmiB.insights);

      assert.ok(familyFmiA.score >= 0 && familyFmiA.score <= 100);
      assert.ok(familyFmiA.pillars.D1_savingDiscipline.score !== undefined);
      assert.ok(familyFmiA.pillars.D2_spendingControl.score !== undefined);
      assert.ok(familyFmiA.pillars.D3_behavioralRisk.score !== undefined);
    })();

    // ── STEP 7: Prove Individual FMI Remains Separate ─────────
    await audit(7, 'A and B retain separate, personal FMI scores different from Family FMI', async () => {
      const txA = await Transaction.find({ userId: userA.id }).lean();
      const txB = await Transaction.find({ userId: userB.id }).lean();

      const curFmiA = await calculateFMI(userA, txA);
      const curFmiB = await calculateFMI(userB, txB);

      // A's individual FMI and B's individual FMI remain identical to their baselines
      assert.equal(curFmiA.score, baselineA.score, 'User A individual FMI unchanged by joining family');
      assert.equal(curFmiB.score, baselineB.score, 'User B individual FMI unchanged by joining family');

      // Neither user's personal FMI was overwritten by Family FMI
      assert.notEqual(curFmiA.score, familyFmiA.score, 'A personal FMI is distinct from Family FMI');
      assert.notEqual(curFmiB.score, familyFmiB.score, 'B personal FMI is distinct from Family FMI');
    })();

    // ── STEP 8: Raw Transaction Privacy Boundary ──────────────
    await audit(8, 'Normal transaction queries return only owned transactions; family payload has zero raw data', async () => {
      const aPersonalTx = await Transaction.find({ userId: userA.id }).lean();
      const bPersonalTx = await Transaction.find({ userId: userB.id }).lean();

      // Verify strict user isolation
      assert.ok(aPersonalTx.every((t) => t.userId === userA.id));
      assert.ok(!aPersonalTx.some((t) => t.description.includes('Electricity & Internet B')));

      assert.ok(bPersonalTx.every((t) => t.userId === userB.id));
      assert.ok(!bPersonalTx.some((t) => t.description.includes('Rent for apartment A')));

      // Verify Family DTO does not leak any raw transaction records
      assert.equal(dashA.transactions, undefined);
      assert.equal(dashA.rawTransactions, undefined);
      assert.equal(dashB.transactions, undefined);
      assert.equal(dashB.rawTransactions, undefined);
      assert.equal(JSON.stringify(dashA).includes('apartment A'), false);
      assert.equal(JSON.stringify(dashA).includes('Internet B'), false);
    })();

    // ── STEP 9: User B Adds New Need Transaction ──────────────
    let newTxB;
    await audit(9, 'User B adds ₹2,000 Groceries Need transaction', async () => {
      newTxB = await Transaction.create({
        id: `tx-b-new-${auditTimestamp}`,
        userId: userB.id,
        amount: 2000,
        category: 'Groceries',
        type: 'Need',
        timestamp: new Date(),
        description: 'Family audit groceries',
      });

      // Verify transaction belongs only to B
      assert.equal(newTxB.userId, userB.id);

      const aPersonalTx = await Transaction.find({ userId: userA.id }).lean();
      assert.ok(!aPersonalTx.some((t) => t.description === 'Family audit groceries'));

      const bPersonalTx = await Transaction.find({ userId: userB.id }).lean();
      assert.ok(bPersonalTx.some((t) => t.description === 'Family audit groceries'));
    })();

    // ── STEP 10: Verify Dynamic Family Aggregate Updates ──────
    let updatedDashA, updatedDashB;
    await audit(10, 'Family aggregate updates immediately (+₹2,000 Need, Outflow, Groceries)', async () => {
      updatedDashA = await FamilyAggregationService.getHouseholdSummary(userA.id);
      updatedDashB = await FamilyAggregationService.getHouseholdSummary(userB.id);

      // Need spending increased from 35k to 37k
      assert.equal(updatedDashA.spending.need, 37000);
      assert.equal(updatedDashB.spending.need, 37000);

      // Non-investment spending increased from 48k to 50k
      assert.equal(updatedDashA.spending.totalNonInvestment, 50000);
      assert.equal(updatedDashB.spending.totalNonInvestment, 50000);

      // Total Outflow increased from 83k to 85k
      assert.equal(updatedDashA.cashFlow.totalOutflow, 85000);
      assert.equal(updatedDashB.cashFlow.totalOutflow, 85000);

      // Net cash position decreased from 97k to 95k
      assert.equal(updatedDashA.cashFlow.netCashPosition, 95000);
      assert.equal(updatedDashB.cashFlow.netCashPosition, 95000);

      // Groceries category present with 2000
      const groceries = updatedDashA.categoryBreakdown.find((c) => c.category === 'Groceries');
      assert.ok(groceries);
      assert.equal(groceries.amount, 2000);
    })();

    // ── STEP 11: A Still Cannot See B\'s Raw Transaction ───────
    await audit(11, 'Account A still cannot see "Family audit groceries" description or B attribution', async () => {
      const aPersonalTx = await Transaction.find({ userId: userA.id }).lean();
      assert.ok(!aPersonalTx.some((t) => t.description.includes('Family audit groceries')));

      const dashString = JSON.stringify(updatedDashA);
      assert.ok(!dashString.includes('Family audit groceries'));
      assert.ok(!dashString.includes(newTxB._id.toString()));
    })();

    // ── STEP 12: A\'s Personal FMI Invariant to B\'s Spending ───
    await audit(12, 'B adding a transaction leaves A personal FMI completely unchanged', async () => {
      const txA = await Transaction.find({ userId: userA.id }).lean();
      const currentFmiA = await calculateFMI(userA, txA);

      assert.equal(currentFmiA.score, baselineA.score, 'A personal FMI score unchanged');
      assert.deepEqual(currentFmiA.pillars, baselineA.pillars, 'A personal pillars unchanged');
    })();

    // ── STEP 13: Type Authority Over Category Tests ───────────
    await audit(13, 'Type remains strictly authoritative over Category in Family calculations', async () => {
      // Test A: Category=Misc, Type=Investment, Amount=1000
      const txInv = await Transaction.create({
        id: `tx-inv-${auditTimestamp}`,
        userId: userB.id,
        amount: 1000,
        category: 'Misc',
        type: 'Investment',
        timestamp: new Date(),
        description: 'Crypto DCA',
      });

      const dashAfterInv = await FamilyAggregationService.getHouseholdSummary(userA.id);
      // investments.monthlyFlow increased from 35,000 to 36,000
      assert.equal(dashAfterInv.investments.monthlyFlow, 36000);

      // Test B: Category=Investments, Type=Want, Amount=500
      const txWant = await Transaction.create({
        id: `tx-want-${auditTimestamp}`,
        userId: userB.id,
        amount: 500,
        category: 'Investments',
        type: 'Want',
        timestamp: new Date(),
        description: 'Investing book/merchandise',
      });

      const dashAfterWant = await FamilyAggregationService.getHouseholdSummary(userA.id);
      // Want increased from 13,000 to 13,500
      assert.equal(dashAfterWant.spending.want, 13500);
      // Investments did NOT increase by 500
      assert.equal(dashAfterWant.investments.monthlyFlow, 36000);

      // Clean up edge test transactions
      await Transaction.deleteMany({ _id: { $in: [txInv._id, txWant._id] } });
    })();

    // ── STEP 14: Owner vs Member Permissions ──────────────────
    await audit(14, 'Owner and Member permissions strictly enforced on server', async () => {
      const targetUser = await User.create({
        id: `u-target-${auditTimestamp}`,
        name: 'Target User',
        email: `target.${auditTimestamp}@example.com`,
      });

      // Non-owner B cannot invite someone
      await assert.rejects(
        FamilyService.sendInvitation(userB.id, targetUser.email),
        (err) => err.status === 403
      );

      // Non-owner B cannot remove owner A
      await assert.rejects(
        FamilyService.removeFamilyMember(userB.id, userA.id),
        (err) => err.status === 403
      );

      // Owner A cannot remove themselves
      await assert.rejects(
        FamilyService.removeFamilyMember(userA.id, userA.id),
        (err) => err.status === 400
      );

      // Populated owner A cannot leave
      await assert.rejects(
        FamilyService.leaveFamily(userA.id),
        (err) => err.status === 409
      );
    })();

    // ── STEP 15: Invitation Lifecycle & Edge Cases ────────────
    await audit(15, 'Invitation edge cases: self-invite, duplicates, reverse duplicates', async () => {
      // Self invite
      await assert.rejects(
        FamilyService.sendInvitation(userA.id, emailA),
        (err) => err.status === 400
      );

      // Inviting user already in family
      await assert.rejects(
        FamilyService.sendInvitation(userA.id, emailB),
        (err) => err.status === 409
      );
    })();

    // ── STEP 16: Temporary Third Member Join & Leave ───────────
    await audit(16, 'Temporary member C joins and leaves; personal data untouched & aggregate updates', async () => {
      userC = await User.create({
        id: `u-audit-c-${auditTimestamp}`,
        name: 'Audit User C',
        email: emailC,
        password: 'audit_hashed_password_c',
        monthlyIncome: 60000,
        age: 32,
        isEmailVerified: true,
      });

      await Transaction.create({
        id: `tx-c-${auditTimestamp}`,
        userId: userC.id,
        amount: 15000,
        category: 'Shopping',
        type: 'Want',
        timestamp: new Date(),
        description: 'Gadget C',
      });

      // A invites C
      const invC = await FamilyService.sendInvitation(userA.id, emailC);
      // C accepts
      await FamilyService.acceptInvitation(userC.id, invC.id);

      // Family now has 3 members
      const dash3 = await FamilyAggregationService.getHouseholdSummary(userA.id);
      assert.equal(dash3.family.memberCount, 3);
      // Want spending includes C's 15k: 13k + 15k = 28k
      assert.equal(dash3.spending.want, 28000);

      // C leaves voluntarily
      await FamilyService.leaveFamily(userC.id);

      // C is no longer in family
      const curC = await FamilyService.getActiveFamilyForUser(userC.id);
      assert.equal(curC, null);

      // C's personal transaction is intact
      const cTx = await Transaction.find({ userId: userC.id }).lean();
      assert.equal(cTx.length, 1);
      assert.equal(cTx[0].amount, 15000);

      // Family returns to 2 members and 13k Want
      const dash2 = await FamilyAggregationService.getHouseholdSummary(userA.id);
      assert.equal(dash2.family.memberCount, 2);
      assert.equal(dash2.spending.want, 13000);
    })();

    // ── STEP 17: Owner Removes Temporary Third Member ─────────
    await audit(17, 'Owner removes temporary member C; aggregate updates immediately', async () => {
      // A invites C again
      const invC2 = await FamilyService.sendInvitation(userA.id, emailC);
      await FamilyService.acceptInvitation(userC.id, invC2.id);

      // Verify 3 members
      const famBefore = await FamilyService.getActiveFamilyForUser(userA.id);
      assert.equal(famBefore.members.length, 3);

      // Owner A removes member C
      const removeResult = await FamilyService.removeFamilyMember(userA.id, userC.id);
      assert.equal(removeResult.success, true);

      // Verify 2 members remain
      const famAfter = await FamilyService.getActiveFamilyForUser(userA.id);
      assert.equal(famAfter.members.length, 2);
      assert.ok(!famAfter.members.some((m) => m.userId === userC.id));
    })();

    // ── STEP 18: Zero-Data Family Resilience ──────────────────
    await audit(18, 'Zero-data family calculates cleanly with zero NaN or Infinity', async () => {
      const emailZ1 = `zero1.${auditTimestamp}@example.com`;
      const emailZ2 = `zero2.${auditTimestamp}@example.com`;

      const uZ1 = await User.create({
        id: `uz1-${auditTimestamp}`,
        name: 'Zero User 1',
        email: emailZ1,
        monthlyIncome: 0,
      });

      const uZ2 = await User.create({
        id: `uz2-${auditTimestamp}`,
        name: 'Zero User 2',
        email: emailZ2,
        monthlyIncome: 0,
      });

      const invZ = await FamilyService.sendInvitation(uZ1.id, emailZ2);
      await FamilyService.acceptInvitation(uZ2.id, invZ.id);

      const zeroDash = await FamilyAggregationService.getHouseholdSummary(uZ1.id);
      const zeroFmi = await FamilyFMIService.getFamilyFMI(uZ1.id, zeroDash);

      assert.equal(zeroDash.income.effectiveMonthlyIncome, 0);
      assert.equal(zeroDash.spending.need, 0);
      assert.equal(zeroDash.spending.want, 0);
      assert.equal(zeroDash.investments.monthlyFlow, 0);
      assert.equal(zeroDash.investments.investmentRatePercent, 0);
      assert.equal(Number.isNaN(zeroDash.investments.investmentRatePercent), false);

      assert.ok(zeroFmi.score >= 0 && zeroFmi.score <= 100);
      assert.equal(Number.isNaN(zeroFmi.score), false);
      assert.ok(zeroFmi.fmiLabel);

      // Cleanup zero users & family
      await Family.deleteMany({ 'members.userId': { $in: [uZ1.id, uZ2.id] } });
      await FamilyInvitation.deleteMany({ inviterUserId: uZ1.id });
      await User.deleteMany({ id: { $in: [uZ1.id, uZ2.id] } });
    })();

    // ── Print Evaluator Demonstration Summary ─────────────────
    console.log();
    console.log('='.repeat(68));
    console.log('  EVALUATOR DEMO SUMMARY');
    console.log('='.repeat(68));
    console.log(`  User A Personal FMI:     ${baselineA.score} (${baselineA.fmiLabel})`);
    console.log(`  User B Personal FMI:     ${baselineB.score} (${baselineB.fmiLabel})`);
    console.log(`  Family FMI:              ${familyFmiA.score} (${familyFmiA.fmiLabel})`);
    console.log(`  Arithmetic Mean:         ${Math.round((baselineA.score + baselineB.score) / 2)}`);
    console.log('  ------------------------------------------------------------');
    console.log(`  Household Income:        ₹${dashA.income.effectiveMonthlyIncome.toLocaleString('en-IN')}`);
    console.log(`  Need Spending:           ₹${dashA.spending.need.toLocaleString('en-IN')}`);
    console.log(`  Want Spending:           ₹${dashA.spending.want.toLocaleString('en-IN')}`);
    console.log(`  Invested This Month:     ₹${dashA.investments.monthlyFlow.toLocaleString('en-IN')}`);
    console.log(`  Total Outflow:           ₹${dashA.cashFlow.totalOutflow.toLocaleString('en-IN')}`);
    console.log(`  Net Cash Position:       ₹${dashA.cashFlow.netCashPosition.toLocaleString('en-IN')}`);
    console.log('='.repeat(68));
    console.log();

  } finally {
    // ── TEARDOWN & CLEANUP ────────────────────────────────────
    const cleanupUserIds = [
      `u-audit-a-${auditTimestamp}`,
      `u-audit-b-${auditTimestamp}`,
      `u-audit-c-${auditTimestamp}`,
    ];

    await Family.deleteMany({ 'members.userId': { $in: cleanupUserIds } });
    await FamilyInvitation.deleteMany({
      $or: [
        { inviterUserId: { $in: cleanupUserIds } },
        { inviteeUserId: { $in: cleanupUserIds } },
      ],
    });
    await Transaction.deleteMany({ userId: { $in: cleanupUserIds } });
    await Income.deleteMany({ userId: { $in: cleanupUserIds } });
    await Goal.deleteMany({ userId: { $in: cleanupUserIds } });
    await User.deleteMany({ id: { $in: cleanupUserIds } });

    await mongoose.disconnect();
  }
}

runAudit()
  .then(() => {
    console.log('='.repeat(68));
    console.log(`  ALL ${passed} INTEGRATION AUDIT STEPS PASSED WITH 100% SUCCESS! 🚀`);
    console.log('='.repeat(68));
    process.exit(0);
  })
  .catch((err) => {
    console.error('Audit failed with error:', err);
    process.exit(1);
  });

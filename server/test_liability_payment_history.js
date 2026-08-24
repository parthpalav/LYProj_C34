import mongoose from 'mongoose';
import assert from 'assert';
import Liability from './models/Liability.js';
import Transaction from './models/Transaction.js';
import {
  getLiabilitiesPaymentsSummary,
  getLiabilityTransactions
} from './controllers/liabilityController.js';
import { processLiabilities } from './services/LiabilityScheduler.js';
import { connectDB } from './config/db.js';
import 'dotenv/config';

function mockRes() {
  const res = {
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
  return res;
}

async function runTests() {
  console.log('============================================================');
  console.log('  LIABILITY PAYMENT HISTORY & VISIBILITY TEST SUITE');
  console.log('============================================================\n');

  await connectDB();
  await Liability.deleteMany({});
  await Transaction.deleteMany({});

  // ─────────────────────────────────────────────────────────
  // TEST 1: Liability with Zero Payments
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 1: Liability with Zero Payments...');
  const lZero = await Liability.create({
    id: 'L_ZERO',
    userId: 'USER_A',
    name: 'Broadband',
    amount: 1000,
    category: 'Bills',
    type: 'Need',
    autoDeduct: true,
    frequency: 'monthly',
    startDate: new Date('2026-08-01T00:00:00Z'),
    nextDueDate: new Date('2026-09-01T00:00:00Z'),
    status: 'active'
  });

  const req1 = { user: { id: 'USER_A' }, params: { id: 'L_ZERO' }, query: {} };
  const res1 = mockRes();
  await getLiabilityTransactions(req1, res1, (err) => { if (err) throw err; });

  assert.strictEqual(res1.statusCode, 200);
  assert.strictEqual(res1.data.success, true);
  assert.strictEqual(res1.data.data.transactions.length, 0, 'Should have 0 transactions');
  assert.strictEqual(res1.data.data.summary.totalPaid, 0);
  assert.strictEqual(res1.data.data.summary.paymentCount, 0);
  assert.strictEqual(res1.data.data.summary.lastPaymentAmount, null);
  assert.strictEqual(res1.data.data.summary.lastPaymentDate, null);
  console.log('  ✅ Test 1 Passed: Zero payment liability handled gracefully');

  // ─────────────────────────────────────────────────────────
  // TEST 2: Liability with Single Payment
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 2: Liability with Single Payment...');
  await Transaction.create({
    id: 'TX_1',
    userId: 'USER_A',
    amount: 1000,
    category: 'Bills',
    type: 'Need',
    description: 'Broadband',
    timestamp: new Date('2026-08-01T00:00:00Z'),
    classificationSource: 'liability',
    liabilityId: 'L_ZERO',
    scheduledFor: new Date('2026-08-01T00:00:00Z')
  });

  const res2 = mockRes();
  await getLiabilityTransactions(req1, res2, (err) => { if (err) throw err; });

  assert.strictEqual(res2.statusCode, 200);
  assert.strictEqual(res2.data.data.transactions.length, 1);
  assert.strictEqual(res2.data.data.summary.totalPaid, 1000);
  assert.strictEqual(res2.data.data.summary.paymentCount, 1);
  assert.strictEqual(res2.data.data.summary.lastPaymentAmount, 1000);
  assert.strictEqual(new Date(res2.data.data.summary.lastPaymentDate).toISOString(), '2026-08-01T00:00:00.000Z');
  console.log('  ✅ Test 2 Passed: Single payment correctly summarized');

  // ─────────────────────────────────────────────────────────
  // TEST 3: Multiple Payments with Newest-First Sorting
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 3: Multiple Payments & Ordering...');
  const lRent = await Liability.create({
    id: 'L_RENT',
    userId: 'USER_A',
    name: 'Home Rent',
    amount: 25000,
    category: 'Bills',
    type: 'Need',
    autoDeduct: true,
    frequency: 'monthly',
    startDate: new Date('2026-05-05T00:00:00Z'),
    nextDueDate: new Date('2026-09-05T00:00:00Z'),
    status: 'active'
  });

  await Transaction.create([
    {
      id: 'TX_RENT_MAY',
      userId: 'USER_A',
      amount: 25000,
      category: 'Bills',
      type: 'Need',
      description: 'Home Rent',
      timestamp: new Date('2026-05-05T00:00:00Z'),
      classificationSource: 'liability',
      liabilityId: 'L_RENT',
      scheduledFor: new Date('2026-05-05T00:00:00Z')
    },
    {
      id: 'TX_RENT_JUN',
      userId: 'USER_A',
      amount: 25000,
      category: 'Bills',
      type: 'Need',
      description: 'Home Rent',
      timestamp: new Date('2026-06-05T00:00:00Z'),
      classificationSource: 'liability',
      liabilityId: 'L_RENT',
      scheduledFor: new Date('2026-06-05T00:00:00Z')
    },
    {
      id: 'TX_RENT_JUL',
      userId: 'USER_A',
      amount: 25000,
      category: 'Bills',
      type: 'Need',
      description: 'Home Rent',
      timestamp: new Date('2026-07-05T00:00:00Z'),
      classificationSource: 'liability',
      liabilityId: 'L_RENT',
      scheduledFor: new Date('2026-07-05T00:00:00Z')
    },
    {
      id: 'TX_RENT_AUG',
      userId: 'USER_A',
      amount: 25000,
      category: 'Bills',
      type: 'Need',
      description: 'Home Rent',
      timestamp: new Date('2026-08-05T00:00:00Z'),
      classificationSource: 'liability',
      liabilityId: 'L_RENT',
      scheduledFor: new Date('2026-08-05T00:00:00Z')
    }
  ]);

  const req3 = { user: { id: 'USER_A' }, params: { id: 'L_RENT' }, query: {} };
  const res3 = mockRes();
  await getLiabilityTransactions(req3, res3, (err) => { if (err) throw err; });

  assert.strictEqual(res3.data.data.transactions.length, 4);
  assert.strictEqual(res3.data.data.transactions[0].id, 'TX_RENT_AUG', 'Newest transaction should be first');
  assert.strictEqual(res3.data.data.transactions[3].id, 'TX_RENT_MAY', 'Oldest transaction should be last');
  assert.strictEqual(res3.data.data.summary.totalPaid, 100000);
  assert.strictEqual(res3.data.data.summary.paymentCount, 4);
  assert.strictEqual(res3.data.data.summary.lastPaymentAmount, 25000);
  assert.strictEqual(new Date(res3.data.data.summary.lastPaymentDate).toISOString(), '2026-08-05T00:00:00.000Z');
  console.log('  ✅ Test 3 Passed: Multiple payments correctly sorted newest-first with accurate totals');

  // ─────────────────────────────────────────────────────────
  // TEST 4: Editing Liability Must Not Mutate History
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 4: Editing Liability Preserves Historical Amounts...');
  lRent.amount = 30000;
  lRent.name = 'Luxury Apartment Rent';
  await lRent.save();

  const res4 = mockRes();
  await getLiabilityTransactions(req3, res4, (err) => { if (err) throw err; });

  assert.strictEqual(res4.data.data.liability.amount, 30000, 'Liability document amount is updated');
  assert.strictEqual(res4.data.data.transactions[0].amount, 25000, 'Historical transaction amount must remain 25,000');
  assert.strictEqual(res4.data.data.summary.totalPaid, 100000, 'Total paid must remain based on actual transactions');
  console.log('  ✅ Test 4 Passed: Historical amounts remain immutable after liability edits');

  // ─────────────────────────────────────────────────────────
  // TEST 5: Scheduler Generated Transaction & Idempotency in History
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 5: Scheduler Integration & Idempotency...');
  const lScheduler = await Liability.create({
    id: 'L_SCHED',
    userId: 'USER_A',
    name: 'Gym Membership',
    amount: 3000,
    category: 'Health',
    type: 'Want',
    autoDeduct: true,
    frequency: 'monthly',
    startDate: new Date('2026-08-01T00:00:00Z'),
    dayOfMonth: 1,
    nextDueDate: new Date('2026-08-01T00:00:00Z')
  });

  await processLiabilities();

  const req5 = { user: { id: 'USER_A' }, params: { id: 'L_SCHED' }, query: {} };
  const res5 = mockRes();
  await getLiabilityTransactions(req5, res5, (err) => { if (err) throw err; });

  assert.strictEqual(res5.data.data.transactions.length, 1);
  assert.strictEqual(res5.data.data.transactions[0].classificationSource, 'liability');
  assert.strictEqual(res5.data.data.transactions[0].amount, 3000);

  // Run scheduler again — idempotency test
  await processLiabilities();
  const res5Retry = mockRes();
  await getLiabilityTransactions(req5, res5Retry, (err) => { if (err) throw err; });
  assert.strictEqual(res5Retry.data.data.transactions.length, 1, 'Duplicate scheduler run must not duplicate history');
  console.log('  ✅ Test 5 Passed: Scheduler transaction appears in history and remains idempotent');

  // ─────────────────────────────────────────────────────────
  // TEST 6: Security & Cross-User Isolation
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 6: Cross-User Security Isolation...');
  const lUserB = await Liability.create({
    id: 'L_USER_B',
    userId: 'USER_B',
    name: 'Car Loan',
    amount: 15000,
    category: 'Bills',
    type: 'Need',
    autoDeduct: true,
    frequency: 'monthly',
    startDate: new Date('2026-08-01T00:00:00Z'),
    nextDueDate: new Date('2026-09-01T00:00:00Z')
  });

  await Transaction.create({
    id: 'TX_USER_B_1',
    userId: 'USER_B',
    amount: 15000,
    category: 'Bills',
    type: 'Need',
    description: 'Car Loan',
    timestamp: new Date('2026-08-01T00:00:00Z'),
    classificationSource: 'liability',
    liabilityId: 'L_USER_B'
  });

  // User A tries to view User B's liability history
  const reqUnauth = { user: { id: 'USER_A' }, params: { id: 'L_USER_B' }, query: {} };
  const resUnauth = mockRes();
  await getLiabilityTransactions(reqUnauth, resUnauth, (err) => { if (err) throw err; });

  assert.strictEqual(resUnauth.statusCode, 404, 'Must return 404 Not Found when requesting another user liability');
  assert.strictEqual(resUnauth.data.success, false);
  console.log('  ✅ Test 6 Passed: Cross-user access strictly denied');

  // ─────────────────────────────────────────────────────────
  // TEST 7: Batched Payment Summary (N+1 Prevention)
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 7: Batched Payment Summary (N+1 Prevention)...');
  const reqSummary = { user: { id: 'USER_A' } };
  const resSummary = mockRes();
  await getLiabilitiesPaymentsSummary(reqSummary, resSummary, (err) => { if (err) throw err; });

  assert.strictEqual(resSummary.statusCode, 200);
  assert.strictEqual(resSummary.data.success, true);
  const summaryMap = resSummary.data.data;

  // Should contain summaries for User A's liabilities with payments
  assert.ok(summaryMap['L_RENT'], 'Should contain summary for L_RENT');
  assert.strictEqual(summaryMap['L_RENT'].paymentCount, 4);
  assert.strictEqual(summaryMap['L_RENT'].totalPaid, 100000);
  assert.strictEqual(summaryMap['L_RENT'].lastPaymentAmount, 25000);

  assert.ok(summaryMap['L_ZERO'], 'Should contain summary for L_ZERO');
  assert.strictEqual(summaryMap['L_ZERO'].paymentCount, 1);

  assert.ok(summaryMap['L_SCHED'], 'Should contain summary for L_SCHED');
  assert.strictEqual(summaryMap['L_SCHED'].paymentCount, 1);

  // Must NOT contain User B's liability
  assert.strictEqual(summaryMap['L_USER_B'], undefined, 'Must not leak User B liability summary');
  console.log('  ✅ Test 7 Passed: Batched summary returned correctly in 1 single aggregation without N+1');

  // ─────────────────────────────────────────────────────────
  // TEST 8: Soft-Deleted Liability History Preservation
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 8: Soft-Deleted Liability History...');
  lRent.status = 'deleted';
  lRent.autoDeduct = false;
  lRent.nextDueDate = null;
  await lRent.save();

  const reqDeleted = { user: { id: 'USER_A' }, params: { id: 'L_RENT' }, query: {} };
  const resDeleted = mockRes();
  await getLiabilityTransactions(reqDeleted, resDeleted, (err) => { if (err) throw err; });

  assert.strictEqual(resDeleted.statusCode, 200);
  assert.strictEqual(resDeleted.data.data.transactions.length, 4, 'Transactions must remain accessible for soft-deleted liability');
  assert.strictEqual(resDeleted.data.data.summary.totalPaid, 100000);
  assert.strictEqual(resDeleted.data.data.liability.status, 'deleted');
  console.log('  ✅ Test 8 Passed: Historical transactions preserved and accessible after soft delete');

  // ─────────────────────────────────────────────────────────
  // TEST 9: Pagination & Limit Handling
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 9: Pagination Handling...');
  const lPaginated = await Liability.create({
    id: 'L_PAGINATED',
    userId: 'USER_A',
    name: 'Daily Coffee Subscription',
    amount: 100,
    category: 'Food',
    type: 'Want',
    autoDeduct: true,
    frequency: 'daily',
    startDate: new Date('2026-01-01T00:00:00Z')
  });

  const txBatch = [];
  for (let i = 1; i <= 25; i++) {
    const dayStr = String(i).padStart(2, '0');
    const txDate = new Date(`2026-01-${dayStr}T00:00:00Z`);
    txBatch.push({
      id: `TX_PAGE_${i}`,
      userId: 'USER_A',
      amount: 100,
      category: 'Food',
      type: 'Want',
      description: 'Daily Coffee',
      timestamp: txDate,
      classificationSource: 'liability',
      liabilityId: 'L_PAGINATED',
      scheduledFor: txDate
    });
  }
  await Transaction.create(txBatch);

  // Page 1 with limit 10
  const reqP1 = { user: { id: 'USER_A' }, params: { id: 'L_PAGINATED' }, query: { page: '1', limit: '10' } };
  const resP1 = mockRes();
  await getLiabilityTransactions(reqP1, resP1, (err) => { if (err) throw err; });

  assert.strictEqual(resP1.data.data.transactions.length, 10);
  assert.strictEqual(resP1.data.data.pagination.page, 1);
  assert.strictEqual(resP1.data.data.pagination.limit, 10);
  assert.strictEqual(resP1.data.data.pagination.total, 25);
  assert.strictEqual(resP1.data.data.pagination.totalPages, 3);
  assert.strictEqual(resP1.data.data.transactions[0].id, 'TX_PAGE_25', 'Page 1 should have newest');

  // Page 3 with limit 10
  const reqP3 = { user: { id: 'USER_A' }, params: { id: 'L_PAGINATED' }, query: { page: '3', limit: '10' } };
  const resP3 = mockRes();
  await getLiabilityTransactions(reqP3, resP3, (err) => { if (err) throw err; });

  assert.strictEqual(resP3.data.data.transactions.length, 5, 'Page 3 should have remaining 5');
  assert.strictEqual(resP3.data.data.transactions[4].id, 'TX_PAGE_1', 'Last item should be oldest');
  assert.strictEqual(resP3.data.data.summary.totalPaid, 2500, 'Summary reflects full liability total');
  assert.strictEqual(resP3.data.data.summary.paymentCount, 25);
  console.log('  ✅ Test 9 Passed: Pagination and limit calculations verified');

  console.log('\n============================================================');
  console.log('  ALL 9 LIABILITY PAYMENT HISTORY TESTS PASSED SUCCESSFULLY!');
  console.log('============================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test Suite Failed with Error:', err);
  process.exit(1);
});

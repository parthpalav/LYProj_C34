import mongoose from 'mongoose';
import assert from 'assert';
import crypto from 'crypto';
import Liability from './models/Liability.js';
import Transaction from './models/Transaction.js';
import User from './models/User.js';
import { calculateNextDueDate } from './controllers/liabilityController.js';
import { processLiabilities, processSingleLiability, STALE_CLAIM_THRESHOLD_MS } from './services/LiabilityScheduler.js';
import { connectDB } from './config/db.js';
import 'dotenv/config';

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

async function runTests() {
  console.log('='.repeat(64));
  console.log('  FINAURA LIABILITY SCHEDULER & AUTO-DEDUCT TEST SUITE');
  console.log('='.repeat(64));
  await connectDB();

  // ═══════════════════════════════════════════════════════════
  // Section 1: Next Due Date Calculation Pure Math Tests
  // ═══════════════════════════════════════════════════════════

  await test('1.1 Next Due Date: Daily calculation', async () => {
    const liability = new Liability({
      id: 'L1-math', userId: 'U1', name: 'Coffee', amount: 100, category: 'Food & Dining', type: 'Need',
      autoDeduct: true, frequency: 'daily', startDate: new Date('2026-08-01T00:00:00Z')
    });
    const nextDue = calculateNextDueDate(liability, new Date('2026-08-05T12:00:00Z'));
    assert.strictEqual(nextDue.getUTCFullYear(), 2026);
    assert.strictEqual(nextDue.getUTCMonth(), 7); // August
    assert.strictEqual(nextDue.getUTCDate(), 6);
  });

  await test('1.2 Next Due Date: Weekly calculation (Monday)', async () => {
    const liability = new Liability({
      id: 'L2-math', userId: 'U1', name: 'Cleaning', amount: 500, category: 'Utilities & Bills', type: 'Need',
      autoDeduct: true, frequency: 'weekly', startDate: new Date('2026-08-01T00:00:00Z'),
      dayOfWeek: 1 // Monday
    });
    // August 5th 2026 is Wednesday -> Next Monday is August 10th
    const nextDue = calculateNextDueDate(liability, new Date('2026-08-05T12:00:00Z'));
    assert.strictEqual(nextDue.getUTCFullYear(), 2026);
    assert.strictEqual(nextDue.getUTCMonth(), 7);
    assert.strictEqual(nextDue.getUTCDate(), 10);
  });

  await test('1.3 Next Due Date: Monthly end of month leap/non-leap clamps', async () => {
    const liability = new Liability({
      id: 'L3-math', userId: 'U1', name: 'Rent', amount: 5000, category: 'Housing', type: 'Need',
      autoDeduct: true, frequency: 'monthly', startDate: new Date('2026-01-15T00:00:00Z'),
      dayOfMonth: 31
    });
    // From Jan 31 -> Feb 28
    const nextDueJan = calculateNextDueDate(liability, new Date('2026-01-31T00:00:00Z'));
    assert.strictEqual(nextDueJan.getUTCFullYear(), 2026);
    assert.strictEqual(nextDueJan.getUTCMonth(), 1); // Feb
    assert.strictEqual(nextDueJan.getUTCDate(), 28);

    // From Feb 28 -> March 31
    const nextDueFeb = calculateNextDueDate(liability, new Date('2026-02-28T00:00:00Z'));
    assert.strictEqual(nextDueFeb.getUTCFullYear(), 2026);
    assert.strictEqual(nextDueFeb.getUTCMonth(), 2); // March
    assert.strictEqual(nextDueFeb.getUTCDate(), 31);
  });

  await test('1.4 Next Due Date: Yearly leap year handling', async () => {
    const liability = new Liability({
      id: 'L4-math', userId: 'U1', name: 'Insurance', amount: 5000, category: 'Insurance', type: 'Need',
      autoDeduct: true, frequency: 'yearly', startDate: new Date('2024-01-15T00:00:00Z'),
      monthOfYear: 2, dayOfMonth: 29
    });
    // Leap year 2024
    const nextDue24 = calculateNextDueDate(liability, new Date('2023-12-01T00:00:00Z'));
    assert.strictEqual(nextDue24.getUTCFullYear(), 2024);
    assert.strictEqual(nextDue24.getUTCMonth(), 1);
    assert.strictEqual(nextDue24.getUTCDate(), 29);

    // Non-leap year 2025 -> Feb 28
    const nextDue25 = calculateNextDueDate(liability, new Date('2024-03-01T00:00:00Z'));
    assert.strictEqual(nextDue25.getUTCFullYear(), 2025);
    assert.strictEqual(nextDue25.getUTCMonth(), 1);
    assert.strictEqual(nextDue25.getUTCDate(), 28);
  });

  // ═══════════════════════════════════════════════════════════
  // Section 2: Auto-Deduct Scheduler Core & Balance Tests
  // ═══════════════════════════════════════════════════════════

  const TEST_USER_ID = 'u-test-sched-user-1';

  async function resetDB() {
    await User.deleteMany({ id: { $in: [TEST_USER_ID, 'u-test-sched-user-2'] } });
    await Liability.deleteMany({ userId: { $in: [TEST_USER_ID, 'u-test-sched-user-2', 'missing-user'] } });
    await Transaction.deleteMany({ userId: { $in: [TEST_USER_ID, 'u-test-sched-user-2', 'missing-user'] } });

    await User.create({
      id: TEST_USER_ID,
      name: 'Scheduler Test User',
      email: 'sched-test@finaura.test',
      currentBalance: 50000,
      monthlyIncome: 60000,
      processedLiabilityOccurrences: []
    });
  }

  await test('2.1 Standard Auto-Deduct: ₹10,000 liability debits ₹50,000 balance to ₹40,000', async () => {
    await resetDB();
    const scheduledDate = new Date('2026-08-01T00:00:00Z');

    const l = await Liability.create({
      id: 'L-auto-1',
      userId: TEST_USER_ID,
      name: 'Apartment Rent',
      amount: 10000,
      category: 'Housing',
      type: 'Need',
      autoDeduct: true,
      frequency: 'monthly',
      startDate: scheduledDate,
      dayOfMonth: 1,
      nextDueDate: scheduledDate
    });

    await processLiabilities();

    // Verify User Balance
    const user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 40000, `Expected balance 40,000, got ${user.currentBalance}`);

    // Verify Occurrence Marker
    const occurrenceKey = `L-auto-1:${scheduledDate.toISOString()}`;
    assert.ok(user.processedLiabilityOccurrences.includes(occurrenceKey), 'User must contain occurrence marker');

    // Verify exactly one Transaction created with correct metadata
    const txs = await Transaction.find({ liabilityId: 'L-auto-1' });
    assert.strictEqual(txs.length, 1, 'Expected exactly 1 transaction');
    assert.strictEqual(txs[0].amount, 10000);
    assert.strictEqual(txs[0].userId, TEST_USER_ID);
    assert.strictEqual(txs[0].category, 'Housing');
    assert.strictEqual(txs[0].type, 'Need');
    assert.strictEqual(txs[0].description, 'Apartment Rent');
    assert.strictEqual(txs[0].classificationSource, 'liability');
    assert.strictEqual(txs[0].scheduledFor.toISOString(), scheduledDate.toISOString());

    // Verify nextDueDate advanced
    const updatedL = await Liability.findOne({ id: 'L-auto-1' });
    assert.ok(updatedL.nextDueDate.getTime() > scheduledDate.getTime(), 'nextDueDate must advance');
    assert.strictEqual(updatedL.processingScheduledFor, null, 'processingScheduledFor must be cleared');
    assert.strictEqual(updatedL.processingToken, null, 'processingToken must be cleared');
  });

  await test('2.2 Scheduler Replay Idempotency: Re-running does not duplicate transaction or debit', async () => {
    // Re-run scheduler immediately
    await processLiabilities();

    const user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 40000, 'Balance must remain 40,000 on replay');

    const txs = await Transaction.find({ liabilityId: 'L-auto-1' });
    assert.strictEqual(txs.length, 1, 'Transaction count must remain exactly 1');
  });

  await test('2.3 autoDeduct: false liabilities are ignored and do not mutate balance', async () => {
    await resetDB();
    const scheduledDate = new Date('2026-08-01T00:00:00Z');

    await Liability.create({
      id: 'L-manual-1',
      userId: TEST_USER_ID,
      name: 'Credit Card Bill',
      amount: 5000,
      category: 'Utilities & Bills',
      type: 'Need',
      autoDeduct: false, // Manual
      frequency: 'monthly',
      startDate: scheduledDate,
      nextDueDate: scheduledDate
    });

    await processLiabilities();

    const user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 50000, 'Balance must remain unchanged at 50,000');

    const txs = await Transaction.find({ liabilityId: 'L-manual-1' });
    assert.strictEqual(txs.length, 0, 'No transaction should be created');
  });

  await test('2.4 Inactive / deleted liabilities are ignored', async () => {
    await resetDB();
    const scheduledDate = new Date('2026-08-01T00:00:00Z');

    await Liability.create({
      id: 'L-deleted-1',
      userId: TEST_USER_ID,
      name: 'Cancelled Gym',
      amount: 2000,
      category: 'Health',
      type: 'Want',
      status: 'deleted',
      autoDeduct: true,
      frequency: 'monthly',
      startDate: scheduledDate,
      nextDueDate: scheduledDate
    });

    await processLiabilities();

    const user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 50000, 'Balance must remain unchanged');
    const txs = await Transaction.find({ liabilityId: 'L-deleted-1' });
    assert.strictEqual(txs.length, 0, 'No transaction created');
  });

  await test('2.5 Future liabilities are not processed early', async () => {
    await resetDB();
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days in future

    await Liability.create({
      id: 'L-future-1',
      userId: TEST_USER_ID,
      name: 'Future Electricity',
      amount: 1500,
      category: 'Utilities & Bills',
      type: 'Need',
      autoDeduct: true,
      frequency: 'monthly',
      startDate: new Date(),
      nextDueDate: futureDate
    });

    await processLiabilities();

    const user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 50000, 'Balance must remain 50,000');
    const txs = await Transaction.find({ liabilityId: 'L-future-1' });
    assert.strictEqual(txs.length, 0);
  });

  await test('2.6 Missing associated user does not create transaction or advance liability', async () => {
    const scheduledDate = new Date('2026-08-01T00:00:00Z');

    await Liability.create({
      id: 'L-orphan-1',
      userId: 'missing-user',
      name: 'Ghost Bill',
      amount: 3000,
      category: 'Utilities & Bills',
      type: 'Need',
      autoDeduct: true,
      frequency: 'monthly',
      startDate: scheduledDate,
      nextDueDate: scheduledDate
    });

    await processLiabilities();

    const txs = await Transaction.find({ liabilityId: 'L-orphan-1' });
    assert.strictEqual(txs.length, 0, 'Orphan liability must not create transaction');

    const l = await Liability.findOne({ id: 'L-orphan-1' });
    assert.strictEqual(l.nextDueDate.toISOString(), scheduledDate.toISOString(), 'nextDueDate must not advance');
  });

  await test('2.7 Multiple distinct due liabilities each deduct their respective amounts', async () => {
    await resetDB();
    const scheduledDate = new Date('2026-08-01T00:00:00Z');

    await Liability.create([
      {
        id: 'L-multi-1',
        userId: TEST_USER_ID,
        name: 'Rent',
        amount: 20000,
        category: 'Housing',
        type: 'Need',
        autoDeduct: true,
        frequency: 'monthly',
        startDate: scheduledDate,
        nextDueDate: scheduledDate
      },
      {
        id: 'L-multi-2',
        userId: TEST_USER_ID,
        name: 'Internet',
        amount: 1500,
        category: 'Utilities & Bills',
        type: 'Need',
        autoDeduct: true,
        frequency: 'monthly',
        startDate: scheduledDate,
        nextDueDate: scheduledDate
      }
    ]);

    await processLiabilities();

    const user = await User.findOne({ id: TEST_USER_ID });
    // 50,000 - 20,000 - 1,500 = 28,500
    assert.strictEqual(user.currentBalance, 28500, `Expected 28,500, got ${user.currentBalance}`);

    const tx1 = await Transaction.findOne({ liabilityId: 'L-multi-1' });
    const tx2 = await Transaction.findOne({ liabilityId: 'L-multi-2' });
    assert.ok(tx1 && tx2, 'Both transactions must be created');
  });

  await test('2.8 Two genuine recurrence periods each deduct once', async () => {
    await resetDB();
    const period1 = new Date('2026-07-01T00:00:00Z');
    const period2 = new Date('2026-08-01T00:00:00Z');

    // Period 1
    const l = await Liability.create({
      id: 'L-recur-1',
      userId: TEST_USER_ID,
      name: 'EMI',
      amount: 5000,
      category: 'Debt & Loan Payments',
      type: 'Need',
      autoDeduct: true,
      frequency: 'monthly',
      startDate: period1,
      nextDueDate: period1
    });

    await processLiabilities();
    let user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 45000, 'Period 1 debits 5,000 -> 45,000');

    // Simulate next month becoming due
    await Liability.updateOne({ id: 'L-recur-1' }, { $set: { nextDueDate: period2 } });

    await processLiabilities();
    user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 40000, 'Period 2 debits 5,000 -> 40,000');

    const txs = await Transaction.find({ liabilityId: 'L-recur-1' });
    assert.strictEqual(txs.length, 2, 'Two distinct occurrence transactions must exist');
  });

  // ═══════════════════════════════════════════════════════════
  // Section 3: Concurrency, Crash Recovery, and State Machine
  // ═══════════════════════════════════════════════════════════

  await test('3.1 Concurrent processLiabilities() does not double-process', async () => {
    await resetDB();
    const scheduledDate = new Date('2026-08-01T00:00:00Z');

    await Liability.create({
      id: 'L-race-1',
      userId: TEST_USER_ID,
      name: 'Car Insurance',
      amount: 8000,
      category: 'Insurance',
      type: 'Need',
      autoDeduct: true,
      frequency: 'monthly',
      startDate: scheduledDate,
      nextDueDate: scheduledDate
    });

    // Run two simultaneous workers concurrently
    await Promise.all([
      processLiabilities(),
      processLiabilities()
    ]);

    const user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 42000, 'Balance must be deducted exactly once (50,000 - 8,000 = 42,000)');

    const txs = await Transaction.find({ liabilityId: 'L-race-1' });
    assert.strictEqual(txs.length, 1, 'Exactly 1 transaction created');
  });

  await test('3.2 State B Recovery: Transaction exists, occurrence marker absent -> debits balance, no duplicate tx', async () => {
    await resetDB();
    const scheduledDate = new Date('2026-08-01T00:00:00Z');

    // Create pre-existing transaction (simulating crash after tx save, before user debit)
    await Transaction.create({
      id: 'tx-crash-b',
      userId: TEST_USER_ID,
      amount: 6000,
      category: 'Housing',
      type: 'Need',
      description: 'Pre-existing Rent',
      timestamp: scheduledDate,
      classificationSource: 'liability',
      needsReview: false,
      liabilityId: 'L-state-b',
      scheduledFor: scheduledDate
    });

    await Liability.create({
      id: 'L-state-b',
      userId: TEST_USER_ID,
      name: 'Pre-existing Rent',
      amount: 6000,
      category: 'Housing',
      type: 'Need',
      autoDeduct: true,
      frequency: 'monthly',
      startDate: scheduledDate,
      nextDueDate: scheduledDate
    });

    await processLiabilities();

    const user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 44000, 'Balance debited exactly once during recovery (50,000 - 6,000 = 44,000)');

    const txs = await Transaction.find({ liabilityId: 'L-state-b' });
    assert.strictEqual(txs.length, 1, 'No duplicate transaction inserted');

    const l = await Liability.findOne({ id: 'L-state-b' });
    assert.ok(l.nextDueDate.getTime() > scheduledDate.getTime(), 'nextDueDate advanced after recovery');
  });

  await test('3.3 State C Recovery: Transaction exists, occurrence marker present -> no second debit, liability finalizes', async () => {
    await resetDB();
    const scheduledDate = new Date('2026-08-01T00:00:00Z');
    const occurrenceKey = `L-state-c:${scheduledDate.toISOString()}`;

    // Mark user as already debited (simulating crash after balance debit, before liability advance)
    await User.updateOne(
      { id: TEST_USER_ID },
      {
        $set: { currentBalance: 43000 },
        $push: { processedLiabilityOccurrences: occurrenceKey }
      }
    );

    await Transaction.create({
      id: 'tx-crash-c',
      userId: TEST_USER_ID,
      amount: 7000,
      category: 'Housing',
      type: 'Need',
      description: 'Rent State C',
      timestamp: scheduledDate,
      classificationSource: 'liability',
      needsReview: false,
      liabilityId: 'L-state-c',
      scheduledFor: scheduledDate
    });

    await Liability.create({
      id: 'L-state-c',
      userId: TEST_USER_ID,
      name: 'Rent State C',
      amount: 7000,
      category: 'Housing',
      type: 'Need',
      autoDeduct: true,
      frequency: 'monthly',
      startDate: scheduledDate,
      nextDueDate: scheduledDate
    });

    await processLiabilities();

    const user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 43000, 'Balance must NOT be debited again');

    const txs = await Transaction.find({ liabilityId: 'L-state-c' });
    assert.strictEqual(txs.length, 1, 'Transaction count remains 1');

    const l = await Liability.findOne({ id: 'L-state-c' });
    assert.ok(l.nextDueDate.getTime() > scheduledDate.getTime(), 'Liability must advance');
  });

  await test('3.4 State D Recovery: Occurrence marker present, transaction missing -> recreates transaction safely', async () => {
    await resetDB();
    const scheduledDate = new Date('2026-08-01T00:00:00Z');
    const occurrenceKey = `L-state-d:${scheduledDate.toISOString()}`;

    // Mark user as already debited with marker
    await User.updateOne(
      { id: TEST_USER_ID },
      {
        $set: { currentBalance: 46000 },
        $push: { processedLiabilityOccurrences: occurrenceKey }
      }
    );

    await Liability.create({
      id: 'L-state-d',
      userId: TEST_USER_ID,
      name: 'Rent State D',
      amount: 4000,
      category: 'Housing',
      type: 'Need',
      autoDeduct: true,
      frequency: 'monthly',
      startDate: scheduledDate,
      nextDueDate: scheduledDate
    });

    await processLiabilities();

    const user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 46000, 'Balance must NOT be debited again');

    const txs = await Transaction.find({ liabilityId: 'L-state-d' });
    assert.strictEqual(txs.length, 1, 'Transaction recreated for completeness');
    assert.strictEqual(txs[0].amount, 4000);

    const l = await Liability.findOne({ id: 'L-state-d' });
    assert.ok(l.nextDueDate.getTime() > scheduledDate.getTime(), 'Liability finalized and advanced');
  });

  await test('3.5 Stale processing claim is safely reclaimed by subsequent scheduler run', async () => {
    await resetDB();
    const scheduledDate = new Date('2026-08-01T00:00:00Z');
    const staleTime = new Date(Date.now() - 20 * 60 * 1000); // 20 mins ago (exceeds 10m threshold)

    await Liability.create({
      id: 'L-stale-1',
      userId: TEST_USER_ID,
      name: 'Stale Claim Liability',
      amount: 3500,
      category: 'Utilities & Bills',
      type: 'Need',
      autoDeduct: true,
      frequency: 'monthly',
      startDate: scheduledDate,
      nextDueDate: scheduledDate,
      processingScheduledFor: scheduledDate,
      processingStartedAt: staleTime,
      processingToken: 'dead-worker-token'
    });

    await processLiabilities();

    const user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 46500, 'Stale claim was recovered and debited (50,000 - 3,500 = 46,500)');

    const txs = await Transaction.find({ liabilityId: 'L-stale-1' });
    assert.strictEqual(txs.length, 1, 'Transaction created by recovery worker');
  });

  await test('3.6 Fresh processing claim is NOT stolen by another worker', async () => {
    await resetDB();
    const scheduledDate = new Date('2026-08-01T00:00:00Z');
    const freshTime = new Date(); // Just now (active claim)

    await Liability.create({
      id: 'L-fresh-1',
      userId: TEST_USER_ID,
      name: 'Fresh Active Liability',
      amount: 5000,
      category: 'Housing',
      type: 'Need',
      autoDeduct: true,
      frequency: 'monthly',
      startDate: scheduledDate,
      nextDueDate: scheduledDate,
      processingScheduledFor: scheduledDate,
      processingStartedAt: freshTime,
      processingToken: 'active-worker-token'
    });

    // Run scheduler — should skip because claim is active and fresh
    await processLiabilities();

    const user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 50000, 'Balance must remain 50,000 because active worker is working');

    const txs = await Transaction.find({ liabilityId: 'L-fresh-1' });
    assert.strictEqual(txs.length, 0, 'No transaction created by competing worker');
  });

  await test('3.7 Transaction creation failure does not debit balance or advance nextDueDate', async () => {
    await resetDB();
    const scheduledDate = new Date('2026-08-01T00:00:00Z');

    // Create liability with invalid type (will fail transaction validation)
    await Liability.collection.insertOne({
      id: 'L-fail-tx-1',
      userId: TEST_USER_ID,
      name: 'Corrupted Liability',
      amount: 4000,
      category: 'Housing',
      type: 'INVALID_TYPE', // Invalid schema enum
      autoDeduct: true,
      frequency: 'monthly',
      startDate: scheduledDate,
      nextDueDate: scheduledDate,
      status: 'active'
    });

    await processLiabilities();

    const user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 50000, 'Balance must remain untouched at 50,000 on tx failure');

    const l = await Liability.findOne({ id: 'L-fail-tx-1' });
    assert.strictEqual(l.nextDueDate.toISOString(), scheduledDate.toISOString(), 'nextDueDate must not advance');
    assert.strictEqual(l.processingToken, null, 'Claim must be released on failure');
  });

  await test('3.8 Balance failure retains claim and does not advance liability', async () => {
    await resetDB();
    const scheduledDate = new Date('2026-08-01T00:00:00Z');

    // Setup liability for existing user
    await Liability.create({
      id: 'L-fail-bal-1',
      userId: TEST_USER_ID,
      name: 'Balance Fail Rent',
      amount: 4500,
      category: 'Housing',
      type: 'Need',
      autoDeduct: true,
      frequency: 'monthly',
      startDate: scheduledDate,
      nextDueDate: scheduledDate
    });

    // Mock User.findOneAndUpdate to simulate database write failure during balance debit
    const origFindOneAndUpdate = User.findOneAndUpdate;
    let failTriggered = false;
    User.findOneAndUpdate = async function(filter, update, opts) {
      if (update && update.$inc && update.$inc.currentBalance) {
        failTriggered = true;
        return null; // Simulate 0 documents matched or update error
      }
      return origFindOneAndUpdate.apply(this, arguments);
    };

    try {
      await processLiabilities();
    } finally {
      User.findOneAndUpdate = origFindOneAndUpdate;
    }

    assert.ok(failTriggered, 'Balance failure injection was triggered');

    const user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 50000, 'User balance untouched');

    const l = await Liability.findOne({ id: 'L-fail-bal-1' });
    assert.strictEqual(l.nextDueDate.toISOString(), scheduledDate.toISOString(), 'Liability must NOT advance on balance failure');
  });

  await test('3.9 Retry after partial transaction creation completes safely', async () => {
    // Continued from 3.8: tx was created, balance was not debited, liability was not advanced.
    // Now run scheduler with normal User model restored.
    await processLiabilities();

    const user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 45500, 'Balance successfully debited on retry (50,000 - 4,500 = 45,500)');

    const txs = await Transaction.find({ liabilityId: 'L-fail-bal-1' });
    assert.strictEqual(txs.length, 1, 'Exactly one transaction exists across attempts');

    const l = await Liability.findOne({ id: 'L-fail-bal-1' });
    assert.ok(l.nextDueDate.getTime() > new Date('2026-08-01T00:00:00Z').getTime(), 'Liability advanced after successful retry');
  });

  await test('3.10 Retry after completed debit but pre-finalization crash does not debit again', async () => {
    await resetDB();
    const scheduledDate = new Date('2026-08-01T00:00:00Z');

    await Liability.create({
      id: 'L-crash-fin-1',
      userId: TEST_USER_ID,
      name: 'Pre-finalization Crash',
      amount: 3000,
      category: 'Housing',
      type: 'Need',
      autoDeduct: true,
      frequency: 'monthly',
      startDate: scheduledDate,
      nextDueDate: scheduledDate
    });

    // Mock Liability.findOneAndUpdate to simulate crash during finalization
    const origLiabUpdate = Liability.findOneAndUpdate;
    let finalizationCrashed = false;
    Liability.findOneAndUpdate = async function(filter, update, opts) {
      if (update && update.$unset && update.$unset.processingToken) {
        finalizationCrashed = true;
        return null; // Simulate crash right before unsetting token & advancing date
      }
      return origLiabUpdate.apply(this, arguments);
    };

    try {
      await processLiabilities();
    } finally {
      Liability.findOneAndUpdate = origLiabUpdate;
    }

    assert.ok(finalizationCrashed, 'Finalization crash simulation triggered');

    let user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 47000, 'Balance was debited (50,000 - 3,000 = 47,000)');

    // Simulate stale timeout passing so the recovery worker can reclaim
    await Liability.updateOne(
      { id: 'L-crash-fin-1' },
      { $set: { processingStartedAt: new Date(Date.now() - 20 * 60 * 1000) } }
    );

    // Run scheduler again (Recovery Worker)
    await processLiabilities();

    user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 47000, 'Balance must NOT be debited a second time');

    const txs = await Transaction.find({ liabilityId: 'L-crash-fin-1' });
    assert.strictEqual(txs.length, 1, 'Exactly one transaction exists');

    const l = await Liability.findOne({ id: 'L-crash-fin-1' });
    assert.ok(l.nextDueDate.getTime() > scheduledDate.getTime(), 'Liability finalized on recovery run');
  });

  // ═══════════════════════════════════════════════════════════
  // Section 4: Overdue Recurrence Basis & Month-End Progression
  // ═══════════════════════════════════════════════════════════

  await test('4.1 Monthly Overdue: Jan 5 processed on Feb 10 advances to Feb 5, not March 5', async () => {
    await resetDB();
    const jan5 = new Date('2026-01-05T00:00:00Z');

    const l = await Liability.create({
      id: 'L-overdue-1',
      userId: TEST_USER_ID,
      name: 'Utility Bill (Day 5)',
      amount: 2500,
      category: 'Utilities & Bills',
      type: 'Need',
      autoDeduct: true,
      frequency: 'monthly',
      startDate: jan5,
      dayOfMonth: 5,
      nextDueDate: jan5 // Overdue Jan 5
    });

    // Run scheduler — processes Jan 5
    await processLiabilities();

    let user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 47500, 'Jan 5 occurrence debits 2,500 (50,000 - 2,500 = 47,500)');

    let txs = await Transaction.find({ liabilityId: 'L-overdue-1' });
    assert.strictEqual(txs.length, 1, 'Exactly 1 transaction for Jan 5');
    assert.strictEqual(txs[0].scheduledFor.toISOString(), jan5.toISOString());

    let updatedL = await Liability.findOne({ id: 'L-overdue-1' });
    const expectedFeb5 = new Date('2026-02-05T00:00:00Z');
    assert.strictEqual(
      updatedL.nextDueDate.toISOString(),
      expectedFeb5.toISOString(),
      `Expected nextDueDate to advance to Feb 5 (${expectedFeb5.toISOString()}), got ${updatedL.nextDueDate.toISOString()}`
    );

    // Second scheduler run (since Feb 5 is also <= now (Feb 10)): processes Feb 5
    await processLiabilities();

    user = await User.findOne({ id: TEST_USER_ID });
    assert.strictEqual(user.currentBalance, 45000, 'Feb 5 occurrence debits 2,500 (47,500 - 2,500 = 45,000)');

    txs = await Transaction.find({ liabilityId: 'L-overdue-1' }).sort({ timestamp: 1 });
    assert.strictEqual(txs.length, 2, 'Exactly 2 transactions (Jan 5 and Feb 5)');
    assert.strictEqual(txs[1].scheduledFor.toISOString(), expectedFeb5.toISOString());

    updatedL = await Liability.findOne({ id: 'L-overdue-1' });
    const expectedMar5 = new Date('2026-03-05T00:00:00Z');
    assert.strictEqual(
      updatedL.nextDueDate.toISOString(),
      expectedMar5.toISOString(),
      `Expected nextDueDate to advance to March 5 (${expectedMar5.toISOString()}), got ${updatedL.nextDueDate.toISOString()}`
    );
  });

  await test('4.2 Month-End Recurrence: Jan 31 progresses to Feb 28 and then March 31', async () => {
    await resetDB();
    const jan31 = new Date('2026-01-31T00:00:00Z');

    const l = await Liability.create({
      id: 'L-monthend-1',
      userId: TEST_USER_ID,
      name: 'Month-End Rent',
      amount: 15000,
      category: 'Housing',
      type: 'Need',
      autoDeduct: true,
      frequency: 'monthly',
      startDate: jan31,
      dayOfMonth: 31,
      nextDueDate: jan31
    });

    // Process Jan 31
    await processLiabilities();

    let updatedL = await Liability.findOne({ id: 'L-monthend-1' });
    const expectedFeb28 = new Date('2026-02-28T00:00:00Z');
    assert.strictEqual(
      updatedL.nextDueDate.toISOString(),
      expectedFeb28.toISOString(),
      `Expected Jan 31 to advance to Feb 28, got ${updatedL.nextDueDate.toISOString()}`
    );

    // Process Feb 28
    await processLiabilities();

    updatedL = await Liability.findOne({ id: 'L-monthend-1' });
    const expectedMar31 = new Date('2026-03-31T00:00:00Z');
    assert.strictEqual(
      updatedL.nextDueDate.toISOString(),
      expectedMar31.toISOString(),
      `Expected Feb 28 to advance to March 31, got ${updatedL.nextDueDate.toISOString()}`
    );
  });

  console.log('='.repeat(64));
  console.log(`  LIABILITY SUITE RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('='.repeat(64));

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch(err => {
  console.error('\nTest suite execution error:', err);
  process.exit(1);
});

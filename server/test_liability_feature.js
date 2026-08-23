import mongoose from 'mongoose';
import assert from 'assert';
import Liability from './models/Liability.js';
import Transaction from './models/Transaction.js';
import { calculateNextDueDate } from './controllers/liabilityController.js';
import { processLiabilities } from './services/LiabilityScheduler.js';
import { connectDB } from './config/db.js';
import 'dotenv/config';

async function runTests() {
  console.log('--- Starting Liability Tests ---');
  await connectDB();
  await Liability.deleteMany({});
  await Transaction.deleteMany({});

  console.log('Testing Next Due Date Calculation...');
  
  // Daily
  let liability = new Liability({
    id: 'L1', userId: 'U1', name: 'Coffee', amount: 100, category: 'Food', type: 'Need',
    autoDeduct: true, frequency: 'daily', startDate: new Date('2026-08-01T00:00:00Z')
  });
  let nextDue = calculateNextDueDate(liability, new Date('2026-08-05T12:00:00Z'));
  assert.ok(
    nextDue.getUTCFullYear() === 2026 && nextDue.getUTCMonth() === 7 && nextDue.getUTCDate() === 6,
    `Expected 2026-08-06 UTC time, got ${nextDue}`
  );

  // Weekly
  liability = new Liability({
    id: 'L2', userId: 'U1', name: 'Cleaning', amount: 500, category: 'Bills', type: 'Need',
    autoDeduct: true, frequency: 'weekly', startDate: new Date('2026-08-01T00:00:00Z'),
    dayOfWeek: 1 // Monday
  });
  // August 5th 2026 is Wednesday
  nextDue = calculateNextDueDate(liability, new Date('2026-08-05T12:00:00Z'));
  // Next Monday is August 10th
  assert.ok(
    nextDue.getUTCFullYear() === 2026 && nextDue.getUTCMonth() === 7 && nextDue.getUTCDate() === 10,
    `Expected 2026-08-10 UTC time, got ${nextDue}`
  );

  // Monthly edge case
  liability = new Liability({
    id: 'L3', userId: 'U1', name: 'Rent', amount: 5000, category: 'Bills', type: 'Need',
    autoDeduct: true, frequency: 'monthly', startDate: new Date('2026-01-15T00:00:00Z'),
    dayOfMonth: 31
  });
  // Suppose we are on Jan 31
  let nextDueJan = calculateNextDueDate(liability, new Date('2026-01-31T00:00:00Z'));
  assert.ok(
    nextDueJan.getUTCFullYear() === 2026 && nextDueJan.getUTCMonth() === 1 && nextDueJan.getUTCDate() === 28,
    `Expected 2026-02-28 UTC time, got ${nextDueJan}`
  );

  // From Feb 28 back to March 31
  let nextDueFeb = calculateNextDueDate(liability, new Date('2026-02-28T00:00:00Z'));
  assert.ok(
    nextDueFeb.getUTCFullYear() === 2026 && nextDueFeb.getUTCMonth() === 2 && nextDueFeb.getUTCDate() === 31,
    `Expected 2026-03-31 UTC time, got ${nextDueFeb}`
  );

  // Yearly leap year
  liability = new Liability({
    id: 'L4', userId: 'U1', name: 'Insurance', amount: 5000, category: 'Bills', type: 'Need',
    autoDeduct: true, frequency: 'yearly', startDate: new Date('2024-01-15T00:00:00Z'),
    monthOfYear: 2, dayOfMonth: 29
  });
  let nextDue24 = calculateNextDueDate(liability, new Date('2023-12-01T00:00:00Z'));
  assert.ok(
    nextDue24.getUTCFullYear() === 2024 && nextDue24.getUTCMonth() === 1 && nextDue24.getUTCDate() === 29,
    `Expected 2024-02-29 UTC time, got ${nextDue24}`
  );

  let nextDue25 = calculateNextDueDate(liability, new Date('2024-03-01T00:00:00Z'));
  assert.ok(
    nextDue25.getUTCFullYear() === 2025 && nextDue25.getUTCMonth() === 1 && nextDue25.getUTCDate() === 28,
    `Expected 2025-02-28 UTC time, got ${nextDue25}`
  );

  let nextDue28 = calculateNextDueDate(liability, new Date('2027-03-01T00:00:00Z'));
  assert.ok(
    nextDue28.getUTCFullYear() === 2028 && nextDue28.getUTCMonth() === 1 && nextDue28.getUTCDate() === 29,
    `Expected 2028-02-29 UTC time, got ${nextDue28}`
  );

  console.log('Testing Auto Deduct Scheduler...');
  await Liability.deleteMany({});
  await Transaction.deleteMany({});

  const l1 = new Liability({
    id: 'L1', userId: 'U1', name: 'Rent', amount: 20000, category: 'Bills', type: 'Need',
    autoDeduct: true, frequency: 'monthly', startDate: new Date('2026-08-01T00:00:00Z'),
    dayOfMonth: 1,
    nextDueDate: new Date('2026-08-01T00:00:00Z') // Due today
  });
  await l1.save();

  await processLiabilities();

  let txs = await Transaction.find({ liabilityId: 'L1' });
  assert.strictEqual(txs.length, 1, 'Expected 1 transaction');
  assert.strictEqual(txs[0].amount, 20000);
  assert.strictEqual(txs[0].classificationSource, 'liability');
  assert.ok(
    txs[0].scheduledFor.getUTCFullYear() === 2026 && txs[0].scheduledFor.getUTCMonth() === 7 && txs[0].scheduledFor.getUTCDate() === 1,
    `Expected scheduledFor to be 2026-08-01 UTC, got ${txs[0].scheduledFor}`
  );

  let updated = await Liability.findOne({ id: 'L1' });
  // The processor uses NOW to calculate nextDueDate. 
  // Let's assume now is August 2026. Next due date should be Sept 1.
  assert.ok(updated.nextDueDate.getTime() > new Date('2026-08-01T00:00:00Z').getTime());

  console.log('Testing Idempotency...');
  const l2 = new Liability({
    id: 'L2', userId: 'U1', name: 'Rent', amount: 20000, category: 'Bills', type: 'Need',
    autoDeduct: true, frequency: 'monthly', startDate: new Date('2026-08-01T00:00:00Z'),
    dayOfMonth: 1,
    nextDueDate: new Date('2026-08-01T00:00:00Z')
  });
  await l2.save();

  await new Transaction({
    id: 'T1', userId: 'U1', amount: 20000, category: 'Bills', type: 'Need',
    timestamp: new Date('2026-08-01T00:00:00Z'), classificationSource: 'liability',
    liabilityId: 'L2', scheduledFor: new Date('2026-08-01T00:00:00Z')
  }).save();

  await processLiabilities();

  txs = await Transaction.find({ liabilityId: 'L2' });
  assert.strictEqual(txs.length, 1, 'Expected exactly 1 transaction because of idempotency');

  let updated2 = await Liability.findOne({ id: 'L2' });
  assert.ok(updated2.nextDueDate.getTime() > new Date('2026-08-01T00:00:00Z').getTime(), 'Expected nextDueDate to advance even after idempotent hit');

  console.log('All tests passed!');
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});

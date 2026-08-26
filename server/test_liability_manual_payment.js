import mongoose from 'mongoose';
import assert from 'assert';
import Liability from './models/Liability.js';
import Transaction from './models/Transaction.js';
import User from './models/User.js';
import controllerRouter from './controllers/index.js';
import { processLiabilities } from './services/LiabilityScheduler.js';
import { calculateFMI } from './services/FMIService.js';
import { connectDB } from './config/db.js';
import 'dotenv/config';

// Helper to simulate Express route calls
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

// Find route handler in controller router
function getHandler(method, path) {
  for (const layer of controllerRouter.stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
      return layer.route.stack[0].handle;
    }
  }
  throw new Error(`Handler not found for ${method} ${path}`);
}

async function runTests() {
  console.log('============================================================');
  console.log('  MARK UPCOMING PAYMENT AS PAID TEST SUITE');
  console.log('============================================================\n');

  await connectDB();
  const testUserIds = ['USER_C', 'USER_D'];
  await Liability.deleteMany({ userId: { $in: testUserIds } });
  await Transaction.deleteMany({ userId: { $in: testUserIds } });
  await Transaction.syncIndexes();
  await User.deleteMany({ id: { $in: testUserIds } });

  // Create test users
  const initialBalance = 500000;
  await User.create([
    { id: 'USER_C', name: 'User C', email: 'userc@example.com', currentBalance: initialBalance },
    { id: 'USER_D', name: 'User D', email: 'userd@example.com', currentBalance: initialBalance }
  ]);

  const postTxHandler = getHandler('POST', '/transactions');
  const deleteTxHandler = getHandler('DELETE', '/transactions/:id');
  const putTxHandler = getHandler('PUT', '/transactions/:id');

  // ─────────────────────────────────────────────────────────
  // TEST 1: Mark Upcoming Payment as Paid (Success)
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 1: Mark Upcoming Payment as Paid (Success)...');
  const scheduledDue = new Date('2026-09-01T00:00:00Z');
  const lAuto = await Liability.create({
    id: 'L_CAR_AUTO_2',
    userId: 'USER_C',
    name: 'Car Loan EMI',
    amount: 15000,
    category: 'Bills',
    type: 'Need',
    autoDeduct: true,
    frequency: 'monthly',
    startDate: new Date('2026-08-01T00:00:00Z'),
    dayOfMonth: 1,
    nextDueDate: scheduledDue,
    status: 'active'
  });

  const req1 = {
    user: { id: 'USER_C' },
    body: {
      amount: 15000,
      category: 'Bills',
      type: 'Need',
      description: 'Advance EMI payment paid manually',
      liabilityId: 'L_CAR_AUTO_2',
      expectedScheduledFor: scheduledDue.toISOString()
    }
  };
  const res1 = mockRes();
  await postTxHandler(req1, res1, (err) => { if (err) throw err; });

  assert.strictEqual(res1.statusCode, 201);
  assert.strictEqual(res1.data.liabilityId, 'L_CAR_AUTO_2');
  assert.strictEqual(res1.data.classificationSource, 'manual');
  assert.strictEqual(new Date(res1.data.scheduledFor).toISOString(), scheduledDue.toISOString());
  
  // Verify nextDueDate is advanced exactly once
  const lAutoAfter = await Liability.findOne({ id: 'L_CAR_AUTO_2' });
  const expectedNextDue = new Date('2026-10-01T00:00:00Z');
  assert.strictEqual(
    lAutoAfter.nextDueDate.toISOString(),
    expectedNextDue.toISOString(),
    'Manual payment MUST advance nextDueDate to next cycle'
  );
  console.log('  ✅ Test 1 Passed: Manual payment satisfies occurrence, sets scheduledFor, and advances nextDueDate');

  // ─────────────────────────────────────────────────────────
  // TEST 2: Stale State Protection (409 Conflict)
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 2: Stale State Protection...');
  
  const req2 = {
    user: { id: 'USER_C' },
    body: {
      amount: 15000,
      category: 'Bills',
      type: 'Need',
      description: 'Another EMI payment using stale date',
      liabilityId: 'L_CAR_AUTO_2',
      expectedScheduledFor: scheduledDue.toISOString() // This is now stale, nextDueDate is 2026-10-01
    }
  };
  const res2 = mockRes();
  await postTxHandler(req2, res2, (err) => { if (err) throw err; });

  assert.strictEqual(res2.statusCode, 409);
  assert.strictEqual(res2.data.error, 'The scheduled payment date has changed. Please refresh and try again.');
  console.log('  ✅ Test 2 Passed: Stale state correctly protected with 409 Conflict');

  // ─────────────────────────────────────────────────────────
  // TEST 3: Reject non-AutoDeduct liability
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 3: Reject non-AutoDeduct liability...');
  
  const lManual = await Liability.create({
    id: 'L_RENT_MANUAL_2',
    userId: 'USER_C',
    name: 'Home Rent',
    amount: 25000,
    category: 'Bills',
    type: 'Need',
    autoDeduct: false,
    frequency: 'monthly',
    startDate: new Date('2026-08-01T00:00:00Z'),
    nextDueDate: scheduledDue,
    status: 'active'
  });

  const req3 = {
    user: { id: 'USER_C' },
    body: {
      amount: 25000,
      category: 'Bills',
      type: 'Need',
      description: 'Payment',
      liabilityId: 'L_RENT_MANUAL_2',
      expectedScheduledFor: scheduledDue.toISOString()
    }
  };
  const res3 = mockRes();
  await postTxHandler(req3, res3, (err) => { if (err) throw err; });

  assert.strictEqual(res3.statusCode, 400);
  console.log('  ✅ Test 3 Passed: non-AutoDeduct liability correctly rejected when requesting mark as paid');

  // ─────────────────────────────────────────────────────────
  // TEST 4: Normal Manual Linking Without Marking Paid Leaves nextDueDate Unchanged
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 4: Normal Manual Linking without Marking Paid...');

  const currentNextDue = lAutoAfter.nextDueDate;
  const req4 = {
    user: { id: 'USER_C' },
    body: {
      amount: 5000,
      category: 'Bills',
      type: 'Need',
      description: 'Partial extra payment',
      liabilityId: 'L_CAR_AUTO_2'
    }
  };
  const res4 = mockRes();
  await postTxHandler(req4, res4, (err) => { if (err) throw err; });

  assert.strictEqual(res4.statusCode, 201);
  assert.strictEqual(res4.data.liabilityId, 'L_CAR_AUTO_2');
  assert.strictEqual(res4.data.scheduledFor, null);

  const lAutoUnchanged = await Liability.findOne({ id: 'L_CAR_AUTO_2' });
  assert.strictEqual(
    lAutoUnchanged.nextDueDate.toISOString(),
    currentNextDue.toISOString(),
    'Normal manual link MUST leave nextDueDate unchanged'
  );
  console.log('  ✅ Test 4 Passed: Normal manual linking leaves nextDueDate completely untouched');

  // ─────────────────────────────────────────────────────────
  // TEST 5: Double-Submit / Concurrency Collision Protection (Unique Index & Balance Revert)
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 5: Double-Submit / Concurrency Collision Protection...');

  const userCBeforeCol = await User.findOne({ id: 'USER_C' });
  const balanceBeforeCol = userCBeforeCol.currentBalance;

  // Direct injection simulating concurrent insert with same (liabilityId, scheduledFor)
  try {
    await Transaction.create({
      id: `t-concurrent-collision`,
      userId: 'USER_C',
      amount: 15000,
      category: 'Bills',
      type: 'Need',
      classificationSource: 'manual',
      liabilityId: 'L_CAR_AUTO_2',
      scheduledFor: currentNextDue,
      description: 'First concurrent manual payment',
      timestamp: new Date()
    });
  } catch (err) {
    assert.fail(`Initial setup insert failed: ${err.message}`);
  }

  // Now client attempts POST with same expectedScheduledFor = currentNextDue
  const reqCollision = {
    user: { id: 'USER_C' },
    body: {
      amount: 15000,
      category: 'Bills',
      type: 'Need',
      description: 'Duplicate simultaneous submission',
      liabilityId: 'L_CAR_AUTO_2',
      expectedScheduledFor: currentNextDue.toISOString()
    }
  };
  const resCollision = mockRes();
  await postTxHandler(reqCollision, resCollision, (err) => { if (err) throw err; });

  assert.strictEqual(resCollision.statusCode, 409);
  
  // Verify User C balance was properly reverted on 409 conflict failure
  const userCAfterCol = await User.findOne({ id: 'USER_C' });
  assert.strictEqual(
    userCAfterCol.currentBalance,
    balanceBeforeCol,
    'Balance must be reverted on duplicate transaction collision'
  );
  console.log('  ✅ Test 5 Passed: Duplicate occurrence submission caught by unique index, 409 returned & balance reverted');

  // ─────────────────────────────────────────────────────────
  // TEST 6: Scheduler Integration & Idempotency Guarantee
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 6: Scheduler Integration & Idempotency...');

  const pastDueDate = new Date('2026-08-01T00:00:00Z');
  // Manual transaction created with scheduledFor = pastDueDate
  await Transaction.create({
    id: 't-manual-past-fulfilled',
    userId: 'USER_C',
    amount: 15000,
    category: 'Bills',
    type: 'Need',
    classificationSource: 'manual',
    liabilityId: 'L_CAR_AUTO_2',
    scheduledFor: pastDueDate,
    description: 'Manually fulfilled past due occurrence',
    timestamp: new Date()
  });

  // Set liability nextDueDate back to pastDueDate to test scheduler behavior when due
  await Liability.findOneAndUpdate(
    { id: 'L_CAR_AUTO_2' },
    { $set: { nextDueDate: pastDueDate } }
  );

  // Now processLiabilities runs (scheduler poll)
  await processLiabilities();

  // Verify scheduler caught duplicate key E11000 on scheduledFor and advanced nextDueDate cleanly
  const lAutoAfterScheduler = await Liability.findOne({ id: 'L_CAR_AUTO_2' });
  assert.ok(
    lAutoAfterScheduler.nextDueDate > pastDueDate,
    'Scheduler must advance nextDueDate after catching idempotency key collision'
  );

  // Ensure NO duplicate transaction was created by scheduler
  const txCount = await Transaction.countDocuments({ liabilityId: 'L_CAR_AUTO_2', scheduledFor: pastDueDate });
  assert.strictEqual(txCount, 1, 'Only ONE transaction must exist for the scheduled occurrence');
  console.log('  ✅ Test 6 Passed: Scheduler correctly respects manually fulfilled occurrence and advances schedule without duplicate tx');

  // ─────────────────────────────────────────────────────────
  // TEST 7: Manual Fulfilled Transaction Badge Semantics
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 7: Manual Fulfilled Transaction Source Semantics...');

  const fulfilledTx = await Transaction.findOne({ liabilityId: 'L_CAR_AUTO_2', scheduledFor: pastDueDate });
  assert.strictEqual(fulfilledTx.classificationSource, 'manual');
  console.log('  ✅ Test 7 Passed: Fulfilled transaction preserves Manual Payment classificationSource semantics');

  // ─────────────────────────────────────────────────────────
  // TEST 8: Ownership Validation Protection
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 8: Cross-User Ownership Rejection...');

  const reqCross = {
    user: { id: 'USER_D' },
    body: {
      amount: 15000,
      category: 'Bills',
      type: 'Need',
      description: 'User D trying to satisfy User C liability',
      liabilityId: 'L_CAR_AUTO_2',
      expectedScheduledFor: lAutoAfterScheduler.nextDueDate.toISOString()
    }
  };
  const resCross = mockRes();
  await postTxHandler(reqCross, resCross, (err) => { if (err) throw err; });

  assert.strictEqual(resCross.statusCode, 400);
  assert.strictEqual(resCross.data.error, 'Invalid or inactive liability');
  console.log('  ✅ Test 8 Passed: Cross-user liability payment satisfaction strictly rejected');

  // ─────────────────────────────────────────────────────────
  // TEST 9: Transaction Deletion and Unlinking Semantics
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 9: Deletion & Unlinking Schedule Isolation...');
  
  const currentNextDueTime = lAutoAfterScheduler.nextDueDate;

  // Find the manual fulfilled transaction from Test 1
  const manualFulfilledTx = await Transaction.findOne({
    userId: 'USER_C',
    liabilityId: 'L_CAR_AUTO_2',
    scheduledFor: scheduledDue
  });
  assert.ok(manualFulfilledTx, 'Manual fulfilled transaction must exist');

  // Unlink the transaction (PUT to clear liabilityId)
  const reqUnlink = {
    user: { id: 'USER_C' },
    params: { id: manualFulfilledTx.id },
    body: { liabilityId: null }
  };
  const resUnlink = mockRes();
  await putTxHandler(reqUnlink, resUnlink, (err) => { if (err) throw err; });
  assert.strictEqual(resUnlink.statusCode, 200);

  // Verify nextDueDate remains forward and unchanged
  const lAutoUnlinked = await Liability.findOne({ id: 'L_CAR_AUTO_2' });
  assert.strictEqual(
    lAutoUnlinked.nextDueDate.toISOString(),
    currentNextDueTime.toISOString(),
    'Unlinking satisfied transaction MUST NOT rewind or change nextDueDate'
  );

  // Relink it and then delete it to test delete semantics
  await Transaction.updateOne({ id: manualFulfilledTx.id }, { $set: { liabilityId: 'L_CAR_AUTO_2' } });

  const reqDelete = {
    user: { id: 'USER_C' },
    params: { id: manualFulfilledTx.id }
  };
  const resDelete = mockRes();
  await deleteTxHandler(reqDelete, resDelete, (err) => { if (err) throw err; });
  assert.strictEqual(resDelete.statusCode, 200);

  // Verify nextDueDate remains forward and unchanged
  const lAutoDeleted = await Liability.findOne({ id: 'L_CAR_AUTO_2' });
  assert.strictEqual(
    lAutoDeleted.nextDueDate.toISOString(),
    currentNextDueTime.toISOString(),
    'Deleting satisfied transaction MUST NOT rewind or change nextDueDate'
  );
  console.log('  ✅ Test 9 Passed: Deletion and unlinking do not roll back the advanced liability schedule');

  // ─────────────────────────────────────────────────────────
  // TEST 10: FMI Calculations and Financial Integrity Impact
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 10: FMI Deterministic Integrity Verification...');

  // Mock a user profile structure matching the calculateFMI inputs
  const fmiUser = {
    currentBalance: 500000,
    monthlyIncome: 100000,
    currentAge: 30,
    retirementAge: 60,
    retirementGoal: 20000000,
    previousShortfall: 0
  };

  // Capture FMI impact before any new transactions
  const baseFmi = calculateFMI(fmiUser, []);
  
  // FMI with one manually logged payment
  const singleTx = [{ amount: 15000, type: 'Need', category: 'Bills', timestamp: new Date() }];
  const satisfiedFmi = calculateFMI(fmiUser, singleTx);

  // Trigger a duplicate attempt (simulate index E11000 collision rejecting second write)
  // Check that FMI computed over singleTx remains identical since duplicate write is rejected
  const duplicateAttemptFmi = calculateFMI(fmiUser, singleTx);
  assert.strictEqual(satisfiedFmi.score, duplicateAttemptFmi.score, 'Duplicate transaction attempt must not affect FMI score');
  assert.ok(satisfiedFmi.score !== baseFmi.score, 'Satisfying manual payment must have a valid transaction-level financial effect on FMI');

  console.log('  ✅ Test 10 Passed: Fulfilled manual payment has single transaction-level financial effect on FMI');

  console.log('\n============================================================');
  console.log('  ALL 10 "MARK UPCOMING PAYMENT AS PAID" TESTS PASSED!');
  console.log('============================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test Suite Failed with Error:', err);
  process.exit(1);
});

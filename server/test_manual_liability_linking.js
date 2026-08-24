import mongoose from 'mongoose';
import assert from 'assert';
import Liability from './models/Liability.js';
import Transaction from './models/Transaction.js';
import User from './models/User.js';
import {
  getLiabilitiesPaymentsSummary,
  getLiabilityTransactions
} from './controllers/liabilityController.js';
import controllerRouter from './controllers/index.js';
import { processLiabilities } from './services/LiabilityScheduler.js';
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
  console.log('  MANUAL TRANSACTION → LIABILITY LINKING TEST SUITE');
  console.log('============================================================\n');

  await connectDB();
  await Liability.deleteMany({});
  await Transaction.deleteMany({});
  await Transaction.syncIndexes();
  await User.deleteMany({ id: { $in: ['USER_A', 'USER_B'] } });

  // Create test users
  await User.create([
    { id: 'USER_A', name: 'User A', email: 'usera@example.com', currentBalance: 500000 },
    { id: 'USER_B', name: 'User B', email: 'userb@example.com', currentBalance: 500000 }
  ]);

  const postTxHandler = getHandler('POST', '/transactions');
  const putTxHandler = getHandler('PUT', '/transactions/:id');

  // ─────────────────────────────────────────────────────────
  // TEST 1: Create Normal Transaction Without Liability
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 1: Normal Transaction without Liability...');
  const req1 = {
    user: { id: 'USER_A' },
    body: {
      amount: 500,
      category: 'Food',
      type: 'Want',
      description: 'Coffee and pastry'
    }
  };
  const res1 = mockRes();
  await postTxHandler(req1, res1, (err) => { if (err) throw err; });

  assert.strictEqual(res1.statusCode, 201);
  assert.strictEqual(res1.data.amount, 500);
  assert.ok(!res1.data.liabilityId, 'Should have no liabilityId');
  console.log('  ✅ Test 1 Passed: Normal transaction created with no liability link');

  // ─────────────────────────────────────────────────────────
  // TEST 2: Create Manual Transaction Linked to Active Liability
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 2: Manual Transaction Linked to Active Liability...');
  const lRent = await Liability.create({
    id: 'L_RENT_MANUAL',
    userId: 'USER_A',
    name: 'Home Rent',
    amount: 25000,
    category: 'Bills',
    type: 'Need',
    autoDeduct: false,
    frequency: 'monthly',
    startDate: new Date('2026-08-01T00:00:00Z'),
    status: 'active'
  });

  const req2 = {
    user: { id: 'USER_A' },
    body: {
      amount: 25000,
      category: 'Bills',
      type: 'Need',
      description: 'August Rent paid via UPI',
      liabilityId: 'L_RENT_MANUAL'
    }
  };
  const res2 = mockRes();
  await postTxHandler(req2, res2, (err) => { if (err) throw err; });

  assert.strictEqual(res2.statusCode, 201);
  assert.strictEqual(res2.data.liabilityId, 'L_RENT_MANUAL');
  assert.strictEqual(res2.data.classificationSource, 'manual');
  console.log('  ✅ Test 2 Passed: Manual transaction correctly linked and classificationSource preserved as manual');

  // ─────────────────────────────────────────────────────────
  // TEST 3: Cross-User Security Validation
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 3: Cross-User Security Rejection...');
  const req3 = {
    user: { id: 'USER_B' }, // User B tries to link to User A's liability
    body: {
      amount: 25000,
      category: 'Bills',
      type: 'Need',
      description: 'Attempt cross-user link',
      liabilityId: 'L_RENT_MANUAL'
    }
  };
  const res3 = mockRes();
  await postTxHandler(req3, res3, (err) => { if (err) throw err; });

  assert.strictEqual(res3.statusCode, 400);
  assert.strictEqual(res3.data.error, 'Invalid or inactive liability');
  console.log('  ✅ Test 3 Passed: Cross-user liability linking strictly rejected');

  // ─────────────────────────────────────────────────────────
  // TEST 4: Soft-Deleted Liability Rejection
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 4: Soft-Deleted Liability Rejection...');
  const lDeleted = await Liability.create({
    id: 'L_OLD_LOAN',
    userId: 'USER_A',
    name: 'Old Personal Loan',
    amount: 5000,
    category: 'Bills',
    type: 'Need',
    autoDeduct: false,
    frequency: 'monthly',
    startDate: new Date('2026-01-01T00:00:00Z'),
    status: 'deleted'
  });

  const req4 = {
    user: { id: 'USER_A' },
    body: {
      amount: 5000,
      category: 'Bills',
      type: 'Need',
      description: 'Payment to deleted loan',
      liabilityId: 'L_OLD_LOAN'
    }
  };
  const res4 = mockRes();
  await postTxHandler(req4, res4, (err) => { if (err) throw err; });

  assert.strictEqual(res4.statusCode, 400);
  assert.strictEqual(res4.data.error, 'Invalid or inactive liability');
  console.log('  ✅ Test 4 Passed: Linking to soft-deleted liability strictly rejected');

  // ─────────────────────────────────────────────────────────
  // TEST 5: Multiple Manual Transactions Linked to Same Liability (Index Idempotency Verification)
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 5: Multiple Manual Payments on Same Liability...');
  const req5a = {
    user: { id: 'USER_A' },
    body: {
      amount: 25000,
      category: 'Bills',
      type: 'Need',
      description: 'July Rent paid late',
      liabilityId: 'L_RENT_MANUAL'
    }
  };
  const res5a = mockRes();
  await postTxHandler(req5a, res5a, (err) => { if (err) throw err; });
  assert.strictEqual(res5a.statusCode, 201);

  const req5b = {
    user: { id: 'USER_A' },
    body: {
      amount: 5000,
      category: 'Bills',
      type: 'Need',
      description: 'Maintenance fee for rent',
      liabilityId: 'L_RENT_MANUAL'
    }
  };
  const res5b = mockRes();
  await postTxHandler(req5b, res5b, (err) => { if (err) throw err; });
  assert.strictEqual(res5b.statusCode, 201);

  console.log('  ✅ Test 5 Passed: Multiple manual payments coexist without duplicate key index collision');

  // ─────────────────────────────────────────────────────────
  // TEST 6: Payment History & Aggregated Summary Integration
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 6: Payment History & Summary Integration...');
  const reqHist = { user: { id: 'USER_A' }, params: { id: 'L_RENT_MANUAL' }, query: {} };
  const resHist = mockRes();
  await getLiabilityTransactions(reqHist, resHist, (err) => { if (err) throw err; });

  assert.strictEqual(resHist.statusCode, 200);
  assert.strictEqual(resHist.data.data.transactions.length, 3);
  assert.strictEqual(resHist.data.data.summary.paymentCount, 3);
  assert.strictEqual(resHist.data.data.summary.totalPaid, 55000); // 25000 + 25000 + 5000

  // Batched payment summary endpoint check
  const reqSumm = { user: { id: 'USER_A' } };
  const resSumm = mockRes();
  await getLiabilitiesPaymentsSummary(reqSumm, resSumm, (err) => { if (err) throw err; });

  assert.strictEqual(resSumm.statusCode, 200);
  assert.strictEqual(resSumm.data.data['L_RENT_MANUAL'].paymentCount, 3);
  assert.strictEqual(resSumm.data.data['L_RENT_MANUAL'].totalPaid, 55000);
  console.log('  ✅ Test 6 Passed: Manual transactions accurately reflect in payment history and batched summaries');

  // ─────────────────────────────────────────────────────────
  // TEST 7: Auto Deduct Schedule Isolation (nextDueDate untouched)
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 7: Auto Deduct Schedule Isolation...');
  const scheduledDue = new Date('2026-09-01T00:00:00Z');
  const lAuto = await Liability.create({
    id: 'L_CAR_AUTO',
    userId: 'USER_A',
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

  // User manually logs a payment for this Auto Deduct liability
  const reqManualAuto = {
    user: { id: 'USER_A' },
    body: {
      amount: 15000,
      category: 'Bills',
      type: 'Need',
      description: 'Advance EMI payment paid via bank branch',
      liabilityId: 'L_CAR_AUTO'
    }
  };
  const resManualAuto = mockRes();
  await postTxHandler(reqManualAuto, resManualAuto, (err) => { if (err) throw err; });
  assert.strictEqual(resManualAuto.statusCode, 201);

  // Verify nextDueDate is STILL unchanged
  const lAutoAfter = await Liability.findOne({ id: 'L_CAR_AUTO' });
  assert.strictEqual(
    lAutoAfter.nextDueDate.toISOString(),
    scheduledDue.toISOString(),
    'Manual payment MUST NOT advance nextDueDate'
  );
  console.log('  ✅ Test 7 Passed: Auto Deduct schedule remains isolated and unchanged');

  // ─────────────────────────────────────────────────────────
  // TEST 8: Unlinking a Transaction (PUT /transactions/:id)
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 8: Unlinking a Transaction...');
  const txToUnlinkId = res5b.data.id;

  const reqUnlink = {
    user: { id: 'USER_A' },
    params: { id: txToUnlinkId },
    body: {
      liabilityId: null
    }
  };
  const resUnlink = mockRes();
  await putTxHandler(reqUnlink, resUnlink, (err) => { if (err) throw err; });

  assert.strictEqual(resUnlink.statusCode, 200);
  assert.strictEqual(resUnlink.data.liabilityId, null);

  // Re-check history of L_RENT_MANUAL
  const resHistAfterUnlink = mockRes();
  await getLiabilityTransactions(reqHist, resHistAfterUnlink, (err) => { if (err) throw err; });

  assert.strictEqual(resHistAfterUnlink.data.data.transactions.length, 2, 'Unlinked tx removed from history');
  assert.strictEqual(resHistAfterUnlink.data.data.summary.paymentCount, 2);
  assert.strictEqual(resHistAfterUnlink.data.data.summary.totalPaid, 50000);

  // Verify unlinked transaction itself still exists in DB
  const unlinkedTxInDb = await Transaction.findOne({ id: txToUnlinkId });
  assert.ok(unlinkedTxInDb, 'Unlinked transaction still exists');
  assert.strictEqual(unlinkedTxInDb.amount, 5000);
  console.log('  ✅ Test 8 Passed: Transaction unlinked cleanly without deletion');

  // ─────────────────────────────────────────────────────────
  // TEST 9: Editing Existing Transaction to Link/Change Liability
  // ─────────────────────────────────────────────────────────
  console.log('Running Test 9: Linking an Existing Standalone Transaction...');
  const standaloneTxId = res1.data.id;

  const reqLinkExisting = {
    user: { id: 'USER_A' },
    params: { id: standaloneTxId },
    body: {
      liabilityId: 'L_CAR_AUTO'
    }
  };
  const resLinkExisting = mockRes();
  await putTxHandler(reqLinkExisting, resLinkExisting, (err) => { if (err) throw err; });

  assert.strictEqual(resLinkExisting.statusCode, 200);
  assert.strictEqual(resLinkExisting.data.liabilityId, 'L_CAR_AUTO');

  // Check history of L_CAR_AUTO
  const reqAutoHist = { user: { id: 'USER_A' }, params: { id: 'L_CAR_AUTO' }, query: {} };
  const resAutoHist = mockRes();
  await getLiabilityTransactions(reqAutoHist, resAutoHist, (err) => { if (err) throw err; });

  assert.strictEqual(resAutoHist.data.data.transactions.length, 2);
  assert.strictEqual(resAutoHist.data.data.summary.totalPaid, 15500); // 15000 + 500
  console.log('  ✅ Test 9 Passed: Existing transaction successfully linked to liability via PUT');

  console.log('\n============================================================');
  console.log('  ALL 9 MANUAL LIABILITY LINKING TESTS PASSED SUCCESSFULLY!');
  console.log('============================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test Suite Failed with Error:', err);
  process.exit(1);
});

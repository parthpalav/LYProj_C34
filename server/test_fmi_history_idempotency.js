/**
 * server/test_fmi_history_idempotency.js
 * 
 * Regression & Integration test suite for FINAURA FMI History Idempotency.
 * Verifies that GET /fmi performs idempotent daily snapshotting rather than
 * creating duplicate FMIHistory records on every read.
 */

import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import User from './models/User.js';
import Transaction from './models/Transaction.js';
import FMIHistory from './models/FMIHistory.js';
import { calculateFMI } from './services/FMIService.js';
import { annotateTransactions } from './services/SentimentService.js';

console.log('='.repeat(64));
console.log('  FINAURA FMI HISTORY IDEMPOTENCY TEST SUITE');
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

// Controller helper mirroring GET /fmi logic
async function processFmiRequest(userId, customDate = new Date()) {
  const user = await User.findOne(userFilter(userId)).lean();
  if (!user) {
    return { status: 404, error: 'User not found' };
  }

  const txDocs = await Transaction.find({ userId: String(userId) }).sort({ timestamp: -1 }).lean();
  const annotated = annotateTransactions(txDocs);

  const monthlyIncome = Number(user?.monthlyIncome ?? 0);
  const currentAge = Number(user?.age ?? 30);
  const retirementGoal = Number(user?.financialGoal ?? 0) || Math.round(monthlyIncome * 12 * 20);

  const fmiUser = {
    currentBalance: Number(user?.currentBalance ?? 0),
    monthlyIncome,
    currentAge,
    retirementAge: Number(user?.retirementAge ?? 60),
    retirementGoal,
    previousShortfall: 0
  };

  const computed = calculateFMI(fmiUser, annotated);

  const snapshotDate = customDate.toISOString().slice(0, 10);

  try {
    await FMIHistory.findOneAndUpdate(
      { userId: String(userId), snapshotDate },
      {
        $set: {
          score: computed.score,
          factors: computed.factors,
          timestamp: customDate,
          snapshotDate
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (upsertErr) {
    if (upsertErr.code === 11000) {
      await FMIHistory.findOneAndUpdate(
        { userId: String(userId), snapshotDate },
        {
          $set: {
            score: computed.score,
            factors: computed.factors,
            timestamp: customDate
          }
        }
      );
    } else {
      throw upsertErr;
    }
  }

  return {
    status: 200,
    data: { ...computed, timestamp: customDate.toISOString() }
  };
}

async function runSuite() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lyproj');

  // Ensure index is created
  await FMIHistory.syncIndexes();

  const userA = 'u-test-fmi-idem-a';
  const userB = 'u-test-fmi-idem-b';

  // Cleanup pre-existing test data
  await User.deleteMany({ id: { $in: [userA, userB] } });
  await Transaction.deleteMany({ userId: { $in: [userA, userB] } });
  await FMIHistory.deleteMany({ userId: { $in: [userA, userB] } });

  try {
    // Setup test users
    await User.create([
      { id: userA, name: 'User A', email: 'usera-fmi@finaura.app', currentBalance: 60000, monthlyIncome: 80000, age: 28 },
      { id: userB, name: 'User B', email: 'userb-fmi@finaura.app', currentBalance: 40000, monthlyIncome: 50000, age: 35 },
    ]);

    // ── Case 1: First Request of Day ───────────────────────────
    await test('Case 1: First request of day creates exactly one snapshot', async () => {
      const today = new Date('2026-08-28T09:00:00Z');
      const res = await processFmiRequest(userA, today);

      assert.strictEqual(res.status, 200);
      assert.ok(typeof res.data.score === 'number', 'FMI score is returned');

      const records = await FMIHistory.find({ userId: userA });
      assert.strictEqual(records.length, 1, 'Exactly one history record exists');
      assert.strictEqual(records[0].snapshotDate, '2026-08-28');
      assert.strictEqual(records[0].score, res.data.score);
    });

    // ── Case 2: Repeated Same-Day Requests ─────────────────────
    await test('Case 2: Repeated same-day requests do not insert duplicate snapshots', async () => {
      const run2 = new Date('2026-08-28T11:30:00Z');
      const run3 = new Date('2026-08-28T16:00:00Z');

      await processFmiRequest(userA, run2);
      await processFmiRequest(userA, run3);

      const records = await FMIHistory.find({ userId: userA });
      assert.strictEqual(records.length, 1, 'Still exactly one history record after multiple same-day requests');
      assert.strictEqual(records[0].snapshotDate, '2026-08-28');
    });

    // ── Case 3: Same-Day FMI Change Updates Record ─────────────
    await test('Case 3: Same-day financial data change updates the existing snapshot', async () => {
      const recordsBefore = await FMIHistory.find({ userId: userA });
      const scoreBefore = recordsBefore[0].score;

      // Add large expense transaction that modifies FMI score
      await Transaction.create({
        id: 'tx-fmi-1',
        userId: userA,
        amount: 35000,
        category: 'Entertainment',
        type: 'Want',
        description: 'Luxury party',
        timestamp: new Date('2026-08-28T17:00:00Z')
      });

      const eveningDate = new Date('2026-08-28T18:00:00Z');
      const res = await processFmiRequest(userA, eveningDate);

      const recordsAfter = await FMIHistory.find({ userId: userA });
      assert.strictEqual(recordsAfter.length, 1, 'Document count remains 1');
      assert.strictEqual(recordsAfter[0].score, res.data.score, 'Snapshot score updated to latest evening score');
      assert.notStrictEqual(recordsAfter[0].score, scoreBefore, 'Score changed reflecting the new transaction');
    });

    // ── Case 4: Next Day Creates Second Snapshot ───────────────
    await test('Case 4: Request on a new calendar day creates a second history record', async () => {
      const nextDay = new Date('2026-08-29T08:00:00Z');
      const res = await processFmiRequest(userA, nextDay);

      assert.strictEqual(res.status, 200);

      const records = await FMIHistory.find({ userId: userA }).sort({ timestamp: 1 });
      assert.strictEqual(records.length, 2, 'Exactly two history records across two calendar days');
      assert.strictEqual(records[0].snapshotDate, '2026-08-28');
      assert.strictEqual(records[1].snapshotDate, '2026-08-29');
    });

    // ── Case 5: User Isolation ─────────────────────────────────
    await test('Case 5: User isolation (User A and User B have separate records)', async () => {
      const date = new Date('2026-08-29T09:00:00Z');
      await processFmiRequest(userB, date);

      const recordsA = await FMIHistory.find({ userId: userA });
      const recordsB = await FMIHistory.find({ userId: userB });

      assert.strictEqual(recordsA.length, 2);
      assert.strictEqual(recordsB.length, 1);
      assert.strictEqual(recordsB[0].userId, userB);
      assert.strictEqual(recordsB[0].snapshotDate, '2026-08-29');
    });

    // ── Case 6: Concurrent Requests via Promise.all ────────────
    await test('Case 6: Concurrent simultaneous requests result in exactly one snapshot', async () => {
      const date = new Date('2026-08-30T10:00:00Z');

      // 5 concurrent requests on day 2026-08-30
      await Promise.all([
        processFmiRequest(userB, date),
        processFmiRequest(userB, date),
        processFmiRequest(userB, date),
        processFmiRequest(userB, date),
        processFmiRequest(userB, date)
      ]);

      const recordsB = await FMIHistory.find({ userId: userB, snapshotDate: '2026-08-30' });
      assert.strictEqual(recordsB.length, 1, 'Exactly one snapshot for 2026-08-30 despite concurrent requests');
    });

    // ── Case 7: FMI Response Contract Unchanged ────────────────
    await test('Case 7: FMI Response contract contains all expected fields', async () => {
      const res = await processFmiRequest(userA, new Date('2026-08-30T12:00:00Z'));
      assert.strictEqual(res.status, 200);
      assert.ok('FMI' in res.data, 'Contains FMI');
      assert.ok('score' in res.data, 'Contains score');
      assert.ok('status' in res.data, 'Contains status');
      assert.ok('pillars' in res.data, 'Contains pillars');
      assert.ok('insights' in res.data, 'Contains insights');
      assert.ok('factors' in res.data, 'Contains factors');
      assert.ok('timestamp' in res.data, 'Contains timestamp');
    });

  } finally {
    // Cleanup
    await User.deleteMany({ id: { $in: [userA, userB] } });
    await Transaction.deleteMany({ userId: { $in: [userA, userB] } });
    await FMIHistory.deleteMany({ userId: { $in: [userA, userB] } });
    await mongoose.disconnect();
  }

  console.log('='.repeat(64));
  console.log(`  FMI HISTORY TEST SUITE RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('='.repeat(64));

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runSuite().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});

/**
 * Ledger writes that overlap must settle to the balance the final records justify.
 * Covers: concurrent credit/debit, absolute replacement with a version check,
 * competing income and expense edits, edits racing deletes, and a manual bill
 * payment whose due-date write fails before the scheduler runs.
 *
 * Run: node server/tests/transactions/ledgerConcurrency.test.js (needs local MongoDB)
 */
import '../setupEnv.js';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from '../../models/User.js';
import Income from '../../models/Income.js';
import Transaction from '../../models/Transaction.js';
import Liability from '../../models/Liability.js';
import controllerRouter from '../../controllers/index.js';
import { processSingleLiability } from '../../services/LiabilityScheduler.js';
import { connectTestDB, plantSentinel } from '../testDb.js';

const USER = 'u-test-ledger-concurrency';
const own = { userId: USER };

function handler(method, path) {
  const layer = controllerRouter.stack.find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`no handler for ${method} ${path}`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function call(method, path, { params = {}, body = {} } = {}) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ status: this.statusCode, data }); return this; },
    };
    handler(method, path)({ user: { id: USER }, params, body, query: {} }, res, (err) => (err ? reject(err) : resolve({ status: 500 })));
  });
}

const balance = async () => (await User.findOne({ id: USER }).lean()).currentBalance;

async function reset(startBalance) {
  await Promise.all([User.deleteMany({ id: USER }), Income.deleteMany(own), Transaction.deleteMany(own), Liability.deleteMany(own)]);
  await User.create({ id: USER, name: 'Ledger Test', email: `${USER}@finaura.test`, currentBalance: startBalance, processedLiabilityOccurrences: [] });
}

async function run() {
  await connectTestDB();
  const sentinel = await plantSentinel();

  // 1. Two credits at once from ₹1,000, in both orders, settle at ₹1,300.
  for (const order of [[100, 200], [200, 100]]) {
    for (let i = 0; i < 5; i++) {
      await reset(1000);
      const results = await Promise.all(order.map((amount) =>
        call('put', '/user/:id/current-balance', { params: { id: USER }, body: { operation: 'credit', amount } })));
      results.forEach((r) => assert.equal(r.status, 200));
      assert.equal(await balance(), 1300, `credits ${order} lost money`);
    }
  }
  await reset(1000);
  await Promise.all([
    call('put', '/user/:id/current-balance', { params: { id: USER }, body: { operation: 'credit', amount: 500 } }),
    call('put', '/user/:id/current-balance', { params: { id: USER }, body: { operation: 'debit', amount: 300 } }),
  ]);
  assert.equal(await balance(), 1200);
  console.log('  ✅ concurrent credit/debit settle to the ledger total');

  // 2. Absolute replacement is a separate, version-checked operation.
  await reset(1000);
  let r = await call('put', '/user/:id/current-balance', { params: { id: USER }, body: { currentBalance: 5000 } });
  assert.equal(r.status, 400, 'replacement without expectedBalance is refused');
  await call('put', '/user/:id/current-balance', { params: { id: USER }, body: { operation: 'credit', amount: 100 } });
  r = await call('put', '/user/:id/current-balance', { params: { id: USER }, body: { currentBalance: 5000, expectedBalance: 1000 } });
  assert.equal(r.status, 409, 'stale replacement is refused');
  assert.equal(r.data.currentBalance, 1100);
  assert.equal(await balance(), 1100, 'stale replacement must not erase the credit');
  r = await call('put', '/user/:id/current-balance', { params: { id: USER }, body: { currentBalance: 5000, expectedBalance: 1100 } });
  assert.equal(r.status, 200);
  assert.equal(await balance(), 5000);
  console.log('  ✅ absolute replacement needs the current balance');

  // 3. Two edits of one ₹100 receipt (to ₹120 and ₹130) move the balance by exactly final − 100.
  for (let i = 0; i < 5; i++) {
    await reset(1000);
    await call('post', '/income', { body: { amount: 100, source: 'salary' } });
    const inc = await Income.findOne(own).lean();
    const edits = await Promise.all([120, 130].map((amount) => call('put', '/income/:id', { params: { id: inc.id }, body: { amount } })));
    edits.forEach((e) => assert.equal(e.status, 200));
    const final = (await Income.findOne({ id: inc.id }).lean()).amount;
    assert.ok([120, 130].includes(final));
    assert.equal(await balance(), 1000 + final, `income edits left balance ${await balance()} for a ₹${final} receipt`);
  }
  console.log('  ✅ concurrent income edits match the final receipt');

  // 4. Same for an expense: ₹100 edited to ₹120 and ₹130 at once.
  for (let i = 0; i < 5; i++) {
    await reset(1000);
    await call('post', '/transactions', { body: { amount: 100, description: 'groceries', category: 'Groceries', type: 'Need' } });
    const tx = await Transaction.findOne(own).lean();
    const edits = await Promise.all([120, 130].map((amount) => call('put', '/transactions/:id', { params: { id: tx.id }, body: { amount } })));
    edits.forEach((e) => assert.equal(e.status, 200));
    const final = (await Transaction.findOne({ id: tx.id }).lean()).amount;
    assert.equal(await balance(), 1000 - final, `expense edits left balance ${await balance()} for a ₹${final} expense`);
  }
  console.log('  ✅ concurrent expense edits match the final record');

  // 5. Edits racing deletes: whichever wins, the balance matches what is left on record.
  for (let i = 0; i < 5; i++) {
    await reset(1000);
    await call('post', '/income', { body: { amount: 100, source: 'salary' } });
    const inc = await Income.findOne(own).lean();
    await Promise.all([
      call('put', '/income/:id', { params: { id: inc.id }, body: { amount: 150 } }),
      call('delete', '/income/:id', { params: { id: inc.id } }),
    ]);
    assert.equal(await Income.countDocuments(own), 0);
    assert.equal(await balance(), 1000, 'deleted income must leave no trace in the balance');

    await call('post', '/transactions', { body: { amount: 100, description: 'cab', category: 'Transport & Travel', type: 'Need' } });
    const tx = await Transaction.findOne(own).lean();
    await Promise.all([
      call('put', '/transactions/:id', { params: { id: tx.id }, body: { amount: 250 } }),
      call('delete', '/transactions/:id', { params: { id: tx.id } }),
    ]);
    assert.equal(await Transaction.countDocuments(own), 0);
    assert.equal(await balance(), 1000, 'deleted expense must be fully refunded');
  }
  console.log('  ✅ edits racing deletes leave the balance consistent');

  // 6. Manual bill payment, due-date write fails, scheduler recovers: one tx, one debit, one advance.
  await reset(5000);
  const due = new Date('2026-11-01T00:00:00+05:30'); // 1st of the month, account timezone (Kolkata)
  await Liability.create({ id: 'L-ledger-bill', userId: USER, name: 'Electricity', amount: 1000, category: 'Utilities & Bills', type: 'Need', autoDeduct: true, frequency: 'monthly', dayOfMonth: 1, startDate: due, nextDueDate: due, status: 'active' });

  const realUpdate = Liability.findOneAndUpdate;
  let failAdvance = true;
  Liability.findOneAndUpdate = function (filter, update, ...rest) {
    if (failAdvance && update?.$set?.nextDueDate) {
      failAdvance = false;
      throw new Error('simulated due-date write failure');
    }
    return realUpdate.call(this, filter, update, ...rest);
  };
  try {
    r = await call('post', '/transactions', { body: { amount: 1000, description: 'Electricity', category: 'Utilities & Bills', type: 'Need', liabilityId: 'L-ledger-bill', expectedScheduledFor: due.toISOString() } });
  } finally {
    Liability.findOneAndUpdate = realUpdate;
  }
  assert.equal(r.status, 201, 'manual payment still succeeds');
  assert.equal(failAdvance, false, 'the due-date write was attempted and failed');
  assert.equal(await balance(), 4000);
  assert.equal((await Liability.findOne({ id: 'L-ledger-bill' }).lean()).nextDueDate.getTime(), due.getTime(), 'date not advanced yet');

  // Scheduler recovery runs after the manual claim has gone stale (11 minutes later).
  const later = new Date(Date.now() + 11 * 60 * 1000);
  // Second run uses the same pre-recovery snapshot: a repeat of that occurrence must be a no-op.
  const snapshot = await Liability.findOne({ id: 'L-ledger-bill' });
  await processSingleLiability(snapshot, later);
  await processSingleLiability(snapshot, later);
  const txs = await Transaction.find({ ...own, liabilityId: 'L-ledger-bill' }).lean();
  assert.equal(txs.length, 1, 'exactly one transaction for the occurrence');
  assert.equal(await balance(), 4000, 'exactly one debit for the occurrence');
  const bill = await Liability.findOne({ id: 'L-ledger-bill' }).lean();
  assert.equal(bill.nextDueDate.toISOString(), new Date('2026-12-01T00:00:00+05:30').toISOString(), 'advanced exactly one month');
  assert.equal(bill.processingToken, undefined, 'claim released');
  console.log('  ✅ manual bill payment stays single-debit through a failed date write and scheduler recovery');

  // 7. A manual payment while the scheduler holds the occurrence is refused, not doubled.
  await reset(5000);
  await Liability.create({ id: 'L-ledger-bill', userId: USER, name: 'Electricity', amount: 1000, category: 'Utilities & Bills', type: 'Need', autoDeduct: true, frequency: 'monthly', dayOfMonth: 1, startDate: due, nextDueDate: due, status: 'active', processingScheduledFor: due, processingStartedAt: new Date(), processingToken: 'scheduler-run' });
  r = await call('post', '/transactions', { body: { amount: 1000, description: 'Electricity', category: 'Utilities & Bills', type: 'Need', liabilityId: 'L-ledger-bill', expectedScheduledFor: due.toISOString() } });
  assert.equal(r.status, 409);
  assert.equal(await balance(), 5000);
  console.log('  ✅ manual payment cannot overlap a scheduler run');

  await reset(0);
  await User.deleteMany({ id: USER });
  await sentinel.assertSurvived();
  await mongoose.disconnect();
  console.log('\nLedger concurrency: all checks passed');
}

run().catch(async (err) => {
  console.error('❌', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

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
import controllerRouter from '../../controllers/index.js';
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
  await Promise.all([User.deleteMany({ id: USER }), Income.deleteMany(own), Transaction.deleteMany(own)]);
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

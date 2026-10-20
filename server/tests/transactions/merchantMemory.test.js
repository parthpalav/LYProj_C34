/**
 * Per-user merchant memory: a manual correction is reused for the same merchant
 * on later transactions and classify previews, and never leaks across users.
 * Needs local MongoDB (MONGO_URI). ML service may be offline (keyword fallback is used).
 */

import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import 'dotenv/config';
import { connectDB } from '../../config/db.js';
import controllerRouter from '../../controllers/index.js';
import Transaction from '../../models/Transaction.js';
import User from '../../models/User.js';
import MerchantPreference from '../../models/MerchantPreference.js';
import { merchantKey } from '../../services/MerchantMemoryService.js';

function mockRes() {
  return {
    statusCode: 200,
    data: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.data = payload; return this; }
  };
}

function getHandler(method, path) {
  for (const layer of controllerRouter.stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
      const stack = layer.route.stack;
      return stack[stack.length - 1].handle; // skip rate limiters
    }
  }
  throw new Error(`Handler not found for ${method} ${path}`);
}

const fail = (err) => { if (err) throw err; };

async function run() {
  console.log('MERCHANT MEMORY TEST SUITE');

  // merchantKey must match ml-service/classifier/normalize.py for the same inputs
  assert.equal(merchantKey('UPI/DR/412345678/RAMESH KIRANA/okaxis'), 'ramesh kirana');
  assert.equal(merchantKey('POS 4521 RELIANCE SMART'), 'reliance smart');
  assert.equal(merchantKey('Zomato dinner order ₹450'), 'zomato dinner');
  assert.equal(merchantKey('500 Zomato dinner order'), 'zomato dinner');
  assert.equal(merchantKey('IMPS/P2A/309812345678/MOM/SBIN0001234'), 'mom');
  assert.equal(merchantKey('   '), '');
  console.log('  ✅ merchantKey normalisation');

  await connectDB();
  const users = ['MEM_USER_A', 'MEM_USER_B'];
  await Promise.all([
    Transaction.deleteMany({ userId: { $in: users } }),
    MerchantPreference.deleteMany({ userId: { $in: users } }),
    User.deleteMany({ id: { $in: users } })
  ]);
  await MerchantPreference.syncIndexes();
  await User.create(users.map((id) => ({ id, name: id, email: `${id.toLowerCase()}@example.com`, currentBalance: 100000 })));

  const post = getHandler('POST', '/transactions');
  const put = getHandler('PUT', '/transactions/:id');
  const classify = getHandler('POST', '/classify');

  // 1. First sighting: classified by ML / fallback
  const r1 = mockRes();
  await post({ user: { id: 'MEM_USER_A' }, body: { amount: 250, description: 'UPI/DR/412345678901/RAMESH KIRANA/okaxis' } }, r1, fail);
  assert.equal(r1.statusCode, 201);
  assert.notEqual(r1.data.categorySource, 'user_memory');

  // 2. User corrects it
  const r2 = mockRes();
  await put({ user: { id: 'MEM_USER_A' }, params: { id: r1.data.id }, body: { category: 'Groceries', type: 'Need' } }, r2, fail);
  assert.equal(r2.statusCode, 200);
  const pref = await MerchantPreference.findOne({ userId: 'MEM_USER_A', merchantKey: 'ramesh kirana' }).lean();
  assert.ok(pref, 'correction must be remembered');
  assert.equal(pref.category, 'Groceries');
  console.log('  ✅ PUT correction stores merchant preference');

  // 3. Same merchant, different UPI ref/handle: auto-labelled from memory
  await new Promise((r) => setTimeout(r, 5));
  const r3 = mockRes();
  await post({ user: { id: 'MEM_USER_A' }, body: { amount: 180, description: 'UPI/DR/998877665544/RAMESH KIRANA/ybl' } }, r3, fail);
  assert.equal(r3.statusCode, 201);
  assert.equal(r3.data.category, 'Groceries');
  assert.equal(r3.data.type, 'Need');
  assert.equal(r3.data.categorySource, 'user_memory');
  assert.equal(r3.data.needsReview, false);
  console.log('  ✅ POST reuses remembered label');

  // 4. Classify preview uses memory too
  const r4 = mockRes();
  await classify({ user: { id: 'MEM_USER_A' }, body: { text: '120 ramesh kirana' } }, r4, fail);
  assert.equal(r4.data.category, 'Groceries');
  assert.equal(r4.data.classificationSource, 'user_memory');
  assert.equal(r4.data.needsReview, false);
  console.log('  ✅ /classify preview reuses remembered label');

  // 5. Another user is unaffected
  const r5 = mockRes();
  await classify({ user: { id: 'MEM_USER_B' }, body: { text: 'ramesh kirana' } }, r5, fail);
  assert.notEqual(r5.data.classificationSource, 'user_memory');
  console.log('  ✅ memory is per user');

  // 6. Manual category on POST is learned directly
  await new Promise((r) => setTimeout(r, 5));
  const r6 = mockRes();
  await post({ user: { id: 'MEM_USER_B' }, body: { amount: 99, description: 'Cult fit monthly', category: 'Health', type: 'Want', categorySource: 'manual', typeSource: 'manual' } }, r6, fail);
  assert.equal(r6.statusCode, 201);
  assert.ok(await MerchantPreference.findOne({ userId: 'MEM_USER_B', merchantKey: 'cult fit' }));
  console.log('  ✅ manual POST stores merchant preference');

  await Promise.all([
    Transaction.deleteMany({ userId: { $in: users } }),
    MerchantPreference.deleteMany({ userId: { $in: users } }),
    User.deleteMany({ id: { $in: users } })
  ]);
  await mongoose.disconnect();
  console.log('ALL MERCHANT MEMORY TESTS PASSED');
}

run().catch(async (err) => {
  console.error('❌ FAILED:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

/**
 * Startup must never seed (and so never delete) on its own, and the explicit
 * seed must only touch the demo user's rows.
 *
 * Uses its own throwaway database, dropped at the start and end of the run.
 * Run: node server/tests/security/startupSeedSafety.test.js (needs local MongoDB)
 */
import '../setupEnv.js';
import assert from 'assert';
import mongoose from 'mongoose';
import { connectDB } from '../../config/db.js';
import { seedDatabase } from '../../utils/seedDatabase.js';
import User from '../../models/User.js';
import Transaction from '../../models/Transaction.js';
import Income from '../../models/Income.js';

const host = (process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/lyproj_test').replace(/\/[^/?]*(\?.*)?$/, '');
process.env.MONGO_URI = `${host}/lyproj_test_seed_safety`;

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.dropDatabase();

  // A partially restored database: no users yet, but real records survive.
  await Transaction.create({ id: 'sentinel-tx', userId: 'restored-user', amount: 999, category: 'Misc', type: 'Need', description: 'sentinel', timestamp: new Date() });
  await Income.create({ id: 'sentinel-inc', userId: 'restored-user', amount: 5000, source: 'salary', timestamp: new Date() });
  await mongoose.disconnect();

  await connectDB();
  assert.strictEqual(await User.countDocuments(), 0, 'startup must not create the demo user');
  assert.ok(await Transaction.exists({ id: 'sentinel-tx' }), 'startup kept the sentinel transaction');
  assert.ok(await Income.exists({ id: 'sentinel-inc' }), 'startup kept the sentinel income');
  console.log('  ✅ startup with an empty users collection leaves records alone');

  process.env.SEED_USER_PASSWORD = 'seed-safety-test-pass';
  await seedDatabase();
  assert.ok(await User.exists({ id: 'u1' }), 'explicit seed creates the demo user');
  assert.ok(await Transaction.exists({ id: 'sentinel-tx' }), 'seed kept the other user\'s transaction');
  assert.ok(await Income.exists({ id: 'sentinel-inc' }), 'seed kept the other user\'s income');
  assert.ok((await Transaction.countDocuments({ userId: 'u1' })) > 0, 'seed wrote demo transactions');
  console.log('  ✅ explicit seed replaces only demo-user rows');

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('\nStartup seed safety: all checks passed');
}

run().catch(async (err) => {
  console.error('❌', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

/**
 * Database connection for server test suites.
 *
 * Suites create and delete fixtures, so they only run against a disposable
 * database. TEST_MONGO_URI picks it; MONGO_URI is ignored on purpose because
 * server/.env points it at the development data.
 */
import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import 'dotenv/config';
import Transaction from '../models/Transaction.js';

export const TEST_MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/lyproj_test';

export function assertDisposableDbName(name) {
  if (!/test/i.test(name || '')) {
    throw new Error(`Refusing to run tests against database "${name}". Use a disposable database whose name contains "test" (set TEST_MONGO_URI).`);
  }
}

export async function connectTestDB() {
  // Code under test that reads config.MONGO_URI must see the same database.
  process.env.MONGO_URI = TEST_MONGO_URI;
  await mongoose.connect(TEST_MONGO_URI);
  try {
    assertDisposableDbName(mongoose.connection.name);
  } catch (err) {
    await mongoose.disconnect();
    throw err;
  }
}

/** A record that belongs to nobody in the suite; cleanup must never remove it. */
export async function plantSentinel() {
  const id = `SENTINEL_${process.pid}_${Date.now()}`;
  await Transaction.create({ id, userId: 'SENTINEL_USER', amount: 1, category: 'Misc', type: 'Need', description: 'test sentinel', timestamp: new Date() });
  return {
    async assertSurvived() {
      assert.ok(await Transaction.exists({ id }), 'suite cleanup deleted a record it does not own');
      await Transaction.deleteOne({ id });
    }
  };
}

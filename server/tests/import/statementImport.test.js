/**
 * Statement import and SMS capture, end to end through the controllers.
 * Needs local MongoDB (MONGO_URI). Gemini is switched off so the local PDF parser runs;
 * the ML service may be offline (keyword fallback is used).
 */
import '../setupEnv.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import mongoose from 'mongoose';
import 'dotenv/config';
import { connectDB } from '../../config/db.js';
import controllerRouter from '../../controllers/index.js';
import * as auto from '../../controllers/autoInputController.js';
import Transaction from '../../models/Transaction.js';
import Income from '../../models/Income.js';
import User from '../../models/User.js';
import CapturedTransaction from '../../models/CapturedTransaction.js';
import MerchantPreference from '../../models/MerchantPreference.js';

const FIXTURES = new URL('./fixtures/', import.meta.url);
const pdf = (name) => fs.readFileSync(new URL(name, FIXTURES)).toString('base64');
const A = 'IMP_USER_A';
const B = 'IMP_USER_B';

function mockRes() {
  return {
    statusCode: 200,
    data: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.data = payload; return this; },
  };
}
const fail = (err) => { if (err) throw err; };
async function call(handler, req) {
  const res = mockRes();
  await handler({ headers: {}, params: {}, body: {}, ...req }, res, fail);
  return res;
}
function getHandler(method, path) {
  for (const layer of controllerRouter.stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
      const stack = layer.route.stack;
      return stack[stack.length - 1].handle;
    }
  }
  throw new Error(`Handler not found for ${method} ${path}`);
}

async function run() {
  console.log('STATEMENT IMPORT + SMS CAPTURE TEST SUITE');
  process.env.GEMINI_API_KEY = ''; // force the local fallback path

  await connectDB();
  const users = [A, B];
  await Promise.all([
    Transaction.deleteMany({ userId: { $in: users } }),
    Income.deleteMany({ userId: { $in: users } }),
    CapturedTransaction.deleteMany({ userId: { $in: users } }),
    MerchantPreference.deleteMany({ userId: { $in: users } }),
    User.deleteMany({ id: { $in: users } }),
  ]);
  await Promise.all([Transaction.syncIndexes(), Income.syncIndexes(), User.syncIndexes(), CapturedTransaction.syncIndexes()]);
  await User.create(users.map((id) => ({ id, name: id, email: `${id.toLowerCase()}@example.com`, currentBalance: 50000 })));
  const balance = async () => (await User.findOne({ id: A }).lean()).currentBalance;

  // 1. CSV preview
  const csv = [
    'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance',
    '20/10/26,UPI-ZOMATO-zomato@hdfc-610012345678,0001,20/10/26,777.00,,"9,223.00"',
    '21/10/26,NEFT CR-ACME SALARY,N1,21/10/26,,"1,000.00","10,223.00"',
  ].join('\n');
  await Transaction.create({ id: 'imp-manual-1', userId: A, amount: 777, category: 'Food & Dining', type: 'Want', timestamp: new Date('2026-10-20T10:00:00Z') });
  const c1 = await call(auto.previewStatement, { user: { id: A }, body: { fileName: 'hdfc.csv', mimeType: 'text/csv', data: Buffer.from(csv).toString('base64') } });
  assert.equal(c1.statusCode, 200, JSON.stringify(c1.data));
  assert.equal(c1.data.parser, 'csv');
  assert.equal(c1.data.rows.length, 2);
  assert.equal(c1.data.rows[0].duplicate, 'possible', 'same amount, same day as a manual entry');
  assert.equal(c1.data.rows[1].duplicate, null);
  assert.ok(c1.data.rows[0].category, 'debits get a category');
  assert.equal(c1.data.rows[1].source, 'salary');
  console.log('  ✅ CSV preview: classified, manual duplicate flagged');

  // 2. Password-protected PDF
  const locked = await call(auto.previewStatement, { user: { id: A }, body: { fileName: 's.pdf', mimeType: 'application/pdf', data: pdf('statement-locked.pdf') } });
  assert.equal(locked.statusCode, 422);
  assert.equal(locked.data.code, 'PASSWORD_REQUIRED');
  const wrong = await call(auto.previewStatement, { user: { id: A }, body: { fileName: 's.pdf', mimeType: 'application/pdf', data: pdf('statement-locked.pdf'), password: 'nope' } });
  assert.equal(wrong.data.code, 'PASSWORD_INCORRECT');
  const p1 = await call(auto.previewStatement, { user: { id: A }, body: { fileName: 's.pdf', mimeType: 'application/pdf', data: pdf('statement-locked.pdf'), password: 'demo1234' } });
  assert.equal(p1.statusCode, 200, JSON.stringify(p1.data));
  assert.equal(p1.data.parser, 'local');
  assert.equal(p1.data.rows.length, 6);
  assert.equal(p1.data.summary.closingBalance, 101046.5);
  assert.equal(p1.data.summary.credits, 92000);
  assert.equal(p1.data.summary.last4, '4821');
  console.log('  ✅ PDF preview: password handling, local fallback parser');

  // 3. Commit with one user edit: history only, balance untouched
  const rows = p1.data.rows.map((r) => (/DMART/.test(r.description) ? { ...r, category: 'Groceries', type: 'Need', userEdited: true } : r));
  const c2 = await call(auto.commitStatement, { user: { id: A }, body: { rows, paymentMethodId: null } });
  assert.equal(c2.statusCode, 201, JSON.stringify(c2.data));
  assert.equal(c2.data.insertedTransactions, 5);
  assert.equal(c2.data.insertedIncome, 1);
  assert.equal(await balance(), 50000);
  const dmart = await Transaction.findOne({ userId: A, description: /DMART/ }).lean();
  assert.equal(dmart.category, 'Groceries');
  assert.equal(dmart.classificationSource, 'manual');
  assert.ok(await MerchantPreference.findOne({ userId: A, category: 'Groceries' }), 'edit is remembered');
  console.log('  ✅ commit writes history, keeps balance, learns edits');

  // 4. Re-import is a no-op
  const p2 = await call(auto.previewStatement, { user: { id: A }, body: { fileName: 's.pdf', mimeType: 'application/pdf', data: pdf('statement.pdf') } });
  assert.ok(p2.data.rows.every((r) => r.duplicate === 'imported'), 'unlocked copy of the same statement is recognised');
  const c3 = await call(auto.commitStatement, { user: { id: A }, body: { rows: p2.data.rows, paymentMethodId: null } });
  assert.equal(c3.data.insertedTransactions + c3.data.insertedIncome, 0);
  assert.equal(c3.data.skipped, 6);
  console.log('  ✅ re-import skipped as duplicates');

  // 5. Undo is per user
  const other = await call(auto.undoImport, { user: { id: B }, params: { batchId: c2.data.batchId } });
  assert.equal(other.statusCode, 404);
  const undo = await call(auto.undoImport, { user: { id: A }, params: { batchId: c2.data.batchId } });
  assert.deepEqual(undo.data, { deletedTransactions: 5, deletedIncome: 1 });
  assert.equal(await Transaction.countDocuments({ userId: A, importBatchId: { $ne: null } }), 0);
  console.log('  ✅ undo removes only the owner\'s batch');

  // 6. Opt-in closing balance
  const c4 = await call(auto.commitStatement, { user: { id: A }, body: { rows: p1.data.rows, paymentMethodId: null, setClosingBalance: true, closingBalance: p1.data.summary.closingBalance } });
  assert.equal(c4.data.balanceSetTo, 101046.5);
  assert.equal(await balance(), 101046.5);
  const bad = await call(auto.commitStatement, { user: { id: A }, body: { rows: [{ ...p1.data.rows[0], amount: -5 }] } });
  assert.equal(bad.statusCode, 400);
  console.log('  ✅ closing balance only when asked; bad rows rejected');

  // 7. SMS capture via personal token
  const tok = await call(auto.createSmsToken, { user: { id: A } });
  assert.match(tok.data.token, /^fsms_/);
  const stored = await User.findOne({ id: A }).select('+smsIngestTokenHash').lean();
  assert.notEqual(stored.smsIngestTokenHash, tok.data.token, 'only the hash is stored');
  const sms = 'Sent Rs.250.00\nFrom HDFC Bank A/C *1234\nTo SWIGGY\nOn 12/11/26\nRef 612345678901';
  const ingest = (token, text) => call(auto.ingestSms, { headers: { authorization: `Bearer ${token}` }, body: { text } });
  assert.equal((await ingest('fsms_' + 'x'.repeat(43), sms)).statusCode, 401);
  const i1 = await ingest(tok.data.token, sms);
  assert.equal(i1.statusCode, 201, JSON.stringify(i1.data));
  assert.equal((await ingest(tok.data.token, sms)).data.duplicate, true);
  assert.equal((await ingest(tok.data.token, '482913 is your OTP for Rs 100 at AMAZON')).data.ignored, 'NOT_TRANSACTION');
  const list = await call(auto.listCaptured, { user: { id: A } });
  assert.equal(list.data.length, 1);
  assert.equal(list.data[0].amount, 250);
  assert.equal(list.data[0].textHash, undefined);

  const before = await balance();
  const post = getHandler('POST', '/transactions');
  const captureId = list.data[0].id;
  const confirm = () => call(post, { user: { id: A }, body: { amount: 250, description: 'SWIGGY', category: 'Food & Dining', type: 'Want', capturedId: captureId } });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (hello.setName || hello.msg === 'isdbgrid') {
    const [first, second] = await Promise.all([confirm(), confirm()]);
    assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 201]);
    assert.equal(first.data.id, second.data.id);
    assert.equal(await balance(), before - 250, 'confirmed capture debits exactly once');
    assert.equal(await Transaction.countDocuments({ userId: A, id: first.data.id }), 1);
    assert.equal((await CapturedTransaction.findOne({ id: captureId }).lean()).status, 'confirmed');

    const credit = await ingest(tok.data.token, 'Rs 1400 credited to A/c XX1234 by NEFT from ACME on 13/11/26');
    assert.equal(credit.statusCode, 201);
    assert.equal(credit.data.captured.direction, 'credit');
    const postIncome = getHandler('POST', '/income');
    const receive = () => call(postIncome, { user: { id: A }, body: { amount: 1400, source: 'salary', capturedId: credit.data.captured.id } });
    const [creditFirst, creditSecond] = await Promise.all([receive(), receive()]);
    assert.deepEqual([creditFirst.statusCode, creditSecond.statusCode].sort(), [200, 201]);
    assert.equal(creditFirst.data.id, creditSecond.data.id);
    assert.equal(await balance(), before - 250 + 1400, 'confirmed capture credits exactly once');
  } else {
    assert.equal((await confirm()).statusCode, 503);
    assert.equal(await balance(), before, 'standalone cannot move money for a capture');
    assert.equal((await CapturedTransaction.findOne({ id: captureId }).lean()).status, 'pending');
    console.log('  ℹ️ Capture persistence requires a replica set. Standalone fail-closed path verified.');
  }
  assert.equal((await call(auto.dismissCaptured, { user: { id: B }, params: { id: captureId } })).statusCode, 404);

  await call(auto.revokeSmsToken, { user: { id: A } });
  assert.equal((await ingest(tok.data.token, 'Rs 10 debited from A/c XX1234 to CHAI')).statusCode, 401);
  console.log('  ✅ SMS ingest: token auth, dedupe, ignore OTP, confirm, revoke');

  await Promise.all([
    Transaction.deleteMany({ userId: { $in: users } }),
    Income.deleteMany({ userId: { $in: users } }),
    CapturedTransaction.deleteMany({ userId: { $in: users } }),
    MerchantPreference.deleteMany({ userId: { $in: users } }),
    User.deleteMany({ id: { $in: users } }),
  ]);
  console.log('ALL STATEMENT IMPORT TESTS PASSED');
}

run()
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
  });

// Controller checks: SIP, FD/RD tenure + computed value, monthly review stamp, liability loan details.
// Needs MongoDB. Run: node server/tests/assets/assetPlanFields.test.js
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Asset from '../../models/Asset.js';
import Liability from '../../models/Liability.js';
import { createAsset, updateAsset, getAssets } from '../../controllers/assetController.js';
import { createLiability, updateLiability } from '../../controllers/liabilityController.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lyproj';
const userId = 'test-asset-plan-' + Date.now();

async function call(handler, body = {}, params = {}) {
  let status = 200;
  let payload;
  const res = { status(c) { status = c; return this; }, json(p) { payload = p; return this; } };
  await handler({ user: { id: userId }, body, params }, res, (err) => { throw err; });
  return { status, body: payload };
}

const base = { assetClass: 'FIRE_INVESTABLE', includedInFireCorpus: true, liquidity: 'locked' };

async function main() {
  await mongoose.connect(MONGO_URI);
  try {
    // SIP on a mutual fund is stored; review stamp set on create.
    const mf = await call(createAsset, { ...base, name: 'Index Fund', assetType: 'Mutual Fund', currentValue: 50000, annualReturnRate: 12, monthlyContribution: 5000 });
    assert.equal(mf.status, 201);
    assert.equal(mf.body.data.monthlyContribution, 5000);
    assert.ok(mf.body.data.lastReviewedAt);

    // FD: value computed from deposit, rate, start and tenure; currentValue not needed.
    const start = new Date(Date.now() - 365 * 86_400_000).toISOString();
    const fd = await call(createAsset, { ...base, name: 'SBI FD', assetType: 'Fixed Deposit', principal: 100000, annualReturnRate: 7, startDate: start, tenureMonths: 24 });
    assert.equal(fd.status, 201, JSON.stringify(fd.body));
    assert.ok(fd.body.data.currentValue > 107000 && fd.body.data.currentValue < 107300, String(fd.body.data.currentValue));
    assert.ok(fd.body.data.maturityValue > fd.body.data.currentValue);
    assert.ok(fd.body.data.maturityDate);

    // RD uses the monthly installment.
    const rd = await call(createAsset, { ...base, name: 'Post RD', assetType: 'Recurring Deposit', monthlyContribution: 2000, annualReturnRate: 6.7, startDate: start, tenureMonths: 60 });
    assert.equal(rd.status, 201, JSON.stringify(rd.body));
    assert.ok(rd.body.data.currentValue > 24000, String(rd.body.data.currentValue));
    assert.equal(rd.body.data.liquidity, "locked"); // deposits default to locked
    assert.equal(fd.body.data.liquidity, "locked");

    // Partial FD details are rejected; future start and bad tenure too.
    assert.equal((await call(createAsset, { ...base, name: 'Bad FD', assetType: 'Fixed Deposit', principal: 1000, annualReturnRate: 7 })).body.code, 'INCOMPLETE_FIXED_INCOME');
    assert.equal((await call(createAsset, { ...base, name: "No-rate FD", assetType: "Fixed Deposit", principal: 1000, startDate: start, tenureMonths: 12 })).body.code, "INCOMPLETE_FIXED_INCOME");
    assert.equal((await call(createAsset, { ...base, name: 'Bad FD', assetType: 'Fixed Deposit', principal: 1000, annualReturnRate: 7, startDate: '2999-01-01', tenureMonths: 12 })).body.code, 'INVALID_START_DATE');
    assert.equal((await call(createAsset, { ...base, name: 'Bad FD', assetType: 'Fixed Deposit', principal: 1000, annualReturnRate: 7, startDate: start, tenureMonths: 1.5 })).body.code, 'INVALID_TENURE');
    // Legacy-style FD with only a manual value still works (mobile app).
    assert.equal((await call(createAsset, { ...base, name: 'Old FD', assetType: 'Fixed Deposit', currentValue: 30000, annualReturnRate: 6 })).status, 201);

    // A stale stored FD value is refreshed on read.
    await Asset.updateOne({ id: fd.body.data.id }, { $set: { currentValue: 1 } });
    const list = await call(getAssets);
    const fdRead = list.body.data.find((a) => a.id === fd.body.data.id);
    assert.equal(fdRead.currentValue, fd.body.data.currentValue);
    assert.equal((await Asset.findOne({ id: fd.body.data.id }).lean()).currentValue, fd.body.data.currentValue);

    // Monthly check-in: updating value stamps lastReviewedAt; renaming does not.
    const old = new Date('2026-01-01T00:00:00Z');
    await Asset.updateOne({ id: mf.body.data.id }, { $set: { lastReviewedAt: old } });
    await call(updateAsset, { name: 'Index Fund Direct' }, { id: mf.body.data.id });
    assert.equal((await Asset.findOne({ id: mf.body.data.id }).lean()).lastReviewedAt.toISOString(), old.toISOString());
    const reviewed = await call(updateAsset, { currentValue: 56000, annualReturnRate: 0.11 }, { id: mf.body.data.id });
    assert.equal(reviewed.body.data.currentValue, 56000);
    assert.ok(new Date(reviewed.body.data.lastReviewedAt) > old);

    // Switching an FD to a market type drops deposit-only fields.
    const switched = await call(updateAsset, { assetType: 'Equity', currentValue: 90000 }, { id: fd.body.data.id });
    assert.equal(switched.body.data.tenureMonths, null);
    assert.equal(switched.body.data.principal, null);
    assert.equal(switched.body.data.currentValue, 90000);

    // Liability loan details round-trip; percent normalised to fraction; bad values rejected.
    const loan = await call(createLiability, {
      name: 'Car Loan EMI', amount: 12000, category: 'Debt & Loan Payments', type: 'Need', frequency: 'monthly',
      dayOfMonth: 5, autoDeduct: true, startDate: new Date().toISOString(), outstandingBalance: 350000, interestRate: 9.5, remainingTermMonths: 32
    });
    assert.equal(loan.status, 201, JSON.stringify(loan.body));
    assert.equal(loan.body.data.outstandingBalance, 350000);
    assert.equal(loan.body.data.interestRate, 0.095);
    assert.equal(loan.body.data.remainingTermMonths, 32);
    assert.ok(loan.body.data.nextDueDate);
    const cleared = await call(updateLiability, { outstandingBalance: null, remainingTermMonths: 31 }, { id: loan.body.data.id });
    assert.equal(cleared.body.data.outstandingBalance, null);
    assert.equal(cleared.body.data.remainingTermMonths, 31);
    assert.equal((await call(updateLiability, { remainingTermMonths: -1 }, { id: loan.body.data.id })).status, 400);

    console.log('assetPlanFields checks passed');
  } finally {
    await Asset.deleteMany({ userId });
    await Liability.deleteMany({ userId });
    await mongoose.disconnect();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

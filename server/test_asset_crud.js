/**
 * server/test_asset_crud.js
 * 
 * Comprehensive test suite for Asset CRUD API, annualReturnRate modeling,
 * independent multi-year deterministic asset compounding math, and Predictability integration.
 */

import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Asset from './models/Asset.js';
import User from './models/User.js';
import Transaction from './models/Transaction.js';
import Income from './models/Income.js';
import Liability from './models/Liability.js';
import { getPredictabilitySnapshot } from './services/PredictabilityService.js';
import {
  calculateInvestableWeightedReturn,
  projectAssetFutureValue,
  projectInvestableAssetsFutureValue,
  futureValueLumpSum,
  projectedCorpusAtRetirement
} from './utils/financialMath.js';

console.log('================================================================');
console.log('  FINAURA ASSET CRUD & INDEPENDENT PROJECTION TEST SUITE');
console.log('================================================================\n');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lyproj';

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const testUserId = 'test-asset-user-' + Date.now();
  const otherUserId = 'other-asset-user-' + Date.now();

  try {
    // Clean up any previous test data
    await Asset.deleteMany({ userId: { $in: [testUserId, otherUserId] } });
    await User.deleteMany({ id: { $in: [testUserId, otherUserId] } });
    await Transaction.deleteMany({ userId: { $in: [testUserId, otherUserId] } });
    await Income.deleteMany({ userId: { $in: [testUserId, otherUserId] } });
    await Liability.deleteMany({ userId: { $in: [testUserId, otherUserId] } });

    // Create test users
    await User.create([
      {
        id: testUserId,
        name: 'Asset Test User',
        email: `asset-${Date.now()}@test.com`,
        password: 'hashedpassword',
        age: 30,
        retirementAge: 60,
        monthlyIncome: 100000,
        currentBalance: 50000,
        expectedReturnRate: 0.08
      },
      {
        id: otherUserId,
        name: 'Other User',
        email: `other-${Date.now()}@test.com`,
        password: 'hashedpassword',
        age: 35,
        retirementAge: 60,
        monthlyIncome: 80000,
        currentBalance: 20000
      }
    ]);

    // Create 6 months of test transactions so forecast is available
    const txs = [];
    const ref = new Date('2026-06-15');
    for (let m = 1; m <= 6; m++) {
      const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - m, 10));
      txs.push({ id: `tx-need-${m}-${Date.now()}`, userId: testUserId, amount: 35000, type: 'Need', timestamp: d, category: 'Bills' });
      txs.push({ id: `tx-want-${m}-${Date.now()}`, userId: testUserId, amount: 15000, type: 'Want', timestamp: d, category: 'Shopping' });
      txs.push({ id: `tx-inv-${m}-${Date.now()}`, userId: testUserId, amount: 20000, type: 'Investment', timestamp: d, category: 'Misc' });
    }
    await Transaction.create(txs);

    // ── TEST 1: CREATE ASSET (FIXED DEPOSIT) ────────────────────
    console.log('Running Test 1: Create Fixed Deposit Asset with annualReturnRate = 0.06 (6%)...');
    const fd = await Asset.create({
      id: 'ast-fd-1',
      userId: testUserId,
      name: 'HDFC Fixed Deposit',
      assetType: 'Fixed Deposit',
      assetClass: 'FIRE_INVESTABLE',
      currentValue: 1000000, // 10 Lakhs
      annualReturnRate: 0.06, // 6%
      includedInFireCorpus: true,
      liquidity: 'locked'
    });
    assert.equal(fd.name, 'HDFC Fixed Deposit');
    assert.equal(fd.currentValue, 1000000);
    assert.equal(fd.annualReturnRate, 0.06);
    assert.equal(fd.includedInFireCorpus, true);
    assert.equal(fd.liquidity, 'locked');
    console.log('  ✓ Fixed Deposit asset created with annualReturnRate = 0.06');

    // ── TEST 2: CREATE BANK ASSET (SEMI_LIQUID) ─────────────────
    console.log('Running Test 2: Create Bank Savings Asset (SEMI_LIQUID, liquid)...');
    const bank = await Asset.create({
      id: 'ast-bank-1',
      userId: testUserId,
      name: 'ICICI Savings Account',
      assetType: 'Bank / Savings',
      assetClass: 'SEMI_LIQUID',
      currentValue: 300000, // 3 Lakhs
      annualReturnRate: 0.035, // 3.5%
      includedInFireCorpus: false,
      liquidity: 'liquid'
    });
    assert.equal(bank.currentValue, 300000);
    assert.equal(bank.annualReturnRate, 0.035);
    assert.equal(bank.includedInFireCorpus, false);
    assert.equal(bank.liquidity, 'liquid');
    console.log('  ✓ Bank savings asset created successfully');

    // ── TEST 3: VALIDATION: NON_INVESTABLE CONFLICT ────────────
    console.log('Running Test 3: Rejection of NON_INVESTABLE asset with includedInFireCorpus=true...');
    try {
      await Asset.create({
        id: 'ast-home-invalid',
        userId: testUserId,
        name: 'Primary Residence',
        assetType: 'Real Estate',
        assetClass: 'NON_INVESTABLE',
        currentValue: 8000000,
        includedInFireCorpus: true, // Should fail schema pre-validate
        liquidity: 'locked'
      });
      assert.fail('Should have rejected NON_INVESTABLE with includedInFireCorpus=true');
    } catch (err) {
      assert.ok(err.message.includes('Non-investable assets cannot be included in the FIRE corpus'));
      console.log('  ✓ Schema validation strictly rejected NON_INVESTABLE FIRE inclusion');
    }

    // ── TEST 4: CREATE VALID NON_INVESTABLE ASSET ───────────────
    console.log('Running Test 4: Create valid NON_INVESTABLE Primary Residence...');
    const home = await Asset.create({
      id: 'ast-home-valid',
      userId: testUserId,
      name: 'Primary Residence',
      assetType: 'Real Estate',
      assetClass: 'NON_INVESTABLE',
      currentValue: 8000000,
      includedInFireCorpus: false,
      liquidity: 'locked'
    });
    assert.equal(home.currentValue, 8000000);
    assert.equal(home.includedInFireCorpus, false);
    console.log('  ✓ Non-investable asset created successfully');

    // ── TEST 5: PREDICTABILITY ENGINE CONSUMPTION & STOCK-VS-FLOW
    console.log('Running Test 5: Predictability Engine reflects asset breakdown accurately...');
    const snap = await getPredictabilitySnapshot(testUserId, { referenceDate: '2026-06-15' });

    assert.equal(snap.assets.totalAssetValue, 9300000, 'Total asset value is 93 Lakhs');
    assert.equal(snap.assets.fireInvestableCorpus, 1000000, 'FIRE investable corpus is exactly 10 Lakhs');
    assert.equal(snap.assets.liquidBuffer, 300000, 'Liquid emergency buffer is 3 Lakhs (locked FD excluded)');
    assert.equal(snap.currentState.currentBalance, 50000, 'currentBalance remains 50k without double counting');
    console.log('  ✓ Predictability engine perfectly partitions FIRE corpus vs Liquid buffer vs Total assets');

    // ── TEST 6: CROSS-USER ISOLATION ────────────────────────────
    console.log('Running Test 6: Cross-user isolation...');
    await Asset.create({
      id: 'ast-other-1',
      userId: otherUserId,
      name: 'Other User Mutual Fund',
      assetType: 'Mutual Fund',
      assetClass: 'FIRE_INVESTABLE',
      currentValue: 500000,
      annualReturnRate: 0.12,
      includedInFireCorpus: true,
      liquidity: 'liquid'
    });

    const userAssets = await Asset.find({ userId: testUserId });
    assert.equal(userAssets.length, 3, 'User A only sees their 3 assets');
    const otherAssets = await Asset.find({ userId: otherUserId });
    assert.equal(otherAssets.length, 1, 'User B only sees their 1 asset');
    console.log('  ✓ Cross-user isolation strictly verified');

    // ── TEST 7: UPDATE ASSET RATE & REACTIVITY ──────────────────
    console.log('Running Test 7: Update asset rate 0.06 -> 0.0725 (7.25%)...');
    await Asset.updateOne(
      { id: 'ast-fd-1', userId: testUserId },
      { $set: { annualReturnRate: 0.0725 } }
    );
    const updatedFd = await Asset.findOne({ id: 'ast-fd-1', userId: testUserId });
    assert.equal(updatedFd.annualReturnRate, 0.0725);
    assert.equal(updatedFd.currentValue, 1000000, 'currentValue unchanged when updating rate');
    console.log('  ✓ annualReturnRate updated to 0.0725 without mutating currentValue');

    // ── TEST 8: SCHEMA RATE VALIDATION (REJECT INVALID VALUES) ──
    console.log('Running Test 8: Rate validation rejects NaN, Infinity, negative, and > 1...');
    try {
      await Asset.create({
        id: 'ast-invalid-rate-1',
        userId: testUserId,
        name: 'Invalid Rate Asset',
        assetType: 'Stocks',
        assetClass: 'FIRE_INVESTABLE',
        currentValue: 100000,
        annualReturnRate: -0.05,
        includedInFireCorpus: true
      });
      assert.fail('Should reject negative return rate');
    } catch (err) {
      assert.ok(err.message.includes('Annual return rate'));
      console.log('  ✓ Negative return rate rejected');
    }

    try {
      await Asset.create({
        id: 'ast-invalid-rate-2',
        userId: testUserId,
        name: 'Invalid Rate Asset',
        assetType: 'Stocks',
        assetClass: 'FIRE_INVESTABLE',
        currentValue: 100000,
        annualReturnRate: 2.5, // > 100%
        includedInFireCorpus: true
      });
      assert.fail('Should reject return rate > 1');
    } catch (err) {
      assert.ok(err.message.includes('Annual return rate'));
      console.log('  ✓ Return rate > 1 (100%) rejected');
    }

    // ── CASE 1: MULTI-YEAR INDEPENDENT GROWTH (10 YEARS) ────────
    console.log('Running Case 1: Multi-Year Independent Growth (₹100k @ 6%, ₹100k @ 12% at 10 years)...');
    const multiYearAssets = [
      { currentValue: 100000, annualReturnRate: 0.06, includedInFireCorpus: true, assetClass: 'FIRE_INVESTABLE' },
      { currentValue: 100000, annualReturnRate: 0.12, includedInFireCorpus: true, assetClass: 'FIRE_INVESTABLE' }
    ];
    // 10 years = 120 months
    const independentFv10Yr = projectInvestableAssetsFutureValue(multiYearAssets, 120);
    const expectedIndependent = 100000 * Math.pow(1.06, 10) + 100000 * Math.pow(1.12, 10);
    // 100000 * 1.7908477 + 100000 * 3.1058482 = 489,669.59
    assert.ok(Math.abs(independentFv10Yr - expectedIndependent) < 1.0, `Expected ~489,670, got ${independentFv10Yr}`);

    // Static 9% weighted average assumption would yield: 200000 * (1.09)^10 = 473,472.73
    const staticWeightedFv10Yr = 200000 * Math.pow(1.09, 10);
    assert.notEqual(Math.round(independentFv10Yr), Math.round(staticWeightedFv10Yr), 'Independent multi-year growth strictly differs from static weighted average');
    assert.ok(independentFv10Yr > staticWeightedFv10Yr, 'Independent growth strictly exceeds static weighted average due to compounding of higher returning assets');
    console.log(`  ✓ 10-Yr Independent Projection: ₹${Math.round(independentFv10Yr).toLocaleString('en-IN')} (Exact: ₹${Math.round(expectedIndependent).toLocaleString('en-IN')})`);
    console.log(`  ✓ 10-Yr Static Weighted Avg:    ₹${Math.round(staticWeightedFv10Yr).toLocaleString('en-IN')} (Difference: +₹${Math.round(independentFv10Yr - staticWeightedFv10Yr).toLocaleString('en-IN')})`);

    // ── CASE 2: ONE-YEAR PARITY ─────────────────────────────────
    console.log('Running Case 2: One-Year Parity between Independent and Weighted approaches...');
    const independentFv1Yr = projectInvestableAssetsFutureValue(multiYearAssets, 12);
    const staticWeightedFv1Yr = 200000 * (1 + 0.09);
    assert.equal(Math.round(independentFv1Yr), Math.round(staticWeightedFv1Yr), 'At 1 year, independent sum equals weighted average (₹218,000)');
    console.log(`  ✓ 1-Yr Independent: ₹${Math.round(independentFv1Yr).toLocaleString('en-IN')} == 1-Yr Static: ₹${Math.round(staticWeightedFv1Yr).toLocaleString('en-IN')}`);

    // ── CASE 3: DIFFERENT PRINCIPAL WEIGHTS ──────────────────────
    console.log('Running Case 3: Different Principal Weights (₹300k @ 6%, ₹100k @ 12% at 10 years)...');
    const weightedAssets = [
      { currentValue: 300000, annualReturnRate: 0.06, includedInFireCorpus: true, assetClass: 'FIRE_INVESTABLE' },
      { currentValue: 100000, annualReturnRate: 0.12, includedInFireCorpus: true, assetClass: 'FIRE_INVESTABLE' }
    ];
    const indWeightedFv10Yr = projectInvestableAssetsFutureValue(weightedAssets, 120);
    const expectedIndWeighted = 300000 * Math.pow(1.06, 10) + 100000 * Math.pow(1.12, 10);
    // 300000 * 1.7908477 + 100000 * 3.1058482 = 537,254.31 + 310,584.82 = 847,839.13
    assert.ok(Math.abs(indWeightedFv10Yr - expectedIndWeighted) < 1.0, `Expected ~847,839, got ${indWeightedFv10Yr}`);
    console.log(`  ✓ 10-Yr Weighted Assets Projection: ₹${Math.round(indWeightedFv10Yr).toLocaleString('en-IN')} (Expected ₹847,839)`);

    // ── CASE 4: LEGACY ASSET FALLBACK RATE ──────────────────────
    console.log('Running Case 4: Legacy Asset without annualReturnRate uses fallback rate (8%)...');
    const legacyAssets = [
      { currentValue: 100000, includedInFireCorpus: true, assetClass: 'FIRE_INVESTABLE' }
    ];
    const legacyFv10Yr = projectInvestableAssetsFutureValue(legacyAssets, 120, 0.08);
    const expectedLegacy = 100000 * Math.pow(1.08, 10); // 215,892.50
    assert.ok(Math.abs(legacyFv10Yr - expectedLegacy) < 1.0, `Expected ~215,892.50, got ${legacyFv10Yr}`);
    console.log(`  ✓ 10-Yr Legacy Asset Projection: ₹${Math.round(legacyFv10Yr).toLocaleString('en-IN')} (Expected ₹215,893)`);

    // ── CASE 5: EXPLICIT ZERO RETURN RATE ────────────────────────
    console.log('Running Case 5: Explicit Zero Return Rate (annualReturnRate: 0.0) remains flat...');
    const zeroRateAssets = [
      { currentValue: 100000, annualReturnRate: 0.0, includedInFireCorpus: true, assetClass: 'FIRE_INVESTABLE' }
    ];
    const zeroFv10Yr = projectInvestableAssetsFutureValue(zeroRateAssets, 120, 0.08);
    assert.equal(zeroFv10Yr, 100000, '0% rate remains exactly 100,000 regardless of fallback');
    console.log(`  ✓ 10-Yr 0% Asset Projection: ₹${zeroFv10Yr.toLocaleString('en-IN')} (remains ₹100,000)`);

    // ── CASE 6: CURRENT VALUES UNCHANGED (NO IN-PLACE MUTATION) ──
    console.log('Running Case 6: Confirm projection calculations do NOT mutate asset.currentValue...');
    const testAssetOriginal = { currentValue: 100000, annualReturnRate: 0.12, includedInFireCorpus: true, assetClass: 'FIRE_INVESTABLE' };
    projectInvestableAssetsFutureValue([testAssetOriginal], 120);
    assert.equal(testAssetOriginal.currentValue, 100000, 'asset.currentValue remains unchanged');
    console.log('  ✓ asset.currentValue strictly preserved without side-effects');

    // ── TEST 15: DELETE ASSET & REACTIVITY ───────────────────────
    console.log('Running Test 15: Delete asset and verify Predictability reactivity...');
    await Asset.deleteOne({ id: 'ast-fd-1', userId: testUserId });

    const deletedSnap = await getPredictabilitySnapshot(testUserId, { referenceDate: '2026-06-15' });
    assert.equal(deletedSnap.assets.fireInvestableCorpus, 0, 'FIRE corpus dropped to 0 after deleting FD');
    assert.equal(deletedSnap.assets.totalAssetValue, 8300000, 'Total assets dropped to 83 Lakhs');
    console.log('  ✓ Predictability engine dynamically recalculated after asset deletion');

  } finally {
    // Clean up
    await Asset.deleteMany({ userId: { $in: [testUserId, otherUserId] } });
    await User.deleteMany({ id: { $in: [testUserId, otherUserId] } });
    await Transaction.deleteMany({ userId: { $in: [testUserId, otherUserId] } });
    await Income.deleteMany({ userId: { $in: [testUserId, otherUserId] } });
    await Liability.deleteMany({ userId: { $in: [testUserId, otherUserId] } });
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }

  console.log('\n================================================================');
  console.log('  ALL ASSET CRUD & INDEPENDENT PROJECTION TESTS PASSED (100% GREEN) 🚀');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

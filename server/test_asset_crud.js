/**
 * server/test_asset_crud.js
 * 
 * Comprehensive test suite for Asset CRUD API and Predictability integration.
 */

import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Asset from './models/Asset.js';
import User from './models/User.js';
import Transaction from './models/Transaction.js';
import Income from './models/Income.js';
import Liability from './models/Liability.js';
import { getPredictabilitySnapshot } from './services/PredictabilityService.js';

console.log('================================================================');
console.log('  FINAURA ASSET CRUD & PREDICTABILITY INTEGRATION TEST SUITE');
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
        currentBalance: 50000
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
    console.log('Running Test 1: Create Fixed Deposit Asset (FIRE_INVESTABLE, locked)...');
    const fd = await Asset.create({
      id: 'ast-fd-1',
      userId: testUserId,
      name: 'HDFC Fixed Deposit',
      assetType: 'Fixed Deposit',
      assetClass: 'FIRE_INVESTABLE',
      currentValue: 1000000, // 10 Lakhs
      includedInFireCorpus: true,
      liquidity: 'locked'
    });
    assert.equal(fd.name, 'HDFC Fixed Deposit');
    assert.equal(fd.currentValue, 1000000);
    assert.equal(fd.includedInFireCorpus, true);
    assert.equal(fd.liquidity, 'locked');
    console.log('  ✓ Fixed Deposit asset created successfully');

    // ── TEST 2: CREATE BANK ASSET (SEMI_LIQUID) ─────────────────
    console.log('Running Test 2: Create Bank Savings Asset (SEMI_LIQUID, liquid)...');
    const bank = await Asset.create({
      id: 'ast-bank-1',
      userId: testUserId,
      name: 'ICICI Savings Account',
      assetType: 'Bank / Savings',
      assetClass: 'SEMI_LIQUID',
      currentValue: 300000, // 3 Lakhs
      includedInFireCorpus: false,
      liquidity: 'liquid'
    });
    assert.equal(bank.currentValue, 300000);
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

    // Total assets: 10L FD + 3L Bank + 80L Home = 93L
    assert.equal(snap.assets.totalAssetValue, 9300000, 'Total asset value is 93 Lakhs');
    // FIRE Investable: only 10L FD (includedInFireCorpus: true)
    assert.equal(snap.assets.fireInvestableCorpus, 1000000, 'FIRE investable corpus is exactly 10 Lakhs');
    // Liquid Buffer: only 3L Bank (liquidity: liquid). FD is locked!
    assert.equal(snap.assets.liquidBuffer, 300000, 'Liquid emergency buffer is 3 Lakhs (locked FD excluded)');
    // currentBalance: remains 50k operating balance (not double-counted)
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
      includedInFireCorpus: true,
      liquidity: 'liquid'
    });

    const userAssets = await Asset.find({ userId: testUserId });
    assert.equal(userAssets.length, 3, 'User A only sees their 3 assets');
    const otherAssets = await Asset.find({ userId: otherUserId });
    assert.equal(otherAssets.length, 1, 'User B only sees their 1 asset');
    console.log('  ✓ Cross-user isolation strictly verified');

    // ── TEST 7: UPDATE ASSET & PREDICTABILITY REACTIVITY ────────
    console.log('Running Test 7: Update asset value and verify Predictability reactivity...');
    await Asset.updateOne(
      { id: 'ast-fd-1', userId: testUserId },
      { $set: { currentValue: 2000000 } } // Increase FD to 20 Lakhs
    );

    const updatedSnap = await getPredictabilitySnapshot(testUserId, { referenceDate: '2026-06-15' });
    assert.equal(updatedSnap.assets.fireInvestableCorpus, 2000000, 'FIRE corpus updated to 20 Lakhs');
    assert.equal(updatedSnap.assets.totalAssetValue, 10300000, 'Total asset value updated to 1.03 Cr');
    console.log('  ✓ Predictability engine dynamically recalculated on updated asset value');

    // ── TEST 8: DELETE ASSET & REACTIVITY ───────────────────────
    console.log('Running Test 8: Delete asset and verify Predictability reactivity...');
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
  console.log('  ALL 8 ASSET CRUD & PREDICTABILITY TESTS PASSED (100% GREEN)');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

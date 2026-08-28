/**
 * client/test_asset_management_ux.js
 * 
 * Comprehensive test suite for Financial Assets UX, Presentation Contracts,
 * Predictability Integration, and Navigation.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { calculateInvestableCorpus } from '../server/utils/financialMath.js';
import { resolveForecastInputs } from '../server/utils/forecastResolver.js';
import { buildPredictabilitySnapshot } from '../server/services/PredictabilityService.js';

console.log('================================================================');
console.log('  FINAURA ASSET MANAGEMENT UX & CONTRACT TEST SUITE');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  console.log(`Running ${name}...`);
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name} Passed`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name} FAILED: ${err.message}`);
    console.error(err);
  }
  console.log();
}

function readScreen(name) {
  return fs.readFileSync(path.resolve(`client/src/screens/${name}`), 'utf8');
}

// ── TEST 1: AssetsScreen File & Components Exist ─────────────
test('1. AssetsScreen includes Summary Cards, Asset List, Badges, and Modal', () => {
  const code = readScreen('AssetsScreen.tsx');
  assert.ok(code.includes('Total Recorded Assets'), 'Includes total assets summary');
  assert.ok(code.includes('FIRE Corpus'), 'Includes FIRE corpus summary');
  assert.ok(code.includes('Liquid Buffer'), 'Includes Liquid buffer summary');
  assert.ok(code.includes('Add Financial Asset') || code.includes('Edit Financial Asset'), 'Includes Add/Edit Modal');
  assert.ok(code.includes('ASSET_TYPE_PRESETS'), 'Includes preset asset types');
  assert.ok(code.includes('ASSET_CLASS_MAP'), 'Includes human-readable class mappings');
  assert.ok(code.includes('LIQUIDITY_MAP'), 'Includes human-readable liquidity mappings');
});

// ── TEST 2: Fixed Deposit Presentation & Math ────────────────
test('2. Fixed Deposit: FIRE_INVESTABLE, locked, included in FIRE corpus', () => {
  const testAssets = [
    {
      id: 'ast-fd',
      name: 'HDFC Fixed Deposit',
      assetType: 'Fixed Deposit',
      assetClass: 'FIRE_INVESTABLE',
      currentValue: 1000000, // 10L
      annualReturnRate: 0.06, // 6%
      includedInFireCorpus: true,
      liquidity: 'locked'
    }
  ];

  const invResult = calculateInvestableCorpus(testAssets);
  assert.equal(invResult.includedTotal, 1000000, 'FD is counted in investable corpus');
  assert.equal(invResult.includedAssets.length, 1);

  const resolved = resolveForecastInputs({ assets: testAssets, user: { age: 30, monthlyIncome: 100000 }, transactions: [] });
  assert.equal(resolved.fireInvestableCorpus, 1000000, 'Resolved FIRE corpus is 10 Lakhs');
  assert.equal(resolved.liquidBuffer, 0, 'Locked FD is excluded from liquid emergency buffer');
});

// ── TEST 3: Bank / Cash Presentation & Math ──────────────────
test('3. Bank Savings: SEMI_LIQUID, liquid, included in emergency buffer, excluded from FIRE by default', () => {
  const testAssets = [
    {
      id: 'ast-bank',
      name: 'ICICI Savings',
      assetType: 'Bank / Savings',
      assetClass: 'SEMI_LIQUID',
      currentValue: 500000, // 5L
      annualReturnRate: 0.035, // 3.5%
      includedInFireCorpus: false,
      liquidity: 'liquid'
    }
  ];

  const invResult = calculateInvestableCorpus(testAssets);
  assert.equal(invResult.includedTotal, 0, 'Excluded from FIRE corpus when includedInFireCorpus is false');

  const resolved = resolveForecastInputs({ assets: testAssets, user: { age: 30, monthlyIncome: 100000 }, transactions: [] });
  assert.equal(resolved.liquidBuffer, 500000, 'Liquid bank balance enters liquid emergency buffer');
});

// ── TEST 4: Mutual Fund Presentation & Math ──────────────────
test('4. Mutual Fund: FIRE_INVESTABLE, liquid, included in FIRE corpus', () => {
  const testAssets = [
    {
      id: 'ast-mf',
      name: 'Nifty Index Fund',
      assetType: 'Mutual Fund',
      assetClass: 'FIRE_INVESTABLE',
      currentValue: 800000, // 8L
      annualReturnRate: 0.12, // 12%
      includedInFireCorpus: true,
      liquidity: 'liquid'
    }
  ];

  const invResult = calculateInvestableCorpus(testAssets);
  assert.equal(invResult.includedTotal, 800000, 'Mutual Fund enters investable corpus');

  const resolved = resolveForecastInputs({ assets: testAssets, user: { age: 30, monthlyIncome: 100000 }, transactions: [] });
  assert.equal(resolved.fireInvestableCorpus, 800000, 'FIRE corpus has 8 Lakhs');
  assert.equal(resolved.liquidBuffer, 0, 'Mutual fund equity asset is strictly excluded from liquid emergency buffer');
});

// ── TEST 5: Primary Residence (NON_INVESTABLE) ───────────────
test('5. Primary Residence: NON_INVESTABLE, excluded from FIRE and liquid buffer', () => {
  const testAssets = [
    {
      id: 'ast-home',
      name: 'Primary Residence',
      assetType: 'Real Estate',
      assetClass: 'NON_INVESTABLE',
      currentValue: 8000000, // 80L
      includedInFireCorpus: false,
      liquidity: 'locked'
    }
  ];

  const invResult = calculateInvestableCorpus(testAssets);
  assert.equal(invResult.includedTotal, 0, 'Real estate excluded from FIRE corpus');
  assert.equal(invResult.excludedAssets.length, 1);

  const resolved = resolveForecastInputs({ assets: testAssets, user: { age: 30, monthlyIncome: 100000 }, transactions: [] });
  assert.equal(resolved.fireInvestableCorpus, 0, 'FIRE corpus is 0');
  assert.equal(resolved.liquidBuffer, 0, 'Locked property excluded from liquid buffer');
  assert.equal(resolved.totalAssetValue, 8000000, 'Total asset value includes property');
});

// ── TEST 6: Zero Double-Counting of currentBalance vs Assets ─
test('6. Non-double-counting of User.currentBalance vs Asset records', () => {
  const data = {
    user: { age: 30, retirementAge: 60, monthlyIncome: 100000, currentBalance: 100000 }, // 1L cash balance
    assets: [
      {
        id: 'ast-fd',
        name: 'HDFC FD',
        assetType: 'Fixed Deposit',
        assetClass: 'FIRE_INVESTABLE',
        currentValue: 1000000, // 10L FD
        annualReturnRate: 0.065,
        includedInFireCorpus: true,
        liquidity: 'locked'
      }
    ],
    transactions: []
  };

  const snap = buildPredictabilitySnapshot(data, { referenceDate: '2026-06-15' });
  assert.equal(snap.assets.fireInvestableCorpus, 1000000, 'FIRE corpus comes solely from Asset (10L)');
  assert.equal(snap.currentState.currentBalance, 100000, 'currentBalance remains separate 1L operating cash');
});

// ── TEST 7: Navigation Registration & Reachability ───────────
test('7. AssetsScreen registered in AppNavigator and reachable from Profile & Outlook', () => {
  const appNavCode = fs.readFileSync(path.resolve('client/src/navigation/AppNavigator.tsx'), 'utf8');
  assert.ok(appNavCode.includes('name="Assets"'), 'Assets registered as Stack screen in AppNavigator');

  const profileCode = readScreen('ProfileScreen.tsx');
  assert.ok(profileCode.includes("navigate('Assets')"), 'Profile links to Assets screen');

  const outlookCode = readScreen('FinancialOutlookScreen.tsx');
  assert.ok(outlookCode.includes("navigate('Assets')"), 'Financial Outlook links to Assets screen');
});

// ── TEST 8: API Client Contract for Assets ───────────────────
test('8. api.ts exports getAssets, createAsset, updateAsset, deleteAsset', () => {
  const apiCode = fs.readFileSync(path.resolve('client/src/services/api.ts'), 'utf8');
  assert.ok(apiCode.includes('export async function getAssets'), 'getAssets exported');
  assert.ok(apiCode.includes('export async function createAsset'), 'createAsset exported');
  assert.ok(apiCode.includes('export async function updateAsset'), 'updateAsset exported');
  assert.ok(apiCode.includes('export async function deleteAsset'), 'deleteAsset exported');
});

// ── TEST 9: Empty & Loading States ───────────────────────────
test('9. AssetsScreen provides clear empty state and no NaN/undefined leakage', () => {
  const code = readScreen('AssetsScreen.tsx');
  assert.ok(code.includes('No assets added yet'), 'Empty state headline present');
  assert.ok(code.includes('+ Add First Asset'), 'Empty state CTA present');
  assert.ok(code.includes('formatINR'), 'INR formatter used for safe currency display');
});

// ── TEST 10: Contextual Rate Labels by Asset Type ────────────
test('10. Contextual rate labels depend on asset type (FD/RD vs Mutual Fund vs Other)', () => {
  const code = readScreen('AssetsScreen.tsx');
  assert.ok(code.includes('getRateLabel'), 'getRateLabel helper defined');
  assert.ok(code.includes('Interest Rate (% p.a.)'), 'Interest Rate label used for FD/RD');
  assert.ok(code.includes('Expected Return (% p.a.)'), 'Expected Return label used for Mutual Funds/Stocks');
  assert.ok(code.includes('Expected Annual Return (% p.a.)'), 'Expected Annual Return label used for other assets');
});

// ── TEST 11: Annual Return Rate Form State & Input ───────────
test('11. Annual return rate field is editable with numeric keyboard and % p.a. context', () => {
  const code = readScreen('AssetsScreen.tsx');
  assert.ok(code.includes('annualReturnRate'), 'annualReturnRate state defined');
  assert.ok(code.includes('setAnnualReturnRate'), 'setAnnualReturnRate updater used');
  assert.ok(code.includes('keyboardType="numeric"'), 'Numeric keyboard requested');
});

// ── TEST 12: Decimal Entry & Conversion on Save ──────────────
test('12. Decimal rate entry supported and converted to decimal fraction on save', () => {
  const code = readScreen('AssetsScreen.tsx');
  assert.ok(code.includes('annualReturnRate.trim()'), 'Trims rate input');
  assert.ok(code.includes('parseFloat(annualReturnRate.trim())'), 'Parses float decimal rate');
  assert.ok(code.includes('rateNum > 1 ? rateNum / 100 : rateNum'), 'Converts user % to decimal fraction');
  assert.ok(code.includes('annualReturnRate: parsedRate'), 'Passes annualReturnRate in save payload');
});

// ── TEST 13: Rate Pre-population on Edit ─────────────────────
test('13. Edit form pre-populates existing rate percentage', () => {
  const code = readScreen('AssetsScreen.tsx');
  assert.ok(
    code.includes('ast.annualReturnRate * 100') || code.includes('ast.annualReturnRate > 1'),
    'Pre-populates edit form with rate percentage'
  );
});

// ── TEST 14: Rate Displayed on Asset Cards ───────────────────
test('14. Rate displayed on asset card with % p.a. badge', () => {
  const code = readScreen('AssetsScreen.tsx');
  assert.ok(code.includes('% p.a.'), 'Asset card displays % p.a.');
  assert.ok(code.includes('ast.annualReturnRate !== undefined'), 'Guards against undefined rate');
});

// ── TEST 15: Graceful Legacy Asset Handling ──────────────────
test('15. Legacy assets without rate display gracefully without blank badges', () => {
  const code = readScreen('AssetsScreen.tsx');
  assert.ok(code.includes('ast.annualReturnRate !== null'), 'Null rate check present');
});

console.log('='.repeat(64));
console.log(`  ASSET MANAGEMENT UX SUITE: ${passed} PASSED, ${failed} FAILED`);
console.log('='.repeat(64));
if (failed > 0) process.exit(1);

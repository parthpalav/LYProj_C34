/**
 * test_classification_fmi_pipeline.js
 * ------------------------------------
 * Comprehensive test suite verifying:
 * 1. Classification endpoint behaviour (/api/classify & local fallback)
 * 2. Manual override precedence on transaction creation (POST /api/transactions)
 * 3. Exact field persistence (category, type, confidenceScore, classificationSource)
 * 4. Transaction edit & delete lifecycle (PUT & DELETE /api/transactions/:id)
 * 5. FMI sensitivity & dynamic recalculation across Need vs Want vs Investment
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const BASE_URL = 'http://localhost:4000/api';
let AUTH_TOKEN = null;

const TEST_EMAIL = 'fmi-pipeline-test@finaura.test';
const TEST_PASSWORD = 'Test@Pass123!';

let passed = 0;
let failed = 0;
const testResults = [];

function assert(condition, name, details = '') {
  if (condition) {
    passed++;
    testResults.push(`  ✅ ${name}`);
  } else {
    failed++;
    testResults.push(`  ❌ ${name} ${details ? '— ' + details : ''}`);
  }
}

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {})
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

async function setup() {
  console.log('\n⏳ Setting up test user for FMI & Classification Pipeline tests...');

  // Try login
  let res = await api('POST', '/auth/login', { email: TEST_EMAIL, password: TEST_PASSWORD });
  if (res.status === 200 && res.data.token) {
    AUTH_TOKEN = res.data.token;
    console.log('  Logged in as existing test user.');
    return true;
  }

  // Register
  res = await api('POST', '/auth/register', {
    name: 'FMI Pipeline Tester',
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    monthlyIncome: 50000,
    retirementAge: 60
  });

  if (res.status === 201 || res.status === 200) {
    res = await api('POST', '/auth/login', { email: TEST_EMAIL, password: TEST_PASSWORD });
    if (res.data.token) {
      AUTH_TOKEN = res.data.token;
      console.log('  Registered and logged in.');
      return true;
    }
  }

  console.error('  ❌ Authentication failed:', JSON.stringify(res.data));
  return false;
}

async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('  PHASE 1 & 2: CLASSIFICATION API & MANUAL OVERRIDE TESTS');
  console.log('='.repeat(70));

  const createdTxIds = [];

  // Test 1: POST /api/classify returns expected payload with category, confidence, type, classificationSource, needsReview
  {
    const res = await api('POST', '/classify', { text: '500rs pizza order from dominos' });
    assert(res.status === 200, 'T1: POST /api/classify succeeds');
    assert(typeof res.data.category === 'string', 'T1: Category returned as string', `got ${res.data.category}`);
    assert(typeof res.data.confidence === 'number' && res.data.confidence >= 0, 'T1: Confidence returned as number', `got ${res.data.confidence}`);
    assert(['Need', 'Want', 'Investment'].includes(res.data.type), 'T1: Type returned as Need/Want/Investment', `got ${res.data.type}`);
    assert(typeof res.data.classificationSource === 'string', 'T1: classificationSource returned as string', `got ${res.data.classificationSource}`);
    assert(typeof res.data.needsReview === 'boolean', 'T1: needsReview returned as boolean', `got ${res.data.needsReview}`);
    assert(typeof res.data.all_probs === 'object', 'T1: all_probs returned as object');
  }

  // Test 1b: Deterministic merchant rule (Zomato -> Food & Dining / Want / merchant_rule)
  {
    const res = await api('POST', '/classify', { text: 'Zomato lunch order' });
    assert(res.status === 200, 'T1b: Zomato classify succeeds');
    assert(res.data.category === 'Food & Dining', 'T1b: Category is Food & Dining', `got ${res.data.category}`);
    assert(res.data.type === 'Want', 'T1b: Type is Want', `got ${res.data.type}`);
    assert(res.data.needsReview === false, 'T1b: needsReview is false for deterministic rule');
  }

  // Test 1c: Deterministic public transit rule (Mumbai Metro -> Transport & Travel / Need / merchant_rule)
  {
    const res = await api('POST', '/classify', { text: 'Mumbai Metro card recharge' });
    assert(res.status === 200, 'T1c: Metro classify succeeds');
    assert(res.data.category === 'Transport & Travel', 'T1c: Category is Transport & Travel', `got ${res.data.category}`);
    assert(res.data.type === 'Need', 'T1c: Type is Need for public transit', `got ${res.data.type}`);
    assert(res.data.needsReview === false, 'T1c: needsReview is false');
  }

  // Test 2: Manual category and type override in POST /api/transactions
  // Even if ML would classify "pizza" as Food & Dining / Want, user supplies Health / Need
  {
    const res = await api('POST', '/transactions', {
      amount: 450,
      description: 'Zomato healthy salad for recovery',
      category: 'Health',
      type: 'Need',
      confidenceScore: 0.95,
      classificationSource: 'manual',
      timestamp: new Date().toISOString()
    });
    const tx = res.data;
    createdTxIds.push(tx?.id);
    assert(res.status === 201, 'T2: POST /api/transactions with manual override succeeds');
    assert(tx?.category === 'Health', 'T2: User category (Health) preserved without ML overwrite', `got ${tx?.category}`);
    assert(tx?.type === 'Need', 'T2: User type (Need) preserved without ML overwrite', `got ${tx?.type}`);
    assert(tx?.confidenceScore === 0.95, 'T2: User confidenceScore preserved', `got ${tx?.confidenceScore}`);
  }

  // Test 3: Backend ML fallback when category is NOT supplied by client
  {
    const res = await api('POST', '/transactions', {
      amount: 15000,
      description: 'Monthly electricity bill power corporation',
      timestamp: new Date().toISOString()
    });
    const tx = res.data;
    createdTxIds.push(tx?.id);
    assert(res.status === 201, 'T3: Transaction created with backend inference');
    assert(tx?.category === 'Utilities & Bills', 'T3: Backend inferred category as Utilities & Bills', `got ${tx?.category}`);
    assert(tx?.type === 'Need', 'T3: Backend inferred type as Need', `got ${tx?.type}`);
  }

  // Test 4: PUT /api/transactions/:id updates category, type, and amount
  {
    const txId = createdTxIds[0];
    const res = await api('PUT', `/transactions/${txId}`, {
      category: 'Food & Dining',
      type: 'Want',
      amount: 600,
      description: 'Corrected: Pizza dinner with friends'
    });
    assert(res.status === 200, 'T4: PUT /api/transactions/:id succeeds');
    assert(res.data?.category === 'Food & Dining', 'T4: Edited category updated to Food & Dining', `got ${res.data?.category}`);
    assert(res.data?.type === 'Want', 'T4: Edited type updated to Want', `got ${res.data?.type}`);
    assert(res.data?.amount === 600, 'T4: Edited amount updated to 600', `got ${res.data?.amount}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('  PHASE 4: FMI SENSITIVITY & DYNAMIC RECALCULATION TESTS');
  console.log('='.repeat(70));

  // Clean up previous transactions to have a clean baseline
  for (const id of createdTxIds) {
    await api('DELETE', `/transactions/${id}`);
  }
  createdTxIds.length = 0;

  // Baseline FMI (0 expenses)
  const baseFmiRes = await api('GET', '/fmi');
  assert(baseFmiRes.status === 200, 'T5: Baseline FMI fetch succeeds');
  const baseFMI = baseFmiRes.data?.FMI;
  console.log(`  📊 Baseline FMI (0 expenses): ${baseFMI}/100 (Status: ${baseFmiRes.data?.status})`);

  // Scenario A: Add ₹10,000 as 'Investment'
  let investTxId;
  {
    const res = await api('POST', '/transactions', {
      amount: 10000,
      description: 'Nifty 50 Index Mutual Fund SIP',
      category: 'Misc',
      type: 'Investment',
      timestamp: new Date().toISOString()
    });
    investTxId = res.data?.id;
    createdTxIds.push(investTxId);

    const fmiAfterInvest = await api('GET', '/fmi');
    assert(fmiAfterInvest.status === 200, 'T6: FMI after Investment succeeds');
    const investFMI = fmiAfterInvest.data?.FMI;
    const d1Score = fmiAfterInvest.data?.pillars?.D1_savingDiscipline?.score;
    console.log(`  📊 FMI after ₹10,000 Investment: ${investFMI}/100 | D1 Saving Pillar: ${d1Score}/100`);
    assert(fmiAfterInvest.data?.totalSaved >= 10000, 'T6: totalSaved includes ₹10,000 investment', `got ${fmiAfterInvest.data?.totalSaved}`);
    assert(fmiAfterInvest.data?.totalSpent === 0, 'T6: totalSpent excludes investment (remains 0)', `got ${fmiAfterInvest.data?.totalSpent}`);
  }

  // Scenario B: Edit that transaction from 'Investment' to 'Want'
  {
    const res = await api('PUT', `/transactions/${investTxId}`, {
      type: 'Want',
      category: 'Shopping',
      description: 'Amazon electronic gadget purchase'
    });
    assert(res.status === 200, 'T7: Edit from Investment to Want succeeds');

    const fmiAfterWant = await api('GET', '/fmi');
    assert(fmiAfterWant.status === 200, 'T7: FMI after Want succeeds');
    const wantFMI = fmiAfterWant.data?.FMI;
    const totalSpent = fmiAfterWant.data?.totalSpent;
    const totalSaved = fmiAfterWant.data?.totalSaved;
    console.log(`  📊 FMI after edit to Want: ${wantFMI}/100 (totalSpent: ₹${totalSpent}, totalSaved: ₹${totalSaved})`);
    assert(totalSaved === 0, 'T7: totalSaved drops to 0 after changing to Want', `got ${totalSaved}`);
    assert(totalSpent === 10000, 'T7: totalSpent increases to ₹10,000', `got ${totalSpent}`);
    assert(wantFMI < baseFMI, 'T7: FMI score drops when ₹10,000 is spent on Want instead of saved', `${wantFMI} vs ${baseFMI}`);
  }

  // Scenario C: Edit from 'Want' to 'Need'
  {
    const res = await api('PUT', `/transactions/${investTxId}`, {
      type: 'Need',
      category: 'Bills',
      description: 'Electricity & maintenance bill'
    });
    assert(res.status === 200, 'T8: Edit from Want to Need succeeds');

    const fmiAfterNeed = await api('GET', '/fmi');
    assert(fmiAfterNeed.status === 200, 'T8: FMI after Need succeeds');
    const needFMI = fmiAfterNeed.data?.FMI;
    const d3Score = fmiAfterNeed.data?.pillars?.D3_behavioralRisk?.score;
    console.log(`  📊 FMI after edit to Need: ${needFMI}/100 | D3 Behavior Pillar: ${d3Score}/100`);
    assert(fmiAfterNeed.data?.totalSpent === 10000, 'T8: totalSpent remains ₹10,000 for Need', `got ${fmiAfterNeed.data?.totalSpent}`);
  }

  // Scenario D: Delete transaction -> FMI returns to baseline
  {
    const res = await api('DELETE', `/transactions/${investTxId}`);
    assert(res.status === 200, 'T9: DELETE transaction succeeds');

    const fmiAfterDelete = await api('GET', '/fmi');
    assert(fmiAfterDelete.status === 200, 'T9: FMI after delete succeeds');
    assert(fmiAfterDelete.data?.FMI === baseFMI, 'T9: FMI returns exactly to baseline after deletion', `got ${fmiAfterDelete.data?.FMI} expected ${baseFMI}`);
  }

  // Clean up
  console.log('\n⏳ Cleaning up test transactions...');
  for (const id of createdTxIds) {
    if (id) await api('DELETE', `/transactions/${id}`);
  }
}

async function main() {
  try {
    const ready = await setup();
    if (!ready) {
      console.error('\n❌ Could not connect or authenticate to server.');
      process.exit(1);
    }
    await runTests();

    console.log('\n' + '='.repeat(70));
    console.log('  TEST SUMMARY');
    console.log('='.repeat(70));
    testResults.forEach(r => console.log(r));
    console.log(`\n  Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log('='.repeat(70));

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

main();

/**
 * test_transaction_integrity.js — Integration tests for the hardened transaction system.
 *
 * Runs against the live backend on PORT 4000.
 * Requires: server running, MongoDB running, a valid auth token.
 *
 * Usage:
 *   1. Start the server:  cd server && node index.js
 *   2. Run tests:         node test_transaction_integrity.js
 *
 * NOTE: This test creates test transactions and then deletes them.
 *       It does NOT modify existing user transactions.
 */

const BASE_URL = 'http://localhost:4000/api';
let AUTH_TOKEN = null;

const TEST_USER_EMAIL = 'test-integrity@finaura.test';
const TEST_USER_PASSWORD = 'Test@Pass123!';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, testName, details = '') {
  if (condition) {
    passed++;
    results.push(`  ✅ ${testName}`);
  } else {
    failed++;
    results.push(`  ❌ ${testName} ${details ? '— ' + details : ''}`);
  }
}

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {})
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

// ─────────────────────────────────────────────────────────────
// Setup: Register or login test user
// ─────────────────────────────────────────────────────────────
async function setup() {
  console.log('\n⏳ Setting up test user...');

  // Try login first
  let res = await api('POST', '/auth/login', { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD });
  if (res.status === 200 && res.data.token) {
    AUTH_TOKEN = res.data.token;
    console.log('  Logged in as existing test user.');
    return true;
  }

  // Register
  res = await api('POST', '/auth/register', {
    name: 'Test Integrity',
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });
  if (res.status === 201 || res.status === 200) {
    // Try login again
    res = await api('POST', '/auth/login', { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD });
    if (res.data.token) {
      AUTH_TOKEN = res.data.token;
      console.log('  Registered and logged in.');
      return true;
    }
  }

  console.error('  ❌ Could not authenticate. Is the server running?');
  console.error('  Response:', JSON.stringify(res.data));
  return false;
}

// ─────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────

const createdTxIds = [];

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  TRANSACTION INTEGRITY TEST SUITE');
  console.log('='.repeat(60));

  // ─── Test 1: Create transaction with category=Food, type=Need ───
  {
    const res = await api('POST', '/transactions', {
      amount: 100, description: 'Test food need', category: 'Food', type: 'Need', timestamp: new Date().toISOString()
    });
    const tx = res.data;
    createdTxIds.push(tx?.id);
    assert(res.status === 201, 'T1: Create Food/Need succeeds');
    assert(tx?.category === 'Food', 'T1: category persisted as Food', `got ${tx?.category}`);
    assert(tx?.type === 'Need', 'T1: type persisted as Need', `got ${tx?.type}`);
  }

  // ─── Test 2: Create transaction with category=Entertainment, type=Want ───
  {
    const res = await api('POST', '/transactions', {
      amount: 200, description: 'Test entertainment want', category: 'Entertainment', type: 'Want', timestamp: new Date().toISOString()
    });
    const tx = res.data;
    createdTxIds.push(tx?.id);
    assert(res.status === 201, 'T2: Create Entertainment/Want succeeds');
    assert(tx?.category === 'Entertainment', 'T2: category persisted as Entertainment', `got ${tx?.category}`);
    assert(tx?.type === 'Want', 'T2: type persisted as Want', `got ${tx?.type}`);
  }

  // ─── Test 3: Create transaction with type=Investment ───
  {
    const res = await api('POST', '/transactions', {
      amount: 500, description: 'Test education investment', category: 'Education', type: 'Investment', timestamp: new Date().toISOString()
    });
    const tx = res.data;
    createdTxIds.push(tx?.id);
    assert(res.status === 201, 'T3: Create Education/Investment succeeds');
    assert(tx?.type === 'Investment', 'T3: type persisted as Investment', `got ${tx?.type}`);
  }

  // ─── Test 4: confidenceScore is persisted ───
  {
    const res = await api('POST', '/transactions', {
      amount: 50, description: 'Confidence test', category: 'Misc', type: 'Need', confidenceScore: 0.85, timestamp: new Date().toISOString()
    });
    const tx = res.data;
    createdTxIds.push(tx?.id);
    assert(res.status === 201, 'T4: Create with confidenceScore succeeds');
    assert(tx?.confidenceScore === 0.85, 'T4: confidenceScore persisted', `got ${tx?.confidenceScore}`);
  }

  // ─── Test 5: normalizeTransaction returns type ───
  {
    const res = await api('GET', '/transactions');
    assert(res.status === 200, 'T5: GET /transactions succeeds');
    if (res.data?.length > 0) {
      const latest = res.data.find(t => createdTxIds.includes(t.id));
      assert(latest?.type !== undefined, 'T5: normalizeTransaction returns type', `type=${latest?.type}`);
    }
  }

  // ─── Test 6: normalizeTransaction returns confidenceScore ───
  {
    const res = await api('GET', '/transactions');
    if (res.data?.length > 0) {
      const latest = res.data.find(t => createdTxIds.includes(t.id));
      assert(latest?.confidenceScore !== undefined, 'T6: normalizeTransaction returns confidenceScore', `cs=${latest?.confidenceScore}`);
    }
  }

  // ─── Test 7: timestamps (createdAt/updatedAt) ───
  {
    const res = await api('GET', '/transactions');
    if (res.data?.length > 0) {
      const latest = res.data.find(t => createdTxIds.includes(t.id));
      assert(latest?.createdAt !== undefined, 'T7: createdAt is returned for new transactions', `got ${latest?.createdAt}`);
      assert(latest?.updatedAt !== undefined, 'T7: updatedAt is returned for new transactions', `got ${latest?.updatedAt}`);
    }
  }

  // ─── Test 8: tags/isAnomaly/sentimentScore are present ───
  {
    const res = await api('GET', '/transactions');
    if (res.data?.length > 0) {
      const latest = res.data.find(t => createdTxIds.includes(t.id));
      assert(Array.isArray(latest?.tags), 'T8: tags is present and is an array');
      assert(latest?.isAnomaly !== undefined, 'T8: isAnomaly is present');
      assert(latest?.sentimentScore !== undefined, 'T8: sentimentScore is present');
    }
  }

  // ─── Test 9: Cannot create transaction for another user ───
  {
    const res = await api('POST', '/transactions', {
      amount: 100, description: 'Spoofed userId', category: 'Food', type: 'Need',
      userId: 'some-other-user-id',
      timestamp: new Date().toISOString()
    });
    const tx = res.data;
    createdTxIds.push(tx?.id);
    assert(res.status === 201, 'T9: Create succeeds (userId ignored)');
    assert(tx?.userId !== 'some-other-user-id', 'T9: Spoofed userId is NOT used', `userId=${tx?.userId}`);
  }

  // ─── Test 10: Cannot update another user's transaction ───
  {
    // Try to update a transaction ID that belongs to seed user u1
    const res = await api('PUT', '/transactions/t-1', { description: 'Hacked!' });
    assert(res.status === 404, 'T10: Cannot update another user\'s transaction', `status=${res.status}`);
  }

  // ─── Test 11: Cannot change userId through PUT ───
  {
    if (createdTxIds[0]) {
      const res = await api('PUT', `/transactions/${createdTxIds[0]}`, { userId: 'hijacked-user' });
      if (res.status === 200) {
        assert(res.data.userId !== 'hijacked-user', 'T11: userId NOT changed via PUT', `userId=${res.data?.userId}`);
      } else {
        // 400 (no editable fields) is also acceptable
        assert(res.status === 400, 'T11: PUT with only userId rejected', `status=${res.status}`);
      }
    }
  }

  // ─── Test 12: Cannot change transaction id through PUT ───
  {
    if (createdTxIds[0]) {
      const res = await api('PUT', `/transactions/${createdTxIds[0]}`, { id: 'hijacked-id', description: 'test' });
      if (res.status === 200) {
        assert(res.data.id !== 'hijacked-id', 'T12: id NOT changed via PUT', `id=${res.data?.id}`);
      }
    }
  }

  // ─── Test 13: Invalid type values are rejected ───
  {
    const res = await api('POST', '/transactions', {
      amount: 100, description: 'Invalid type', category: 'Food', type: 'BadType', timestamp: new Date().toISOString()
    });
    // The schema should reject this OR the controller should normalize it
    // Our implementation normalizes invalid types to 'Need', which is a safe fallback
    if (res.status === 201) {
      assert(res.data.type === 'Need', 'T13: Invalid type normalized to Need', `got ${res.data.type}`);
      createdTxIds.push(res.data?.id);
    } else {
      assert(res.status === 400 || res.status === 500, 'T13: Invalid type rejected', `status=${res.status}`);
    }
  }

  // ─── Test 14: Invalid confidenceScore values are rejected via PUT ───
  {
    if (createdTxIds[0]) {
      const res = await api('PUT', `/transactions/${createdTxIds[0]}`, { confidenceScore: 5.0 });
      assert(res.status === 400, 'T14: Invalid confidenceScore (5.0) rejected via PUT', `status=${res.status}`);
    }
  }

  // ─── Test 15: FMI calculation still works ───
  {
    const res = await api('GET', '/fmi');
    assert(res.status === 200, 'T15: FMI calculation executes without error', `status=${res.status}`);
    if (res.status === 200) {
      assert(typeof res.data.FMI === 'number', 'T15: FMI returns a numeric score', `FMI=${res.data.FMI}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // P0 BALANCE RECONCILIATION REGRESSION TESTS (T16 - T24)
  // ═══════════════════════════════════════════════════════════

  // Setup User B for cross-user isolation tests
  const USER_B_EMAIL = 'test-integrity-b@finaura.test';
  let USER_B_TOKEN = null;
  {
    let bLogin = await api('POST', '/auth/login', { email: USER_B_EMAIL, password: TEST_USER_PASSWORD });
    if (bLogin.status === 200 && bLogin.data.token) {
      USER_B_TOKEN = bLogin.data.token;
    } else {
      await api('POST', '/auth/register', { name: 'User B', email: USER_B_EMAIL, password: TEST_USER_PASSWORD });
      bLogin = await api('POST', '/auth/login', { email: USER_B_EMAIL, password: TEST_USER_PASSWORD });
      USER_B_TOKEN = bLogin.data.token;
    }
  }

  async function apiAsUserB(method, path, body = null) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(USER_B_TOKEN ? { 'Authorization': `Bearer ${USER_B_TOKEN}` } : {})
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE_URL}${path}`, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  }

  // Set User A's baseline balance to ₹50,000
  await api('PUT', '/user/profile', { currentBalance: 50000 });
  let profile = await api('GET', '/user/profile');
  assert(profile.data.currentBalance === 50000, 'Setup: User A starting balance set to 50,000', `got ${profile.data.currentBalance}`);

  // Set User B's baseline balance to ₹20,000
  await apiAsUserB('PUT', '/user/profile', { currentBalance: 20000 });

  let p0TxId = null;

  // ─── Test 16: Create ₹5,000 expense from ₹50,000 → ₹45,000 ───
  {
    const res = await api('POST', '/transactions', {
      amount: 5000,
      description: 'P0 Initial Expense',
      category: 'Shopping',
      type: 'Want',
      timestamp: new Date().toISOString()
    });
    assert(res.status === 201, 'T16: Create ₹5,000 expense succeeds');
    p0TxId = res.data?.id;

    const userProfile = await api('GET', '/user/profile');
    assert(userProfile.data.currentBalance === 45000, 'T16: Balance decremented to ₹45,000 on create', `got ${userProfile.data.currentBalance}`);
  }

  // ─── Test 17: Edit ₹5,000 → ₹1,000 → balance becomes ₹49,000 (refund delta +₹4,000) ───
  {
    const res = await api('PUT', `/transactions/${p0TxId}`, {
      amount: 1000,
      description: 'P0 Reduced Expense'
    });
    assert(res.status === 200, 'T17: Edit amount down to ₹1,000 succeeds');
    assert(res.data.amount === 1000, 'T17: Transaction amount is now 1,000');

    const userProfile = await api('GET', '/user/profile');
    assert(userProfile.data.currentBalance === 49000, 'T17: Balance refunded by ₹4,000 to ₹49,000', `got ${userProfile.data.currentBalance}`);
  }

  // ─── Test 18: Edit ₹1,000 → ₹5,000 → balance becomes ₹45,000 (additional debit -₹4,000) ───
  {
    const res = await api('PUT', `/transactions/${p0TxId}`, {
      amount: 5000,
      description: 'P0 Increased Expense'
    });
    assert(res.status === 200, 'T18: Edit amount up to ₹5,000 succeeds');
    assert(res.data.amount === 5000, 'T18: Transaction amount is now 5,000');

    const userProfile = await api('GET', '/user/profile');
    assert(userProfile.data.currentBalance === 45000, 'T18: Balance debited by ₹4,000 to ₹45,000', `got ${userProfile.data.currentBalance}`);
  }

  // ─── Test 19: Edit fields without changing amount → balance unchanged (₹45,000) ───
  {
    const res = await api('PUT', `/transactions/${p0TxId}`, {
      description: 'P0 Metadata Edit Only',
      category: 'Entertainment',
      type: 'Want'
    });
    assert(res.status === 200, 'T19: Edit metadata without amount succeeds');

    const userProfile = await api('GET', '/user/profile');
    assert(userProfile.data.currentBalance === 45000, 'T19: Balance unchanged at ₹45,000 when amount is not modified', `got ${userProfile.data.currentBalance}`);
  }

  // ─── Test 20: Updating amount to the same value (₹5,000 → ₹5,000) → balance unchanged ───
  {
    const res = await api('PUT', `/transactions/${p0TxId}`, {
      amount: 5000,
      description: 'P0 Same Amount'
    });
    assert(res.status === 200, 'T20: Edit with identical amount succeeds');

    const userProfile = await api('GET', '/user/profile');
    assert(userProfile.data.currentBalance === 45000, 'T20: Balance unchanged at ₹45,000 when amount delta is 0', `got ${userProfile.data.currentBalance}`);
  }

  // ─── Test 21: Invalid update must not affect balance ───
  {
    const resNegative = await api('PUT', `/transactions/${p0TxId}`, { amount: -500 });
    assert(resNegative.status === 400, 'T21: PUT with negative amount rejected with 400');

    const resZero = await api('PUT', `/transactions/${p0TxId}`, { amount: 0 });
    assert(resZero.status === 400, 'T21: PUT with zero amount rejected with 400');

    const resNaN = await api('PUT', `/transactions/${p0TxId}`, { amount: 'invalid-amount' });
    assert(resNaN.status === 400, 'T21: PUT with NaN amount rejected with 400');

    const userProfile = await api('GET', '/user/profile');
    assert(userProfile.data.currentBalance === 45000, 'T21: Balance unchanged at ₹45,000 after invalid update attempts', `got ${userProfile.data.currentBalance}`);
  }

  // ─── Test 22: Unauthorized edit must not affect transaction or balance ───
  {
    const res = await apiAsUserB('PUT', `/transactions/${p0TxId}`, { amount: 100 });
    assert(res.status === 404, 'T22: Unauthorized edit by User B rejected with 404');

    const userAProfile = await api('GET', '/user/profile');
    assert(userAProfile.data.currentBalance === 45000, 'T22: User A balance untouched at ₹45,000', `got ${userAProfile.data.currentBalance}`);

    const userBProfile = await apiAsUserB('GET', '/user/profile');
    assert(userBProfile.data.currentBalance === 20000, 'T22: User B balance untouched at ₹20,000', `got ${userBProfile.data.currentBalance}`);
  }

  // ─── Test 23: Unauthorized delete must not affect transaction or balance ───
  {
    const res = await apiAsUserB('DELETE', `/transactions/${p0TxId}`);
    assert(res.status === 404, 'T23: Unauthorized delete by User B rejected with 404');

    const userAProfile = await api('GET', '/user/profile');
    assert(userAProfile.data.currentBalance === 45000, 'T23: User A balance untouched at ₹45,000', `got ${userAProfile.data.currentBalance}`);

    const userBProfile = await apiAsUserB('GET', '/user/profile');
    assert(userBProfile.data.currentBalance === 20000, 'T23: User B balance untouched at ₹20,000', `got ${userBProfile.data.currentBalance}`);
  }

  // ─── Test 24: Delete ₹5,000 transaction → balance restored to ₹50,000 ───
  {
    const res = await api('DELETE', `/transactions/${p0TxId}`);
    assert(res.status === 200, 'T24: Delete ₹5,000 expense succeeds');

    const userProfile = await api('GET', '/user/profile');
    assert(userProfile.data.currentBalance === 50000, 'T24: Balance restored to ₹50,000 on delete', `got ${userProfile.data.currentBalance}`);
  }

  // ─── Cleanup: delete remaining test transactions ───
  console.log('\n⏳ Cleaning up test transactions...');
  for (const txId of createdTxIds) {
    if (txId) {
      await api('DELETE', `/transactions/${txId}`);
    }
  }
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  try {
    const ready = await setup();
    if (!ready) {
      console.log('\n❌ COULD NOT RUN TESTS (server not reachable or auth failed)');
      process.exit(1);
    }

    await runTests();

    console.log('\n' + '='.repeat(60));
    console.log('  TEST RESULTS');
    console.log('='.repeat(60));
    results.forEach(r => console.log(r));
    console.log(`\n  Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log('='.repeat(60));

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('\nTest suite error:', err);
    process.exit(1);
  }
}

main();

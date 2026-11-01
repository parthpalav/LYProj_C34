/**
 * Integration test for payment methods and credit card behaviour.
 *
 * Runs against a live backend. Usage:
 *   1. Start the server:  cd server && node index.js
 *   2. Run:               node tests/paymentMethods/creditCardFlow.test.js
 *      (set API_URL=http://localhost:4100/api to target another port)
 *
 * Uses its own test user and removes the transactions and methods it creates.
 */
import assert from 'node:assert/strict';

const BASE_URL = process.env.API_URL || 'http://localhost:4000/api';
const EMAIL = 'test-cards@finaura.test';
const PASSWORD = 'Test@Pass123!';
let token = null;

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

async function login() {
  let res = await api('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  if (!res.data?.token) {
    await api('POST', '/auth/register', { name: 'Test Cards', email: EMAIL, password: PASSWORD });
    res = await api('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  }
  assert.ok(res.data?.token, `login failed: ${res.status} ${JSON.stringify(res.data)}`);
  token = res.data.token;
}

const balance = async () => (await api('GET', '/auth/me')).data.user.currentBalance;
const card = async (id) => (await api('GET', '/payment-methods')).data.data.find((m) => m.id === id);

const createdTx = [];
const createdMethods = [];

async function run() {
  await login();

  // Validation: full card numbers and bad UPI IDs are rejected.
  let res = await api('POST', '/payment-methods', { kind: 'debit_card', nickname: 'Bad', last4: '1234567812345678' });
  assert.equal(res.status, 400);
  res = await api('POST', '/payment-methods', { kind: 'upi', nickname: 'Bad', upiId: 'not-an-id' });
  assert.equal(res.status, 400);
  res = await api('POST', '/payment-methods', { kind: 'credit_card', nickname: 'No limit', last4: '1111', statementDay: 5, dueDay: 25 });
  assert.equal(res.status, 400);

  res = await api('POST', '/payment-methods', { kind: 'upi', nickname: 'GPay', upiId: 'test@okhdfc' });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  const upi = res.data.data;
  createdMethods.push(upi.id);

  res = await api('POST', '/payment-methods', { kind: 'credit_card', nickname: 'Test Card', last4: '4242', creditLimit: 1000, statementDay: 20, dueDay: 10 });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  const cc = res.data.data;
  createdMethods.push(cc.id);
  assert.equal(cc.credit.available, 1000);

  const startBalance = await balance();

  // UPI purchase comes out of the bank balance.
  res = await api('POST', '/transactions', { amount: 100, category: 'Shopping', type: 'Want', description: 'upi test', paymentMethodId: upi.id });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  createdTx.push(res.data.id);
  assert.equal(res.data.paymentMethodId, upi.id);
  assert.equal(await balance(), startBalance - 100);

  // Credit card purchase uses the limit, not the bank balance.
  res = await api('POST', '/transactions', { amount: 600, category: 'Shopping', type: 'Want', description: 'card test', paymentMethodId: cc.id });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  const cardTx = res.data.id;
  createdTx.push(cardTx);
  assert.equal(await balance(), startBalance - 100);
  assert.equal((await card(cc.id)).credit.available, 400);

  // Over the limit: blocked, nothing changes.
  res = await api('POST', '/transactions', { amount: 500, category: 'Shopping', type: 'Want', description: 'too much', paymentMethodId: cc.id });
  assert.equal(res.status, 400);
  assert.match(res.data.error, /Exceeds available credit/);
  assert.equal((await card(cc.id)).outstanding, 600);

  // Edit: raise amount on the same card within the limit.
  res = await api('PUT', `/transactions/${cardTx}`, { amount: 900 });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal((await card(cc.id)).outstanding, 900);
  // Edit past the limit is blocked and rolled back.
  res = await api('PUT', `/transactions/${cardTx}`, { amount: 1200 });
  assert.equal(res.status, 400);
  assert.equal((await card(cc.id)).outstanding, 900);

  // Move it to cash: card freed, bank charged.
  res = await api('PUT', `/transactions/${cardTx}`, { paymentMethodId: 'cash' });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal((await card(cc.id)).outstanding, 0);
  assert.equal(await balance(), startBalance - 100 - 900);
  // And back to the card.
  res = await api('PUT', `/transactions/${cardTx}`, { paymentMethodId: cc.id });
  assert.equal(res.status, 200);
  assert.equal((await card(cc.id)).outstanding, 900);
  assert.equal(await balance(), startBalance - 100);

  // Card with a balance cannot be removed; limit cannot go below the used amount.
  res = await api('DELETE', `/payment-methods/${cc.id}`);
  assert.equal(res.status, 400);
  res = await api('PUT', `/payment-methods/${cc.id}`, { creditLimit: 500 });
  assert.equal(res.status, 400);

  // Pay the bill: bank goes down, card frees up. Overpaying is blocked.
  res = await api('POST', `/payment-methods/${cc.id}/pay`, { amount: 1000 });
  assert.equal(res.status, 400);
  res = await api('POST', `/payment-methods/${cc.id}/pay`, { amount: 400 });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.data.outstanding, 500);
  assert.equal(await balance(), startBalance - 100 - 400);

  // Reported balance: total used and unpaid statement amount, bank untouched.
  res = await api('PUT', `/payment-methods/${cc.id}/balance`, { used: 1200, billedUnpaid: 0 });
  assert.equal(res.status, 400, 'used above the limit must be rejected');
  res = await api('PUT', `/payment-methods/${cc.id}/balance`, { used: 300, billedUnpaid: 400 });
  assert.equal(res.status, 400, 'unpaid statement above used must be rejected');
  res = await api('PUT', `/payment-methods/${cc.id}/balance`, { used: 800, billedUnpaid: 200 });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.data.credit.outstanding, 800);
  assert.equal(res.data.data.credit.amountDue, 200);
  assert.equal(res.data.data.credit.unbilled, 600);
  assert.equal(await balance(), startBalance - 100 - 400);
  res = await api('PUT', `/payment-methods/${cc.id}/balance`, { used: 500, billedUnpaid: 0 });
  assert.equal(res.status, 200, JSON.stringify(res.data));

  // A new card can start with a balance carried over from before tracking.
  res = await api('POST', '/payment-methods', { kind: 'credit_card', nickname: 'Old Card', last4: '5555', creditLimit: 2000, statementDay: 20, dueDay: 10, used: 3000 });
  assert.equal(res.status, 400, 'opening balance above the limit must be rejected');
  res = await api('POST', '/payment-methods', { kind: 'credit_card', nickname: 'Old Card', last4: '5555', creditLimit: 2000, statementDay: 20, dueDay: 10, used: 1500, billedUnpaid: 500 });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  const oldCard = res.data.data;
  createdMethods.push(oldCard.id);
  assert.equal(oldCard.credit.outstanding, 1500);
  assert.equal(oldCard.credit.amountDue, 500);
  assert.equal(oldCard.credit.available, 500);
  // Clear it so cleanup can remove it.
  res = await api('PUT', `/payment-methods/${oldCard.id}/balance`, { used: 0 });
  assert.equal(res.status, 200, JSON.stringify(res.data));

  // Card debt shows in net worth inputs.
  res = await api('GET', '/predictability');
  if (res.status === 200) {
    const principal = res.data?.data?.liabilities?.knownOutstandingPrincipal ?? res.data?.liabilities?.knownOutstandingPrincipal;
    assert.ok(principal >= 500, `expected card debt in knownOutstandingPrincipal, got ${principal}`);
  }

  // Deleting the card purchase returns 900 to the card (credit balance of -400).
  res = await api('DELETE', `/transactions/${cardTx}`);
  assert.equal(res.status, 200);
  createdTx.splice(createdTx.indexOf(cardTx), 1);
  assert.equal((await card(cc.id)).outstanding, -400);
  assert.equal(await balance(), startBalance - 100 - 400);

  // Now removable; archived methods can't be picked for new transactions.
  res = await api('DELETE', `/payment-methods/${cc.id}`);
  assert.equal(res.status, 200);
  res = await api('POST', '/transactions', { amount: 10, category: 'Shopping', type: 'Want', description: 'archived', paymentMethodId: cc.id });
  assert.equal(res.status, 400);

  console.log('creditCardFlow: all checks passed');
}

async function cleanup() {
  for (const id of createdTx) await api('DELETE', `/transactions/${id}`);
  for (const id of createdMethods) await api('DELETE', `/payment-methods/${id}`);
}

run()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(cleanup);

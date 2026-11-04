/**
 * Integration test for the user timezone setting.
 *
 * Runs against a live backend. Usage:
 *   1. Start the server:  cd server && node index.js
 *   2. Run:               node tests/timezone/userTimezone.test.js
 *      (set API_URL=http://localhost:4100/api to target another port)
 *
 * Uses its own test user and puts its timezone back to IST afterwards.
 */
import assert from 'node:assert/strict';

const BASE_URL = process.env.API_URL || 'http://localhost:4000/api';
const EMAIL = 'test-timezone@finaura.test';
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
    await api('POST', '/auth/register', { name: 'Test Timezone', email: EMAIL, password: PASSWORD });
    res = await api('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  }
  assert.ok(res.data?.token, `login failed: ${res.status}`);
  token = res.data.token;
}

const created = { tx: [], methods: [], liabilities: [] };

async function run() {
  await login();

  // Default is IST.
  await api('PUT', '/user/profile', { timezone: 'Asia/Kolkata' });
  let me = await api('GET', '/auth/me');
  assert.equal(me.data.user.timezone, 'Asia/Kolkata');

  // Unsupported values are rejected.
  let res = await api('PUT', '/user/profile', { timezone: 'Mars/Olympus' });
  assert.equal(res.status, 400);

  // Bill due dates land at 00:00 in the user's timezone.
  res = await api('POST', '/liabilities', {
    name: 'TZ rent', amount: 100, category: 'Housing', type: 'Need', autoDeduct: true,
    frequency: 'monthly', dayOfMonth: 10, startDate: new Date().toISOString()
  });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  created.liabilities.push(res.data.data.id);
  const istDue = new Date(res.data.data.nextDueDate);
  assert.equal(istDue.getUTCHours() * 60 + istDue.getUTCMinutes(), 18 * 60 + 30, `IST midnight expected, got ${istDue.toISOString()}`);

  // Card statement dates follow the timezone.
  res = await api('POST', '/payment-methods', { kind: 'credit_card', nickname: 'TZ card', last4: '9999', creditLimit: 1000, statementDay: 20, dueDay: 10 });
  assert.equal(res.status, 201);
  const cardId = res.data.data.id;
  created.methods.push(cardId);
  const istStatement = new Date(res.data.data.credit.nextStatementDate);
  assert.equal(istStatement.toISOString().slice(11, 16), '18:30');

  // Switch to New York.
  res = await api('PUT', '/user/profile', { timezone: 'America/New_York' });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.user.timezone, 'America/New_York');

  const card = (await api('GET', '/payment-methods')).data.data.find((m) => m.id === cardId);
  const nyHour = new Date(card.credit.nextStatementDate).getUTCHours();
  assert.ok(nyHour === 4 || nyHour === 5, `NY midnight expected, got ${card.credit.nextStatementDate}`);

  // Existing bill keeps its stored date (only future dates change).
  const liab = (await api('GET', '/liabilities')).data.data.find((l) => l.id === created.liabilities[0]);
  assert.equal(new Date(liab.nextDueDate).getTime(), istDue.getTime());

  // Monthly report buckets by the user's month: an expense at 02:00 UTC on the 1st
  // is still the previous month in New York.
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prevPath = `/reports/monthly?year=${prev.getUTCFullYear()}&month=${prev.getUTCMonth() + 1}`;
  const find = (o, key) => (o && typeof o === 'object' ? (key in o ? o[key] : Object.values(o).map((v) => find(v, key)).find((v) => v !== undefined)) : undefined);
  const before = await api('GET', prevPath);
  assert.equal(before.status, 200, JSON.stringify(before.data));
  const startHour = new Date(find(before.data, 'startDate')).getUTCHours();
  assert.ok(startHour === 4 || startHour === 5, `NY month start expected, got ${find(before.data, 'startDate')}`);

  const firstUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 2, 0, 0));
  res = await api('POST', '/transactions', { amount: 5, category: 'Misc', type: 'Need', description: 'tz edge', timestamp: firstUtc.toISOString() });
  assert.equal(res.status, 201);
  created.tx.push(res.data.id);
  const after = await api('GET', prevPath);
  assert.equal(find(after.data, 'transactionCount'), find(before.data, 'transactionCount') + 1,
    'expense at 02:00 UTC on the 1st should count in the previous month for New York');

  console.log('userTimezone: all checks passed');
}

async function cleanup() {
  for (const id of created.tx) await api('DELETE', `/transactions/${id}`);
  for (const id of created.methods) await api('DELETE', `/payment-methods/${id}`);
  for (const id of created.liabilities) await api('DELETE', `/liabilities/${id}`);
  await api('PUT', '/user/profile', { timezone: 'Asia/Kolkata' });
}

run()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(cleanup);

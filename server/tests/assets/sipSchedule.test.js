import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSipSchedule } from '../../services/SipSchedule.js';

const now = new Date('2028-02-29T03:00:00Z');
const zone = 'Asia/Kolkata';
const asset = { id: 'a', name: 'Index Fund', sipPayee: 'INDstocks MF', monthlyContribution: 2000, sipFirstDue: '2028-01-31' };
const tx = { id: 't', amount: 2000, description: 'INDSTOCKS MF - 123/UPI', type: 'Investment', timestamp: '2028-02-28T20:00:00Z' };
const schedule = (assets, txs) => buildSipSchedule(assets, txs, now, zone);

test('month end uses the user calendar, skips unscheduled assets and reserves only this month', () => {
  const result = schedule([asset, { ...asset, sipFirstDue: null }, { ...asset, id: 'future', sipFirstDue: '2028-03-03' }], []);
  assert.equal(result.remaining, 2000);
  assert.deepEqual(result.items.map(i => [i.dueDate, i.status]), [['2028-02-29', 'Awaiting debit'], ['2028-03-03', 'Scheduled']]);
});

test('one investment debit satisfies one occurrence on every read', () => {
  for (let retry = 0; retry < 2; retry++) {
    const result = schedule([asset], [tx]);
    assert.equal(result.remaining, 0);
    assert.equal(result.items[0].status, 'Recorded');
  }
});

test('same-day unrelated payments and other spend types cannot settle the SIP', () => {
  for (const change of [{ amount: 5000 }, { description: 'INDstocks MFutures' }, { type: 'Want' }, { timestamp: '2028-02-27T20:00:00Z' }]) {
    assert.equal(schedule([asset], [{ ...tx, ...change }]).remaining, 2000);
  }
});

test('ambiguous matches stay reserved for review', () => {
  assert.equal(schedule([asset], [tx, { ...tx, id: 'other' }]).items[0].status, 'Check matches');
  const result = schedule([asset, { ...asset, id: 'other' }], [tx]);
  assert.equal(result.remaining, 4000);
  assert.ok(result.items.every(i => i.status === 'Check matches'));
});

test('dashboard reserves a planned investment separately from bill totals and releases it after import', async (t) => {
  const { default: Asset } = await import('../../models/Asset.js');
  const { default: Liability } = await import('../../models/Liability.js');
  const { default: Transaction } = await import('../../models/Transaction.js');
  const { getMonthlyCommitments } = await import('../../services/CommitmentService.js');
  let investments = [];
  const query = rows => ({ select() { return this; }, lean: async () => rows });
  t.mock.method(Asset, 'find', filter => { assert.equal(filter.userId, 'user'); return query([asset]); });
  t.mock.method(Liability, 'find', filter => { assert.equal(filter.userId, 'user'); return query([]); });
  t.mock.method(Transaction, 'find', filter => {
    assert.equal(filter.userId, 'user');
    assert.equal(filter.type, 'Investment');
    return query(investments);
  });
  const read = () => getMonthlyCommitments('user', { currentBalance: 10000, now, tz: zone });
  const before = await read();
  assert.equal(before.currentBalance, 10000);
  assert.equal(before.freeBalance, 8000);
  assert.equal(before.committedTotal, 0);
  assert.equal(before.items.length, 0);
  investments = [{ ...tx, importBatchId: 'statement' }];
  const after = await read();
  assert.equal(after.sipSchedule.remaining, 0);
  assert.equal(after.sipSchedule.items[0].status, 'Recorded');
  assert.equal(after.freeBalance, 10000);
});

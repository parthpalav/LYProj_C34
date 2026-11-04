// Self-check for dueAlerts.ts. Day math uses the device timezone, so the test pins TZ.
import assert from 'node:assert/strict';
import { buildDueAlerts, buildReviewAlerts, daysUntil, dueLabel } from './dueAlerts.ts';

process.env.TZ = 'Asia/Kolkata';
const now = new Date('2026-11-01T06:00:00Z'); // Sun 1 Nov, 11:30 IST
const at = (key: string) => new Date(`${key}T00:00:00+05:30`).toISOString(); // 00:00 IST, as the server stores it
const ids = (a: { id: string }[]) => a.map((x) => x.id);

const bill = (id: string, due: string | null, extra = {}) =>
  ({ id, name: id, amount: 100, status: 'active', nextDueDate: due, ...extra }) as any;
const card = (id: string, credit: any, extra = {}) =>
  ({ id, kind: 'credit_card', nickname: id, status: 'active', credit: { amountDue: 5000, overdueAmount: 0, dueDate: at('2026-11-05'), ...credit }, ...extra }) as any;

assert.equal(daysUntil(at('2026-11-01'), now), 0);
assert.equal(daysUntil(at('2026-11-08'), now), 7);

// Week window: day 7 in, day 8 out, past liability skipped.
assert.deepEqual(ids(buildDueAlerts([bill('a', at('2026-11-08')), bill('b', at('2026-11-09')), bill('c', at('2026-10-31'))], [], now)), ['l-a']);
// Inactive, no due date and bad dates are ignored.
assert.deepEqual(buildDueAlerts([bill('a', null), bill('b', at('2026-11-02'), { status: 'deleted' }), bill('c', 'garbage')], [], now), []);

// Cards: nothing due = no alert; overdue always shows and sorts first.
assert.deepEqual(buildDueAlerts([], [card('zero', { amountDue: 0 })], now), []);
const mixed = buildDueAlerts([bill('a', at('2026-11-02'))], [card('late', { overdueAmount: 900, dueDate: at('2026-10-20') }), card('soon', {})], now);
assert.deepEqual(ids(mixed), ['c-late', 'l-a', 'c-soon']);
assert.equal(mixed[0].amount, 900);
assert.equal(dueLabel(mixed[0]), 'Overdue by 12 days');
assert.equal(dueLabel(mixed[1]), 'Due tomorrow');
assert.equal(dueLabel({ daysUntil: 0, overdue: false }), 'Due today');

// Monthly check-in: market assets a month past their last review; FD and fresh ones skipped.
const asset = (id: string, assetType: string, last: string) => ({ id, assetType, lastReviewedAt: last }) as any;
const reviews = buildReviewAlerts([
  asset('mf', 'Mutual Fund', '2026-10-01T00:00:00Z'),
  asset('eq', 'Stocks / Equity', '2026-09-15T00:00:00Z'),
  asset('fd', 'Fixed Deposit', '2026-01-01T00:00:00Z'),
  asset('new', 'Gold', '2026-10-20T00:00:00Z'),
], now);
assert.deepEqual(ids(reviews), ['eq', 'mf']);
// 31 Jan clamps to end of Feb.
assert.equal(buildReviewAlerts([asset('g', 'Gold', '2026-01-31T00:00:00Z')], new Date('2026-02-28T12:00:00Z')).length, 1);

console.log('dueAlerts.check: ok');

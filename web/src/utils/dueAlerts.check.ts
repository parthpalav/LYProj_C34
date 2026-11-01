// Self-check for dueAlerts.ts. Run: node --experimental-strip-types src/utils/dueAlerts.check.ts
import assert from 'node:assert/strict';
import { buildDueAlerts, daysUntil, dueLabel } from './dueAlerts.ts';
import { setAppTimezone } from './timezone.ts';

setAppTimezone('Asia/Kolkata');
const now = new Date('2026-11-01T06:00:00Z'); // Sun 1 Nov, 11:30 IST
const at = (key: string) => new Date(`${key}T00:00:00+05:30`).toISOString(); // 00:00 IST, as the server stores it

const bill = (id: string, due: string | null, extra = {}) =>
  ({ id, name: id, amount: 100, status: 'active', nextDueDate: due, ...extra }) as any;
const card = (id: string, credit: any, extra = {}) =>
  ({ id, kind: 'credit_card', nickname: id, status: 'active', credit: { amountDue: 5000, overdueAmount: 0, dueDate: at('2026-11-05'), ...credit }, ...extra }) as any;

// Day math runs in the app timezone, not the browser's.
assert.equal(daysUntil(at('2026-11-01'), now), 0);
assert.equal(daysUntil(at('2026-11-08'), now), 7);
assert.equal(daysUntil('2026-10-31T20:00:00Z', new Date('2026-10-31T19:00:00Z')), 0); // both Nov 1 in IST, though Oct 31 in UTC
setAppTimezone('America/New_York');
assert.equal(daysUntil('2026-11-01T03:00:00Z', new Date('2026-11-01T03:30:00Z')), 0);
setAppTimezone('Asia/Kolkata');

// Week window: day 7 in, day 8 out, past liability skipped.
const ids = (a: any[]) => a.map((x) => x.id);
assert.deepEqual(ids(buildDueAlerts([bill('a', at('2026-11-08')), bill('b', at('2026-11-09')), bill('c', at('2026-10-31'))], [], now)), ['l-a']);
// Inactive, no due date (no auto-deduct) and bad dates are ignored.
assert.deepEqual(buildDueAlerts([bill('a', null), bill('b', at('2026-11-02'), { status: 'deleted' }), bill('c', 'garbage')], [], now), []);
// Month boundary: 30 Nov is 29 days out; 1 Dec seen from 26 Nov is 5 days out.
assert.equal(buildDueAlerts([bill('a', at('2026-11-30'))], [], now).length, 0);
assert.equal(buildDueAlerts([bill('a', at('2026-12-01'))], [], new Date('2026-11-26T06:00:00Z')).length, 1);

// Credit cards: due soon, nothing owed, too far out, overdue, archived, non-card.
assert.deepEqual(ids(buildDueAlerts([], [card('x', {})], now)), ['c-x']);
assert.equal(buildDueAlerts([], [card('x', { amountDue: 0 })], now).length, 0);
assert.equal(buildDueAlerts([], [card('x', { dueDate: at('2026-11-20') })], now).length, 0);
const late = buildDueAlerts([], [card('x', { overdueAmount: 900, dueDate: at('2026-10-28') })], now)[0];
assert.equal(late.overdue, true);
assert.equal(late.amount, 900);
assert.equal(dueLabel(late), 'Overdue by 4 days');
assert.equal(buildDueAlerts([], [card('x', {}, { status: 'archived' }), card('y', {}, { kind: 'debit_card' })], now).length, 0);

// Overdue first, then soonest.
assert.deepEqual(
  ids(buildDueAlerts([bill('b', at('2026-11-02'))], [card('x', { overdueAmount: 1, dueDate: at('2026-10-30') }), card('y', { dueDate: at('2026-11-01') })], now)),
  ['c-x', 'c-y', 'l-b'],
);

assert.equal(dueLabel({ daysUntil: 0, overdue: false }), 'Due today');
assert.equal(dueLabel({ daysUntil: 1, overdue: false }), 'Due tomorrow');
assert.equal(dueLabel({ daysUntil: 6, overdue: false }), 'Due in 6 days');
console.log('dueAlerts checks passed');

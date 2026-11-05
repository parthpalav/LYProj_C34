// Pure checks for buildCommitments (no DB). Run: node server/tests/liabilities/commitments.test.js
import assert from 'node:assert/strict';
import { buildCommitments } from '../../services/CommitmentService.js';

const tz = 'UTC';
const now = new Date('2026-07-10T12:00:00Z'); // Friday; July 2026 has Fridays 3, 10, 17, 24, 31
const d = (s) => new Date(`${s}T00:00:00Z`);
const base = { userId: 'U1', category: 'Utilities & Bills', type: 'Need', autoDeduct: true, status: 'active', startDate: d('2026-01-01') };

const liabilities = [
  { ...base, id: 'weekly', name: 'Maid', amount: 500, frequency: 'weekly', dayOfWeek: 5, nextDueDate: d('2026-07-10') },
  { ...base, id: 'monthly-paid', name: 'EMI', amount: 20000, frequency: 'monthly', dayOfMonth: 5, nextDueDate: d('2026-08-05') },
  { ...base, id: 'mid-start', name: 'Gym', type: 'Want', amount: 1500, frequency: 'monthly', dayOfMonth: 20, startDate: d('2026-07-15'), nextDueDate: d('2026-07-20') },
  { ...base, id: 'daily', name: 'Milk', amount: 60, frequency: 'daily', nextDueDate: d('2026-07-11') },
  { ...base, id: 'manual', name: 'Rent', amount: 30000, frequency: 'monthly', dayOfMonth: 25, autoDeduct: false, nextDueDate: null },
  // Created after its July due: the scheduler points to August, so nothing is due or paid this month
  { ...base, id: 'late-created', name: 'Netflix', type: 'Want', amount: 649, frequency: 'monthly', dayOfMonth: 1, nextDueDate: d('2026-08-01') },
];
const paidTxs = [
  { liabilityId: 'weekly', scheduledFor: d('2026-07-03'), amount: 500 },
  { liabilityId: 'monthly-paid', scheduledFor: d('2026-07-05'), amount: 20000 },
  { liabilityId: 'weekly', scheduledFor: d('2026-06-26'), amount: 500 }, // last month: ignored
  ...Array.from({ length: 10 }, (_, i) => ({ liabilityId: 'daily', scheduledFor: d(`2026-07-${String(i + 1).padStart(2, '0')}`), amount: 60 })),
];

const r = buildCommitments({ liabilities, paidTxs, currentBalance: 100000, now, tz });
const byId = Object.fromEntries(r.items.map((i) => [i.id, i]));

assert.deepEqual(Object.keys(byId).sort(), ['daily', 'mid-start', 'monthly-paid', 'weekly'], 'manual and not-due bills excluded');
assert.deepEqual(byId.weekly.dueDates, ['2026-07-10', '2026-07-17', '2026-07-24', '2026-07-31']);
assert.equal(byId.weekly.paidCount, 1);
assert.equal(byId.weekly.remainingAmount, 2000);
assert.equal(byId['monthly-paid'].remainingAmount, 0);
assert.equal(byId['monthly-paid'].paidAmount, 20000);
assert.deepEqual(byId['mid-start'].dueDates, ['2026-07-20']);
assert.equal(byId.daily.dueDates.length, 21); // 11th..31st
assert.equal(byId.daily.paidCount, 10);

assert.equal(r.month, '2026-07');
assert.equal(r.monthEnd, '2026-07-31');
assert.equal(r.remaining, 2000 + 1500 + 21 * 60);
assert.equal(r.paidSoFar, 500 + 20000 + 600);
assert.equal(r.committedTotal, r.paidSoFar + r.remaining);
assert.equal(r.freeBalance, 100000 - r.remaining);
assert.deepEqual(r.byType.Want, { committed: 1500, remaining: 1500 });
assert.equal(r.items[0].id, 'weekly', 'sorted by next due date');

// Zone boundary: IST month starts 18:30 UTC the day before
const ist = buildCommitments({
  liabilities: [{ ...base, id: 'x', name: 'X', amount: 100, frequency: 'monthly', dayOfMonth: 1, nextDueDate: new Date('2026-07-31T18:30:00Z') }],
  paidTxs: [],
  currentBalance: 0,
  now: new Date('2026-07-31T19:00:00Z'), // already Aug 1 in IST
  tz: 'Asia/Kolkata',
});
assert.equal(ist.month, '2026-08');
assert.deepEqual(ist.items[0].dueDates, ['2026-08-01']);

console.log('commitments: all checks passed');
